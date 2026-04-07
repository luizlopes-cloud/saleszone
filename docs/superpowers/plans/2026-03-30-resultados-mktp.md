# Resultados Marketplace — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar aba "Resultados MKTP" no dropdown Resultados, exibindo funil mensal do Marketplace por canal (Vendas Diretas, Parcerias, Funil Completo), replicando o padrão da aba Resultados SZS.

**Architecture:** Adicionar coluna `canal_group` ao `mktp_daily_counts`, modificar a Edge Function `sync-mktp-dashboard` para gravar o canal de cada deal (removendo o filtro marketing-only), criar API route `/api/mktp/resultados` e view component `resultados-mktp-view.tsx`, registrar no header e page.tsx.

**Tech Stack:** Next.js 16 (App Router), Supabase (PostgreSQL), Edge Functions (Deno), React 19, TypeScript, SVG inline charts

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `supabase/migrations/XXXXXX_add_canal_group_to_mktp_daily_counts.sql` | Add `canal_group` column + update PK |
| Modify | `supabase/functions/sync-mktp-dashboard/index.ts` | Add canal group mapping, remove marketing-only filter, include canal_group in key/insert |
| Create | `src/app/api/mktp/resultados/route.ts` | GET endpoint aggregating MKTP data by canal |
| Create | `src/components/dashboard/resultados-mktp-view.tsx` | React view with 3 cards (Vendas Diretas, Parcerias, Funil Completo) |
| Modify | `src/components/dashboard/header.tsx:14,145` | Add "Resultados MKTP" to dropdown, conditional on activeModule === "mktp" |
| Modify | `src/app/page.tsx:64,125,417-429,522-523,555,727-733` | State, fetch, lazy-load, cache clear, render case |

---

### Task 1: Migration — Add `canal_group` to `mktp_daily_counts`

**Files:**
- Create: `supabase/migrations/20260330200000_add_canal_group_to_mktp_daily_counts.sql`

- [ ] **Step 1: Create migration file**

```sql
-- Add canal_group column to mktp_daily_counts
-- Follows same pattern as szs_daily_counts (which has canal_group since creation)

-- 1. Add column with default so existing rows get a value
ALTER TABLE mktp_daily_counts
  ADD COLUMN IF NOT EXISTS canal_group TEXT NOT NULL DEFAULT 'Marketing';

-- 2. Drop existing PK (date, tab, empreendimento, source)
ALTER TABLE mktp_daily_counts DROP CONSTRAINT IF EXISTS mktp_daily_counts_pkey;

-- 3. Recreate PK including canal_group
ALTER TABLE mktp_daily_counts
  ADD CONSTRAINT mktp_daily_counts_pkey
  PRIMARY KEY (date, tab, canal_group, empreendimento, source);
```

- [ ] **Step 2: Apply migration**

Run:
```bash
cd ~/Claude-Code/saleszone && npx supabase db push
```

Expected: Migration applied successfully. Existing rows get `canal_group = 'Marketing'` (correct since current sync only saved marketing deals).

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260330200000_add_canal_group_to_mktp_daily_counts.sql
git commit -m "feat: add canal_group column to mktp_daily_counts"
```

---

### Task 2: Edge Function — Add canal group to `sync-mktp-dashboard`

**Files:**
- Modify: `supabase/functions/sync-mktp-dashboard/index.ts`

- [ ] **Step 1: Add canal group mapping after existing constants (~line 16)**

After `const CANAL_MARKETING_ID = "12";` add:

```typescript
/* ── Canal-group mapping (same IDs as SZS — shared Pipedrive field) ── */
const MKTP_CANAL_GROUPS: Record<string, string> = {
  "582": "Parcerias",    // Indicação de Corretor
  "583": "Parcerias",    // Indicação de Franquia
  "2876": "Parcerias",   // Indicação de Outros Parceiros
};

