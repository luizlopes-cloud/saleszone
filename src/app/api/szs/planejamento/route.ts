// SZS (Serviços) module
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getModuleConfig } from "@/lib/modules";
import { getSquadIdFromCanalGroup } from "@/lib/szs-utils";
import { paginate } from "@/lib/paginate";
import type { PlanejamentoData, PlanejamentoEmpRow, PlanejamentoMetrics } from "@/lib/types";

const mc = getModuleConfig("szs");

export const dynamic = "force-dynamic";

function getCidadeGroup(cidade: string): string {
  const lower = cidade.toLowerCase();
  if (lower.includes("são paulo") || lower.includes("sao paulo")) return "São Paulo";
  if (lower.includes("salvador")) return "Salvador";
  if (lower.includes("florianópolis") || lower.includes("florianopolis")) return "Florianópolis";
  return "Outros";
}

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

// SZS: all planejamento data is Marketing canal (is_marketing=true, rd_source paga)
// Squad assignment uses canal-based mapping; Marketing = squad 1
const MARKETING_SQUAD_ID = getSquadIdFromCanalGroup("Marketing");

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
      ? { p_months_back: 12, p_days_back: daysBack }
      : { p_months_back: 12, p_days_back: 0 };

    const histMetaQuery = supabase
      .from("szs_meta_ads")
      .select("ad_id, empreendimento, leads_month, spend_month, snapshot_date")
      .lt("snapshot_date", startDate);
    if (metaCutoffDate) histMetaQuery.gte("snapshot_date", metaCutoffDate);

    const [countsRes, curMetaData, histMetaData] = await Promise.all([
      supabase.rpc("get_szs_planejamento_counts", rpcParams),
      paginate((o, ps) =>
        supabase
          .from("szs_meta_ads")
          .select("ad_id, empreendimento, leads_month, spend_month")
          .gte("snapshot_date", startDate)
          .range(o, o + ps - 1),
      ),
      paginate((o, ps) => histMetaQuery.range(o, o + ps - 1)),
    ]);

    if (countsRes.error) throw new Error(`RPC get_szs_planejamento_counts: ${countsRes.error.message}`);

    const curCounts = new Map<string, Record<string, number>>();
    const histCounts = new Map<string, Record<string, number>>();
    for (const row of countsRes.data || []) {
      const group = getCidadeGroup(row.empreendimento);
      if (row.month === curMonth) {
        if (!curCounts.has(group)) curCounts.set(group, { mql: 0, sql: 0, opp: 0, won: 0 });
        const c = curCounts.get(group)!;
        c.mql += Number(row.mql) || 0;
        c.sql += Number(row.sql) || 0;
        c.opp += Number(row.opp) || 0;
        c.won += Number(row.won) || 0;
      } else {
        if (!histCounts.has(group)) histCounts.set(group, { mql: 0, sql: 0, opp: 0, won: 0 });
        const c = histCounts.get(group)!;
        c.mql += Number(row.mql) || 0;
        c.sql += Number(row.sql) || 0;
        c.opp += Number(row.opp) || 0;
        c.won += Number(row.won) || 0;
      }
    }

    const curAdMax = new Map<string, { empreendimento: string; leads_month: number; spend_month: number }>();
    for (const row of curMetaData) {
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
      const group = getCidadeGroup(ad.empreendimento);
      const cur = curMeta.get(group) || { leads: 0, spend: 0 };
      cur.leads += ad.leads_month;
      cur.spend += ad.spend_month;
      curMeta.set(group, cur);
    }

    const histMetaEmpMonth = new Map<string, Map<string, { leads: number; spend: number }>>();
    for (const row of histMetaData) {
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
        const group = getCidadeGroup(emp);
        if (!histMetaByEmp.has(group)) {
          histMetaByEmp.set(group, { leads: 0, spend: 0 });
        }
        const agg = histMetaByEmp.get(group)!;
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

    // SZS: discover cities dynamically from the data
    const allEmps = new Set<string>();
    for (const emp of curCounts.keys()) allEmps.add(emp);
    for (const emp of histCounts.keys()) allEmps.add(emp);
    for (const emp of curMeta.keys()) allEmps.add(emp);
    for (const emp of histMeta.keys()) allEmps.add(emp);

    const empRows: PlanejamentoEmpRow[] = [];
    for (const emp of allEmps) {
      const squadId = MARKETING_SQUAD_ID;
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
    console.error("SZS Planejamento error:", error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}
