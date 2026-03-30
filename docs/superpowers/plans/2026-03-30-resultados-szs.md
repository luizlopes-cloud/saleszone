# Resultados SZS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Resultados SZS" tab showing monthly results by macro-channel (Vendas Diretas, Parceiros, Expansão) with progress bars, deal evolution charts, and agenda occupancy.

**Architecture:** New API route `/api/szs/resultados` aggregates data from `szs_daily_counts`, `szs_deals`, and `szs_meta_ads` into 3 macro-channels. A new view component renders progress bars (50% left) and SVG line charts (50% right) with snapshot boxes below. Header dropdown and page.tsx updated for routing.

**Tech Stack:** Next.js App Router, TypeScript, Supabase (PostgreSQL), custom SVG charts, inline styles with T tokens.

---

### Task 1: API Route — `/api/szs/resultados`

**Files:**
- Create: `src/app/api/szs/resultados/route.ts`

- [ ] **Step 1: Create the route file with types and constants**

```typescript
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
  "Expansão": "Expansão",
};

const CHANNEL_ORDER = ["Vendas Diretas", "Parceiros", "Expansão"] as const;

const CHANNEL_FILTERS: Record<string, string> = {
  "Vendas Diretas": "canal_group NOT IN ('Parceiros', 'Expansão') — inclui Marketing, Mônica, Spots, Outros",
  Parceiros: "canal_group = 'Parceiros' (IDs 582, 583 — indicação corretor/franqueado)",
  "Expansão": "canal_group = 'Expansão' (ID 1748)",
};

/* ── Metas hardcoded por mês × macro-canal ────────────────── */
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

/* ── Closers per macro-channel (for agenda capacity) ──────── */
const CHANNEL_CLOSERS: Record<string, string[]> = {
  "Vendas Diretas": ["Maria Vitória Amaral", "Gabriela Branco", "Gabriela Lemos"],
  Parceiros: ["Samuel Barreto"],
  "Expansão": ["Giovanna de Araujo Zanchetta"],
};

const MEETINGS_PER_DAY = 16; // 8h × 2 per hour (30min each)
const WORK_DAYS_PER_WEEK = 5;

/* ── SZS Pipeline 14 stage_orders ─────────────────────────── */
const STAGE_AG_DADOS = 152;  // "Ag. Dados" / "Reserva"
const STAGE_CONTRATO = 76;   // "Contrato"
const STAGE_AGENDADO = 73;   // "Agendado"

/* ── Response types ───────────────────────────────────────── */
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
  ocupacaoAgenda: { agendadas: number; capacidade: number; percent: number };
  dealsHistory: { date: string; total: number; byStage: Record<string, number> }[];
}

interface ResultadosSZSData {
  month: string;
  channels: ChannelResult[];
}
```

- [ ] **Step 2: Implement the GET handler**

Add below the types in the same file:

