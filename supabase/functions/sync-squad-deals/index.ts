import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// ---- Pipedrive constants ----
const PIPEDRIVE_DOMAIN = "seazone-fd92b9.pipedrive.com";
const BASE = `https://${PIPEDRIVE_DOMAIN}/api/v1`;
const PIPELINE_ID = 28;
const FIELD_CANAL = "93b3ada8b94bd1fc4898a25754d6bcac2713f835";
const FIELD_EMPREENDIMENTO = "6d565fd4fce66c16da078f520a685fa2fa038272";
const FIELD_QUALIFICACAO = "bc74bcc4326527cbeb331d1697d4c8812d68506e";
const FIELD_REUNIAO = "bfafc352c5c6f2edbaa41bf6d1c6daa825fc9c16";
const FIELD_RD_SOURCE = "ff53f6910138fa1d8969b686acb4b1336d50c9bd";
const FIELD_PRESELLER = "34a7f4f5f78e8a8d4751ddfb3cfcfb224d8ff908";
const CANAL_MARKETING_ID = "12";

const EMPREENDIMENTO_MAP: Record<string, string> = {
  // Ativos (11 — mapeados nos 3 squads)
  "4109": "Ponta das Canas Spot II",
  "3467": "Itacaré Spot",
  "2935": "Marista 144 Spot",
  "4495": "Natal Spot",
  "4655": "Novo Campeche Spot II",
  "3416": "Caraguá Spot",
  "3451": "Bonito Spot II",
  "3333": "Jurerê Spot II",
  "4586": "Jurerê Spot III",
  "3478": "Barra Grande Spot",
  "637": "Vistas de Anitá II",
  // Históricos / descontinuados
  "4090": "Canas Beach Spot",
  "4292": "Novo Campeche Spot",
  "4056": "Foz Spot",
  "3489": "Ponta das Canas Spot",
  "2526": "Urubici Spot II",
  "3298": "Santinho Spot",
  "3158": "Meireles Spot",
  "492": "Aguardando definição",
  "1447": "Salvador Spot",
  "2840": "Batel Spot",
  "828": "Imbassaí Spot",
  "1171": "Trancoso Spot",
  "466": "Japaratinga Spot",
  "3303": "Bonito Spot",
  "464": "Ingleses Spot",
  "465": "Urubici Spot",
  "3201": "Ilha do Campeche II Spot",
  "463": "Rosa Sul Spot",
  "2868": "Sul da Ilha Spot",
  "2885": "Morro das Pedras Spot",
  "3119": "Santo Antônio Spot",
  "3266": "Cachoeira Beach Spot",
  "461": "Vistas de Anitá I",
  "2573": "Canasvieiras Spot",
  "490": "Penha Spot",
  "2324": "Campeche Spot",
  "506": "Jurerê Spot",
  "3313": "Altavista",
  "692": "Canela Spot",
  "3470": "spot teste",
};

const PIPELINE_STAGES = [392, 184, 186, 338, 346, 339, 187, 340, 208, 312, 313, 311, 191, 192];

const STAGE_ORDER: Record<number, number> = {
  392: 1,  // FUP Parceiro
  184: 2,  // Lead in
  186: 3,  // Contatados
  338: 4,  // Qualificação
  346: 5,  // Qualificado
  339: 6,  // Aguardando data
  187: 7,  // Agendado
  340: 8,  // No Show/Em reagendamento
  208: 9,  // Reunião Realizada/OPP
  312: 10, // FUP
  313: 11, // Negociação
  311: 12, // Fila de espera
  191: 13, // Reservas
  192: 14, // Contrato
};

const OPP_MIN_ORDER = 9;

// ---- Pipedrive API ----
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
function getEmpreendimento(deal: any): string | null {
  const enumId = String(deal[FIELD_EMPREENDIMENTO] || "");
  return EMPREENDIMENTO_MAP[enumId] || null;
}

function dealToRow(deal: any, maxStageOrder: number | null, flowFetched: boolean) {
  const stageOrder = STAGE_ORDER[deal.stage_id] || 0;
  return {
    deal_id: deal.id,
    title: deal.title || `Deal #${deal.id}`,
    stage_id: deal.stage_id,
    status: deal.status,
    user_id: typeof deal.user_id === "object" ? deal.user_id?.id : deal.user_id,
    owner_name: typeof deal.user_id === "object" ? deal.user_id?.name : null,
    add_time: deal.add_time || null,
    won_time: deal.won_time || null,
    lost_time: deal.lost_time || null,
    update_time: deal.update_time || null,
    canal: String(deal[FIELD_CANAL] || ""),
    empreendimento_id: String(deal[FIELD_EMPREENDIMENTO] || ""),
    empreendimento: getEmpreendimento(deal),
    qualificacao_date: deal[FIELD_QUALIFICACAO] || null,
    reuniao_date: deal[FIELD_REUNIAO] || null,
    lost_reason: deal.lost_reason || null,
    rd_source: deal[FIELD_RD_SOURCE] || null,
    preseller_name: typeof deal[FIELD_PRESELLER] === "object" ? deal[FIELD_PRESELLER]?.name : null,
    stage_order: stageOrder,
    max_stage_order: maxStageOrder ?? stageOrder,
    last_activity_date: deal.last_activity_date || null,
    next_activity_date: deal.next_activity_date || null,
    flow_fetched: flowFetched,
    synced_at: new Date().toISOString(),
  };
}

