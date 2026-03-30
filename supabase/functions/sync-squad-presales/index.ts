// Edge Function: sync-squad-presales
// Populates squad_presales_response from Pipedrive API (deals + activities)
// Triggered via POST /functions/v1/sync-squad-presales
//
// Transbordo logic:
// MIA is an automation that contacts leads following a cadence. When the cadence
// ends, MIA transfers ownership of the deal to the preseller = "transbordo".
// The transbordo moment = max(last ownership change to current preseller, last MIA activity)
// This handles cases where a deal goes to sales and comes back to presales.
//
// Sources checked:
// 1. nekt_transbordo_mia (webhook) — fast path, but only first transbordo
// 2. Pipedrive /deals/{id}/flow — ownership change history (last transfer to preseller)
// 3. Pipedrive /deals/{id}/activities — last MIA activity (any type including "Automacao")
// Final transbordo = max(source1or2, source3), fallback to deal.add_time

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const PIPELINE_ID = 28;
const DAYS_LOOKBACK = 30;
const PIPEDRIVE_BASE = "https://api.pipedrive.com/v1";

interface PreSeller {
  user_id: number;
  user_name: string;
}

interface PipedriveDeal {
  id: number;
  title: string;
  owner_id: number;
  owner_name: string;
  add_time: string;
  stage_change_time: string;
  stage_id: number;
  status: string;
  pipeline_id: number;
}

interface PipedriveActivity {
  id: number;
  deal_id: number;
  type: string;
  subject: string;
  add_time: string;
  done: boolean;
  user_id: number;
}

interface FlowItem {
  object: string;
  timestamp: string;
  data: {
    field_key?: string;
    old_value?: string;
    new_value?: string;
    log_time?: string;
  };
}

// --- Pipedrive API helpers ---

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const RETRY_DELAYS = [5_000, 15_000, 30_000];