```typescript
export async function GET() {
  try {
    const admin = createSquadSupabaseAdmin();
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-indexed
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
    const startDate = `${monthKey}-01`;
    const day = now.getDate();
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Previous month key for LM
    const prevDate = new Date(year, month - 1, 1);
    const prevKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`;
    const prevStart = `${prevKey}-01`;
    const prevEnd = `${prevKey}-${new Date(prevDate.getFullYear(), prevDate.getMonth() + 1, 0).getDate()}`;

    // 90-day cutoff for history
    const cutoff90 = new Date(now);
    cutoff90.setDate(cutoff90.getDate() - 90);
    const cutoffDate = cutoff90.toISOString().substring(0, 10);

    /* ── 1. Current month counts from szs_daily_counts ──── */
    const countsRows = await paginate((o, ps) =>
      admin
        .from("szs_daily_counts")
        .select("date, tab, canal_group, count")
        .gte("date", startDate)
        .range(o, o + ps - 1)
    );

    // Aggregate by macro-channel + tab
    const channelCounts: Record<string, Record<string, number>> = {};
    for (const ch of CHANNEL_ORDER) channelCounts[ch] = {};

    for (const r of countsRows) {
      const macro = MACRO_CHANNELS[r.canal_group] || "Vendas Diretas";
      const key = r.tab as string;
      channelCounts[macro][key] = (channelCounts[macro][key] || 0) + (r.count || 0);
    }

    /* ── 2. Previous month WON for LM ──────────────────── */
    const prevRows = await paginate((o, ps) =>
      admin
        .from("szs_daily_counts")
        .select("canal_group, count")
        .eq("tab", "won")
        .gte("date", prevStart)
        .lte("date", prevEnd)
        .range(o, o + ps - 1)
    );

    const prevWon: Record<string, number> = {};
    for (const r of prevRows) {
      const macro = MACRO_CHANNELS[r.canal_group] || "Vendas Diretas";
      prevWon[macro] = (prevWon[macro] || 0) + (r.count || 0);
    }

    /* ── 3. Spend from szs_meta_ads (current month) ────── */
    const metaRows = await paginate((o, ps) =>
      admin
        .from("szs_meta_ads")
        .select("spend_month")
        .range(o, o + ps - 1)
    );

    let totalSpend = 0;
    for (const r of metaRows) totalSpend += r.spend_month || 0;

    /* ── 4. Snapshots from szs_deals ───────────────────── */
    const snapshotDeals = await paginate((o, ps) =>
      admin
        .from("szs_deals")
        .select("stage_order, canal, status")
        .eq("status", "open")
        .in("stage_order", [STAGE_AG_DADOS, STAGE_CONTRATO, STAGE_AGENDADO])
        .range(o, o + ps - 1)
    );

    const snapshots: Record<string, { agDados: number; contrato: number; agendado: number }> = {};
    for (const ch of CHANNEL_ORDER) snapshots[ch] = { agDados: 0, contrato: 0, agendado: 0 };

    for (const d of snapshotDeals) {
      const canalGroup = d.canal || "Outros";
      const macro = MACRO_CHANNELS[canalGroup] || "Vendas Diretas";
      if (d.stage_order === STAGE_AG_DADOS) snapshots[macro].agDados++;
      else if (d.stage_order === STAGE_CONTRATO) snapshots[macro].contrato++;
      else if (d.stage_order === STAGE_AGENDADO) snapshots[macro].agendado++;
    }

    /* ── 5. Deals history (90 days) from szs_daily_counts ─ */
    const historyRows = await paginate((o, ps) =>
      admin
        .from("szs_daily_counts")
        .select("date, tab, canal_group, count")
        .gte("date", cutoffDate)
        .range(o, o + ps - 1)
    );

    // Group by macro-channel → date → tab
    const histMap: Record<string, Map<string, Record<string, number>>> = {};
    for (const ch of CHANNEL_ORDER) histMap[ch] = new Map();

    for (const r of historyRows) {
      const macro = MACRO_CHANNELS[r.canal_group] || "Vendas Diretas";
      const map = histMap[macro];
      if (!map.has(r.date)) map.set(r.date, {});
      const entry = map.get(r.date)!;
      entry[r.tab] = (entry[r.tab] || 0) + (r.count || 0);
    }

    /* ── 6. Build response ─────────────────────────────── */
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

      if (meta.orcamento != null) {
        metrics.orcamento = { real: Math.round(totalSpend), meta: meta.orcamento };
      }
      if (meta.leads != null) {
        metrics.leads = { real: counts.mql || 0, meta: meta.leads };
      }

      // Build history array sorted by date
      const histEntries = histMap[name];
      const dealsHistory = Array.from(histEntries.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, tabs]) => ({
          date,
          total: Object.values(tabs).reduce((s, v) => s + v, 0),
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
```

- [ ] **Step 3: Verify the route compiles**

Run: `cd ~/Claude-Code/saleszone && npx next lint src/app/api/szs/resultados/route.ts`

- [ ] **Step 4: Commit**

```bash
git add src/app/api/szs/resultados/route.ts
git commit -m "feat(szs): add /api/szs/resultados route for monthly results by macro-channel"
```

---

### Task 2: View Component — `resultados-szs-view.tsx`

**Files:**
- Create: `src/components/dashboard/resultados-szs-view.tsx`

- [ ] **Step 1: Create the view component with types and helpers**

```typescript
"use client";

import { useState } from "react";
import { Info } from "lucide-react";
import { T } from "@/lib/constants";

/* ── Types (mirror API response) ──────────────────────────── */
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
  ocupacaoAgenda: { agendadas: number; capacidade: number; percent: number };
  dealsHistory: { date: string; total: number; byStage: Record<string, number> }[];
}

interface ResultadosSZSData {
  month: string;
  channels: ChannelResult[];
}

interface Props {
  data: ResultadosSZSData | null;
  loading: boolean;
  lastUpdated?: Date | null;
}

/* ── Helpers ──────────────────────────────────────────────── */
const CHANNEL_ICONS: Record<string, string> = {
  "Vendas Diretas": "🎯",
  Parceiros: "🤝",
  "Expansão": "🚀",
};

const CHANNEL_ACCENT: Record<string, string> = {
  "Vendas Diretas": "rgba(59,130,246,0.04)",
  Parceiros: "rgba(168,85,247,0.04)",
  "Expansão": "rgba(234,179,8,0.04)",
};

function progressColor(pct: number): string {
  if (pct >= 80) return "#22c55e";
  if (pct >= 60) return "#3b82f6";
  if (pct >= 40) return "#f97316";
  return "#ef4444";
}

function fmtNum(n: number): string {
  return n.toLocaleString("pt-BR");
}

function fmtMoney(n: number): string {
  if (n >= 1000) return `R$ ${(n / 1000).toFixed(1).replace(".", ",")}k`;
  return `R$ ${fmtNum(n)}`;
}
```

- [ ] **Step 2: Add the ProgressBar sub-component**

```typescript
function ProgressBar({ label, real, meta, isMoney }: { label: string; real: number; meta: number; isMoney?: boolean }) {
  const pct = meta > 0 ? Math.round((real / meta) * 1000) / 10 : 0;
  const clampedWidth = Math.min(pct, 100);
  const color = progressColor(pct);
  const fmt = isMoney ? fmtMoney : fmtNum;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: T.cinza600, marginBottom: 3 }}>
        <span>{label}</span>
        <span>{fmt(real)} / {fmt(meta)}</span>
      </div>
      <div style={{ height: 22, background: T.cinza50, borderRadius: 4, overflow: "hidden" }}>
        <div
          style={{
            width: `${clampedWidth}%`,
            height: "100%",
            background: `linear-gradient(90deg, ${color}, ${color}cc)`,
            borderRadius: 4,
            display: "flex",
            alignItems: "center",
            paddingLeft: 8,
            fontSize: 10,
            color: "#fff",
            fontWeight: 600,
            minWidth: 40,
          }}
        >
          {pct.toFixed(1)}%
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add the SVG chart sub-components**

