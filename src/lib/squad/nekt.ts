// Cliente Nekt MCP — executa queries SQL via HTTP no data warehouse Athena
// Substitui chamadas diretas ao Pipedrive API para dados que já existem no Nekt

const NEKT_MCP_URL = 'https://nekt-mcp.seazone.com.br'

// Cache do token em memória (expira em ~1 ano, mas re-autenticamos se falhar)
let cachedToken: string | null = null
let cachedSessionId: string | null = null

interface NektSqlResult {
  columns: string[]
  data: (string | null)[][]
  row_count: number
  data_truncated: boolean
  next_page_token?: string
}

// Obtém token OAuth via authorization_code flow (server-side)
// Como estamos em server-side (API route), usamos um token pré-obtido
// O token dura ~1 ano, então cachear em env var é seguro
async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken

  const token = process.env.NEKT_ACCESS_TOKEN
  if (!token) {
    throw new Error(
      'NEKT_ACCESS_TOKEN não configurado. Execute o fluxo OAuth manualmente e salve o token.'
    )
  }

  cachedToken = token
  return token
}

// Inicializa sessão MCP
async function initSession(token: string): Promise<string> {
  if (cachedSessionId) return cachedSessionId

  const res = await fetch(`${NEKT_MCP_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        capabilities: {},
        clientInfo: { name: 'saleszone', version: '1.0' },
      },
      id: 1,
    }),
  })

  // Extrair session ID do header
  const sessionId = res.headers.get('mcp-session-id')
  if (!sessionId) {
    throw new Error('Nekt MCP não retornou session ID')
  }

  // Enviar initialized notification
  await fetch(`${NEKT_MCP_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Mcp-Session-Id': sessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    }),
  })

  cachedSessionId = sessionId
  return sessionId
}

// Executa SQL no Nekt via MCP
export async function nektQuery(sql: string): Promise<NektSqlResult> {
  const token = await getToken()
  const sessionId = await initSession(token)

  const res = await fetch(`${NEKT_MCP_URL}/mcp`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Mcp-Session-Id': sessionId,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method: 'tools/call',
      params: {
        name: 'execute_sql',
        arguments: { sql_query: sql },
      },
      id: Date.now(),
    }),
  })

  const text = await res.text()

  // Parse SSE response
  // Extrair o JSON-RPC data da resposta SSE (pode ter múltiplas linhas)
  const dataIdx = text.indexOf('data: {')
  const dataMatch = dataIdx >= 0 ? [null, text.slice(dataIdx + 6).trim()] : null
  if (!dataMatch) {
    // Pode ser que o token expirou — limpar cache e re-tentar
    cachedToken = null
    cachedSessionId = null
    throw new Error(`Nekt MCP retornou resposta inesperada: ${text.slice(0, 200)}`)
  }

  const jsonRpc = JSON.parse(dataMatch[1] as string)

  if (jsonRpc.error) {
    throw new Error(`Nekt MCP error: ${JSON.stringify(jsonRpc.error)}`)
  }

  const content = jsonRpc.result?.content
  if (!content || content.length === 0) {
    throw new Error('Nekt MCP retornou resposta vazia')
  }

  // O resultado SQL vem como texto JSON dentro do content
  const sqlResult = JSON.parse(content[0].text)

  if (sqlResult.status === 'failed') {
    throw new Error(`SQL error: ${sqlResult.error}`)
  }

  return sqlResult as NektSqlResult
}

// Helpers para queries comuns

// Busca atividades do Pipedrive por período
export async function queryActivities(
  startDate: string,
  endDate: string,
  userIds?: number[]
): Promise<NektSqlResult> {
  const userFilter = userIds && userIds.length > 0
    ? `AND user_id IN (${userIds.join(',')})`
    : ''

  return nektQuery(`
    SELECT
      id,
      user_id,
      type,
      due_date,
      due_time,
      marked_as_done_time,
      deal_id,
      person_id
    FROM "nekt_trusted"."pipedrive_szs_activities"
    WHERE done = true
      AND due_date >= TIMESTAMP '${startDate}'
      AND due_date < TIMESTAMP '${endDate}'
      ${userFilter}
    ORDER BY due_date DESC
  `)
}

