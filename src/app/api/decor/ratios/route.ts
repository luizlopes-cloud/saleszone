// Decor module — Ratios (computed from decor_daily_counts + decor_deals by empreendimento)
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { paginate } from "@/lib/paginate";
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

    // Fetch daily counts for rolling ratios (decor_daily_counts)
    const countsData = await paginate((o, ps) =>
      supabase
        .from("decor_daily_counts")
        .select("date, tab, count")
        .gte("date", cutoffDate)
        .lte("date", today)
        .range(o, o + ps - 1),
    );

    // Aggregate daily totals by date+tab
    const dailyTotals = new Map<string, Record<string, number>>();
    for (const r of countsData) {
      if (!["mql", "sql", "opp", "won"].includes(r.tab)) continue;
      if (!dailyTotals.has(r.date)) dailyTotals.set(r.date, { mql: 0, sql: 0, opp: 0, won: 0 });
      dailyTotals.get(r.date)![r.tab] += r.count || 0;
    }

    // Build rolling 90d ratio snapshots for each date
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

    // Build empDaily by empreendimento
    const admin = createSquadSupabaseAdmin();
    const dealRows = await paginate((o, ps) =>
      admin
        .from("decor_deals")
        .select("empreendimento, add_time, max_stage_order, status")
        .not("empreendimento", "is", null)
        .gte("add_time", startDate)
        .range(o, o + ps - 1),
    );

    const empDaily: Record<string, Record<string, Record<string, number>>> = {};
    for (const d of dealRows) {
      const emp = d.empreendimento || "Sem empreendimento";
      const dateStr = (d.add_time || "").substring(0, 10);
      if (!dateStr) continue;
      if (!empDaily[emp]) empDaily[emp] = {};
      if (!empDaily[emp][dateStr]) empDaily[emp][dateStr] = { mql: 0, sql: 0, opp: 0, won: 0 };
      const mso = d.max_stage_order || 0;
      if (mso >= 2) empDaily[emp][dateStr].mql += 1;
      if (mso >= 5) empDaily[emp][dateStr].sql += 1;
      if (mso >= 9) empDaily[emp][dateStr].opp += 1;
      if (d.status === "won") empDaily[emp][dateStr].won += 1;
    }

    const result: RatioHistoryData = {
      current: { global: globalCurrent, squads: [] },
      history,
      empDaily,
      dates: dates.map(d => d.date),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Decor Ratios error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