```typescript
function AreaChart({ data, color }: { data: { date: string; value: number }[]; color: string }) {
  if (data.length < 2) return <div style={{ fontSize: 11, color: T.cinza400, padding: 20, textAlign: "center" }}>Dados insuficientes</div>;
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  const W = 500;
  const H = 70;
  const points = data.map((d, i) => ({
    x: (i / (data.length - 1)) * W,
    y: H - (d.value / maxVal) * (H - 5),
  }));
  const line = points.map((p) => `${p.x},${p.y}`).join(" L");
  const area = `M${line} L${W},${H} L0,${H} Z`;

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace("#", "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} />
          <stop offset="100%" stopColor="transparent" />
        </linearGradient>
      </defs>
      <path d={area} fill={`url(#grad-${color.replace("#", "")})`} opacity={0.3} />
      <path d={`M${line}`} fill="none" stroke={color} strokeWidth={2} />
    </svg>
  );
}

const STAGE_COLORS: Record<string, string> = {
  mql: "#60a5fa",
  sql: "#a855f7",
  opp: "#fbbf24",
  won: "#22c55e",
  reserva: "#f97316",
  contrato: "#ef4444",
};

const STAGE_LABELS: Record<string, string> = {
  mql: "MQL",
  sql: "SQL",
  opp: "OPP",
  won: "WON",
  reserva: "Ag.Dados",
  contrato: "Contrato",
};

