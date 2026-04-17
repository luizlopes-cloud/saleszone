// SZS (Serviços) module — funil by 3 squads: Marketing, Parceiros, Expansão
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { getModuleConfig } from "@/lib/modules";
import type { FunilData, FunilSquad, FunilEmpreendimento } from "@/lib/types";
import { getCidadeGroup, SZS_METAS_WON_BY_SQUAD } from "@/lib/szs-utils";

export const dynamic = "force-dynamic";

const mc = getModuleConfig("szs");

function rate(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 10000) / 10000 : 0;
}

function cost(spend: number, den: number): number {
  return den > 0 ? Math.round((spend / den) * 100) / 100 : 0;
}

function buildFunil(
  emp: string, impressions: number, clicks: number, leads: number,
  mql: number, sql: number, opp: number, won: number,
  reserva: number, contrato: number, spend: number,
): FunilEmpreendimento {
  const rAcum = reserva + contrato + won;
  const cAcum = contrato + won;
  return {
    emp, impressions, clicks, leads, mql, sql, opp, won, reserva, contrato,
    oppEvento: opp, reservaEvento: rAcum, contratoEvento: cAcum, wonEvento: won,
    spend: Math.round(spend * 100) / 100,
    cpl: cost(spend, leads), cmql: cost(spend, mql), csql: cost(spend, sql),
    copp: cost(spend, opp), cpw: cost(spend, won),
    ctr: rate(clicks, impressions), clickToLead: rate(leads, clicks),
    leadToMql: rate(mql, leads), mqlToSql: rate(sql, mql), sqlToOpp: rate(opp, sql),
    oppToReserva: rate(rAcum, opp), reservaToContrato: rate(cAcum, rAcum),
    contratoToWon: rate(won, cAcum), oppToWon: rate(won, opp),
  };
}

function sumFunil(rows: FunilEmpreendimento[], label: string): FunilEmpreendimento {
  const impressions = rows.reduce((s, r) => s + r.impressions, 0);
  const clicks = rows.reduce((s, r) => s + r.clicks, 0);
  const leads = rows.reduce((s, r) => s + r.leads, 0);
  const mql = rows.reduce((s, r) => s + r.mql, 0);
  const sql = rows.reduce((s, r) => s + r.sql, 0);
  const opp = rows.reduce((s, r) => s + r.opp, 0);
  const won = rows.reduce((s, r) => s + r.won, 0);
  const reserva = rows.reduce((s, r) => s + r.reserva, 0);
  const contrato = rows.reduce((s, r) => s + r.contrato, 0);
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  return buildFunil(label, impressions, clicks, leads, mql, sql, opp, won, reserva, contrato, spend);
}

