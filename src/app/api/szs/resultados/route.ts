import { NextResponse } from "next/server";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { paginate } from "@/lib/paginate";

/* ── Macro-channel mapping ────────────────────────────────── */
const MACRO_CHANNELS: Record<string, string> = {
  Marketing: "Vendas Diretas",
  "Mônica": "Vendas Diretas",
  Spots: "Vendas Diretas",
  Outros: "Vendas Diretas",
  Parceiros: "Parceiros",
  "Ind. Corretor": "Parceiros",
  "Ind. Franquia": "Parceiros",
  "Ind. Outros Parceiros": "Parceiros",
  "Expansão": "Expansão",
};

/* ── Canal ID → group (for szs_deals which stores raw IDs) ── */
const CANAL_ID_TO_GROUP: Record<string, string> = {
  "12": "Marketing",
  "582": "Parceiros",
  "583": "Parceiros",
  "1748": "Expansão",
  "3189": "Spots",
  "4551": "Mônica",
};
function getCanalGroup(canalId: string): string {
  return CANAL_ID_TO_GROUP[canalId] || "Outros";
}

const CHANNEL_ORDER = ["Vendas Diretas", "Parceiros", "Expansão"] as const;

const CHANNEL_FILTERS: Record<string, string> = {
  "Vendas Diretas": "Inclui: Marketing, Mônica, Spots, Ind. Colaborador, Eventos, Ind. Clientes, Outros\nExclui: Expansão, Ind. Corretor, Ind. Franquia, Duplicado/Erro",
  Parceiros: "Inclui: Ind. Corretor, Ind. Franquia, Ind. Outros Parceiros\nExclui: Duplicado/Erro",
  "Expansão": "Inclui: Expansão\nExclui: Duplicado/Erro",
};

interface ChannelMetas {
  orcamento?: number;
  leads?: number;
  mql: number;
  sql: number;
  opp: number;
  won: number;
}

const SZS_RESULTADOS_METAS: Record<string, Record<string, ChannelMetas>> = {
  "2026-03": {
    "Vendas Diretas": { orcamento: 76500, leads: 2500, mql: 1639, sql: 674, opp: 328, won: 98 },
    Parceiros: { mql: 249, sql: 154, opp: 140, won: 73 },
    "Expansão": { mql: 1832, sql: 566, opp: 216, won: 95 },
  },
};

const CHANNEL_CLOSERS: Record<string, string[]> = {
  "Vendas Diretas": ["Gabriela Lemos"],
  Parceiros: ["Gabriela Branco"],
  "Expansão": ["Giovanna de Araujo Zanchetta"],
};

/* ── Closer email → macro channel (for calendar events) ──── */
const CLOSER_EMAIL_CHANNEL: Record<string, string> = {
  "gabriela.lemos@seazone.com.br": "Vendas Diretas",
  "gabriela.branco@seazone.com.br": "Parceiros",
  "giovanna.araujo@seazone.com.br": "Expansão",
};

const MEETINGS_PER_DAY = 16;
const WORK_DAYS_PER_WEEK = 5;

const STAGE_AG_DADOS = 11;   // stage_id 152 → stage_order 11
const STAGE_CONTRATO = 12;   // stage_id 76  → stage_order 12

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
  };
  lastMonthWon: number;
  snapshots: { aguardandoDados: number; emContrato: number };
  ocupacaoAgenda: { agendadas: number; capacidade: number; percent: number; closers: string[]; meetingsPerDay: number; workDays: number };
  dealsHistory: { date: string; total: number; openTotal: number; byStage: Record<string, number> }[];
}

interface ResultadosSZSData {
  month: string;
  channels: ChannelResult[];
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

    const countsRows = await paginate((o, ps) =>
      admin.from("szs_daily_counts").select("date, tab, canal_group, count").gte("date", startDate).range(o, o + ps - 1)
    );

    const channelCounts: Record<string, Record<string, number>> = {};
    for (const ch of CHANNEL_ORDER) channelCounts[ch] = {};
    for (const r of countsRows) {
      const macro = MACRO_CHANNELS[r.canal_group] || "Vendas Diretas";
      const key = r.tab as string;
      channelCounts[macro][key] = (channelCounts[macro][key] || 0) + (r.count || 0);
    }

    const prevRows = await paginate((o, ps) =>
      admin.from("szs_daily_counts").select("canal_group, count").eq("tab", "won").gte("date", prevStart).lte("date", prevEnd).range(o, o + ps - 1)
    );
    const prevWon: Record<string, number> = {};
    for (const r of prevRows) {
      const macro = MACRO_CHANNELS[r.canal_group] || "Vendas Diretas";
      prevWon[macro] = (prevWon[macro] || 0) + (r.count || 0);
    }

    const metaRows = await paginate((o, ps) =>
      admin.from("szs_meta_ads").select("ad_id, spend_month").gte("snapshot_date", startDate).range(o, o + ps - 1)
    );
    // Dedup: max spend_month per ad_id (multiple snapshots in the month)
    const adSpend = new Map<string, number>();
    for (const r of metaRows) {
      const spend = Number(r.spend_month) || 0;
      const cur = adSpend.get(r.ad_id) || 0;
      if (spend > cur) adSpend.set(r.ad_id, spend);
    }
    let totalSpend = 0;
    for (const v of adSpend.values()) totalSpend += v;