// ---- Batch upsert helper ----
async function upsertBatch(supabase: any, rows: any[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const batch = rows.slice(i, i + 500);
    const { error } = await supabase.from("squad_deals").upsert(batch, { onConflict: "deal_id" });
    if (error) console.error(`Upsert error:`, error.message);
  }
}

// ---- Batch update helper (partial update, doesn't reset other columns) ----
async function updateFlowBatch(supabase: any, rows: Array<{ deal_id: number; max_stage_order: number }>) {
  const now = new Date().toISOString();
  for (const row of rows) {
    const { error } = await supabase
      .from("squad_deals")
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
async function syncDealsOpen(apiToken: string, supabase: any) {
  console.log(`syncDealsOpen: fetching pipeline ${PIPELINE_ID} open deals...`);

  // /pipelines/{id}/deals returns user_id as integer (not object with name),
  // so fetch user list to resolve owner names
  const usersRes = await pipedriveGet(apiToken, "/users");
  const userMap = new Map<number, string>(
    (usersRes.data || []).map((u: any) => [u.id, u.name])
  );

  const rows: any[] = [];
  let start = 0;
  let total = 0;

  while (true) {
    const res = await pipedriveGet(apiToken, `/pipelines/${PIPELINE_ID}/deals`, {
      limit: "500", start: String(start),
    });
    if (!res.data || res.data.length === 0) break;
    total += res.data.length;

    for (const deal of res.data) {
      // Pipeline endpoint only returns pipeline 28, but filter just in case
      if (deal.pipeline_id !== PIPELINE_ID) continue;
      // Resolve owner_name from userMap since this endpoint returns user_id as integer
      const userId = typeof deal.user_id === "object" ? deal.user_id?.id : deal.user_id;
      if (userId && typeof deal.user_id !== "object") {
        deal.user_id = { id: userId, name: userMap.get(userId) || null };
      }
      const stageOrder = STAGE_ORDER[deal.stage_id] || 0;
      rows.push(dealToRow(deal, stageOrder, true));
    }

    if (!res.additional_data?.pagination?.more_items_in_collection) break;
    start += 500;
  }

  console.log(`  Open deals fetched: ${total}, rows to upsert: ${rows.length}`);
  await upsertBatch(supabase, rows);
  return { totalFetched: total, upserted: rows.length };
}

// ---- Mode: deals-won ----
async function syncDealsWon(apiToken: string, supabase: any) {
  console.log(`syncDealsWon: fetching won deals via stage_id loop...`);
  const seenDealIds = new Set<number>();
  const rows: any[] = [];
  let totalFetched = 0;

  for (const stageId of PIPELINE_STAGES) {
    let start = 0;
    while (true) {
      const res = await pipedriveGet(apiToken, "/deals", {
        status: "won",
        stage_id: String(stageId),
        limit: "500",
        start: String(start),
      });
      if (!res.data || res.data.length === 0) break;
      totalFetched += res.data.length;

      for (const deal of res.data) {
        if (deal.pipeline_id !== PIPELINE_ID) continue;
        if (seenDealIds.has(deal.id)) continue;
        seenDealIds.add(deal.id);
        // Won deals passed all stages: max_stage_order = 14
        rows.push(dealToRow(deal, 14, true));
      }

      if (!res.additional_data?.pagination?.more_items_in_collection) break;
      start += 500;
    }
  }

  console.log(`  Won deals fetched: ${totalFetched}, unique: ${seenDealIds.size}, rows: ${rows.length}`);
  await upsertBatch(supabase, rows);
  return { totalFetched, unique: seenDealIds.size, upserted: rows.length };
}

// ---- Mode: deals-lost ----
// Each stage is paginated independently. State is tracked per-stage via `stage_offsets`.
// Body params: cutoff_days (0=no cutoff), stage_offsets (Record<stageId, offset>, default all 0)
async function syncDealsLost(
  apiToken: string,
  supabase: any,
  cutoffDays: number,
  stageOffsets: Record<string, number>,
) {
  let cutoffStr = "";
  if (cutoffDays > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - cutoffDays);
    cutoffStr = cutoff.toISOString().substring(0, 10);
  }
  console.log(`syncDealsLost: cutoff=${cutoffStr || "NONE"}, stageOffsets=${JSON.stringify(stageOffsets)}`);

  const seenDealIds = new Set<number>();
  const rows: any[] = [];
  let totalFetched = 0;
  const completedStages: number[] = [];
  const nextOffsets: Record<string, number> = { ...stageOffsets };
  let hitCap = false;

  for (const stageId of PIPELINE_STAGES) {
    const key = String(stageId);
    // -1 means this stage was already fully synced in a prior invocation
    if (nextOffsets[key] === -1) {
      completedStages.push(stageId);
      continue;
    }

    let start = nextOffsets[key] || 0;
    let stageDone = false;

    while (true) {
      const res = await pipedriveGet(apiToken, "/deals", {
        status: "lost",
        stage_id: key,
        sort: "add_time DESC",
        limit: "500",
        start: String(start),
      });
      if (!res.data || res.data.length === 0) { stageDone = true; break; }

      for (const deal of res.data) {
        if (deal.pipeline_id !== PIPELINE_ID) continue;
        if (seenDealIds.has(deal.id)) continue;
        seenDealIds.add(deal.id);

        const stageOrder = STAGE_ORDER[deal.stage_id] || 0;
        rows.push(dealToRow(deal, stageOrder, false));
      }

      totalFetched += res.data.length;

      // Check cutoff
      if (cutoffStr) {
        const oldestAddTime = res.data[res.data.length - 1]?.add_time?.substring(0, 10) || "";
        if (oldestAddTime && oldestAddTime < cutoffStr) { stageDone = true; break; }
      }

      if (!res.additional_data?.pagination?.more_items_in_collection) { stageDone = true; break; }
      start += 500;

      // Cap total rows at 5000 per invocation to stay within memory/time limits
      if (rows.length >= 5000) { hitCap = true; break; }
    }

    if (stageDone) {
      nextOffsets[key] = -1; // mark stage as complete
      completedStages.push(stageId);
    } else {
      nextOffsets[key] = start; // save where we left off
    }

    if (hitCap) break;
  }

  console.log(`  Lost deals fetched: ${totalFetched}, unique: ${seenDealIds.size}, rows: ${rows.length}, completedStages: ${completedStages.length}/${PIPELINE_STAGES.length}`);
  await upsertBatch(supabase, rows);

  const allDone = completedStages.length === PIPELINE_STAGES.length;
  return {
    dealsScanned: seenDealIds.size,
    upserted: rows.length,
    completedStages: completedStages.length,
    totalStages: PIPELINE_STAGES.length,
    done: allDone,
    stage_offsets: allDone ? null : nextOffsets,
  };
}

// ---- Mode: deals-flow ----
async function syncDealsFlow(apiToken: string, supabase: any) {
  console.log(`syncDealsFlow: fetching deals needing flow analysis...`);

  // Query deals that need flow: flow_fetched=false, status=lost, marketing, with empreendimento
  const { data: deals, error: queryErr } = await supabase
    .from("squad_deals")
    .select("deal_id, stage_order, canal, empreendimento")
    .eq("flow_fetched", false)
    .eq("status", "lost")
    .eq("canal", CANAL_MARKETING_ID)
    .not("empreendimento", "is", null)
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

  // Process deals that need flow API with concurrency=10
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
    .from("squad_deals")
    .select("deal_id", { count: "exact", head: true })
    .eq("flow_fetched", false)
    .eq("status", "lost")
    .eq("canal", CANAL_MARKETING_ID)
    .not("empreendimento", "is", null);

  return {
    processed: processed + skipFlow.length,
    remaining: remaining || 0,
    done: (remaining || 0) === 0,
  };
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

    // Get Pipedrive token from vault
    const { data: tokenData, error: tokenErr } = await supabase.rpc("vault_read_secret", {
      secret_name: "PIPEDRIVE_API_TOKEN",
    });
    if (tokenErr || !tokenData) throw new Error(`Vault error: ${tokenErr?.message}`);
    const apiToken = tokenData;

    // Parse mode from request body
    const body = await req.json().catch(() => ({}));
    const mode = body.mode || "deals-open";
    console.log(`sync-squad-deals: mode=${mode}`);

    let result: any;

    switch (mode) {
      case "deals-open":
        result = await syncDealsOpen(apiToken, supabase);
        break;
      case "deals-won":
        result = await syncDealsWon(apiToken, supabase);
        break;
      case "deals-lost": {
        const cutoffDays = body.cutoff_days ?? 365; // 0 = no cutoff (full backfill)
        const stageOffsets: Record<string, number> = body.stage_offsets || {};
        result = await syncDealsLost(apiToken, supabase, cutoffDays, stageOffsets);
        break;
      }
      case "deals-flow":
        result = await syncDealsFlow(apiToken, supabase);
        break;
      case "inspect-fields": {
        // Temporary: list deal fields matching a search term
        const search = (body.search || "source").toLowerCase();
        const fieldsRes = await pipedriveGet(apiToken, "/dealFields", { limit: "500", start: "0" });
        const fields = (fieldsRes.data || [])
          .filter((f: any) => (f.name || "").toLowerCase().includes(search))
          .map((f: any) => ({ key: f.key, name: f.name, field_type: f.field_type, options: f.options?.slice(0, 10) }));
        result = { fields };
        break;
      }
      default:
        return new Response(
          JSON.stringify({ error: `Unknown mode: ${mode}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
    }

    const elapsed = Date.now() - t0;
    console.log(`sync-squad-deals: mode=${mode} done in ${elapsed}ms`);

    return new Response(
      JSON.stringify({ success: true, mode, result, elapsed_ms: elapsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("sync-squad-deals error:", err);
    return new Response(
      JSON.stringify({ error: err.message, elapsed_ms: Date.now() - t0 }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
