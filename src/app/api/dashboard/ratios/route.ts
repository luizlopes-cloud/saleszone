import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { SQUADS } from "@/lib/constants";
import { generateDates } from "@/lib/dates";
import { paginate } from "@/lib/paginate";
import type { RatioHistoryData, RatioSnapshot } from "@/lib/types";

export const dynamic = "force-dynamic";

// stage thresholds for squad_deals.max_stage_order
const STAGE_THRESHOLDS = { mql: 2, sql: 5, opp: 9 };

export async function GET(req: NextRequest) {
  const days = parseInt(req.nextUrl.searchParams.get("days") || "90");
  const filterParam = req.nextUrl.searchParams.get("filter") || "all";
  // filter: "paid" = mídia paga, "marketing" = canal Marketing, "ctwa" = Click To WhatsApp, "all" = geral
  const paidOnly = filterParam === "paid";
  const marketingOnly = filterParam === "marketing";
  const ctwaOnly = filterParam === "ctwa";
  const hasFilter = paidOnly || marketingOnly || ctwaOnly;

  try {
    const now = new Date();
    const today = now.toISOString().substring(0, 10);
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffDate = cutoff.toISOString().substring(0, 10);

    const start90 = new Date(now);
    start90.setDate(start90.getDate() - 90);
    const startDate90 = start90.toISOString().substring(0, 10);

    // Fetch daily ratio snapshots (pre-computed — for chart history)
    const admin = createSquadSupabaseAdmin();
    const [ratiosRes, countsRes] = await Promise.all([
      admin
        .from("squad_ratios_daily")
        .select("date, squad_id, ratios, counts_90d")
        .gte("date", cutoffDate)
        .lte("date", today)
        .order("date", { ascending: false }),
      supabase
        .from("squad_daily_counts")
        .select("date, tab, empreendimento, count")
        .gte("date", generateDates()[generateDates().length - 1].date)
        .lte("date", today),
    ]);

    if (ratiosRes.error) throw new Error(`Supabase error: ${ratiosRes.error.message}`);
    if (countsRes.error) console.warn(`[ratios] squad_daily_counts error: ${countsRes.error.message}`);
    const allRows = (ratiosRes.data || []) as RatioSnapshot[];

    // dates for heatmap
    const dates = generateDates();
    const heatStart = dates[dates.length - 1].date;

    // ─── When filter is active, compute current + empDaily from squad_deals ───
    let filteredCurrentGlobal: RatioSnapshot["counts_90d"] = { mql: 0, sql: 0, opp: 0, won: 0 };
    const filteredCurrentSquads = new Map<number, RatioSnapshot["counts_90d"]>();
    const filteredEmpDaily: Record<string, Record<string, Record<string, number>>> = {};

    if (hasFilter) {
      const admin = createSquadSupabaseAdmin();

      // Fetch filtered deals for 90d window
      const deals = await paginate((o, ps) => {
        let q = admin
          .from("squad_deals")
          .select("empreendimento, add_time, max_stage_order, status, lost_reason")
          .not("empreendimento", "is", null)
          .gte("add_time", startDate90);
        if (ctwaOnly) {
          q = q.eq("is_marketing", true).eq("rd_source", "Click To WhatsApp");
        } else if (paidOnly) {
          q = q.eq("is_marketing", true).ilike("rd_source", "%pag%");
        } else if (marketingOnly) {
          q = q.eq("is_marketing", true);
        }
        return q.range(o, o + ps - 1);
      });

      // Initialize squad counters
      for (const sq of SQUADS) {
        filteredCurrentSquads.set(sq.id, { mql: 0, sql: 0, opp: 0, won: 0 });
      }

      // Build emp→squad map
      const empToSquad = new Map<string, number>();
      for (const sq of SQUADS) {
        for (const emp of sq.empreendimentos) empToSquad.set(emp, sq.id);
      }

      for (const d of deals) {
        if (d.lost_reason === "Duplicado/Erro") continue;
        const emp = d.empreendimento;
        const mso = d.max_stage_order || 0;
        const dateStr = (d.add_time || "").substring(0, 10);

        // Global counts
        if (mso >= STAGE_THRESHOLDS.mql) filteredCurrentGlobal.mql++;
        if (mso >= STAGE_THRESHOLDS.sql) filteredCurrentGlobal.sql++;
        if (mso >= STAGE_THRESHOLDS.opp) filteredCurrentGlobal.opp++;
        if (d.status === "won") filteredCurrentGlobal.won++;

        // Squad counts
        const sqId = empToSquad.get(emp);
        if (sqId !== undefined) {
          const sc = filteredCurrentSquads.get(sqId)!;
          if (mso >= STAGE_THRESHOLDS.mql) sc.mql++;
          if (mso >= STAGE_THRESHOLDS.sql) sc.sql++;
          if (mso >= STAGE_THRESHOLDS.opp) sc.opp++;
          if (d.status === "won") sc.won++;
        }

        // empDaily for heatmap
        if (dateStr >= heatStart && dateStr <= today) {
          if (!filteredEmpDaily[emp]) filteredEmpDaily[emp] = {};
          if (!filteredEmpDaily[emp][dateStr]) filteredEmpDaily[emp][dateStr] = { mql: 0, sql: 0, opp: 0, won: 0 };
          if (mso >= STAGE_THRESHOLDS.mql) filteredEmpDaily[emp][dateStr].mql++;
          if (mso >= STAGE_THRESHOLDS.sql) filteredEmpDaily[emp][dateStr].sql++;
          if (mso >= STAGE_THRESHOLDS.opp) filteredEmpDaily[emp][dateStr].opp++;
          if (d.status === "won") filteredEmpDaily[emp][dateStr].won++;
        }
      }
    }

    // ─── Build response ───
    const latestDate = allRows.length > 0 ? allRows[0].date : today;
    const currentRows = allRows.filter(r => r.date === latestDate);

    if (hasFilter) {
      // Use filtered data for current snapshot
      const squadsCurrent = SQUADS.map(sq => ({
        date: latestDate,
        squad_id: sq.id,
        ratios: { mql_sql: 0, sql_opp: 0, opp_won: 0 },
        counts_90d: filteredCurrentSquads.get(sq.id) || { mql: 0, sql: 0, opp: 0, won: 0 },
      }));

      // Compute ratios from filtered counts
      const buildRatios = (c: RatioSnapshot["counts_90d"]) => ({
        mql_sql: c.sql > 0 ? c.mql / c.sql : 0,
        sql_opp: c.opp > 0 ? c.sql / c.opp : 0,
        opp_won: c.won > 0 ? c.opp / c.won : 0,
      });

      const globalFiltered: RatioSnapshot = {
        date: latestDate,
        squad_id: 0,
        ratios: buildRatios(filteredCurrentGlobal),
        counts_90d: filteredCurrentGlobal,
      };

      for (const s of squadsCurrent) {
        s.ratios = buildRatios(s.counts_90d);
      }

      const result: RatioHistoryData = {
        current: { global: globalFiltered, squads: squadsCurrent },
        history: allRows, // chart still uses pre-computed (no per-filter granularity)
        empDaily: filteredEmpDaily,
        dates: dates.map(d => d.date),
      };
      return NextResponse.json(result);
    }

    // No filter — use pre-computed data
    const globalCurrent = currentRows.find(r => r.squad_id === 0) || {
      date: latestDate, squad_id: 0,
      ratios: { mql_sql: 0, sql_opp: 0, opp_won: 0 },
      counts_90d: { mql: 0, sql: 0, opp: 0, won: 0 },
    };
    const squadsCurrent = currentRows.filter(r => r.squad_id !== 0);

    // Build per-emp daily counts from squad_daily_counts
    const empDaily: Record<string, Record<string, Record<string, number>>> = {};
    for (const row of countsRes.data || []) {
      const tab = row.tab as string;
      if (!["mql", "sql", "opp", "won"].includes(tab)) continue;
      if (!empDaily[row.empreendimento]) empDaily[row.empreendimento] = {};
      if (!empDaily[row.empreendimento][row.date]) empDaily[row.empreendimento][row.date] = { mql: 0, sql: 0, opp: 0, won: 0 };
      empDaily[row.empreendimento][row.date][tab] += row.count || 0;
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
