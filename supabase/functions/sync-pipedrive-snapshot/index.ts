// Daily snapshot of Pipedrive open deals per pipeline
// Runs 1x/day at 6h BRT (9h UTC) via pg_cron
// Saves to pipedrive_daily_snapshot table
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PIPELINES = [
  { id: 28, label: "SZI" },
  { id: 14, label: "SZS" },
  { id: 37, label: "MKTP" },
  { id: 44, label: "Decor" },
];

async function pipedriveGetAll(token: string, pipelineId: number) {
  const deals: Array<{ stage_id: number }> = [];
  let start = 0;
  while (true) {
    const r = await fetch(
      `https://seazone-fd92b9.pipedrive.com/api/v1/pipelines/${pipelineId}/deals?api_token=${token}&start=${start}&limit=500`
    );
    const j = await r.json();
    for (const d of j.data || []) {
      deals.push({ stage_id: d.stage_id });
    }
    if (!j.additional_data?.pagination?.more_items_in_collection) break;
    start += 500;
  }
  return deals;
}

serve(async () => {
  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: tokenData } = await supabase.rpc("vault_read_secret", {
      secret_name: "PIPEDRIVE_API_TOKEN",
    });
    const token = (tokenData || "").trim();
    if (!token) throw new Error("No Pipedrive token");

    const today = new Date().toISOString().substring(0, 10);
    const results: Record<string, number> = {};

    for (const p of PIPELINES) {
      const deals = await pipedriveGetAll(token, p.id);
      const byStage: Record<string, number> = {};
      for (const d of deals) byStage[d.stage_id] = (byStage[d.stage_id] || 0) + 1;

      await supabase.from("pipedrive_daily_snapshot").upsert(
        {
          pipeline_id: p.id,
          date: today,
          total_open: deals.length,
          by_stage: byStage,
          synced_at: new Date().toISOString(),
        },
        { onConflict: "pipeline_id,date" }
      );

      results[p.label] = deals.length;
    }

    return new Response(JSON.stringify({ success: true, date: today, results }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
