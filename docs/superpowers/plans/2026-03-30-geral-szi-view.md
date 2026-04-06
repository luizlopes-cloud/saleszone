# Resultados SZNI — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a "Resultados SZNI" tab under Resultados dropdown in the SZI module showing funnel health by channel (Marketing, Parceiros, Geral) with progress bars, charts, and snapshots.

**Architecture:** New API route `/api/dashboard/geral/route.ts` fetches data from `squad_deals`, `squad_meta_ads`, `squad_daily_counts`, and `squad_calendar_events`. Returns `GeralData` with 3 channel cards. Component `geral-view.tsx` already exists with mock data — replace mock with real data from API.

**Tech Stack:** Next.js API Route, Supabase (squad_deals, squad_meta_ads, squad_daily_counts, squad_calendar_events), TypeScript, React

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `src/app/api/dashboard/geral/route.ts` | **Create** | API route: fetch deals by canal, aggregate funnel counts, metas, history |
| `src/components/dashboard/geral-view.tsx` | **Modify** | Remove mock data, accept real data from API |
| `src/app/page.tsx` | **Modify** | Add `geralData` state, `fetchGeral()`, wire to component |
| `src/lib/types.ts` | **Modify** | Add `GeralData` and `GeralChannelResult` types |

---

### Task 1: Add types to `types.ts`

**Files:**
- Modify: `src/lib/types.ts`

- [ ] **Step 1: Add GeralData types at the end of types.ts**

```typescript
// --- Geral (Resultados SZNI) ---
export interface GeralMetricPair { real: number; meta: number }

export interface GeralChannelResult {
  name: string;
  filterDescription: string;
  metrics: {
    orcamento?: GeralMetricPair;
    leads?: GeralMetricPair;
    mql: GeralMetricPair;
    sql: GeralMetricPair;
    opp: GeralMetricPair;
    reserva?: GeralMetricPair;
    contrato?: GeralMetricPair;
    won: GeralMetricPair;
  };
  lastMonthWon: number;
  snapshots?: { reserva: number; contrato: number };
  reservaHistory?: { date: string; reserva: number; contrato: number }[];
  dealsHistory: { date: string; total: number; byStage: Record<string, number> }[];
}

export interface GeralData {
  month: string;
  channels: GeralChannelResult[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat(geral): add GeralData types"
```

---

### Task 2: Create API route `/api/dashboard/geral/route.ts`

**Files:**
- Create: `src/app/api/dashboard/geral/route.ts`

- [ ] **Step 1: Create the API route**

