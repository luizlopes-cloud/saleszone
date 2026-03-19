// SZS (Serviços) module — funil with canal_group > cidade hierarchy
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import type { FunilData, FunilSquad, FunilEmpreendimento } from "@/lib/types";

export const dynamic = "force-dynamic";

const SZS_METAS_WON: Record<string, Record<string, number>> = {
  "2026-01": { Marketing: 66, Parceiros: 67, Expansão: 72, Spots: 48, Outros: 27 },
  "2026-02": { Marketing: 69, Parceiros: 71, Expansão: 84, Spots: 26, Outros: 26 },
  "2026-03": { Marketing: 70, Parceiros: 73, Expansão: 95, Spots: 39, Outros: 28 },
  "2026-04": { Marketing: 73, Parceiros: 75, Expansão: 102, Spots: 17, Outros: 31 },
  "2026-05": { Marketing: 73, Parceiros: 77, Expansão: 109, Spots: 0, Outros: 26 },
  "2026-06": { Marketing: 73, Parceiros: 77, Expansão: 114, Spots: 49, Outros: 33 },
  "2026-07": { Marketing: 71, Parceiros: 75, Expansão: 121, Spots: 0, Outros: 29 },
  "2026-08": { Marketing: 71, Parceiros: 89, Expansão: 120, Spots: 0, Outros: 31 },
  "2026-09": { Marketing: 78, Parceiros: 101, Expansão: 140, Spots: 28, Outros: 32 },
  "2026-10": { Marketing: 71, Parceiros: 114, Expansão: 140, Spots: 0, Outros: 29 },
  "2026-11": { Marketing: 73, Parceiros: 128, Expansão: 141, Spots: 0, Outros: 29 },
  "2026-12": { Marketing: 75, Parceiros: 139, Expansão: 139, Spots: 31, Outros: 31 },
};
const CANAL_GROUP_ORDER = ["Marketing", "Parceiros", "Expansão", "Spots", "Outros"];

function rate(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 10000) / 10000 : 0;
}

function cost(spend: number, den: number): number {
  return den > 0 ? Math.round((spend / den) * 100) / 100 : 0;
}

