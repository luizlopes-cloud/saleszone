import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { paginate } from "@/lib/paginate";
import type { GeralData, GeralChannelResult, GeralMetricPair } from "@/lib/types";

export const dynamic = "force-dynamic";

// Canal mapping
const MARKETING_CANALS = ["12"];
const PARCEIROS_CANALS = ["582", "583", "2876"];

// Stage thresholds for squad_deals.max_stage_order
const TH_MQL = 1;
const TH_SQL = 5;
const TH_OPP = 9;
const TH_RESERVA = 13;
const TH_CONTRATO = 14;

// Hardcoded metas for 2026-03
const METAS: Record<string, {
  orcamento?: number;
  leads?: number;
  mql: number;
  sql: number;
  opp: number;
  reserva?: number;
  contrato?: number;
  won: number;
}> = {
  Marketing: { orcamento: 232389, leads: 9661, mql: 2839, sql: 921, opp: 228, won: 40 },
  Parceiros: { mql: 1348, sql: 524, opp: 260, won: 55 },
  Geral: { mql: 4187, sql: 1445, opp: 488, reserva: 217, contrato: 125, won: 95 },
};

function pair(real: number, meta: number): GeralMetricPair {
  return { real, meta };
}

export async function GET() {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const mesStr = `${year}-${String(month).padStart(2, "0")}`;
    const startDate = `${mesStr}-01`;
    const mesFim = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    // Previous month range (for lastMonthWon)
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMesStr = `${prevYear}-${String(prevMonth).padStart(2, "0")}`;
    const prevStart = `${prevMesStr}-01`;
    const prevEnd = startDate;

    const admin = createSquadSupabaseAdmin();

    // --- Parallel queries ---
    const [
      allDeals,
      prevWonDeals,
      metaAdsRes,
      dailyCountsRes,
      orcRes,
      calEventsRes,
    ] = await Promise.all([
      // 1. All deals for current month (won + lost + open with add_time in month)
      paginate((o, ps) =>
        admin
          .from("squad_deals")
          .select("deal_id, canal, max_stage_order, status, lost_reason, add_time, won_time, stage_order")
          .not("empreendimento", "is", null)
          .or(`status.eq.open,won_time.gte.${startDate},lost_time.gte.${startDate},add_time.gte.${startDate}`)
          .range(o, o + ps - 1),
      ),
      // 2. Previous month WON deals (for lastMonthWon)
      paginate((o, ps) =>
        admin
          .from("squad_deals")
          .select("deal_id, canal, status, lost_reason")
          .eq("status", "won")
          .gte("won_time", prevStart)
          .lt("won_time", prevEnd)
          .range(o, o + ps - 1),
      ),
      // 3. Meta Ads spend for current month (Marketing orçamento)
      supabase
        .from("squad_meta_ads")
        .select("ad_id, spend_month")
        .gte("snapshot_date", startDate),
      // 4. Daily counts for MQL/SQL/OPP/WON + Reserva/Contrato snapshots
      paginate((o, ps) =>
        supabase
          .from("squad_daily_counts")
          .select("date, tab, count")
          .in("tab", ["mql", "sql", "opp", "won", "reserva", "contrato"])
          .gte("date", startDate)
          .range(o, o + ps - 1),
      ),
      // 5. Orçamento
      supabase.from("squad_orcamento").select("orcamento_total").eq("mes", mesStr).maybeSingle(),
      // 6. Calendar events for reserva/contrato history
      supabase
        .from("squad_calendar_events")
        .select("dia, cancelou")
        .gte("dia", startDate)
        .lt("dia", mesFim),
    ]);

    // --- Filter deals: exclude Duplicado/Erro in JS ---
    const filterDup = (deals: typeof allDeals) =>
      deals.filter((d) => d.lost_reason !== "Duplicado/Erro");

    const currentDeals = filterDup(allDeals);
    const prevDeals = filterDup(prevWonDeals);

    // --- Count funnel by canal groups ---
    type CanalGroup = "Marketing" | "Parceiros" | "Geral";
    function matchCanal(canal: string | null, group: CanalGroup): boolean {
      if (group === "Geral") return true;
      if (!canal) return false;
      if (group === "Marketing") return MARKETING_CANALS.includes(canal);
      if (group === "Parceiros") return PARCEIROS_CANALS.includes(canal);
      return false;
    }

    function countFunnel(deals: typeof currentDeals, group: CanalGroup) {
      let mql = 0, sql = 0, opp = 0, reserva = 0, contrato = 0, won = 0;
      for (const d of deals) {
        if (!matchCanal(d.canal, group)) continue;
        const mso = d.max_stage_order ?? d.stage_order ?? 0;
        if (mso >= TH_MQL) mql++;
        if (mso >= TH_SQL) sql++;
        if (mso >= TH_OPP) opp++;
        if (mso >= TH_RESERVA) reserva++;
        if (mso >= TH_CONTRATO) contrato++;
        if (d.status === "won") won++;
      }
      return { mql, sql, opp, reserva, contrato, won };
    }

    function countWon(deals: typeof prevDeals, group: CanalGroup) {
      let count = 0;
      for (const d of deals) {
        if (!matchCanal(d.canal, group)) continue;
        count++;
      }
      return count;
    }

    // --- Meta Ads spend (max spend_month per ad) ---
    const adSpend = new Map<string, number>();
    for (const row of metaAdsRes.data || []) {
      const cur = adSpend.get(row.ad_id) || 0;
      const val = Number(row.spend_month) || 0;
      if (val > cur) adSpend.set(row.ad_id, val);
    }
    let totalSpend = 0;
    for (const v of adSpend.values()) totalSpend += v;

    // --- Daily counts: leads from squad_daily_counts ---
    const dailyCounts = { mql: 0, sql: 0, opp: 0, won: 0 };
    for (const row of dailyCountsRes) {
      const tab = row.tab as string;
      if (tab in dailyCounts) {
        dailyCounts[tab as keyof typeof dailyCounts] += row.count || 0;
      }
    }

    // --- Orçamento ---
    const orcamentoTotal = orcRes.data?.orcamento_total || 0;

    // --- Build deals history (last 90 days) ---
    // Group deals by date for open deals snapshot
    function buildDealsHistory(group: CanalGroup): { date: string; total: number; byStage: Record<string, number> }[] {
      // Count open deals matching group
      const openDeals = currentDeals.filter(
        (d) => d.status === "open" && matchCanal(d.canal, group),
      );

      // Simple approach: single snapshot of current open deals
      const byStage: Record<string, number> = { mql: 0, sql: 0, opp: 0, reserva: 0, contrato: 0, won: 0 };
      for (const d of openDeals) {
        const so = d.stage_order ?? 0;
        if (so >= TH_CONTRATO) byStage.contrato++;
        else if (so >= TH_RESERVA) byStage.reserva++;
        else if (so >= TH_OPP) byStage.opp++;
        else if (so >= TH_SQL) byStage.sql++;
        else if (so >= TH_MQL) byStage.mql++;
      }

      // Generate daily entries for last 90 days with the current snapshot value
      // (real history would need daily snapshots; we approximate with current state)
      const history: { date: string; total: number; byStage: Record<string, number> }[] = [];
      const today = new Date();
      for (let i = 90; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        history.push({
          date: d.toISOString().substring(0, 10),
          total: openDeals.length,
          byStage: { ...byStage },
        });
      }
      return history;
    }

    // --- Build reservaHistory for Geral channel ---
    // Count reserva/contrato events per week from deals
    function buildReservaHistory(): { date: string; reserva: number; contrato: number }[] {
      const weeks = new Map<string, { reserva: number; contrato: number }>();
      for (const d of currentDeals) {
        if (d.status !== "won") continue;
        const wt = d.won_time?.substring(0, 10);
        if (!wt || wt < startDate) continue;
        // Group by week start (Monday)
        const date = new Date(wt + "T12:00:00");
        const dayOfWeek = date.getDay();
        const monday = new Date(date);
        monday.setDate(date.getDate() - ((dayOfWeek + 6) % 7));
        const weekKey = monday.toISOString().substring(0, 10);
        const cur = weeks.get(weekKey) || { reserva: 0, contrato: 0 };
        const mso = d.max_stage_order ?? 0;
        if (mso >= TH_RESERVA) cur.reserva++;
        if (mso >= TH_CONTRATO) cur.contrato++;
        weeks.set(weekKey, cur);
      }

      // Sort by date and accumulate
      const sorted = [...weeks.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      let accRes = 0, accCont = 0;
      return sorted.map(([date, v]) => {
        accRes += v.reserva;
        accCont += v.contrato;
        return { date, reserva: accRes, contrato: accCont };
      });
    }

    // --- Compute snapshots (current open deals in Reserva/Contrato stages) ---
    function computeSnapshots(group: CanalGroup): { reserva: number; contrato: number } {
      let reserva = 0, contrato = 0;
      for (const d of currentDeals) {
        if (d.status !== "open") continue;
        if (!matchCanal(d.canal, group)) continue;
        const so = d.stage_order ?? 0;
        if (so === 13) reserva++; // Reservas stage
        if (so === 14) contrato++; // Contrato stage
      }
      return { reserva, contrato };
    }

    // --- Leads count for Marketing (from Meta Ads leads_month or daily counts) ---
    // Use daily_counts MQL as proxy for leads (same as funil route pattern)
    const mktFunnel = countFunnel(currentDeals, "Marketing");
    const parcFunnel = countFunnel(currentDeals, "Parceiros");
    const geralFunnel = countFunnel(currentDeals, "Geral");

    const mktLastWon = countWon(prevDeals, "Marketing");
    const parcLastWon = countWon(prevDeals, "Parceiros");
    const geralLastWon = countWon(prevDeals, "Geral");

    const mktMeta = METAS.Marketing;
    const parcMeta = METAS.Parceiros;
    const geralMeta = METAS.Geral;

    // --- Build channels ---
    const channels: GeralChannelResult[] = [
      {
        name: "Marketing",
        filterDescription: "Deals do canal Marketing (canal 12). Inclui leads de mídia paga e orgânico. Orçamento = gasto Meta Ads do mês.",
        metrics: {
          orcamento: pair(Math.round(totalSpend), mktMeta.orcamento!),
          leads: pair(dailyCounts.mql, mktMeta.leads!),
          mql: pair(mktFunnel.mql, mktMeta.mql),
          sql: pair(mktFunnel.sql, mktMeta.sql),
          opp: pair(mktFunnel.opp, mktMeta.opp),
          won: pair(mktFunnel.won, mktMeta.won),
        },
        lastMonthWon: mktLastWon,
        snapshots: computeSnapshots("Marketing"),
        dealsHistory: buildDealsHistory("Marketing"),
      },
      {
        name: "Parceiros",
        filterDescription: "Deals de canais de parceiros (Ind. Corretor, Ind. Franquia, Outros Parceiros). Sem investimento Meta Ads.",
        metrics: {
          mql: pair(parcFunnel.mql, parcMeta.mql),
          sql: pair(parcFunnel.sql, parcMeta.sql),
          opp: pair(parcFunnel.opp, parcMeta.opp),
          won: pair(parcFunnel.won, parcMeta.won),
        },
        lastMonthWon: parcLastWon,
        snapshots: computeSnapshots("Parceiros"),
        dealsHistory: buildDealsHistory("Parceiros"),
      },
      {
        name: "Geral",
        filterDescription: "Todos os canais sem filtro. Inclui Marketing, Parceiros e demais canais. Reservas e contratos mostram acumulado no mês.",
        metrics: {
          mql: pair(geralFunnel.mql, geralMeta.mql),
          sql: pair(geralFunnel.sql, geralMeta.sql),
          opp: pair(geralFunnel.opp, geralMeta.opp),
          reserva: pair(geralFunnel.reserva, geralMeta.reserva!),
          contrato: pair(geralFunnel.contrato, geralMeta.contrato!),
          won: pair(geralFunnel.won, geralMeta.won),
        },
        lastMonthWon: geralLastWon,
        reservaHistory: buildReservaHistory(),
        dealsHistory: buildDealsHistory("Geral"),
      },
    ];

    const result: GeralData = {
      month: mesStr,
      channels,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[geral] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 },
    );
  }
}
