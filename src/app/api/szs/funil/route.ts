// SZS (Serviços) module — funil with 3 squads by canal, cidade sub-rows
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { getModuleConfig } from "@/lib/modules";
import type { FunilData, FunilSquad, FunilEmpreendimento } from "@/lib/types";
import {
  getSquadIdFromCanalGroup,
  getCidadeGroup,
  SZS_METAS_WON_BY_SQUAD,
} from "@/lib/szs-utils";

const mc = getModuleConfig("szs");

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

    const [metaData, countsData, stageData, baserowLeadsRes, paidDealsRes] = await Promise.all([
      fetchAll(supabase.from("szs_meta_ads").select("ad_id, empreendimento, impressions, clicks, leads_month, spend_month").gte("snapshot_date", startDate)),
      fetchAll(supabase.from("szs_daily_counts").select("tab, empreendimento, canal_group, count").in("tab", ["mql", "sql", "opp", "won"]).gte("date", startDate)),
      fetchAll(supabase.from("szs_daily_counts").select("tab, empreendimento, canal_group, count").in("tab", ["reserva", "contrato"])),
      fetchAll(admin.from("baserow_szs_leads").select("cidade").gte("data_criacao_ads", startDate).lt("data_criacao_ads", mesFim)),
      fetchAll(admin.from("szs_deals").select("empreendimento, max_stage_order, status, lost_reason").eq("canal", "12").ilike("rd_source", "%pag%").not("empreendimento", "is", null).gte("add_time", startDate)),
    ]);

    // Meta Ads aggregated by cidade group
    const adMax = new Map<string, { empreendimento: string; impressions: number; clicks: number; leads_month: number; spend_month: number }>();
    for (const row of metaData) {
      const cur = adMax.get(row.ad_id);
      if (!cur || (Number(row.spend_month) || 0) > cur.spend_month) {
        adMax.set(row.ad_id, { empreendimento: row.empreendimento, impressions: row.impressions || 0, clicks: row.clicks || 0, leads_month: row.leads_month || 0, spend_month: Number(row.spend_month) || 0 });
      }
    }
    const metaMap = new Map<string, { impressions: number; clicks: number; leads: number; spend: number }>();
    for (const ad of adMax.values()) {
      const group = getCidadeGroup(ad.empreendimento);
      const cur = metaMap.get(group) || { impressions: 0, clicks: 0, leads: 0, spend: 0 };
      cur.impressions += ad.impressions; cur.clicks += ad.clicks; cur.leads += ad.leads_month; cur.spend += ad.spend_month;
      metaMap.set(group, cur);
    }

    // Baserow leads by cidade
    const baserowLeadsMap = new Map<string, number>();
    for (const row of baserowLeadsRes) {
      if (!row.cidade) continue;
      const group = getCidadeGroup(row.cidade);
      baserowLeadsMap.set(group, (baserowLeadsMap.get(group) || 0) + 1);
    }

    // Paid deals by cidade
    const paidCountsMap = new Map<string, { mql: number; sql: number; opp: number; won: number }>();
    for (const d of paidDealsRes) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const cidade = getCidadeGroup(d.empreendimento);
      if (!paidCountsMap.has(cidade)) paidCountsMap.set(cidade, { mql: 0, sql: 0, opp: 0, won: 0 });
      const cur = paidCountsMap.get(cidade)!;
      cur.mql++;
      if (d.max_stage_order >= 4) cur.sql++;
      if (d.max_stage_order >= 9) cur.opp++;
      if (d.status === "won") cur.won++;
    }

    // Build counts by squadId|canalGroup (sub-rows are canals, not cities)
    const squadCanalCounts = new Map<string, Record<string, number>>();

    for (const row of [...countsData, ...stageData]) {
      const canalGroup = row.canal_group || "Outros";
      const squadId = getSquadIdFromCanalGroup(canalGroup);
      const gKey = `${squadId}|${canalGroup}`;
      if (!squadCanalCounts.has(gKey)) squadCanalCounts.set(gKey, { mql: 0, sql: 0, opp: 0, won: 0, reserva: 0, contrato: 0 });
      squadCanalCounts.get(gKey)![row.tab] = (squadCanalCounts.get(gKey)![row.tab] || 0) + (row.count || 0);
    }

    // Build squads from mc.squads (3 squads)
    const squads: FunilSquad[] = mc.squads.map((sq) => {
      const canalEntries: Array<{ canal: string; counts: Record<string, number> }> = [];
      for (const [gKey, counts] of squadCanalCounts.entries()) {
        if (!gKey.startsWith(`${sq.id}|`)) continue;
        canalEntries.push({ canal: gKey.split("|")[1], counts });
      }

      const totalGroupMql = canalEntries.reduce((s, c) => s + (c.counts.mql || 0), 0);
      const isMarketing = sq.id === 1; // Squad 1 = Marketing

      // Meta Ads: aggregate all cities into squad-level totals (only Marketing squad)
      const squadMeta = isMarketing
        ? Array.from(metaMap.values()).reduce((acc, m) => ({ impressions: acc.impressions + m.impressions, clicks: acc.clicks + m.clicks, leads: acc.leads + m.leads, spend: acc.spend + m.spend }), { impressions: 0, clicks: 0, leads: 0, spend: 0 })
        : { impressions: 0, clicks: 0, leads: 0, spend: 0 };

      const empRows: FunilEmpreendimento[] = canalEntries.map(({ canal, counts }) => {
        // Distribute Meta Ads proportionally by MQL share within canal entries
        const mqlShare = totalGroupMql > 0 ? (counts.mql || 0) / totalGroupMql : (canalEntries.length > 0 ? 1 / canalEntries.length : 0);

        const canalSpend = isMarketing ? squadMeta.spend * mqlShare : 0;
        const canalImpressions = isMarketing ? Math.round(squadMeta.impressions * mqlShare) : 0;
        const canalClicks = isMarketing ? Math.round(squadMeta.clicks * mqlShare) : 0;
        const canalMetaLeads = isMarketing ? Math.round(squadMeta.leads * mqlShare) : 0;

        let leads: number, mql: number, sql: number, opp: number, won: number, reserva: number, contrato: number;

        if (paidOnly && isMarketing) {
          // Sum all city-level baserow/paid data for this canal
          const totalBaserow = Array.from(baserowLeadsMap.values()).reduce((a, b) => a + b, 0);
          const totalPaid = Array.from(paidCountsMap.values()).reduce((a, p) => ({ mql: a.mql + p.mql, sql: a.sql + p.sql, opp: a.opp + p.opp, won: a.won + p.won }), { mql: 0, sql: 0, opp: 0, won: 0 });
          leads = Math.max(totalBaserow > 0 ? Math.round(totalBaserow * mqlShare) : canalMetaLeads, Math.round(totalPaid.mql * mqlShare));
          mql = Math.round(totalPaid.mql * mqlShare); sql = Math.round(totalPaid.sql * mqlShare);
          opp = Math.round(totalPaid.opp * mqlShare); won = Math.round(totalPaid.won * mqlShare);
          reserva = 0; contrato = 0;
        } else {
          leads = Math.max(0, counts.mql || 0);
          mql = counts.mql || 0; sql = counts.sql || 0; opp = counts.opp || 0; won = counts.won || 0;
          reserva = counts.reserva || 0; contrato = counts.contrato || 0;
        }

        return buildFunil(canal, canalImpressions, canalClicks, leads, mql, sql, opp, won, reserva, contrato, canalSpend);
      });

      empRows.sort((a, b) => (b.mql + b.sql + b.opp + b.won) - (a.mql + a.sql + a.opp + a.won));

      return {
        id: sq.id,
        name: sq.name,
        empreendimentos: empRows,
        totals: sumFunil(empRows, sq.name),
      };
    });

    const monthMetas = SZS_METAS_WON_BY_SQUAD[month] || {};
    const nonEmptySquads = squads.filter((sq) => sq.empreendimentos.length > 0 || (monthMetas[sq.id] || 0) > 0);

    const allEmps = nonEmptySquads.flatMap((sq) => sq.empreendimentos);
    const grand = sumFunil(allEmps, "Total");

    const result: FunilData = { month, squads: nonEmptySquads, grand };
    return NextResponse.json(result);
  } catch (error) {
    console.error("SZS Funil error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
