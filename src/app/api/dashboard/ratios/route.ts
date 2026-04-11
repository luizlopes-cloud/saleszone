import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { generateDates } from "@/lib/dates";
import type { RatioHistoryData, RatioSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") || "90");
  const filterParam = req.nextUrl.searchParams.get("filter");
  // filter: "paid" = mídia paga (rd_source pag), "marketing" = canal Marketing, "ctwa" = Click To WhatsApp, null = geral
  const paidOnly = filterParam === "paid";
  const marketingOnly = filterParam === "marketing";
  const ctwaOnly = filterParam === "ctwa";

  try {
    const now = new Date();
    const today = now.toISOString().substring(0, 10);
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffDate = cutoff.toISOString().substring(0, 10);

    // Fetch daily ratio snapshots + daily counts for per-emp conversion
    const dates = generateDates();
    const startDate = dates[dates.length - 1].date;

    const [ratiosRes, countsRes] = await Promise.all([
      supabase
        .from("squad_ratios_daily")
        .select("date, squad_id, ratios, counts_90d")
        .gte("date", cutoffDate)
        .lte("date", today)
        .order("date", { ascending: false }),
      supabase
        .from("squad_daily_counts")
        .select("date, tab, empreendimento, count")
        .gte("date", startDate)
        .lte("date", today),
    ]);

    if (ratiosRes.error) throw new Error(`Supabase error: ${ratiosRes.error.message}`);
    if (countsRes.error) console.warn(`[ratios] squad_daily_counts error: ${countsRes.error.message}`);

    const allRows = (ratiosRes.data || []) as RatioSnapshot[];

    // Current = most recent date's snapshots
    const latestDate = allRows.length > 0 ? allRows[0].date : today;
    const currentRows = allRows.filter(r => r.date === latestDate);
    const globalCurrent = currentRows.find(r => r.squad_id === 0) || {
      date: latestDate, squad_id: 0,
      ratios: { mql_sql: 0, sql_opp: 0, opp_won: 0 },
      counts_90d: { mql: 0, sql: 0, opp: 0, won: 0 },
    };
    const squadsCurrent = currentRows.filter(r => r.squad_id !== 0);

    // Build per-emp daily counts: { [emp]: { [date]: { mql, sql, opp, won } } }
    const empDaily: Record<string, Record<string, Record<string, number>>> = {};
    for (const row of countsRes.data || []) {
      const tab = row.tab as string;
      if (!["mql", "sql", "opp", "won"].includes(tab)) continue;
      if (!empDaily[row.empreendimento]) empDaily[row.empreendimento] = {};
      if (!empDaily[row.empreendimento][row.date]) empDaily[row.empreendimento][row.date] = { mql: 0, sql: 0, opp: 0, won: 0 };
      empDaily[row.empreendimento][row.date][tab] += row.count || 0;
    }

    // Apply filter: compute filtered ratios from squad_deals when filter is active
    if (paidOnly || marketingOnly || ctwaOnly) {
      const admin = createSquadSupabaseAdmin();
      const ninetyDaysAgo = new Date(now);
      ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
      const ninetyDaysCutoff = ninetyDaysAgo.toISOString().substring(0, 10);

      // Paginate squad_deals (50k+ rows possible in 90d window)
      let mql = 0, sql = 0, opp = 0, won = 0;
      let o = 0;
      while (true) {
        const { data, error } = await admin
          .from("squad_deals")
          .select("is_marketing, canal, rd_source, max_stage_order, status, lost_reason")
          .gte("add_time", ninetyDaysCutoff)
          .range(o, o + 999);
        if (error) throw new Error(`squad_deals paginate: ${error.message}`);
        if (!data || data.length === 0) break;
        for (const d of data) {
          if (d.lost_reason === "Duplicado/Erro") continue;

          const isPaid = d.rd_source && String(d.rd_source).toLowerCase().includes("pag");
          const isMarketing = d.is_marketing || d.canal === "12";
          const isCtw = d.rd_source && String(d.rd_source).toLowerCase().includes("whats");

          let matches = false;
          if (paidOnly) matches = isPaid && isMarketing;
          else if (marketingOnly) matches = isMarketing;
          else if (ctwaOnly) matches = isCtw;

          if (!matches) continue;

          const stage = d.max_stage_order || 0;
          if (stage >= 2) mql++;
          if (stage >= 5) sql++;
          if (stage >= 9) opp++;
          if (d.status === "won") won++;
        }
        if (data.length < 1000) break;
        o += 1000;
      }

      const rMqlSql = mql > 0 ? sql / mql : 0;
      const rSqlOpp = sql > 0 ? opp / sql : 0;
      const rOppWon = opp > 0 ? won / opp : 0;

      const filteredSnapshot: RatioSnapshot = {
        date: latestDate, squad_id: 0,
        ratios: { mql_sql: rMqlSql, sql_opp: rSqlOpp, opp_won: rOppWon },
        counts_90d: { mql, sql, opp, won },
      };
      globalCurrent.ratios = filteredSnapshot.ratios;
      globalCurrent.counts_90d = filteredSnapshot.counts_90d;
    }

    const result: RatioHistoryData = {
      current: { global: globalCurrent, squads: squadsCurrent },
      history: allRows,
      empDaily,
      dates: dates.map(d => d.date),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Ratios error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
