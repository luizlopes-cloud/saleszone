import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
// ---- Pipedrive constants ----
const PIPEDRIVE_DOMAIN = "seazone-fd92b9.pipedrive.com";
const BASE = `https://${PIPEDRIVE_DOMAIN}/api/v1`;
const PIPELINE_ID = 28;
const FIELD_CANAL = "93b3ada8b94bd1fc4898a25754d6bcac2713f835";
const FIELD_EMPREENDIMENTO = "6d565fd4fce66c16da078f520a685fa2fa038272";
const FIELD_QUALIFICACAO = "bc74bcc4326527cbeb331d1697d4c8812d68506e";
const FIELD_REUNIAO = "bfafc352c5c6f2edbaa41bf6d1c6daa825fc9c16";
const CANAL_MARKETING_ID = "12";
const EMPREENDIMENTO_MAP: Record<string, string> = {
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
  "637": "Vistas de Anitá II"
};
const SQUADS = [
  { id: 1, closers: 1, empreendimentos: ["Ponta das Canas Spot II", "Itacaré Spot", "Marista 144 Spot"] },
  { id: 2, closers: 2, empreendimentos: ["Natal Spot", "Novo Campeche Spot II", "Caraguá Spot", "Bonito Spot II"] },
  { id: 3, closers: 2, empreendimentos: ["Jurerê Spot II", "Jurerê Spot III", "Barra Grande Spot", "Vistas de Anitá II"] },
];
const TOTAL_CLOSERS = SQUADS.reduce((sum, sq) => sum + sq.closers, 0);
const TABS = ["mql", "sql", "opp", "won"] as const;
type Tab = typeof TABS[number];

// Pipeline 28 stage IDs (for querying won/lost deals)
const PIPELINE_STAGES = [392, 184, 186, 338, 346, 339, 187, 340, 208, 312, 313, 311, 191, 192];

// ---- Pipedrive API ----
async function pipedriveGet(apiToken: string, path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}${path}`);
  url.searchParams.set("api_token", apiToken);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Pipedrive ${path}: ${res.status}`);
  return res.json();
}

// ---- Deal helpers ----
function getDateField(deal: any, tab: Tab): string | null {
  switch (tab) {
    case "mql": return deal.add_time || null;
    case "sql": return deal[FIELD_QUALIFICACAO] || null;
    case "opp": return deal[FIELD_REUNIAO] || null;
    case "won": return deal.won_time || null;
  }
}

function isMarketingDeal(deal: any) {
  return String(deal[FIELD_CANAL]) === CANAL_MARKETING_ID;
}

function getEmpreendimento(deal: any) {
  const enumId = String(deal[FIELD_EMPREENDIMENTO] || "");
  return EMPREENDIMENTO_MAP[enumId] || null;
}

function getDateRange() {
  const now = new Date();
  const endDate = now.toISOString().substring(0, 10);
  const start35 = new Date(now); start35.setDate(start35.getDate() - 35);
  const startDate = start35.toISOString().substring(0, 10);
  return { startDate, endDate };
}

// ---- Stream deals from API, counting all tabs ----
function countDeals(
  deals: any[], startDate: string, endDate: string,
  countsPerTab: Record<Tab, Map<string, number>>,
) {
  let mkt = 0;
  for (const deal of deals) {
    if (!isMarketingDeal(deal)) continue;
    mkt++;
    const emp = getEmpreendimento(deal);
    if (!emp) continue;
    for (const tab of TABS) {
      const dateStr = getDateField(deal, tab);
      if (!dateStr) continue;
      const day = dateStr.substring(0, 10);
      if (day < startDate || day > endDate) continue;
      const key = `${day}|${emp}`;
      countsPerTab[tab].set(key, (countsPerTab[tab].get(key) || 0) + 1);
    }
  }
  return mkt;
}

