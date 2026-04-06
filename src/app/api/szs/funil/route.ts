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

<<<<<<< HEAD
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
const CANAL_GROUP_ORDER = ["Marketing", "Parceiros", "Mônica", "Expansão", "Spots", "Outros"];

// Regiões para filtro de cidade
const REGION_ORDER = ["Salvador", "São Paulo", "Florianópolis", "Outros"];

function getRegiao(cidade: string): string {
  if (!cidade) return "Outros";
  const lower = cidade.toLowerCase();
  // Salvador: Salvador, BA, Bahia (evitar "ba" solo que pega outras cidades)
  if (lower.includes("salvador") || lower.includes(", ba") || lower.includes(",ba") || lower.includes("bahia")) return "Salvador";
  // São Paulo: SP, RJ, Maceió, AL, Recife, PE, Natal, RN
  if (lower.includes("são paulo") || lower.includes(" sp") || lower.includes(",sp") || lower.includes("rio de janeiro") || lower.includes(", rj") || lower.includes("maceió") || lower.includes(", al") || lower.includes("recife") || lower.includes(", pe") || lower.includes("natal") || lower.includes(", rn")) return "São Paulo";
  // Florianópolis: SC, cidades de Santa Catarina
  if (lower.includes("florianópolis") || lower.includes("florianopolis") || lower.includes(", sc") || lower.includes(",sc") || lower.includes("santa catarina") || lower.includes("ita") || lower.includes("blumenau") || lower.includes("garopaba") || lower.includes("tubarão") || lower.includes("tubarao") || lower.includes("laguna") || lower.includes("penha") || lower.includes("balneário") || lower.includes("balneario") || lower.includes("bombinhas") || lower.includes("piçarras") || lower.includes("picarras") || lower.includes("barra") || lower.includes("lagos") || lower.includes(", rs")) return "Florianópolis";
  return "Outros";
}

=======
>>>>>>> upstream/main
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
    const regiaoParam = req.nextUrl.searchParams.get("regiao");
    const paidOnly = filterParam === "paid";
    const selectedRegiao = regiaoParam || null;
    const now = new Date();
    const month = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const startDate = `${month}-01`;

