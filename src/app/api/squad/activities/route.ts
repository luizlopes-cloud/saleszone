import { NextRequest, NextResponse } from 'next/server'
import { getPipeline } from '@/lib/squad/config'
import { getSquadsFromDB } from '@/lib/squad/config-db'
import { pipedriveGet, matchOwnerName } from '@/lib/squad/pipedrive'
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

// Busca atividades de um user_id com paginação
async function fetchUserActivities(
  userId: number,
  startDate: string,
  endDate: string
): Promise<PipedriveActivity[]> {
  const all: PipedriveActivity[] = []
  let start = 0
  const limit = 500
  let hasMore = true

  while (hasMore) {
    const res = await pipedriveGet<PipedriveActivity[]>('activities', {
      user_id: userId,
      start_date: startDate,
      end_date: endDate,
      done: 1,
      start,
      limit,
    })
    if (res.data) all.push(...res.data)
    hasMore = res.additional_data?.pagination?.more_items_in_collection ?? false
    start = res.additional_data?.pagination?.next_start ?? start + limit
  }

  return all
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

    // Buscar usuários ativos do Pipedrive
    const usersRes = await pipedriveGet<{ id: number; name: string; active_flag: boolean }[]>('users')
    const allUsers = (usersRes.data ?? []).filter(u => u.active_flag)

    // Mapeia preseller name → user_id
    const pvUserIds = new Map<string, number>()
    for (const pv of preVendedores) {
      const user = allUsers.find(u => matchOwnerName(u.name, pv.name))
      if (user) pvUserIds.set(pv.name, user.id)
    }

    // Busca atividades de cada pré-vendedor em paralelo
    const userIds = Array.from(pvUserIds.values())
    const activitiesPerUser = await Promise.all(
      userIds.map(uid => fetchUserActivities(uid, startDate, endDate))
    )

    // Indexa atividades por user_id
    const actByUser = new Map<number, PipedriveActivity[]>()
    userIds.forEach((uid, i) => actByUser.set(uid, activitiesPerUser[i]))

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
