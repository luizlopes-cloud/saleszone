import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getModuleConfig } from "@/lib/modules";
import type { NoShowData, NoShowDealRow, NoShowSummary, NoShowAlert } from "@/lib/types";

export const dynamic = "force-dynamic";

const STAGE_NAMES: Record<number, string> = {
  1: "FUP Parceiro",
  2: "Lead in",
  3: "Contatados",
  4: "Qualificação",
  5: "Qualificado",
  6: "Aguardando data",
  7: "Agendado",
  8: "No Show/Reagendamento",
  9: "Reunião/OPP",
  10: "FUP",
  11: "Negociação",
  12: "Fila de espera",
  13: "Reservas",
  14: "Contrato",
};

const PAGE_SIZE = 1000;

async function paginateDeals(filter: Record<string, unknown>, select: string): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let offset = 0;

  while (true) {
    let query = supabase.from("squad_deals").select(select).range(offset, offset + PAGE_SIZE - 1);

    for (const [key, val] of Object.entries(filter)) {
      if (key.startsWith("gte_")) query = query.gte(key.slice(4), val);
      else if (key.startsWith("or_")) query = query.or(val as string);
      else query = query.eq(key, val);
    }

    const { data, error } = await query;
    if (error) throw new Error(`Supabase error: ${error.message}`);
    if (!data || data.length === 0) break;
    all.push(...(data as unknown as Record<string, unknown>[]));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  return all;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split("T")[0];

    // ── 1. Active no-shows: open deals currently in stage 8 (No Show/Reagendamento)
    const openNoShows = await paginateDeals(
      { status: "open", stage_order: 8 },
      "deal_id, title, owner_name, preseller_name, empreendimento, stage_order, add_time, canal, lost_reason, status"
    );

    // ── 2. Historical no-shows: won/lost deals that passed through stage 8 (max_stage_order >= 8)
    //    Filter by add_time within the period
    const historicalSelect = "deal_id, title, owner_name, preseller_name, empreendimento, stage_order, max_stage_order, add_time, canal, lost_reason, status, won_time, lost_time";

    // Won deals that passed through No Show
    const wonRows: Record<string, unknown>[] = [];
    let wonOffset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("squad_deals")
        .select(historicalSelect)
        .eq("status", "won")
        .gte("max_stage_order", 8)
        .gte("won_time", cutoffStr)
        .range(wonOffset, wonOffset + PAGE_SIZE - 1);
      if (error) throw new Error(`Won query error: ${error.message}`);
      if (!data || data.length === 0) break;
      wonRows.push(...(data as Record<string, unknown>[]));
      if (data.length < PAGE_SIZE) break;
      wonOffset += PAGE_SIZE;
    }

    // Lost deals that passed through No Show
    const lostRows: Record<string, unknown>[] = [];
    let lostOffset = 0;
    while (true) {
      const { data, error } = await supabase
        .from("squad_deals")
        .select(historicalSelect)
        .eq("status", "lost")
        .gte("max_stage_order", 8)
        .gte("lost_time", cutoffStr)
        .range(lostOffset, lostOffset + PAGE_SIZE - 1);
      if (error) throw new Error(`Lost query error: ${error.message}`);
      if (!data || data.length === 0) break;
      lostRows.push(...(data as Record<string, unknown>[]));
      if (data.length < PAGE_SIZE) break;
      lostOffset += PAGE_SIZE;
    }

    // ── 3. Combine all no-show deals
    const allRaw = [...openNoShows, ...wonRows, ...lostRows];

    // Dedup by deal_id (open deal might also appear in historical)
    const seen = new Set<number>();
    const deduped: Record<string, unknown>[] = [];
    for (const d of allRaw) {
      const id = d.deal_id as number;
      if (!seen.has(id)) {
        seen.add(id);
        deduped.push(d);
      }
    }

    const deals: NoShowDealRow[] = deduped.map((d) => {
      const addTime = d.add_time as string | null;
      let daysInFunnel = 0;
      if (addTime) {
        daysInFunnel = Math.max(0, Math.round((now.getTime() - new Date(addTime).getTime()) / (1000 * 60 * 60 * 24)));
      }
      const stageOrder = d.stage_order as number;
      const status = d.status as "open" | "won" | "lost";

      return {
        deal_id: d.deal_id as number,
        title: (d.title as string) || `Deal #${d.deal_id}`,
        stage_name: STAGE_NAMES[stageOrder] || `Stage ${stageOrder}`,
        current_stage: STAGE_NAMES[stageOrder] || `Stage ${stageOrder}`,
        owner_name: (d.owner_name as string) || "",
        preseller_name: (d.preseller_name as string) || null,
        empreendimento: (d.empreendimento as string) || null,
        pipeline_name: "SZI",
        add_time: addTime,
        days_in_funnel: daysInFunnel,
        canal: (d.canal as string) || null,
        stage_order: stageOrder,
        status,
        lost_reason: (d.lost_reason as string) || null,
      };
    });

    // Sort: open first, then by days_in_funnel DESC
    deals.sort((a, b) => {
      if (a.status === "open" && b.status !== "open") return -1;
      if (a.status !== "open" && b.status === "open") return 1;
      return b.days_in_funnel - a.days_in_funnel;
    });

    // ── 4. Calendar enrichment — no-show rate from squad_calendar_events
    let calendarTotal = 0;
    let calendarCancelled = 0;
    try {
      const { data: calEvents } = await supabase
        .from("squad_calendar_events")
        .select("closer_email, cancelou, dia")
        .gte("dia", cutoffStr);

      if (calEvents) {
        calendarTotal = calEvents.length;
        calendarCancelled = calEvents.filter((e) => e.cancelou).length;
      }
    } catch (calErr) {
      console.error("[noshow] Calendar query error:", calErr);
    }

    // ── 5. Build summary
    const byPreseller: Record<string, number> = {};
    const byEmpreendimento: Record<string, number> = {};
    const byOwner: Record<string, number> = {};
    const byCanal: Record<string, number> = {};
    let totalDays = 0;
    let countWithDays = 0;

    for (const d of deals) {
      const ps = d.preseller_name || d.owner_name || "Sem pré-vendedor";
      byPreseller[ps] = (byPreseller[ps] || 0) + 1;

      const emp = d.empreendimento || "Sem empreendimento";
      byEmpreendimento[emp] = (byEmpreendimento[emp] || 0) + 1;

      byOwner[d.owner_name || "—"] = (byOwner[d.owner_name || "—"] || 0) + 1;

      const canal = d.canal || "—";
      byCanal[canal] = (byCanal[canal] || 0) + 1;

      if (d.days_in_funnel > 0) {
        totalDays += d.days_in_funnel;
        countWithDays++;
      }
    }

    const summary: NoShowSummary = {
      total: deals.length,
      open_count: deals.filter((d) => d.status === "open").length,
      won_count: deals.filter((d) => d.status === "won").length,
      lost_count: deals.filter((d) => d.status === "lost").length,
      by_preseller: byPreseller,
      by_empreendimento: byEmpreendimento,
      by_owner: byOwner,
      by_canal: byCanal,
      avg_days_in_funnel: countWithDays > 0 ? Math.round(totalDays / countWithDays) : null,
      calendar_noshow_rate: calendarTotal > 0 ? Math.round((calendarCancelled / calendarTotal) * 100) : null,
      calendar_total_events: calendarTotal,
      calendar_cancelled_events: calendarCancelled,
    };

    // ── 6. Alerts
    const alerts: NoShowAlert[] = [];

    // High no-show count by preseller
    const entries = Object.entries(byPreseller).sort((a, b) => b[1] - a[1]);
    const median = entries.length > 0 ? entries[Math.floor(entries.length / 2)][1] : 0;

    for (const [name, count] of entries) {
      if (count >= 5 && count > median * 2) {
        alerts.push({
          id: `noshow-high-${name}`,
          severity: "critical",
          alert_type: "high_noshow_count",
          message: `${name} tem ${count} no-shows no período (${Math.round((count / deals.length) * 100)}% do total)`,
          seller_name: name,
          metric_value: count,
          threshold_value: median,
        });
      } else if (count >= 3 && count > median * 1.5) {
        alerts.push({
          id: `noshow-above-${name}`,
          severity: "warning",
          alert_type: "above_median",
          message: `${name} tem ${count} no-shows (acima da mediana de ${median})`,
          seller_name: name,
          metric_value: count,
          threshold_value: median,
        });
      }
    }

    // Calendar no-show rate alert
    if (summary.calendar_noshow_rate !== null && summary.calendar_noshow_rate > 30) {
      alerts.push({
        id: "calendar-high-rate",
        severity: "warning",
        alert_type: "high_calendar_noshow",
        message: `Taxa de cancelamento no calendário: ${summary.calendar_noshow_rate}% (${calendarCancelled} de ${calendarTotal} eventos)`,
        seller_name: "",
        metric_value: summary.calendar_noshow_rate,
        threshold_value: 30,
      });
    }

    // Active no-shows awaiting action
    if (summary.open_count > 10) {
      alerts.push({
        id: "open-noshow-backlog",
        severity: "info",
        alert_type: "open_backlog",
        message: `${summary.open_count} deals em No Show aguardando reagendamento`,
        seller_name: "",
        metric_value: summary.open_count,
        threshold_value: 10,
      });
    }

    // ── 7. Trend (daily no-shows for last 7 days from calendar)
    const trendDates: string[] = [];
    const trendTotals: number[] = [];
    try {
      const trendStart = new Date(now);
      trendStart.setDate(trendStart.getDate() - 6);

      const { data: trendEvents } = await supabase
        .from("squad_calendar_events")
        .select("dia, cancelou")
        .gte("dia", trendStart.toISOString().split("T")[0])
        .lte("dia", now.toISOString().split("T")[0]);

      if (trendEvents) {
        const dayMap = new Map<string, { total: number; cancelled: number }>();
        for (const e of trendEvents) {
          const existing = dayMap.get(e.dia) || { total: 0, cancelled: 0 };
          existing.total++;
          if (e.cancelou) existing.cancelled++;
          dayMap.set(e.dia, existing);
        }

        // Fill 7 days
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now);
          d.setDate(d.getDate() - i);
          const ds = d.toISOString().split("T")[0];
          trendDates.push(ds);
          trendTotals.push(dayMap.get(ds)?.cancelled || 0);
        }
      }
    } catch (trendErr) {
      console.error("[noshow] Trend error:", trendErr);
    }

    const result: NoShowData = {
      days,
      summary,
      deals,
      alerts,
      trend: { dates: trendDates, totals: trendTotals },
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("[noshow] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    );
  }
}
