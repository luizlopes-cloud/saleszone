import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getPipeline } from '@/lib/squad/config'
import { getSquadsFromDB } from '@/lib/squad/config-db'
import { matchOwnerName } from '@/lib/squad/pipedrive'
import { getDiasUteis } from '@/lib/squad/metas-2026'

export const dynamic = 'force-dynamic'

// Meta mensal de atividades por pré-vendedor
const META_MENSAL = 2000

// Tipos de atividade permitidos para pré-venda
const ALLOWED_TYPES = new Set(['call', 'mensagem', 'message', 'whatsapp_chat'])

// Cores e labels por tipo de atividade
const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  call: '#2563EB',
  meeting: '#7C3AED',
  task: '#F97316',
  deadline: '#EF4444',
  lunch: '#10B981',
  whatsapp_chat: '#25D366',
  mensagem: '#6366F1',
  message: '#8B5CF6',
  demo: '#0EA5E9',
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: 'Ligação',
  meeting: 'Reunião',
  task: 'Tarefa',
  deadline: 'Prazo',
  lunch: 'Almoço',
  whatsapp_chat: 'WhatsApp',
  mensagem: 'Mensagem',
  message: 'Mensagem',
  demo: 'Demonstração',
}

interface PipedriveActivity {
  id: number
  user_id: number
  type: string
  due_date: string
  due_time: string | null
  marked_as_done_time: string | null
  done: boolean
  [key: string]: unknown
}

// Busca atividades de um user_id com paginação (usa apiToken direto)
async function fetchUserActivities(
  apiToken: string,
  userId: number,
  startDate: string,
  endDate: string
): Promise<PipedriveActivity[]> {
  const all: PipedriveActivity[] = []
  let start = 0
  const limit = 500
  let hasMore = true
  const domain = process.env.PIPEDRIVE_COMPANY_DOMAIN || 'seazone-fd92b9'

  while (hasMore) {
    const url = `https://${domain}.pipedrive.com/api/v1/activities?api_token=${apiToken}&user_id=${userId}&done=1&start_date=${startDate}&end_date=${endDate}&limit=${limit}&start=${start}`
    const res = await fetch(url, { cache: 'no-store' })
    if (!res.ok) throw new Error(`Pipedrive activities: ${res.status}`)
    const data = await res.json()
    if (data.data) all.push(...data.data)
    hasMore = data.additional_data?.pagination?.more_items_in_collection ?? false
    start = data.additional_data?.pagination?.next_start ?? start + limit
  }

  return all
}

