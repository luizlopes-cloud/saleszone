// SZS (Serviços) module — auto-generated from SZI equivalent
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS"
};
// SZS: single squad (id=1) with all empreendimentos
const EMPREENDIMENTOS: Record<number, string[]> = {
  1: [
    "Altavista", "Barra de São Miguel Spot", "Barra Grande Spot", "Barra Spot",
    "Batel Spot", "Bonito Spot", "Bonito Spot II", "Cachoeira Beach Spot",
    "Cachoeira Spot", "Campeche Spot", "Canas Beach Spot", "Canasvieiras Spot",
    "Canela Spot", "Caraguá Spot", "Downtown", "Duetto", "Farol da Barra Spot",
    "Foz Spot", "Ilha do Campeche II Spot", "Ilha do Campeche Spot", "Imbassaí Spot",
    "Ingleses Spot", "Itacaré Spot", "Japaratinga Spot", "Jardim dos Namorados",
    "Jurerê Beach Spot", "Jurerê Spot", "Jurerê Spot II", "Jurerê Spot III",
    "Lagoa Spot", "Marista 144 Spot", "Maxxi Garden", "Meireles Spot",
    "Morro das Pedras Spot", "Mosaico", "Natal Spot", "New Life",
    "Novo Campeche Spot", "Novo Campeche Spot II", "Olímpia Spot", "Penha Spot",
    "Pio 4", "Ponta das Canas Spot", "Ponta das Canas Spot II", "Reflect",
    "Rosa Norte Spot", "Rosa Spot", "Rosa Sul Spot", "Salvador Spot",
    "Santinho Spot", "Santo Antônio Spot", "Soul Guarajuba", "Sul da Ilha Spot",
    "T58", "Top Club", "Trancoso Spot", "Urubici Spot", "Urubici Spot II",
    "Vale do Ouro", "Vistas de Anitá I", "Vistas de Anitá II", "VN Ueno", "Zn Barra",
  ],
};
const ALIASES: Record<string, string> = {
  "vistas de anita": "Vistas de Anitá II",
};
// Nomes que não matcham com nenhum empreendimento mas devem ser identificados
const GENERIC_CAMPAIGNS = ["genérica", "generica", "engajamento"];
const ALL_EMPS: Array<{ name: string; squadId: number }> = [];
for (const [sqId, emps] of Object.entries(EMPREENDIMENTOS)){
  for (const name of emps)ALL_EMPS.push({
    name,
    squadId: Number(sqId)
  });
}
ALL_EMPS.sort((a, b)=>b.name.length - a.name.length);
const META_ACCOUNT_ID = "act_721191188358261";
function normalize(s: string) {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}
function matchEmpreendimento(campaignName: string) {
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
  // Generic/engagement campaigns
  for (const kw of GENERIC_CAMPAIGNS) {
    if (norm.includes(kw)) return { name: "Genérica", squadId: 0 };
  }
  return null;
}
function percentile(data: number[], p: number) {
  if (!data.length) return 0;
  const s = [
    ...data
  ].sort((a, b)=>a - b);
  const k = (s.length - 1) * p / 100;
  const f = Math.floor(k);
  const c = Math.min(f + 1, s.length - 1);
  return s[f] + (k - f) * (s[c] - s[f]);
}
function median(data: number[]) {
  return percentile(data, 50);
}
async function fetchAllInsights(token: string, since: string, until: string, statuses = [
  "ACTIVE"
]) {
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
  const allData: any[] = [];
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
// Fetch lifetime insights in quarterly windows to avoid "excessive rows" error for PAUSED ads
async function fetchLifetimeInWindows(token: string, since: string, until: string, statuses: string[]) {
  const windows: Array<{ since: string; until: string }> = [];
  let cur = new Date(since + "T00:00:00Z");
  const end = new Date(until + "T00:00:00Z");
  while (cur <= end) {
    const wEnd = new Date(cur);
    wEnd.setUTCMonth(wEnd.getUTCMonth() + 1);
    wEnd.setUTCDate(wEnd.getUTCDate() - 1);
    const actualEnd = wEnd > end ? end : wEnd;
    windows.push({ since: cur.toISOString().substring(0, 10), until: actualEnd.toISOString().substring(0, 10) });
    cur = new Date(actualEnd);
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  // Fetch sequentially to avoid rate limit
  const adMap = new Map();
  for (const w of windows) {
    const data = await fetchAllInsights(token, w.since, w.until, statuses);
    for (const ins of data) {
      const existing = adMap.get(ins.ad_id);
      if (!existing) {
        adMap.set(ins.ad_id, ins);
      } else {
        // Sum metrics, keep latest names
        existing.impressions = String((parseInt(existing.impressions, 10) || 0) + (parseInt(ins.impressions, 10) || 0));
        existing.clicks = String((parseInt(existing.clicks, 10) || 0) + (parseInt(ins.clicks, 10) || 0));
        existing.spend = String(((parseFloat(existing.spend) || 0) + (parseFloat(ins.spend) || 0)).toFixed(2));
        // Keep latest window's names and actions
        existing.campaign_name = ins.campaign_name;
        existing.adset_name = ins.adset_name;
        existing.ad_name = ins.ad_name;
        existing.actions = ins.actions;
        existing.cost_per_action_type = ins.cost_per_action_type;
      }
    }
  }
  return Array.from(adMap.values());
}
const LEAD_ACTION_TYPE = "onsite_conversion.lead_grouped";
function extractLeads(insight: any) {
  for (const a of insight.actions || []){
    if (a.action_type === LEAD_ACTION_TYPE) return parseInt(a.value, 10) || 0;
  }
  return 0;
}
function extractCPL(insight: any, leads: number, spend: number) {
  for (const c of insight.cost_per_action_type || []){
    if (c.action_type === LEAD_ACTION_TYPE) return parseFloat(c.value) || 0;
  }
  if (leads > 0 && spend > 0) return spend / leads;
  return 0;
}
function applyDiagnostics(rows: any[]) {
  const cpls = rows.filter((r)=>r.cpl > 0).map((r)=>r.cpl);
  const ctrs = rows.filter((r)=>r.ctr > 0).map((r)=>r.ctr);
  const cpms = rows.filter((r)=>r.cpm > 0).map((r)=>r.cpm);
  const b = {
    cpl_med: median(cpls),
    cpl_p75: percentile(cpls, 75),
    ctr_med: median(ctrs),
    ctr_p25: percentile(ctrs, 25),
    cpm_med: median(cpms)
  };
  for (const r of rows){
    const diags: string[] = [];
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
    // Oportunidade: ads OK com performance acima da mediana e espaço para escalar
    if (severity === "OK" && r.leads >= 3 && r.spend >= 100) {
      let oppScore = 0;
      const oppDiags: string[] = [];
      if (r.cpl > 0 && b.cpl_med > 0 && r.cpl < b.cpl_med) {
        oppScore++;
        oppDiags.push(`CPL R$${r.cpl.toFixed(0)} esta ${Math.round((1 - r.cpl / b.cpl_med) * 100)}% abaixo da mediana (R$${b.cpl_med.toFixed(0)})`);
      }
      if (r.ctr > 0 && b.ctr_med > 0 && r.ctr > b.ctr_med) {
        oppScore++;
        oppDiags.push(`CTR ${r.ctr.toFixed(2)}% esta ${Math.round((r.ctr / b.ctr_med - 1) * 100)}% acima da mediana`);
      }
      if (r.frequency > 0 && r.frequency < 2.0) {
        oppScore++;
        oppDiags.push(`Frequencia ${r.frequency.toFixed(1)} — audiencia nao saturada, espaco para escalar`);
      }
      if (r.leads >= 10) {
        oppScore++;
        oppDiags.push(`${r.leads} leads gerados — volume consistente`);
      }
      if (oppScore >= 2) {
        severity = "OPORTUNIDADE";
        oppDiags.push("Candidato a aumento de budget");
        diags.length = 0;
        diags.push(...oppDiags);
      }
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
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    // Auth handled by Supabase gateway (--no-verify-jwt not set)
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
    console.log(`sync-szs-meta-ads v1: lifetime ${sinceLifetime} to ${until}, month ${sinceMonth} to ${until}`);
    const PAUSED_STATUSES = [
      "PAUSED",
      "CAMPAIGN_PAUSED",
      "ADSET_PAUSED"
    ];
    // ACTIVE lifetime (single call) + PAUSED lifetime (quarterly windows) + ACTIVE/PAUSED month
    const [lifetimeActiveInsights, monthActiveInsights, monthPausedInsights] = await Promise.all([
      fetchAllInsights(metaToken, sinceLifetime, until, [
        "ACTIVE"
      ]),
      fetchAllInsights(metaToken, sinceMonth, until, [
        "ACTIVE"
      ]),
      fetchAllInsights(metaToken, sinceMonth, until, PAUSED_STATUSES)
    ]);
    // PAUSED lifetime fetched sequentially in quarterly windows to avoid "excessive rows" error
    const lifetimePausedInsights = await fetchLifetimeInWindows(metaToken, sinceLifetime, until, PAUSED_STATUSES);
    console.log(`  lifetime(active): ${lifetimeActiveInsights.length}, lifetime(paused): ${lifetimePausedInsights.length}, month(active): ${monthActiveInsights.length}, month(paused): ${monthPausedInsights.length}`);
    // Merge all lifetime insights (active + paused, dedup by ad_id keeping active version)
    const lifetimeInsights = [...lifetimeActiveInsights];
    const activeAdIds = new Set(lifetimeActiveInsights.map((i: any)=>i.ad_id));
    for (const ins of lifetimePausedInsights){
      if (!activeAdIds.has(ins.ad_id)) {
        lifetimeInsights.push(ins);
        activeAdIds.add(ins.ad_id);
      }
    }
    // Track paused ad IDs for effective_status column
    const pausedAdIds = new Set([
      ...lifetimePausedInsights.map((i: any)=>i.ad_id),
      ...monthPausedInsights.map((i: any)=>i.ad_id),
    ]);
    // Remove from paused set if currently active
    for (const ins of lifetimeActiveInsights) pausedAdIds.delete(ins.ad_id);
    for (const ins of monthActiveInsights) pausedAdIds.delete(ins.ad_id);
    // Month insights = active + paused
    const monthInsights = [
      ...monthActiveInsights,
      ...monthPausedInsights
    ];
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
    const rows: any[] = [];
    let unmatched = 0;
    const unmatchedCampaigns: string[] = [];
    for (const ins of lifetimeInsights){
      const match = matchEmpreendimento(ins.campaign_name);
      if (!match) {
        unmatched++;
        if (!unmatchedCampaigns.includes(ins.campaign_name)) unmatchedCampaigns.push(ins.campaign_name);
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
        empreendimento: match ? match.name : "Outros",
        squad_id: match ? match.squadId : 0,
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
    // Diagnosticos only for matched ads (squad_id > 0)
    const matchedRows = rows.filter((r) => r.squad_id > 0);
    applyDiagnostics(matchedRows);
    const criticos = rows.filter((r)=>r.severidade === "CRITICO").length;
    const alertas = rows.filter((r)=>r.severidade === "ALERTA").length;
    await supabase.from("szs_meta_ads").delete().eq("snapshot_date", snapshotDate);
    if (rows.length > 0) {
      for(let i = 0; i < rows.length; i += 200){
        const batch = rows.slice(i, i + 200).map((r: any)=>({
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
        const { error } = await supabase.from("szs_meta_ads").insert(batch);
        if (error) console.error(`Insert error batch ${i}:`, error.message);
      }
    }
    const totalLeads = rows.reduce((s: number, r: any)=>s + r.leads, 0);
    const totalSpendMonth = rows.reduce((s: number, r: any)=>s + r.spend_month, 0);
    const totalLeadsMonth = rows.reduce((s: number, r: any)=>s + r.leads_month, 0);
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
    console.error("sync-szs-meta-ads fatal:", msg);
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
