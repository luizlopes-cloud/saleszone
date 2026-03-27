import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { V_COLS, SQUAD_V_MAP } from "@/lib/constants";
import type { LeadtimeData, LeadtimeStageRow, LeadtimeDealRow } from "@/lib/types";

export const dynamic = "force-dynamic";

const STAGE_NAMES: Record<number, string> = {
  1: "FUP Parceiro", 2: "Lead in", 3: "Contatados", 4: "Qualificação", 5: "Qualificado",
  6: "Aguardando data", 7: "Agendado", 8: "No Show/Reagendamento", 9: "Reunião/OPP",
  10: "FUP", 11: "Negociação", 12: "Fila de espera", 13: "Reservas", 14: "Contrato",
};

const ALL_STAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14];

function getSquadId(closerName: string): number {
  for (const [sqId, indices] of Object.entries(SQUAD_V_MAP)) {
    for (const idx of indices) {
      if (V_COLS[idx] === closerName) return Number(sqId);
    }
  }
  return 0;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginate(buildQuery: (offset: number, ps: number) => any): Promise<any[]> {
  const rows: any[] = [];
  let offset = 0;
  const PS = 1000;
  while (true) {
    const { data, error } = await buildQuery(offset, PS);
    if (error) throw new Error(`Supabase: ${error.message}`);
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PS) break;
    offset += PS;
  }
  return rows;
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function p90(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.9);
  return sorted[Math.min(idx, sorted.length - 1)];
}

