// MKTP (Marketplace) module — Ratios (computed from mktp_daily_counts)
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { generateDates } from "@/lib/dates";
import type { RatioHistoryData, RatioSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") || "90");

  try {
    const now = new Date();
    const today = now.toISOString().substring(0, 10);
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffDate = cutoff.toISOString().substring(0, 10);
    const dates = generateDates();
    const startDate = dates[dates.length - 1].date;

    // Fetch daily counts for the period (paginated — pode exceder 1000 rows)
    const countsData: { date: string; tab: string; empreendimento: string; count: number }[] = [];
    let offset = 0;
    const PS = 1000;
    while (true) {
      const { data, error } = await supabase
        .from("mktp_daily_counts")
        .select("date, tab, empreendimento, count")
        .gte("date", cutoffDate)
        .lte("date", today)
        .range(offset, offset + PS - 1);
      if (error) throw new Error(`Supabase error: ${error.message}`);
      if (!data || data.length === 0) break;
      countsData.push(...data);
      if (data.length < PS) break;
      offset += PS;
    }

    // Aggregate daily totals by date+tab
    const dailyTotals = new Map<string, Record<string, number>>();
    for (const r of countsData) {
      if (!["mql", "sql", "opp", "won"].includes(r.tab)) continue;
      if (!dailyTotals.has(r.date)) dailyTotals.set(r.date, { mql: 0, sql: 0, opp: 0, won: 0 });
      dailyTotals.get(r.date)![r.tab] += r.count || 0;
    }

    // Build rolling 90d ratio snapshots for each date that has data
    const sortedDates = Array.from(dailyTotals.keys()).sort();
    const history: RatioSnapshot[] = [];
    for (const d of sortedDates) {
      const windowStart = new Date(d + "T12:00:00");
      windowStart.setDate(windowStart.getDate() - 89);
      const wsStr = windowStart.toISOString().substring(0, 10);
      let mql = 0, sql = 0, opp = 0, won = 0;
      for (const [dt, counts] of dailyTotals) {
        if (dt >= wsStr && dt <= d) {
          mql += counts.mql; sql += counts.sql; opp += counts.opp; won += counts.won;
        }
      }
      history.push({
        date: d, squad_id: 0,
        ratios: {
          mql_sql: mql > 0 ? Math.round((sql / mql) * 100) / 100 : 0,
          sql_opp: sql > 0 ? Math.round((opp / sql) * 100) / 100 : 0,
          opp_won: opp > 0 ? Math.round((won / opp) * 100) / 100 : 0,
        },
        counts_90d: { mql, sql, opp, won },
      });
    }

    const globalCurrent = history.length > 0 ? history[history.length - 1] : {
      date: today, squad_id: 0,
      ratios: { mql_sql: 0, sql_opp: 0, opp_won: 0 },
      counts_90d: { mql: 0, sql: 0, opp: 0, won: 0 },
    };

    // Build per-emp daily counts for the heatmap
    const empDaily: Record<string, Record<string, Record<string, number>>> = {};
    for (const row of countsData) {
      const tab = row.tab as string;
      if (!["mql", "sql", "opp", "won"].includes(tab)) continue;
      if (!empDaily[row.empreendimento]) empDaily[row.empreendimento] = {};
      if (!empDaily[row.empreendimento][row.date]) empDaily[row.empreendimento][row.date] = { mql: 0, sql: 0, opp: 0, won: 0 };
      empDaily[row.empreendimento][row.date][tab] += row.count || 0;
    }

    const result: RatioHistoryData = {
      current: { global: globalCurrent, squads: [] },
      history,
      empDaily,
      dates: dates.map(d => d.date),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("MKTP Ratios error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
