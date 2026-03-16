import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SQUADS, V_COLS, SQUAD_V_MAP } from "@/lib/constants";
import type { PerformanceData, PerformancePersonRow, PerformancePresellerRow, PerformanceSquadSummary, PerformanceEmpBreakdown, PerformanceEmpRow } from "@/lib/types";

export const dynamic = "force-dynamic";

function rate(n: number, d: number): number {
  return d > 0 ? Math.round((n / d) * 1000) / 10 : 0;
}

function norm(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

interface DealRow {
  deal_id: number;
  owner_name: string;
  empreendimento: string | null;
  status: string;
  max_stage_order: number;
  lost_reason: string | null;
  is_marketing: boolean;
  add_time: string;
}

interface PresalesRow {
  deal_id: number;
  preseller_name: string;
  transbordo_at: string;
  first_action_at: string | null;
  response_time_minutes: number | null;
}

// Paginated fetch from Supabase (handles >1000 rows)
async function fetchDeals(cutoff: string | null): Promise<DealRow[]> {
  const PAGE = 1000;
  const all: DealRow[] = [];
  let offset = 0;
  while (true) {
    let query = supabase
      .from("squad_deals")
      .select("deal_id, owner_name, empreendimento, status, max_stage_order, lost_reason, is_marketing, add_time")
      .eq("is_marketing", true);
    if (cutoff) query = query.gte("add_time", cutoff);
    query = query.range(offset, offset + PAGE - 1);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase error (squad_deals): ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as DealRow[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

async function fetchPresalesRows(cutoff: string | null): Promise<PresalesRow[]> {
  const PAGE = 1000;
  const all: PresalesRow[] = [];
  let offset = 0;
  while (true) {
    let query = supabase
      .from("squad_presales_response")
      .select("deal_id, preseller_name, transbordo_at, first_action_at, response_time_minutes");
    if (cutoff) query = query.gte("transbordo_at", cutoff);
    query = query.range(offset, offset + PAGE - 1);
    const { data, error } = await query;
    if (error) throw new Error(`Supabase error (squad_presales_response): ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as PresalesRow[]));
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "90", 10);

    // Calculate cutoff date
    let cutoff: string | null = null;
    if (days > 0) {
      const d = new Date();
      d.setDate(d.getDate() - days);
      cutoff = d.toISOString();
    }

    // Rolling window for time series = same as period filter, default 90
    const rollingWindow = days > 0 ? days : 90;

    // For time series we need 12 months + rolling window of deals
    const tsCutoff = new Date();
    tsCutoff.setMonth(tsCutoff.getMonth() - 12);
    tsCutoff.setDate(tsCutoff.getDate() - rollingWindow);
    const tsCutoffStr = tsCutoff.toISOString();
    // Use the earlier of the two cutoffs to avoid a second query
    const fetchCutoff = cutoff && cutoff < tsCutoffStr ? cutoff : tsCutoffStr;

    // Parallel queries: squad_deals + squad_presales_response
    const [allDealsRows, presalesRows] = await Promise.all([
      fetchDeals(fetchCutoff),
      fetchPresalesRows(cutoff),
    ]);

    // All deals filtered for quality
    const allDeals = allDealsRows.filter((d) => {
      if (!d.empreendimento) return false;
      if (d.lost_reason === "Duplicado/Erro") return false;
      return true;
    });

    // Deals filtered by the user's period selection (for main stats)
    const deals = cutoff ? allDeals.filter((d) => d.add_time >= cutoff) : allDeals;

    // Build deal map for cross-referencing
    const dealMap = new Map<number, DealRow>();
    for (const d of allDeals) {
      dealMap.set(d.deal_id, d);
    }

    // Fetch deal data specifically for presales deal_ids that aren't in dealMap
    // (presales_response may reference deals outside the date window or non-marketing)
    const missingDealIds = presalesRows
      .map((r) => r.deal_id)
      .filter((id) => !dealMap.has(id));
    if (missingDealIds.length > 0) {
      // Fetch in batches of 200 (Supabase URL length limit)
      for (let i = 0; i < missingDealIds.length; i += 200) {
        const batch = missingDealIds.slice(i, i + 200);
        const { data: extraDeals } = await supabase
          .from("squad_deals")
          .select("deal_id, owner_name, empreendimento, status, max_stage_order, lost_reason, is_marketing, add_time")
          .in("deal_id", batch);
        for (const d of (extraDeals || []) as DealRow[]) {
          if (d.empreendimento && d.lost_reason !== "Duplicado/Erro") {
            dealMap.set(d.deal_id, d);
          }
        }
      }
    }

    // Helper: build per-empreendimento breakdown
    function buildByEmp(dealList: DealRow[]): PerformanceEmpBreakdown[] {
      const empMap = new Map<string, DealRow[]>();
      for (const d of dealList) {
        const emp = d.empreendimento || "Sem empreendimento";
        if (!empMap.has(emp)) empMap.set(emp, []);
        empMap.get(emp)!.push(d);
      }
      const result: PerformanceEmpBreakdown[] = [];
      for (const [emp, empDeals] of empMap) {
        const f = countFunnel(empDeals);
        result.push({
          emp,
          ...f,
          mqlToSql: rate(f.sql, f.mql),
          sqlToOpp: rate(f.opp, f.sql),
          oppToWon: rate(f.won, f.opp),
        mqlToWon: rate(f.won, f.mql),
        });
      }
      return result.sort((a, b) => b.mql - a.mql);
    }

    // Helper: count funnel stages from max_stage_order
    function countFunnel(dealList: DealRow[]) {
      let mql = 0, sql = 0, opp = 0, won = 0;
      for (const d of dealList) {
        if (d.max_stage_order >= 2) mql++;
        if (d.max_stage_order >= 5) sql++;
        if (d.max_stage_order >= 9) opp++;
        if (d.status === "won") won++;
      }
      return { mql, sql, opp, won };
    }

    // --- CLOSERS ---
    const closerMap = new Map<string, DealRow[]>();
    for (const d of deals) {
      if (!V_COLS.includes(d.owner_name)) continue;
      if (!closerMap.has(d.owner_name)) closerMap.set(d.owner_name, []);
      closerMap.get(d.owner_name)!.push(d);
    }

    const allClosers: PerformancePersonRow[] = [];
    for (const name of V_COLS) {
      const closerDeals = closerMap.get(name) || [];
      const funnel = countFunnel(closerDeals);
      let squadId = 1;
      for (const [sid, indices] of Object.entries(SQUAD_V_MAP)) {
        if (indices.includes(V_COLS.indexOf(name))) {
          squadId = Number(sid);
          break;
        }
      }
      allClosers.push({
        name,
        role: "closer",
        squadId,
        ...funnel,
        mqlToSql: rate(funnel.sql, funnel.mql),
        sqlToOpp: rate(funnel.opp, funnel.sql),
        oppToWon: rate(funnel.won, funnel.opp),
        mqlToWon: rate(funnel.won, funnel.mql),
        byEmp: buildByEmp(closerDeals),
      });
    }

    // --- TIME SERIES: rolling OPP→WON per closer over last 12 months ---
    // Build closer→deals map from allDeals (full 15-month window)
    const closerAllDealsMap = new Map<string, DealRow[]>();
    for (const d of allDeals) {
      if (!V_COLS.includes(d.owner_name)) continue;
      if (!closerAllDealsMap.has(d.owner_name)) closerAllDealsMap.set(d.owner_name, []);
      closerAllDealsMap.get(d.owner_name)!.push(d);
    }

    // Generate 12 monthly endpoints (end of each month, from 11 months ago to current)
    const now = new Date();
    const monthPoints: { month: string; end: Date; start: Date }[] = [];
    for (let i = 11; i >= 0; i--) {
      const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59); // last day of that month
      if (i === 0) {
        // Current month: use today as endpoint
        end.setTime(now.getTime());
      }
      const start = new Date(end);
      start.setDate(start.getDate() - rollingWindow);
      const y = end.getFullYear();
      const m = String(end.getMonth() + 1).padStart(2, "0");
      monthPoints.push({ month: `${y}-${m}`, end, start });
    }

    // All closer deals combined for consolidated
    const allCloserDeals: DealRow[] = [];
    for (const closer of allClosers) {
      const cDeals = closerAllDealsMap.get(closer.name) || [];
      allCloserDeals.push(...cDeals);
      closer.timeSeries = monthPoints.map(({ month, end, start }) => {
        const startIso = start.toISOString();
        const endIso = end.toISOString();
        const windowDeals = cDeals.filter((d) => d.add_time >= startIso && d.add_time <= endIso);
        const f = countFunnel(windowDeals);
        return { month, opp: f.opp, won: f.won, oppToWon: rate(f.won, f.opp) };
      });
    }

    // Consolidated time series (all closers combined)
    const consolidatedTimeSeries = monthPoints.map(({ month, end, start }) => {
      const startIso = start.toISOString();
      const endIso = end.toISOString();
      const windowDeals = allCloserDeals.filter((d) => d.add_time >= startIso && d.add_time <= endIso);
      const f = countFunnel(windowDeals);
      return { month, opp: f.opp, won: f.won, oppToWon: rate(f.won, f.opp) };
    });

    // --- EMPREENDIMENTOS (OPP→WON per emp, time series) ---
    const empToSquadId = new Map<string, number>();
    for (const sq of SQUADS) {
      for (const emp of sq.empreendimentos) {
        empToSquadId.set(emp, sq.id);
      }
    }

    // Period-filtered closer deals grouped by emp (for table stats)
    const closerDealsByEmp = new Map<string, DealRow[]>();
    for (const d of deals) {
      if (!V_COLS.includes(d.owner_name)) continue;
      const emp = d.empreendimento!;
      if (!closerDealsByEmp.has(emp)) closerDealsByEmp.set(emp, []);
      closerDealsByEmp.get(emp)!.push(d);
    }

    // All closer deals grouped by emp (for time series)
    const allCloserDealsByEmp = new Map<string, DealRow[]>();
    for (const d of allCloserDeals) {
      const emp = d.empreendimento!;
      if (!allCloserDealsByEmp.has(emp)) allCloserDealsByEmp.set(emp, []);
      allCloserDealsByEmp.get(emp)!.push(d);
    }

    const allEmps: PerformanceEmpRow[] = [];
    const allEmpNames = new Set([...closerDealsByEmp.keys(), ...allCloserDealsByEmp.keys()]);
    for (const emp of allEmpNames) {
      const periodDeals = closerDealsByEmp.get(emp) || [];
      const f = countFunnel(periodDeals);
      const tsDeals = allCloserDealsByEmp.get(emp) || [];

      allEmps.push({
        emp,
        squadId: empToSquadId.get(emp) || 0,
        opp: f.opp,
        won: f.won,
        oppToWon: rate(f.won, f.opp),
        timeSeries: monthPoints.map(({ month, end, start }) => {
          const startIso = start.toISOString();
          const endIso = end.toISOString();
          const windowDeals = tsDeals.filter((d) => d.add_time >= startIso && d.add_time <= endIso);
          const wf = countFunnel(windowDeals);
          return { month, opp: wf.opp, won: wf.won, oppToWon: rate(wf.won, wf.opp) };
        }),
      });
    }
    allEmps.sort((a, b) => b.opp - a.opp);

    // --- PRE-SELLERS ---
    // Build map normalized by name (handles accent mismatches like Patrício vs Patricio)
    const presellerDealsMap = new Map<string, PresalesRow[]>();
    for (const row of presalesRows) {
      const key = norm(row.preseller_name);
      if (!presellerDealsMap.has(key)) presellerDealsMap.set(key, []);
      presellerDealsMap.get(key)!.push(row);
    }

    const allPresellers: PerformancePresellerRow[] = [];
    for (const sq of SQUADS) {
      const pvName = sq.preVenda;
      const pvDeals = presellerDealsMap.get(norm(pvName)) || [];

      const matchedDeals: DealRow[] = [];
      for (const pd of pvDeals) {
        const deal = dealMap.get(pd.deal_id);
        if (deal) matchedDeals.push(deal);
      }

      const funnel = countFunnel(matchedDeals);
      const dealsWithAction = pvDeals.filter((d) => d.first_action_at != null);
      const responseTimes = dealsWithAction
        .map((d) => d.response_time_minutes)
        .filter((m): m is number => m != null && m >= 0);

      allPresellers.push({
        name: pvName,
        role: "preseller",
        squadId: sq.id,
        ...funnel,
        mqlToSql: rate(funnel.sql, funnel.mql),
        sqlToOpp: rate(funnel.opp, funnel.sql),
        oppToWon: rate(funnel.won, funnel.opp),
        mqlToWon: rate(funnel.won, funnel.mql),
        dealsReceived: pvDeals.length,
        dealsWithAction: dealsWithAction.length,
        avgResponseMin: responseTimes.length > 0 ? Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length) : 0,
        medianResponseMin: Math.round(median(responseTimes)),
        byEmp: buildByEmp(matchedDeals),
      });
    }

    // --- MARKETING (MIA) as preseller rows ---
    const empToSquad = new Map<string, (typeof SQUADS)[number]>();
    for (const sq of SQUADS) {
      for (const emp of sq.empreendimentos) {
        empToSquad.set(emp, sq as (typeof SQUADS)[number]);
      }
    }

    // Build MIA rows per squad (not per person) so Jean appears once per squad
    for (const sq of SQUADS) {
      const sqEmpDeals = deals.filter((d) => (sq.empreendimentos as readonly string[]).includes(d.empreendimento!));
      const funnel = countFunnel(sqEmpDeals);
      allPresellers.push({
        name: sq.marketing,
        role: "marketing",
        squadId: sq.id,
        ...funnel,
        mqlToSql: rate(funnel.sql, funnel.mql),
        sqlToOpp: rate(funnel.opp, funnel.sql),
        oppToWon: rate(funnel.won, funnel.opp),
        mqlToWon: rate(funnel.won, funnel.mql),
        dealsReceived: funnel.mql,
        dealsWithAction: funnel.sql,
        avgResponseMin: 0,
        medianResponseMin: 0,
        byEmp: buildByEmp(sqEmpDeals),
      });
    }

    // allMarketing kept empty (MIA now in allPresellers)
    const allMarketing: PerformancePersonRow[] = [];

    // --- SQUAD SUMMARIES ---
    const squads: PerformanceSquadSummary[] = SQUADS.map((sq) => {
      const sqClosers = allClosers.filter((c) => c.squadId === sq.id);
      const sqPreseller = allPresellers.find((p) => p.squadId === sq.id && p.role === "preseller")!;
      const sqMia = allPresellers.find((p) => p.squadId === sq.id && p.role === "marketing")!;

      const sqEmpDeals = deals.filter((d) => (sq.empreendimentos as readonly string[]).includes(d.empreendimento!));
      const sqFunnel = countFunnel(sqEmpDeals);

      return {
        id: sq.id,
        name: sq.name,
        closers: sqClosers,
        preseller: sqPreseller,
        marketing: sqMia,
        totals: {
          ...sqFunnel,
          mqlToSql: rate(sqFunnel.sql, sqFunnel.mql),
          sqlToOpp: rate(sqFunnel.opp, sqFunnel.sql),
          oppToWon: rate(sqFunnel.won, sqFunnel.opp),
          mqlToWon: rate(sqFunnel.won, sqFunnel.mql),
        },
      };
    });

    // --- GRAND TOTALS ---
    const grandFunnel = countFunnel(deals);

    const result: PerformanceData = {
      squads,
      allClosers,
      allPresellers,
      allMarketing,
      allEmps,
      grandTotals: {
        ...grandFunnel,
        mqlToSql: rate(grandFunnel.sql, grandFunnel.mql),
        sqlToOpp: rate(grandFunnel.opp, grandFunnel.sql),
        oppToWon: rate(grandFunnel.won, grandFunnel.opp),
        mqlToWon: rate(grandFunnel.won, grandFunnel.mql),
      },
      consolidatedTimeSeries,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Performance error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
