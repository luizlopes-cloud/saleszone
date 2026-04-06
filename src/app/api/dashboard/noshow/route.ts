import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { paginate } from "@/lib/paginate";
import type { NoShowData, NoShowEventRow, NoShowCloserRow, NoShowSummary, NoShowAlert } from "@/lib/types";

export const dynamic = "force-dynamic";

interface CalEvent {
  closer_email: string;
  closer_name: string;
  dia: string;
  hora: string | null;
  titulo: string;
  empreendimento: string | null;
  cancelou: boolean;
}

function isWeekday(dateStr: string): boolean {
  const d = new Date(dateStr + "T12:00:00");
  const dow = d.getDay();
  return dow >= 1 && dow <= 5;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get("days") || "30", 10);

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().split("T")[0];
    const todayStr = now.toISOString().split("T")[0];

    // ── 1. Fetch all calendar events in period
    const allEvents: CalEvent[] = await paginate((o, ps) =>
      supabase
        .from("squad_calendar_events")
        .select("closer_email, closer_name, dia, hora, titulo, empreendimento, cancelou")
        .gte("dia", cutoffStr)
        .range(o, o + ps - 1)
    );

    // Only past events (up to today) — future events can't have no-shows
    const pastEvents = allEvents.filter((e) => e.dia <= todayStr);

    const totalScheduled = pastEvents.length;
    const cancelledEvents = pastEvents.filter((e) => e.cancelou);
    const totalCancelled = cancelledEvents.length;
    const noShowRate = totalScheduled > 0 ? Math.round((totalCancelled / totalScheduled) * 100) : 0;

    // ── 2. Aggregate by closer
    const closerMap = new Map<string, { name: string; scheduled: number; cancelled: number; dailyCancelled: Map<string, { cancelled: number; total: number }> }>();

    for (const evt of pastEvents) {
      const key = evt.closer_email;
      if (!closerMap.has(key)) {
        closerMap.set(key, { name: evt.closer_name || key.split("@")[0], scheduled: 0, cancelled: 0, dailyCancelled: new Map() });
      }
      const c = closerMap.get(key)!;
      c.scheduled++;
      if (evt.cancelou) c.cancelled++;

      // Daily tracking for avg7d
      const dayInfo = c.dailyCancelled.get(evt.dia) || { cancelled: 0, total: 0 };
      dayInfo.total++;
      if (evt.cancelou) dayInfo.cancelled++;
      c.dailyCancelled.set(evt.dia, dayInfo);
    }

    // Compute avg7d (past 7 business days)
    const past7biz: string[] = [];
    const cur = new Date(now);
    cur.setDate(cur.getDate() - 1);
    while (past7biz.length < 7) {
      const ds = cur.toISOString().split("T")[0];
      if (isWeekday(ds)) past7biz.push(ds);
      cur.setDate(cur.getDate() - 1);
    }

    const closers: NoShowCloserRow[] = Array.from(closerMap.entries())
      .map(([email, c]) => {
        const dailyRates = past7biz
          .map((ds) => {
            const d = c.dailyCancelled.get(ds);
            return d && d.total > 0 ? (d.cancelled / d.total) * 100 : -1;
          })
          .filter((v) => v >= 0);
        const avg7d = dailyRates.length > 0 ? Math.round(dailyRates.reduce((a, b) => a + b, 0) / dailyRates.length) : 0;

        return {
          closer_name: c.name,
          closer_email: email,
          scheduled: c.scheduled,
          cancelled: c.cancelled,
          rate: c.scheduled > 0 ? Math.round((c.cancelled / c.scheduled) * 100) : 0,
          avg7d,
        };
      })
      .sort((a, b) => b.rate - a.rate);

    // ── 3. Aggregate by empreendimento
    const byEmpreendimento: Record<string, number> = {};
    const byCloser: Record<string, number> = {};
    for (const evt of cancelledEvents) {
      const emp = evt.empreendimento || "Sem empreendimento";
      byEmpreendimento[emp] = (byEmpreendimento[emp] || 0) + 1;

      const name = evt.closer_name || evt.closer_email.split("@")[0];
      byCloser[name] = (byCloser[name] || 0) + 1;
    }

    // ── 4. Summary
    const summary: NoShowSummary = {
      total_scheduled: totalScheduled,
      total_cancelled: totalCancelled,
      noshow_rate: noShowRate,
      by_closer: byCloser,
      by_empreendimento: byEmpreendimento,
    };

    // ── 5. Alerts
    const alerts: NoShowAlert[] = [];

    for (const c of closers) {
      if (c.rate >= 40 && c.cancelled >= 5) {
        alerts.push({
          id: `noshow-high-${c.closer_email}`,
          severity: "critical",
          alert_type: "high_noshow_rate",
          message: `${c.closer_name} tem taxa de no-show de ${c.rate}% (${c.cancelled}/${c.scheduled} eventos)`,
          seller_name: c.closer_name,
          metric_value: c.rate,
          threshold_value: 40,
        });
      } else if (c.rate >= 30 && c.cancelled >= 3) {
        alerts.push({
          id: `noshow-above-${c.closer_email}`,
          severity: "warning",
          alert_type: "above_threshold",
          message: `${c.closer_name} tem taxa de no-show de ${c.rate}% (${c.cancelled}/${c.scheduled})`,
          seller_name: c.closer_name,
          metric_value: c.rate,
          threshold_value: 30,
        });
      }
    }

    if (noShowRate > 30) {
      alerts.push({
        id: "global-high-rate",
        severity: "warning",
        alert_type: "high_global_noshow",
        message: `Taxa global de no-show: ${noShowRate}% (${totalCancelled} de ${totalScheduled} eventos)`,
        seller_name: "",
        metric_value: noShowRate,
        threshold_value: 30,
      });
    }

    // ── 6. Trend (daily cancelled for last 7 days)
    const trendDates: string[] = [];
    const trendTotals: number[] = [];

    const dayMap = new Map<string, number>();
    for (const evt of cancelledEvents) {
      dayMap.set(evt.dia, (dayMap.get(evt.dia) || 0) + 1);
    }

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const ds = d.toISOString().split("T")[0];
      trendDates.push(ds);
      trendTotals.push(dayMap.get(ds) || 0);
    }

    // ── 7. Cancelled events list (most recent first)
    const events: NoShowEventRow[] = cancelledEvents
      .sort((a, b) => (b.dia + (b.hora || "")).localeCompare(a.dia + (a.hora || "")))
      .map((e) => ({
        closer_email: e.closer_email,
        closer_name: e.closer_name || e.closer_email.split("@")[0],
        dia: e.dia,
        hora: e.hora,
        titulo: e.titulo,
        empreendimento: e.empreendimento,
      }));

    const result: NoShowData = {
      days,
      summary,
      closers,
      events,
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
