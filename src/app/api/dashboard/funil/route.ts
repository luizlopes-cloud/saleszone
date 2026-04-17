import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createSquadSupabaseAdmin, hasServiceRole } from "@/lib/squad/supabase";
import { createClient } from "@supabase/supabase-js";
import { SQUADS, EXTRA_EMPREENDIMENTOS } from "@/lib/constants";
import { paginate } from "@/lib/paginate";
import type { FunilData, FunilSquad, FunilEmpreendimento } from "@/lib/types";

export const dynamic = "force-dynamic";

function rate(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 10000) / 10000 : 0;
}

function cost(spend: number, den: number): number {
  return den > 0 ? Math.round((spend / den) * 100) / 100 : 0;
}

interface EventoCoorte {
  oppEvento: number;
  reservaEvento: number;
  contratoEvento: number;
  wonEvento: number;
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
  eventos: EventoCoorte,
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
    oppEvento: eventos.oppEvento,
    reservaEvento: eventos.reservaEvento,
    contratoEvento: eventos.contratoEvento,
    wonEvento: eventos.wonEvento,
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
    // Conversões OPP→Reserva→Contrato→WON usam coorte de deals fechados no mês
    oppToReserva: rate(eventos.reservaEvento, eventos.oppEvento),
    reservaToContrato: rate(eventos.contratoEvento, eventos.reservaEvento),
    contratoToWon: rate(eventos.wonEvento, eventos.contratoEvento),
    oppToWon: rate(eventos.wonEvento, eventos.oppEvento),
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
  const eventos: EventoCoorte = {
    oppEvento: rows.reduce((s, r) => s + r.oppEvento, 0),
    reservaEvento: rows.reduce((s, r) => s + r.reservaEvento, 0),
    contratoEvento: rows.reduce((s, r) => s + r.contratoEvento, 0),
    wonEvento: rows.reduce((s, r) => s + r.wonEvento, 0),
  };
  return buildFunil(label, impressions, clicks, leads, mql, sql, opp, won, reserva, contrato, eventos, spend);
}

// Classifica stage_order atual em bucket do funil
// Pipeline 28: MQL=1-4, SQL=5-8, OPP=9-12, Reserva=13, Contrato=14
type SnapBucket = "mql" | "sql" | "opp" | "reserva" | "contrato";
function classifyStage(so: number): SnapBucket | null {
  if (so >= 1 && so <= 4) return "mql";
  if (so >= 5 && so <= 8) return "sql";
  if (so >= 9 && so <= 12) return "opp";
  if (so === 13) return "reserva";
  if (so === 14) return "contrato";
  return null;
}
const EMPTY_SNAP = (): Record<SnapBucket, number> => ({ mql: 0, sql: 0, opp: 0, reserva: 0, contrato: 0 });

