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

    const [ratiosRes, countsRes] = await Promise.all([
      supabase
        .from("szs_ratios_daily")
        .select("date, squad_id, ratios, counts_90d")
        .gte("date", cutoffDate)
        .lte("date", today)
        .order("date", { ascending: false }),
      supabase
        .from("szs_daily_counts")
        .select("date, tab, empreendimento, canal_group, count")
        .gte("date", startDate)
        .lte("date", today),
    ]);

    if (ratiosRes.error) throw new Error(`Supabase error: ${ratiosRes.error.message}`);

    const allRows = (ratiosRes.data || []) as RatioSnapshot[];

    const latestDate = allRows.length > 0 ? allRows[0].date : today;
    const currentRows = allRows.filter(r => r.date === latestDate);
    const globalCurrent = currentRows.find(r => r.squad_id === 0) || {
      date: latestDate, squad_id: 0,
      ratios: { mql_sql: 0, sql_opp: 0, opp_won: 0 },
      counts_90d: { mql: 0, sql: 0, opp: 0, won: 0 },
    };
    const squadsCurrent = currentRows.filter(r => r.squad_id !== 0);

    // Build per-emp daily counts grouped by canal_group
    // For SZS, empDaily key = canal_group (acts like squad grouping)
    const empDaily: Record<string, Record<string, Record<string, number>>> = {};
    for (const row of countsRes.data || []) {
      const tab = row.tab as string;
      if (!["mql", "sql", "opp", "won"].includes(tab)) continue;
      const key = row.canal_group || row.empreendimento;
      if (!empDaily[key]) empDaily[key] = {};
      if (!empDaily[key][row.date]) empDaily[key][row.date] = { mql: 0, sql: 0, opp: 0, won: 0 };
      empDaily[key][row.date][tab] += row.count || 0;
    }

    const result: RatioHistoryData = {
      current: { global: globalCurrent, squads: squadsCurrent },
      history: allRows,
      empDaily,
      dates: dates.map(d => d.date),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("SZS Ratios error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
