import { NextResponse } from "next/server";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { paginate } from "@/lib/paginate";

/* ── Channel definitions ──────────────────────────────────── */
const CHANNEL_ORDER = ["Funil Completo", "Vendas Diretas", "Parcerias"] as const;
type MktpChannel = (typeof CHANNEL_ORDER)[number];

const CHANNEL_FILTERS: Record<MktpChannel, string> = {
  "Vendas Diretas": "canal NOT IN (582, 583, 2876) — todos os canais exceto parcerias",
  Parcerias: "canal IN (582, 583, 2876) — Indicação Corretor + Franquia + Outros Parceiros",
  "Funil Completo": "Todos os canais combinados",
};

const PARCERIA_CANAL_IDS = new Set(["582", "583", "2876"]);

function getCanalGroup(canalId: string): "Vendas Diretas" | "Parcerias" {
  return PARCERIA_CANAL_IDS.has(canalId) ? "Parcerias" : "Vendas Diretas";
}

/* ── Stage IDs (pipeline 37) ─────────────────────────────── */
const STAGE_RESERVA = 305;
const STAGE_CONTRATO = 271;

/* ── Metas (preencher com valores reais) ─────────────────── */
interface ChannelMetas {
  orcamento?: number;
  leads?: number;
  mql: number;
  sql: number;
  opp: number;
  won: number;
  reserva?: number;
  contrato?: number;
}

const MKTP_RESULTADOS_METAS: Record<string, Record<string, ChannelMetas>> = {
  "2026-03": {
    "Vendas Diretas": { leads: 3354, mql: 1677, sql: 530, opp: 126, won: 9 },
    Parcerias: { mql: 31, sql: 23, opp: 17, won: 6 },
    "Funil Completo": { mql: 1436, sql: 479, opp: 132, won: 15, reserva: 25, contrato: 18 },
  },
};

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
    reserva?: MetricPair;
    contrato?: MetricPair;
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

/* ── Tab → date column in mktp_deals ─────────────────────── */
const TAB_DATE_COL: Record<string, string> = {
  mql: "add_time",
  sql: "qualificacao_date",
  opp: "reuniao_date",
  won: "won_time",
};

const TABS = ["mql", "sql", "opp", "won"] as const;

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

    /* ── 1. Fetch all deals from mktp_deals for current + previous month + 90d history ── */
    const allDeals = await paginate((o, ps) =>
      admin
        .from("mktp_deals")
        .select("canal, status, stage_id, add_time, won_time, qualificacao_date, reuniao_date")
        .gte("add_time", cutoffDate)
        .range(o, o + ps - 1)
    );

    // Also fetch won deals that may have add_time before cutoff but won_time in range
    const wonDeals = await paginate((o, ps) =>
      admin
        .from("mktp_deals")
        .select("canal, status, stage_id, add_time, won_time, qualificacao_date, reuniao_date")
        .eq("status", "won")
        .gte("won_time", prevStart)
        .lt("add_time", cutoffDate)
        .range(o, o + ps - 1)
    );

    // Merge, dedup by combining (won deals with old add_time but recent won_time)
    const dealMap = new Map<string, any>();
    for (const d of allDeals) {
      const key = `${d.canal}|${d.add_time}|${d.status}|${d.stage_id}`;
      dealMap.set(key, d);
    }
    for (const d of wonDeals) {
      const key = `${d.canal}|${d.add_time}|${d.status}|${d.stage_id}`;
      dealMap.set(key, d);
    }
    const deals = Array.from(dealMap.values());

    /* ── 2. Count funnel by channel for current month ──────── */
    const channelCounts: Record<string, Record<string, number>> = {};
    for (const ch of CHANNEL_ORDER) channelCounts[ch] = {};

    for (const deal of deals) {
      const group = getCanalGroup(String(deal.canal || ""));
      for (const tab of TABS) {
        const dateCol = TAB_DATE_COL[tab];
        const dateVal = deal[dateCol];
        if (!dateVal) continue;
        const day = dateVal.substring(0, 10);
        if (day < startDate) continue; // only current month
        channelCounts[group][tab] = (channelCounts[group][tab] || 0) + 1;
        channelCounts["Funil Completo"][tab] = (channelCounts["Funil Completo"][tab] || 0) + 1;
      }
    }

    /* ── 3. Previous month WON ─────────────────────────────── */
    const prevWon: Record<string, number> = {};
    for (const deal of deals) {
      if (deal.status !== "won") continue;
      const wonDate = deal.won_time?.substring(0, 10);
      if (!wonDate || wonDate < prevStart || wonDate > prevEnd) continue;
      const group = getCanalGroup(String(deal.canal || ""));
      prevWon[group] = (prevWon[group] || 0) + 1;
      prevWon["Funil Completo"] = (prevWon["Funil Completo"] || 0) + 1;
    }

    /* ── 4. Meta Ads spend ─────────────────────────────────── */
    const metaRows = await paginate((o, ps) =>
      admin.from("mktp_meta_ads").select("spend_month").range(o, o + ps - 1)
    );
    let totalSpend = 0;
    for (const r of metaRows) totalSpend += r.spend_month || 0;

    /* ── 5. Snapshots from open deals ──────────────────────── */
    const snapshotDeals = await paginate((o, ps) =>
      admin
        .from("mktp_deals")
        .select("stage_id, canal")
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

    /* ── 6. History (90 days) for charts ───────────────────── */
    const histMap: Record<string, Map<string, Record<string, number>>> = {};
    for (const ch of CHANNEL_ORDER) histMap[ch] = new Map();

    for (const deal of deals) {
      const group = getCanalGroup(String(deal.canal || ""));
      for (const tab of TABS) {
        const dateCol = TAB_DATE_COL[tab];
        const dateVal = deal[dateCol];
        if (!dateVal) continue;
        const day = dateVal.substring(0, 10);
        if (day < cutoffDate) continue;

        // Specific channel
        if (!histMap[group].has(day)) histMap[group].set(day, {});
        const entry = histMap[group].get(day)!;
        entry[tab] = (entry[tab] || 0) + 1;

        // Funil Completo
        if (!histMap["Funil Completo"].has(day)) histMap["Funil Completo"].set(day, {});
        const fcEntry = histMap["Funil Completo"].get(day)!;
        fcEntry[tab] = (fcEntry[tab] || 0) + 1;
      }
    }

    /* ── 7. Build response ─────────────────────────────────── */
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

      if (meta.orcamento != null) {
        metrics.orcamento = { real: Math.round(totalSpend), meta: meta.orcamento };
      }
      if (meta.leads != null) {
        metrics.leads = { real: counts.mql || 0, meta: meta.leads };
      }
      if (meta.reserva != null) {
        metrics.reserva = { real: snap.reserva, meta: meta.reserva };
      }
      if (meta.contrato != null) {
        metrics.contrato = { real: snap.contrato, meta: meta.contrato };
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
