import { NextResponse } from "next/server";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { paginate } from "@/lib/paginate";

/* ── Channel definitions ──────────────────────────────────── */
const CHANNEL_ORDER = ["Funil Completo", "Vendas Diretas", "Parcerias"] as const;
type MktpChannel = (typeof CHANNEL_ORDER)[number];

const CHANNEL_FILTERS: Record<MktpChannel, string> = {
  "Vendas Diretas": "canal NOT IN (582, 583, 2876) — todos os canais exceto parcerias",
  Parcerias: "canal IN (582, 583, 2876) — Indicação Corretor + Franquia + Outros Parceiros",
  "Funil Completo": "Todos os canais combinados",
};

const PARCERIA_CANAL_IDS = new Set(["582", "583", "2876"]);

function getCanalGroup(canalId: string): "Vendas Diretas" | "Parcerias" {
  return PARCERIA_CANAL_IDS.has(canalId) ? "Parcerias" : "Vendas Diretas";
}

/* ── Stage IDs (pipeline 37) ─────────────────────────────── */
const STAGE_RESERVA = 305;
const STAGE_CONTRATO = 271;

/* ── Metas (preencher com valores reais) ─────────────────── */
interface ChannelMetas {
  orcamento?: number;
  leads?: number;
  mql: number;
  sql: number;
  opp: number;
  won: number;
  reserva?: number;
  contrato?: number;
}

const MKTP_RESULTADOS_METAS: Record<string, Record<string, ChannelMetas>> = {
  "2026-03": {
    "Vendas Diretas": { orcamento: 65000, leads: 3354, mql: 1677, sql: 530, opp: 126, won: 9 },
    Parcerias: { mql: 31, sql: 23, opp: 17, won: 6 },
    "Funil Completo": { leads: 3354, mql: 1677, sql: 530, opp: 126, won: 15, reserva: 25, contrato: 18 },
  },
};

/* ── Types ────────────────────────────────────────────────── */
interface MetricPair { real: number; meta: number }

interface ChannelResult {
  name: string;
  filterDescription: string;
  metrics: {
    orcamento?: MetricPair;
    leads?: MetricPair;
    mql: MetricPair;
    sql: MetricPair;
    opp: MetricPair;
    won: MetricPair;
    reserva?: MetricPair;
    contrato?: MetricPair;
  };
  lastMonthWon: number;
  snapshots: { aguardandoDados: number; emContrato: number };
  ocupacaoAgenda: { agendadas: number; capacidade: number; percent: number };
  noShow: { canceladas: number; total: number; percent: number };
  dealsHistory: { date: string; total: number; byStage: Record<string, number> }[];
}

interface ResultadosMKTPData {
  month: string;
  channels: ChannelResult[];
}

export const dynamic = "force-dynamic";

/* ── Tab → date column in mktp_deals ─────────────────────── */
const TAB_DATE_COL: Record<string, string> = {
  mql: "add_time",
  sql: "qualificacao_date",
  opp: "reuniao_date",
  won: "won_time",
};

