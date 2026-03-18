// MKTP (Marketplace) module
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getModuleConfig } from "@/lib/modules";
import type { PlanejamentoData, PlanejamentoEmpRow, PlanejamentoMetrics } from "@/lib/types";

const mc = getModuleConfig("mktp");

export const dynamic = "force-dynamic";

function rate(num: number, den: number): number {
  return den > 0 ? Math.round((num / den) * 10000) / 10000 : 0;
}

function cost(spend: number, den: number): number {
  return den > 0 ? Math.round((spend / den) * 100) / 100 : 0;
}

function buildMetrics(leads: number, mql: number, sql: number, opp: number, won: number, spend: number): PlanejamentoMetrics {
  return {
    leads, mql, sql, opp, won, spend: Math.round(spend * 100) / 100,
    cpl: cost(spend, leads),
    cmql: cost(spend, mql),
    copp: cost(spend, opp),
    cpw: cost(spend, won),
    mqlToSql: rate(sql, mql),
    sqlToOpp: rate(opp, sql),
    oppToWon: rate(won, opp),
  };
}

function sumMetrics(rows: PlanejamentoMetrics[]): PlanejamentoMetrics {
  const leads = rows.reduce((s, r) => s + r.leads, 0);
  const mql = rows.reduce((s, r) => s + r.mql, 0);
  const sql = rows.reduce((s, r) => s + r.sql, 0);
  const opp = rows.reduce((s, r) => s + r.opp, 0);
  const won = rows.reduce((s, r) => s + r.won, 0);
  const spend = rows.reduce((s, r) => s + r.spend, 0);
  return buildMetrics(leads, mql, sql, opp, won, spend);
}