// Resolve API token: env var ou Vault
async function getPipedriveToken(): Promise<string> {
  if (process.env.PIPEDRIVE_API_TOKEN) return process.env.PIPEDRIVE_API_TOKEN
  // Fallback: ler do Vault via service role
  const srvKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (srvKey) {
    const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, srvKey)
    const { data } = await client.rpc('vault_read_secret', { secret_name: 'PIPEDRIVE_API_TOKEN' })
    if (data) return data as string
  }
  throw new Error('PIPEDRIVE_API_TOKEN not found in env or vault')
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pipelineSlug = searchParams.get('pipeline') || 'szi'

    const pipeline = getPipeline(pipelineSlug)
    const squads = await getSquadsFromDB(pipelineSlug)

    // Extrai pré-vendedores de todas as squads (deduplica por nome)
    const seenNames = new Set<string>()
    const preVendedores = squads.flatMap(sq =>
      sq.preVenda
        .filter(pv => {
          if (!pv || seenNames.has(pv)) return false
          seenNames.add(pv)
          return true
        })
        .map(pv => ({ name: pv, squadId: sq.id, squadName: sq.name, color: sq.color }))
    )

    if (preVendedores.length === 0) {
      return NextResponse.json({
        noData: true,
        message: 'Este funil não possui pré-vendedores configurados.',
        updatedAt: new Date().toISOString(),
      })
    }

    // Período
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    const nowSP = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    const startDate = dateFrom || `${nowSP.getFullYear()}-${String(nowSP.getMonth() + 1).padStart(2, '0')}-01`
    const endDate = dateTo || fmtDate(nowSP)

    // Resolver API token (env var ou Vault)
    const apiToken = await getPipedriveToken()
    const domain = process.env.PIPEDRIVE_COMPANY_DOMAIN || 'seazone-fd92b9'

    // Buscar usuários ativos do Pipedrive
    const usersUrl = `https://${domain}.pipedrive.com/api/v1/users?api_token=${apiToken}`
    const usersResp = await fetch(usersUrl, { cache: 'no-store' })
    if (!usersResp.ok) throw new Error(`Pipedrive users: ${usersResp.status}`)
    const usersJson = await usersResp.json()
    const allUsers = ((usersJson.data ?? []) as { id: number; name: string; active_flag: boolean }[]).filter(u => u.active_flag)

    // Mapeia preseller name → user_id
    const pvUserIds = new Map<string, number>()
    for (const pv of preVendedores) {
      const user = allUsers.find(u => matchOwnerName(u.name, pv.name))
      if (user) pvUserIds.set(pv.name, user.id)
    }

    // HÍBRIDO: busca do Supabase (nekt_pipedrive_activities) + Pipedrive (só hoje)
    const userIds = Array.from(pvUserIds.values())
    const todayStr = fmtDate(nowSP)
    const yesterdayDate = new Date(nowSP)
    yesterdayDate.setDate(yesterdayDate.getDate() - 1)
    const yesterdayStr = fmtDate(yesterdayDate)

    // 1. Supabase: atividades do período (exceto hoje) — dados do Nekt, rápido
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    const supabaseActivities: PipedriveActivity[] = []
    const PAGE = 1000
    for (const uid of userIds) {
      let offset = 0
      while (true) {
        const { data } = await admin
          .from('nekt_pipedrive_activities')
          .select('id, user_id, type, due_date, due_time, marked_as_done_time, done')
          .eq('user_id', uid)
          .eq('done', true)
          .gte('due_date', startDate)
          .lt('due_date', todayStr)
          .range(offset, offset + PAGE - 1)
        if (!data || data.length === 0) break
        supabaseActivities.push(...(data as PipedriveActivity[]))
        if (data.length < PAGE) break
        offset += PAGE
      }
    }

    // 2. Pipedrive: só atividades de hoje e ontem (complementa o que Nekt ainda não tem)
    const todayActivities = await Promise.all(
      userIds.map(uid => fetchUserActivities(apiToken, uid, yesterdayStr, todayStr))
    )

    // 3. Combina — Supabase (histórico) + Pipedrive (hoje/ontem), dedup por id
    const seenIds = new Set<number>()
    const allActivities: PipedriveActivity[] = []

    // Pipedrive hoje tem prioridade (mais atualizado)
    for (const acts of todayActivities) {
      for (const act of acts) {
        if (!seenIds.has(act.id)) {
          seenIds.add(act.id)
          allActivities.push(act)
        }
      }
    }
    // Supabase para o resto do período
    for (const act of supabaseActivities) {
      if (!seenIds.has(act.id)) {
        seenIds.add(act.id)
        allActivities.push(act)
      }
    }

    // Indexa atividades por user_id
    const actByUser = new Map<number, PipedriveActivity[]>()
    for (const uid of userIds) actByUser.set(uid, [])
    for (const act of allActivities) {
      const list = actByUser.get(act.user_id)
      if (list) list.push(act)
    }

    // Processa lookups: por tipo, por dia, por hora — filtrando por ALLOWED_TYPES
    const byUserType = new Map<number, Map<string, number>>()
    const byUserDay = new Map<number, Map<string, number>>()
    const byUserHour = new Map<number, Map<number, number>>()

    for (const [uid, activities] of actByUser) {
      const typeMap = new Map<string, number>()
      const dayMap = new Map<string, number>()
      const hourMap = new Map<number, number>()

      for (const act of activities) {
        const tipo = (act.type || '').toLowerCase()
        if (!ALLOWED_TYPES.has(tipo)) continue

        // Por tipo
        typeMap.set(tipo, (typeMap.get(tipo) || 0) + 1)

        // Por dia (due_date = "YYYY-MM-DD")
        if (act.due_date) {
          const day = act.due_date.split(' ')[0] // caso venha com hora
          dayMap.set(day, (dayMap.get(day) || 0) + 1)
        }

        // Por hora (marked_as_done_time = "YYYY-MM-DD HH:MM:SS")
        if (act.marked_as_done_time) {
          const timePart = act.marked_as_done_time.split(' ')[1]
          if (timePart) {
            const hour = parseInt(timePart.split(':')[0], 10)
            if (!isNaN(hour)) {
              hourMap.set(hour, (hourMap.get(hour) || 0) + 1)
            }
          }
        }
      }

      byUserType.set(uid, typeMap)
      byUserDay.set(uid, dayMap)
      byUserHour.set(uid, hourMap)
    }

    // Dias úteis para meta pro-rata
    const startD = new Date(startDate + 'T00:00:00')
    const endD = new Date(endDate + 'T00:00:00')

    function countBusinessDays(from: Date, to: Date): number {
      let count = 0
      const d = new Date(from)
      while (d <= to) {
        const day = d.getDay()
        if (day !== 0 && day !== 6) count++
        d.setDate(d.getDate() + 1)
      }
      return count
    }

    const diasUteisPeriodo = countBusinessDays(startD, endD)
    const diasUteisTotal = getDiasUteis(startD.getFullYear(), startD.getMonth())
    const diasUteisPassados = diasUteisPeriodo

    // Contagem global por tipo
    const tiposTotais: Record<string, number> = {}
    const heatmapGlobal: Record<string, Record<number, number>> = {}

    interface PVStats {
      name: string
      squadName: string
      color: string
      realizado: number
      metaEsperada: number
      metaTotal: number
      pctMeta: number
      projecao: number
      porDia: Record<string, number>
      porTipo: Record<string, number>
      porHora: Record<number, number>
    }

    const pvStats: PVStats[] = []
    let totalAtividades = 0

    for (const pv of preVendedores) {
      const userId = pvUserIds.get(pv.name)

      // Por tipo
      const porTipo: Record<string, number> = {}
      const userTypes = userId ? byUserType.get(userId) : undefined
      let realizado = 0
      if (userTypes) {
        for (const [tipo, cnt] of userTypes) {
          porTipo[tipo] = cnt
          tiposTotais[tipo] = (tiposTotais[tipo] || 0) + cnt
          realizado += cnt
        }
      }
      totalAtividades += realizado

      // Por dia
      const porDia: Record<string, number> = {}
      const userDays = userId ? byUserDay.get(userId) : undefined
      if (userDays) {
        for (const [day, cnt] of userDays) {
          porDia[day] = cnt
        }
      }

      // Por hora
      const porHora: Record<number, number> = {}
      const userHours = userId ? byUserHour.get(userId) : undefined
      if (userHours) {
        for (const [hour, cnt] of userHours) {
          porHora[hour] = cnt
        }
      }

      const metaDiaria = diasUteisTotal > 0 ? Math.round(META_MENSAL / diasUteisTotal) : 0
      const metaTotal = META_MENSAL
      const metaEsperada = metaDiaria * diasUteisPassados
      const pctMeta = metaEsperada > 0 ? Math.round((realizado / metaEsperada) * 100) : 0
      const projecao = diasUteisPassados > 0
        ? Math.round((realizado / diasUteisPassados) * diasUteisTotal)
        : 0

      pvStats.push({
        name: pv.name,
        squadName: pv.squadName,
        color: pv.color,
        realizado,
        metaEsperada,
        metaTotal,
        pctMeta,
        projecao,
        porDia,
        porTipo,
        porHora,
      })
    }

    // Resumo geral
    const metaDiariaCalc = diasUteisTotal > 0 ? Math.round(META_MENSAL / diasUteisTotal) : 0
    const totalMetaEsperada = metaDiariaCalc * diasUteisPassados * preVendedores.length
    const pctMetaGeral = totalMetaEsperada > 0 ? Math.round((totalAtividades / totalMetaEsperada) * 100) : 0
    const projecaoGeral = diasUteisPassados > 0
      ? Math.round((totalAtividades / diasUteisPassados) * diasUteisTotal)
      : 0

    // Lista de tipos com cores e labels
    const activityTypes = Object.entries(tiposTotais)
      .sort((a, b) => b[1] - a[1])
      .map(([type, count]) => ({
        type,
        label: ACTIVITY_TYPE_LABELS[type] || type.charAt(0).toUpperCase() + type.slice(1),
        color: ACTIVITY_TYPE_COLORS[type] || '#6B7280',
        count,
      }))

    return NextResponse.json({
      totalAtividades,
      pctMetaGeral,
      projecaoGeral,
      metaMensal: META_MENSAL,
      metaDiaria: metaDiariaCalc,
      diasUteisTotal,
      diasUteisPassados,
      preVendedores: pvStats.sort((a, b) => b.realizado - a.realizado),
      activityTypes,
      heatmap: heatmapGlobal,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('Erro na rota /api/squad/activities:', msg)
    return NextResponse.json(
      { error: 'Erro interno ao calcular métricas de atividades', detail: msg },
      { status: 500 }
    )
  }
}
