// SZS (Serviços) module — forecast agrupado por canal
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { ForecastData, ForecastStageSnapshot, ForecastCloserRow, ForecastSquadRow } from "@/lib/types";

export const dynamic = "force-dynamic";

// Canal group mapping (same as sync-szs-dashboard)
const CANAL_GROUPS: Record<string, string> = {
  "12": "Marketing",
  "582": "Parceiros",
  "583": "Parceiros",
  "1748": "Expansão",
  "3189": "Spots",
  "4551": "Mônica",
};
function getCanalGroup(canal: string | null): string {
  return CANAL_GROUPS[String(canal || "")] || "Outros";
}

const CANAL_ORDER = ["Marketing", "Parceiros", "Mônica", "Expansão", "Spots", "Outros"];

// Metas WON por canal (from nekt_meta26_metas fields)
const META_FIELD_MAP: Record<string, string> = {
  Marketing: "won_szs_meta_pago",
  Parceiros: "won_szs_meta_parceiro",
  Expansão: "won_szs_meta_exp",
  Spots: "won_szs_meta_spot",
  Outros: "won_szs_meta_direto",
};

const STAGE_NAMES: Record<number, string> = {
  1: "Lead in", 2: "Contatados", 3: "Qualificação", 4: "Qualificado", 5: "Aguardando data",
  6: "Agendado", 7: "No Show", 8: "Reunião Realizada", 9: "FUP",
  10: "Negociação", 11: "Aguardando Dados", 12: "Contrato",
};
const ALL_STAGES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

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