<<<<<<< HEAD
    const [metaData, countsData, stageData, metasData] = await Promise.all([
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
      // Snapshot: current deals in stage (no date filter)
      fetchAll(
        supabase
          .from("szs_daily_counts")
          .select("tab, empreendimento, canal_group, count")
          .in("tab", ["reserva", "contrato"])
      ),
      // Metas do mês
      fetchAll(
        supabase
          .from("szs_metas")
          .select("squad_id, tab, meta")
          .eq("month", `${month}-01`)
      ),
=======
    const [yearStr, monthStr] = month.split("-");
    const mesFim = `${yearStr}-${String(Number(monthStr) + 1).padStart(2, "0")}-01`;
    const admin = createSquadSupabaseAdmin();

    const [metaData, countsData, stageData, baserowLeadsRes, paidDealsRes] = await Promise.all([
      fetchAll(supabase.from("szs_meta_ads").select("ad_id, empreendimento, impressions, clicks, leads_month, spend_month").gte("snapshot_date", startDate)),
      fetchAll(supabase.from("szs_daily_counts").select("tab, empreendimento, canal_group, count").in("tab", ["mql", "sql", "opp", "won"]).gte("date", startDate)),
      fetchAll(supabase.from("szs_daily_counts").select("tab, empreendimento, canal_group, count").in("tab", ["reserva", "contrato"])),
      fetchAll(admin.from("baserow_szs_leads").select("cidade").gte("data_criacao_ads", startDate).lt("data_criacao_ads", mesFim)),
      fetchAll(admin.from("szs_deals").select("empreendimento, max_stage_order, status, lost_reason").eq("canal", "12").ilike("rd_source", "%pag%").not("empreendimento", "is", null).gte("add_time", startDate)),
>>>>>>> upstream/main
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

<<<<<<< HEAD
    for (const row of stageData) {
      const canalGroup = row.canal_group || "Outros";
      const cidade = row.empreendimento;
      const gKey = `${canalGroup}|${cidade}`;
      if (!groupCidadeCountsMap.has(gKey)) groupCidadeCountsMap.set(gKey, { mql: 0, sql: 0, opp: 0, won: 0, reserva: 0, contrato: 0 });
      groupCidadeCountsMap.get(gKey)![row.tab] = (groupCidadeCountsMap.get(gKey)![row.tab] || 0) + (row.count || 0);
    }

    // Build squads: each canal_group = one squad, cidades = empreendimentos
    const squads: FunilSquad[] = CANAL_GROUP_ORDER.map((canalGroup, idx) => {
      // Find all cidades for this canal group (filtered by region if selected)
      const cidadeEntries: Array<{ cidade: string; counts: Record<string, number> }> = [];
      for (const [gKey, counts] of groupCidadeCountsMap.entries()) {
        if (!gKey.startsWith(canalGroup + "|")) continue;
        const cidade = gKey.split("|")[1];
        // Apply region filter if selected
        if (selectedRegiao && getRegiao(cidade) !== selectedRegiao) continue;
        cidadeEntries.push({ cidade, counts });
=======
    // Build squads from mc.squads (3 squads)
    const squads: FunilSquad[] = mc.squads.map((sq) => {
      const canalEntries: Array<{ canal: string; counts: Record<string, number> }> = [];
      for (const [gKey, counts] of squadCanalCounts.entries()) {
        if (!gKey.startsWith(`${sq.id}|`)) continue;
        canalEntries.push({ canal: gKey.split("|")[1], counts });
>>>>>>> upstream/main
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
          // Geral: Marketing canal gets Meta Ads leads, others just MQL
          const baserowLeads = isMarketing ? Array.from(baserowLeadsMap.values()).reduce((a, b) => a + b, 0) : 0;
          const metaLeads = isMarketing ? Math.round(squadMeta.leads * mqlShare) : 0;
          const baseLeads = baserowLeads > 0 ? Math.round(baserowLeads * mqlShare) : metaLeads;
          leads = Math.max(baseLeads, counts.mql || 0);
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

<<<<<<< HEAD
    // Get metas for the month from DB (szs_metas table)
    const metasObj: Record<string, Record<string, number>> = {};
    for (const m of metasData) {
      const canalGroup = CANAL_GROUP_ORDER[m.squad_id - 1] || "Outros";
      if (!metasObj[canalGroup]) metasObj[canalGroup] = {};
      // Map tab names: mql, sql, opp, won
      const tabKey = m.tab === "mql" ? "mql" : m.tab === "sql" ? "sql" : m.tab === "opp" ? "opp" : m.tab === "won" ? "won" : m.tab;
      metasObj[canalGroup][tabKey] = m.meta;
    }

    // Merge metas: prefer DB metas (szs_metas), fallback to hardcoded SZS_METAS_WON
    const allMetas: Record<string, Record<string, number>> = { ...SZS_METAS_WON[month] };
    for (const [canal, metaObj] of Object.entries(metasObj)) {
      allMetas[canal] = { ...allMetas[canal], ...metaObj };
    }

    // Build region-level data for filtering
    const regiaoCounts: Record<string, Record<string, number>> = {
      Salvador: { mql: 0, sql: 0, opp: 0, won: 0, reserva: 0, contrato: 0 },
      "São Paulo": { mql: 0, sql: 0, opp: 0, won: 0, reserva: 0, contrato: 0 },
      Florianópolis: { mql: 0, sql: 0, opp: 0, won: 0, reserva: 0, contrato: 0 },
      Outros: { mql: 0, sql: 0, opp: 0, won: 0, reserva: 0, contrato: 0 },
    };

    for (const [gKey, counts] of groupCidadeCountsMap.entries()) {
      const cidade = gKey.split("|")[1];
      const regiao = getRegiao(cidade);
      for (const tab of ["mql", "sql", "opp", "won", "reserva", "contrato"] as const) {
        regiaoCounts[regiao][tab] += counts[tab] || 0;
      }
    }

    // Build metas by region (based on canal_group distribution within each region)
    // We need to know which canal_groups exist in each region
    const regiaoCanalGroups: Record<string, Set<string>> = {
      Salvador: new Set(),
      "São Paulo": new Set(),
      Florianópolis: new Set(),
      Outros: new Set(),
    };

    for (const [gKey] of groupCidadeCountsMap.entries()) {
      const canalGroup = gKey.split("|")[0];
      const cidade = gKey.split("|")[1];
      const regiao = getRegiao(cidade);
      regiaoCanalGroups[regiao].add(canalGroup);
    }

    // Calculate metas per region based on canal_group distribution
    const regiaoMetas: Record<string, Record<string, number>> = {};
    for (const regiao of REGION_ORDER) {
      const canalGroups = regiaoCanalGroups[regiao];
      if (canalGroups.size === 0) continue;

      regiaoMetas[regiao] = { mql: 0, sql: 0, opp: 0, won: 0 };
      for (const canalGroup of canalGroups) {
        const canalMeta = allMetas[canalGroup] || {};
        regiaoMetas[regiao].mql += canalMeta.mql || 0;
        regiaoMetas[regiao].sql += canalMeta.sql || 0;
        regiaoMetas[regiao].opp += canalMeta.opp || 0;
        regiaoMetas[regiao].won += canalMeta.won || 0;
      }
    }

    // Filter out empty squads (no data and no meta)
    const nonEmptySquads = squads.filter((sq) => sq.empreendimentos.length > 0 || (allMetas[sq.name]?.won || 0) > 0);
=======
    const monthMetas = SZS_METAS_WON_BY_SQUAD[month] || {};
    const nonEmptySquads = squads.filter((sq) => sq.empreendimentos.length > 0 || (monthMetas[sq.id] || 0) > 0);
>>>>>>> upstream/main

    const allEmps = nonEmptySquads.flatMap((sq) => sq.empreendimentos);
    const grand = sumFunil(allEmps, "Total");

    const result: FunilData = { month, squads: nonEmptySquads, grand, metas: allMetas, regioes: { counts: regiaoCounts, metas: regiaoMetas } };
    return NextResponse.json(result);
  } catch (error) {
    console.error("SZS Funil error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
