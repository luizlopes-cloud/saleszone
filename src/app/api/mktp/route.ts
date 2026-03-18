// MKTP (Marketplace) module
import { NextRequest, NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { getModuleConfig } from "@/lib/modules";
import { NUM_DAYS } from "@/lib/constants";
import { generateDates } from "@/lib/dates";
import type { TabKey, AcompanhamentoData, SquadData, MetaInfo } from "@/lib/types";

const mc = getModuleConfig("mktp");

const SQUAD_CLOSERS: Record<number, number> = {};
for (const [sqId, indices] of Object.entries(mc.squadCloserMap)) {
  SQUAD_CLOSERS[Number(sqId)] = indices.length;
}
const TOTAL_CLOSERS = Object.values(SQUAD_CLOSERS).reduce((a, b) => a + b, 0) || 1;
const TABS: TabKey[] = ["mql", "sql", "opp", "won"];

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const tab = (req.nextUrl.searchParams.get("tab") as TabKey) || "mql";
  const filterParam = req.nextUrl.searchParams.get("filter");
  const paidOnly = filterParam === "paid";

  try {
    const dates = generateDates();
    const startDate = dates[dates.length - 1].date;
    const endDate = dates[0].date;

    // Fetch daily counts from Supabase
    const countsPromise = supabase
      .from("mktp_daily_counts")
      .select("date, empreendimento, count")
      .eq("tab", tab)
      .gte("date", startDate)
      .lte("date", endDate);

    // Se paidOnly, buscar também MQL counts + Meta Ads leads para calcular ratio
    const now = new Date();
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;

    const mqlPromise = paidOnly && tab !== "mql"
      ? supabase
          .from("mktp_daily_counts")
          .select("date, empreendimento, count")
          .eq("tab", "mql")
          .gte("date", monthStart)
          .lte("date", endDate)
      : null;

    const metaPromise = paidOnly
      ? supabase
          .from("mktp_meta_ads")
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

    // Calcular ratios paid por empreendimento
    let paidRatios: Map<string, number> | null = null;
    if (paidOnly) {
      // Meta Ads leads por empreendimento (max leads_month por ad em todos os snapshots do mês)
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
      // MQL totais do mês por empreendimento
      const mqlTotals = new Map<string, number>();
      if (tab === "mql") {
        // Para MQL, usar os próprios counts do mês
        for (const row of rows) {
          if (row.date >= monthStart) {
            const cur = mqlTotals.get(row.empreendimento) || 0;
            mqlTotals.set(row.empreendimento, cur + (row.count || 0));
          }
        }
      } else if (mqlRes?.data) {
        for (const row of mqlRes.data) {
          const cur = mqlTotals.get(row.empreendimento) || 0;
          mqlTotals.set(row.empreendimento, cur + (row.count || 0));
        }
      }

      // ratio = min(mql, metaLeads) / mql — mesma lógica de funil/campanhas
      paidRatios = new Map();
      const allEmps = new Set([...mqlTotals.keys(), ...metaLeads.keys()]);
      for (const emp of allEmps) {
        const mql = mqlTotals.get(emp) || 0;
        const meta = metaLeads.get(emp) || 0;
        if (mql > 0) {
          paidRatios.set(emp, Math.min(meta, mql) / mql);
        } else {
          paidRatios.set(emp, meta > 0 ? 1 : 0);
        }
      }
    }

    // Build date index
    const dateIndex = new Map(dates.map((d, i) => [d.date, i]));

    // Build counts per empreendimento
    const empCounts = new Map<string, number[]>();
    for (const row of rows) {
      const idx = dateIndex.get(row.date);
      if (idx === undefined) continue;
      if (!empCounts.has(row.empreendimento)) {
        empCounts.set(row.empreendimento, new Array(NUM_DAYS).fill(0));
      }
      empCounts.get(row.empreendimento)![idx] += row.count;
    }

    // Map to squads
    const squads: SquadData[] = mc.squads.map((sq) => {
      const sqRows = sq.empreendimentos.map((emp) => {
        let daily = empCounts.get(emp) || new Array(NUM_DAYS).fill(0);

        // Aplicar ratio paid se necessário
        if (paidRatios) {
          const ratio = paidRatios.get(emp) ?? 0;
          daily = daily.map((v) => Math.round(v * ratio));
        }

        // totalMes = sum of days in current month only
        let totalMes = 0;
        daily.forEach((v, i) => {
          if (dates[i] && dates[i].date >= monthStart) totalMes += v;
        });
        return { emp, daily, totalMes };
      });
      return {
        id: sq.id,
        name: sq.name,
        marketing: sq.marketing,
        preVenda: sq.preVenda,
        venda: sq.venda,
        rows: sqRows,
        metaToDate: 0,
      };
    });

    // Calculate metas in real-time with per-squad ratios (90d counts by empreendimento)
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const day = now.getDate();
    const totalDaysInMonth = new Date(year, month, 0).getDate();
    // TODO: MKTP may have a different metas source than nekt_meta26_metas
    const metaDateStr = `01/${String(month).padStart(2, "0")}/${year}`;

    const start90 = new Date(now);
    start90.setDate(start90.getDate() - 90);
    const startDate90 = start90.toISOString().substring(0, 10);

    const [nektRes, counts90Res] = await Promise.all([
      // TODO: MKTP may need a different RPC or metas table
      supabase.rpc("get_mktp_meta", { meta_date: metaDateStr }).single(),
      supabase.from("mktp_daily_counts").select("tab, empreendimento, count").gte("date", startDate90).lte("date", endDate),
    ]);

    let metaInfo: MetaInfo | undefined;
    const nektData = nektRes.data as { won_mktp_meta_pago: number; won_mktp_meta_direto: number } | null;
    if (nektData) {
      const wonMetaTotal = (Number(nektData.won_mktp_meta_pago) || 0) + (Number(nektData.won_mktp_meta_direto) || 0);
      const wonPerCloser = wonMetaTotal / TOTAL_CLOSERS;

      // Build per-squad 90d counts
      const squadEmpSets = new Map<number, Set<string>>();
      for (const sq of mc.squads) {
        squadEmpSets.set(sq.id, new Set(sq.empreendimentos as unknown as string[]));
      }

      const squadCounts = new Map<number, Record<string, number>>();
      for (const sq of mc.squads) {
        squadCounts.set(sq.id, { mql: 0, sql: 0, opp: 0, won: 0 });
      }
      for (const r of counts90Res.data || []) {
        for (const sq of mc.squads) {
          if (squadEmpSets.get(sq.id)!.has(r.empreendimento)) {
            const c = squadCounts.get(sq.id)!;
            if (r.tab in c) c[r.tab] += r.count || 0;
          }
        }
      }

      const metaInfoSquads: MetaInfo["squads"] = [];
      for (const sq of squads) {
        const closers = SQUAD_CLOSERS[sq.id] || 1;
        const wonMetaSquad = wonPerCloser * closers;
        const c = squadCounts.get(sq.id)!;
        const ratios = {
          opp_won: c.won > 0 ? c.opp / c.won : 0,
          sql_opp: c.opp > 0 ? c.sql / c.opp : 0,
          mql_sql: c.sql > 0 ? c.mql / c.sql : 0,
        };
        const metaMap: Record<TabKey, number> = {
          won: (day / totalDaysInMonth) * wonMetaSquad,
          opp: (day / totalDaysInMonth) * ratios.opp_won * wonMetaSquad,
          sql: (day / totalDaysInMonth) * ratios.sql_opp * ratios.opp_won * wonMetaSquad,
          mql: (day / totalDaysInMonth) * ratios.mql_sql * ratios.sql_opp * ratios.opp_won * wonMetaSquad,
        };
        sq.metaToDate = metaMap[tab] || 0;
        metaInfoSquads.push({
          id: sq.id,
          closers,
          counts90d: { mql: c.mql, sql: c.sql, opp: c.opp, won: c.won },
          ratios: { mql_sql: Math.round(ratios.mql_sql * 100) / 100, sql_opp: Math.round(ratios.sql_opp * 100) / 100, opp_won: Math.round(ratios.opp_won * 100) / 100 },
        });
      }
      metaInfo = { wonMetaTotal, wonPerCloser, day, totalDaysInMonth, squads: metaInfoSquads };
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
      metaInfo,
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error("MKTP Dashboard API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
