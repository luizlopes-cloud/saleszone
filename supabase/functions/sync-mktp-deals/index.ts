// MKTP (Marketplace) module — migrated to Nekt API
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// ---- Pipedrive constants (kept for deals-flow mode only) ----
const PIPEDRIVE_DOMAIN = "seazone-fd92b9.pipedrive.com";
const BASE = `https://${PIPEDRIVE_DOMAIN}/api/v1`;
const PIPELINE_ID = 37;

const PIPELINE_STAGES: number[] = [336, 335, 334, 347, 333, 284, 337, 274, 308, 309, 393, 305, 271];

const STAGE_ORDER: Record<number, number> = {
  336: 1, 335: 2, 334: 3, 347: 4, 333: 5, 284: 6, 337: 7, 274: 8, 308: 9, 309: 10, 393: 11, 305: 12, 271: 13,
};

const OPP_MIN_ORDER = 9;

// ---- Nekt Data API helpers ----
async function queryNekt(nektApiKey: string, sql: string): Promise<Record<string, string | null>[]> {
  const queryRes = await fetch("https://api.nekt.ai/api/v1/sql-query/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": nektApiKey,
    },
    body: JSON.stringify({ sql, mode: "csv" }),
  });

  if (!queryRes.ok) {
    const body = await queryRes.text();
    throw new Error(`Nekt API error (${queryRes.status}): ${body}`);
  }

  const queryData = await queryRes.json();

  let presignedUrl: string | undefined;
  if (queryData.presigned_url) {
    presignedUrl = queryData.presigned_url;
  } else if (queryData.presigned_urls && Array.isArray(queryData.presigned_urls) && queryData.presigned_urls.length > 0) {
    presignedUrl = queryData.presigned_urls[0];
  } else if (queryData.url) {
    presignedUrl = queryData.url;
  }

  if (!presignedUrl) {
    throw new Error(`Nekt API: no presigned_url in response — ${JSON.stringify(queryData)}`);
  }

  const csvRes = await fetch(presignedUrl);
  if (!csvRes.ok) throw new Error(`Failed to download CSV: ${csvRes.status}`);
  const csvText = await csvRes.text();

  return parseCSV(csvText);
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseCSV(csv: string): Record<string, string | null>[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];

  const columns = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());

  return lines.slice(1).map((line) => {
    const values = parseCSVLine(line);
    const row: Record<string, string | null> = {};
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i];
      const val = (values[i] ?? "").trim();
      row[col] = val === "" || val === "null" || val === "NULL" ? null : val;
    }
    return row;
  });
}

// ---- Pipedrive API (kept for deals-flow mode) ----
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function pipedriveGet(apiToken: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_token", apiToken);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const RETRY_DELAYS = [5_000, 15_000, 30_000];
  for (let attempt = 0; attempt <= 3; attempt++) {
    const res = await fetch(url.toString());
    if (res.ok) return res.json();
    if (res.status === 429 && attempt < 3) {
      console.warn(`Pipedrive 429 on ${path}, retry ${attempt + 1}/3 in ${RETRY_DELAYS[attempt] / 1000}s`);
      await sleep(RETRY_DELAYS[attempt]);
      continue;
    }
    throw new Error(`Pipedrive ${path}: ${res.status}`);
  }
  throw new Error(`Pipedrive ${path}: max retries exceeded`);
}

// ---- Deal helpers ----
function nektDealToRow(deal: Record<string, string | null>, maxStageOrder: number | null, flowFetched: boolean) {
  const stageId = parseInt(deal.etapa || "0");
  const stageOrder = STAGE_ORDER[stageId] || 0;
  const canal = deal.canal || null;
  return {
    deal_id: parseInt(deal.id || "0"),
    title: deal.titulo || `Deal #${deal.id}`,
    stage_id: stageId,
    status: deal.status || "open",
    user_id: parseInt(deal.owner_id || "0"),
    owner_name: deal.deal_owner_name || null,
    add_time: deal.negocio_criado_em || null,
    won_time: deal.ganho_em || null,
    lost_time: null,
    update_time: null,
    canal,
    empreendimento_id: null,
    empreendimento: deal.empreendimento || "Sem empreendimento",
    qualificacao_date: deal.data_de_qualificacao || null,
    reuniao_date: deal.data_da_reuniao || null,
    lost_reason: deal.motivo_da_perda || null,
    rd_source: null,
    preseller_name: null,
    stage_order: stageOrder,
    max_stage_order: maxStageOrder ?? stageOrder,
    last_activity_date: null,
    next_activity_date: null,
    flow_fetched: flowFetched,
    synced_at: new Date().toISOString(),
  };
}

