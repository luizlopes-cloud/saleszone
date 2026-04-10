import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

// Nekt Data API helpers
async function queryNekt(nektApiKey: string, sql: string): Promise<Record<string, string | null>[]> {
  const res = await fetch("https://api.nekt.ai/api/v1/sql-query/", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": nektApiKey },
    body: JSON.stringify({ sql, mode: "csv" }),
  });
  if (!res.ok) throw new Error(`Nekt API error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  const url = data.presigned_url || data.presigned_urls?.[0];
  if (!url) throw new Error("Nekt: no presigned_url");
  const csvRes = await fetch(url);
  const csvText = await csvRes.text();
  return parseCSV(csvText);
}

function parseCSV(csv: string): Record<string, string | null>[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const values = parseCSVLine(line);
    const row: Record<string, string | null> = {};
    for (let i = 0; i < headers.length; i++) {
      const val = (values[i] ?? "").trim();
      row[headers[i]] = val === "" || val === "null" ? null : val;
    }
    return row;
  });
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (ch === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result;
}

// ── Helpers para normalizar datas ──────────────────────────────────────────
function toTs(s: string | null): string | null {
  if (!s) return null;
  try { return new Date(s).toISOString(); } catch { return null; }
}

// Subjects que identificam cada tipo de tentativa
// 1ª Tentativa pela MIA
const SUBJECTS_1A = [
  "1ª Tentativa de contato pela MIA",
  "1ª Tentativa de contato - [MIA]",
  "1 Tentativa MIA",
  "1ª Tentativa MIA",
];
// 2ª Tentativa pela MIA
const SUBJECTS_2A = [
  "2ª Tentativa de contato pela MIA",
  "2ª Tentativa de Contato - [MIA]",
  "2ª Tentativa de Contato",
  "2 Tentativa MIA",
  "2ª Tentativa MIA",
];
// Encerramento / fim de fluxo de cadência
const SUBJECTS_ENCERRAMENTO = [
  "Encerramento de Fluxo de Cadência",
  "FUP/ Encerramento",
  "Fup/ Encerramento",
  "FUP/ encerramento",
  "Encerramento",
  "Encerramento/ Sem retorno",
  "Encerramento de contrato com a Seazone",
  "E-mail de encerramento de contato",
  "Ligação de encerramento",
  "Mensagem encerramento de contato",
  "chat de encerramento no whats",
];

function matchSubject(subj: string | null, list: string[]): boolean {
  if (!subj) return false;
  const s = subj.trim();
  return list.some(pattern => s === pattern || s.includes(pattern));
}

interface TentativaRow {
  deal_id: number;
  deal_title: string | null;
  owner_name: string | null;
  proprietario: string | null;
  pipeline_id: number | null;
  status: string | null;
  etapa: string | null;
  link_conversa: string | null;
  pessoa_nome: string | null;
  cidade: string | null;
  has_1a: boolean;
  has_2a: boolean;
  has_encerramento: boolean;
  num_tentativas: number;
  first_attempt_at: string | null;
  last_attempt_at: string | null;
  encerrmento_at: string | null;
  // activity ids
  fk_1a: number | null;
  fk_2a: number | null;
  fk_enc: number | null;
  // for ordering
  min_stage_order: number | null;
}

async function fetchActivities(nektApiKey: string): Promise<Record<string, string | null>[]> {
  // Query all tentativa + encerramento activities from Nekt
  // We need: id, deal_id, subject, add_time, type, owner_name
  const sql = `
    SELECT
      a.id,
      a.deal_id,
      a.subject,
      a.type,
      a.add_time,
      a.owner_name,
      d.titulo as deal_title,
      d.proprietario,
      d.pipeline_id,
      d.status,
      d.etapa,
      d.link_da_conversa,
      d.pessoa_nome,
      d.cidade_mia,
      d.stage_order
    FROM nekt_silver.pipedrive_atividades_com_prevendas_e_vendas a
    LEFT JOIN (
      SELECT id, titulo, proprietario, pipeline_id, status, etapa,
             link_da_conversa, pessoa_nome, cidade_mia, stage_order
      FROM nekt_silver.pipedrive_deals_readable
      WHERE pipeline_id = 28
    ) d ON a.deal_id = d.id
    WHERE a.subject IN (
      '1ª Tentativa de contato pela MIA',
      '1ª Tentativa de contato - [MIA]',
      '1 Tentativa MIA',
      '1ª Tentativa MIA',
      '2ª Tentativa de contato pela MIA',
      '2ª Tentativa de Contato - [MIA]',
      '2ª Tentativa de Contato',
      '2 Tentativa MIA',
      '2ª Tentativa MIA',
      'Encerramento de Fluxo de Cadência',
      'FUP/ Encerramento',
      'Fup/ Encerramento',
      'FUP/ encerramento',
      'Encerramento',
      'Encerramento/ Sem retorno',
      'Encerramento de contrato com a Seazone',
      'E-mail de encerramento de contato',
      'Ligação de encerramento',
      'Mensagem encerramento de contato',
      'chat de encerramento no whats'
    )
    AND a.deal_id IS NOT NULL
  `;

  return queryNekt(nektApiKey, sql);
}

function buildTentativas(rows: Record<string, string | null>[]): TentativaRow[] {
  // Group by deal_id
  const dealMap = new Map<number, TentativaRow>();

  for (const row of rows) {
    const dealId = parseInt(row.deal_id || "0");
    if (!dealId) continue;

    const subj = row.subject;
    const actTime = toTs(row.add_time);
    const actId = parseInt(row.id || "0") || null;

    let entry = dealMap.get(dealId);
    if (!entry) {
      entry = {
        deal_id: dealId,
        deal_title: row.deal_title || null,
        owner_name: row.owner_name || row.proprietario || null,
        proprietario: row.proprietario || null,
        pipeline_id: parseInt(row.pipeline_id || "0") || null,
        status: row.status || null,
        etapa: row.etapa || null,
        link_conversa: row.link_da_conversa || null,
        pessoa_nome: row.pessoa_nome || null,
        cidade: row.cidade_mia || null,
        has_1a: false,
        has_2a: false,
        has_encerramento: false,
        num_tentativas: 0,
        first_attempt_at: null,
        last_attempt_at: null,
        encerrmento_at: null,
        fk_1a: null,
        fk_2a: null,
        fk_enc: null,
        min_stage_order: parseInt(row.stage_order || "999") || 999,
      };
      dealMap.set(dealId, entry);
    }

    // Update stage order
    const so = parseInt(row.stage_order || "999") || 999;
    if (so < entry.min_stage_order) entry.min_stage_order = so;

    // Update fields based on subject type
    if (matchSubject(subj, SUBJECTS_1A)) {
      if (!entry.has_1a) {
        entry.has_1a = true;
        entry.num_tentativas++;
        entry.fk_1a = actId;
        if (!entry.first_attempt_at || (actTime && actTime < entry.first_attempt_at)) {
          entry.first_attempt_at = actTime;
        }
        if (!entry.last_attempt_at || (actTime && actTime > entry.last_attempt_at)) {
          entry.last_attempt_at = actTime;
        }
      }
    } else if (matchSubject(subj, SUBJECTS_2A)) {
      if (!entry.has_2a) {
        entry.has_2a = true;
        entry.num_tentativas++;
        entry.fk_2a = actId;
        if (!entry.last_attempt_at || (actTime && actTime > entry.last_attempt_at)) {
          entry.last_attempt_at = actTime;
        }
      }
    } else if (matchSubject(subj, SUBJECTS_ENCERRAMENTO)) {
      if (!entry.has_encerramento) {
        entry.has_encerramento = true;
        entry.fk_enc = actId;
        entry.encerrmento_at = actTime;
      }
    }
  }

  return Array.from(dealMap.values());
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") || "full";

  // Get secrets
  const nektApiKey = Deno.env.get("NEKT_API_KEY");
  if (!nektApiKey) {
    // Try Supabase Vault via service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceRoleKey);
    const { data: keyData } = await sb.rpc("vault_read_secret", { secret_name: "NEKT_API_KEY" });
    if (!keyData) return new Response(JSON.stringify({ error: "NEKT_API_KEY not configured" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500
    });
    (req as any)._nektApiKey = keyData as string;
  }

  const nektKey = (req as any)._nektApiKey || nektApiKey!;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const startTime = Date.now();

  try {
    console.log("[mia-cadencia] Fetching activities from Nekt...");
    const rows = await fetchActivities(nektKey);
    console.log(`[mia-cadencia] Got ${rows.length} activity rows`);

    const tentativas = buildTentativas(rows);
    console.log(`[mia-cadencia] Built ${tentativas.length} deal records`);

    // Guard: if Nekt returned no rows, do NOT delete existing data
    if (rows.length === 0) {
      return new Response(JSON.stringify({ ok: false, error: "Nekt returned 0 rows — skipping sync to preserve existing data" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Delete all existing records (full sync)
    await supabase.from("squad_mia_tentativas").delete().neq("id", 0);

    // Insert all records
    const records = tentativas.map(t => ({
      deal_id: t.deal_id,
      deal_title: t.deal_title,
      owner_name: t.owner_name,
      proprietario: t.proprietario,
      pipeline_id: t.pipeline_id,
      status: t.status,
      etapa: t.etapa,
      etapa_order: t.min_stage_order && t.min_stage_order < 999 ? t.min_stage_order : null,
      link_conversa: t.link_conversa,
      pessoa_nome: t.pessoa_nome,
      cidade: t.cidade,
      has_1a_tentativa: t.has_1a,
      has_2a_tentativa: t.has_2a,
      has_encerramento: t.has_encerramento,
      num_tentativas: t.num_tentativas,
      first_attempt_at: t.first_attempt_at,
      last_attempt_at: t.last_attempt_at,
      encerrmento_at: t.encerrmento_at,
      fk_activity_1a: t.fk_1a,
      fk_activity_2a: t.fk_2a,
      fk_activity_enc: t.fk_enc,
      synced_at: new Date().toISOString(),
    }));

    // Batch insert (max 1000 per request)
    const BATCH = 500;
    let inserted = 0;
    for (let i = 0; i < records.length; i += BATCH) {
      const batch = records.slice(i, i + BATCH);
      const { error } = await supabase.from("squad_mia_tentativas").insert(batch);
      if (error) throw error;
      inserted += batch.length;
    }

    const duration = Date.now() - startTime;
    console.log(`[mia-cadencia] Done. Inserted ${inserted} records in ${duration}ms`);

    return new Response(JSON.stringify({
      ok: true,
      rows_fetched: rows.length,
      deals_synced: tentativas.length,
      records_inserted: inserted,
      duration_ms: duration,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[mia-cadencia] Error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