```typescript
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { paginate } from "@/lib/paginate";
import type { GeralData, GeralChannelResult, GeralMetricPair } from "@/lib/types";

export const dynamic = "force-dynamic";

// Canal mapping (same as SZS)
const MARKETING_CANALS = [12];
const PARCEIROS_CANALS = [582, 583, 2876];

// Stage thresholds for squad_deals.max_stage_order (SZI pipeline 28)
// MQL >= 1, SQL >= 5, OPP >= 9, Reserva >= 13, Contrato >= 14, WON = status "won"

// Hardcoded metas per month
const METAS: Record<string, {
  Marketing: { leads: number; mql: number; sql: number; opp: number; won: number };
  Parceiros: { mql: number; sql: number; opp: number; won: number };
  Geral: { mql: number; sql: number; opp: number; reserva: number; contrato: number; won: number };
}> = {
  "2026-03": {
    Marketing: { leads: 9661, mql: 2839, sql: 921, opp: 228, won: 40 },
    Parceiros: { mql: 1348, sql: 524, opp: 260, won: 55 },
    Geral: { mql: 4187, sql: 1445, opp: 488, reserva: 217, contrato: 125, won: 95 },
  },
};

function getChannelKey(canal: number | string | null): "Marketing" | "Parceiros" | "Outros" {
  const c = Number(canal);
  if (MARKETING_CANALS.includes(c)) return "Marketing";
  if (PARCEIROS_CANALS.includes(c)) return "Parceiros";
  return "Outros";
}

interface DealRow {
  deal_id: number;
  canal: string | null;
  status: string;
  max_stage_order: number;
  lost_reason: string | null;
  add_time: string | null;
  won_time: string | null;
  lost_time: string | null;
}

function countFunnel(deals: DealRow[]) {
  let mql = 0, sql = 0, opp = 0, reserva = 0, contrato = 0, won = 0;
  for (const d of deals) {
    if (d.lost_reason === "Duplicado/Erro") continue;
    const ms = d.max_stage_order || 0;
    if (ms >= 1) mql++;
    if (ms >= 5) sql++;
    if (ms >= 9) opp++;
    if (ms >= 13) reserva++;
    if (ms >= 14) contrato++;
    if (d.status === "won") won++;
  }
  return { mql, sql, opp, reserva, contrato, won };
}

export async function GET() {
  try {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const mesStr = `${year}-${String(month).padStart(2, "0")}`;
    const monthStart = `${mesStr}-01`;
    const mesFim = month === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(month + 1).padStart(2, "0")}-01`;

    // Previous month
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonthStart = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const prevMonthEnd = monthStart;

    const admin = createSquadSupabaseAdmin();

    // 1. Fetch all deals closed this month (won or lost) + open deals
    const deals = await paginate((o, ps) =>
      admin
        .from("squad_deals")
        .select("deal_id, canal, status, max_stage_order, lost_reason, add_time, won_time, lost_time")
        .not("empreendimento", "is", null)
        .or(`status.eq.open,won_time.gte.${monthStart},lost_time.gte.${monthStart}`)
        .range(o, o + ps - 1)
    );

    // 2. Fetch previous month won deals
    const prevDeals = await paginate((o, ps) =>
      admin
        .from("squad_deals")
        .select("deal_id, canal, status")
        .eq("status", "won")
        .gte("won_time", prevMonthStart)
        .lt("won_time", prevMonthEnd)
        .range(o, o + ps - 1)
    );

    // 3. Meta Ads spend (Marketing only)
    const metaAdsRows = await paginate((o, ps) =>
      supabase
        .from("squad_meta_ads")
        .select("ad_id, spend_month")
        .gte("snapshot_date", monthStart)
        .range(o, o + ps - 1)
    );

    // Dedup Meta Ads: max spend_month per ad_id
    const adSpend = new Map<string, number>();
    for (const row of metaAdsRows) {
      const cur = adSpend.get(row.ad_id) || 0;
      const val = Number(row.spend_month) || 0;
      if (val > cur) adSpend.set(row.ad_id, val);
    }
    const totalSpend = [...adSpend.values()].reduce((s, v) => s + v, 0);

    // 4. Meta Ads leads (Marketing only)
    const metaLeadsRows = await paginate((o, ps) =>
      supabase
        .from("squad_meta_ads")
        .select("ad_id, leads_month")
        .gte("snapshot_date", monthStart)
        .range(o, o + ps - 1)
    );
    const adLeads = new Map<string, number>();
    for (const row of metaLeadsRows) {
      const cur = adLeads.get(row.ad_id) || 0;
      const val = Number(row.leads_month) || 0;
      if (val > cur) adLeads.set(row.ad_id, val);
    }
    const totalLeads = [...adLeads.values()].reduce((s, v) => s + v, 0);

    // 5. Budget from squad_orcamento
    const { data: orcData } = await supabase
      .from("squad_orcamento")
      .select("valor")
      .eq("mes", mesStr)
      .maybeSingle();
    const budgetMeta = orcData?.valor || 0;

    // 6. Snapshots: open deals in Reserva (stage 191) and Contrato (stage 192) stages
    const { data: snapshotRows } = await admin
      .from("squad_deals")
      .select("deal_id, canal, stage_id")
      .eq("status", "open")
      .in("stage_id", [191, 192]);

    // 7. Calendar events for ocupacao (next 7 days)
    const calStart = now.toISOString().substring(0, 10);
    const calEnd = new Date(now.getTime() + 7 * 86400000).toISOString().substring(0, 10);
    const { data: calEvents } = await supabase
      .from("squad_calendar_events")
      .select("closer, start_time, cancelled")
      .gte("start_time", calStart)
      .lte("start_time", calEnd)
      .eq("cancelled", false);

    // 8. Deals history (last 90 days) from squad_daily_counts
    const cutoff90 = new Date(now);
    cutoff90.setDate(cutoff90.getDate() - 90);
    const cutoffStr = cutoff90.toISOString().substring(0, 10);

    const historyRows = await paginate((o, ps) =>
      supabase
        .from("squad_daily_counts")
        .select("date, tab, count")
        .in("tab", ["mql", "sql", "opp", "won", "reserva", "contrato"])
        .gte("date", cutoffStr)
        .range(o, o + ps - 1)
    );

    // Aggregate history by date
    const histByDate = new Map<string, Record<string, number>>();
    for (const row of historyRows) {
      if (!histByDate.has(row.date)) histByDate.set(row.date, { mql: 0, sql: 0, opp: 0, won: 0, reserva: 0, contrato: 0 });
      const d = histByDate.get(row.date)!;
      d[row.tab] = (d[row.tab] || 0) + (row.count || 0);
    }
    const dealsHistory = [...histByDate.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, byStage]) => ({
        date,
        total: Object.values(byStage).reduce((s, v) => s + v, 0),
        byStage,
      }));

    // --- Aggregate by channel ---
    const mktDeals = deals.filter(d => getChannelKey(d.canal) === "Marketing");
    const parcDeals = deals.filter(d => getChannelKey(d.canal) === "Parceiros");
    // Geral = all deals (no filter)

    const mktFunnel = countFunnel(mktDeals);
    const parcFunnel = countFunnel(parcDeals);
    const geralFunnel = countFunnel(deals);

    // Previous month WON by channel
    const prevMktWon = prevDeals.filter(d => getChannelKey(d.canal) === "Marketing").length;
    const prevParcWon = prevDeals.filter(d => getChannelKey(d.canal) === "Parceiros").length;
    const prevGeralWon = prevDeals.length;

    // Snapshots by channel
    const mktSnapReserva = (snapshotRows || []).filter(d => d.stage_id === 191 && getChannelKey(d.canal) === "Marketing").length;
    const mktSnapContrato = (snapshotRows || []).filter(d => d.stage_id === 192 && getChannelKey(d.canal) === "Marketing").length;
    const parcSnapReserva = (snapshotRows || []).filter(d => d.stage_id === 191 && getChannelKey(d.canal) === "Parceiros").length;
    const parcSnapContrato = (snapshotRows || []).filter(d => d.stage_id === 192 && getChannelKey(d.canal) === "Parceiros").length;

    // Ocupacao agenda
    const MEETINGS_PER_DAY = 16;
    const WORK_DAYS_PER_WEEK = 5;
    const CLOSERS_SZI = 5;
    const agendadas = (calEvents || []).length;
    const capacity = CLOSERS_SZI * MEETINGS_PER_DAY * WORK_DAYS_PER_WEEK;
    const ocupPercent = capacity > 0 ? Math.round((agendadas / capacity) * 1000) / 10 : 0;

    // Metas
    const monthMetas = METAS[mesStr];

    // Build channels
    const channels: GeralChannelResult[] = [];

    // Marketing
    const mktMetas = monthMetas?.Marketing;
    channels.push({
      name: "Marketing",
      filterDescription: "Deals do canal Marketing (canal 12). Inclui leads de midia paga e organico. Orcamento = gasto Meta Ads do mes.",
      metrics: {
        orcamento: { real: Math.round(totalSpend), meta: budgetMeta },
        leads: { real: totalLeads, meta: mktMetas?.leads || 0 },
        mql: { real: mktFunnel.mql, meta: mktMetas?.mql || 0 },
        sql: { real: mktFunnel.sql, meta: mktMetas?.sql || 0 },
        opp: { real: mktFunnel.opp, meta: mktMetas?.opp || 0 },
        won: { real: mktFunnel.won, meta: mktMetas?.won || 0 },
      },
      lastMonthWon: prevMktWon,
      snapshots: { reserva: mktSnapReserva, contrato: mktSnapContrato },
      dealsHistory,
    });

    // Parceiros
    const parcMetas = monthMetas?.Parceiros;
    channels.push({
      name: "Parceiros",
      filterDescription: "Deals de canais de parceiros (Ind. Corretor, Ind. Franquia, Outros Parceiros). Sem investimento Meta Ads.",
      metrics: {
        mql: { real: parcFunnel.mql, meta: parcMetas?.mql || 0 },
        sql: { real: parcFunnel.sql, meta: parcMetas?.sql || 0 },
        opp: { real: parcFunnel.opp, meta: parcMetas?.opp || 0 },
        won: { real: parcFunnel.won, meta: parcMetas?.won || 0 },
      },
      lastMonthWon: prevParcWon,
      snapshots: { reserva: parcSnapReserva, contrato: parcSnapContrato },
      dealsHistory,
    });

    // Geral (all channels)
    const geralMetas = monthMetas?.Geral;
    channels.push({
      name: "Geral",
      filterDescription: "Todos os canais sem filtro. Inclui Marketing, Parceiros e demais canais. Reservas e contratos mostram acumulado no mes.",
      metrics: {
        mql: { real: geralFunnel.mql, meta: geralMetas?.mql || 0 },
        sql: { real: geralFunnel.sql, meta: geralMetas?.sql || 0 },
        opp: { real: geralFunnel.opp, meta: geralMetas?.opp || 0 },
        reserva: { real: geralFunnel.reserva, meta: geralMetas?.reserva || 0 },
        contrato: { real: geralFunnel.contrato, meta: geralMetas?.contrato || 0 },
        won: { real: geralFunnel.won, meta: geralMetas?.won || 0 },
      },
      lastMonthWon: prevGeralWon,
      reservaHistory: dealsHistory
        .filter(h => h.date >= monthStart)
        .map(h => ({ date: h.date, reserva: h.byStage.reserva || 0, contrato: h.byStage.contrato || 0 })),
      dealsHistory,
    });

    const result: GeralData = { month: mesStr, channels };
    return NextResponse.json(result);
  } catch (error) {
    console.error("Geral API error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/dashboard/geral/route.ts
git commit -m "feat(geral): create API route for Resultados SZNI"
```

---

### Task 3: Update `geral-view.tsx` to use real data

**Files:**
- Modify: `src/components/dashboard/geral-view.tsx`

- [ ] **Step 1: Remove mock data and internal type definitions**

Remove the `MOCK_DATA` constant, `generateMockHistory` function, and the local interface definitions (`MetricPair`, `GeralChannelResult`, `GeralData`). Import types from `@/lib/types` instead.

Replace the component to use `data` prop directly (no fallback to MOCK_DATA):

```typescript
// Change the import line at top:
import type { GeralData, GeralChannelResult } from "@/lib/types";

// Remove these local interfaces:
// interface MetricPair { real: number; meta: number }
// interface GeralChannelResult { ... }
// export interface GeralData { ... }

// Update Props to use imported type:
interface Props {
  data: GeralData | null;
  loading: boolean;
  lastUpdated?: Date | null;
}

// In GeralView component, change:
//   const displayData = data || MOCK_DATA;
// to:
//   if (!data) return <div style={...}>Sem dados</div>;
//   const displayData = data;

// Delete the entire MOCK_DATA constant and generateMockHistory function
```

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/geral-view.tsx
git commit -m "feat(geral): remove mock data, use real API types"
```

---

### Task 4: Wire up `page.tsx` with state and fetch

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add state and fetch function**

Add after existing state declarations (near other `useState` lines around line 95-110):
```typescript
const [geralData, setGeralData] = useState<GeralData | null>(null);
```

Add `GeralData` to the import from `@/lib/types`.

Add fetch function after other fetch functions:
```typescript
const fetchGeral = useCallback(async () => {
  setLoading(true);
  try {
    const res = await fetch("/api/dashboard/geral");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setGeralData(data);
  } catch (err) {
    console.error("Fetch geral error:", err);
  } finally {
    setLoading(false);
  }
}, []);
```

- [ ] **Step 2: Add fetch triggers in useEffect**

In the `useEffect` that handles view changes (the one with `mainView` dependency), add:
```typescript
} else if (mainView === "geral" && !geralData) {
  fetchGeral();
}
```

In the refresh handler (after sync completes), add:
```typescript
else if (mainView === "geral") await fetchGeral();
```

- [ ] **Step 3: Update the render section**

Change the existing mock render line:
```typescript
// FROM:
{mainView === "geral" && <GeralView data={null} loading={false} lastUpdated={lastUpdated} />}
// TO:
{mainView === "geral" && <GeralView data={geralData} loading={loading} lastUpdated={lastUpdated} />}
```

- [ ] **Step 4: Clear geralData on sync**

In the sync handler where other data is cleared (search for `setFunilData(null)`), add:
```typescript
setGeralData(null);
```

- [ ] **Step 5: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(geral): wire up state, fetch, and render in page.tsx"
```

---

### Task 5: Test end-to-end

- [ ] **Step 1: Run dev server**

```bash
npm run dev
```

- [ ] **Step 2: Verify in browser**

1. Open `localhost:3000`
2. Select module SZI
3. Click Resultados dropdown — should show "Resultados SZNI" as first option
4. Click "Resultados SZNI"
5. Verify 3 cards appear: Marketing, Parceiros, Geral
6. Verify Marketing card has: Orcamento, Leads, MQL, SQL, OPP, WON bars + snapshots
7. Verify Parceiros card has: MQL, SQL, OPP, WON bars + snapshots (no Orcamento/Leads)
8. Verify Geral card has: MQL, SQL, OPP, Reserva, Contrato, WON bars + acumulado reservas/contratos
9. Check LM (last month) shows correct number

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit all remaining changes**

```bash
git add -A
git commit -m "feat(geral): Resultados SZNI tab complete"
```