// ---- Nekt SQL builder ----
function buildDealsSQL(status: string, cutoffDate?: string): string {
  let where = `WHERE d.pipeline_id = ${PIPELINE_ID} AND d.status = '${status}'`;
  if (cutoffDate) {
    where += ` AND d.negocio_criado_em >= TIMESTAMP '${cutoffDate}'`;
  }
  // Use ROW_NUMBER to pick latest SCD2 record per user (avoids row multiplication)
  return `
SELECT d.id, d.titulo, d.etapa, d.status, d.owner_id, d.deal_owner_name,
       d.negocio_criado_em, d.ganho_em,
       d.canal, d.empreendimento, d.data_de_qualificacao, d.data_da_reuniao,
       d.motivo_da_perda
FROM nekt_silver.pipedrive_deals_readable d
${where}
  `.trim();
}

// ---- Batch upsert helper ----
async function upsertBatch(supabase: any, rows: any[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from("mktp_deals").upsert(batch, { onConflict: "deal_id" });
    if (error) console.error(`Upsert error:`, error.message);
  }
}

// ---- Batch update helper (partial update, doesn't reset other columns) ----
async function updateFlowBatch(supabase: any, rows: Array<{ deal_id: number; max_stage_order: number }>) {
  const now = new Date().toISOString();
  for (const row of rows) {
    const { error } = await supabase
      .from("mktp_deals")
      .update({ max_stage_order: row.max_stage_order, flow_fetched: true, synced_at: now })
      .eq("deal_id", row.deal_id);
    if (error) console.error(`Update error deal ${row.deal_id}:`, error.message);
  }
}

// ---- Flow API: find max stage a deal ever reached ----
async function getMaxStageReached(apiToken: string, dealId: number, currentOrder: number): Promise<number> {
  if (currentOrder >= OPP_MIN_ORDER) return currentOrder;
  let max = currentOrder;
  let s = 0;
  try {
    while (true) {
      const res = await pipedriveGet(apiToken, `/deals/${dealId}/flow`, { limit: "100", start: String(s) });
      if (!res.data) break;
      for (const e of res.data) {
        if (e.object === "dealChange" && e.data?.field_key === "stage_id") {
          for (const v of [e.data.old_value, e.data.new_value]) {
            const order = STAGE_ORDER[parseInt(v)] || 0;
            if (order > max) max = order;
          }
        }
      }
      if (max >= OPP_MIN_ORDER) break;
      if (!res.additional_data?.pagination?.more_items_in_collection) break;
      s += 100;
    }
  } catch (err) {
    console.error(`flow error deal ${dealId}:`, err);
  }
  return max;
}

// ---- Mode: deals-open ----
async function syncDealsOpen(nektApiKey: string, supabase: any) {
  console.log(`syncDealsOpen: fetching pipeline ${PIPELINE_ID} open deals from Nekt...`);

  const sql = buildDealsSQL("open");
  const nektRows = await queryNekt(nektApiKey, sql);
  console.log(`  Nekt returned ${nektRows.length} open deals`);

  // Deduplicate by deal id
  const dedupMap = new Map<number, any>();
  for (const deal of nektRows) {
    const dealId = parseInt(deal.id || "0");
    if (dealId === 0) continue;
    const stageOrder = STAGE_ORDER[parseInt(deal.etapa || "0")] || 0;
    dedupMap.set(dealId, nektDealToRow(deal, stageOrder, true));
  }
  const rows = [...dedupMap.values()];

  console.log(`  Open deals rows to upsert: ${rows.length} (deduped from ${nektRows.length})`);
  await upsertBatch(supabase, rows);

  // Stale cleanup: mark as "lost" any deals that are "open" in DB but no longer in Nekt
  const openDealIds = new Set(rows.map((r) => r.deal_id));
  let staleOffset = 0;
  let staleCount = 0;
  const now = new Date().toISOString();

  while (true) {
    const { data: dbOpen, error } = await supabase
      .from("mktp_deals")
      .select("deal_id")
      .eq("status", "open")
      .range(staleOffset, staleOffset + 999);

    if (error) { console.error("Stale check error:", error.message); break; }
    if (!dbOpen || dbOpen.length === 0) break;

    const staleIds = dbOpen
      .filter((d: any) => !openDealIds.has(d.deal_id))
      .map((d: any) => d.deal_id);

    if (staleIds.length > 0) {
      for (let i = 0; i < staleIds.length; i += 100) {
        const batch = staleIds.slice(i, i + 100);
        const { error: updErr } = await supabase
          .from("mktp_deals")
          .update({ status: "lost", synced_at: now })
          .in("deal_id", batch);
        if (updErr) console.error("Stale update error:", updErr.message);
      }
      staleCount += staleIds.length;
    }

    if (dbOpen.length < 1000) break;
    staleOffset += 1000;
  }

  if (staleCount > 0) console.log(`  Marked ${staleCount} stale deals as lost`);

  return { totalFetched: nektRows.length, upserted: rows.length, staleCleaned: staleCount };
}