function MultiLineChart({ data }: { data: { date: string; byStage: Record<string, number> }[] }) {
  if (data.length < 2) return <div style={{ fontSize: 11, color: T.cinza400, padding: 20, textAlign: "center" }}>Dados insuficientes</div>;
  const stages = Object.keys(STAGE_COLORS);
  const maxVal = Math.max(...data.flatMap((d) => stages.map((s) => d.byStage[s] || 0)), 1);
  const W = 500;
  const H = 70;

  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
      {stages.map((stage) => {
        const points = data.map((d, i) => {
          const x = (i / (data.length - 1)) * W;
          const y = H - ((d.byStage[stage] || 0) / maxVal) * (H - 5);
          return `${x},${y}`;
        });
        const isDashed = stage === "reserva" || stage === "contrato";
        return (
          <path
            key={stage}
            d={`M${points.join(" L")}`}
            fill="none"
            stroke={STAGE_COLORS[stage]}
            strokeWidth={1.5}
            strokeDasharray={isDashed ? "4" : undefined}
          />
        );
      })}
    </svg>
  );
}
```

- [ ] **Step 4: Add the ChannelCard sub-component**

```typescript
function ChannelCard({ channel, historyDays }: { channel: ChannelResult; historyDays: number }) {
  const [tooltipOpen, setTooltipOpen] = useState(false);
  const { metrics, snapshots, ocupacaoAgenda, dealsHistory, lastMonthWon, name } = channel;
  const icon = CHANNEL_ICONS[name] || "📊";
  const accent = CHANNEL_ACCENT[name] || "transparent";
  const wonPct = metrics.won.meta > 0 ? Math.round((metrics.won.real / metrics.won.meta) * 100) : 0;

  // Filter history by selected days
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - historyDays);
  const cutoffStr = cutoff.toISOString().substring(0, 10);
  const filteredHistory = dealsHistory.filter((h) => h.date >= cutoffStr);

  return (
    <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: 20, background: accent, marginBottom: 24 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
        <span style={{ fontSize: 16, fontWeight: 600, color: T.fg }}>
          {icon} {name}
        </span>
        <span style={{ fontSize: 13, color: T.cinza600 }}>
          ({fmtNum(metrics.won.real)}/{fmtNum(metrics.won.meta)} contratos) — LM: {fmtNum(lastMonthWon)}
        </span>
        <span
          style={{ position: "relative", cursor: "pointer", color: T.cinza400, fontSize: 14 }}
          onMouseEnter={() => setTooltipOpen(true)}
          onMouseLeave={() => setTooltipOpen(false)}
        >
          <Info size={14} />
          {tooltipOpen && (
            <div style={{
              position: "absolute", top: 20, left: -100, zIndex: 10, background: T.fg, color: "#fff",
              padding: "8px 12px", borderRadius: 6, fontSize: 11, width: 280, lineHeight: 1.4,
              boxShadow: T.elevSm,
            }}>
              {channel.filterDescription}
            </div>
          )}
        </span>
      </div>

      {/* 50/50 grid: Bars | Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 16 }}>
        {/* Left: Progress bars */}
        <div>
          {metrics.orcamento && <ProgressBar label="Orçamento" real={metrics.orcamento.real} meta={metrics.orcamento.meta} isMoney />}
          {metrics.leads && <ProgressBar label="Leads" real={metrics.leads.real} meta={metrics.leads.meta} />}
          <ProgressBar label="MQL" real={metrics.mql.real} meta={metrics.mql.meta} />
          <ProgressBar label="SQL" real={metrics.sql.real} meta={metrics.sql.meta} />
          <ProgressBar label="OPP" real={metrics.opp.real} meta={metrics.opp.meta} />
          <ProgressBar label="Ganhos (WON)" real={metrics.won.real} meta={metrics.won.meta} />
        </div>

        {/* Right: Charts */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <div style={{ padding: "12px 14px", background: T.card, borderRadius: 8, border: `1px solid ${T.border}`, flex: 1 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.fg, marginBottom: 8 }}>Deals Abertos no Funil</div>
            <AreaChart
              data={filteredHistory.map((h) => ({ date: h.date, value: h.total }))}
              color={name === "Parceiros" ? "#a855f7" : name === "Expansão" ? "#eab308" : "#3b82f6"}
            />
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 8, color: T.cinza400, marginTop: 2 }}>
              <span>{filteredHistory[0]?.date.substring(5).replace("-", "/") || ""}</span>
              <span>{filteredHistory[filteredHistory.length - 1]?.date.substring(5).replace("-", "/") || ""}</span>
            </div>
          </div>
          <div style={{ padding: "12px 14px", background: T.card, borderRadius: 8, border: `1px solid ${T.border}`, flex: 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: T.fg }}>Deals por Etapa</span>
              <div style={{ display: "flex", gap: 6, fontSize: 9 }}>
                {Object.entries(STAGE_LABELS).map(([key, lbl]) => (
                  <span key={key} style={{ color: STAGE_COLORS[key] }}>● {lbl}</span>
                ))}
              </div>
            </div>
            <MultiLineChart data={filteredHistory} />
          </div>
        </div>
      </div>

      {/* Bottom boxes */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
        <div style={{ padding: "14px 16px", background: T.card, borderRadius: 8, border: `1px solid ${T.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: T.cinza600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Aguardando Dados</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#fbbf24" }}>{fmtNum(snapshots.aguardandoDados)}</div>
          <div style={{ fontSize: 11, color: T.cinza400, marginTop: 4 }}>deals na etapa</div>
        </div>
        <div style={{ padding: "14px 16px", background: T.card, borderRadius: 8, border: `1px solid ${T.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: T.cinza600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Em Contrato</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#22c55e" }}>{fmtNum(snapshots.emContrato)}</div>
          <div style={{ fontSize: 11, color: T.cinza400, marginTop: 4 }}>deals na etapa</div>
        </div>
        <div style={{ padding: "14px 16px", background: T.card, borderRadius: 8, border: `1px solid ${T.border}`, textAlign: "center" }}>
          <div style={{ fontSize: 10, color: T.cinza600, textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 6 }}>Ocupação Agenda</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: "#60a5fa" }}>
            {ocupacaoAgenda.percent}<span style={{ fontSize: 14 }}>%</span>
          </div>
          <div style={{ fontSize: 11, color: T.cinza400, marginTop: 4 }}>{ocupacaoAgenda.agendadas}/{ocupacaoAgenda.capacidade} slots (7d)</div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Add the main exported component**

```typescript
export function ResultadosSZSView({ data, loading, lastUpdated }: Props) {
  const [historyDays, setHistoryDays] = useState(30);

  if (loading || !data) {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: 60, color: T.cinza400, fontSize: 14 }}>
        {loading ? "Carregando..." : "Sem dados"}
      </div>
    );
  }

  return (
    <div style={{ fontFamily: T.font, maxWidth: 1100, margin: "0 auto", padding: "20px 0" }}>
      {/* Header with period toggle */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <div style={{ fontSize: 12, color: T.cinza600 }}>
          {data.month.replace("-", "/")}
          {lastUpdated && <span style={{ marginLeft: 8, fontSize: 10, color: T.cinza400 }}>Atualizado {lastUpdated.toLocaleTimeString("pt-BR")}</span>}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {[30, 60, 90].map((d) => (
            <button
              key={d}
              onClick={() => setHistoryDays(d)}
              style={{
                fontSize: 10,
                padding: "2px 8px",
                borderRadius: 4,
                border: "none",
                cursor: "pointer",
                background: historyDays === d ? T.azul600 : T.cinza50,
                color: historyDays === d ? "#fff" : T.cinza600,
                fontWeight: 500,
              }}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Channel cards */}
      {data.channels.map((ch) => (
        <ChannelCard key={ch.name} channel={ch} historyDays={historyDays} />
      ))}

      {/* Legend */}
      <div style={{ textAlign: "center", fontSize: 11, color: T.cinza400, marginTop: 8 }}>
        Barras: <span style={{ color: "#22c55e" }}>■</span> ≥80%
        {" · "}<span style={{ color: "#3b82f6" }}>■</span> 60-79%
        {" · "}<span style={{ color: "#f97316" }}>■</span> 40-59%
        {" · "}<span style={{ color: "#ef4444" }}>■</span> &lt;40%
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Verify it compiles**

Run: `cd ~/Claude-Code/saleszone && npx next lint src/components/dashboard/resultados-szs-view.tsx`

- [ ] **Step 7: Commit**

```bash
git add src/components/dashboard/resultados-szs-view.tsx
git commit -m "feat(szs): add ResultadosSZSView component with progress bars, charts, snapshots"
```

---

### Task 3: Wire up Header + page.tsx

**Files:**
- Modify: `src/components/dashboard/header.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add "resultados-szs" to the header dropdown**

In `src/components/dashboard/header.tsx`, find the `RESULTADOS_VIEWS` array and add the new view:

```typescript
// Change:
const RESULTADOS_VIEWS = ["resultados", "acompanhamento", "forecast", "mensal"] as const;
// To:
const RESULTADOS_VIEWS = ["resultados", "acompanhamento", "forecast", "mensal", "resultados-szs"] as const;
```

Then find where the Resultados dropdown items are rendered (the array of `{ key, label, icon }` objects) and add:

```typescript
{ key: "resultados-szs", label: "Resultados SZS", icon: <BarChart3 size={13} /> },
```

This item should only show when `activeModule === "szs"`. Wrap it with a conditional:

```typescript
...(activeModule === "szs" ? [{ key: "resultados-szs", label: "Resultados SZS", icon: <BarChart3 size={13} /> }] : []),
```

Note: `activeModule` is the `moduleConfig.id` passed to the Header component. Check the Header props to confirm the prop name — it may be `moduleConfig` (with `moduleConfig.id`) or a direct `activeModule` string. Use whichever is available.

- [ ] **Step 2: Add state and fetch in page.tsx**

In `src/app/page.tsx`, add the import and state:

```typescript
import { ResultadosSZSView } from "@/components/dashboard/resultados-szs-view";

// Add to state declarations:
const [resultadosSZSData, setResultadosSZSData] = useState<any>(null);
```

Add the fetch function (following existing pattern):

```typescript
const fetchResultadosSZS = useCallback(async () => {
  const res = await fetch(`/api/szs/resultados`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  setResultadosSZSData(data);
}, []);
```

Add it to the view switch that triggers fetches when `mainView` changes. Find the `useEffect` that watches `mainView` and add a case:

```typescript
if (mainView === "resultados-szs") fetchResultadosSZS();
```

- [ ] **Step 3: Add render case in page.tsx**

Find the conditional rendering section and add:

```typescript
{mainView === "resultados-szs" && (
  <ResultadosSZSView
    data={resultadosSZSData}
    loading={loading}
    lastUpdated={lastUpdated}
  />
)}
```

- [ ] **Step 4: Build and test**

Run: `cd ~/Claude-Code/saleszone && npm run build`

Expected: Build succeeds with no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/dashboard/header.tsx src/app/page.tsx
git commit -m "feat(szs): wire up Resultados SZS tab in header and page routing"
```

---

### Task 4: Manual Testing and Polish

- [ ] **Step 1: Start dev server**

Run: `cd ~/Claude-Code/saleszone && npm run dev`

- [ ] **Step 2: Test in browser**

1. Open `http://localhost:3000` (or 3001 if 3000 is busy)
2. Switch to SZS module
3. Open "Resultados" dropdown — verify "Resultados SZS" appears
4. Click it — verify the 3 channel cards render
5. Check progress bars show correct colors
6. Check charts render (may show "Dados insuficientes" if no historical data)
7. Hover ⓘ tooltip — verify filter description shows
8. Toggle 30d/60d/90d — verify charts update
9. Check snapshot boxes show numbers
10. Switch to SZI module — verify "Resultados SZS" is NOT in dropdown

- [ ] **Step 3: Fix any visual issues found during testing**

Adjust spacing, font sizes, or colors as needed to match the approved mockup.

- [ ] **Step 4: Final build check**

Run: `cd ~/Claude-Code/saleszone && npm run build`

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(szs): polish Resultados SZS visual adjustments"
```

---

### Task 5: Create PR

- [ ] **Step 1: Push and create PR**

```bash
git push origin HEAD
gh pr create --title "feat: Resultados SZS — monthly results by macro-channel" --body "$(cat <<'EOF'
## Summary
- New tab "Resultados SZS" in Resultados dropdown (visible only in SZS module)
- Shows 3 macro-channels: Vendas Diretas, Parceiros, Expansão
- Progress bars (real/meta) for Orçamento, Leads, MQL, SQL, OPP, Ganhos
- Deal evolution charts (area + multi-line) with 30d/60d/90d toggle
- Snapshot boxes: Aguardando Dados, Em Contrato, Ocupação Agenda
- Tooltip ⓘ showing exact DB filter per channel

## Files
- `src/app/api/szs/resultados/route.ts` — new API route
- `src/components/dashboard/resultados-szs-view.tsx` — new view component
- `src/components/dashboard/header.tsx` — add menu item
- `src/app/page.tsx` — routing + state

## Test plan
- [ ] SZS module: Resultados SZS tab visible and renders 3 channels
- [ ] Progress bars colored by % atingimento
- [ ] Charts render with historical data
- [ ] Tooltip shows filter description
- [ ] SZI/MKTP: tab not visible
- [ ] Build passes

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```
