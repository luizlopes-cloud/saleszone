// MKTP (Marketplace) module
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { getModuleConfig } from "@/lib/modules";
import type { FunilData, FunilSquad, FunilEmpreendimento } from "@/lib/types";

const mc = getModuleConfig("mktp");

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
// Pipeline 37 (MKTP): MQL=1-3, SQL=4-7, OPP=8-11, Reserva=12, Contrato=13
type SnapBucket = "mql" | "sql" | "opp" | "reserva" | "contrato";
function classifyStage(so: number): SnapBucket | null {
  if (so >= 1 && so <= 3) return "mql";
  if (so >= 4 && so <= 7) return "sql";
  if (so >= 8 && so <= 11) return "opp";
  if (so === 12) return "reserva";
  if (so === 13) return "contrato";
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

    const [metaRes, metasRes, wonDealsRes, openDealsSnapshot] = await Promise.all([
      supabase
        .from("mktp_meta_ads")
        .select("ad_id, empreendimento, impressions, clicks, leads_month, spend_month")
        .gte("snapshot_date", startDate),
      supabase
        .from("mktp_metas")
        .select("squad_id, tab, meta")
        .eq("month", `${month}-01`),
      // WON deals by won_time
      fetchAll(admin.from("mktp_deals").select("empreendimento, lost_reason").gte("won_time", startDate)),
      // Open deals snapshot — MQL/SQL/OPP/Reserva/Contrato por stage_order atual (só abertos)
      fetchAll(admin.from("mktp_deals").select("empreendimento, stage_order, lost_reason").eq("status", "open")),
    ]);

    if (metaRes.error) throw new Error(`Meta Ads query error: ${metaRes.error.message}`);
    if (metasRes.error) console.warn(`Metas query warning: ${metasRes.error.message}`);

    // Build WON counts by empreendimento
    const wonByEmp = new Map<string, number>();
    for (const d of wonDealsRes) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const key = d.empreendimento || "Outros";
      wonByEmp.set(key, (wonByEmp.get(key) || 0) + 1);
    }

    // Open deals snapshot: classificar por stage_order atual
    // MQL = deals abertos em Lead-In até antes de Qualificado (stage_order 1-3)
    // SQL = Qualificado até antes de Reunião Realizada (stage_order 4-7)
    // OPP = Reunião Realizada até antes de Reserva (stage_order 8-11)
    // Reserva = stage_order 12
    // Contrato = stage_order 13
    const snapByEmp = new Map<string, Record<SnapBucket, number>>();
    for (const d of openDealsSnapshot) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const key = d.empreendimento || "Outros";
      const bucket = classifyStage(d.stage_order || 0);
      if (!bucket) continue;

      if (!snapByEmp.has(key)) snapByEmp.set(key, EMPTY_SNAP());
      snapByEmp.get(key)![bucket]++;
    }

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

    // Build metas object from mktp_metas table
    const metasObj: Record<string, Record<string, number>> = {};
    if (metasRes.data) {
      for (const m of metasRes.data) {
        const squadName = "Marketplace"; // MKTP has only 1 squad
        if (!metasObj[squadName]) metasObj[squadName] = {};
        metasObj[squadName][m.tab] = m.meta;
      }
    }

    const result: FunilData = { month, squads, grand, metas: metasObj };
    return NextResponse.json(result);
  } catch (error) {
    console.error("MKTP Funil error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
