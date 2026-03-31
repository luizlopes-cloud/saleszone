import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { paginate } from "@/lib/paginate";
import type { GeralData, GeralChannelResult, GeralMetricPair } from "@/lib/types";

export const dynamic = "force-dynamic";

// Canal value → macro channel
// squad_deals.canal has mixed values: names ("Marketing") and IDs ("582")
const CANAL_MAP: Record<string, string> = {
  // By name
  "Marketing": "Vendas Diretas",
  // By ID and name — Parceiros
  "582": "Parceiros",
  "583": "Parceiros",
  "2876": "Parceiros",
  "Indicação de Corretor": "Parceiros",
  "Indicaçao de Franquia": "Parceiros",  // note: typo in data (no ~)
  "Indicação de outros Parceiros (exceto corretor e franquia)": "Parceiros",
};
function getMacroChannel(canal: string | null): string {
  if (!canal) return "Outros";
  return CANAL_MAP[canal] || "Outros";
}

const CHANNEL_ORDER = ["Geral", "Vendas Diretas", "Parceiros"] as const;

// Stage thresholds for squad_deals.max_stage_order (SZI pipeline 28)
const TH_MQL = 1;
const TH_SQL = 5;
const TH_OPP = 9;
const TH_RESERVA = 13;
const TH_CONTRATO = 14;

// Hardcoded metas for March 2026
interface ChannelMetas {
  orcamento?: number;
  leads?: number;
  mql: number;
  sql: number;
  opp: number;
  reserva?: number;
  contrato?: number;
  won: number;
}

const METAS_BY_MONTH: Record<string, Record<string, ChannelMetas>> = {
  "2026-03": {
    "Vendas Diretas": { orcamento: 232389, leads: 9661, mql: 2839, sql: 921, opp: 228, won: 40 },
    Parceiros: { mql: 1348, sql: 524, opp: 260, won: 55 },
    Geral: { mql: 4187, sql: 1445, opp: 488, reserva: 217, contrato: 125, won: 95 },
  },
};

function pair(real: number, meta: number): GeralMetricPair {
  return { real, meta };
}

