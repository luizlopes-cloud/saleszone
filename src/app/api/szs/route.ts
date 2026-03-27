// SZS (Serviços) module — canal_group > cidade hierarchy
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { getModuleConfig } from "@/lib/modules";
import { NUM_DAYS } from "@/lib/constants";
import { generateDates } from "@/lib/dates";
import type { TabKey, AcompanhamentoData, SquadData, MetaInfo } from "@/lib/types";

const mc = getModuleConfig("szs");

// Canais excluídos do VD (Vendas Diretas)
const VD_EXCLUDED = ["582", "583", "2876", "1748"]; // Corretor, Franquia, Outros Parceiros, Expansão

// Canal groups for display
const CANAL_GROUP_FROM_ID: Record<string, string> = {
  "12": "Marketing", "582": "Parceiros", "583": "Parceiros", "2876": "Parceiros",
  "1748": "Expansão", "4551": "Mônica", "3189": "Spots",
};

// Stage date columns
const STAGE_DATE_COL: Record<TabKey, string> = {
  mql: "add_time", sql: "qualificacao_date", opp: "reuniao_date", won: "won_time",
};

// Agrupar cidades em 4 grupos
function getCidadeGroup(cidade: string): string {
  const lower = cidade.toLowerCase();
  if (lower.includes("são paulo") || lower.includes("sao paulo")) return "São Paulo";
  if (lower.includes("salvador")) return "Salvador";
  if (lower.includes("florianópolis") || lower.includes("florianopolis")) return "Florianópolis";
  return "Outros";
}

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function paginateQuery(buildQuery: (offset: number, ps: number) => any): Promise<any[]> {
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

export async function GET(req: NextRequest) {
  const tab = (req.nextUrl.searchParams.get("tab") as TabKey) || "mql";
  const filterParam = req.nextUrl.searchParams.get("filter");
  // filter: "vd" | "expansao" | "marketing" | "paid" | null (geral)
  const paidOnly = filterParam === "paid";
  const useDealsFilter = filterParam === "vd" || filterParam === "expansao" || filterParam === "marketing" || filterParam === "paid";

  try {
    const dates = generateDates();
    const startDate = dates[dates.length - 1].date;
    const endDate = dates[0].date;

    // Fetch daily counts with canal_group — paginated (can exceed 1000 rows)
    async function fetchPaginatedCounts(tableName: string, tabFilter: string, dateFrom: string, dateTo: string) {
      const all: Array<{ date: string; empreendimento: string; canal_group: string; count: number }> = [];
      let offset = 0;
      const PAGE = 1000;
      while (true) {
        const { data, error } = await supabase
          .from(tableName)
          .select("date, empreendimento, canal_group, count")
          .eq("tab", tabFilter)
          .gte("date", dateFrom)
          .lte("date", dateTo)
          .range(offset, offset + PAGE - 1);
        if (error) throw new Error(`${tableName} error: ${error.message}`);
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < PAGE) break;
        offset += PAGE;
      }
      return all;
    }

    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    // Geral mode: fetch from szs_daily_counts
    const rows = !useDealsFilter
      ? await fetchPaginatedCounts("szs_daily_counts", tab, startDate, endDate)
      : [];

    // Build date index
    const dateIndex = new Map(dates.map((d, i) => [d.date, i]));

    // Build counts per canal_group|cidade
    const groupCidadeCounts = new Map<string, number[]>();

    if (useDealsFilter) {
      // Filtered modes: use szs_deals directly
      const admin = createSquadSupabaseAdmin();
      const dateCol = STAGE_DATE_COL[tab] || "add_time";
      const isWon = tab === "won";

      const deals = await paginateQuery((o, ps) => {
        let q = admin
          .from("szs_deals")
          .select(`empreendimento, canal, ${dateCol}, max_stage_order, status, lost_reason, rd_source`)
          .not("empreendimento", "is", null)
          .gte(dateCol, startDate);

        if (isWon) q = q.eq("status", "won");

        if (filterParam === "paid") {
          q = q.eq("canal", "12").ilike("rd_source", "%pag%");
        } else if (filterParam === "marketing") {
          q = q.eq("canal", "12");
        } else if (filterParam === "expansao") {
          q = q.eq("canal", "1748");
        }
        // "vd": no canal filter in query, exclude in code

        return q.range(o, o + ps - 1);
      });

      for (const d of deals) {
        if (d.lost_reason === "Duplicado/Erro") continue;
        const canal = String(d.canal || "");

        if (filterParam === "vd" && VD_EXCLUDED.includes(canal)) continue;

        const canalGroup = CANAL_GROUP_FROM_ID[canal] || "Outros";
        const cidade = getCidadeGroup(d.empreendimento);
        const dateStr = (d[dateCol] || "").substring(0, 10);
        const idx = dateIndex.get(dateStr);
        if (idx === undefined) continue;

        const gKey = `${canalGroup}|${cidade}`;
        if (!groupCidadeCounts.has(gKey)) groupCidadeCounts.set(gKey, new Array(NUM_DAYS).fill(0));
        groupCidadeCounts.get(gKey)![idx] += 1;
      }
    } else {
      // Default (geral): use szs_daily_counts
      for (const row of rows) {
        const idx = dateIndex.get(row.date);
        if (idx === undefined) continue;
        const canalGroup = row.canal_group || "Outros";
        const cidade = getCidadeGroup(row.empreendimento);
        const gKey = `${canalGroup}|${cidade}`;
        if (!groupCidadeCounts.has(gKey)) {
          groupCidadeCounts.set(gKey, new Array(NUM_DAYS).fill(0));
        }
        groupCidadeCounts.get(gKey)![idx] += row.count;
      }
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
        const daily = groupCidadeCounts.get(gKey) || new Array(NUM_DAYS).fill(0);

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
