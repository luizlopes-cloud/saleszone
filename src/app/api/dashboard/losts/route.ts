import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { LostsData, LostDealRow, LostAlert, LostsSummary } from "@/lib/types";

export const dynamic = "force-dynamic";

/** Dedicated Supabase client for monitor tables (jp-rambo project) — hardcoded to avoid Vercel env override */
const MONITOR_URL = "https://iobxudcyihqfdwiggohz.supabase.co";
const MONITOR_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlvYnh1ZGN5aWhxZmR3aWdnb2h6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzNTE4NDMsImV4cCI6MjA4ODkyNzg0M30.BelWphFGytC583TK2Iunmf_Ah__yR-d7N_823OGd9j8";
const monitorSupabase = createClient(MONITOR_URL, MONITOR_KEY);

/** Paginate Supabase queries that may exceed 1000 rows */
async function paginateDeals(date: string): Promise<LostDealRow[]> {
  const PAGE = 1000;
  const all: LostDealRow[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    const { data, error } = await monitorSupabase
      .from("monitor_lost_deals")
      .select("deal_id, title, stage_name, stage_category, owner_name, owner_email, lost_time, lost_hour, days_in_funnel, lost_reason, canal, add_time, next_activity_date, pipeline_name")
      .eq("date", date)
      .order("lost_time", { ascending: false })
      .range(offset, offset + PAGE - 1);

    if (error) throw new Error(`Deals: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const d of data) {
      all.push({
        deal_id: d.deal_id,
        title: d.title ?? "",
        stage_name: d.stage_name ?? "",
        stage_category: d.stage_category ?? "pre_vendas",
        owner_name: d.owner_name ?? "",
        owner_email: d.owner_email ?? "",
        lost_time: d.lost_time ?? "",
        lost_hour: d.lost_hour ?? 0,
        days_in_funnel: d.days_in_funnel ?? 0,
        lost_reason: d.lost_reason ?? "",
        canal: d.canal ?? "",
        add_time: d.add_time ?? null,
        next_activity_date: d.next_activity_date ?? null,
        pipeline_name: d.pipeline_name ?? null,
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
    const { data: summaryRows, error: summaryErr } = await monitorSupabase
      .from("monitor_lost_daily_summary")
      .select("*")
      .eq("date", targetDate)
      .limit(1);

    if (summaryErr) throw new Error(`Summary: ${summaryErr.message}`);

    const rawSummary = summaryRows?.[0];
    const summary: LostsSummary = rawSummary
      ? {
          date: rawSummary.date,
          total: rawSummary.total ?? 0,
          pre_vendas: rawSummary.pre_vendas ?? 0,
          vendas: rawSummary.vendas ?? 0,
          pre_vendas_pct: rawSummary.pre_vendas_pct ?? 0,
          vendas_pct: rawSummary.vendas_pct ?? 0,
          by_reason: typeof rawSummary.by_reason === "string"
            ? JSON.parse(rawSummary.by_reason)
            : rawSummary.by_reason ?? {},
          by_owner: typeof rawSummary.by_owner === "string"
            ? JSON.parse(rawSummary.by_owner)
            : rawSummary.by_owner ?? {},
          by_canal: typeof rawSummary.by_canal === "string"
            ? JSON.parse(rawSummary.by_canal)
            : rawSummary.by_canal ?? {},
          median_days_in_funnel: rawSummary.median_days_in_funnel,
          same_day_lost_pct: rawSummary.same_day_lost_pct ?? 0,
          batch_after_18h_pct: rawSummary.batch_after_18h_pct ?? 0,
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
    const { data: alertRows, error: alertsErr } = await monitorSupabase
      .from("monitor_lost_alerts")
      .select("*")
      .eq("date", targetDate)
      .order("severity", { ascending: true });

    if (alertsErr) throw new Error(`Alerts: ${alertsErr.message}`);

    const alerts: LostAlert[] = (alertRows ?? []).map((a) => ({
      id: a.id,
      date: a.date,
      seller_email: a.seller_email ?? "",
      seller_name: a.seller_name ?? "",
      alert_type: a.alert_type ?? "",
      severity: a.severity ?? "info",
      message: a.message ?? "",
      metric_value: a.metric_value,
      threshold_value: a.threshold_value,
    }));

    // 4. Fetch 7-day trend
    const trendStart = new Date(targetDate);
    trendStart.setDate(trendStart.getDate() - 6);
    const trendStartStr = trendStart.toISOString().split("T")[0];

    const { data: trendRows, error: trendErr } = await monitorSupabase
      .from("monitor_lost_daily_summary")
      .select("date, total")
      .gte("date", trendStartStr)
      .lte("date", targetDate)
      .order("date", { ascending: true });

    if (trendErr) console.error("[losts] Trend query error:", trendErr.message);

    const trend = {
      dates: (trendRows ?? []).map((r) => r.date),
      totals: (trendRows ?? []).map((r) => r.total ?? 0),
    };

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
