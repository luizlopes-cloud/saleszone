export interface NektQueryResult {
  columns: string[]
  rows: Record<string, string | number | null>[]
}

/**
 * Executa uma query SQL na Nekt Data API e retorna os dados parseados.
 * Tabela: nekt_silver.ads_unificado
 */
async function getNektApiKey(): Promise<string> {
  if (process.env.NEKT_API_KEY) return process.env.NEKT_API_KEY
  // Fallback: ler do Vault via service role (Vercel não tem env var)
  const srvKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (srvKey) {
    const { createClient } = await import("@supabase/supabase-js")
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, srvKey)
    const { data } = await client.rpc("vault_read_secret", { secret_name: "NEKT_API_KEY" })
    if (data) return data as string
  }
  throw new Error("NEKT_API_KEY não configurada (env nem vault)")
}

export async function queryNekt(sql: string): Promise<NektQueryResult> {
  const apiKey = await getNektApiKey()

  const queryRes = await fetch("https://api.nekt.ai/api/v1/sql-query/", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
    },
    body: JSON.stringify({ sql, mode: "csv" }),
  })

  if (!queryRes.ok) {
    const body = await queryRes.text()
    throw new Error(`Nekt API error (${queryRes.status}): ${body}`)
  }

  const queryData = await queryRes.json()

  // A API pode retornar presigned_url (singular) ou presigned_urls (plural array)
  let urls: string[] = []
  if (queryData.presigned_urls && Array.isArray(queryData.presigned_urls) && queryData.presigned_urls.length > 0) {
    urls = queryData.presigned_urls
  } else if (queryData.presigned_url) {
    urls = [queryData.presigned_url]
  } else if (queryData.url) {
    urls = [queryData.url]
  }

  if (urls.length === 0) {
    throw new Error(`Nekt API: resposta sem presigned_url — ${JSON.stringify(queryData)}`)
  }

  // Baixa todos os chunks em paralelo
  const csvChunks = await Promise.all(urls.map(async (url) => {
    const res = await fetch(url)
    if (!res.ok) throw new Error(`Falha ao baixar CSV: ${res.status}`)
    return res.text()
  }))

  // Concatena (chunks após o primeiro têm header — pular)
  const combined = csvChunks[0] + (csvChunks.length > 1
    ? "\n" + csvChunks.slice(1).map(c => c.trim().split("\n").slice(1).join("\n")).join("\n")
    : "")

  return parseCSV(combined)
}

function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ""
  let inQuotes = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === "," && !inQuotes) {
      result.push(current.trim())
      current = ""
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function parseCSV(csv: string): NektQueryResult {
  const lines = csv.trim().split("\n")
  if (lines.length < 1) return { columns: [], rows: [] }

  const columns = parseCSVLine(lines[0]).map(h => h.trim().toLowerCase())

  const numericCols = new Set([
    "impressions", "reach", "clicks", "frequency", "dias_ativos",
    "lead", "ctr", "mql", "sql", "opp", "won", "spend",
  ])

  const rows = lines.slice(1).map(line => {
    const values = parseCSVLine(line)
    const row: Record<string, string | number | null> = {}
    for (let i = 0; i < columns.length; i++) {
      const col = columns[i]
      const val = (values[i] ?? "").trim()
      if (val === "" || val === "null" || val === "NULL") {
        row[col] = null
      } else if (numericCols.has(col)) {
        row[col] = parseFloat(val.replace(",", ".")) || 0
      } else {
        row[col] = val
      }
    }
    return row
  })

  return { columns, rows }
}

export function buildFilteredSQL(filters: {
  campaign_name?: string
  vertical?: string
  status?: string
  date_from?: string
  date_to?: string
  window?: number
  ad_id?: string
}): string {
  const windowDays = filters.window || 90
  const conditions: string[] = []

  if (!filters.date_from) {
    conditions.push(`date >= CURRENT_DATE - INTERVAL '${windowDays}' DAY`)
  } else {
    conditions.push(`date >= DATE '${filters.date_from}'`)
  }

  if (filters.date_to) {
    conditions.push(`date <= DATE '${filters.date_to}'`)
  }

  if (filters.campaign_name) {
    const escaped = filters.campaign_name.replace(/'/g, "''")
    conditions.push(`campaign_name LIKE '%${escaped}%'`)
  }

  if (filters.vertical) {
    const escaped = filters.vertical.replace(/'/g, "''")
    conditions.push(`vertical = '${escaped}'`)
  }

  // Status da Nekt é unreliable — status real vem do Meta API
  // Não filtramos por status no SQL

  if (filters.ad_id) {
    const escaped = filters.ad_id.replace(/'/g, "''")
    conditions.push(`ad_id = '${escaped}'`)
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
  return `SELECT * FROM nekt_silver.ads_unificado ${where} ORDER BY date DESC`
}
