// Decor (Decor) module
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { getModuleConfig } from "@/lib/modules";
import type { FunilData, FunilSquad, FunilEmpreendimento } from "@/lib/types";

const mc = getModuleConfig("decor");

export const dynamic = "force-dynamic";

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
    oppEvento: opp,
    reservaEvento: reserva,
    contratoEvento: contrato,
    wonEvento: won,
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

// Classifica stage_order atual em bucket do funil
// Pipeline 44 (Decor): MQL=1-4, SQL=5-8, OPP=9-12, Reserva=13, Contrato=14
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
    const monthParam = req.nextUrl.searchParams.get("month");
    const filterParam = req.nextUrl.searchParams.get("filter");
    const paidOnly = filterParam === "paid";
    const now = new Date();
    const month = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const startDate = `${month}-01`;

    const admin = createSquadSupabaseAdmin();

    const [metaRes, countsRes, wonDealsRes, openDealsSnapshot] = await Promise.all([
      supabase
        .from("decor_meta_ads")
        .select("ad_id, empreendimento, impressions, clicks, leads_month, spend_month")
        .gte("snapshot_date", startDate),
      // WON do mês from daily_counts (fallback)
      supabase
        .from("decor_daily_counts")
        .select("tab, empreendimento, count")
        .eq("tab", "won")
        .gte("date", startDate),
      // WON deals by won_time from decor_deals
      fetchAll(admin.from("decor_deals").select("empreendimento, lost_reason").gte("won_time", startDate)),
      // Open deals snapshot — MQL/SQL/OPP/Reserva/Contrato por stage_order atual (só abertos)
      fetchAll(admin.from("decor_deals").select("empreendimento, stage_order, lost_reason").eq("status", "open")),
    ]);

    if (metaRes.error) throw new Error(`Meta Ads query error: ${metaRes.error.message}`);
    if (countsRes.error) throw new Error(`Daily counts query error: ${countsRes.error.message}`);

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

    // WON counts from decor_deals (preferred) or decor_daily_counts (fallback)
    const wonByEmp = new Map<string, number>();
    if (wonDealsRes.length > 0) {
      for (const d of wonDealsRes) {
        if (d.lost_reason === "Duplicado/Erro") continue;
        const key = d.empreendimento || "Outros";
        wonByEmp.set(key, (wonByEmp.get(key) || 0) + 1);
      }
    } else {
      for (const row of countsRes.data || []) {
        wonByEmp.set(row.empreendimento, (wonByEmp.get(row.empreendimento) || 0) + (row.count || 0));
      }
    }

    // Open deals snapshot: classificar por stage_order atual
    // MQL = deals abertos em Lead-In até antes de Qualificado (stage_order 1-4)
    // SQL = Qualificado até antes de Reunião Realizada (stage_order 5-8)
    // OPP = Reunião Realizada até antes de Reserva (stage_order 9-12)
    // Reserva = stage_order 13
    // Contrato = stage_order 14
    const snapByEmp = new Map<string, Record<SnapBucket, number>>();
    for (const d of openDealsSnapshot) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const key = d.empreendimento || "Outros";
      const bucket = classifyStage(d.stage_order || 0);
      if (!bucket) continue;

      if (!snapByEmp.has(key)) snapByEmp.set(key, EMPTY_SNAP());
      snapByEmp.get(key)![bucket]++;
    }

    // Collect all known empreendimentos from DB data
    const allDbEmps = new Set([...snapByEmp.keys(), ...wonByEmp.keys(), ...metaMap.keys()]);

    const squads: FunilSquad[] = mc.squads.map((sq) => {
      const emps = sq.empreendimentos.length > 0 ? sq.empreendimentos : [...allDbEmps].sort();
      const empRows: FunilEmpreendimento[] = emps.map((emp) => {
        const meta = metaMap.get(emp) || { impressions: 0, clicks: 0, leads: 0, spend: 0 };
        const snap = snapByEmp.get(emp) || EMPTY_SNAP();
        const won = wonByEmp.get(emp) || 0;

        let leads: number;

        if (paidOnly) {
          leads = meta.leads;
        } else {
          const mqiNaoPago = Math.max(snap.mql - meta.leads, 0);
          leads = meta.leads + mqiNaoPago;
        }

        return buildFunil(emp, meta.impressions, meta.clicks, leads, snap.mql, snap.sql, snap.opp, won, snap.reserva, snap.contrato, meta.spend);
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
    console.error("Decor Funil error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
