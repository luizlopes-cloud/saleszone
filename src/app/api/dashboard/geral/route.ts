import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { paginate } from "@/lib/paginate";
import type { GeralData, GeralChannelResult, GeralMetricPair } from "@/lib/types";

export const dynamic = "force-dynamic";

// Canal value → macro channel
// squad_deals.canal has mixed values: names ("Marketing") and IDs ("582")
const CANAL_MAP: Record<string, string> = {
  // By name
  "Marketing": "Vendas Diretas",
  // By ID and name — Parceiros
  "582": "Parceiros",
  "583": "Parceiros",
  "2876": "Parceiros",
  "Indicação de Corretor": "Parceiros",
  "Indicaçao de Franquia": "Parceiros",  // note: typo in data (no ~)
  "Indicação de outros Parceiros (exceto corretor e franquia)": "Parceiros",
};
function getMacroChannel(canal: string | null): string {
  if (!canal) return "Outros";
  return CANAL_MAP[canal] || "Outros";
}

const CHANNEL_ORDER = ["Geral", "Vendas Diretas", "Parceiros"] as const;

// Stage thresholds for squad_deals.max_stage_order (SZI pipeline 28)
const TH_MQL = 1;
const TH_SQL = 5;
const TH_OPP = 9;
const TH_RESERVA = 13;
const TH_CONTRATO = 14;

// Hardcoded metas for March 2026
interface ChannelMetas {
  orcamento?: number;
  leads?: number;
  mql: number;
  sql: number;
  opp: number;
  reserva?: number;
  contrato?: number;
  won: number;
}

const METAS_BY_MONTH: Record<string, Record<string, ChannelMetas>> = {
  "2026-03": {
    "Vendas Diretas": { orcamento: 232389, leads: 9661, mql: 2839, sql: 921, opp: 228, won: 40 },
    Parceiros: { mql: 1348, sql: 524, opp: 260, won: 55 },
    Geral: { mql: 4187, sql: 1445, opp: 488, reserva: 217, contrato: 125, won: 95 },
  },
};

