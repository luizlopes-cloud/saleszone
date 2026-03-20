import { NextRequest, NextResponse } from "next/server";
import type { LostsData, LostDealRow, LostAlert, LostsSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Direct REST API for monitor tables (jp-rambo project) — bypasses Supabase JS client schema cache issues */
const MONITOR_REST = "https://iobxudcyihqfdwiggohz.supabase.co/rest/v1";
const MONITOR_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvYnh1ZGN5aWhxZmR3aWdnb2h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTE4NDMsImV4cCI6MjA4ODkyNzg0M30.BelWphFGytC583TK2Iunmf_Ah__yR-d7N_823OGd9j8";

const HEADERS = {
  apikey: MONITOR_KEY,
  Authorization: `Bearer ${MONITOR_KEY}`,
  "Content-Type": "application/json",
  Prefer: "return=representation",
};

/** Generic fetch helper for PostgREST queries */
async function restQuery(table: string, params: string): Promise<unknown[]> {
  const url = `${MONITOR_REST}/${table}?${params}`;
  const res = await fetch(url, { headers: HEADERS, cache: "no-store" });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`${table}: ${res.status} ${body}`);
  }
  return res.json();
}

/** Paginate REST queries that may exceed 1000 rows */
async function paginateDeals(date: string): Promise<LostDealRow[]> {
  const PAGE = 1000;
  const all: LostDealRow[] = [];
  let offset = 0;
  let hasMore = true;

  const select = "deal_id,title,stage_name,stage_category,owner_name,owner_email,lost_time,lost_hour,days_in_funnel,lost_reason,canal,add_time,next_activity_date,pipeline_name";

  while (hasMore) {
    const params = `select=${select}&date=eq.${date}&order=lost_time.desc&offset=${offset}&limit=${PAGE}`;
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const dateParam = searchParams.get("date");

    // Default to yesterday
    const targetDate = dateParam || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0];
    })();

    // 1. Fetch summary
    const summaryRows = (await restQuery(
      "monitor_lost_daily_summary",
      `select=*&date=eq.${targetDate}&limit=1`
    )) as Record<string, unknown>[];

    const rawSummary = summaryRows?.[0];
    const summary: LostsSummary = rawSummary
      ? {
          date: rawSummary.date as string,
          total: (rawSummary.total as number) ?? 0,
          pre_vendas: (rawSummary.pre_vendas as number) ?? 0,
          vendas: (rawSummary.vendas as number) ?? 0,
          pre_vendas_pct: (rawSummary.pre_vendas_pct as number) ?? 0,
          vendas_pct: (rawSummary.vendas_pct as number) ?? 0,
          by_reason: typeof rawSummary.by_reason === "string"
            ? JSON.parse(rawSummary.by_reason)
            : (rawSummary.by_reason as Record<string, number>) ?? {},
          by_owner: typeof rawSummary.by_owner === "string"
            ? JSON.parse(rawSummary.by_owner)
            : (rawSummary.by_owner as Record<string, number>) ?? {},
          by_canal: typeof rawSummary.by_canal === "string"
            ? JSON.parse(rawSummary.by_canal)
            : (rawSummary.by_canal as Record<string, number>) ?? {},
          median_days_in_funnel: rawSummary.median_days_in_funnel as number | null,
          same_day_lost_pct: (rawSummary.same_day_lost_pct as number) ?? 0,
          batch_after_18h_pct: (rawSummary.batch_after_18h_pct as number) ?? 0,
        }
      : {
          date: targetDate,
          total: 0,
          pre_vendas: 0,
          vendas: 0,
          pre_vendas_pct: 0,
          vendas_pct: 0,
          by_reason: {},
          by_owner: {},
          by_canal: {},
          median_days_in_funnel: null,
          same_day_lost_pct: 0,
          batch_after_18h_pct: 0,
        };

    // 2. Fetch deals (paginated — may exceed 1000)
    const deals = await paginateDeals(targetDate);

    // 3. Fetch alerts
    const alertRows = (await restQuery(
      "monitor_lost_alerts",
      `select=*&date=eq.${targetDate}&order=severity.asc`
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

    // 4. Fetch 7-day trend
    const trendStart = new Date(targetDate);
    trendStart.setDate(trendStart.getDate() - 6);
    const trendStartStr = trendStart.toISOString().split("T")[0];

    let trend = { dates: [] as string[], totals: [] as number[] };
    try {
      const trendRows = (await restQuery(
        "monitor_lost_daily_summary",
        `select=date,total&date=gte.${trendStartStr}&date=lte.${targetDate}&order=date.asc`
      )) as Record<string, unknown>[];

      trend = {
        dates: (trendRows ?? []).map((r) => r.date as string),
        totals: (trendRows ?? []).map((r) => (r.total as number) ?? 0),
      };
    } catch (trendErr) {
      console.error("[losts] Trend query error:", trendErr);
    }

    const result: LostsData = { date: targetDate, summary, deals, alerts, trend };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[losts] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