export async function GET() {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const mesStr = `${year}-${String(month + 1).padStart(2, "0")}`;
    const mesInicio = `${mesStr}-01`;
    const mesFim = `${year}-${String(month + 2).padStart(2, "0")}-01`;
    const diasNoMes = new Date(year, month + 1, 0).getDate();
    const diasPassados = now.getDate();
    const diasRestantes = diasNoMes - diasPassados;

    const d90 = new Date(now);
    d90.setDate(d90.getDate() - 90);
    const d90Str = d90.toISOString().substring(0, 10);

    // --- Queries paralelas (SZS: todos os canais) ---
    const [openDeals, hist90d, won90d, wonThisMonth, metasRows] = await Promise.all([
      paginate((o, ps) =>
        supabase
          .from("szs_deals")
          .select("deal_id, stage_order, owner_name, canal")
          .eq("status", "open")
          .range(o, o + ps - 1),
      ),
      paginate((o, ps) =>
        supabase
          .from("szs_deals")
          .select("deal_id, status, stage_order, max_stage_order, lost_reason, add_time, won_time, canal")
          .in("status", ["won", "lost"])
          .gte("add_time", d90Str)
          .range(o, o + ps - 1),
      ),
      paginate((o, ps) =>
        supabase
          .from("szs_deals")
          .select("deal_id, add_time, won_time, max_stage_order")
          .eq("status", "won")
          .gte("won_time", d90Str)
          .range(o, o + ps - 1),
      ),
      paginate((o, ps) =>
        supabase
          .from("szs_deals")
          .select("deal_id, owner_name, canal")
          .eq("status", "won")
          .gte("won_time", mesInicio)
          .lt("won_time", mesFim)
          .range(o, o + ps - 1),
      ),
      // Meta WON por canal (nekt_meta26_metas via service role key)
      (() => {
        const srvKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const srvClient = srvKey
          ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, srvKey)
          : supabase;
        const metaDateStr = `01/${String(month + 1).padStart(2, "0")}/${year}`;
        return srvClient
          .from("nekt_meta26_metas")
          .select("won_szs_meta, won_szs_meta_pago, won_szs_meta_direto, won_szs_meta_parceiro, won_szs_meta_spot, won_szs_meta_exp")
          .eq("data", metaDateStr)
          .single();
      })(),
    ]);

    // --- Taxa de conversão por etapa (90d) ---
    const reachedStage: Record<number, number> = {};
    const wonFromStage: Record<number, number> = {};
    for (const so of ALL_STAGES) { reachedStage[so] = 0; wonFromStage[so] = 0; }

    for (const d of hist90d) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const maxSO = d.max_stage_order || d.stage_order || 1;
      for (const so of ALL_STAGES) {
        if (maxSO >= so) {
          reachedStage[so]++;
          if (d.status === "won") wonFromStage[so]++;
        }
      }
    }

    const convRate: Record<number, number> = {};
    for (const so of ALL_STAGES) {
      convRate[so] = reachedStage[so] > 0 ? wonFromStage[so] / reachedStage[so] : 0;
    }

    // --- Leadtime médio por etapa ---
    const leadtimeSums: Record<number, number> = {};
    const leadtimeCounts: Record<number, number> = {};
    for (const so of ALL_STAGES) { leadtimeSums[so] = 0; leadtimeCounts[so] = 0; }

    for (const d of won90d) {
      if (!d.add_time || !d.won_time) continue;
      const cycleDays = (new Date(d.won_time).getTime() - new Date(d.add_time).getTime()) / (1000 * 60 * 60 * 24);
      if (cycleDays <= 0) continue;
      const maxSO = d.max_stage_order || 12;
      for (const so of ALL_STAGES) {
        if (maxSO >= so) {
          const remainingDays = cycleDays * (12 - so) / 11;
          leadtimeSums[so] += Math.max(0, remainingDays);
          leadtimeCounts[so]++;
        }
      }
    }

    const leadtimeByStage: Record<number, number> = {};
    for (const so of ALL_STAGES) {
      leadtimeByStage[so] = leadtimeCounts[so] > 0 ? Math.round(leadtimeSums[so] / leadtimeCounts[so]) : 0;
    }

    // --- Deals abertos por etapa ---
    const openByStage: Record<number, number> = {};
    for (const d of openDeals) {
      const so = d.stage_order || 1;
      openByStage[so] = (openByStage[so] || 0) + 1;
    }

    // --- Stage snapshots ---
    const stages: ForecastStageSnapshot[] = ALL_STAGES.map((so) => {
      const deals = openByStage[so] || 0;
      const rate = convRate[so] || 0;
      return {
        stage: STAGE_NAMES[so] || `Stage ${so}`,
        stageOrder: so,
        openDeals: deals,
        convRate: rate,
        leadtimeDays: leadtimeByStage[so] || 0,
        expectedWon: Math.round(deals * rate * 10) / 10,
      };
    });

    const totalPipeline = stages.reduce((s, st) => s + st.expectedWon, 0);

    // --- WON do mês por canal ---
    const wonByCanal: Record<string, number> = {};
    for (const d of wonThisMonth) {
      const group = getCanalGroup(d.canal);
      wonByCanal[group] = (wonByCanal[group] || 0) + 1;
    }
    const totalWonActual = wonThisMonth.length;

    // --- Pipeline por canal ---
    const pipelineByCanal: Record<string, number> = {};
    const openByCanalStage: Record<string, Record<number, number>> = {};
    for (const d of openDeals) {
      const group = getCanalGroup(d.canal);
      const so = d.stage_order || 1;
      pipelineByCanal[group] = (pipelineByCanal[group] || 0) + (convRate[so] || 0);
      if (!openByCanalStage[group]) openByCanalStage[group] = {};
      openByCanalStage[group][so] = (openByCanalStage[group][so] || 0) + 1;
    }

    // --- Meta WON por canal ---
    const metaByCanal: Record<string, number> = {};
    const nektMeta = metasRows.data;
    if (nektMeta) {
      for (const [group, field] of Object.entries(META_FIELD_MAP)) {
        metaByCanal[group] = Number(nektMeta[field as keyof typeof nektMeta]) || 0;
      }
    }

    // --- Canal rows (reuse ForecastSquadRow — canal = "squad") ---
    const squadsResult: ForecastSquadRow[] = CANAL_ORDER
      .filter((group) => {
        // Only include canals with data or meta
        return (wonByCanal[group] || 0) > 0 || (pipelineByCanal[group] || 0) > 0 || (metaByCanal[group] || 0) > 0;
      })
      .map((group, idx) => {
        const wonActual = wonByCanal[group] || 0;
        const pipeline = pipelineByCanal[group] || 0;
        const total = wonActual + pipeline;
        const meta = metaByCanal[group] || 0;

        // Stage snapshot per canal
        const canalOpenByStage = openByCanalStage[group] || {};
        const canalStages: ForecastStageSnapshot[] = ALL_STAGES.map((so) => {
          const deals = canalOpenByStage[so] || 0;
          const rate = convRate[so] || 0;
          return {
            stage: STAGE_NAMES[so] || `Stage ${so}`,
            stageOrder: so,
            openDeals: deals,
            convRate: rate,
            leadtimeDays: leadtimeByStage[so] || 0,
            expectedWon: Math.round(deals * rate * 10) / 10,
          };
        });

        return {
          id: idx + 1,
          name: group,
          closers: [],
          wonActual,
          pipeline: Math.round(pipeline * 10) / 10,
          generation: 0,
          total: Math.round(total * 10) / 10,
          meta,
          pctMeta: meta > 0 ? Math.round((total / meta) * 100) : 0,
          stages: canalStages,
        };
      });

    // --- Grand total ---
    const grandTotal = totalWonActual + totalPipeline;
    const grandMeta = Object.values(metaByCanal).reduce((s, v) => s + v, 0);

    const result: ForecastData = {
      month: mesStr,
      diasPassados,
      diasRestantes,
      diasNoMes,
      wonActual: totalWonActual,
      pipeline: Math.round(totalPipeline * 10) / 10,
      generation: 0,
      total: Math.round(grandTotal * 10) / 10,
      meta: grandMeta,
      pctMeta: grandMeta > 0 ? Math.round((grandTotal / grandMeta) * 100) : 0,
      ranges: {
        pessimista: Math.round((totalWonActual + totalPipeline * 0.7) * 10) / 10,
        esperado: Math.round(grandTotal * 10) / 10,
        otimista: Math.round((totalWonActual + totalPipeline * 1.3) * 10) / 10,
      },
      stages,
      squads: squadsResult,
      metodologia: `Deals abertos de todos os canais (pipeline SZS), agrupados por canal. Taxa de conversão por etapa calculada com base nos últimos 90 dias: de todos os deals que passaram pela etapa X (max_stage_order >= X), qual % virou WON. Forecast = WON já ganhos no mês + Σ(deals abertos por etapa × taxa conversão da etapa). Meta por canal: nekt_meta26_metas.`,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("SZS Forecast error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
