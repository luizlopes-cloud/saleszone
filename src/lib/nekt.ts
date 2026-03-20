export interface NektQueryResult {
  columns: string[]
  rows: Record<string, string | number | null>[]
}

/**
 * Executa uma query SQL na Nekt Data API e retorna os dados parseados.
 * Tabela: nekt_silver.ads_unificado
 */
export async function queryNekt(sql: string): Promise<NektQueryResult> {
  const apiKey = process.env.NEKT_API_KEY
  if (!apiKey) throw new Error("NEKT_API_KEY não configurada")

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

  let presignedUrl: string | undefined
  if (queryData.presigned_url) {
    presignedUrl = queryData.presigned_url
  } else if (queryData.presigned_urls && Array.isArray(queryData.presigned_urls) && queryData.presigned_urls.length > 0) {
    presignedUrl = queryData.presigned_urls[0]
  } else if (queryData.url) {
    presignedUrl = queryData.url
  }

  if (!presignedUrl) {
    throw new Error(`Nekt API: resposta sem presigned_url — ${JSON.stringify(queryData)}`)
  }

  const csvRes = await fetch(presignedUrl)
  if (!csvRes.ok) throw new Error(`Falha ao baixar CSV: ${csvRes.status}`)
  const csvText = await csvRes.text()

  return parseCSV(csvText)
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

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : ""
  return `SELECT * FROM nekt_silver.ads_unificado ${where} ORDER BY date DESC`
}
