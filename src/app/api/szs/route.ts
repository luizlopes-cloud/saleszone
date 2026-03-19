// SZS (Serviços) module — canal_group > cidade hierarchy
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getModuleConfig } from "@/lib/modules";
import { NUM_DAYS } from "@/lib/constants";
import { generateDates } from "@/lib/dates";
import type { TabKey, AcompanhamentoData, SquadData, MetaInfo } from "@/lib/types";

const mc = getModuleConfig("szs");

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

const TABS: TabKey[] = ["mql", "sql", "opp", "won"];

export const dynamic = "force-dynamic";

// Paginated fetch helper (Supabase 1000-row limit)
async function fetchAllPaginated(query: any): Promise<any[]> {
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
  const tab = (req.nextUrl.searchParams.get("tab") as TabKey) || "mql";
  const filterParam = req.nextUrl.searchParams.get("filter");
  const paidOnly = filterParam === "paid";

  try {
    const dates = generateDates();
    const startDate = dates[dates.length - 1].date;
    const endDate = dates[0].date;

    // Fetch daily counts with canal_group
    const countsPromise = supabase
      .from("szs_daily_counts")
      .select("date, empreendimento, canal_group, count")
      .eq("tab", tab)
      .gte("date", startDate)
      .lte("date", endDate);

    // Se paidOnly, buscar também MQL counts + Meta Ads leads para calcular ratio
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const mqlPromise = paidOnly && tab !== "mql"
      ? supabase
          .from("szs_daily_counts")
          .select("date, empreendimento, canal_group, count")
          .eq("tab", "mql")
          .gte("date", monthStart)
          .lte("date", endDate)
      : null;

    const metaPromise = paidOnly
      ? supabase
          .from("szs_meta_ads")
          .select("ad_id, empreendimento, leads_month")
          .gte("snapshot_date", monthStart)
      : null;

    const [countsRes, mqlRes, metaRes] = await Promise.all([
      countsPromise,
      mqlPromise,
      metaPromise,
    ]);

    if (countsRes.error) throw new Error(`Supabase error: ${countsRes.error.message}`);
    const rows = countsRes.data || [];

    // Calcular ratios paid por cidade (Meta Ads is city-level, only for Marketing canal)
    let paidRatiosByCity: Map<string, number> | null = null;
    if (paidOnly) {
      const adMaxLeads = new Map<string, { empreendimento: string; leads: number }>();
      if (metaRes?.data) {
        for (const row of metaRes.data) {
          const cur = adMaxLeads.get(row.ad_id);
          const leads = row.leads_month || 0;
          if (!cur || leads > cur.leads) {
            adMaxLeads.set(row.ad_id, { empreendimento: row.empreendimento, leads });
          }
        }
      }
      const metaLeads = new Map<string, number>();
      for (const ad of adMaxLeads.values()) {
        const cur = metaLeads.get(ad.empreendimento) || 0;
        metaLeads.set(ad.empreendimento, cur + ad.leads);
      }
      // MQL totais do mês por cidade (only Marketing canal)
      const mqlTotals = new Map<string, number>();
      if (tab === "mql") {
        for (const row of rows) {
          if (row.date >= monthStart && (row.canal_group === "Marketing" || !row.canal_group)) {
            const cidade = row.empreendimento;
            const cur = mqlTotals.get(cidade) || 0;
            mqlTotals.set(cidade, cur + (row.count || 0));
          }
        }
      } else if (mqlRes?.data) {
        for (const row of mqlRes.data) {
          if (row.canal_group === "Marketing" || !row.canal_group) {
            const cidade = row.empreendimento;
            const cur = mqlTotals.get(cidade) || 0;
            mqlTotals.set(cidade, cur + (row.count || 0));
          }
        }
      }

      paidRatiosByCity = new Map();
      const allCidadesPaid = new Set([...mqlTotals.keys(), ...metaLeads.keys()]);
      for (const cidade of allCidadesPaid) {
        const mql = mqlTotals.get(cidade) || 0;
        const meta = metaLeads.get(cidade) || 0;
        if (mql > 0) {
          paidRatiosByCity.set(cidade, Math.min(meta, mql) / mql);
        } else {
          paidRatiosByCity.set(cidade, meta > 0 ? 1 : 0);
        }
      }
    }

    // Build date index
    const dateIndex = new Map(dates.map((d, i) => [d.date, i]));

    // Build counts per canal_group|cidade
    const groupCidadeCounts = new Map<string, number[]>();
    for (const row of rows) {
      const idx = dateIndex.get(row.date);
      if (idx === undefined) continue;
      const canalGroup = row.canal_group || "Outros";
      const cidade = row.empreendimento;
      const gKey = `${canalGroup}|${cidade}`;
      if (!groupCidadeCounts.has(gKey)) {
        groupCidadeCounts.set(gKey, new Array(NUM_DAYS).fill(0));
      }
      groupCidadeCounts.get(gKey)![idx] += row.count;
    }

    // Build squads: each canal_group = one squad, cidades = empreendimento rows
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    const curMonthKey = `${year}-${String(month).padStart(2, "0")}`;

    const squads: SquadData[] = CANAL_GROUP_ORDER.map((canalGroup, idx) => {
      // Find all cidades for this canal group
      const cidadeKeys: string[] = [];
      for (const gKey of groupCidadeCounts.keys()) {
        if (gKey.startsWith(canalGroup + "|")) cidadeKeys.push(gKey);
      }

      const sqRows = cidadeKeys.map((gKey) => {
        const cidade = gKey.split("|")[1];
        let daily = groupCidadeCounts.get(gKey) || new Array(NUM_DAYS).fill(0);

        // Aplicar ratio paid se necessário (only for Marketing canal)
        if (paidRatiosByCity && canalGroup === "Marketing") {
          const ratio = paidRatiosByCity.get(cidade) ?? 0;
          daily = daily.map((v) => Math.round(v * ratio));
        } else if (paidOnly && canalGroup !== "Marketing") {
          // Non-Marketing canals have no paid data — zero out in paid mode
          daily = new Array(NUM_DAYS).fill(0);
        }

        let totalMes = 0;
        daily.forEach((v, i) => {
          if (dates[i] && dates[i].date >= monthStart) totalMes += v;
        });
        return { emp: cidade, daily, totalMes };
      });

      // Sort cidades by totalMes desc
      sqRows.sort((a, b) => b.totalMes - a.totalMes);

      // Meta from hardcoded SZS_METAS_WON
      const monthMetas = SZS_METAS_WON[curMonthKey] || {};
      const metaWon = monthMetas[canalGroup] || 0;

      // Calculate metaToDate based on tab
      // For "won" tab, use the meta directly proportional to day
      // For other tabs, use 90d ratio approach
      let metaToDate = 0;
      if (tab === "won") {
        metaToDate = (day / totalDaysInMonth) * metaWon;
      }
      // For other tabs, metaToDate will be computed below with 90d ratios

      return {
        id: idx + 1,
        name: canalGroup,
        marketing: "",
        preVenda: "",
        venda: "",
        rows: sqRows,
        metaToDate,
      };
    });

    // Calculate metas for non-won tabs using 90d ratios
    if (tab !== "won") {
      const start90 = new Date(now);
      start90.setDate(start90.getDate() - 90);
      const startDate90 = start90.toISOString().substring(0, 10);

      const counts90Data = await fetchAllPaginated(
        supabase
          .from("szs_daily_counts")
          .select("tab, empreendimento, canal_group, count")
          .gte("date", startDate90)
          .lte("date", endDate)
      );

      // Build 90d counts per canal_group
      const groupCounts90 = new Map<string, Record<string, number>>();
      for (const r of counts90Data) {
        const cg = r.canal_group || "Outros";
        if (!groupCounts90.has(cg)) groupCounts90.set(cg, { mql: 0, sql: 0, opp: 0, won: 0 });
        const c = groupCounts90.get(cg)!;
        if (r.tab in c) c[r.tab] += r.count || 0;
      }

      for (const sq of squads) {
        const c = groupCounts90.get(sq.name) || { mql: 0, sql: 0, opp: 0, won: 0 };
        const monthMetas = SZS_METAS_WON[curMonthKey] || {};
        const metaWon = monthMetas[sq.name] || 0;

        const ratios = {
          opp_won: c.won > 0 ? c.opp / c.won : 0,
          sql_opp: c.opp > 0 ? c.sql / c.opp : 0,
          mql_sql: c.sql > 0 ? c.mql / c.sql : 0,
        };
        const metaMap: Record<TabKey, number> = {
          won: (day / totalDaysInMonth) * metaWon,
          opp: (day / totalDaysInMonth) * ratios.opp_won * metaWon,
          sql: (day / totalDaysInMonth) * ratios.sql_opp * ratios.opp_won * metaWon,
          mql: (day / totalDaysInMonth) * ratios.mql_sql * ratios.sql_opp * ratios.opp_won * metaWon,
        };
        sq.metaToDate = metaMap[tab] || 0;
      }
    }

    // Grand totals
    const grandDaily = new Array(NUM_DAYS).fill(0);
    let grandTotal = 0;
    let grandMeta = 0;
    squads.forEach((sq) => {
      grandMeta += sq.metaToDate;
      sq.rows.forEach((r) => {
        grandTotal += r.totalMes;
        r.daily.forEach((v, i) => (grandDaily[i] += v));
      });
    });

    const result: AcompanhamentoData = {
      squads,
      dates,
      grand: { totalMes: grandTotal, metaToDate: grandMeta, daily: grandDaily },
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("SZS Dashboard API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