// ---- Mode: deals-won ----
async function syncDealsWon(nektApiKey: string, supabase: any) {
  console.log(`syncDealsWon: fetching won deals from Nekt...`);

  const sql = buildDealsSQL("won");
  const nektRows = await queryNekt(nektApiKey, sql);
  console.log(`  Nekt returned ${nektRows.length} won deals`);

  // Deduplicate by deal id
  const dedupMap = new Map<number, any>();
  for (const deal of nektRows) {
    const dealId = parseInt(deal.id || "0");
    if (dealId === 0) continue;
    // Won deals passed all stages: max_stage_order = 13 (MKTP has 13 stages)
    dedupMap.set(dealId, nektDealToRow(deal, 13, true));
  }
  const rows = [...dedupMap.values()];

  console.log(`  Won deals rows to upsert: ${rows.length} (deduped from ${nektRows.length})`);
  await upsertBatch(supabase, rows);
  return { totalFetched: nektRows.length, upserted: rows.length };
}

// ---- Mode: deals-lost ----
async function syncDealsLost(nektApiKey: string, supabase: any, cutoffDays: number) {
  let cutoffStr = "";
  if (cutoffDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - cutoffDays);
    cutoffStr = cutoff.toISOString().substring(0, 10);
  }
  console.log(`syncDealsLost: fetching lost deals from Nekt, cutoff=${cutoffStr || "NONE"}`);

  const sql = buildDealsSQL("lost", cutoffStr || undefined);
  const nektRows = await queryNekt(nektApiKey, sql);
  console.log(`  Nekt returned ${nektRows.length} lost deals`);

  // Deduplicate by deal id
  const dedupMap = new Map<number, any>();
  for (const deal of nektRows) {
    const dealId = parseInt(deal.id || "0");
    if (dealId === 0) continue;
    const stageOrder = STAGE_ORDER[parseInt(deal.etapa || "0")] || 0;
    dedupMap.set(dealId, nektDealToRow(deal, stageOrder, false));
  }
  const rows = [...dedupMap.values()];

  console.log(`  Lost deals rows to upsert: ${rows.length} (deduped from ${nektRows.length})`);
  await upsertBatch(supabase, rows);

  return {
    dealsScanned: nektRows.length,
    upserted: rows.length,
    done: true,
  };
}

// ---- Mode: deals-flow (KEPT ON PIPEDRIVE API) ----
async function syncDealsFlow(apiToken: string, supabase: any) {
  console.log(`syncDealsFlow: fetching deals needing flow analysis...`);

  // Query deals that need flow: flow_fetched=false, status=lost, Marketing canal, with empreendimento
  // canal is now the text name "Marketing" from Nekt
  const { data: deals, error: queryErr } = await supabase
    .from("mktp_deals")
    .select("deal_id, stage_order, canal, empreendimento")
    .eq("flow_fetched", false)
    .eq("status", "lost")
    .eq("canal", "Marketing")
    .not("empreendimento", "is", null)
    .neq("empreendimento", "Sem empreendimento")
    .limit(500);

  if (queryErr) {
    console.error("Query error:", queryErr.message);
    return { processed: 0, remaining: 0, done: true, error: queryErr.message };
  }

  if (!deals || deals.length === 0) {
    console.log("  No deals need flow analysis");
    return { processed: 0, remaining: 0, done: true };
  }

  console.log(`  Found ${deals.length} deals needing flow analysis`);

  // Separate deals that already have stage_order >= OPP_MIN_ORDER (skip flow)
  const skipFlow: any[] = [];
  const needFlow: any[] = [];

  for (const deal of deals) {
    if (deal.stage_order >= OPP_MIN_ORDER) {
      skipFlow.push(deal);
    } else {
      needFlow.push(deal);
    }
  }

  // Batch update deals that can skip flow (use UPDATE, not upsert, to preserve other columns)
  if (skipFlow.length > 0) {
    await updateFlowBatch(supabase, skipFlow.map((d: any) => ({
      deal_id: d.deal_id,
      max_stage_order: d.stage_order,
    })));
    console.log(`  Skipped flow for ${skipFlow.length} deals (already OPP+)`);
  }

  // Process deals that need flow API with concurrency=20
  let processed = 0;
  const CONCURRENCY = 20;

  for (let i = 0; i < needFlow.length; i += CONCURRENCY) {
    const chunk = needFlow.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      chunk.map(async (deal: any) => {
        const maxOrder = await getMaxStageReached(apiToken, deal.deal_id, deal.stage_order);
        return { deal_id: deal.deal_id, max_stage_order: maxOrder };
      })
    );
    await updateFlowBatch(supabase, results);
    processed += results.length;
  }

  console.log(`  Flow processed: ${processed}, skipped: ${skipFlow.length}`);

  // Check if there are more deals remaining
  const { count: remaining } = await supabase
    .from("mktp_deals")
    .select("deal_id", { count: "exact", head: true })
    .eq("flow_fetched", false)
    .eq("status", "lost")
    .eq("canal", "Marketing")
    .not("empreendimento", "is", null)
    .neq("empreendimento", "Sem empreendimento");

  return {
    processed: processed + skipFlow.length,
    remaining: remaining || 0,
    done: (remaining || 0) === 0,
  };
}

