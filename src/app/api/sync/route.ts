import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300; // 5 min

// Each step runs as a separate Edge Function call to stay within 150MB memory limit.
// Order matters: daily-open replaces counts, won/lost merge into existing.
const FUNCTION_MAP: Record<string, Array<{ name: string; body?: Record<string, unknown> }>> = {
  "meta-ads": [{ name: "sync-squad-meta-ads" }],
  // Full dashboard sync (used by pg_cron)
  dashboard: [
    { name: "sync-squad-dashboard", body: { mode: "daily-open" } },
    { name: "sync-squad-dashboard", body: { mode: "daily-won" } },
    { name: "sync-squad-dashboard", body: { mode: "daily-lost" } },
    { name: "sync-squad-dashboard", body: { mode: "alignment" } },
    { name: "sync-squad-dashboard", body: { mode: "metas" } },
    { name: "sync-squad-dashboard", body: { mode: "monthly-rollup" } },
  ],
  // Light dashboard: skip daily-lost (58k+ deals, estoura memória). Cron cuida do lost a cada 2h.
  "dashboard-light": [
    { name: "sync-squad-dashboard", body: { mode: "daily-open" } },
    { name: "sync-squad-dashboard", body: { mode: "daily-won" } },
    { name: "sync-squad-dashboard", body: { mode: "alignment" } },
    { name: "sync-squad-dashboard", body: { mode: "metas" } },
    { name: "sync-squad-dashboard", body: { mode: "monthly-rollup" } },
  ],
  calendar: [{ name: "sync-squad-calendar" }],
  presales: [{ name: "sync-squad-presales" }],
  baserow: [{ name: "sync-baserow-forms" }],
  // Full deals sync (used by pg_cron)
  deals: [
    { name: "sync-squad-deals", body: { mode: "deals-open" } },
    { name: "sync-squad-deals", body: { mode: "deals-won" } },
    { name: "sync-squad-deals", body: { mode: "deals-lost" } },
    { name: "sync-squad-deals", body: { mode: "deals-flow" } },
  ],
  // Light deals: skip deals-lost (pesado, batched 5000) e deals-flow (500/batch, timeout). Cron cuida.
  "deals-light": [
    { name: "sync-squad-deals", body: { mode: "deals-open" } },
    { name: "sync-squad-deals", body: { mode: "deals-won" } },
  ],
  // --- MKTP (Marketplace) sync functions ---
  "mktp-dashboard": [
    { name: "sync-mktp-dashboard", body: { mode: "daily-open" } },
    { name: "sync-mktp-dashboard", body: { mode: "daily-won" } },
    { name: "sync-mktp-dashboard", body: { mode: "daily-lost" } },
    { name: "sync-mktp-dashboard", body: { mode: "alignment" } },
    { name: "sync-mktp-dashboard", body: { mode: "metas" } },
    { name: "sync-mktp-dashboard", body: { mode: "monthly-rollup" } },
  ],
  "mktp-dashboard-light": [
    { name: "sync-mktp-dashboard", body: { mode: "daily-open" } },
    { name: "sync-mktp-dashboard", body: { mode: "daily-won" } },
    { name: "sync-mktp-dashboard", body: { mode: "alignment" } },
    { name: "sync-mktp-dashboard", body: { mode: "metas" } },
    { name: "sync-mktp-dashboard", body: { mode: "monthly-rollup" } },
  ],
  "mktp-meta-ads": [{ name: "sync-mktp-meta-ads" }],
  "mktp-calendar": [{ name: "sync-mktp-calendar" }],
  "mktp-presales": [{ name: "sync-mktp-presales" }],
  "mktp-deals": [
    { name: "sync-mktp-deals", body: { mode: "deals-open" } },
    { name: "sync-mktp-deals", body: { mode: "deals-won" } },
    { name: "sync-mktp-deals", body: { mode: "deals-lost" } },
    { name: "sync-mktp-deals", body: { mode: "deals-flow" } },
  ],
  "mktp-deals-light": [
    { name: "sync-mktp-deals", body: { mode: "deals-open" } },
    { name: "sync-mktp-deals", body: { mode: "deals-won" } },
  ],
  // --- SZS (Serviços) sync functions ---
  "szs-dashboard": [
    { name: "sync-szs-dashboard", body: { mode: "daily-open" } },
    { name: "sync-szs-dashboard", body: { mode: "daily-won" } },
    { name: "sync-szs-dashboard", body: { mode: "daily-lost" } },
    { name: "sync-szs-dashboard", body: { mode: "alignment" } },
    { name: "sync-szs-dashboard", body: { mode: "metas" } },
    { name: "sync-szs-dashboard", body: { mode: "monthly-rollup" } },
  ],
  "szs-dashboard-light": [
    { name: "sync-szs-dashboard", body: { mode: "daily-open" } },
    { name: "sync-szs-dashboard", body: { mode: "daily-won" } },
    { name: "sync-szs-dashboard", body: { mode: "alignment" } },
    { name: "sync-szs-dashboard", body: { mode: "metas" } },
    { name: "sync-szs-dashboard", body: { mode: "monthly-rollup" } },
  ],
  "szs-meta-ads": [{ name: "sync-szs-meta-ads" }],
  "szs-calendar": [{ name: "sync-szs-calendar" }],
  "szs-presales": [{ name: "sync-szs-presales" }],
  "szs-deals": [
    { name: "sync-szs-deals", body: { mode: "deals-open" } },
    { name: "sync-szs-deals", body: { mode: "deals-won" } },
    { name: "sync-szs-deals", body: { mode: "deals-lost" } },
    { name: "sync-szs-deals", body: { mode: "deals-flow" } },
  ],
  "szs-deals-light": [
    { name: "sync-szs-deals", body: { mode: "deals-open" } },
    { name: "sync-szs-deals", body: { mode: "deals-won" } },
  ],
};

