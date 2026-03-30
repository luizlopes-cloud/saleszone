import { NextRequest, NextResponse } from "next/server";
import type { LostsData, LostDealRow, LostAlert, LostsSummary, LostsPeriod } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Direct REST API for monitor tables (jp-rambo project) */
const MONITOR_REST = process.env.MONITOR_SUPABASE_URL || "https://iobxudcyihqfdwiggohz.supabase.co/rest/v1";
const MONITOR_KEY = process.env.MONITOR_SUPABASE_KEY || "";

const HEADERS = {
  apikey: MONITOR_KEY,
  Authorization: `Bearer ${MONITOR_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

async function restQuery(table: string, params: string): Promise<unknown[]> {
  const url = `${MONITOR_REST}/${table}?${params}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${table}: ${res.status} ${body}`);
  }
  return res.json();
}

/** Resolve date range from period param */
function resolveDateRange(period: LostsPeriod | null, dateParam: string | null): { from: string; to: string } {
  const yesterday = () => {
    const d = new Date();
    d.setDate(d.getDate() - 1);
    return d.toISOString().split("T")[0];
  };

  if (period === "week") {
    const to = yesterday();
    const from = new Date(to + "T12:00:00");
    from.setDate(from.getDate() - 6);
    return { from: from.toISOString().split("T")[0], to };
  }
  if (period === "month") {
    const to = yesterday();
    const from = to.slice(0, 8) + "01"; // first day of same month
    return { from, to };
  }
  if (dateParam) {
    return { from: dateParam, to: dateParam };
  }
  // default: yesterday
  const y = yesterday();
  return { from: y, to: y };
}

/** Build PostgREST date filter string */
function dateFilter(from: string, to: string): string {
  if (from === to) return `date=eq.${from}`;
  return `date=gte.${from}&date=lte.${to}`;
}

/** Paginate REST queries for deals */
async function paginateDeals(from: string, to: string): Promise<LostDealRow[]> {
  const PAGE = 1000;
  const all: LostDealRow[] = [];
  let offset = 0;
  let hasMore = true;
  const select = "deal_id,title,stage_name,stage_category,owner_name,owner_email,lost_time,lost_hour,days_in_funnel,lost_reason,canal,add_time,next_activity_date,pipeline_name";
  const df = dateFilter(from, to);

  while (hasMore) {
    const params = `select=${select}&${df}&order=lost_time.desc&offset=${offset}&limit=${PAGE}`;
    const data = (await restQuery("monitor_lost_deals", params)) as Record<string, unknown>[];
    if (!data || data.length === 0) break;

    for (const d of data) {
      all.push({
        deal_id: d.deal_id as number,
        title: (d.title as string) ?? "",
        stage_name: (d.stage_name as string) ?? "",
        stage_category: ((d.stage_category as string) ?? "pre_vendas") as "pre_vendas" | "vendas",
        owner_name: (d.owner_name as string) ?? "",
        owner_email: (d.owner_email as string) ?? "",
        lost_time: (d.lost_time as string) ?? "",
        lost_hour: (d.lost_hour as number) ?? 0,
        days_in_funnel: (d.days_in_funnel as number) ?? 0,
        lost_reason: (d.lost_reason as string) ?? "",
        canal: (d.canal as string) ?? "",
        add_time: (d.add_time as string) ?? null,
        next_activity_date: (d.next_activity_date as string) ?? null,
        pipeline_name: (d.pipeline_name as string) ?? null,
      });
    }
    hasMore = data.length === PAGE;
    offset += PAGE;
  }
  return all;
}

/** Aggregate multiple daily summaries into one */
function aggregateSummaries(rows: Record<string, unknown>[], deals: LostDealRow[], from: string, to: string): LostsSummary {
  if (rows.length === 0) {
    return {
      date: from, total: 0, pre_vendas: 0, vendas: 0,
      pre_vendas_pct: 0, vendas_pct: 0,
      by_reason: {}, by_owner: {}, by_canal: {},
      median_days_in_funnel: null, same_day_lost_pct: 0, batch_after_18h_pct: 0,
    };
  }

  // Single day — return directly
  if (rows.length === 1) {
    const r = rows[0];
    const parseJson = (v: unknown) => typeof v === "string" ? JSON.parse(v) : (v as Record<string, number>) ?? {};
    return {
      date: r.date as string,
      total: (r.total as number) ?? 0,
      pre_vendas: (r.pre_vendas as number) ?? 0,
      vendas: (r.vendas as number) ?? 0,
      pre_vendas_pct: (r.pre_vendas_pct as number) ?? 0,
      vendas_pct: (r.vendas_pct as number) ?? 0,
      by_reason: parseJson(r.by_reason),
      by_owner: parseJson(r.by_owner),
      by_canal: parseJson(r.by_canal),
      median_days_in_funnel: r.median_days_in_funnel as number | null,
      same_day_lost_pct: (r.same_day_lost_pct as number) ?? 0,
      batch_after_18h_pct: (r.batch_after_18h_pct as number) ?? 0,
    };
  }

  // Multiple days — aggregate from deals
  const total = deals.length;
  const preVendas = deals.filter((d) => d.stage_category === "pre_vendas").length;
  const vendas = total - preVendas;

  // Merge JSONB maps
  const mergeMap = (key: string) => {
    const merged: Record<string, number> = {};
    for (const r of rows) {
      const val = typeof r[key] === "string" ? JSON.parse(r[key] as string) : (r[key] as Record<string, number>) ?? {};
      for (const [k, v] of Object.entries(val)) merged[k] = (merged[k] ?? 0) + (v as number);
    }
    return merged;
  };

  // Compute from deals
  const isSameDay = (d: LostDealRow) => d.add_time && d.lost_time && d.add_time.slice(0, 10) === d.lost_time.slice(0, 10);
  const sameDayCount = deals.filter(isSameDay).length;
  const batchCount = deals.filter((d) => d.lost_hour >= 18).length;
  const sortedDays = [...deals].map((d) => d.days_in_funnel).sort((a, b) => a - b);
  const mid = Math.floor(sortedDays.length / 2);
  const median = sortedDays.length === 0 ? null
    : sortedDays.length % 2 === 0 ? Math.round((sortedDays[mid - 1] + sortedDays[mid]) / 2) : sortedDays[mid];

  return {
    date: `${from} a ${to}`,
    total,
    pre_vendas: preVendas,
    vendas,
    pre_vendas_pct: total > 0 ? Math.round((preVendas / total) * 100) : 0,
    vendas_pct: total > 0 ? Math.round((vendas / total) * 100) : 0,
    by_reason: mergeMap("by_reason"),
    by_owner: mergeMap("by_owner"),
    by_canal: mergeMap("by_canal"),
    median_days_in_funnel: median,
    same_day_lost_pct: total > 0 ? Math.round((sameDayCount / total) * 100) : 0,
    batch_after_18h_pct: total > 0 ? Math.round((batchCount / total) * 100) : 0,
  };
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const periodParam = searchParams.get("period") as LostsPeriod | null;
    const dateParam = searchParams.get("date");

    const range = resolveDateRange(periodParam, dateParam);
    const df = dateFilter(range.from, range.to);
    const period: LostsPeriod = periodParam ?? (dateParam ? "custom" : "yesterday");

    // 1. Fetch deals (paginated)
    const deals = await paginateDeals(range.from, range.to);

    // 2. Fetch summary rows and aggregate
    const summaryRows = (await restQuery(
      "monitor_lost_daily_summary",
      `select=*&${df}&order=date.asc`
    )) as Record<string, unknown>[];

    const summary = aggregateSummaries(summaryRows, deals, range.from, range.to);

    // 3. Fetch alerts
    const alertRows = (await restQuery(
      "monitor_lost_alerts",
      `select=*&${df}&order=severity.asc`
    )) as Record<string, unknown>[];

    const alerts: LostAlert[] = (alertRows ?? []).map((a) => ({
      id: a.id as string,
      date: a.date as string,
      seller_email: (a.seller_email as string) ?? "",
      seller_name: (a.seller_name as string) ?? "",
      alert_type: (a.alert_type as string) ?? "",
      severity: ((a.severity as string) ?? "info") as "critical" | "warning" | "info",
      message: (a.message as string) ?? "",
      metric_value: (a.metric_value as number) ?? null,
      threshold_value: (a.threshold_value as number) ?? null,
    }));

    // 4. Fetch 7-day trend (from end of period)
    const trendEnd = new Date(range.to + "T12:00:00");
    const trendStart = new Date(trendEnd);
    trendStart.setDate(trendStart.getDate() - 6);
    const trendStartStr = trendStart.toISOString().split("T")[0];

    let trend = { dates: [] as string[], totals: [] as number[] };
    try {
      const trendRows = (await restQuery(
        "monitor_lost_daily_summary",
        `select=date,total&date=gte.${trendStartStr}&date=lte.${range.to}&order=date.asc`
      )) as Record<string, unknown>[];

      trend = {
        dates: (trendRows ?? []).map((r) => r.date as string),
        totals: (trendRows ?? []).map((r) => (r.total as number) ?? 0),
      };
    } catch (trendErr) {
      console.error("[losts] Trend query error:", trendErr);
    }

    const result: LostsData = {
      date: range.from === range.to ? range.from : `${range.from} a ${range.to}`,
      period,
      dateRange: range,
      summary,
      deals,
      alerts,
      trend,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[losts] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error", _v: "rest-v3" },
      { status: 500 }
    );
  }
}