// Map empreendimento → squad id
const EMP_TO_SQUAD = new Map<string, number>();
for (const sq of mc.squads) {
  for (const emp of sq.empreendimentos) {
    EMP_TO_SQUAD.set(emp, sq.id);
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const daysBack = parseInt(searchParams.get("days") || "0", 10);

    const now = new Date();
    const curMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const startDate = `${curMonth}-01`;

    const metaCutoffDate = daysBack > 0
      ? new Date(now.getTime() - daysBack * 86400000).toISOString().substring(0, 10)
      : null;

    const rpcParams = daysBack !== 0
      ? { months_back: 12, days_back: daysBack }
      : { months_back: 12 };

    const histMetaQuery = supabase
      .from("mktp_meta_ads")
      .select("ad_id, empreendimento, leads_month, spend_month, snapshot_date")
      .lt("snapshot_date", startDate);
    if (metaCutoffDate) histMetaQuery.gte("snapshot_date", metaCutoffDate);

    const [countsRes, curMetaRes, histMetaRes] = await Promise.all([
      supabase.rpc("get_mktp_planejamento_counts", rpcParams),
      supabase
        .from("mktp_meta_ads")
        .select("ad_id, empreendimento, leads_month, spend_month")
        .gte("snapshot_date", startDate)
        .range(0, 49999),
      histMetaQuery.range(0, 49999),
    ]);

    if (countsRes.error) throw new Error(`RPC get_mktp_planejamento_counts: ${countsRes.error.message}`);
    if (curMetaRes.error) throw new Error(`Current Meta Ads: ${curMetaRes.error.message}`);
    if (histMetaRes.error) throw new Error(`Historical Meta Ads: ${histMetaRes.error.message}`);

    const curCounts = new Map<string, Record<string, number>>();
    const histByEmpMonth = new Map<string, Map<string, Record<string, number>>>();
    for (const row of countsRes.data || []) {
      if (row.month === curMonth) {
        curCounts.set(row.empreendimento, {
          mql: Number(row.mql) || 0,
          sql: Number(row.sql) || 0,
          opp: Number(row.opp) || 0,
          won: Number(row.won) || 0,
        });
      } else {
        if (!histByEmpMonth.has(row.empreendimento)) histByEmpMonth.set(row.empreendimento, new Map());
        histByEmpMonth.get(row.empreendimento)!.set(row.month, {
          mql: Number(row.mql) || 0,
          sql: Number(row.sql) || 0,
          opp: Number(row.opp) || 0,
          won: Number(row.won) || 0,
        });
      }
    }
    const histCounts = new Map<string, Record<string, number>>();
    for (const [emp, monthMap] of histByEmpMonth) {
      const total: Record<string, number> = { mql: 0, sql: 0, opp: 0, won: 0 };
      for (const counts of monthMap.values()) {
        for (const tab of ["mql", "sql", "opp", "won"]) total[tab] += counts[tab] || 0;
      }
      histCounts.set(emp, total);
    }

    const curAdMax = new Map<string, { empreendimento: string; leads_month: number; spend_month: number }>();
    for (const row of curMetaRes.data || []) {
      const cur = curAdMax.get(row.ad_id);
      if (!cur || (Number(row.spend_month) || 0) > cur.spend_month) {
        curAdMax.set(row.ad_id, {
          empreendimento: row.empreendimento,
          leads_month: row.leads_month || 0,
          spend_month: Number(row.spend_month) || 0,
        });
      }
    }
    const curMeta = new Map<string, { leads: number; spend: number }>();
    for (const ad of curAdMax.values()) {
      const cur = curMeta.get(ad.empreendimento) || { leads: 0, spend: 0 };
      cur.leads += ad.leads_month;
      cur.spend += ad.spend_month;
      curMeta.set(ad.empreendimento, cur);
    }

    const histMetaEmpMonth = new Map<string, Map<string, { leads: number; spend: number }>>();
    for (const row of histMetaRes.data || []) {
      const month = (row.snapshot_date as string).substring(0, 7);
      const emp = row.empreendimento;
      const adMonthKey = `${row.ad_id}|${month}`;

      if (!histMetaEmpMonth.has(adMonthKey)) {
        histMetaEmpMonth.set(adMonthKey, new Map([[emp, { leads: row.leads_month || 0, spend: Number(row.spend_month) || 0 }]]));
      } else {
        const existing = histMetaEmpMonth.get(adMonthKey)!.get(emp);
        if (!existing || (Number(row.spend_month) || 0) > existing.spend) {
          histMetaEmpMonth.get(adMonthKey)!.set(emp, { leads: row.leads_month || 0, spend: Number(row.spend_month) || 0 });
        }
      }
    }
    const histMetaByEmp = new Map<string, { leads: number; spend: number }>();
    for (const [, empMap] of histMetaEmpMonth) {
      for (const [emp, vals] of empMap) {
        if (!histMetaByEmp.has(emp)) {
          histMetaByEmp.set(emp, { leads: 0, spend: 0 });
        }
        const agg = histMetaByEmp.get(emp)!;
        agg.leads += vals.leads;
        agg.spend += vals.spend;
      }
    }
    const histMeta = new Map<string, { leads: number; spend: number }>();
    for (const [emp, agg] of histMetaByEmp) {
      histMeta.set(emp, {
        leads: agg.leads,
        spend: Math.round(agg.spend * 100) / 100,
      });
    }

    const allEmps = new Set<string>();
    for (const sq of mc.squads) for (const emp of sq.empreendimentos) allEmps.add(emp);
    for (const emp of curCounts.keys()) allEmps.add(emp);
    for (const emp of histCounts.keys()) allEmps.add(emp);
    for (const emp of curMeta.keys()) allEmps.add(emp);
    for (const emp of histMeta.keys()) allEmps.add(emp);

    const empRows: PlanejamentoEmpRow[] = [];
    for (const emp of allEmps) {
      const squadId = EMP_TO_SQUAD.get(emp) || 0;
      const cc = curCounts.get(emp) || { mql: 0, sql: 0, opp: 0, won: 0 };
      const cm = curMeta.get(emp) || { leads: 0, spend: 0 };
      const hc = histCounts.get(emp) || { mql: 0, sql: 0, opp: 0, won: 0 };
      const hm = histMeta.get(emp) || { leads: 0, spend: 0 };

      const current = buildMetrics(cm.leads, cc.mql, cc.sql, cc.opp, cc.won, cm.spend);
      const historical = buildMetrics(hm.leads, hc.mql, hc.sql, hc.opp, hc.won, hm.spend);

      let efficiency: "high" | "medium" | "low" = "medium";
      if (current.won > 0 && current.cpw > 0) {
        const cpwBetter = historical.cpw > 0 && current.cpw <= historical.cpw;
        const convBetter = historical.oppToWon > 0 && current.oppToWon >= historical.oppToWon;
        if (cpwBetter && convBetter) efficiency = "high";
        else if (!cpwBetter && !convBetter) efficiency = "low";
      } else if (current.opp > 0) {
        efficiency = "medium";
      } else if (current.mql > 0 && current.sql === 0) {
        efficiency = "low";
      }

      empRows.push({ emp, squadId, current, historical, efficiency });
    }

    empRows.sort((a, b) => a.squadId - b.squadId || a.emp.localeCompare(b.emp));

    const result: PlanejamentoData = {
      month: curMonth,
      empreendimentos: empRows,
      totals: {
        current: sumMetrics(empRows.map((r) => r.current)),
        historical: sumMetrics(empRows.map((r) => r.historical)),
      },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("MKTP Planejamento error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