// ---- Mode: cleanup (remove orphan deals not in Nekt pipeline 37) ----
async function cleanupOrphanDeals(nektApiKey: string, supabase: any) {
  console.log("cleanupOrphanDeals: fetching all deal IDs from Nekt pipeline 37...");
  const sql = `SELECT DISTINCT CAST(id AS BIGINT) as id FROM nekt_silver.pipedrive_deals_readable WHERE pipeline_id = 37`;
  const nektRows = await queryNekt(nektApiKey, sql);
  const nektIds = new Set(nektRows.map((r) => parseInt(r.id || "0")).filter((id) => id > 0));
  console.log(`  Nekt has ${nektIds.size} deals in pipeline 37`);

  const dbIds: number[] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.from("mktp_deals").select("deal_id").range(offset, offset + 999);
    if (error) { console.error("DB read error:", error.message); break; }
    if (!data || data.length === 0) break;
    for (const d of data) dbIds.push(d.deal_id);
    if (data.length < 1000) break;
    offset += 1000;
  }
  console.log(`  mktp_deals has ${dbIds.length} deals`);

  const orphanIds = dbIds.filter((id) => !nektIds.has(id));
  console.log(`  Found ${orphanIds.length} orphan deals to delete`);

  if (orphanIds.length > 0) {
    for (let i = 0; i < orphanIds.length; i += 100) {
      const batch = orphanIds.slice(i, i + 100);
      const { error: delErr } = await supabase.from("mktp_deals").delete().in("deal_id", batch);
      if (delErr) console.error("Delete error:", delErr.message);
    }
  }
  return { nektCount: nektIds.size, dbCount: dbIds.length, orphansDeleted: orphanIds.length };
}

// ---- Deno.serve handler ----
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const t0 = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Parse mode from request body
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "deals-open";
    console.log(`sync-mktp-deals: mode=${mode}`);

    let result: any;

    switch (mode) {
      case "deals-open":
      case "deals-won":
      case "deals-lost": {
        // These modes use Nekt API
        const { data: nektKey, error: nektErr } = await supabase.rpc("vault_read_secret", {
          secret_name: "NEKT_API_KEY",
        });
        if (nektErr || !nektKey) throw new Error(`Vault error (NEKT_API_KEY): ${nektErr?.message}`);

        if (mode === "deals-open") {
          result = await syncDealsOpen(nektKey, supabase);
        } else if (mode === "deals-won") {
          result = await syncDealsWon(nektKey, supabase);
        } else {
          const cutoffDays = body.cutoff_days ?? 365; // 0 = no cutoff (full backfill)
          result = await syncDealsLost(nektKey, supabase, cutoffDays);
        }
        break;
      }
      case "deals-flow": {
        // This mode still uses Pipedrive API for the flow history endpoint
        const { data: tokenData, error: tokenErr } = await supabase.rpc("vault_read_secret", {
          secret_name: "PIPEDRIVE_API_TOKEN",
        });
        if (tokenErr || !tokenData) throw new Error(`Vault error: ${tokenErr?.message}`);
        result = await syncDealsFlow(tokenData, supabase);
        break;
      }
      case "cleanup": {
        const { data: nektKey, error: nektErr } = await supabase.rpc("vault_read_secret", {
          secret_name: "NEKT_API_KEY",
        });
        if (nektErr || !nektKey) throw new Error(`Vault error (NEKT_API_KEY): ${nektErr?.message}`);
        result = await cleanupOrphanDeals(nektKey, supabase);
        break;
      }
      default:
        return new Response(
          JSON.stringify({ error: `Unknown mode: ${mode}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const elapsed = Date.now() - t0;
    console.log(`sync-mktp-deals: mode=${mode} done in ${elapsed}ms`);

    return new Response(
      JSON.stringify({ success: true, mode, result, elapsed_ms: elapsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("sync-mktp-deals error:", err);
    return new Response(
      JSON.stringify({ error: err.message, elapsed_ms: Date.now() - t0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
