import { NextResponse } from "next/server";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { paginate } from "@/lib/paginate";

/* ── Channel definitions ──────────────────────────────────── */
// canal_group values in mktp_daily_counts: "Vendas Diretas" | "Parcerias"
// "Funil Completo" is computed by summing ALL rows regardless of canal_group

const CHANNEL_ORDER = ["Vendas Diretas", "Parcerias", "Funil Completo"] as const;
type MktpChannel = (typeof CHANNEL_ORDER)[number];

const CHANNEL_FILTERS: Record<MktpChannel, string> = {
  "Vendas Diretas": "canal_group = 'Vendas Diretas' — todos os canais exceto parcerias",
  Parcerias: "canal_group = 'Parcerias' (IDs 582, 583, 2876)",
  "Funil Completo": "Todos os canais combinados (Vendas Diretas + Parcerias)",
};

/* ── Canal ID → group (for mktp_deals which stores raw canal IDs) ── */
const PARCERIA_CANAL_IDS = new Set(["582", "583", "2876"]);

function getCanalGroup(canalId: string): MktpChannel {
  return PARCERIA_CANAL_IDS.has(canalId) ? "Parcerias" : "Vendas Diretas";
}

/* ── Stage IDs in mktp_deals ─────────────────────────────── */
const STAGE_RESERVA = 305;   // "Reserva" (equivalent to Ag. Dados in SZS)
const STAGE_CONTRATO = 271;  // "Contrato"

/* ── Metas (zeros — to be filled later) ──────────────────── */
interface ChannelMetas {
  orcamento?: number;
  leads?: number;
  mql: number;
  sql: number;
  opp: number;
  won: number;
}

const MKTP_RESULTADOS_METAS: Record<string, Record<string, ChannelMetas>> = {
  // Will be populated later
  // "2026-03": {
  //   "Vendas Diretas": { mql: 0, sql: 0, opp: 0, won: 0 },
  //   Parcerias: { mql: 0, sql: 0, opp: 0, won: 0 },
  //   "Funil Completo": { mql: 0, sql: 0, opp: 0, won: 0 },
  // },
};

/* ── Closers ──────────────────────────────────────────────── */
// const CHANNEL_CLOSERS: Record<string, string[]> = {
//   "Vendas Diretas": ["Nevine", "Willian Miranda"],
//   Parcerias: [],
//   "Funil Completo": [],
// };

/* ── Types ────────────────────────────────────────────────── */
interface MetricPair { real: number; meta: number }

interface ChannelResult {
  name: string;
  filterDescription: string;
  metrics: {
    orcamento?: MetricPair;
    leads?: MetricPair;
    mql: MetricPair;
    sql: MetricPair;
    opp: MetricPair;
    won: MetricPair;
  };
  lastMonthWon: number;
  snapshots: { aguardandoDados: number; emContrato: number };
  ocupacaoAgenda: { agendadas: number; capacidade: number; percent: number };
  dealsHistory: { date: string; total: number; byStage: Record<string, number> }[];
}