function pair(real: number, meta: number): GeralMetricPair {
  return { real, meta };
}

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

    // ── 1. Funnel counts from squad_daily_counts (TOTAL — no canal split) ──
    // This is the authoritative source for MQL/SQL/OPP/WON in SZI
    const countsRows = await paginate((o, ps) =>
      supabase
        .from("squad_daily_counts")
        .select("date, tab, count")
        .in("tab", ["mql", "sql", "opp", "won", "reserva", "contrato"])
        .gte("date", startDate)
        .range(o, o + ps - 1),
    );

    const totalCounts: Record<string, number> = {};
    for (const r of countsRows) {
      totalCounts[r.tab] = (totalCounts[r.tab] || 0) + (r.count || 0);
    }
    console.log(`[geral] squad_daily_counts total: mql=${totalCounts.mql || 0}, sql=${totalCounts.sql || 0}, opp=${totalCounts.opp || 0}, won=${totalCounts.won || 0}`);

    // ── 2. Canal split from squad_deals (MQL/SQL/OPP/WON by canal) ──
    // squad_deals has `canal` field for per-channel breakdown
    const deals = await paginate((o, ps) =>
      admin
        .from("squad_deals")
        .select("canal, max_stage_order, stage_order, status, lost_reason, won_time")
        .not("empreendimento", "is", null)
        .or(`status.eq.open,won_time.gte.${startDate},lost_time.gte.${startDate},add_time.gte.${startDate}`)
        .range(o, o + ps - 1),
    );
    console.log(`[geral] squad_deals returned ${deals.length} deals`);
    // Debug: check canal values
    const canalDistrib: Record<string, number> = {};
    for (const d of deals.slice(0, 500)) {
      const key = String(d.canal ?? "NULL");
      canalDistrib[key] = (canalDistrib[key] || 0) + 1;
    }
    console.log(`[geral] canal distribution (first 500):`, JSON.stringify(canalDistrib));

    // Count by macro channel
    const channelCounts: Record<string, Record<string, number>> = {};
    for (const ch of CHANNEL_ORDER) channelCounts[ch] = { mql: 0, sql: 0, opp: 0, won: 0, reserva: 0, contrato: 0 };

    for (const d of deals) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const macro = getMacroChannel(d.canal);
      const mso = d.max_stage_order ?? d.stage_order ?? 0;

      // Vendas Diretas and Parceiros get their own counts
      if (macro === "Vendas Diretas" || macro === "Parceiros") {
        if (mso >= TH_MQL) channelCounts[macro].mql++;
        if (mso >= TH_SQL) channelCounts[macro].sql++;
        if (mso >= TH_OPP) channelCounts[macro].opp++;
        if (mso >= TH_RESERVA) channelCounts[macro].reserva++;
        if (mso >= TH_CONTRATO) channelCounts[macro].contrato++;
        if (d.status === "won") channelCounts[macro].won++;
      }
    }
    console.log(`[geral] channelCounts VD: mql=${channelCounts["Vendas Diretas"].mql}, won=${channelCounts["Vendas Diretas"].won}`);
    console.log(`[geral] channelCounts Parceiros: mql=${channelCounts.Parceiros.mql}, won=${channelCounts.Parceiros.won}`);

    // Geral = from squad_daily_counts (authoritative total)
    channelCounts.Geral = {
      mql: totalCounts.mql || 0,
      sql: totalCounts.sql || 0,
      opp: totalCounts.opp || 0,
      won: totalCounts.won || 0,
      reserva: totalCounts.reserva || 0,
      contrato: totalCounts.contrato || 0,
    };

    // ── 3. Previous month WON ──
    const prevRows = await paginate((o, ps) =>
      supabase
        .from("squad_daily_counts")
        .select("count")
        .eq("tab", "won")
        .gte("date", prevStart)
        .lte("date", prevEnd)
        .range(o, o + ps - 1),
    );
    const prevTotalWon = prevRows.reduce((s, r) => s + (r.count || 0), 0);

    // Per-channel previous won from squad_deals
    const prevDeals = await paginate((o, ps) =>
      admin
        .from("squad_deals")
        .select("canal, status")
        .eq("status", "won")
        .gte("won_time", prevStart)
        .lte("won_time", prevEnd)
        .range(o, o + ps - 1),
    );
    const prevWon: Record<string, number> = { "Vendas Diretas": 0, Parceiros: 0, Geral: prevTotalWon };
    for (const d of prevDeals) {
      const macro = getMacroChannel(d.canal);
      if (macro === "Vendas Diretas" || macro === "Parceiros") prevWon[macro]++;
    }

    // ── 4. Meta Ads spend + leads (Vendas Diretas only) ──
    const metaRows = await paginate((o, ps) =>
      supabase
        .from("squad_meta_ads")
        .select("ad_id, spend_month, leads_month")
        .gte("snapshot_date", startDate)
        .range(o, o + ps - 1),
    );
    const adMax = new Map<string, { spend: number; leads: number }>();
    for (const r of metaRows) {
      const spend = Number(r.spend_month) || 0;
      const leads = Number(r.leads_month) || 0;
      const cur = adMax.get(r.ad_id);
      if (!cur || spend > cur.spend) adMax.set(r.ad_id, { spend, leads });
    }
    let totalSpend = 0, totalLeads = 0;
    for (const v of adMax.values()) { totalSpend += v.spend; totalLeads += v.leads; }

    // ── 5. Orçamento ──
    const { data: orcData } = await supabase
      .from("squad_orcamento")
      .select("orcamento_total")
      .eq("mes", monthKey)
      .maybeSingle();
    const orcamentoMeta = orcData?.orcamento_total || 0;

    // ── 6. Snapshots: open deals in Reserva/Contrato stages ──
    const openDeals = await paginate((o, ps) =>
      admin
        .from("squad_deals")
        .select("canal, stage_id, status")
        .eq("status", "open")
        .in("stage_id", [191, 192])
        .range(o, o + ps - 1),
    );
    const snaps: Record<string, { reserva: number; contrato: number }> = {};
    for (const ch of CHANNEL_ORDER) snaps[ch] = { reserva: 0, contrato: 0 };
    for (const d of openDeals) {
      const macro = getMacroChannel(d.canal);
      const target = (macro === "Vendas Diretas" || macro === "Parceiros") ? macro : "Geral";
      if (d.stage_id === 191) snaps[target].reserva++;
      if (d.stage_id === 192) snaps[target].contrato++;
      // Always add to Geral too
      if (target !== "Geral") {
        if (d.stage_id === 191) snaps.Geral.reserva++;
        if (d.stage_id === 192) snaps.Geral.contrato++;
      }
    }

    // ── 7. History (last 90 days) from squad_daily_counts ──
    const historyRows = await paginate((o, ps) =>
      supabase
        .from("squad_daily_counts")
        .select("date, tab, count, source")
        .in("tab", ["mql", "sql", "opp", "won", "reserva", "contrato"])
        .gte("date", cutoffDate)
        .range(o, o + ps - 1),
    );
    const histMap = new Map<string, Record<string, number>>();
    const openTotalMap = new Map<string, number>();
    for (const r of historyRows) {
      if (!histMap.has(r.date)) histMap.set(r.date, {});
      const entry = histMap.get(r.date)!;
      entry[r.tab] = (entry[r.tab] || 0) + (r.count || 0);
      if (r.source === "open" && r.tab === "mql") {
        openTotalMap.set(r.date, (openTotalMap.get(r.date) || 0) + (r.count || 0));
      }
    }
    const dealsHistory = Array.from(histMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, tabs]) => ({
        date,
        total: Object.values(tabs).reduce((s, v) => s + v, 0),
        openTotal: openTotalMap.get(date) || 0,
        byStage: tabs,
      }));

    // ── Build channels ──
    const metas = METAS_BY_MONTH[monthKey] || {};

    const channels: GeralChannelResult[] = CHANNEL_ORDER.map((name) => {
      const counts = channelCounts[name];
      const meta = metas[name] || { mql: 0, sql: 0, opp: 0, won: 0 };
      const snap = snaps[name];

      const metrics: GeralChannelResult["metrics"] = {
        mql: pair(counts.mql, meta.mql),
        sql: pair(counts.sql, meta.sql),
        opp: pair(counts.opp, meta.opp),
        won: pair(counts.won, meta.won),
      };

      // Vendas Diretas: add orcamento + leads
      if (name === "Vendas Diretas") {
        metrics.orcamento = pair(Math.round(totalSpend), orcamentoMeta || meta.orcamento || 0);
        metrics.leads = pair(totalLeads, meta.leads || 0);
      }

      // Geral: add reserva + contrato bars
      if (name === "Geral" && meta.reserva != null) {
        metrics.reserva = pair(counts.reserva, meta.reserva);
        metrics.contrato = pair(counts.contrato, meta.contrato || 0);
      }

      const result: GeralChannelResult = {
        name,
        filterDescription:
          name === "Vendas Diretas" ? "Deals do canal Marketing (canal 12). Orçamento = gasto Meta Ads do mês."
            : name === "Parceiros" ? "Deals de canais de parceiros (Ind. Corretor, Ind. Franquia, Outros Parceiros)."
              : "Todos os canais sem filtro. Reservas e contratos mostram acumulado no mês.",
        metrics,
        lastMonthWon: prevWon[name] || 0,
        dealsHistory,
      };

      // Vendas Diretas/Parceiros: snapshots
      if (name !== "Geral") {
        result.snapshots = snap;
      }

      // Geral: reservaHistory (acumulado semanal)
      if (name === "Geral") {
        const monthHistory = dealsHistory.filter((h) => h.date >= startDate);
        let accRes = 0, accCont = 0;
        result.reservaHistory = monthHistory.map((h) => {
          accRes += h.byStage.reserva || 0;
          accCont += h.byStage.contrato || 0;
          return { date: h.date, reserva: accRes, contrato: accCont };
        });
      }

      return result;
    });

    return NextResponse.json({ month: monthKey, channels } as GeralData);
  } catch (err: unknown) {
    console.error("[geral] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