    const snapshotDeals = await paginate((o, ps) =>
      admin.from("szs_deals").select("stage_order, canal, status").eq("status", "open").in("stage_order", [STAGE_AG_DADOS, STAGE_CONTRATO]).range(o, o + ps - 1)
    );
    const snapshots: Record<string, { agDados: number; contrato: number; agendado: number }> = {};
    for (const ch of CHANNEL_ORDER) snapshots[ch] = { agDados: 0, contrato: 0, agendado: 0 };
    for (const d of snapshotDeals) {
      const canalGroup = getCanalGroup(String(d.canal || ""));
      const macro = MACRO_CHANNELS[canalGroup] || "Vendas Diretas";
      if (d.stage_order === STAGE_AG_DADOS) snapshots[macro].agDados++;
      else if (d.stage_order === STAGE_CONTRATO) snapshots[macro].contrato++;
    }

    // Calendar: count meetings scheduled in next 7 days per closer
    const today = now.toISOString().substring(0, 10);
    const next7 = new Date(now);
    next7.setDate(next7.getDate() + 6);
    const next7Str = next7.toISOString().substring(0, 10);
    const calendarRows = await paginate((o, ps) =>
      admin.from("szs_calendar_events").select("closer_email, cancelou").gte("dia", today).lte("dia", next7Str).eq("cancelou", false).range(o, o + ps - 1)
    );
    for (const ev of calendarRows) {
      const macro = CLOSER_EMAIL_CHANNEL[ev.closer_email];
      if (macro) snapshots[macro].agendado++;
    }

    // History: byStage uses all sources; openTotal uses only source=open + tab=mql
    const historyRows = await paginate((o, ps) =>
      admin.from("szs_daily_counts").select("date, tab, canal_group, count, source").gte("date", cutoffDate).range(o, o + ps - 1)
    );
    const histMap: Record<string, Map<string, Record<string, number>>> = {};
    const openTotalMap: Record<string, Map<string, number>> = {};
    for (const ch of CHANNEL_ORDER) { histMap[ch] = new Map(); openTotalMap[ch] = new Map(); }
    for (const r of historyRows) {
      const macro = MACRO_CHANNELS[r.canal_group] || "Vendas Diretas";
      // byStage: aggregate all sources
      const map = histMap[macro];
      if (!map.has(r.date)) map.set(r.date, {});
      const entry = map.get(r.date)!;
      entry[r.tab] = (entry[r.tab] || 0) + (r.count || 0);
      // openTotal: only source=open, tab=mql = total deals currently open
      if (r.source === "open" && r.tab === "mql") {
        const oMap = openTotalMap[macro];
        oMap.set(r.date, (oMap.get(r.date) || 0) + (r.count || 0));
      }
    }

    const metas = SZS_RESULTADOS_METAS[monthKey] || {};
    const channels: ChannelResult[] = CHANNEL_ORDER.map((name) => {
      const counts = channelCounts[name] || {};
      const meta = metas[name] || { mql: 0, sql: 0, opp: 0, won: 0 };
      const snap = snapshots[name];
      const closers = CHANNEL_CLOSERS[name] || [];
      const capacity = closers.length * MEETINGS_PER_DAY * WORK_DAYS_PER_WEEK;

      const metrics: ChannelResult["metrics"] = {
        mql: { real: counts.mql || 0, meta: meta.mql },
        sql: { real: counts.sql || 0, meta: meta.sql },
        opp: { real: counts.opp || 0, meta: meta.opp },
        won: { real: counts.won || 0, meta: meta.won },
      };
      if (meta.orcamento != null) metrics.orcamento = { real: Math.round(totalSpend), meta: meta.orcamento };
      if (meta.leads != null) metrics.leads = { real: counts.mql || 0, meta: meta.leads };

      const histEntries = histMap[name];
      const oMap = openTotalMap[name];
      const dealsHistory = Array.from(histEntries.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, tabs]) => ({
          date,
          total: Object.values(tabs).reduce((s, v) => s + v, 0),
          openTotal: oMap.get(date) || 0,
          byStage: tabs,
        }));

      return {
        name,
        filterDescription: CHANNEL_FILTERS[name],
        metrics,
        lastMonthWon: prevWon[name] || 0,
        snapshots: { aguardandoDados: snap.agDados, emContrato: snap.contrato },
        ocupacaoAgenda: {
          agendadas: snap.agendado,
          capacidade: capacity,
          percent: capacity > 0 ? Math.round((snap.agendado / capacity) * 1000) / 10 : 0,
          closers,
          meetingsPerDay: MEETINGS_PER_DAY,
          workDays: WORK_DAYS_PER_WEEK,
        },
        dealsHistory,
      };
    });

    const body: ResultadosSZSData = { month: monthKey, channels };
    return NextResponse.json(body);
  } catch (err: unknown) {
    console.error("[szs/resultados]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
