import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
const EMPREENDIMENTOS = {
  1: [
    "Ponta das Canas Spot II",
    "Itacaré Spot",
    "Marista 144 Spot"
  ],
  2: [
    "Natal Spot",
    "Novo Campeche Spot II",
    "Caraguá Spot",
    "Bonito Spot II"
  ],
  3: [
    "Jurerê Spot II",
    "Jurerê Spot III",
    "Barra Grande Spot",
    "Vistas de Anitá II"
  ]
};
const ALIASES = {
  "vistas de anita": "Vistas de Anitá II"
};
const ALL_EMPS = [];
for (const [sqId, emps] of Object.entries(EMPREENDIMENTOS)){
  for (const name of emps)ALL_EMPS.push({
    name,
    squadId: Number(sqId)
  });
}
ALL_EMPS.sort((a, b)=>b.name.length - a.name.length);
const META_ACCOUNT_ID = "act_205286032338340";
function normalize(s) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function matchEmpreendimento(campaignName) {
  const norm = normalize(campaignName);
  for (const emp of ALL_EMPS){
    if (norm.includes(normalize(emp.name))) return emp;
  }
  for (const [alias, realName] of Object.entries(ALIASES)){
    if (norm.includes(alias)) {
      const emp = ALL_EMPS.find((e)=>e.name === realName);
      if (emp) return emp;
    }
  }
  return null;
}
function percentile(data, p) {
  if (!data.length) return 0;
  const s = [
    ...data
  ].sort((a, b)=>a - b);
  const k = (s.length - 1) * p / 100;
  const f = Math.floor(k);
  const c = Math.min(f + 1, s.length - 1);
  return s[f] + (k - f) * (s[c] - s[f]);
}
function median(data) {
  return percentile(data, 50);
}
async function fetchAllInsights(token, since, until, statuses = ["ACTIVE"]) {
  const fields = "ad_id,ad_name,adset_name,campaign_name,impressions,clicks,spend,cpc,cpm,ctr,frequency,actions,cost_per_action_type";
  const timeRange = JSON.stringify({
    since,
    until
  });
  const filtering = JSON.stringify([
    {
      "field": "ad.effective_status",
      "operator": "IN",
      "value": statuses
    }
  ]);
  let url = `https://graph.facebook.com/v21.0/${META_ACCOUNT_ID}/insights?level=ad&fields=${encodeURIComponent(fields)}&time_range=${encodeURIComponent(timeRange)}&filtering=${encodeURIComponent(filtering)}&limit=500&access_token=${token}`;
  const allData = [];
  let pages = 0;
  while(url && pages < 20){
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Meta API error ${res.status}: ${await res.text()}`);
    const json = await res.json();
    if (json.data) allData.push(...json.data);
    url = json.paging?.next || "";
    pages++;
  }
  return allData;
}
const LEAD_ACTION_TYPE = "onsite_conversion.lead_grouped";
function extractLeads(insight) {
  for (const a of insight.actions || []){
    if (a.action_type === LEAD_ACTION_TYPE) return parseInt(a.value, 10) || 0;
  }
  return 0;
}
function extractCPL(insight, leads, spend) {
  for (const c of insight.cost_per_action_type || []){
    if (c.action_type === LEAD_ACTION_TYPE) return parseFloat(c.value) || 0;
  }
  if (leads > 0 && spend > 0) return spend / leads;
  return 0;
}
function applyDiagnostics(rows) {
  const cpls = rows.filter((r)=>r.cpl > 0).map((r)=>r.cpl);
  const ctrs = rows.filter((r)=>r.ctr > 0).map((r)=>r.ctr);
  const cpms = rows.filter((r)=>r.cpm > 0).map((r)=>r.cpm);
  const b = {
    cpl_med: median(cpls),
    cpl_p75: percentile(cpls, 75),
    ctr_p25: percentile(ctrs, 25),
    cpm_med: median(cpms)
  };
  for (const r of rows){
    const diags = [];
    let severity = "OK";
    if (r.cpl > 0 && b.cpl_med > 0 && r.cpl > 2 * b.cpl_med && r.cpl > 50) {
      diags.push(`CPL R$${r.cpl.toFixed(0)} esta ${Math.round((r.cpl / b.cpl_med - 1) * 100)}% acima da mediana (R$${b.cpl_med.toFixed(0)}). Revisar audiencia e criativo`);
      severity = "CRITICO";
    }
    if (r.ctr > 0 && r.ctr < 0.5 && r.impressions > 500) {
      diags.push(`CTR ${r.ctr.toFixed(2)}% muito baixo. Criativo nao chama atencao. Testar novo hook`);
      severity = "CRITICO";
    }
    if (r.spend > 200 && r.leads === 0) {
      diags.push(`R$${r.spend.toFixed(0)} gastos sem nenhum lead. Pausar imediatamente e revisar LP`);
      severity = "CRITICO";
    }
    if (r.clicks > 50 && r.leads === 0 && r.spend > 50) {
      diags.push(`${r.clicks} cliques sem conversao. Problema na landing page ou formulario`);
      severity = "CRITICO";
    }
    if (r.frequency > 3.5) {
      diags.push(`Frequencia ${r.frequency.toFixed(1)} — audiencia saturada. Expandir publico ou pausar`);
      severity = "CRITICO";
    }
    if (r.cpl > 0 && b.cpl_p75 > 0 && r.cpl > b.cpl_p75 && severity !== "CRITICO") {
      diags.push(`CPL R$${r.cpl.toFixed(0)} acima do P75. Otimizar segmentacao ou testar novo angulo`);
      if (severity === "OK") severity = "ALERTA";
    }
    if (r.ctr > 0 && b.ctr_p25 > 0 && r.ctr < b.ctr_p25 && r.ctr >= 0.5) {
      diags.push(`CTR ${r.ctr.toFixed(2)}% abaixo do P25. Revisar headline e elemento visual`);
      if (severity === "OK") severity = "ALERTA";
    }
    if (r.cpm > 0 && b.cpm_med > 0 && r.cpm > 2 * b.cpm_med) {
      diags.push(`CPM R$${r.cpm.toFixed(0)} elevado. Audiencia pode estar saturada ou muito restrita`);
      if (severity === "OK") severity = "ALERTA";
    }
    if (r.impressions < 500 && r.impressions > 0) {
      diags.push(`Apenas ${r.impressions} impressoes no mes. Budget insuficiente para otimizacao`);
      if (severity === "OK") severity = "ALERTA";
    }
    const nameLower = r.ad_name.toLowerCase();
    if ([
      "video",
      "vídeo",
      "vsl",
      "reels"
    ].some((v)=>nameLower.includes(v)) && r.ctr < 1.0 && r.ctr > 0) {
      diags.push(`Video com CTR ${r.ctr.toFixed(2)}%. Melhorar hook nos primeiros 3 segundos`);
      if (severity === "OK") severity = "ALERTA";
    }
    r.severidade = severity;
    r.diagnostico = diags.slice(0, 5).join(" | ");
  }
}
Deno.serve(async (req)=>{
  if (req.method === "OPTIONS") return new Response(null, {
    headers: corsHeaders
  });
  const startTime = Date.now();
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
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
      } catch  {}
    }
    if (!isServiceRole) {
      return new Response(JSON.stringify({
        success: false,
        error: "Unauthorized"
      }), {
        status: 401,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json"
        }
      });
    }
    const { data: tokenData } = await supabase.rpc("vault_read_secret", {
      secret_name: "META_ACCESS_TOKEN"
    });
    const metaToken = tokenData?.trim();
    if (!metaToken) throw new Error("META_ACCESS_TOKEN not found in vault");
    const now = new Date();
    const until = now.toISOString().substring(0, 10);
    const sinceMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const sinceLifetime = "2024-06-01";
    const snapshotDate = until;
    console.log(`sync-squad-meta-ads v10: lifetime ${sinceLifetime} to ${until}, month ${sinceMonth} to ${until}`);
    const PAUSED_STATUSES = ["PAUSED", "CAMPAIGN_PAUSED", "ADSET_PAUSED"];
    // 3 chamadas paralelas: ACTIVE lifetime + ACTIVE month + PAUSED month
    const [lifetimeInsights, monthActiveInsights, monthPausedInsights] = await Promise.all([
      fetchAllInsights(metaToken, sinceLifetime, until, ["ACTIVE"]),
      fetchAllInsights(metaToken, sinceMonth, until, ["ACTIVE"]),
      fetchAllInsights(metaToken, sinceMonth, until, PAUSED_STATUSES),
    ]);
    console.log(`  lifetime(active): ${lifetimeInsights.length}, month(active): ${monthActiveInsights.length}, month(paused): ${monthPausedInsights.length}`);
    // Track paused ad IDs for effective_status column
    const pausedAdIds = new Set(monthPausedInsights.map((i) => i.ad_id));
    // Merge paused ads into lifetime (use month data as their lifetime since they're paused)
    const activeAdIds = new Set(lifetimeInsights.map((i) => i.ad_id));
    for (const ins of monthPausedInsights) {
      if (!activeAdIds.has(ins.ad_id)) {
        lifetimeInsights.push(ins);
        activeAdIds.add(ins.ad_id);
      }
    }
    // Month insights = active + paused
    const monthInsights = [...monthActiveInsights, ...monthPausedInsights];
    console.log(`  merged: ${lifetimeInsights.length} lifetime, ${monthInsights.length} month`);
    // Map<ad_id, {spend, leads}> do mês
    const monthMap = new Map();
    for (const ins of monthInsights){
      monthMap.set(ins.ad_id, {
        spend: Math.round((parseFloat(ins.spend) || 0) * 100) / 100,
        leads: extractLeads(ins)
      });
    }
    // Processar insights lifetime
    const rows = [];
    let unmatched = 0;
    const unmatchedCampaigns = [];
    for (const ins of lifetimeInsights){
      const match = matchEmpreendimento(ins.campaign_name);
      if (!match) {
        unmatched++;
        if (!unmatchedCampaigns.includes(ins.campaign_name)) unmatchedCampaigns.push(ins.campaign_name);
        continue;
      }
      const impressions = parseInt(ins.impressions, 10) || 0;
      const clicks = parseInt(ins.clicks, 10) || 0;
      const spend = parseFloat(ins.spend) || 0;
      const leads = extractLeads(ins);
      const cpl = extractCPL(ins, leads, spend);
      const monthData = monthMap.get(ins.ad_id) || {
        spend: 0,
        leads: 0
      };
      rows.push({
        ad_id: ins.ad_id,
        campaign_name: ins.campaign_name,
        adset_name: ins.adset_name,
        ad_name: ins.ad_name,
        empreendimento: match.name,
        squad_id: match.squadId,
        impressions,
        clicks,
        spend: Math.round(spend * 100) / 100,
        leads,
        cpl: Math.round(cpl * 100) / 100,
        ctr: Math.round(parseFloat(ins.ctr || "0") * 100) / 100,
        cpm: Math.round(parseFloat(ins.cpm || "0") * 100) / 100,
        frequency: Math.round(parseFloat(ins.frequency || "0") * 100) / 100,
        cpc: Math.round(parseFloat(ins.cpc || "0") * 100) / 100,
        severidade: "OK",
        diagnostico: "",
        spend_month: monthData.spend,
        leads_month: monthData.leads,
        effective_status: pausedAdIds.has(ins.ad_id) ? "PAUSED" : "ACTIVE"
      });
    }
    console.log(`  ${rows.length} matched, ${unmatched} unmatched`);
    if (unmatchedCampaigns.length > 0) {
      console.log(`  Unmatched campaigns: ${unmatchedCampaigns.join(' | ')}`);
    }
    applyDiagnostics(rows);
    const criticos = rows.filter((r)=>r.severidade === "CRITICO").length;
    const alertas = rows.filter((r)=>r.severidade === "ALERTA").length;
    await supabase.from("squad_meta_ads").delete().eq("snapshot_date", snapshotDate);
    if (rows.length > 0) {
      for(let i = 0; i < rows.length; i += 200){
        const batch = rows.slice(i, i + 200).map((r)=>({
            snapshot_date: snapshotDate,
            squad_id: r.squad_id,
            empreendimento: r.empreendimento,
            ad_id: r.ad_id,
            campaign_name: r.campaign_name,
            adset_name: r.adset_name,
            ad_name: r.ad_name,
            impressions: r.impressions,
            clicks: r.clicks,
            spend: r.spend,
            leads: r.leads,
            cpl: r.cpl,
            ctr: r.ctr,
            cpm: r.cpm,
            frequency: r.frequency,
            cpc: r.cpc,
            severidade: r.severidade,
            diagnostico: r.diagnostico || null,
            spend_month: r.spend_month,
            leads_month: r.leads_month,
            effective_status: r.effective_status
          }));
        const { error } = await supabase.from("squad_meta_ads").insert(batch);
        if (error) console.error(`Insert error batch ${i}:`, error.message);
      }
    }
    const totalLeads = rows.reduce((s, r)=>s + r.leads, 0);
    const totalSpendMonth = rows.reduce((s, r)=>s + r.spend_month, 0);
    const totalLeadsMonth = rows.reduce((s, r)=>s + r.leads_month, 0);
    const elapsed = Date.now() - startTime;
    return new Response(JSON.stringify({
      success: true,
      snapshot_date: snapshotDate,
      period_lifetime: {
        since: sinceLifetime,
        until
      },
      period_month: {
        since: sinceMonth,
        until
      },
      total_ads: rows.length,
      total_leads: totalLeads,
      total_spend_month: Math.round(totalSpendMonth * 100) / 100,
      total_leads_month: totalLeadsMonth,
      unmatched,
      unmatched_campaigns: unmatchedCampaigns,
      criticos,
      alertas,
      elapsed_ms: elapsed
    }), {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("sync-squad-meta-ads fatal:", msg);
    return new Response(JSON.stringify({
      success: false,
      error: msg
    }), {
      status: 500,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json"
      }
    });
  }
});