async function fetchAll(query: any): Promise<any[]> {
  const all: any[] = [];
  let offset = 0;
  const PAGE = 1000;
  while (true) {
    const { data, error } = await query.range(offset, offset + PAGE - 1);
    if (error) throw new Error(error.message);
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

// canal (numeric) → canal_group label for display
const CANAL_NUM_TO_GROUP: Record<string, string> = {
  "12": "Marketing",
  "582": "Ind. Corretor",
  "583": "Ind. Franquia",
  "1748": "Expansão",
  "3189": "Spots",
  "4551": "Monica",
};
// canal_group label → squad ID (countsByCanal is keyed by translated label)
const CANAL_GROUP_TO_SQUAD: Record<string, number> = {
  Marketing: 1,
  "Ind. Corretor": 2,
  "Ind. Franquia": 2,
  Expansão: 3,
  Spots: 3,
  Monica: 3,
  Outros: 3,
};
const DEFAULT_GROUP = "Outros";

// Classifica stage_order atual em bucket do funil
// Pipeline 14 (SZS): MQL=1-3, SQL=4-7, OPP=8-10, Reserva=11, Contrato=12
type SnapBucket = "mql" | "sql" | "opp" | "reserva" | "contrato";
function classifyStage(so: number): SnapBucket | null {
  if (so >= 1 && so <= 3) return "mql";
  if (so >= 4 && so <= 7) return "sql";
  if (so >= 8 && so <= 10) return "opp";
  if (so === 11) return "reserva";
  if (so === 12) return "contrato";
  return null;
}
const EMPTY_SNAP = (): Record<SnapBucket, number> => ({ mql: 0, sql: 0, opp: 0, reserva: 0, contrato: 0 });

export async function GET(req: NextRequest) {
  try {
    const monthParam = req.nextUrl.searchParams.get("month");
    const filterParam = req.nextUrl.searchParams.get("filter");
    const paidOnly = filterParam === "paid";
    const now = new Date();
    const month = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const startDate = `${month}-01`;

    const [yearStr, monthStr] = month.split("-");
    const mesFim = `${yearStr}-${String(Number(monthStr) + 1).padStart(2, "0")}-01`;
    const admin = createSquadSupabaseAdmin();

    const [allDealsRes, wonDealsRes, baserowLeadsRes, openDealsSnapshot] = await Promise.all([
      // All deals for bridge cidade→canal (no canal filter for complete attribution)
      fetchAll(admin.from("szs_deals").select("empreendimento, canal, lost_reason").gte("add_time", startDate)),
      // WON deals by won_time
      fetchAll(admin.from("szs_deals").select("canal, lost_reason").gte("won_time", startDate)),
      // All form fills from baserow (leads, not qualified)
      fetchAll(admin.from("baserow_szs_leads").select("cidade").gte("data_criacao_ads", startDate).lt("data_criacao_ads", mesFim)),
      // Open deals snapshot — MQL/SQL/OPP/Reserva/Contrato por stage_order atual (só abertos)
      fetchAll(admin.from("szs_deals").select("canal, stage_order, lost_reason, rd_source").eq("status", "open")),
    ]);

    // Build WON counts by canal_group
    const wonByCanal = new Map<string, number>();
    for (const d of wonDealsRes) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const g = CANAL_NUM_TO_GROUP[d.canal] || DEFAULT_GROUP;
      wonByCanal.set(g, (wonByCanal.get(g) || 0) + 1);
    }

    // Build MQL counts by canal_group (deals created in month = Leads/MQL event count)
    const mqlByCanal = new Map<string, number>();
    for (const d of allDealsRes) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const g = CANAL_NUM_TO_GROUP[d.canal] || DEFAULT_GROUP;
      mqlByCanal.set(g, (mqlByCanal.get(g) || 0) + 1);
    }

    // Bridge: primary canal per cidade (canal with most deals from that cidade)
    const cidadeCanalCount = new Map<string, Map<string, number>>();
    for (const d of allDealsRes) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const cidade = getCidadeGroup(d.empreendimento);
      if (!cidadeCanalCount.has(cidade)) cidadeCanalCount.set(cidade, new Map());
      const canalGroup = CANAL_NUM_TO_GROUP[d.canal] || DEFAULT_GROUP;
      cidadeCanalCount.get(cidade)!.set(canalGroup, (cidadeCanalCount.get(cidade)!.get(canalGroup) || 0) + 1);
    }
    const cidadeToCanal = new Map<string, string>();
    for (const [cidade, canalCounts] of cidadeCanalCount) {
      let topCanal = DEFAULT_GROUP;
      let topCount = 0;
      for (const [canal, count] of canalCounts) {
        if (count > topCount) { topCount = count; topCanal = canal; }
      }
      cidadeToCanal.set(cidade, topCanal);
    }

    // Leads per canal from baserow (ALL form fills, not qualified)
    const leadsPerCanal = new Map<string, number>();
    for (const row of baserowLeadsRes) {
      if (!row.cidade) continue;
      const cidade = getCidadeGroup(row.cidade);
      const canal = cidadeToCanal.get(cidade) || DEFAULT_GROUP;
      leadsPerCanal.set(canal, (leadsPerCanal.get(canal) || 0) + 1);
    }

    // Open deals snapshot: classificar por stage_order atual, agrupado por canal
    // MQL = deals abertos em Lead-In até antes de Qualificado (stage_order 1-3)
    // SQL = Qualificado até antes de Reunião Realizada (stage_order 4-7)
    // OPP = Reunião Realizada até antes de Ag. Dados (stage_order 8-10)
    // Reserva (Ag. Dados) = stage_order 11
    // Contrato = stage_order 12
    const allSnapByCanal = new Map<string, Record<SnapBucket, number>>();
    const paidSnapByCanal = new Map<string, Record<SnapBucket, number>>();
    for (const d of openDealsSnapshot) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const g = CANAL_NUM_TO_GROUP[d.canal] || DEFAULT_GROUP;
      const bucket = classifyStage(d.stage_order || 0);
      if (!bucket) continue;

      if (!allSnapByCanal.has(g)) allSnapByCanal.set(g, EMPTY_SNAP());
      allSnapByCanal.get(g)![bucket]++;

      if (d.rd_source && d.rd_source.toLowerCase().includes("pag")) {
        if (!paidSnapByCanal.has(g)) paidSnapByCanal.set(g, EMPTY_SNAP());
        paidSnapByCanal.get(g)![bucket]++;
      }
    }

    // Build counts by squadId|canalGroup
    const squadCanalSnap = new Map<string, Record<SnapBucket, number>>();
    for (const [canalGroup, snap] of allSnapByCanal.entries()) {
      const squadId = CANAL_GROUP_TO_SQUAD[canalGroup] ?? 3;
      const gKey = `${squadId}|${canalGroup}`;
      squadCanalSnap.set(gKey, snap);
    }

    // Build squads from mc.squads (3 squads: Marketing, Parceiros, Expansão)
    const squads: FunilSquad[] = mc.squads.map((sq) => {
      const canalEntries: Array<{ canal: string; snap: Record<SnapBucket, number> }> = [];
      for (const [gKey, snap] of squadCanalSnap.entries()) {
        if (!gKey.startsWith(`${sq.id}|`)) continue;
        canalEntries.push({ canal: gKey.split("|")[1], snap });
      }

      const empRows: FunilEmpreendimento[] = canalEntries.map(({ canal, snap }) => {
        const won = wonByCanal.get(canal) || 0;

        let leads: number;

        if (paidOnly) {
          const paidSnap = paidSnapByCanal.get(canal) || EMPTY_SNAP();
          const marketingLeads = leadsPerCanal.get("Marketing") || 0;
          leads = Math.max(marketingLeads, paidSnap.mql);
          return buildFunil(canal, 0, 0, leads, paidSnap.mql, paidSnap.sql, paidSnap.opp, won, paidSnap.reserva, paidSnap.contrato, 0);
        } else {
          // leads from baserow per canal (all form fills) >= MQL (only qualified)
          const canalLeads = leadsPerCanal.get(canal) || 0;
          leads = Math.max(canalLeads, snap.mql);
          return buildFunil(canal, 0, 0, leads, snap.mql, snap.sql, snap.opp, won, snap.reserva, snap.contrato, 0);
        }
      });

      empRows.sort((a, b) => (b.mql + b.sql + b.opp + b.won) - (a.mql + a.sql + a.opp + a.won));

      return {
        id: sq.id,
        name: sq.name,
        marketing: sq.marketing,
        preVenda: sq.preVenda,
        venda: sq.venda,
        empreendimentos: empRows,
        totals: sumFunil(empRows, sq.name),
      };
    });

    const monthMetas = SZS_METAS_WON_BY_SQUAD[month] || {};
    const nonEmptySquads = squads.filter((sq) => sq.empreendimentos.length > 0 || (monthMetas[sq.id] || 0) > 0);

    const allEmps = nonEmptySquads.flatMap((sq) => sq.empreendimentos);
    const grand = sumFunil(allEmps, "Total");

    // Metas by squad name (matches squad.name: Marketing/Parceiros/Expansão)
    const metasObj: Record<string, Record<string, number>> = {};
    metasObj["Total"] = { won: 0 };
    for (const sq of nonEmptySquads) {
      metasObj[sq.name] = { won: monthMetas[sq.id] || 0 };
      metasObj["Total"].won += monthMetas[sq.id] || 0;
    }

    const result: FunilData = { month, squads: nonEmptySquads, grand, metas: metasObj };
    return NextResponse.json(result);
  } catch (error) {
    console.error("SZS Funil error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