// ---- Write counts to DB ----
async function writeDailyCounts(supabase: any, countsPerTab: Record<Tab, Map<string, number>>, startDate: string, endDate: string, replace: boolean) {
  const result: Record<string, number> = {};
  for (const tab of TABS) {
    let final = countsPerTab[tab];

    if (!replace) {
      // Merge with existing DB data
      const { data: existing } = await supabase
        .from("squad_daily_counts")
        .select("date, empreendimento, count")
        .eq("tab", tab)
        .gte("date", startDate)
        .lte("date", endDate);
      if (existing) {
        final = new Map(final);
        for (const row of existing) {
          const key = `${row.date}|${row.empreendimento}`;
          final.set(key, (final.get(key) || 0) + (row.count || 0));
        }
      }
    }

    const rows = Array.from(final.entries()).map(([key, count]) => {
      const [date, empreendimento] = key.split("|");
      return { date, tab, empreendimento, count, synced_at: new Date().toISOString() };
    });
    await supabase.from("squad_daily_counts").delete().eq("tab", tab).gte("date", startDate).lte("date", endDate);
    if (rows.length > 0) {
      for (let i = 0; i < rows.length; i += 500) {
        const batch = rows.slice(i, i + 500);
        const { error } = await supabase.from("squad_daily_counts").insert(batch);
        if (error) console.error(`Insert error ${tab}:`, error.message);
      }
    }
    console.log(`  ${tab}: ${rows.length} rows`);
    result[tab] = rows.length;
  }
  return result;
}

// ---- Mode: daily-open (pipeline endpoint, replaces counts) ----
async function syncDailyOpen(apiToken: string, supabase: any) {
  const { startDate, endDate } = getDateRange();
  console.log(`syncDailyOpen: fetching pipeline ${PIPELINE_ID} open deals...`);

  const countsPerTab: Record<Tab, Map<string, number>> = {
    mql: new Map(), sql: new Map(), opp: new Map(), won: new Map(),
  };
  let start = 0;
  let total = 0;
  while (true) {
    const res = await pipedriveGet(apiToken, `/pipelines/${PIPELINE_ID}/deals`, {
      limit: "500", start: String(start),
    });
    if (!res.data || res.data.length === 0) break;
    total += res.data.length;
    countDeals(res.data, startDate, endDate, countsPerTab);
    if (!res.additional_data?.pagination?.more_items_in_collection) break;
    start += 500;
  }
  console.log(`  Open deals: ${total}`);
  return writeDailyCounts(supabase, countsPerTab, startDate, endDate, true);
}

// ---- Mode: daily-status (uses stage_id filter, merges with existing) ----
// For lost deals: sorts by add_time DESC and stops when deals are older than cutoff
async function syncDailyByStatus(apiToken: string, supabase: any, status: string) {
  const { startDate, endDate } = getDateRange();
  // Cutoff: stop scanning when add_time is older than 90 days (generous buffer over 35-day window)
  const cutoff = new Date(); cutoff.setDate(cutoff.getDate() - 90);
  const cutoffStr = cutoff.toISOString().substring(0, 10);
  console.log(`syncDailyByStatus: ${status} via stage_id, cutoff=${cutoffStr}`);

  const countsPerTab: Record<Tab, Map<string, number>> = {
    mql: new Map(), sql: new Map(), opp: new Map(), won: new Map(),
  };
  let totalDeals = 0;
  let totalMkt = 0;
  let skippedStages = 0;

  for (const stageId of PIPELINE_STAGES) {
    let start = 0;
    let stoppedEarly = false;
    while (true) {
      const res = await pipedriveGet(apiToken, "/deals", {
        status,
        stage_id: String(stageId),
        sort: "add_time DESC",
        limit: "500",
        start: String(start),
      });
      if (!res.data || res.data.length === 0) break;
      totalDeals += res.data.length;
      totalMkt += countDeals(res.data, startDate, endDate, countsPerTab);

      // Check if the oldest deal in this page is before cutoff
      const oldestAddTime = res.data[res.data.length - 1]?.add_time?.substring(0, 10) || "";
      if (oldestAddTime && oldestAddTime < cutoffStr) {
        stoppedEarly = true;
        break;
      }

      if (!res.additional_data?.pagination?.more_items_in_collection) break;
      start += 500;
    }
    if (stoppedEarly) skippedStages++;
  }
  console.log(`  ${status}: ${totalDeals} processed, ${totalMkt} marketing, ${skippedStages} stages stopped early`);
  return writeDailyCounts(supabase, countsPerTab, startDate, endDate, false);
}