// Busca usuários ativos do Pipedrive
export async function queryActiveUsers(): Promise<{ id: number; name: string }[]> {
  const result = await nektQuery(`
    SELECT id, name
    FROM "nekt_trusted"."pipedrive_szs_users"
    WHERE active_flag = true
    ORDER BY name
  `)

  return result.data.map(row => ({
    id: parseInt(row[0] || '0', 10),
    name: row[1] || '',
  }))
}

// Busca contagem de atividades agregadas por user e tipo (mais eficiente)
export async function queryActivityCounts(
  startDate: string,
  endDate: string,
  userIds: number[],
  allowedTypes: string[]
): Promise<{
  byUserType: { user_id: number; type: string; count: number }[]
  byUserDay: { user_id: number; day: string; count: number }[]
  byUserHour: { user_id: number; hour: number; count: number }[]
}> {
  if (userIds.length === 0) {
    return { byUserType: [], byUserDay: [], byUserHour: [] }
  }

  const userFilter = `user_id IN (${userIds.join(',')})`
  const typeFilter = `LOWER(type) IN (${allowedTypes.map(t => `'${t}'`).join(',')})`

  // 3 queries agregadas em paralelo — muito mais eficiente que buscar todas as atividades raw
  const [byTypeResult, byDayResult, byHourResult] = await Promise.all([
    // Contagem por user + tipo
    nektQuery(`
      SELECT user_id, LOWER(type) as type, COUNT(*) as cnt
      FROM "nekt_trusted"."pipedrive_szs_activities"
      WHERE done = true
        AND due_date >= TIMESTAMP '${startDate}'
        AND due_date < TIMESTAMP '${endDate}'
        AND ${userFilter}
        AND ${typeFilter}
      GROUP BY user_id, LOWER(type)
    `),
    // Contagem por user + dia
    nektQuery(`
      SELECT user_id, date_format(due_date, '%Y-%m-%d') as day, COUNT(*) as cnt
      FROM "nekt_trusted"."pipedrive_szs_activities"
      WHERE done = true
        AND due_date >= TIMESTAMP '${startDate}'
        AND due_date < TIMESTAMP '${endDate}'
        AND ${userFilter}
        AND ${typeFilter}
      GROUP BY user_id, date_format(due_date, '%Y-%m-%d')
    `),
    // Contagem por user + hora (da marked_as_done_time, convertida para São Paulo UTC-3)
    nektQuery(`
      SELECT user_id, hour(marked_as_done_time - interval '3' hour) as hora, COUNT(*) as cnt
      FROM "nekt_trusted"."pipedrive_szs_activities"
      WHERE done = true
        AND due_date >= TIMESTAMP '${startDate}'
        AND due_date < TIMESTAMP '${endDate}'
        AND ${userFilter}
        AND ${typeFilter}
        AND marked_as_done_time IS NOT NULL
      GROUP BY user_id, hour(marked_as_done_time - interval '3' hour)
    `),
  ])

  return {
    byUserType: byTypeResult.data.map(r => ({
      user_id: parseInt(r[0] || '0', 10),
      type: r[1] || '',
      count: parseInt(r[2] || '0', 10),
    })),
    byUserDay: byDayResult.data.map(r => ({
      user_id: parseInt(r[0] || '0', 10),
      day: (r[1] || '').split(' ')[0], // "2026-03-20 00:00:00.000 UTC" → "2026-03-20"
      count: parseInt(r[2] || '0', 10),
    })),
    byUserHour: byHourResult.data.map(r => ({
      user_id: parseInt(r[0] || '0', 10),
      hour: parseInt(r[1] || '0', 10),
      count: parseInt(r[2] || '0', 10),
    })),
  }
}