// Pipedrive function groups — dashboard and deals/presales hit different endpoints,
// so they can run in parallel sub-tracks without 429 risk.
const PIPEDRIVE_DASHBOARD = new Set([
  "dashboard", "dashboard-light",
  "mktp-dashboard", "mktp-dashboard-light",
  "szs-dashboard", "szs-dashboard-light",
]);
const PIPEDRIVE_DEALS = new Set([
  "deals", "deals-light", "presales",
  "mktp-deals", "mktp-deals-light", "mktp-presales",
  "szs-deals", "szs-deals-light", "szs-presales",
]);
const PIPEDRIVE_ALL = new Set([...PIPEDRIVE_DASHBOARD, ...PIPEDRIVE_DEALS]);

// DB-only modes that don't hit external APIs — no delay needed before them
const DB_ONLY_MODES = new Set(["metas", "monthly-rollup"]);

interface SyncRequest {
  functions: string[];
}

interface FunctionResult {
  function: string;
  status: "success" | "error";
  error?: string;
}

const CALL_TIMEOUT = 30_000; // 30s per Edge Function call
const RETRY_DELAY = 5_000;   // 5s before retry
const PIPEDRIVE_DELAY = 2_000; // 2s between Pipedrive calls (safe — rate limit is 80 req/2s)

async function callEdgeFunction(
  supabaseUrl: string,
  supabaseKey: string,
  step: { name: string; body?: Record<string, unknown> },
  label: string,
): Promise<FunctionResult> {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const response = await fetch(`${supabaseUrl}/functions/v1/${step.name}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${supabaseKey}`,
        },
        body: step.body ? JSON.stringify(step.body) : undefined,
        signal: AbortSignal.timeout(CALL_TIMEOUT),
      });
      if (!response.ok) {
        const text = await response.text();
        // Retry on 504 (gateway timeout)
        if (response.status === 504 && attempt === 0) {
          await new Promise((r) => setTimeout(r, RETRY_DELAY));
          continue;
        }
        return { function: label, status: "error", error: `${response.status}: ${text}` };
      }
      return { function: label, status: "success" };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      // Retry on timeout (AbortError)
      if (attempt === 0 && err instanceof Error && (err.name === "TimeoutError" || err.name === "AbortError")) {
        await new Promise((r) => setTimeout(r, RETRY_DELAY));
        continue;
      }
      return { function: label, status: "error", error: msg };
    }
  }
  return { function: label, status: "error", error: "Max retries exceeded" };
}