const TABS = ["mql", "sql", "opp", "won"] as const;

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

    const DEAL_COLS = "canal, status, stage_id, max_stage_order, add_time, won_time, lost_time, qualificacao_date, reuniao_date, lost_reason";

    /* ── 1. Fetch all deals from mktp_deals for current + previous month + 90d history ── */
    const allDeals = await paginate((o, ps) =>
      admin
        .from("mktp_deals")
        .select(DEAL_COLS)
        .gte("add_time", cutoffDate)
        .range(o, o + ps - 1)
    );

    // Also fetch won deals that may have add_time before cutoff but won_time in range
    const wonDeals = await paginate((o, ps) =>
      admin
        .from("mktp_deals")
        .select(DEAL_COLS)
        .eq("status", "won")
        .gte("won_time", prevStart)
        .lt("add_time", cutoffDate)
        .range(o, o + ps - 1)
    );

    // Merge, dedup by combining (won deals with old add_time but recent won_time)
    const dealMap = new Map<string, any>();
    for (const d of allDeals) {
      const key = `${d.canal}|${d.add_time}|${d.status}|${d.stage_id}`;
      dealMap.set(key, d);
    }
    for (const d of wonDeals) {
      const key = `${d.canal}|${d.add_time}|${d.status}|${d.stage_id}`;
      dealMap.set(key, d);
    }
    const deals = Array.from(dealMap.values());

    /* ── 2. Count funnel by channel for current month ──────── */
    const channelCounts: Record<string, Record<string, number>> = {};
    for (const ch of CHANNEL_ORDER) channelCounts[ch] = {};

    for (const deal of deals) {
      const group = getCanalGroup(String(deal.canal || ""));
      for (const tab of TABS) {
        const dateCol = TAB_DATE_COL[tab];
        const dateVal = deal[dateCol];
        if (!dateVal) continue;
        const day = dateVal.substring(0, 10);
        if (day < startDate) continue; // only current month
        channelCounts[group][tab] = (channelCounts[group][tab] || 0) + 1;
        channelCounts["Funil Completo"][tab] = (channelCounts["Funil Completo"][tab] || 0) + 1;
      }
    }

    /* ── 3. Previous month WON ─────────────────────────────── */
    const prevWon: Record<string, number> = {};
    for (const deal of deals) {
      if (deal.status !== "won") continue;
      const wonDate = deal.won_time?.substring(0, 10);
      if (!wonDate || wonDate < prevStart || wonDate > prevEnd) continue;
      const group = getCanalGroup(String(deal.canal || ""));
      prevWon[group] = (prevWon[group] || 0) + 1;
      prevWon["Funil Completo"] = (prevWon["Funil Completo"] || 0) + 1;
    }

    /* ── 3b. Reserva/Contrato acumulado no mês (coorte de deals fechados) ── */
    // Deals fechados no mês (won ou lost) que passaram por Reserva (max_stage_order >= 12)
    // ou Contrato (max_stage_order >= 13). Exclui Duplicado/Erro em JS (neq exclui NULLs).
    const RESERVA_MIN_ORDER = 12;
    const CONTRATO_MIN_ORDER = 13;

    const funnelReserva: Record<string, number> = {};
    const funnelContrato: Record<string, number> = {};
    for (const ch of CHANNEL_ORDER) { funnelReserva[ch] = 0; funnelContrato[ch] = 0; }

    for (const deal of deals) {
      if (deal.lost_reason === "Duplicado/Erro") continue;
      // Deal must have closed in current month (won or lost)
      const closeDate = deal.status === "won" ? deal.won_time?.substring(0, 10) : deal.lost_time?.substring(0, 10);
      const isOpen = deal.status === "open";
      // Include open deals too (they're currently in the funnel)
      if (!isOpen && (!closeDate || closeDate < startDate)) continue;

      const mso = deal.max_stage_order || 0;
      const group = getCanalGroup(String(deal.canal || ""));

      if (mso >= RESERVA_MIN_ORDER) {
        funnelReserva[group]++;
        funnelReserva["Funil Completo"]++;
      }
      if (mso >= CONTRATO_MIN_ORDER) {
        funnelContrato[group]++;
        funnelContrato["Funil Completo"]++;
      }
    }

    /* ── 4. Meta Ads spend (max por ad_id, soma = gasto real do mês) ── */
    const metaRows = await paginate((o, ps) =>
      admin.from("mktp_meta_ads").select("ad_id, spend_month").range(o, o + ps - 1)
    );
    const spendByAd = new Map<string, number>();
    for (const r of metaRows) {
      const adId = r.ad_id as string;
      const spend = r.spend_month || 0;
      spendByAd.set(adId, Math.max(spendByAd.get(adId) || 0, spend));
    }
    let totalSpend = 0;
    for (const v of spendByAd.values()) totalSpend += v;

    /* ── 5. Snapshots from open deals ──────────────────────── */
    const snapshotDeals = await paginate((o, ps) =>
      admin
        .from("mktp_deals")
        .select("stage_id, canal")
        .eq("status", "open")
        .in("stage_id", [STAGE_RESERVA, STAGE_CONTRATO])
        .range(o, o + ps - 1)
    );

    const snapshots: Record<string, { reserva: number; contrato: number }> = {};
    for (const ch of CHANNEL_ORDER) snapshots[ch] = { reserva: 0, contrato: 0 };

    for (const d of snapshotDeals) {
      const group = getCanalGroup(String(d.canal || ""));
      if (d.stage_id === STAGE_RESERVA) {
        snapshots[group].reserva++;
        snapshots["Funil Completo"].reserva++;
      } else if (d.stage_id === STAGE_CONTRATO) {
        snapshots[group].contrato++;
        snapshots["Funil Completo"].contrato++;
      }
    }

    /* ── 5b. Ocupação agenda (mktp_calendar_events, próximos 7 dias) ── */
    const today = now.toISOString().substring(0, 10);
    const next7 = new Date(now);
    next7.setDate(next7.getDate() + 7);
    const next7Date = next7.toISOString().substring(0, 10);

    const calendarEvents = await paginate((o, ps) =>
      admin
        .from("mktp_calendar_events")
        .select("closer_name")
        .gte("dia", today)
        .lte("dia", next7Date)
        .eq("cancelou", false)
        .range(o, o + ps - 1)
    );

    const CLOSERS = ["Nevine Saratt", "Willian Miranda"];
    const MEETINGS_PER_DAY = 16;
    const WORK_DAYS = 5;
    const totalCapacity = CLOSERS.length * MEETINGS_PER_DAY * WORK_DAYS;
    const totalAgendadas = calendarEvents.length;
    const agendaPct = totalCapacity > 0 ? Math.round((totalAgendadas / totalCapacity) * 1000) / 10 : 0;

    /* ── 5c. No-show (últimos 7 dias de mktp_calendar_events) ── */
    const past7 = new Date(now);
    past7.setDate(past7.getDate() - 6);
    const past7Str = past7.toISOString().substring(0, 10);

    const noShowRows = await paginate((o, ps) =>
      admin
        .from("mktp_calendar_events")
        .select("cancelou")
        .gte("dia", past7Str)
        .lte("dia", today)
        .range(o, o + ps - 1)
    );

    let noShowTotal = noShowRows.length;
    let noShowCanceladas = noShowRows.filter((e: any) => e.cancelou).length;
    const noShowPct = noShowTotal > 0 ? Math.round((noShowCanceladas / noShowTotal) * 1000) / 10 : 0;

    /* ── 6. History — cumulative open deals from mktp_deals ── */
    // Fetch ALL open deals with max_stage_order to build both charts.
    // Stage thresholds (same as sync-mktp-deals): MQL>=1, SQL>=5, OPP>=9, WON=won
    const openDeals = await paginate((o, ps) =>
      admin
        .from("mktp_deals")
        .select("canal, add_time, max_stage_order")
        .eq("status", "open")
        .not("add_time", "is", null)
        .range(o, o + ps - 1)
    );

    // Stage thresholds: MQL>=1, SQL>=5, OPP>=9, Reserva>=12, Contrato>=13
    const STAGES = ["mql", "sql", "opp", "reserva", "contrato"] as const;
    const STAGE_MIN: Record<string, number> = { mql: 1, sql: 5, opp: 9, reserva: 12, contrato: 13 };

    type DailyEntry = Record<string, number>; // total + stage keys
    function emptyEntry(): DailyEntry { return { total: 0, mql: 0, sql: 0, opp: 0, reserva: 0, contrato: 0 }; }

    const dailyByGroup: Record<string, Map<string, DailyEntry>> = {};
    const baselineByGroup: Record<string, DailyEntry> = {};
    for (const ch of CHANNEL_ORDER) {
      dailyByGroup[ch] = new Map();
      baselineByGroup[ch] = emptyEntry();
    }

    for (const d of openDeals) {
      const day = d.add_time.substring(0, 10);
      const group = getCanalGroup(String(d.canal || ""));
      const mso = d.max_stage_order || 0;
      const targets = [group, "Funil Completo"] as const;

      if (day < cutoffDate) {
        for (const ch of targets) {
          baselineByGroup[ch].total++;
          for (const s of STAGES) if (mso >= STAGE_MIN[s]) baselineByGroup[ch][s]++;
        }
      } else {
        for (const ch of targets) {
          const map = dailyByGroup[ch];
          if (!map.has(day)) map.set(day, emptyEntry());
          const e = map.get(day)!;
          e.total++;
          for (const s of STAGES) if (mso >= STAGE_MIN[s]) e[s]++;
        }
      }
    }

    // Build cumulative history per channel
    const cumulativeHist: Record<string, { date: string; total: number; byStage: Record<string, number> }[]> = {};
    for (const ch of CHANNEL_ORDER) {
      const dailyMap = dailyByGroup[ch];
      const dates = Array.from(dailyMap.keys()).sort();
      const cum = { ...baselineByGroup[ch] };
      const arr: { date: string; total: number; byStage: Record<string, number> }[] = [];
      for (const date of dates) {
        const e = dailyMap.get(date)!;
        cum.total += e.total;
        for (const s of STAGES) cum[s] += e[s];
        arr.push({ date, total: cum.total, byStage: { mql: cum.mql, sql: cum.sql, opp: cum.opp, reserva: cum.reserva, contrato: cum.contrato } });
      }
      cumulativeHist[ch] = arr;
    }

    /* ── 7. Build response ─────────────────────────────────── */
    const metas = MKTP_RESULTADOS_METAS[monthKey] || {};

    const channels: ChannelResult[] = CHANNEL_ORDER.map((name) => {
      const counts = channelCounts[name] || {};
      const meta = metas[name] || { mql: 0, sql: 0, opp: 0, won: 0 };
      const snap = snapshots[name];

      const metrics: ChannelResult["metrics"] = {
        mql: { real: counts.mql || 0, meta: meta.mql },
        sql: { real: counts.sql || 0, meta: meta.sql },
        opp: { real: counts.opp || 0, meta: meta.opp },
        won: { real: counts.won || 0, meta: meta.won },
      };

      if (meta.orcamento != null) {
        metrics.orcamento = { real: Math.round(totalSpend), meta: meta.orcamento };
      }
      if (meta.leads != null) {
        metrics.leads = { real: counts.mql || 0, meta: meta.leads };
      }
      if (meta.reserva != null) {
        metrics.reserva = { real: funnelReserva[name] || 0, meta: meta.reserva };
      }
      if (meta.contrato != null) {
        metrics.contrato = { real: funnelContrato[name] || 0, meta: meta.contrato };
      }

      const dealsHistory = cumulativeHist[name] || [];

      return {
        name,
        filterDescription: CHANNEL_FILTERS[name],
        metrics,
        lastMonthWon: prevWon[name] || 0,
        snapshots: { aguardandoDados: snap.reserva, emContrato: snap.contrato },
        ocupacaoAgenda: { agendadas: totalAgendadas, capacidade: totalCapacity, percent: agendaPct },
        noShow: { canceladas: noShowCanceladas, total: noShowTotal, percent: noShowPct },
        dealsHistory,
      };
    });

    const body: ResultadosMKTPData = { month: monthKey, channels };
    return NextResponse.json(body);
  } catch (err: unknown) {
    console.error("[mktp/resultados]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
