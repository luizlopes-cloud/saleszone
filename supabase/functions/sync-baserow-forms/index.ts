import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
const BASEROW_URL = "https://api-baserow.seazone.com.br";
let _baserowToken: string | null = null;

async function getBaserowToken(sb: any): Promise<string> {
  if (_baserowToken) return _baserowToken;
  const { data } = await sb.rpc("vault_read_secret", { secret_name: "BASEROW_TOKEN" });
  if (!data) throw new Error("BASEROW_TOKEN not found in Vault");
  _baserowToken = data;
  return data;
}

async function fetchAllRows(tableId: number, token: string) {
  const rows: any[] = [];
  let page = 1;
  let hasMore = true;
  while(hasMore){
    const res = await fetch(`${BASEROW_URL}/api/database/rows/table/${tableId}/?size=200&page=${page}`, {
      headers: {
        Authorization: `Token ${token}`
      }
    });
    if (!res.ok) throw new Error(`Baserow ${tableId} error ${res.status}: ${await res.text()}`);
    const data = await res.json();
    rows.push(...data.results);
    hasMore = data.next !== null;
    page++;
  }
  return rows;
}
function selVal(field) {
  return field?.value || "";
}
Deno.serve(async (_req)=>{
  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const sb = createClient(supabaseUrl, supabaseKey);
    const token = await getBaserowToken(sb);
    const now = new Date().toISOString();
    // --- Table 1209: Formularios ---
    const formRows = await fetchAllRows(1209, token);
    const formRecords = formRows.map((r)=>{
      const emps = r.field_11501 ? [
        ...new Set(r.field_11501.map((e)=>e.value))
      ] : [];
      const formName = (r.field_11499 || "").trim();
      return {
        id: r.id,
        form_id: (r.field_11500 || "").trim(),
        form_name: formName,
        empreendimentos: emps,
        is_mql: formName.includes("[MQL]"),
        synced_at: now
      };
    });
    const { error: e1 } = await sb.from("squad_baserow_forms").upsert(formRecords, {
      onConflict: "id"
    });
    if (e1) throw new Error(`forms upsert: ${e1.message}`);
    // --- Table 1207: Empreendimentos ---
    const empRows = await fetchAllRows(1207, token);
    const empRecords = empRows.filter((r)=>(r.field_11493 || "").trim() !== "").map((r)=>({
        id: r.id,
        nome: (r.field_11493 || "").trim(),
        mql_intencoes: (r.field_11494 || []).map((x)=>x.value),
        mql_faixas: (r.field_11495 || []).map((x)=>x.value),
        mql_pagamentos: (r.field_11502 || []).map((x)=>x.value),
        campaign_name: (r.field_12769 || "").trim(),
        campaign_id: (r.field_12770 || "").trim(),
        rd_traffic_medium: selVal(r.field_12771),
        rd_traffic_source: selVal(r.field_12773),
        mia_instance_id: (r.field_12774 || "").trim(),
        mia_product_id: (r.field_12775 || "").trim(),
        mia_message_template: (r.field_12776 || "").trim(),
        mia_source: selVal(r.field_12777),
        slack_notifications: selVal(r.field_12778),
        slack_errors: selVal(r.field_12779),
        mia_corretor_instance_id: (r.field_12897 || "").trim(),
        mia_corretor_product_id: (r.field_12898 || "").trim(),
        mia_corretor_message_template: (r.field_12899 || "").trim(),
        status: r.field_12900 || false,
        commercial_squad: (r.field_13430 || "").trim(),
        synced_at: now
      }));
    const { error: e2 } = await sb.from("squad_baserow_empreendimentos").upsert(empRecords, {
      onConflict: "id"
    });
    if (e2) throw new Error(`empreendimentos upsert: ${e2.message}`);
    return new Response(JSON.stringify({
      ok: true,
      forms: formRecords.length,
      empreendimentos: empRecords.length
    }), {
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (err) {
    console.error("sync-baserow-forms error:", err);
    return new Response(JSON.stringify({
      error: String(err)
    }), {
      status: 500,
      headers: {
        "Content-Type": "application/json"
      }
    });
  }
});