export async function GET() {
  try {
    const admin = createSquadSupabaseAdmin();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const startDate = `${monthKey}-01`;

    const prevDate = new Date(year, month - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    const prevStart = `${prevKey}-01`;
    const prevEnd = `${prevKey}-${new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).getDate()}`;

    const cutoff90 = new Date(now);
    cutoff90.setDate(cutoff90.getDate() - 90);
    const cutoffDate = cutoff90.toISOString().substring(0, 10);

    // ── 1. Funnel counts from squad_daily_counts (TOTAL — no canal split) ──
    // This is the authoritative source for MQL/SQL/OPP/WON in SZI
    const countsRows = await paginate((o, ps) =>
      supabase
        .from("squad_daily_counts")
        .select("date, tab, count")
        .in("tab", ["mql", "sql", "opp", "won", "reserva", "contrato"])
        .gte("date", startDate)
        .range(o, o + ps - 1),
    );

    const totalCounts: Record<string, number> = {};
    for (const r of countsRows) {
      totalCounts[r.tab] = (totalCounts[r.tab] || 0) + (r.count || 0);
    }
    console.log(`[geral] squad_daily_counts total: mql=${totalCounts.mql || 0}, sql=${totalCounts.sql || 0}, opp=${totalCounts.opp || 0}, won=${totalCounts.won || 0}`);

    // ── 2. Canal split from squad_deals (MQL/SQL/OPP/WON by canal) ──
    // squad_deals has `canal` field for per-channel breakdown
    const deals = await paginate((o, ps) =>
      admin
        .from("squad_deals")
        .select("canal, max_stage_order, stage_order, status, lost_reason, won_time")
        .not("empreendimento", "is", null)
        .or(`status.eq.open,won_time.gte.${startDate},lost_time.gte.${startDate},add_time.gte.${startDate}`)
        .range(o, o + ps - 1),
    );
    console.log(`[geral] squad_deals returned ${deals.length} deals`);
    // Debug: check canal values
    const canalDistrib: Record<string, number> = {};
    for (const d of deals.slice(0, 500)) {
      const key = String(d.canal ?? "NULL");
      canalDistrib[key] = (canalDistrib[key] || 0) + 1;
    }
    console.log(`[geral] canal distribution (first 500):`, JSON.stringify(canalDistrib));

    // Count by macro channel
    const channelCounts: Record<string, Record<string, number>> = {};
    for (const ch of CHANNEL_ORDER) channelCounts[ch] = { mql: 0, sql: 0, opp: 0, won: 0, reserva: 0, contrato: 0 };

    for (const d of deals) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const macro = getMacroChannel(d.canal);
      const mso = d.max_stage_order ?? d.stage_order ?? 0;

      // Vendas Diretas and Parceiros get their own counts
      if (macro === "Vendas Diretas" || macro === "Parceiros") {
        if (mso >= TH_MQL) channelCounts[macro].mql++;
        if (mso >= TH_SQL) channelCounts[macro].sql++;
        if (mso >= TH_OPP) channelCounts[macro].opp++;
        if (mso >= TH_RESERVA) channelCounts[macro].reserva++;
        if (mso >= TH_CONTRATO) channelCounts[macro].contrato++;
        if (d.status === "won") channelCounts[macro].won++;
      }
    }
    console.log(`[geral] channelCounts VD: mql=${channelCounts["Vendas Diretas"].mql}, won=${channelCounts["Vendas Diretas"].won}`);
    console.log(`[geral] channelCounts Parceiros: mql=${channelCounts.Parceiros.mql}, won=${channelCounts.Parceiros.won}`);

    // Geral = from squad_daily_counts for MQL/SQL/OPP/WON, squad_deals for reserva/contrato (accumulated)
    // Reserva/contrato from daily_counts is snapshot (4/2), but accumulated from deals is much higher
    let geralReserva = 0, geralContrato = 0;
    for (const d of deals) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const mso = d.max_stage_order ?? d.stage_order ?? 0;
      if (mso >= TH_RESERVA) geralReserva++;
      if (mso >= TH_CONTRATO) geralContrato++;
    }
    channelCounts.Geral = {
      mql: totalCounts.mql || 0,
      sql: totalCounts.sql || 0,
      opp: totalCounts.opp || 0,
      won: totalCounts.won || 0,
      reserva: geralReserva,
      contrato: geralContrato,
    };

    // ── 3. Previous month WON ──
    const prevRows = await paginate((o, ps) =>
      supabase
        .from("squad_daily_counts")
        .select("count")
        .eq("tab", "won")
        .gte("date", prevStart)
        .lte("date", prevEnd)
        .range(o, o + ps - 1),
    );
    const prevTotalWon = prevRows.reduce((s, r) => s + (r.count || 0), 0);

    // Per-channel previous won from squad_deals
    const prevDeals = await paginate((o, ps) =>
      admin
        .from("squad_deals")
        .select("canal, status")
        .eq("status", "won")
        .gte("won_time", prevStart)
        .lte("won_time", prevEnd)
        .range(o, o + ps - 1),
    );
    const prevWon: Record<string, number> = { "Vendas Diretas": 0, Parceiros: 0, Geral: prevTotalWon };
    for (const d of prevDeals) {
      const macro = getMacroChannel(d.canal);
      if (macro === "Vendas Diretas" || macro === "Parceiros") prevWon[macro]++;
    }

    // ── 4. Meta Ads spend + leads (Vendas Diretas only) ──
    const metaRows = await paginate((o, ps) =>
      supabase
        .from("squad_meta_ads")
        .select("ad_id, spend_month, leads_month")
        .gte("snapshot_date", startDate)
        .range(o, o + ps - 1),
    );
    const adMax = new Map<string, { spend: number; leads: number }>();
    for (const r of metaRows) {
      const spend = Number(r.spend_month) || 0;
      const leads = Number(r.leads_month) || 0;
      const cur = adMax.get(r.ad_id);
      if (!cur || spend > cur.spend) adMax.set(r.ad_id, { spend, leads });
    }
    let totalSpend = 0, totalLeads = 0;
    for (const v of adMax.values()) { totalSpend += v.spend; totalLeads += v.leads; }

    // ── 5. Orçamento ──
    const { data: orcData } = await supabase
      .from("squad_orcamento")
      .select("orcamento_total")
      .eq("mes", monthKey)
      .maybeSingle();
    const orcamentoMeta = orcData?.orcamento_total || 0;

    // ── 6. Pipedrive real-time open deals ──
    let pipedriveToken = "";
    try {
      const { data: t } = await admin.rpc("vault_read_secret", { secret_name: "PIPEDRIVE_API_TOKEN" });
      pipedriveToken = (t || "").trim();
    } catch { /* fallback to squad_deals only */ }

    const pdOpenDeals: Array<{ canal: string; stage_id: number; owner_name: string }> = [];
    if (pipedriveToken) {
      let pdStart = 0;
      while (true) {
        const r = await fetch(`https://seazone-fd92b9.pipedrive.com/api/v1/pipelines/28/deals?api_token=${pipedriveToken}&start=${pdStart}&limit=500`);
        const j = await r.json();
        for (const d of j.data || []) {
          const canalField = d["3dda4dab93b3fb5b2a1ef80845a540dc20e8f1e0"] || d.canal || null;
          pdOpenDeals.push({ canal: String(canalField || ""), stage_id: d.stage_id, owner_name: d.owner_name || "" });
        }
        if (!j.additional_data?.pagination?.more_items_in_collection) break;
        pdStart += 500;
      }
    }
    console.log(`[geral] Pipedrive open deals: ${pdOpenDeals.length}`);

    // Snapshots: Reserva/Contrato from Pipedrive (real-time) or squad_deals (fallback)
    const snaps: Record<string, { reserva: number; contrato: number }> = {};
    for (const ch of CHANNEL_ORDER) snaps[ch] = { reserva: 0, contrato: 0 };

    if (pdOpenDeals.length > 0) {
      // Use Pipedrive real-time data — canal not available from /pipelines/ endpoint,
      // so count all into Geral only (VD/Parceiros breakdown from squad_deals fallback)
      for (const d of pdOpenDeals) {
        if (d.stage_id === 191) snaps.Geral.reserva++;
        if (d.stage_id === 192) snaps.Geral.contrato++;
      }
      // VD/Parceiros breakdown from squad_deals (approximate but has canal)
      const openStageDeals = await paginate((o, ps) =>
        admin.from("squad_deals").select("canal, stage_id").eq("status", "open").in("stage_id", [191, 192]).range(o, o + ps - 1),
      );
      for (const d of openStageDeals) {
        const macro = getMacroChannel(d.canal);
        if (macro === "Vendas Diretas") {
          if (d.stage_id === 191) snaps["Vendas Diretas"].reserva++;
          if (d.stage_id === 192) snaps["Vendas Diretas"].contrato++;
        } else if (macro === "Parceiros") {
          if (d.stage_id === 191) snaps.Parceiros.reserva++;
          if (d.stage_id === 192) snaps.Parceiros.contrato++;
        }
      }
    } else {
      // Fallback: squad_deals
      const openDeals = await paginate((o, ps) =>
        admin.from("squad_deals").select("canal, stage_id, status").eq("status", "open").in("stage_id", [191, 192]).range(o, o + ps - 1),
      );
      for (const d of openDeals) {
        const macro = getMacroChannel(d.canal);
        const target = (macro === "Vendas Diretas" || macro === "Parceiros") ? macro : "Geral";
        if (d.stage_id === 191) snaps[target].reserva++;
        if (d.stage_id === 192) snaps[target].contrato++;
        if (target !== "Geral") {
          if (d.stage_id === 191) snaps.Geral.reserva++;
          if (d.stage_id === 192) snaps.Geral.contrato++;
        }
      }
    }

    // ── 7. History — fetch open deals directly from Pipedrive for accurate "today" count ──
    // Then use squad_deals for historical snapshot (last 30 days)
    const cutoff30 = new Date(now);
    cutoff30.setDate(cutoff30.getDate() - 30);
    const cutoff30Str = cutoff30.toISOString().substring(0, 10);

    const histDeals = await paginate((o, ps) =>
      admin
        .from("squad_deals")
        .select("canal, max_stage_order, stage_order, status, lost_reason, add_time, won_time, lost_time, update_time")
        .not("empreendimento", "is", null)
        .or(`status.eq.open,won_time.gte.${cutoff30Str},lost_time.gte.${cutoff30Str}`)
        .range(o, o + ps - 1),
    );

    // Build date array for last 30 days
    const allHistDates: string[] = [];
    for (let i = 30; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      allHistDates.push(d.toISOString().substring(0, 10));
    }
    const dateIndex = new Map<string, number>();
    for (let i = 0; i < allHistDates.length; i++) dateIndex.set(allHistDates[i], i);
    const N = allHistDates.length;

    // Delta arrays per channel and stage
    const HIST_STAGES = ["mql", "sql", "opp"] as const;
    const HIST_STAGE_MIN: Record<string, number> = { mql: TH_MQL, sql: TH_SQL, opp: TH_OPP };
    const HIST_CHANNELS = ["Geral", "Vendas Diretas", "Parceiros"] as const;

    // delta[channel][stage][dateIdx] — +1 at add, -1 at close
    const delta: Record<string, Record<string, number[]>> = {};
    for (const ch of HIST_CHANNELS) {
      delta[ch] = {};
      for (const s of HIST_STAGES) delta[ch][s] = new Array(N + 1).fill(0);
      delta[ch]["total"] = new Array(N + 1).fill(0);
    }

    for (const d of histDeals) {
      if (d.lost_reason === "Duplicado/Erro") continue;
      const macro = getMacroChannel(d.canal);
      const mso = d.max_stage_order ?? d.stage_order ?? 0;
      const addDay = d.add_time?.substring(0, 10) || "";
      // Close day: won_time for won, lost_time (or update_time fallback) for lost
      const closeDay = d.status === "won" ? d.won_time?.substring(0, 10)
        : d.status === "lost" ? (d.lost_time || d.update_time || d.add_time)?.substring(0, 10)
        : null;

      // Determine addIdx: clamp to 0 if before window
      let addIdx = dateIndex.get(addDay) ?? (addDay < allHistDates[0] ? 0 : -1);
      if (addIdx < 0) continue; // add_time after last date — skip

      // Determine closeIdx: null if still open or close after last date
      let closeIdx: number | null = null;
      if (closeDay) {
        const ci = dateIndex.get(closeDay);
        if (ci !== undefined) closeIdx = ci;
        else if (closeDay < allHistDates[0]) continue; // closed before window — skip entirely
        // else: closed after window — treat as still open within window
      }

      const targets = (macro === "Vendas Diretas" || macro === "Parceiros") ? [macro, "Geral"] : ["Geral"];

      for (const ch of targets) {
        delta[ch]["total"][addIdx]++;
        if (closeIdx !== null) delta[ch]["total"][closeIdx]--;

        for (const s of HIST_STAGES) {
          if (mso >= HIST_STAGE_MIN[s]) {
            delta[ch][s][addIdx]++;
            if (closeIdx !== null) delta[ch][s][closeIdx]--;
          }
        }
      }
    }

    // Build cumulative per channel
    const channelHistory: Record<string, { date: string; total: number; openTotal: number; byStage: Record<string, number> }[]> = {};
    for (const ch of HIST_CHANNELS) {
      const arr: { date: string; total: number; openTotal: number; byStage: Record<string, number> }[] = [];
      const cum: Record<string, number> = { total: 0 };
      for (const s of HIST_STAGES) cum[s] = 0;
      for (let i = 0; i < N; i++) {
        cum["total"] += delta[ch]["total"][i];
        const byStage: Record<string, number> = {};
        for (const s of HIST_STAGES) {
          cum[s] += delta[ch][s][i];
          byStage[s] = cum[s];
        }
        arr.push({ date: allHistDates[i], total: cum["total"], openTotal: cum["total"], byStage });
      }
      channelHistory[ch] = arr;
    }

    // Override last data point with Pipedrive real-time data
    if (pdOpenDeals.length > 0) {
      // Stage order from stage_id (SZI pipeline 28)
      const PD_STAGE_ORDER: Record<number, number> = {
        392:1, 184:2, 186:3, 338:4, 346:5, 339:6, 187:7, 340:8, 208:9, 312:10, 313:11, 311:12, 191:13, 192:14,
      };

      for (const ch of HIST_CHANNELS) {
        const arr = channelHistory[ch];
        if (!arr || arr.length === 0) continue;

        let total = 0;
        const byStage: Record<string, number> = {};
        for (const s of HIST_STAGES) byStage[s] = 0;

        for (const d of pdOpenDeals) {
          const macro = getMacroChannel(d.canal);
          if (ch !== "Geral" && macro !== ch) continue;
          total++;
          const so = PD_STAGE_ORDER[d.stage_id] || 0;
          for (const s of HIST_STAGES) if (so >= HIST_STAGE_MIN[s]) byStage[s]++;
        }

        arr[arr.length - 1] = {
          date: arr[arr.length - 1].date,
          total,
          openTotal: total,
          byStage,
        };
      }
    }

    // ── Build channels ──
    const metas = METAS_BY_MONTH[monthKey] || {};

    const channels: GeralChannelResult[] = CHANNEL_ORDER.map((name) => {
      const counts = channelCounts[name];
      const meta = metas[name] || { mql: 0, sql: 0, opp: 0, won: 0 };
      const snap = snaps[name];

      const metrics: GeralChannelResult["metrics"] = {
        mql: pair(counts.mql, meta.mql),
        sql: pair(counts.sql, meta.sql),
        opp: pair(counts.opp, meta.opp),
        won: pair(counts.won, meta.won),
      };

      // Vendas Diretas: add orcamento + leads
      if (name === "Vendas Diretas") {
        metrics.orcamento = pair(Math.round(totalSpend), orcamentoMeta || meta.orcamento || 0);
        metrics.leads = pair(totalLeads, meta.leads || 0);
      }

      // Geral: add reserva + contrato bars
      if (name === "Geral" && meta.reserva != null) {
        metrics.reserva = pair(counts.reserva, meta.reserva);
        metrics.contrato = pair(counts.contrato, meta.contrato || 0);
      }

      const result: GeralChannelResult = {
        name,
        filterDescription:
          name === "Vendas Diretas" ? "Deals do canal Marketing (canal 12). Orçamento = gasto Meta Ads do mês."
            : name === "Parceiros" ? "Deals de canais de parceiros (Ind. Corretor, Ind. Franquia, Outros Parceiros)."
              : "Todos os canais sem filtro. Reservas e contratos mostram acumulado no mês.",
        metrics,
        lastMonthWon: prevWon[name] || 0,
        dealsHistory: channelHistory[name] || [],
      };

      // All channels get snapshots
      result.snapshots = snap;

      // Geral: reservaHistory (latest accumulated values)
      if (name === "Geral") {
        result.reservaHistory = [{ date: monthKey, reserva: geralReserva, contrato: geralContrato }];
      }

      return result;
    });

    return NextResponse.json({ month: monthKey, channels } as GeralData);
  } catch (err: unknown) {
    console.error("[geral] Error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