function avg(arr: number[]): number {
  if (arr.length === 0) return 0;
  return arr.reduce((s, v) => s + v, 0) / arr.length;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const daysBack = Number(searchParams.get("days") || "90");

    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - daysBack);
    const cutoffStr = cutoff.toISOString().substring(0, 10);

    // Parallel queries
    const [wonDeals, openDeals] = await Promise.all([
      // Won deals within period (by won_time)
      paginate((o, ps) =>
        supabase
          .from("squad_deals")
          .select("deal_id, title, owner_name, add_time, won_time, stage_order, max_stage_order, empreendimento, lost_reason")
          .eq("status", "won")
          .eq("is_marketing", true)
          .not("empreendimento", "is", null)
          .gte("won_time", cutoffStr)
          .range(o, o + ps - 1),
      ),
      // Open deals
      paginate((o, ps) =>
        supabase
          .from("squad_deals")
          .select("deal_id, title, owner_name, add_time, stage_order, empreendimento, lost_reason")
          .eq("status", "open")
          .eq("is_marketing", true)
          .not("empreendimento", "is", null)
          .range(o, o + ps - 1),
      ),
    ]);

    // --- Global cycle time (creation → won) ---
    const cycleDaysArr: number[] = [];
    for (const d of wonDeals) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      if (!d.add_time || !d.won_time) continue;
      const days = (new Date(d.won_time).getTime() - new Date(d.add_time).getTime()) / (1000 * 60 * 60 * 24);
      if (days > 0) cycleDaysArr.push(days);
    }

    // --- Leadtime by stage (proportional estimate for won deals) ---
    // For each won deal, estimate time per stage: stages with higher order take proportionally more time.
    // Weight: stage_order / sum(1..max_stage_order). A deal at max_stage_order=9 spent ~1/45 of cycle at stage 1, ~9/45 at stage 9.
    const stageSamples: Record<number, number[]> = {};
    for (const so of ALL_STAGES) stageSamples[so] = [];

    for (const d of wonDeals) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      if (!d.add_time || !d.won_time) continue;
      const cycleDays = (new Date(d.won_time).getTime() - new Date(d.add_time).getTime()) / (1000 * 60 * 60 * 24);
      if (cycleDays <= 0) continue;
      const maxSO = d.max_stage_order || 14;
      // Sum of weights for stages this deal passed through
      let weightSum = 0;
      for (let s = 1; s <= maxSO; s++) weightSum += s;
      if (weightSum === 0) continue;

      for (const so of ALL_STAGES) {
        if (so <= maxSO) {
          const stageDays = cycleDays * (so / weightSum);
          stageSamples[so].push(stageDays);
        }
      }
    }

    // --- Open deals by stage + oldest per stage ---
    const openByStage: Record<number, typeof openDeals> = {};
    for (const d of openDeals) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const so = d.stage_order || 1;
      if (!openByStage[so]) openByStage[so] = [];
      openByStage[so].push(d);
    }

    // --- Build stage rows ---
    const stages: LeadtimeStageRow[] = ALL_STAGES.map((so) => {
      const samples = stageSamples[so];
      const openInStage = openByStage[so] || [];

      // Find oldest open deal in this stage
      let oldestOpen: LeadtimeStageRow["oldestOpen"] = null;
      if (openInStage.length > 0) {
        let oldest = openInStage[0];
        for (const d of openInStage) {
          if (d.add_time && (!oldest.add_time || d.add_time < oldest.add_time)) {
            oldest = d;
          }
        }
        const ageDays = oldest.add_time
          ? Math.round((now.getTime() - new Date(oldest.add_time).getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        oldestOpen = {
          deal_id: oldest.deal_id,
          title: oldest.title || `Deal #${oldest.deal_id}`,
          owner_name: oldest.owner_name || "Sem dono",
          add_time: oldest.add_time || "",
          ageDays,
          link: `https://seazone-fd92b9.pipedrive.com/deal/${oldest.deal_id}`,
        };
      }

      return {
        stageOrder: so,
        stageName: STAGE_NAMES[so] || `Stage ${so}`,
        avgDays: Math.round(avg(samples) * 10) / 10,
        medianDays: Math.round(median(samples) * 10) / 10,
        p90Days: Math.round(p90(samples) * 10) / 10,
        wonDeals: samples.length,
        openDeals: openInStage.length,
        oldestOpen,
      };
    });

    // --- By closer (with deal-level detail) ---
    const closerWonCycles: Record<string, number[]> = {};
    const closerDeals: Record<string, LeadtimeDealRow[]> = {};

    for (const d of wonDeals) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const owner = d.owner_name || "Sem dono";
      if (!closerWonCycles[owner]) closerWonCycles[owner] = [];
      if (!closerDeals[owner]) closerDeals[owner] = [];
      if (d.add_time && d.won_time) {
        const days = (new Date(d.won_time).getTime() - new Date(d.add_time).getTime()) / (1000 * 60 * 60 * 24);
        if (days > 0) {
          closerWonCycles[owner].push(days);
          closerDeals[owner].push({
            deal_id: d.deal_id,
            title: d.title || `Deal #${d.deal_id}`,
            empreendimento: d.empreendimento || "",
            stageName: STAGE_NAMES[d.stage_order] || `Stage ${d.stage_order}`,
            stageOrder: d.stage_order || 0,
            add_time: d.add_time,
            won_time: d.won_time,
            cycleDays: Math.round(days * 10) / 10,
            status: "won",
            link: `https://seazone-fd92b9.pipedrive.com/deal/${d.deal_id}`,
          });
        }
      }
    }

    for (const d of openDeals) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const owner = d.owner_name || "Sem dono";
      if (!closerDeals[owner]) closerDeals[owner] = [];
      const ageDays = d.add_time
        ? (now.getTime() - new Date(d.add_time).getTime()) / (1000 * 60 * 60 * 24)
        : 0;
      closerDeals[owner].push({
        deal_id: d.deal_id,
        title: d.title || `Deal #${d.deal_id}`,
        empreendimento: d.empreendimento || "",
        stageName: STAGE_NAMES[d.stage_order] || `Stage ${d.stage_order}`,
        stageOrder: d.stage_order || 0,
        add_time: d.add_time || "",
        won_time: null,
        cycleDays: Math.round(ageDays * 10) / 10,
        status: "open",
        link: `https://seazone-fd92b9.pipedrive.com/deal/${d.deal_id}`,
      });
    }

    // Only include known closers (V_COLS), sort deals by cycleDays desc
    const byCloser = V_COLS.map((name) => {
      const wonArr = closerWonCycles[name] || [];
      const deals = (closerDeals[name] || []).sort((a, b) => b.cycleDays - a.cycleDays);
      const openCount = deals.filter((d) => d.status === "open").length;
      return {
        name,
        squadId: getSquadId(name),
        avgCycleDays: Math.round(avg(wonArr) * 10) / 10,
        medianCycleDays: Math.round(median(wonArr) * 10) / 10,
        wonDeals: wonArr.length,
        openDeals: openCount,
        deals,
      };
    });

    const result: LeadtimeData = {
      avgCycleDays: Math.round(avg(cycleDaysArr) * 10) / 10,
      medianCycleDays: Math.round(median(cycleDaysArr) * 10) / 10,
      p90CycleDays: Math.round(p90(cycleDaysArr) * 10) / 10,
      totalWonDeals: wonDeals.length,
      totalOpenDeals: openDeals.length,
      stages,
      byCloser,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("Leadtime error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
