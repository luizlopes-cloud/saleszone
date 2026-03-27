// SZS (Serviços) module
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { HistoricoAdRow, HistoricoCampanhasData } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, anonKey);

    // Paginar RPC get_szs_historico_campanhas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const historicoData: any[] = [];
    let offset = 0;
    while (true) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (supabase.rpc as any)("get_szs_historico_campanhas").range(offset, offset + 999);
      if (error) throw new Error(`RPC error: ${error.message}`);
      if (!data || data.length === 0) break;
      historicoData.push(...data);
      if (data.length < 1000) break;
      offset += 1000;
    }

    // Buscar funil + snapshot mais recente em paralelo
    const [funnelRes, latestSnapshotRes] = await Promise.all([
      supabase.rpc("get_szs_planejamento_counts", { p_months_back: 0, p_days_back: -1 }),
      supabase
        .from("szs_meta_ads")
        .select("snapshot_date")
        .order("snapshot_date", { ascending: false })
        .limit(1),
    ]);

    if (funnelRes.error) console.warn(`Funnel RPC error (non-fatal): ${funnelRes.error.message}`);

    // Buscar ad_ids ativos no snapshot mais recente
    const activeAdIds = new Set<string>();
    const latestDate = latestSnapshotRes.data?.[0]?.snapshot_date;
    if (latestDate) {
      const { data: activeAds } = await supabase
        .from("szs_meta_ads")
        .select("ad_id")
        .eq("snapshot_date", latestDate)
        .eq("effective_status", "ACTIVE");
      for (const row of activeAds || []) {
        activeAdIds.add(row.ad_id);
      }
    }

    // Agregar funil por empreendimento
    const empFunnel = new Map<string, { mql: number; sql: number; opp: number; won: number }>();
    for (const row of funnelRes.data || []) {
      const emp = row.empreendimento;
      const cur = empFunnel.get(emp) || { mql: 0, sql: 0, opp: 0, won: 0 };
      cur.mql += Number(row.mql) || 0;
      cur.sql += Number(row.sql) || 0;
      cur.opp += Number(row.opp) || 0;
      cur.won += Number(row.won) || 0;
      empFunnel.set(emp, cur);
    }

    // Calcular spend total por empreendimento
    const empSpend = new Map<string, number>();
    for (const row of historicoData) {
      const emp = row.empreendimento || "";
      const spend = Number(row.spend) || 0;
      empSpend.set(emp, (empSpend.get(emp) || 0) + spend);
    }

    const ads: HistoricoAdRow[] = [];
    for (const row of historicoData) {
      const spend = Number(row.spend) || 0;
      const leads = Number(row.leads) || 0;
      const impressions = Number(row.impressions) || 0;
      const clicks = Number(row.clicks) || 0;
      const emp = row.empreendimento || "";

      const funnel = empFunnel.get(emp);
      const totalEmpSpend = empSpend.get(emp) || 0;
      const spendShare = totalEmpSpend > 0 ? spend / totalEmpSpend : 0;
      const mql = funnel ? Math.round(funnel.mql * spendShare) : 0;
      const sql = funnel ? Math.round(funnel.sql * spendShare) : 0;
      const opp = funnel ? Math.round(funnel.opp * spendShare) : 0;
      const won = funnel ? Math.round(funnel.won * spendShare) : 0;

      ads.push({
        adId: row.ad_id,
        adName: row.ad_name || "",
        adsetName: row.adset_name || "",
        campaignName: row.campaign_name || "",
        empreendimento: emp,
        effectiveStatus: activeAdIds.has(row.ad_id) ? "ACTIVE" : "PAUSED",
        spend,
        leads,
        mql,
        sql,
        opp,
        won,
        impressions,
        clicks,
        cpl: leads > 0 ? Math.round((spend / leads) * 100) / 100 : 0,
        cmql: mql > 0 ? Math.round((spend / mql) * 100) / 100 : 0,
        csql: sql > 0 ? Math.round((spend / sql) * 100) / 100 : 0,
        copp: opp > 0 ? Math.round((spend / opp) * 100) / 100 : 0,
        cpw: won > 0 ? Math.round((spend / won) * 100) / 100 : 0,
        ctr: impressions > 0 ? Math.round((clicks / impressions) * 10000) / 100 : 0,
        cpc: clicks > 0 ? Math.round((spend / clicks) * 100) / 100 : 0,
        cpm: impressions > 0 ? Math.round((spend / impressions) * 100000) / 100 : 0,
        lastSeenDate: row.last_seen_date || "",
      });
    }

    const result: HistoricoCampanhasData = { ads };
    return NextResponse.json(result);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("SZS Historico campanhas error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
