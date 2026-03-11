import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// Each step runs as a separate Edge Function call to stay within 150MB memory limit.
// Order matters: daily-open replaces counts, won/lost merge into existing.
const FUNCTION_MAP: Record<string, Array<{ name: string; body?: Record<string, unknown> }>> = {
  "meta-ads": [{ name: "sync-squad-meta-ads" }],
  dashboard: [
    { name: "sync-squad-dashboard", body: { mode: "daily-open" } },
    { name: "sync-squad-dashboard", body: { mode: "daily-won" } },
    { name: "sync-squad-dashboard", body: { mode: "daily-lost" } },
    { name: "sync-squad-dashboard", body: { mode: "alignment" } },
    { name: "sync-squad-dashboard", body: { mode: "metas" } },
  ],
  calendar: [{ name: "sync-squad-calendar" }],
  presales: [{ name: "sync-squad-presales" }],
};

interface SyncRequest {
  functions: string[];
}

interface FunctionResult {
  function: string;
  status: "success" | "error";
  error?: string;
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

  const results: FunctionResult[] = [];
  for (const fn of body.functions) {
    const steps = FUNCTION_MAP[fn];
    for (const step of steps) {
      const label = `${fn}:${step.body?.mode || step.name}`;
      try {
        const response = await fetch(`${supabaseUrl}/functions/v1/${step.name}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${supabaseKey}`,
          },
          body: step.body ? JSON.stringify(step.body) : undefined,
        });
        if (!response.ok) {
          const text = await response.text();
          results.push({ function: label, status: "error", error: `${response.status}: ${text}` });
        } else {
          results.push({ function: label, status: "success" });
        }
      } catch (err) {
        results.push({
          function: label,
          status: "error",
          error: err instanceof Error ? err.message : "Unknown error",
        });
      }
    }
  }

  const hasErrors = results.some((r) => r.status === "error");
  return NextResponse.json({ results }, { status: hasErrors ? 207 : 200 });
}