export async function GET(req: NextRequest) {
  try {
    const admin = createSquadSupabaseAdmin();
    const monthParam = req.nextUrl.searchParams.get("month");
    const filterParam = req.nextUrl.searchParams.get("filter"); // "paid" or null
    const paidOnly = filterParam === "paid";
    const now = new Date();
    const month = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const startDate = `${month}-01`;
    const [yearStr, monthStr] = month.split("-");
    const mesNum = Number(monthStr);
    const mesFim = mesNum === 12
      ? `${Number(yearStr) + 1}-01-01`
      : `${yearStr}-${String(mesNum + 1).padStart(2, "0")}-01`;

    // Queries paralelas
    const [metaRes, countsRes, dealsRes, baserowLeadsRes, paidLeadsDeals, paidWonDeals, metasRes, allLeadsDeals, allWonDeals, openDealsSnapshot] = await Promise.all([
      // Meta Ads — spend_month/leads_month
      supabase
        .from("squad_meta_ads")
        .select("ad_id, empreendimento, impressions, clicks, leads_month, spend_month")
        .gte("snapshot_date", startDate),
      // MQL/SQL/OPP/WON do mês — fallback sem service role (WON + Leads max constraint)
      supabase
        .from("squad_daily_counts")
        .select("tab, empreendimento, count")
        .in("tab", ["mql", "sql", "opp", "won"])
        .gte("date", startDate),
      // Deals fechados no mês (won + lost) — para conversões OPP→Reserva→Contrato→WON
      // Mesma coorte: todos os deals que fecharam no mês, contados por max_stage_order
      paginate((o, ps) =>
        admin
          .from("squad_deals")
          .select("empreendimento, max_stage_order, status, lost_reason")
          .in("status", ["won", "lost"])
          .or(`won_time.gte.${startDate},lost_time.gte.${startDate}`)
          .range(o, o + ps - 1),
      ),
      // Baserow leads — formulários preenchidos no mês (fonte real de Leads)
      // Usa service_role porque baserow_leads tem RLS sem policy para anon
      (() => {
        const admin2 = createSquadSupabaseAdmin();
        return paginate((o, ps) =>
          admin2
            .from("baserow_leads")
            .select("nome_empreendimento")
            .gte("data_criacao_ads", startDate)
            .lt("data_criacao_ads", mesFim)
            .range(o, o + ps - 1),
        );
      })(),
      // Mídia Paga — Leads (deals criados no mês com rd_source pag)
      paginate((o, ps) =>
        admin
          .from("squad_deals")
          .select("empreendimento, lost_reason")
          .ilike("rd_source", "%pag%")
          .gte("add_time", startDate)
          .range(o, o + ps - 1),
      ),
      // Mídia Paga — WON por won_time
      paginate((o, ps) =>
        admin
          .from("squad_deals")
          .select("empreendimento, lost_reason")
          .ilike("rd_source", "%pag%")
          .gte("won_time", startDate)
          .range(o, o + ps - 1),
      ),
      // Metas do mês (squad_metas table)
      supabase
        .from("squad_metas")
        .select("squad_id, tab, meta")
        .eq("month", `${month}-01`),
      // Todos — Leads (deals criados no mês, todos os canais)
      paginate((o, ps) =>
        admin
          .from("squad_deals")
          .select("empreendimento, lost_reason")
          .gte("add_time", startDate)
          .range(o, o + ps - 1),
      ),
      // Todos — WON por won_time
      paginate((o, ps) =>
        admin
          .from("squad_deals")
          .select("empreendimento, lost_reason")
          .gte("won_time", startDate)
          .range(o, o + ps - 1),
      ),
      // Open deals snapshot — MQL/SQL/OPP/Reserva/Contrato por stage_order atual (só abertos)
      paginate((o, ps) =>
        admin
          .from("squad_deals")
          .select("empreendimento, stage_order, rd_source, lost_reason")
          .eq("status", "open")
          .range(o, o + ps - 1),
      ),
    ]);

    if (metaRes.error) throw new Error(`Meta Ads query error: ${metaRes.error.message}`);
    if (countsRes.error) throw new Error(`Daily counts query error: ${countsRes.error.message}`);
    if (metasRes.error) console.warn(`Metas query warning: ${metasRes.error.message}`);

    // Agregar Meta Ads: max spend_month/leads_month por ad
    const adMax = new Map<string, { empreendimento: string; impressions: number; clicks: number; leads_month: number; spend_month: number }>();
    for (const row of metaRes.data || []) {
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
    const metaMap = new Map<string, { impressions: number; clicks: number; leads: number; spend: number }>();
    for (const ad of adMax.values()) {
      const cur = metaMap.get(ad.empreendimento) || { impressions: 0, clicks: 0, leads: 0, spend: 0 };
      cur.impressions += ad.impressions;
      cur.clicks += ad.clicks;
      cur.leads += ad.leads_month;
      cur.spend += ad.spend_month;
      metaMap.set(ad.empreendimento, cur);
    }

    // Agregar Pipedrive counts por tab/empreendimento (fallback sem service role)
    const countsMap = new Map<string, Record<string, number>>();
    for (const row of countsRes.data || []) {
      const key = row.empreendimento;
      if (!countsMap.has(key)) countsMap.set(key, { mql: 0, sql: 0, opp: 0, won: 0 });
      const cur = countsMap.get(key)!;
      cur[row.tab] = (cur[row.tab] || 0) + (row.count || 0);
    }

    // Agregar Baserow leads por empreendimento (formulários preenchidos no mês)
    const baserowLeadsMap = new Map<string, number>();
    for (const row of baserowLeadsRes) {
      const emp = row.nome_empreendimento;
      if (!emp) continue;
      baserowLeadsMap.set(emp, (baserowLeadsMap.get(emp) || 0) + 1);
    }

    // Agregar deals pagos — Leads e WON
    const paidLeadsMap = new Map<string, number>();
    const paidWonMap = new Map<string, number>();
    for (const d of paidLeadsDeals) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const key = d.empreendimento || "__sem_emp__";
      paidLeadsMap.set(key, (paidLeadsMap.get(key) || 0) + 1);
    }
    for (const d of paidWonDeals) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const key = d.empreendimento || "__sem_emp__";
      paidWonMap.set(key, (paidWonMap.get(key) || 0) + 1);
    }

    // Agregar eventos por stage — deals fechados no mês (mesma coorte)
    // OPP = max_stage_order >= 9, Reserva = >= 13, Contrato = >= 14, WON = status won
    // Exclui Duplicado/Erro em JS (neq no Supabase exclui NULLs, removendo WONs)
    // Inclui deals SEM empreendimento (key = "__sem_emp__") para contar na conversão total
    const eventoMap = new Map<string, { oppEvento: number; reservaEvento: number; contratoEvento: number; wonEvento: number }>();
    for (const d of dealsRes) {
      const emp = d.empreendimento || "__sem_emp__";
      if (d.lost_reason === "Duplicado/Erro") continue;
      if (!eventoMap.has(emp)) eventoMap.set(emp, { oppEvento: 0, reservaEvento: 0, contratoEvento: 0, wonEvento: 0 });
      const cur = eventoMap.get(emp)!;
      if (d.max_stage_order >= 9) cur.oppEvento++;
      if (d.max_stage_order >= 13) cur.reservaEvento++;
      if (d.max_stage_order >= 14) cur.contratoEvento++;
      if (d.status === "won") cur.wonEvento++;
    }

    // Agregar deals todos — Leads e WON
    const allLeadsMap = new Map<string, number>();
    const allWonMap = new Map<string, number>();
    for (const d of allLeadsDeals) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const key = d.empreendimento || "__sem_emp__";
      allLeadsMap.set(key, (allLeadsMap.get(key) || 0) + 1);
    }
    for (const d of allWonDeals) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const key = d.empreendimento || "__sem_emp__";
      allWonMap.set(key, (allWonMap.get(key) || 0) + 1);
    }

    // Open deals snapshot: classificar por stage_order atual
    // MQL = deals abertos em Lead-In até antes de Qualificado (stage_order 1-4)
    // SQL = Qualificado até antes de Reunião Realizada (stage_order 5-8)
    // OPP = Reunião Realizada até antes de Reserva (stage_order 9-12)
    // Reserva = etapa Reserva (stage_order 13)
    // Contrato = etapa Contrato (stage_order 14)
    const allSnapMap = new Map<string, Record<SnapBucket, number>>();
    const paidSnapMap = new Map<string, Record<SnapBucket, number>>();
    for (const d of openDealsSnapshot) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const emp = d.empreendimento || "__sem_emp__";
      const bucket = classifyStage(d.stage_order || 0);
      if (!bucket) continue;

      if (!allSnapMap.has(emp)) allSnapMap.set(emp, EMPTY_SNAP());
      allSnapMap.get(emp)![bucket]++;

      if (d.rd_source && d.rd_source.toLowerCase().includes("pag")) {
        if (!paidSnapMap.has(emp)) paidSnapMap.set(emp, EMPTY_SNAP());
        paidSnapMap.get(emp)![bucket]++;
      }
    }

    // Build por squad
    const squads: FunilSquad[] = SQUADS.map((sq) => {
      const empRows: FunilEmpreendimento[] = sq.empreendimentos.map((emp) => {
        const meta = metaMap.get(emp) || { impressions: 0, clicks: 0, leads: 0, spend: 0 };
        const ev = eventoMap.get(emp) || { oppEvento: 0, reservaEvento: 0, contratoEvento: 0, wonEvento: 0 };

        // Snapshot de deals abertos para MQL/SQL/OPP/Reserva/Contrato
        const snap = paidOnly
          ? (paidSnapMap.get(emp) || EMPTY_SNAP())
          : (allSnapMap.get(emp) || EMPTY_SNAP());

        let leads: number, won: number;
        const eventos: EventoCoorte = ev;

        if (paidOnly) {
          leads = paidLeadsMap.get(emp) || 0;
          won = paidWonMap.get(emp) || 0;
        } else if (hasServiceRole()) {
          leads = allLeadsMap.get(emp) || 0;
          won = allWonMap.get(emp) || 0;
        } else {
          // Fallback sem service role
          const baserowLeads = baserowLeadsMap.get(emp) || 0;
          const counts = countsMap.get(emp) || { mql: 0, won: 0 };
          leads = Math.max(baserowLeads > 0 ? baserowLeads : meta.leads, counts.mql);
          won = counts.won;
        }

        return buildFunil(emp, meta.impressions, meta.clicks, leads, snap.mql, snap.sql, snap.opp, won, snap.reserva, snap.contrato, eventos, meta.spend);
      });

      return {
        id: sq.id,
        name: sq.name,
        empreendimentos: empRows,
        totals: sumFunil(empRows, sq.name),
      };
    });

    // Build extra empreendimento rows (not in any squad, but counted in grand total)
    const extraRows: FunilEmpreendimento[] = EXTRA_EMPREENDIMENTOS.map((emp) => {
      const meta = metaMap.get(emp) || { impressions: 0, clicks: 0, leads: 0, spend: 0 };
      const ev = eventoMap.get(emp) || { oppEvento: 0, reservaEvento: 0, contratoEvento: 0, wonEvento: 0 };

      const snap = paidOnly
        ? (paidSnapMap.get(emp) || EMPTY_SNAP())
        : (allSnapMap.get(emp) || EMPTY_SNAP());

      let leads: number, won: number;
      let eventos: EventoCoorte;

      if (paidOnly) {
        leads = paidLeadsMap.get(emp) || 0;
        won = paidWonMap.get(emp) || 0;
        const allMql = (allSnapMap.get(emp) || EMPTY_SNAP()).mql;
        const ratio = allMql > 0 ? snap.mql / allMql : 0;
        eventos = {
          oppEvento: Math.round(ev.oppEvento * ratio),
          reservaEvento: Math.round(ev.reservaEvento * ratio),
          contratoEvento: Math.round(ev.contratoEvento * ratio),
          wonEvento: Math.round(ev.wonEvento * ratio),
        };
      } else {
        const baserowLeads = baserowLeadsMap.get(emp) || 0;
        leads = Math.max(baserowLeads > 0 ? baserowLeads : meta.leads, snap.mql);
        won = (countsMap.get(emp) || { won: 0 }).won;
        eventos = ev;
      }

      return buildFunil(emp, meta.impressions, meta.clicks, leads, snap.mql, snap.sql, snap.opp, won, snap.reserva, snap.contrato, eventos, meta.spend);
    });

    const allEmps = [...squads.flatMap((sq) => sq.empreendimentos), ...extraRows];
    const grand = sumFunil(allEmps, "Total");

    // Sobrescrever grand com totais reais de squad_deals (inclui deals sem empreendimento)
    if (hasServiceRole()) {
      const snapMap = paidOnly ? paidSnapMap : allSnapMap;
      const leadsMap = paidOnly ? paidLeadsMap : allLeadsMap;
      const wonMap = paidOnly ? paidWonMap : allWonMap;

      let totalLeads = 0, totalMql = 0, totalSql = 0, totalOpp = 0, totalWon = 0, totalReserva = 0, totalContrato = 0;
      for (const [, v] of leadsMap) totalLeads += v;
      for (const [, v] of snapMap) { totalMql += v.mql; totalSql += v.sql; totalOpp += v.opp; totalReserva += v.reserva; totalContrato += v.contrato; }
      for (const [, v] of wonMap) totalWon += v;

      (grand as unknown as Record<string, number>).leads = totalLeads;
      (grand as unknown as Record<string, number>).mql = totalMql;
      (grand as unknown as Record<string, number>).sql = totalSql;
      (grand as unknown as Record<string, number>).opp = totalOpp;
      (grand as unknown as Record<string, number>).won = totalWon;
      (grand as unknown as Record<string, number>).reserva = totalReserva;
      (grand as unknown as Record<string, number>).contrato = totalContrato;
    }

    // Build metas object from nekt_meta26_metas (service role - RLS blocks anon)
    const metasObj: Record<string, Record<string, number>> = { "Squad 1": {}, "Squad 2": {} };
    const ratios = { mql_sql: 4.12, sql_opp: 3.47, opp_won: 6.01 };

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("[funil] Missing env vars: NEXT_PUBLIC_SUPABASE_URL=" + !!supabaseUrl + " SUPABASE_SERVICE_ROLE_KEY=" + !!serviceRoleKey);
    } else {
      const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
      const monthNum = String(month.split("-")[1]).padStart(2, "0");
      const { data: nektRow, error: nektError } = await supabaseAdmin
        .from("nekt_meta26_metas")
        .select("data, won_szi_meta_pago, won_szi_meta_direto, mql_meta_szi, sql_meta_szi, opp_meta_szi")
        .like("data", `%/${monthNum}/%`)
        .limit(1)
        .single();

      if (nektError) {
        console.error("[funil] nekt_meta26_metas query error:", nektError);
      } else if (nektRow) {
        const wonTotal = (Number(nektRow.won_szi_meta_pago) || 0) + (Number(nektRow.won_szi_meta_direto) || 0);
        // Se tem metas por tab direto, usa elas; senao calcula via ratios
        const mql = Number(nektRow.mql_meta_szi) || Math.round(wonTotal * ratios.mql_sql * ratios.sql_opp);
        const sql = Number(nektRow.sql_meta_szi) || Math.round(wonTotal * ratios.opp_won);
        const opp = Number(nektRow.opp_meta_szi) || Math.round(wonTotal);
        // Divide por 2 squads
        metasObj["Squad 1"] = { mql: Math.round(mql / 2), sql: Math.round(sql / 2), opp: Math.round(opp / 2), won: Math.round(wonTotal / 2) };
        metasObj["Squad 2"] = { mql: Math.round(mql / 2), sql: Math.round(sql / 2), opp: Math.round(opp / 2), won: Math.round(wonTotal / 2) };
      }
    }

    const result: FunilData = { month, squads, grand, metas: metasObj };
    return NextResponse.json(result);
  } catch (error) {
    console.error("Funil error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
