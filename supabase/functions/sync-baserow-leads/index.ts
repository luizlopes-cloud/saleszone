import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
const BASEROW_URL = "https://api-baserow.seazone.com.br";
const TABLE_ID = 1208;
const PAGE_SIZE = 200;
const BATCH_SIZE = 500;
const TABLE_NAME = "baserow_leads";
const TIMEOUT_MS = 48_000;
// ── Retry helper ───────────────────────────────────────────────────────────
const RETRY_DELAYS = [
  5_000,
  15_000,
  30_000
];
async function sleep(ms) {
  return new Promise((r)=>setTimeout(r, ms));
}
/**
 * Faz fetch com retry automático para erros transientes do Baserow.
 * 400 ERROR_INVALID_PAGE = fim da tabela (não é erro, não faz retry).
 */ async function fetchWithRetry(url, options) {
  let lastErr;
  for(let attempt = 1; attempt <= 3; attempt++){
    try {
      const res = await fetch(url, options);
      // 400 = fim de tabela — retorna diretamente (não é erro)
      if (res.status === 400) return res;
      // Sucesso
      if (res.ok) return res;
      // Erros transientes: retry
      if ([
        429,
        500,
        502,
        503,
        504
      ].includes(res.status)) {
        const errText = await res.text();
        throw new Error(`Baserow HTTP ${res.status}: ${errText.slice(0, 200)}`);
      }
      // Outros erros (401, 403, etc.): não fazer retry
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < 3) {
        const delay = RETRY_DELAYS[attempt - 1];
        console.warn(`[retry ${attempt}/3] Baserow fetch falhou: ${String(err)}. Aguardando ${delay / 1000}s...`);
        await sleep(delay);
      }
    }
  }
  throw lastErr;
}
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version"
};
serve(async (req)=>{
  if (req.method === "OPTIONS") {
    return new Response(null, {
      headers: corsHeaders
    });
  }
  const startTime = Date.now();
  try {
    const token = Deno.env.get("BASEROW_TOKEN");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!token) {
      return jsonRes({
        success: false,
        error: "BASEROW_TOKEN not set"
      }, 500);
    }
    const supabase = createClient(supabaseUrl, serviceKey);
    const body = await req.json().catch(()=>({}));
    const forceFullSync = body.full === true;
    const { data: syncCtrl } = await supabase.from("nekt_sync_control").select("*").eq("table_name", TABLE_NAME).single();
    const isFullSync = forceFullSync || !syncCtrl?.last_full_sync_at;
    // Incremental via page-skip: tabela 1208 NÃO suporta order_by=-id,
    // então calculamos totalPages e pulamos direto para as últimas ~3 páginas
    let startPage = 1;
    if (!isFullSync) {
      // Fetch com size=1 apenas para obter o count total
      const countUrl = `${BASEROW_URL}/api/database/rows/table/${TABLE_ID}/?user_field_names=false&page=1&size=1`;
      const countRes = await fetchWithRetry(countUrl, {
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json"
        }
      });
      if (countRes.ok) {
        const countData = await countRes.json();
        const totalRows = countData.count || 0;
        const totalPages = Math.ceil(totalRows / PAGE_SIZE);
        startPage = Math.max(1, totalPages - 3);
        console.log(`Incremental: totalRows=${totalRows}, totalPages=${totalPages}, startPage=${startPage}`);
      }
    }
    console.log(`Sync mode: ${isFullSync ? "FULL" : "INCREMENTAL"} | startPage: ${startPage}`);
    await supabase.from("nekt_sync_control").upsert({
      table_name: TABLE_NAME,
      last_sync_status: "running",
      last_sync_error: null
    }, {
      onConflict: "table_name"
    });
    let page = startPage;
    let totalFetched = 0;
    let totalUpserted = 0;
    let batch = [];
    let hasMore = true;
    let timedOut = false;
    while(hasMore){
      if (Date.now() - startTime > TIMEOUT_MS) {
        console.log(`Timeout approaching at page ${page}, saving progress`);
        timedOut = true;
        break;
      }
      // Tabela 1208 (SZI) não suporta order_by=-id (ERROR_ORDER_BY_FIELD_NOT_FOUND)
      // Fetch sem ordenação explícita — upsert garante consistência por id
      const url = `${BASEROW_URL}/api/database/rows/table/${TABLE_ID}/?user_field_names=true&page=${page}&size=${PAGE_SIZE}`;
      // fetchWithRetry: trata 429/5xx com backoff exponencial
      const res = await fetchWithRetry(url, {
        headers: {
          Authorization: `Token ${token}`,
          "Content-Type": "application/json"
        }
      });
      if (!res.ok) {
        const errText = await res.text();
        // Page out of range = we've reached the end (não é erro)
        if (res.status === 400 && errText.includes("ERROR_INVALID_PAGE")) {
          console.log(`Reached end of table at page ${page}`);
          break;
        }
        // Log completo do body para diagnóstico (visível nos Edge Function logs)
        console.error(`Baserow error page ${page}: status=${res.status} body="${errText.substring(0, 500)}"`);
        throw new Error(`Baserow error [${res.status}]: ${errText.substring(0, 200)}`);
      }
      const data = await res.json();
      const rows = data.results || [];
      totalFetched += rows.length;
      for (const row of rows){
        batch.push(mapRow(row));
        if (batch.length >= BATCH_SIZE) {
          totalUpserted += await upsertBatch(supabase, batch);
          batch = [];
        }
      }
      hasMore = !!data.next && rows.length === PAGE_SIZE;
      page++;
    }
    if (batch.length > 0) {
      totalUpserted += await upsertBatch(supabase, batch);
    }
    const now = new Date().toISOString();
    const updatePayload = {
      last_sync_status: timedOut ? "partial" : "success",
      last_sync_rows: totalUpserted,
      last_sync_error: timedOut ? `Paused at page ${page}, will continue on next run` : null,
      last_incremental_sync_at: now
    };
    if (isFullSync && !timedOut) {
      updatePayload.last_full_sync_at = now;
    }
    await supabase.from("nekt_sync_control").upsert({
      table_name: TABLE_NAME,
      ...updatePayload
    }, {
      onConflict: "table_name"
    });
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`Sync done: ${totalUpserted} upserted / ${totalFetched} fetched in ${elapsed}s (pages ${startPage}-${page - 1})`);
    return jsonRes({
      success: true,
      mode: isFullSync ? "full" : "incremental",
      fetched: totalFetched,
      upserted: totalUpserted,
      elapsed_s: elapsed,
      complete: !timedOut
    });
  } catch (err) {
    console.error("Sync error:", err);
    try {
      const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
      await supabase.from("nekt_sync_control").upsert({
        table_name: TABLE_NAME,
        last_sync_status: "error",
        last_sync_error: String(err).substring(0, 500)
      }, {
        onConflict: "table_name"
      });
    } catch (_) {}
    return jsonRes({
      success: false,
      error: String(err)
    }, 500);
  }
});
function mapRow(row) {
  const seg = row["Segmento"];
  const segmento = seg && typeof seg === "object" && "value" in seg ? seg.value : seg;
  return {
    baserow_id: row.id,
    nome: row["Nome"] ?? null,
    email: row["Email"] ?? null,
    telefone: row["Telefone"] ?? null,
    telefone_invalido: row["Telefone Inválido?"] ?? false,
    plataforma: row["Plataforma"] ?? null,
    segmento: segmento ? String(segmento) : null,
    regiao: row["Regiao"] ?? null,
    nome_empreendimento: row["Nome do Empreendimento"] ?? null,
    nome_campanha: row["Nome da Campanha"] ?? null,
    nome_formulario: row["Nome do Formulário"] ?? null,
    nome_anuncio: row["Nome do Anúncio"] ?? null,
    nome_grupo_anuncios: row["Nome do grupo de anúncios"] ?? null,
    id_campanha: row["ID da Campanha"] ?? null,
    id_pagina: row["ID da Página"] ?? null,
    id_anuncio: row["ID do Anuncio"] ?? null,
    id_formulario: row["ID do Formulario"] ?? null,
    id_grupo_anuncio: row["ID do Grupo de Anuncio"] ?? null,
    lead_ads_id: row["Lead Ads ID"] ?? null,
    pipedrive_deal_id: row["Pipedrive Deal ID"] ?? null,
    pipedrive_person_id: row["Pipedrive Person ID"] ?? null,
    data_criacao_ads: row["Data de Criação (Ads)"] ?? null,
    data_execucao: row["Data da execução"] ?? null,
    intencao: row["Intenção"] ?? null,
    investimento: row["Investimento"] != null ? String(row["Investimento"]) : null,
    forma_pagamento: row["Forma de Pagamento"] ?? null,
    trafego_organico: row["Tráfego Organico"] ?? false,
    e_mql: row["É MQL?"] ?? false,
    mia_enviado: row["MIA Enviado?"] ?? false,
    rd_enviado: row["RD Enviado?"] ?? false,
    utm_criativo: row["UTM criativo"] ?? null,
    reprocessamento: row["Reprocessamento"] ?? null,
    _synced_at: new Date().toISOString()
  };
}
async function upsertBatch(supabase, batch) {
  const { error } = await supabase.from("baserow_leads").upsert(batch, {
    onConflict: "baserow_id"
  });
  if (error) {
    console.error("Upsert error:", error.message);
    throw new Error(`Upsert failed: ${error.message}`);
  }
  return batch.length;
}
function jsonRes(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json"
    }
  });
}