function buildFunil(
  emp: string,
  impressions: number,
  clicks: number,
  leads: number,
  mql: number,
  sql: number,
  opp: number,
  won: number,
  reserva: number,
  contrato: number,
  spend: number,
): FunilEmpreendimento {
  return {
    emp,
    impressions,
    clicks,
    leads,
    mql,
    sql,
    opp,
    won,
    reserva,
    contrato,
    spend: Math.round(spend * 100) / 100,
    cpl: cost(spend, leads),
    cmql: cost(spend, mql),
    csql: cost(spend, sql),
    copp: cost(spend, opp),
    cpw: cost(spend, won),
    ctr: rate(clicks, impressions),
    clickToLead: rate(leads, clicks),
    leadToMql: rate(mql, leads),
    mqlToSql: rate(sql, mql),
    sqlToOpp: rate(opp, sql),
    oppToReserva: rate(reserva, opp),
    reservaToContrato: rate(contrato, reserva),
    contratoToWon: rate(won, contrato),
    oppToWon: rate(won, opp),
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

// Paginated fetch helper (Supabase 1000-row limit)
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

    const [metaData, countsData, stageData] = await Promise.all([
      fetchAll(
        supabase
          .from("szs_meta_ads")
          .select("ad_id, empreendimento, impressions, clicks, leads_month, spend_month")
          .gte("snapshot_date", startDate)
      ),
      fetchAll(
        supabase
          .from("szs_daily_counts")
          .select("tab, empreendimento, canal_group, count")
          .in("tab", ["mql", "sql", "opp", "won"])
          .gte("date", startDate)
      ),
      fetchAll(
        supabase
          .from("szs_daily_counts")
          .select("tab, empreendimento, canal_group, count")
          .in("tab", ["reserva", "contrato"])
      ),
    ]);

    // Agregar Meta Ads: max spend_month/leads_month por ad (city-level only)
    const adMax = new Map<string, { empreendimento: string; impressions: number; clicks: number; leads_month: number; spend_month: number }>();
    for (const row of metaData) {
      const cur = adMax.get(row.ad_id);
      if (!cur || (Number(row.spend_month) || 0) > cur.spend_month) {
        adMax.set(row.ad_id, {
          empreendimento: row.empreendimento,
          impressions: row.impressions || 0,
          clicks: row.clicks || 0,
          leads_month: row.leads_month || 0,
          spend_month: Number(row.spend_month) || 0,
        });
      }
    }
    // Meta Ads aggregated by city (Meta Ads doesn't have canal_group)
    const metaMap = new Map<string, { impressions: number; clicks: number; leads: number; spend: number }>();
    for (const ad of adMax.values()) {
      const cur = metaMap.get(ad.empreendimento) || { impressions: 0, clicks: 0, leads: 0, spend: 0 };
      cur.impressions += ad.impressions;
      cur.clicks += ad.clicks;
      cur.leads += ad.leads_month;
      cur.spend += ad.spend_month;
      metaMap.set(ad.empreendimento, cur);
    }

    // Build counts by canal_group|cidade
    const groupCidadeCountsMap = new Map<string, Record<string, number>>();

    for (const row of countsData) {
      const canalGroup = row.canal_group || "Outros";
      const cidade = row.empreendimento;
      const gKey = `${canalGroup}|${cidade}`;
      if (!groupCidadeCountsMap.has(gKey)) groupCidadeCountsMap.set(gKey, { mql: 0, sql: 0, opp: 0, won: 0, reserva: 0, contrato: 0 });
      groupCidadeCountsMap.get(gKey)![row.tab] = (groupCidadeCountsMap.get(gKey)![row.tab] || 0) + (row.count || 0);
    }

    for (const row of stageData) {
      const canalGroup = row.canal_group || "Outros";
      const cidade = row.empreendimento;
      const gKey = `${canalGroup}|${cidade}`;
      if (!groupCidadeCountsMap.has(gKey)) groupCidadeCountsMap.set(gKey, { mql: 0, sql: 0, opp: 0, won: 0, reserva: 0, contrato: 0 });
      groupCidadeCountsMap.get(gKey)![row.tab] = (groupCidadeCountsMap.get(gKey)![row.tab] || 0) + (row.count || 0);
    }

    // Build squads: each canal_group = one squad, cidades = empreendimentos
    const squads: FunilSquad[] = CANAL_GROUP_ORDER.map((canalGroup, idx) => {
      // Find all cidades for this canal group
      const cidadeEntries: Array<{ cidade: string; counts: Record<string, number> }> = [];
      for (const [gKey, counts] of groupCidadeCountsMap.entries()) {
        if (!gKey.startsWith(canalGroup + "|")) continue;
        const cidade = gKey.split("|")[1];
        cidadeEntries.push({ cidade, counts });
      }

      // Canal group-level counts (sum of all cidades)
      const groupCounts = { mql: 0, sql: 0, opp: 0, won: 0, reserva: 0, contrato: 0 };
      for (const { counts } of cidadeEntries) {
        groupCounts.mql += counts.mql || 0;
        groupCounts.sql += counts.sql || 0;
        groupCounts.opp += counts.opp || 0;
        groupCounts.won += counts.won || 0;
        groupCounts.reserva += counts.reserva || 0;
        groupCounts.contrato += counts.contrato || 0;
      }

      // Build cidade-level empreendimento rows
      // Distribute Meta Ads spend proportionally by MQL count across cidades
      const totalGroupMql = cidadeEntries.reduce((s, c) => s + (c.counts.mql || 0), 0);

      const empRows: FunilEmpreendimento[] = cidadeEntries.map(({ cidade, counts }) => {
        // Get Meta Ads data for this cidade (shared across canal groups)
        const meta = metaMap.get(cidade) || { impressions: 0, clicks: 0, leads: 0, spend: 0 };

        // Proportional share of Meta Ads spend based on MQL distribution within this canal group
        const mqlShare = totalGroupMql > 0 ? (counts.mql || 0) / totalGroupMql : (cidadeEntries.length > 0 ? 1 / cidadeEntries.length : 0);

        // Only "Marketing" canal group gets Meta Ads spend attribution
        const isMarketing = canalGroup === "Marketing";
        const cidadeSpend = isMarketing ? meta.spend * mqlShare : 0;
        const cidadeImpressions = isMarketing ? Math.round(meta.impressions * mqlShare) : 0;
        const cidadeClicks = isMarketing ? Math.round(meta.clicks * mqlShare) : 0;
        const cidadeMetaLeads = isMarketing ? Math.round(meta.leads * mqlShare) : 0;

        let leads: number, mql: number, sql: number, opp: number, won: number, reserva: number, contrato: number;

        if (paidOnly && isMarketing) {
          leads = cidadeMetaLeads;
          mql = Math.min(counts.mql || 0, cidadeMetaLeads);
          const ratio = (counts.mql || 0) > 0 ? mql / (counts.mql || 0) : 0;
          sql = Math.round((counts.sql || 0) * ratio);
          opp = Math.round((counts.opp || 0) * ratio);
          won = Math.round((counts.won || 0) * ratio);
          reserva = Math.round((counts.reserva || 0) * ratio);
          contrato = Math.round((counts.contrato || 0) * ratio);
        } else {
          const mqiNaoPago = isMarketing ? Math.max((counts.mql || 0) - cidadeMetaLeads, 0) : (counts.mql || 0);
          leads = cidadeMetaLeads + mqiNaoPago;
          mql = counts.mql || 0;
          sql = counts.sql || 0;
          opp = counts.opp || 0;
          won = counts.won || 0;
          reserva = counts.reserva || 0;
          contrato = counts.contrato || 0;
        }

        return buildFunil(cidade, cidadeImpressions, cidadeClicks, leads, mql, sql, opp, won, reserva, contrato, cidadeSpend);
      });

      // Sort cidades by total count (mql+sql+opp+won) descending
      empRows.sort((a, b) => (b.mql + b.sql + b.opp + b.won) - (a.mql + a.sql + a.opp + a.won));

      return {
        id: idx + 1,
        name: canalGroup,
        empreendimentos: empRows,
        totals: sumFunil(empRows, canalGroup),
      };
    });

    // Get metas for the month
    const monthMetas = SZS_METAS_WON[month] || {};

    // Filter out empty squads (no data and no meta)
    const nonEmptySquads = squads.filter((sq) => sq.empreendimentos.length > 0 || (monthMetas[sq.name] || 0) > 0);

    const allEmps = nonEmptySquads.flatMap((sq) => sq.empreendimentos);
    const grand = sumFunil(allEmps, "Total");

    const result: FunilData = { month, squads: nonEmptySquads, grand };
    return NextResponse.json(result);
  } catch (error) {
    console.error("SZS Funil error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
