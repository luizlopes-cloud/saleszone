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

// Pipedrive-dependent function keys (need rate-limit delays between calls)
const PIPEDRIVE_FUNCTIONS = new Set([
  "dashboard", "dashboard-light", "deals", "deals-light", "presales",
  "mktp-dashboard", "mktp-dashboard-light", "mktp-deals", "mktp-deals-light", "mktp-presales",
  "szs-dashboard", "szs-dashboard-light", "szs-deals", "szs-deals-light", "szs-presales",
]);

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
const PIPEDRIVE_DELAY = 4_000; // 4s between Pipedrive calls

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

  // Split into Track A (non-Pipedrive, run in parallel) and Track B (Pipedrive, sequential with delays)
  type Step = { label: string; step: { name: string; body?: Record<string, unknown> } };
  const trackA: Step[] = []; // non-Pipedrive: meta-ads, calendar, baserow — run all in parallel
  const trackB: Step[] = []; // Pipedrive-dependent: sequential with 4s delays (except DB-only modes)

  for (const fn of body.functions) {
    const steps = FUNCTION_MAP[fn];
    for (const step of steps) {
      const label = `${fn}:${step.body?.mode || step.name}`;
      if (PIPEDRIVE_FUNCTIONS.has(fn)) {
        trackB.push({ label, step });
      } else {
        trackA.push({ label, step });
      }
    }
  }

  // Track A: all non-Pipedrive calls in parallel
  const runTrackA = async (): Promise<FunctionResult[]> => {
    if (trackA.length === 0) return [];
    return Promise.all(
      trackA.map(({ label, step }) => callEdgeFunction(supabaseUrl, supabaseKey, step, label)),
    );
  };

  // Track B: Pipedrive calls sequential, 4s delay between real Pipedrive calls, no delay before DB-only
  const runTrackB = async (): Promise<FunctionResult[]> => {
    const results: FunctionResult[] = [];
    let lastWasPipedrive = false;

    for (const { label, step } of trackB) {
      const mode = step.body?.mode as string | undefined;
      const isDbOnly = mode ? DB_ONLY_MODES.has(mode) : false;

      // Add delay only between consecutive real Pipedrive API calls (skip for DB-only)
      if (!isDbOnly && lastWasPipedrive) {
        await new Promise((r) => setTimeout(r, PIPEDRIVE_DELAY));
      }

      const result = await callEdgeFunction(supabaseUrl, supabaseKey, step, label);
      results.push(result);

      lastWasPipedrive = !isDbOnly;
    }
    return results;
  };

  // Run both tracks in parallel
  const [trackAResults, trackBResults] = await Promise.all([runTrackA(), runTrackB()]);
  const results = [...trackBResults, ...trackAResults];

  const hasErrors = results.some((r) => r.status === "error");
  return NextResponse.json({ results }, { status: hasErrors ? 207 : 200 });
}
