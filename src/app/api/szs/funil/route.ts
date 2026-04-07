// SZS (Serviços) module — funil by individual canal (no squad grouping)
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import type { FunilData, FunilSquad, FunilEmpreendimento, FunilCidade } from "@/lib/types";
import { SZS_METAS_WON_BY_SQUAD } from "@/lib/szs-utils";

export const dynamic = "force-dynamic";

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

// The 6 canais to show in SZS funnel
const SZS_CANAIS = ["Marketing", "Ind. Franquia", "Ind. Corretor", "Expansão", "Spots", "Outros"] as const;

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

    const [countsData, stageData, baserowLeadsRes, paidDealsRes] = await Promise.all([
      fetchAll(supabase.from("szs_daily_counts").select("tab, canal_group, count").in("tab", ["mql", "sql", "opp", "won"]).gte("date", startDate)),
      fetchAll(supabase.from("szs_daily_counts").select("tab, canal_group, count").in("tab", ["reserva", "contrato"])),
      fetchAll(admin.from("baserow_szs_leads").select("cidade").gte("data_criacao_ads", startDate).lt("data_criacao_ads", mesFim)),
      fetchAll(admin.from("szs_deals").select("canal_group, max_stage_order, status, lost_reason").eq("canal", "12").ilike("rd_source", "%pag%").not("canal_group", "is", null).gte("add_time", startDate)),
    ]);

    // Build funnel counts by canal (direct key, no squad grouping)
    const canalCounts = new Map<string, Record<string, number>>();
    for (const row of [...countsData, ...stageData]) {
      const canal = row.canal_group || "Outros";
      if (!canalCounts.has(canal)) canalCounts.set(canal, { mql: 0, sql: 0, opp: 0, won: 0, reserva: 0, contrato: 0 });
      canalCounts.get(canal)![row.tab] = (canalCounts.get(canal)![row.tab] || 0) + (row.count || 0);
    }

    // Baserow leads by canal
    const baserowLeadsMap = new Map<string, number>();
    for (const row of baserowLeadsRes) {
      if (!row.cidade) continue;
      // baserow_szs_leads uses cidade field - try to match by known cidade names
      // For now, distribute evenly among all canais that have leads
      // Actually, baserow_szs_leads.cidade is the cidade, not canal - skip for now
    }

    // Paid deals by canal
    const paidCountsMap = new Map<string, { mql: number; sql: number; opp: number; won: number }>();
    for (const d of paidDealsRes) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const canal = d.canal_group || "Outros";
      if (!paidCountsMap.has(canal)) paidCountsMap.set(canal, { mql: 0, sql: 0, opp: 0, won: 0 });
      const cur = paidCountsMap.get(canal)!;
      cur.mql++;
      if (d.max_stage_order >= 4) cur.sql++;
      if (d.max_stage_order >= 9) cur.opp++;
      if (d.status === "won") cur.won++;
    }

    // Build funnel for each canal (shown as cidade rows)
    const cidades: FunilCidade[] = SZS_CANAIS.map((canal) => {
      const counts = canalCounts.get(canal) || { mql: 0, sql: 0, opp: 0, won: 0, reserva: 0, contrato: 0 };
      const paid = paidCountsMap.get(canal) || { mql: 0, sql: 0, opp: 0, won: 0 };

      let mql: number, sql: number, opp: number, won: number, reserva: number, contrato: number;

      if (paidOnly) {
        mql = paid.mql; sql = paid.sql; opp = paid.opp; won = paid.won;
        reserva = 0; contrato = 0;
      } else {
        mql = counts.mql || 0; sql = counts.sql || 0; opp = counts.opp || 0; won = counts.won || 0;
        reserva = counts.reserva || 0; contrato = counts.contrato || 0;
      }

      // leads = mql (simplified for SZS - no Meta Ads data by canal)
      const funil = buildFunil(canal, 0, 0, mql, mql, sql, opp, won, reserva, contrato, 0);

      return {
        cidade: canal,
        bairros: [],
        totals: funil,
      };
    });

    // Remove empty canais (no data, no meta)
    const monthMetas = SZS_METAS_WON_BY_SQUAD[month] || {};
    // Map metas: Marketing=squad1, Ind.Franquia/Ind.Corretor=squad2, Expansão/Spots/Outros=squad3
    const canalMetaMap: Record<string, number> = {
      Marketing: monthMetas[1] || 0,
      "Ind. Franquia": Math.round((monthMetas[2] || 0) / 3),
      "Ind. Corretor": Math.round((monthMetas[2] || 0) / 3),
      "Ind. Outros Parceiros": Math.round((monthMetas[2] || 0) / 3),
      Expansão: Math.round((monthMetas[3] || 0) / 3),
      Spots: Math.round((monthMetas[3] || 0) / 3),
      Outros: Math.round((monthMetas[3] || 0) / 3),
      Monica: Math.round((monthMetas[3] || 0) / 3),
    };

    const nonEmptyCidades = cidades.filter((c) => {
      const totals = c.totals;
      return totals.mql + totals.sql + totals.opp + totals.won > 0 || (canalMetaMap[c.cidade] || 0) > 0;
    });

    // Grand total
    const allFunil = nonEmptyCidades.map((c) => c.totals);
    const grand = sumFunil(allFunil, "Total");

    // Build metas object keyed by canal name
    const metasObj: Record<string, Record<string, number>> = {};
    metasObj["Total"] = {};
    for (const c of nonEmptyCidades) {
      metasObj[c.cidade] = { won: canalMetaMap[c.cidade] || 0 };
      metasObj["Total"].won = (metasObj["Total"].won || 0) + (canalMetaMap[c.cidade] || 0);
    }

    const squads: FunilSquad[] = [{
      id: 1,
      name: "Serviços",
      empreendimentos: [],
      cidades: nonEmptyCidades,
      totals: grand,
    }];

    const result: FunilData = { month, squads, grand, metas: metasObj };
    return NextResponse.json(result);
  } catch (error) {
    console.error("SZS Funil error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
