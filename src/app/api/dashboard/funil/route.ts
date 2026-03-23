import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { SQUADS } from "@/lib/constants";
import type { FunilData, FunilSquad, FunilEmpreendimento } from "@/lib/types";

export const dynamic = "force-dynamic";

function rate(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 10000) / 10000 : 0;
}

function cost(spend: number, den: number): number {
  return den > 0 ? Math.round((spend / den) * 100) / 100 : 0;
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

export async function GET(req: NextRequest) {
  try {
    const monthParam = req.nextUrl.searchParams.get("month");
    const filterParam = req.nextUrl.searchParams.get("filter"); // "paid" or null
    const paidOnly = filterParam === "paid";
    const now = new Date();
    const month = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const startDate = `${month}-01`;
    const [yearStr, monthStr] = month.split("-");
    const mesFim = `${yearStr}-${String(Number(monthStr) + 1).padStart(2, "0")}-01`;

    // Queries paralelas
    const [metaRes, countsRes, stageSnapshotRes, dealsRes] = await Promise.all([
      // Meta Ads — spend_month/leads_month
      supabase
        .from("squad_meta_ads")
        .select("ad_id, empreendimento, impressions, clicks, leads_month, spend_month")
        .gte("snapshot_date", startDate),
      // MQL/SQL/OPP/WON do mês (eventos acumulados)
      supabase
        .from("squad_daily_counts")
        .select("tab, empreendimento, count")
        .in("tab", ["mql", "sql", "opp", "won"])
        .gte("date", startDate),
      // Reserva/Contrato snapshot (sem filtro de data — estado atual dos stages)
      supabase
        .from("squad_daily_counts")
        .select("tab, empreendimento, count")
        .in("tab", ["reserva", "contrato"]),
      // Deals fechados no mês (won + lost) — para conversões OPP→Reserva→Contrato→WON
      // Mesma coorte: todos os deals que fecharam no mês, contados por max_stage_order
      paginate((o, ps) =>
        supabase
          .from("squad_deals")
          .select("empreendimento, max_stage_order, status, lost_reason")
          .eq("is_marketing", true)
          .not("empreendimento", "is", null)
          .in("status", ["won", "lost"])
          .or(`won_time.gte.${startDate},lost_time.gte.${startDate}`)
          .range(o, o + ps - 1),
      ),
    ]);

    if (metaRes.error) throw new Error(`Meta Ads query error: ${metaRes.error.message}`);
    if (countsRes.error) throw new Error(`Daily counts query error: ${countsRes.error.message}`);
    if (stageSnapshotRes.error) throw new Error(`Stage snapshot query error: ${stageSnapshotRes.error.message}`);

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

    // Agregar Pipedrive counts por tab/empreendimento (MQL/SQL/OPP/WON — eventos do mês)
    const countsMap = new Map<string, Record<string, number>>();
    for (const row of countsRes.data || []) {
      const key = row.empreendimento;
      if (!countsMap.has(key)) countsMap.set(key, { mql: 0, sql: 0, opp: 0, won: 0 });
      const cur = countsMap.get(key)!;
      cur[row.tab] = (cur[row.tab] || 0) + (row.count || 0);
    }

    // Agregar snapshot reserva/contrato (estado atual)
    const snapshotMap = new Map<string, { reserva: number; contrato: number }>();
    for (const row of stageSnapshotRes.data || []) {
      const key = row.empreendimento;
      if (!snapshotMap.has(key)) snapshotMap.set(key, { reserva: 0, contrato: 0 });
      const cur = snapshotMap.get(key)!;
      cur[row.tab as "reserva" | "contrato"] = (cur[row.tab as "reserva" | "contrato"] || 0) + (row.count || 0);
    }

    // Agregar eventos por stage — deals fechados no mês (mesma coorte)
    // OPP = max_stage_order >= 9, Reserva = >= 13, Contrato = >= 14, WON = status won
    // Exclui Duplicado/Erro em JS (neq no Supabase exclui NULLs, removendo WONs)
    const eventoMap = new Map<string, { oppEvento: number; reservaEvento: number; contratoEvento: number; wonEvento: number }>();
    for (const d of dealsRes) {
      const emp = d.empreendimento;
      if (!emp) continue;
      if (d.lost_reason === "Duplicado/Erro") continue;
      if (!eventoMap.has(emp)) eventoMap.set(emp, { oppEvento: 0, reservaEvento: 0, contratoEvento: 0, wonEvento: 0 });
      const cur = eventoMap.get(emp)!;
      if (d.max_stage_order >= 9) cur.oppEvento++;
      if (d.max_stage_order >= 13) cur.reservaEvento++;
      if (d.max_stage_order >= 14) cur.contratoEvento++;
      if (d.status === "won") cur.wonEvento++;
    }

    // Build por squad
    const squads: FunilSquad[] = SQUADS.map((sq) => {
      const empRows: FunilEmpreendimento[] = sq.empreendimentos.map((emp) => {
        const meta = metaMap.get(emp) || { impressions: 0, clicks: 0, leads: 0, spend: 0 };
        const counts = countsMap.get(emp) || { mql: 0, sql: 0, opp: 0, won: 0 };
        const snapshot = snapshotMap.get(emp) || { reserva: 0, contrato: 0 };
        const ev = eventoMap.get(emp) || { oppEvento: 0, reservaEvento: 0, contratoEvento: 0, wonEvento: 0 };

        let leads: number, mql: number, sql: number, opp: number, won: number;
        let reserva: number, contrato: number;
        let eventos: EventoCoorte;

        if (paidOnly) {
          leads = meta.leads;
          mql = Math.min(counts.mql, meta.leads);
          const ratio = counts.mql > 0 ? mql / counts.mql : 0;
          sql = Math.round(counts.sql * ratio);
          opp = Math.round(counts.opp * ratio);
          won = Math.round(counts.won * ratio);
          reserva = Math.round(snapshot.reserva * ratio);
          contrato = Math.round(snapshot.contrato * ratio);
          eventos = {
            oppEvento: Math.round(ev.oppEvento * ratio),
            reservaEvento: Math.round(ev.reservaEvento * ratio),
            contratoEvento: Math.round(ev.contratoEvento * ratio),
            wonEvento: Math.round(ev.wonEvento * ratio),
          };
        } else {
          const mqiNaoPago = Math.max(counts.mql - meta.leads, 0);
          leads = meta.leads + mqiNaoPago;
          mql = counts.mql;
          sql = counts.sql;
          opp = counts.opp;
          won = counts.won;
          reserva = snapshot.reserva;
          contrato = snapshot.contrato;
          eventos = ev;
        }

        return buildFunil(emp, meta.impressions, meta.clicks, leads, mql, sql, opp, won, reserva, contrato, eventos, meta.spend);
      });

      return {
        id: sq.id,
        name: sq.name,
        empreendimentos: empRows,
        totals: sumFunil(empRows, sq.name),
      };
    });

    const allEmps = squads.flatMap((sq) => sq.empreendimentos);
    const grand = sumFunil(allEmps, "Total");

    const result: FunilData = { month, squads, grand };
    return NextResponse.json(result);
  } catch (error) {
    console.error("Funil error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
