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

function buildFunil(
  emp: string,
  impressions: number,
  clicks: number,
  leads: number,
  mql: number,
  sql: number,
  opp: number,
  won: number,
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
    spend: Math.round(spend * 100) / 100,
    cpl: cost(spend, leads),
    cmql: cost(spend, mql),
    csql: cost(spend, sql),
    cpw: cost(spend, won),
    ctr: rate(clicks, impressions),
    clickToLead: rate(leads, clicks),
    leadToMql: rate(mql, leads),
    mqlToSql: rate(sql, mql),
    sqlToOpp: rate(opp, sql),
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
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  return buildFunil(label, impressions, clicks, leads, mql, sql, opp, won, spend);
}

export async function GET(req: NextRequest) {
  try {
    const monthParam = req.nextUrl.searchParams.get("month");
    const now = new Date();
    const month = monthParam || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const startDate = `${month}-01`;

    // Queries paralelas
    const [metaRes, countsRes] = await Promise.all([
      supabase
        .from("squad_meta_ads")
        .select("empreendimento, impressions, clicks, leads, spend")
        .gte("snapshot_date", startDate),
      supabase
        .from("squad_daily_counts")
        .select("tab, empreendimento, count")
        .gte("date", startDate),
    ]);

    if (metaRes.error) throw new Error(`Meta Ads query error: ${metaRes.error.message}`);
    if (countsRes.error) throw new Error(`Daily counts query error: ${countsRes.error.message}`);

    // Agregar Meta Ads por empreendimento
    const metaMap = new Map<string, { impressions: number; clicks: number; leads: number; spend: number }>();
    for (const row of metaRes.data || []) {
      const key = row.empreendimento;
      const cur = metaMap.get(key) || { impressions: 0, clicks: 0, leads: 0, spend: 0 };
      cur.impressions += row.impressions || 0;
      cur.clicks += row.clicks || 0;
      cur.leads += row.leads || 0;
      cur.spend += Number(row.spend) || 0;
      metaMap.set(key, cur);
    }

    // Agregar Pipedrive counts por tab/empreendimento
    const countsMap = new Map<string, Record<string, number>>();
    for (const row of countsRes.data || []) {
      const key = row.empreendimento;
      if (!countsMap.has(key)) countsMap.set(key, { mql: 0, sql: 0, opp: 0, won: 0 });
      const cur = countsMap.get(key)!;
      cur[row.tab] = (cur[row.tab] || 0) + (row.count || 0);
    }

    // Build por squad
    const squads: FunilSquad[] = SQUADS.map((sq) => {
      const empRows: FunilEmpreendimento[] = sq.empreendimentos.map((emp) => {
        const meta = metaMap.get(emp) || { impressions: 0, clicks: 0, leads: 0, spend: 0 };
        const counts = countsMap.get(emp) || { mql: 0, sql: 0, opp: 0, won: 0 };
        return buildFunil(
          emp,
          meta.impressions,
          meta.clicks,
          meta.leads,
          counts.mql,
          counts.sql,
          counts.opp,
          counts.won,
          meta.spend,
        );
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