async function pipedriveGet<T>(path: string, token: string, params: Record<string, string> = {}): Promise<T[]> {
  const url = new URL(`${PIPEDRIVE_BASE}${path}`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  url.searchParams.set("api_token", token);

  const items: T[] = [];
  let start = 0;
  const limit = 500;

  while (true) {
    url.searchParams.set("start", String(start));
    url.searchParams.set("limit", String(limit));

    let json: any;
    for (let attempt = 0; attempt <= 3; attempt++) {
      const res = await fetch(url.toString());
      if (res.ok) {
        json = await res.json();
        break;
      }
      if (res.status === 429 && attempt < 3) {
        console.warn(`Pipedrive 429 on ${path}, retry ${attempt + 1}/3 in ${RETRY_DELAYS[attempt] / 1000}s`);
        await sleep(RETRY_DELAYS[attempt]);
        continue;
      }
      const text = await res.text();
      throw new Error(`Pipedrive ${path} error ${res.status}: ${text}`);
    }
    if (!json) throw new Error(`Pipedrive ${path}: max retries exceeded`);

    if (!json.data || json.data.length === 0) break;

    items.push(...json.data);

    if (!json.additional_data?.pagination?.more_items_in_collection) break;
    start = json.additional_data.pagination.next_start;
  }

  return items;
}

async function fetchDealsForUser(userId: number, token: string, sinceDate: string): Promise<PipedriveDeal[]> {
  const deals = await pipedriveGet<PipedriveDeal>("/deals", token, {
    user_id: String(userId),
    status: "open",
    sort: "add_time DESC",
  });

  return deals.filter((d) =>
    d.pipeline_id === PIPELINE_ID &&
    d.add_time >= sinceDate
  );
}

async function fetchActivitiesForUser(userId: number, token: string, sinceDate: string): Promise<PipedriveActivity[]> {
  return pipedriveGet<PipedriveActivity>("/activities", token, {
    user_id: String(userId),
    done: "1",
    start_date: sinceDate.slice(0, 10),
    type: "call",
  });
}

// Fetch deal changelog to find ownership transfer timestamps
async function fetchDealFlow(dealId: number, token: string): Promise<FlowItem[]> {
  return pipedriveGet<FlowItem>(`/deals/${dealId}/flow`, token, {});
}

// Fetch all activities for a deal (any type) to find MIA activities
async function fetchDealActivities(dealId: number, token: string): Promise<PipedriveActivity[]> {
  return pipedriveGet<PipedriveActivity>(`/deals/${dealId}/activities`, token, {});
}

// Find transbordo + last MIA from deal flow + activities
// Returns { transbordo, lastMia }
function analyzeTransbordo(
  flow: FlowItem[],
  activities: PipedriveActivity[],
  preSellerIds: Set<number>,
): { ownerChange: string | null; lastMia: string | null } {
  // 1. Find LAST ownership change to any preseller
  let ownerChangeTime: string | null = null;
  for (const item of flow) {
    if (
      item.data?.field_key === "user_id" &&
      item.data.new_value &&
      preSellerIds.has(Number(item.data.new_value))
    ) {
      const ts = item.data.log_time || item.timestamp;
      if (!ownerChangeTime || ts > ownerChangeTime) {
        ownerChangeTime = ts;
      }
    }
  }

  // 2. Find last MIA activity (any type: call, whatsapp_chat, Automacao, etc.)
  let lastMiaTime: string | null = null;
  for (const act of activities) {
    if (/mia/i.test(act.subject || "")) {
      if (!lastMiaTime || act.add_time > lastMiaTime) {
        lastMiaTime = act.add_time;
      }
    }
  }

  return { ownerChange: ownerChangeTime, lastMia: lastMiaTime };
}

// --- Main handler ---

Deno.serve(async (req) => {
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Read Pipedrive token from Vault
    const { data: secretData, error: secretErr } = await supabase.rpc("vault_read_secret", {
      secret_name: "PIPEDRIVE_API_TOKEN",
    });
    if (secretErr || !secretData) throw new Error(`Vault error: ${secretErr?.message || "no secret"}`);
    const pipedriveToken = secretData;

    // 2. Read pre-sellers from config
    const { data: pvRows, error: pvErr } = await supabase
      .from("config_pre_vendedores")
      .select("user_id, user_name")
      .eq("pipeline_id", PIPELINE_ID);
    if (pvErr) throw new Error(`Config error: ${pvErr.message}`);

    const preSellers: PreSeller[] = pvRows || [];
    if (preSellers.length === 0) {
      return new Response(JSON.stringify({ message: "No pre-sellers configured" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    const preSellerIds = new Set(preSellers.map((pv) => pv.user_id));
    const sinceDate = new Date(Date.now() - DAYS_LOOKBACK * 86400000).toISOString();
    const today = new Date().toISOString().slice(0, 10);

    // 3. Fetch deals and call activities for each pre-seller
    const allDeals: Array<{ deal: PipedriveDeal; pvName: string; firstCall: PipedriveActivity | undefined }> = [];

    for (const pv of preSellers) {
      const [deals, activities] = await Promise.all([
        fetchDealsForUser(pv.user_id, pipedriveToken, sinceDate),
        fetchActivitiesForUser(pv.user_id, pipedriveToken, sinceDate),
      ]);

      // Index activities by deal_id: first call (earliest add_time)
      const firstCallByDeal = new Map<number, PipedriveActivity>();
      const sorted = [...activities].sort((a, b) => a.add_time.localeCompare(b.add_time));
      for (const act of sorted) {
        if (act.deal_id && !firstCallByDeal.has(act.deal_id)) {
          firstCallByDeal.set(act.deal_id, act);
        }
      }

      for (const deal of deals) {
        allDeals.push({ deal, pvName: pv.user_name, firstCall: firstCallByDeal.get(deal.id) });
      }
    }

    // 4. For each deal: fetch flow + activities from Pipedrive to determine transbordo + last MIA
    const dealIds = allDeals.map((d) => d.deal.id);
    const transbordoMap = new Map<number, string>();
    const lastMiaMap = new Map<number, string>();

    if (dealIds.length > 0) {
      // Process in batches of 10 (parallel) to avoid rate limits
      for (let i = 0; i < dealIds.length; i += 10) {
        const batch = dealIds.slice(i, i + 10);
        const results = await Promise.all(
          batch.map(async (dealId) => {
            try {
              const [flow, acts] = await Promise.all([
                fetchDealFlow(dealId, pipedriveToken),
                fetchDealActivities(dealId, pipedriveToken),
              ]);
              return { dealId, flow, acts };
            } catch {
              return { dealId, flow: [] as FlowItem[], acts: [] as PipedriveActivity[] };
            }
          })
        );

        for (const { dealId, flow, acts } of results) {
          const { ownerChange, lastMia } = analyzeTransbordo(flow, acts, preSellerIds);

          // Save last MIA activity date
          if (lastMia) {
            lastMiaMap.set(dealId, lastMia);
          }

          // Transbordo = max(ownerChange, lastMia)
          let transbordo: string | null = null;
          if (ownerChange && lastMia) {
            transbordo = ownerChange > lastMia ? ownerChange : lastMia;
          } else {
            transbordo = ownerChange || lastMia || null;
          }

          if (transbordo) {
            transbordoMap.set(dealId, transbordo);
          }
        }
      }
    }

    // 5. Build rows
    const allRows: Array<{
      deal_id: number;
      deal_title: string;
      preseller_name: string;
      transbordo_at: string;
      first_action_at: string | null;
      response_time_minutes: number | null;
      action_type: string | null;
      last_mia_at: string | null;
      snapshot_date: string;
    }> = [];

    for (const { deal, pvName, firstCall } of allDeals) {
      const transbordo = transbordoMap.get(deal.id) || deal.add_time;
      const lastMia = lastMiaMap.get(deal.id) || null;
      const firstAction = firstCall?.add_time || null;

      let responseMin: number | null = null;
      if (firstAction) {
        responseMin = Math.round(
          (new Date(firstAction).getTime() - new Date(transbordo).getTime()) / 60000
        );
      }

      allRows.push({
        deal_id: deal.id,
        deal_title: deal.title || "",
        preseller_name: pvName,
        transbordo_at: transbordo,
        first_action_at: firstAction,
        response_time_minutes: responseMin,
        action_type: firstCall?.type || null,
        last_mia_at: lastMia,
        snapshot_date: today,
      });
    }

    // 6. Replace all data in squad_presales_response
    if (allRows.length > 0) {
      const { error: delErr } = await supabase
        .from("squad_presales_response")
        .delete()
        .gte("id", 0);

      if (delErr) throw new Error(`Delete error: ${delErr.message}`);

      for (let i = 0; i < allRows.length; i += 500) {
        const batch = allRows.slice(i, i + 500);
        const { error: insErr } = await supabase
          .from("squad_presales_response")
          .insert(batch);

        if (insErr) throw new Error(`Insert error (batch ${i}): ${insErr.message}`);
      }
    }

    const fallbackCount = allRows.filter((r) =>
      r.transbordo_at === allDeals.find((d) => d.deal.id === r.deal_id)?.deal.add_time
    ).length;

    return new Response(
      JSON.stringify({
        message: "OK",
        preSellers: preSellers.length,
        deals: allRows.length,
        withAction: allRows.filter((r) => r.first_action_at).length,
        pending: allRows.filter((r) => !r.first_action_at).length,
        withLastMia: allRows.filter((r) => r.last_mia_at).length,
        transbordoFallbackToAddTime: fallbackCount,
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("sync-squad-presales error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});