// Run steps sequentially with 2s delay between real Pipedrive calls (skip DB-only)
async function runSequentialTrack(
  steps: Step[],
  supabaseUrl: string,
  supabaseKey: string,
): Promise<FunctionResult[]> {
  const results: FunctionResult[] = [];
  let lastWasPipedrive = false;

  for (const { label, step } of steps) {
    const mode = step.body?.mode as string | undefined;
    const isDbOnly = mode ? DB_ONLY_MODES.has(mode) : false;

    if (!isDbOnly && lastWasPipedrive) {
      await new Promise((r) => setTimeout(r, PIPEDRIVE_DELAY));
    }

    results.push(await callEdgeFunction(supabaseUrl, supabaseKey, step, label));
    lastWasPipedrive = !isDbOnly;
  }
  return results;
}

type Step = { label: string; step: { name: string; body?: Record<string, unknown> } };

export async function POST(request: Request) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { error: "Supabase environment variables not configured" },
      { status: 500 },
    );
  }

  let body: SyncRequest;
  try {
    body = (await request.json()) as SyncRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.functions) || body.functions.length === 0) {
    return NextResponse.json(
      { error: "Missing or empty 'functions' array" },
      { status: 400 },
    );
  }

  const invalid = body.functions.filter((f) => !(f in FUNCTION_MAP));
  if (invalid.length > 0) {
    return NextResponse.json(
      { error: `Unknown functions: ${invalid.join(", ")}` },
      { status: 400 },
    );
  }

  // 3 parallel tracks:
  // Track A: non-Pipedrive (meta-ads, calendar, baserow) — all in Promise.all
  // Track B: dashboard Pipedrive (daily-open → daily-won → alignment → metas → rollup)
  // Track C: deals Pipedrive (deals-open → deals-won → presales)
  // B and C hit different Pipedrive endpoints, safe to parallelize.
  const trackA: Step[] = [];
  const trackB: Step[] = [];
  const trackC: Step[] = [];

  for (const fn of body.functions) {
    const steps = FUNCTION_MAP[fn];
    for (const step of steps) {
      const label = `${fn}:${step.body?.mode || step.name}`;
      if (PIPEDRIVE_DASHBOARD.has(fn)) {
        trackB.push({ label, step });
      } else if (PIPEDRIVE_DEALS.has(fn)) {
        trackC.push({ label, step });
      } else {
        trackA.push({ label, step });
      }
    }
  }

  const [trackAResults, trackBResults, trackCResults] = await Promise.all([
    // Track A: all non-Pipedrive in parallel
    trackA.length > 0
      ? Promise.all(trackA.map(({ label, step }) => callEdgeFunction(supabaseUrl, supabaseKey, step, label)))
      : Promise.resolve([]),
    // Track B: dashboard sequential with 2s delays
    runSequentialTrack(trackB, supabaseUrl, supabaseKey),
    // Track C: deals sequential with 2s delays (stagger 1s to avoid both tracks hitting Pipedrive at t=0)
    trackC.length > 0
      ? new Promise<FunctionResult[]>((resolve) => setTimeout(() => resolve(runSequentialTrack(trackC, supabaseUrl, supabaseKey)), 1000))
      : Promise.resolve([]),
  ]);

  const results = [...trackBResults, ...trackCResults, ...trackAResults];
  const hasErrors = results.some((r) => r.status === "error");
  return NextResponse.json({ results }, { status: hasErrors ? 207 : 200 });
}