// ---- Mode: alignment ----
async function syncAlignment(apiToken: string, supabase: any) {
  console.log(`syncAlignment: fetching pipeline ${PIPELINE_ID} open deals...`);
  const deals: any[] = [];
  let start = 0;
  while (true) {
    const res = await pipedriveGet(apiToken, `/pipelines/${PIPELINE_ID}/deals`, {
      limit: "500", start: String(start),
    });
    if (!res.data || res.data.length === 0) break;
    deals.push(...res.data);
    if (!res.additional_data?.pagination?.more_items_in_collection) break;
    start += 500;
  }

  const usersRes = await pipedriveGet(apiToken, "/users");
  const userMap = new Map(usersRes.data.map((u: any) => [u.id, u.name]));
  const counts = new Map<string, number>();
  for (const deal of deals) {
    const emp = getEmpreendimento(deal);
    if (!emp) continue;
    // Pipeline endpoint returns user_id as integer (not object)
    const ownerId = typeof deal.user_id === "object" ? deal.user_id?.id : deal.user_id;
    if (!ownerId) continue;
    const ownerName = userMap.get(ownerId) || String(ownerId);
    const key = `${emp}|${ownerName}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  await supabase.from("squad_alignment").delete().neq("empreendimento", "");
  const rows = Array.from(counts.entries()).map(([key, count]) => {
    const [empreendimento, owner_name] = key.split("|");
    return { empreendimento, owner_name, count, synced_at: new Date().toISOString() };
  });
  if (rows.length > 0) {
    for (let i = 0; i < rows.length; i += 500) {
      const batch = rows.slice(i, i + 500);
      const { error } = await supabase.from("squad_alignment").insert(batch);
      if (error) console.error("Alignment insert error:", error.message);
    }
  }
  console.log(`syncAlignment: ${rows.length} rows (${deals.length} deals)`);
  return rows.length;
}

// ---- Mode: metas (DB only) ----
function daysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate();
}

async function syncMetas(supabase: any) {
  console.log("syncMetas: calculating from nekt_meta26_metas + squad_daily_counts");
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const day = now.getDate();
  const totalDays = daysInMonth(year, month);
  const monthStart = `${year}-${String(month).padStart(2, "0")}-01`;

  const metaDateStr = `01/${String(month).padStart(2, "0")}/${year}`;
  const { data: nektMeta, error: nektErr } = await supabase
    .from("nekt_meta26_metas")
    .select("won_szi_meta_pago, won_szi_meta_direto")
    .eq("data", metaDateStr)
    .single();
  if (nektErr || !nektMeta) throw new Error(`nekt_meta26_metas not found for ${metaDateStr}: ${nektErr?.message}`);
  const wonMetaTotal = (Number(nektMeta.won_szi_meta_pago) || 0) + (Number(nektMeta.won_szi_meta_direto) || 0);
  const wonPerCloser = wonMetaTotal / TOTAL_CLOSERS;

  const start90 = new Date(now); start90.setDate(start90.getDate() - 90);
  const startDate = start90.toISOString().substring(0, 10);
  const endDate = now.toISOString().substring(0, 10);

  const counts90d: Record<Tab, number> = { mql: 0, sql: 0, opp: 0, won: 0 };
  for (const tab of TABS) {
    const { data: dailyRows } = await supabase
      .from("squad_daily_counts").select("count").eq("tab", tab).gte("date", startDate).lte("date", endDate);
    if (dailyRows) counts90d[tab] = dailyRows.reduce((sum: number, r: any) => sum + (r.count || 0), 0);
    console.log(`  90d ${tab}: ${counts90d[tab]}`);
  }

  const ratioOppWon = counts90d.won > 0 ? counts90d.opp / counts90d.won : 0;
  const ratioSqlOpp = counts90d.opp > 0 ? counts90d.sql / counts90d.opp : 0;
  const ratioMqlSql = counts90d.sql > 0 ? counts90d.mql / counts90d.sql : 0;
  const ratios = { opp_won: ratioOppWon, sql_opp: ratioSqlOpp, mql_sql: ratioMqlSql };

  const metaRows: any[] = [];
  for (const sq of SQUADS) {
    const wonMetaSquad = wonPerCloser * sq.closers;
    const metas = {
      won: (day / totalDays) * wonMetaSquad,
      opp: (day / totalDays) * ratioOppWon * wonMetaSquad,
      sql: (day / totalDays) * ratioSqlOpp * ratioOppWon * wonMetaSquad,
      mql: (day / totalDays) * ratioMqlSql * ratioSqlOpp * ratioOppWon * wonMetaSquad,
    };
    for (const tab of TABS) {
      metaRows.push({ month: monthStart, squad_id: sq.id, tab, meta: metas[tab], synced_at: new Date().toISOString() });
    }
  }

  await supabase.from("squad_metas").upsert(metaRows, { onConflict: "month,squad_id,tab" });
  await supabase.from("squad_ratios").upsert(
    { month: monthStart, ratios, counts_90d: counts90d, synced_at: new Date().toISOString() },
    { onConflict: "month" },
  );

  console.log(`syncMetas: ${metaRows.length} rows, total_won_meta=${wonMetaTotal}`);
  return { squadMetas: metaRows.length, ratios };
}

// ---- Handler ----
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }
  const startTime = Date.now();
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    const srKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const rawToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : "";
    let isServiceRole = !!srKey && rawToken === srKey;
    if (!isServiceRole && rawToken) {
      try {
        const parts = rawToken.split(".");
        if (parts.length === 3) {
          const p = parts[1];
          const padded = p + "=".repeat((4 - p.length % 4) % 4);
          isServiceRole = JSON.parse(atob(padded))?.role === "service_role";
        }
      } catch {}
    }
    if (!isServiceRole) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get Pipedrive token from Vault
    const { data: tokenData } = await supabase.rpc("vault_read_secret", { secret_name: "PIPEDRIVE_API_TOKEN" });
    const apiToken = tokenData?.trim();
    if (!apiToken) throw new Error("PIPEDRIVE_API_TOKEN not found in vault");

    // Parse mode
    let mode = "daily-open";
    try {
      const body = await req.json();
      if (body?.mode) mode = body.mode;
    } catch {}
    console.log(`sync-squad-dashboard mode=${mode}`);

    let result;
    switch (mode) {
      case "daily-open":
        // Open deals from pipeline endpoint (replaces counts)
        result = await syncDailyOpen(apiToken, supabase);
        break;
      case "daily-won":
        // Won deals via stage_id filter (merges with existing)
        result = await syncDailyByStatus(apiToken, supabase, "won");
        break;
      case "daily-lost":
        // Lost deals via stage_id filter (merges with existing)
        result = await syncDailyByStatus(apiToken, supabase, "lost");
        break;
      case "alignment":
        result = { rows: await syncAlignment(apiToken, supabase) };
        break;
      case "metas":
        result = await syncMetas(supabase);
        break;
      case "all": {
        // Full sync: open + won + alignment + metas (lost runs separately due to volume)
        const daily = await syncDailyOpen(apiToken, supabase);
        const won = await syncDailyByStatus(apiToken, supabase, "won");
        const alignment = await syncAlignment(apiToken, supabase);
        const metas = await syncMetas(supabase);
        result = { daily, won, alignment, metas };
        break;
      }
      default:
        return new Response(JSON.stringify({ success: false, error: `Unknown mode: ${mode}` }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }

    const elapsed = Date.now() - startTime;
    console.log(`sync-squad-dashboard completed in ${elapsed}ms`);
    return new Response(JSON.stringify({ success: true, mode, result, elapsed_ms: elapsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("sync-squad-dashboard fatal:", msg);
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