function getCanalGroup(deal: any): string {
  const canal = String(deal[FIELD_CANAL] || "");
  return MKTP_CANAL_GROUPS[canal] || "Vendas Diretas";
}
```

- [ ] **Step 2: Remove `isMarketingDeal` filter gate**

In the deal counting loop (around lines 140-165), the current code skips non-marketing deals:
```typescript
if (!isMarketingDeal(deal)) continue;
```

Replace with:
```typescript
// Count ALL deals (not just marketing) — canal_group distinguishes them
```

Remove or comment out the `if (!isMarketingDeal(deal)) continue;` line. Keep the `isMarketingDeal` function itself (it may be used elsewhere).

**IMPORTANT:** Verify that removing this filter doesn't break other modes (alignment, metas, monthly-rollup). Check each mode's loop to see if it has its own filter or relies on the shared one. If `isMarketingDeal` is only used in `daily-open` and `daily-won` counting loops, it's safe to remove from those loops only.

- [ ] **Step 3: Update key construction to include canal_group**

Current key (line ~164):
```typescript
const key = `${day}|${emp}`;
```

Change to:
```typescript
const canalGroup = getCanalGroup(deal);
const key = `${day}|${canalGroup}|${emp}`;
```

- [ ] **Step 4: Update insert row mapping**

Current insert (line ~177-180):
```typescript
const [date, empreendimento] = key.split("|");
return { date, tab, empreendimento, count, source, synced_at: new Date().toISOString() };
```

Change to:
```typescript
const [date, canal_group, empreendimento] = key.split("|");
return { date, tab, canal_group, empreendimento, count, source, synced_at: new Date().toISOString() };
```

- [ ] **Step 5: Deploy Edge Function**

Run:
```bash
cd ~/Claude-Code/saleszone && npx supabase functions deploy sync-mktp-dashboard --no-verify-jwt
```

- [ ] **Step 6: Trigger sync to populate canal_group data**

Via Supabase dashboard or API, invoke the sync with modes `daily-open` and `daily-won` to repopulate `mktp_daily_counts` with the new `canal_group` column.

- [ ] **Step 7: Commit**

```bash
git add supabase/functions/sync-mktp-dashboard/index.ts
git commit -m "feat: add canal_group to mktp sync (Vendas Diretas / Parcerias)"
```

---

### Task 3: API Route — `/api/mktp/resultados`

**Files:**
- Create: `src/app/api/mktp/resultados/route.ts`

Reference: `src/app/api/szs/resultados/route.ts` (copy and adapt)

- [ ] **Step 1: Create the API route**

```typescript
import { NextResponse } from "next/server";
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase";
import { paginate } from "@/lib/paginate";

/* ── Canal mapping ────────────────────────────────── */
const CHANNEL_ORDER = ["Vendas Diretas", "Parcerias", "Funil Completo"] as const;

const CHANNEL_FILTERS: Record<string, string> = {
  "Vendas Diretas": "canal_group = 'Vendas Diretas' — todos os canais exceto parcerias",
  "Parcerias": "canal_group = 'Parcerias' (Indicação Corretor + Indicação Franquia)",
  "Funil Completo": "Todos os canais sem filtro",
};

interface ChannelMetas {
  orcamento?: number;
  leads?: number;
  mql: number;
  sql: number;
  opp: number;
  won: number;
}

// Metas hardcoded por mês/canal (preencher com valores reais)
const MKTP_RESULTADOS_METAS: Record<string, Record<string, ChannelMetas>> = {
  "2026-03": {
    "Vendas Diretas": { mql: 0, sql: 0, opp: 0, won: 0 },
    "Parcerias": { mql: 0, sql: 0, opp: 0, won: 0 },
    "Funil Completo": { mql: 0, sql: 0, opp: 0, won: 0 },
  },
};

const CHANNEL_CLOSERS: Record<string, string[]> = {
  "Vendas Diretas": ["Nevine", "Willian Miranda"],
  "Parcerias": [],
  "Funil Completo": ["Nevine", "Willian Miranda"],
};

const MEETINGS_PER_DAY = 16;
const WORK_DAYS_PER_WEEK = 5;

// MKTP pipeline 37 stages — verify actual stage_order values
const STAGE_AG_DADOS = 152;  // Adjust to MKTP pipeline stages
const STAGE_CONTRATO = 76;   // Adjust to MKTP pipeline stages
const STAGE_AGENDADO = 73;   // Adjust to MKTP pipeline stages

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