interface ResultadosMKTPData {
  month: string;
  channels: ChannelResult[];
}

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const admin = createSquadSupabaseAdmin();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const startDate = `${monthKey}-01`;

    const prevDate = new Date(year, month - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    const prevStart = `${prevKey}-01`;
    const prevEnd = `${prevKey}-${new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).getDate()}`;

    const cutoff90 = new Date(now);
    cutoff90.setDate(cutoff90.getDate() - 90);
    const cutoffDate = cutoff90.toISOString().substring(0, 10);

    /* ── 1. Current month counts from mktp_daily_counts ────── */
    const countsRows = await paginate((o, ps) =>
      admin
        .from("mktp_daily_counts")
        .select("date, tab, canal_group, count")
        .gte("date", startDate)
        .range(o, o + ps - 1)
    );

    // Accumulate per channel (Vendas Diretas / Parcerias) + Funil Completo (all)
    const channelCounts: Record<string, Record<string, number>> = {};
    for (const ch of CHANNEL_ORDER) channelCounts[ch] = {};

    for (const r of countsRows) {
      const group = (r.canal_group as string) || "Vendas Diretas";
      const key = r.tab as string;
      const val = r.count || 0;

      // Assign to specific channel group
      channelCounts[group][key] = (channelCounts[group][key] || 0) + val;

      // Always add to Funil Completo
      channelCounts["Funil Completo"][key] = (channelCounts["Funil Completo"][key] || 0) + val;
    }

    /* ── 2. Previous month WON ──────────────────────────────── */
    const prevRows = await paginate((o, ps) =>
      admin
        .from("mktp_daily_counts")
        .select("canal_group, count")
        .eq("tab", "won")
        .gte("date", prevStart)
        .lte("date", prevEnd)
        .range(o, o + ps - 1)
    );

    const prevWon: Record<string, number> = {};
    for (const r of prevRows) {
      const group = (r.canal_group as string) || "Vendas Diretas";
      const val = r.count || 0;
      prevWon[group] = (prevWon[group] || 0) + val;
      prevWon["Funil Completo"] = (prevWon["Funil Completo"] || 0) + val;
    }

    /* ── 3. Meta Ads spend ──────────────────────────────────── */
    const metaRows = await paginate((o, ps) =>
      admin.from("mktp_meta_ads").select("spend_month").range(o, o + ps - 1)
    );
    let totalSpend = 0;
    for (const r of metaRows) totalSpend += r.spend_month || 0;

    /* ── 4. Snapshots from mktp_deals ──────────────────────── */
    // mktp_deals uses stage_id (not stage_order)
    const snapshotDeals = await paginate((o, ps) =>
      admin
        .from("mktp_deals")
        .select("stage_id, canal, status")
        .eq("status", "open")
        .in("stage_id", [STAGE_RESERVA, STAGE_CONTRATO])
        .range(o, o + ps - 1)
    );

    const snapshots: Record<string, { reserva: number; contrato: number }> = {};
    for (const ch of CHANNEL_ORDER) snapshots[ch] = { reserva: 0, contrato: 0 };

    for (const d of snapshotDeals) {
      const group = getCanalGroup(String(d.canal || ""));
      if (d.stage_id === STAGE_RESERVA) {
        snapshots[group].reserva++;
        snapshots["Funil Completo"].reserva++;
      } else if (d.stage_id === STAGE_CONTRATO) {
        snapshots[group].contrato++;
        snapshots["Funil Completo"].contrato++;
      }
    }

    /* ── 5. Deals history (90 days) ────────────────────────── */
    const historyRows = await paginate((o, ps) =>
      admin
        .from("mktp_daily_counts")
        .select("date, tab, canal_group, count")
        .gte("date", cutoffDate)
        .range(o, o + ps - 1)
    );

    // Map: channel → date → tab → count
    const histMap: Record<string, Map<string, Record<string, number>>> = {};
    for (const ch of CHANNEL_ORDER) histMap[ch] = new Map();

    for (const r of historyRows) {
      const group = (r.canal_group as string) || "Vendas Diretas";
      const val = r.count || 0;
      const date = r.date as string;
      const tab = r.tab as string;

      // Add to specific channel
      if (!histMap[group].has(date)) histMap[group].set(date, {});
      const entry = histMap[group].get(date)!;
      entry[tab] = (entry[tab] || 0) + val;

      // Add to Funil Completo
      if (!histMap["Funil Completo"].has(date)) histMap["Funil Completo"].set(date, {});
      const fcEntry = histMap["Funil Completo"].get(date)!;
      fcEntry[tab] = (fcEntry[tab] || 0) + val;
    }

    /* ── 6. Build response ──────────────────────────────────── */
    const metas = MKTP_RESULTADOS_METAS[monthKey] || {};

    const channels: ChannelResult[] = CHANNEL_ORDER.map((name) => {
      const counts = channelCounts[name] || {};
      const meta = metas[name] || { mql: 0, sql: 0, opp: 0, won: 0 };
      const snap = snapshots[name];

      const metrics: ChannelResult["metrics"] = {
        mql: { real: counts.mql || 0, meta: meta.mql },
        sql: { real: counts.sql || 0, meta: meta.sql },
        opp: { real: counts.opp || 0, meta: meta.opp },
        won: { real: counts.won || 0, meta: meta.won },
      };

      // Orcamento only for Vendas Diretas (paid spend goes to that channel)
      if (name === "Vendas Diretas" && meta.orcamento != null) {
        metrics.orcamento = { real: Math.round(totalSpend), meta: meta.orcamento };
      }
      if (meta.leads != null) {
        metrics.leads = { real: counts.mql || 0, meta: meta.leads };
      }

      const histEntries = histMap[name];
      const dealsHistory = Array.from(histEntries.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, tabs]) => ({
          date,
          total: Object.values(tabs).reduce((s, v) => s + v, 0),
          byStage: tabs,
        }));

      return {
        name,
        filterDescription: CHANNEL_FILTERS[name],
        metrics,
        lastMonthWon: prevWon[name] || 0,
        snapshots: { aguardandoDados: snap.reserva, emContrato: snap.contrato },
        // MKTP has no Agendado stage — set to 0
        ocupacaoAgenda: { agendadas: 0, capacidade: 0, percent: 0 },
        dealsHistory,
      };
    });

    const body: ResultadosMKTPData = { month: monthKey, channels };
    return NextResponse.json(body);
  } catch (err: unknown) {
    console.error("[mktp/resultados]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
