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

const CHANNEL_ORDER = ["Geral", "Vendas Diretas", "Parceiros", "Expansão"] as const;

const CHANNEL_FILTERS: Record<string, string> = {
  Geral: "Todos os canais\nExclui: Duplicado/Erro",
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
  agDados?: number;
  contrato?: number;
}

const SZS_RESULTADOS_METAS: Record<string, Record<string, ChannelMetas>> = {
  "2026-03": {
    Geral: { mql: 3143, sql: 1291, opp: 696, won: 266, agDados: 314, contrato: 314 },
    "Vendas Diretas": { orcamento: 76500, leads: 2500, mql: 1639, sql: 674, opp: 328, won: 98 },
    Parceiros: { mql: 249, sql: 154, opp: 140, won: 73 },
    "Expansão": { mql: 1832, sql: 566, opp: 216, won: 95 },
  },
};

const CHANNEL_CLOSERS: Record<string, string[]> = {
  Geral: ["Gabriela Lemos", "Gabriela Branco", "Giovanna de Araujo Zanchetta"],
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
  snapshots: {
    aguardandoDados: number; emContrato: number; totalOpen: number;
    agDadosAccum?: number; contratoAccum?: number;
    agDadosMeta?: number; contratoMeta?: number;
  };
  ocupacaoAgenda: { agendadas: number; capacidade: number; percent: number; closers: string[]; meetingsPerDay: number; workDays: number };
  noShow: { canceladas: number; total: number; percent: number };
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
      // Also accumulate into Geral
      channelCounts["Geral"][key] = (channelCounts["Geral"][key] || 0) + (r.count || 0);
    }

    // Last month WON from szs_deals (more complete than daily_counts)
    const prevWonRows = await paginate((o, ps) =>
      admin.from("szs_deals").select("canal, lost_reason").eq("status", "won").gte("won_time", prevStart).lt("won_time", startDate).range(o, o + ps - 1)
    );
    const prevWon: Record<string, number> = {};
    for (const ch of CHANNEL_ORDER) prevWon[ch] = 0;
    for (const d of prevWonRows) {
      if (d.lost_reason && String(d.lost_reason).toLowerCase() === "duplicado/erro") continue;
      const canalGroup = getCanalGroup(String(d.canal || ""));
      const macro = MACRO_CHANNELS[canalGroup] || "Vendas Diretas";
      prevWon[macro] = (prevWon[macro] || 0) + 1;
      prevWon["Geral"] = (prevWon["Geral"] || 0) + 1;
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

    // Use szs_open_snapshots for current totals (today's snapshot)
    const todayStr = now.toISOString().substring(0, 10);
    const todaySnap = await paginate((o, ps) =>
      admin.from("szs_open_snapshots").select("*").eq("date", todayStr).range(o, o + ps - 1)
    );
    const snapshots: Record<string, { agDados: number; contrato: number; agendado: number; totalOpen: number }> = {};
    for (const ch of CHANNEL_ORDER) snapshots[ch] = { agDados: 0, contrato: 0, agendado: 0, totalOpen: 0 };
    for (const s of todaySnap) {
      const macro = MACRO_CHANNELS[s.canal_group] || "Vendas Diretas";
      snapshots[macro].totalOpen += s.total_open || 0;
      snapshots[macro].agDados += s.ag_dados || 0;
      snapshots[macro].contrato += s.contrato || 0;
      snapshots["Geral"].totalOpen += s.total_open || 0;
      snapshots["Geral"].agDados += s.ag_dados || 0;
      snapshots["Geral"].contrato += s.contrato || 0;
    }

    // Fetch snapshot history for charts (last 30 days)
    const cutoff30 = new Date(now);
    cutoff30.setDate(cutoff30.getDate() - 30);
    const cutoff30Str = cutoff30.toISOString().substring(0, 10);
    const snapshotHistory = await paginate((o, ps) =>
      admin.from("szs_open_snapshots").select("*").gte("date", cutoff30Str).range(o, o + ps - 1)
    );
    // Aggregate by macro channel and date
    const snapHistMap: Record<string, Map<string, { totalOpen: number; byStage: Record<string, number> }>> = {};
    for (const ch of CHANNEL_ORDER) snapHistMap[ch] = new Map();
    for (const s of snapshotHistory) {
      const macro = MACRO_CHANNELS[s.canal_group] || "Vendas Diretas";
      for (const ch of [macro, "Geral"]) {
        const map = snapHistMap[ch];
        if (!map.has(s.date)) map.set(s.date, { totalOpen: 0, byStage: { mql: 0, sql: 0, opp: 0, won: 0, reserva: 0, contrato: 0 } });
        const entry = map.get(s.date)!;
        entry.totalOpen += s.total_open || 0;
        entry.byStage.mql += s.mql || 0;
        entry.byStage.sql += s.sql_count || 0;
        entry.byStage.opp += s.opp || 0;
        entry.byStage.reserva += s.ag_dados || 0;
        entry.byStage.contrato += s.contrato || 0;
      }
    }

    // Accumulated: deals that reached Ag.Dados (>=11) and Contrato (>=12) this month
    // Count deals that were active in March (won/lost/open) and reached these stages
    // 3 queries: open with mso>=11, won in March with mso>=11, lost in March with mso>=11
    const [accumOpen, accumWon, accumLost] = await Promise.all([
      paginate((o, ps) =>
        admin.from("szs_deals").select("canal, max_stage_order, stage_order, lost_reason")
          .eq("status", "open").range(o, o + ps - 1)
      ),
      paginate((o, ps) =>
        admin.from("szs_deals").select("canal, max_stage_order, stage_order, lost_reason")
          .eq("status", "won").gte("won_time", startDate).range(o, o + ps - 1)
      ),
      paginate((o, ps) =>
        admin.from("szs_deals").select("canal, max_stage_order, stage_order, lost_reason")
          .eq("status", "lost").gte("lost_time", startDate).range(o, o + ps - 1)
      ),
    ]);
    const accumData: Record<string, { agDados: number; contrato: number }> = {};
    for (const ch of CHANNEL_ORDER) accumData[ch] = { agDados: 0, contrato: 0 };
    for (const d of [...accumOpen, ...accumWon, ...accumLost]) {
      if (d.lost_reason && String(d.lost_reason).toLowerCase() === "duplicado/erro") continue;
      const mso = d.max_stage_order || d.stage_order || 0;
      const canalGroup = getCanalGroup(String(d.canal || ""));
      const macro = MACRO_CHANNELS[canalGroup] || "Vendas Diretas";
      if (mso >= 11) { accumData[macro].agDados++; accumData["Geral"].agDados++; }
      if (mso >= 12) { accumData[macro].contrato++; accumData["Geral"].contrato++; }
    }

    // Google Calendar: count meetings scheduled in next 7 days per closer
    const today = now.toISOString().substring(0, 10);
    const next7 = new Date(now);
    next7.setDate(next7.getDate() + 6);
    const next7Str = next7.toISOString().substring(0, 10);
    const calendarRows = await paginate((o, ps) =>
      admin.from("szs_calendar_events").select("closer_email").gte("dia", today).lte("dia", next7Str).eq("cancelou", false).range(o, o + ps - 1)
    );
    for (const ev of calendarRows) {
      const macro = CLOSER_EMAIL_CHANNEL[ev.closer_email];
      if (macro) snapshots[macro].agendado++;
      // All calendar events from SZS closers count toward Geral
      snapshots["Geral"].agendado++;
    }

    // No-show: cancelled meetings in last 7 days vs total
    const past7 = new Date(now);
    past7.setDate(past7.getDate() - 6);
    const past7Str = past7.toISOString().substring(0, 10);
    const noShowRows = await paginate((o, ps) =>
      admin.from("szs_calendar_events").select("closer_email, cancelou").gte("dia", past7Str).lte("dia", today).range(o, o + ps - 1)
    );
    const noShowData: Record<string, { canceladas: number; total: number }> = {};
    for (const ch of CHANNEL_ORDER) noShowData[ch] = { canceladas: 0, total: 0 };
    for (const ev of noShowRows) {
      const macro = CLOSER_EMAIL_CHANNEL[ev.closer_email];
      if (macro) {
        noShowData[macro].total++;
        if (ev.cancelou) noShowData[macro].canceladas++;
      }
      noShowData["Geral"].total++;
      if (ev.cancelou) noShowData["Geral"].canceladas++;
    }

    // History from szs_daily_counts (for funnel metrics, not charts)
    const historyRows = await paginate((o, ps) =>
      admin.from("szs_daily_counts").select("date, tab, canal_group, count").gte("date", cutoffDate).range(o, o + ps - 1)
    );
    const histMap: Record<string, Map<string, Record<string, number>>> = {};
    for (const ch of CHANNEL_ORDER) histMap[ch] = new Map();
    for (const r of historyRows) {
      const macro = MACRO_CHANNELS[r.canal_group] || "Vendas Diretas";
      const map = histMap[macro];
      if (!map.has(r.date)) map.set(r.date, {});
      const entry = map.get(r.date)!;
      entry[r.tab] = (entry[r.tab] || 0) + (r.count || 0);
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

      // Charts use snapshot history (szs_open_snapshots)
      const snapHist = snapHistMap[name];
      const dealsHistory = Array.from(snapHist.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, entry]) => ({
          date,
          total: 0,
          openTotal: entry.totalOpen,
          byStage: entry.byStage,
        }));

      return {
        name,
        filterDescription: CHANNEL_FILTERS[name],
        metrics,
        lastMonthWon: prevWon[name] || 0,
        snapshots: name === "Geral"
          ? {
              aguardandoDados: snap.agDados,
              emContrato: snap.contrato,
              totalOpen: snap.totalOpen,
              agDadosAccum: accumData[name].agDados,
              contratoAccum: accumData[name].contrato,
              agDadosMeta: meta.agDados,
              contratoMeta: meta.contrato,
            }
          : { aguardandoDados: snap.agDados, emContrato: snap.contrato, totalOpen: snap.totalOpen },
        ocupacaoAgenda: {
          agendadas: snap.agendado,
          capacidade: capacity,
          percent: capacity > 0 ? Math.round((snap.agendado / capacity) * 1000) / 10 : 0,
          closers,
          meetingsPerDay: MEETINGS_PER_DAY,
          workDays: WORK_DAYS_PER_WEEK,
        },
        noShow: {
          canceladas: noShowData[name].canceladas,
          total: noShowData[name].total,
          percent: noShowData[name].total > 0 ? Math.round((noShowData[name].canceladas / noShowData[name].total) * 1000) / 10 : 0,
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