interface ResultadosMKTPData {
  month: string;
  channels: ChannelResult[];
}

export const dynamic = "force-dynamic";

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

    /* ── Current month counts by canal_group ── */
    const countsRows = await paginate((o, ps) =>
      admin.from("mktp_daily_counts").select("date, tab, canal_group, count").gte("date", startDate).range(o, o + ps - 1)
    );

    // Aggregate by canal_group and also build "Funil Completo" (all canals)
    const channelCounts: Record<string, Record<string, number>> = {};
    for (const ch of CHANNEL_ORDER) channelCounts[ch] = {};
    for (const r of countsRows) {
      const group = r.canal_group as string;
      const tab = r.tab as string;
      const count = r.count || 0;
      // Add to specific canal
      if (channelCounts[group]) {
        channelCounts[group][tab] = (channelCounts[group][tab] || 0) + count;
      }
      // Always add to Funil Completo
      channelCounts["Funil Completo"][tab] = (channelCounts["Funil Completo"][tab] || 0) + count;
    }

    /* ── Previous month WON by canal_group ── */
    const prevRows = await paginate((o, ps) =>
      admin.from("mktp_daily_counts").select("canal_group, count").eq("tab", "won").gte("date", prevStart).lte("date", prevEnd).range(o, o + ps - 1)
    );
    const prevWon: Record<string, number> = {};
    for (const r of prevRows) {
      const group = r.canal_group as string;
      prevWon[group] = (prevWon[group] || 0) + (r.count || 0);
      prevWon["Funil Completo"] = (prevWon["Funil Completo"] || 0) + (r.count || 0);
    }

    /* ── Meta Ads spend (only applies to Vendas Diretas / Funil Completo) ── */
    const metaRows = await paginate((o, ps) =>
      admin.from("mktp_meta_ads").select("spend_month").range(o, o + ps - 1)
    );
    let totalSpend = 0;
    for (const r of metaRows) totalSpend += r.spend_month || 0;

    /* ── Deal snapshots (Ag. Dados, Contrato, Agendado) ── */
    const snapshotDeals = await paginate((o, ps) =>
      admin.from("mktp_deals").select("stage_id, canal, status").eq("status", "open").range(o, o + ps - 1)
    );

    // Map canal → group for deals
    const DEAL_CANAL_GROUPS: Record<string, string> = {
      "582": "Parcerias",
      "583": "Parcerias",
      "2876": "Parcerias",
    };
    function dealCanalGroup(canal: string): string {
      return DEAL_CANAL_GROUPS[canal] || "Vendas Diretas";
    }

    const snapshots: Record<string, { agDados: number; contrato: number; agendado: number }> = {};
    for (const ch of CHANNEL_ORDER) snapshots[ch] = { agDados: 0, contrato: 0, agendado: 0 };
    for (const d of snapshotDeals) {
      const group = dealCanalGroup(d.canal || "");
      const stageId = d.stage_id;
      if (stageId === STAGE_AG_DADOS) {
        snapshots[group].agDados++;
        snapshots["Funil Completo"].agDados++;
      } else if (stageId === STAGE_CONTRATO) {
        snapshots[group].contrato++;
        snapshots["Funil Completo"].contrato++;
      } else if (stageId === STAGE_AGENDADO) {
        snapshots[group].agendado++;
        snapshots["Funil Completo"].agendado++;
      }
    }

    /* ── History (90d) for charts ── */
    const historyRows = await paginate((o, ps) =>
      admin.from("mktp_daily_counts").select("date, tab, canal_group, count").gte("date", cutoffDate).range(o, o + ps - 1)
    );
    const histMap: Record<string, Map<string, Record<string, number>>> = {};
    for (const ch of CHANNEL_ORDER) histMap[ch] = new Map();
    for (const r of historyRows) {
      const group = r.canal_group as string;
      const date = r.date as string;
      const tab = r.tab as string;
      const count = r.count || 0;

      // Specific canal
      if (histMap[group]) {
        if (!histMap[group].has(date)) histMap[group].set(date, {});
        const entry = histMap[group].get(date)!;
        entry[tab] = (entry[tab] || 0) + count;
      }

      // Funil Completo
      if (!histMap["Funil Completo"].has(date)) histMap["Funil Completo"].set(date, {});
      const entryAll = histMap["Funil Completo"].get(date)!;
      entryAll[tab] = (entryAll[tab] || 0) + count;
    }

    /* ── Build response ── */
    const metas = MKTP_RESULTADOS_METAS[monthKey] || {};
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

    const body: ResultadosMKTPData = { month: monthKey, channels };
    return NextResponse.json(body);
  } catch (err: unknown) {
    console.error("[mktp/resultados]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
```

**IMPORTANT:** The stage IDs (STAGE_AG_DADOS, STAGE_CONTRATO, STAGE_AGENDADO) above are from the SZS pipeline 14. MKTP uses pipeline 37 which has different stages. Check the actual stage IDs for pipeline 37 by querying `mktp_deals` or checking the Pipedrive pipeline configuration. If MKTP doesn't have equivalent stages, remove the snapshots section or adapt to MKTP's funnel stages.

- [ ] **Step 2: Verify stage IDs for MKTP pipeline 37**

Run a quick query to see what stage_id values exist in mktp_deals:
```bash
# Via Supabase SQL editor or curl
# SELECT DISTINCT stage_id FROM mktp_deals WHERE status = 'open' ORDER BY stage_id;
```

Update STAGE_AG_DADOS, STAGE_CONTRATO, STAGE_AGENDADO constants to match MKTP pipeline stages.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mktp/resultados/route.ts
git commit -m "feat: add /api/mktp/resultados endpoint"
```

---

### Task 4: View Component — `resultados-mktp-view.tsx`

**Files:**
- Create: `src/components/dashboard/resultados-mktp-view.tsx`

Reference: `src/components/dashboard/resultados-szs-view.tsx` (copy and adapt)

- [ ] **Step 1: Create the view component**

Copy `resultados-szs-view.tsx` entirely and make these changes:

1. Rename exported component: `ResultadosSZSView` → `ResultadosMKTPView`
2. Rename interfaces: `ResultadosSZSData` → `ResultadosMKTPData`
3. Update CHANNEL_ICONS:
```typescript
const CHANNEL_ICONS: Record<string, string> = {
  "Vendas Diretas": "🎯",
  "Parcerias": "🤝",
  "Funil Completo": "📊",
};
```

4. Update CHANNEL_ACCENT:
```typescript
const CHANNEL_ACCENT: Record<string, string> = {
  "Vendas Diretas": "rgba(59,130,246,0.04)",
  "Parcerias": "rgba(168,85,247,0.04)",
  "Funil Completo": "rgba(34,197,94,0.04)",
};
```

Everything else stays identical — same ProgressBar, AreaChart, MultiLineChart, ChannelCard components, same layout, same color logic.

- [ ] **Step 2: Commit**

```bash
git add src/components/dashboard/resultados-mktp-view.tsx
git commit -m "feat: add ResultadosMKTPView component"
```

---

### Task 5: Header — Add "Resultados MKTP" to dropdown

**Files:**
- Modify: `src/components/dashboard/header.tsx`

- [ ] **Step 1: Add "resultados-mktp" to RESULTADOS_VIEWS constant**

Line 14, change:
```typescript
const RESULTADOS_VIEWS = ["resultados", "acompanhamento", "forecast", "mensal", "resultados-szs"] as const;
```
to:
```typescript
const RESULTADOS_VIEWS = ["resultados", "acompanhamento", "forecast", "mensal", "resultados-szs", "resultados-mktp"] as const;
```

- [ ] **Step 2: Add conditional dropdown item for MKTP**

Line 145, after the SZS conditional spread:
```typescript
...(activeModule === "szs" ? [{ key: "resultados-szs", label: "Resultados SZS", icon: <BarChart3 size={13} /> }] : []),
```

Add:
```typescript
...(activeModule === "mktp" ? [{ key: "resultados-mktp", label: "Resultados MKTP", icon: <BarChart3 size={13} /> }] : []),
```

- [ ] **Step 3: Commit**

```bash
git add src/components/dashboard/header.tsx
git commit -m "feat: add Resultados MKTP to header dropdown"
```

---

### Task 6: page.tsx — State, fetch, render

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Add import (near line 64)**

After `import { ResultadosSZSView } from "@/components/dashboard/resultados-szs-view";`:
```typescript
import { ResultadosMKTPView } from "@/components/dashboard/resultados-mktp-view";
```

- [ ] **Step 2: Add state variable (near line 125)**

After `const [resultadosSZSData, setResultadosSZSData] = useState<any>(null);`:
```typescript
const [resultadosMKTPData, setResultadosMKTPData] = useState<any>(null);
```

- [ ] **Step 3: Add fetch function (near line 429, after fetchResultadosSZS)**

```typescript
const fetchResultadosMKTP = useCallback(async () => {
  setLoading(true);
  try {
    const res = await fetch(`/api/mktp/resultados`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    setResultadosMKTPData(data);
  } catch (err) {
    console.error("Fetch resultados MKTP error:", err);
  } finally {
    setLoading(false);
  }
}, []);
```

- [ ] **Step 4: Add lazy-load trigger (near line 522-523)**

After the `resultados-szs` lazy-load block:
```typescript
} else if (mainView === "resultados-mktp" && !resultadosMKTPData) {
  fetchResultadosMKTP();
}
```

- [ ] **Step 5: Add cache clear (near line 555, inside clearAllCaches)**

After `setResultadosSZSData(null);`:
```typescript
setResultadosMKTPData(null);
```

- [ ] **Step 6: Add render case (near line 733, after resultados-szs render)**

```typescript
{mainView === "resultados-mktp" && (
  <ResultadosMKTPView
    data={resultadosMKTPData}
    loading={loading}
    lastUpdated={lastUpdated}
  />
)}
```

- [ ] **Step 7: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat: wire ResultadosMKTPView in page.tsx"
```

---

### Task 7: Verify and adjust MKTP pipeline stages

**Files:**
- Possibly modify: `src/app/api/mktp/resultados/route.ts`

- [ ] **Step 1: Check MKTP pipeline 37 stages**

Query Supabase to find actual stage IDs used in mktp_deals:
```sql
SELECT DISTINCT stage_id, COUNT(*) as cnt
FROM mktp_deals
WHERE status = 'open'
GROUP BY stage_id
ORDER BY stage_id;
```

Compare with SZS pipeline 14 stages used in Resultados SZS:
- 152 = Aguardando Dados
- 76 = Contrato
- 73 = Agendado

- [ ] **Step 2: Update stage constants in API route if different**

If MKTP pipeline 37 uses different stage IDs, update `STAGE_AG_DADOS`, `STAGE_CONTRATO`, `STAGE_AGENDADO` in `/api/mktp/resultados/route.ts`.

If MKTP doesn't have equivalent stages (e.g., no "Aguardando Dados"), remove those snapshot boxes from the view or adapt to MKTP's actual funnel stages.

- [ ] **Step 3: Test end-to-end**

```bash
cd ~/Claude-Code/saleszone && npm run build
```

Then run dev server and navigate to MKTP module → Resultados → Resultados MKTP.

- [ ] **Step 4: Commit if changes were needed**

```bash
git add src/app/api/mktp/resultados/route.ts
git commit -m "fix: adjust MKTP stage IDs for pipeline 37"
```

---

### Task 8: Populate metas with real values

**Files:**
- Modify: `src/app/api/mktp/resultados/route.ts`

- [ ] **Step 1: Get real meta values from stakeholder**

The `MKTP_RESULTADOS_METAS` object currently has placeholder zeros. Ask the user for the actual monthly targets for:
- Vendas Diretas: MQL, SQL, OPP, WON (and optionally Orçamento, Leads)
- Parcerias: MQL, SQL, OPP, WON
- Funil Completo: MQL, SQL, OPP, WON

- [ ] **Step 2: Update metas in the API route**

Replace the zeros in `MKTP_RESULTADOS_METAS` with real values.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/mktp/resultados/route.ts
git commit -m "feat: add real MKTP resultados metas for 2026-03"
```
