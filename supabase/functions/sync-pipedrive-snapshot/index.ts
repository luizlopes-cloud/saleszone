// Daily snapshot of Pipedrive open deals per pipeline
// Runs 1x/day at 6h BRT (9h UTC) via pg_cron
// Saves to pipedrive_daily_snapshot table
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PIPELINES = [
  { id: 28, label: "SZI", table: "squad_deals" },
  { id: 14, label: "SZS", table: "szs_deals" },
  { id: 37, label: "MKTP", table: "mktp_deals" },
  { id: 44, label: "Decor", table: "decor_deals" },
];

async function pipedriveGetAll(token: string, pipelineId: number) {
  const deals: Array<{ id: number; stage_id: number }> = [];
  let start = 0;
  while (true) {
    const r = await fetch(
      `https://seazone-fd92b9.pipedrive.com/api/v1/pipelines/${pipelineId}/deals?api_token=${token}&start=${start}&limit=500`
    );
    const j = await r.json();
    for (const d of j.data || []) {
      deals.push({ id: d.id, stage_id: d.stage_id });
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

      // Clean stale deals: mark as lost any DB open deals not in Pipedrive
      // Guard: skip cleanup if Pipedrive returned 0 deals (likely API error/rate limit)
      let staleCleaned = 0;
      if (deals.length > 0) {
        const pdIds = new Set(deals.map((d) => d.id));
        const PAGE = 1000;
        let offset = 0;
        while (true) {
          const { data: dbOpen, error: dbErr } = await supabase
            .from(p.table)
            .select("deal_id")
            .eq("status", "open")
            .range(offset, offset + PAGE - 1);
          if (dbErr) { console.error(`${p.label}: error reading open deals: ${dbErr.message}`); break; }
          if (!dbOpen || dbOpen.length === 0) break;
          const stale = dbOpen.filter((d: { deal_id: number }) => !pdIds.has(d.deal_id)).map((d: { deal_id: number }) => d.deal_id);
          if (stale.length > 0) {
            for (let i = 0; i < stale.length; i += 100) {
              const { error: updErr } = await supabase
                .from(p.table)
                .update({ status: "lost", update_time: new Date().toISOString() })
                .in("deal_id", stale.slice(i, i + 100));
              if (updErr) console.error(`${p.label}: error updating stale deals: ${updErr.message}`);
            }
            staleCleaned += stale.length;
          }
          if (dbOpen.length < PAGE) break;
          offset += PAGE;
        }
      } else {
        console.warn(`${p.label}: Pipedrive returned 0 deals — skipping stale cleanup`);
      }

      results[p.label] = deals.length;
      if (staleCleaned > 0) console.log(`${p.label}: cleaned ${staleCleaned} stale deals`);
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
