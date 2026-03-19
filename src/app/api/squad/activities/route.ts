import { NextRequest, NextResponse } from 'next/server'
import { getPipeline } from '@/lib/squad/config'
import { getSquadsFromDB } from '@/lib/squad/config-db'
import { pipedriveGet, matchOwnerName } from '@/lib/squad/pipedrive'
import { getDiasUteis, getDiasUteisPassados } from '@/lib/squad/metas-2026'

// Tipo de atividade do Pipedrive
interface PipedriveActivity {
  id: number
  type: string
  done: boolean
  user_id: number
  owner_name?: string
  subject?: string
  due_date: string
  due_time?: string
  marked_as_done_time?: string
  add_time: string
  deal_id?: number
  person_id?: number
  [key: string]: unknown
}

// Meta mensal de atividades por pré-vendedor (dividida pelos dias úteis do mês)
const META_MENSAL = 2000

// Cores por tipo de atividade do Pipedrive
const ACTIVITY_TYPE_COLORS: Record<string, string> = {
  call: '#2563EB',
  meeting: '#7C3AED',
  task: '#F97316',
  deadline: '#EF4444',
  lunch: '#10B981',
  whatsapp: '#25D366',
  demo: '#0EA5E9',
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  call: 'Ligação',
  meeting: 'Reunião',
  task: 'Tarefa',
  deadline: 'Prazo',
  lunch: 'Almoço',
  whatsapp: 'WhatsApp',
  demo: 'Demonstração',
}

async function getAllActivities(
  startDate: string,
  endDate: string,
  userId?: number
): Promise<PipedriveActivity[]> {
  const allActivities: PipedriveActivity[] = []
  let start = 0
  let hasMore = true

  while (hasMore && start < 5000) {
    const params: Record<string, string | number> = {
      start,
      limit: 500,
      start_date: startDate,
      end_date: endDate,
      done: 1,
    }
    if (userId) params.user_id = userId

    const response = await pipedriveGet<PipedriveActivity[]>('activities', params)
    if (response.data) allActivities.push(...response.data)
    hasMore = response.additional_data?.pagination?.more_items_in_collection ?? false
    start = response.additional_data?.pagination?.next_start ?? start + 500
  }

  return allActivities
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

    // Usa fuso de São Paulo para calcular "hoje"
    const nowSP = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Sao_Paulo' }))
    const fmtDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

    let startDate = dateFrom || `${nowSP.getFullYear()}-${String(nowSP.getMonth() + 1).padStart(2, '0')}-01`
    let endDate = dateTo || fmtDate(nowSP)

    // Pipedrive bug: start_date == end_date retorna 0 items. Expandir +1 dia.
    if (startDate === endDate) {
      const next = new Date(endDate + 'T12:00:00')
      next.setDate(next.getDate() + 1)
      endDate = next.toISOString().split('T')[0]
    }

    // Resolver user_ids dos presellers no Pipedrive
    interface PipedriveUser { id: number; name: string; active_flag: boolean }
    let allUsers: PipedriveUser[] = []
    try {
      const usersResp = await pipedriveGet<PipedriveUser[]>('users', { limit: 500 })
      allUsers = (usersResp.data || []).filter(u => u.active_flag)
    } catch (err) {
      console.error('Erro ao buscar usuários do Pipedrive:', err)
    }

    // Mapeia preseller name → user_id
    const pvUserIds = new Map<string, number>()
    for (const pv of preVendedores) {
      const user = allUsers.find(u => matchOwnerName(u.name, pv.name))
      if (user) pvUserIds.set(pv.name, user.id)
    }

    // Busca atividades por user_id de cada preseller em paralelo
    // Apenas tipos relevantes de pré-venda
    const allowedTypes = new Set(['call', 'mensagem', 'message', 'whatsapp_chat'])
    const pvActivitiesMap = new Map<string, PipedriveActivity[]>()

    await Promise.allSettled(
      preVendedores.map(async (pv) => {
        const userId = pvUserIds.get(pv.name)
        if (!userId) {
          pvActivitiesMap.set(pv.name, [])
          return
        }
        try {
          const acts = await getAllActivities(startDate, endDate, userId)
          // Filtra: só tipos permitidos + filtra pelo dia original (caso expandido)
          const originalStart = dateFrom || `${nowSP.getFullYear()}-${String(nowSP.getMonth() + 1).padStart(2, '0')}-01`
          const originalEnd = dateTo || fmtDate(nowSP)
          pvActivitiesMap.set(
            pv.name,
            acts.filter(a => {
              const tipo = (a.type || '').toLowerCase()
              if (!allowedTypes.has(tipo)) return false
              // Garante que a atividade está dentro do período original
              const dueDate = a.due_date
              if (dueDate && (dueDate < originalStart || dueDate > originalEnd)) return false
              return true
            })
          )
        } catch {
          pvActivitiesMap.set(pv.name, [])
        }
      })
    )

    // Calcula dias úteis para meta pro-rata
    // Usa datas originais do request (antes da expansão do Pipedrive)
    const originalStart = dateFrom || `${nowSP.getFullYear()}-${String(nowSP.getMonth() + 1).padStart(2, '0')}-01`
    const originalEnd = dateTo || fmtDate(nowSP)

    const startD = new Date(originalStart + 'T00:00:00')
    const endD = new Date(originalEnd + 'T00:00:00')

    // Conta dias úteis no período selecionado (seg-sex)
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

    // Dias úteis totais do mês (para projeção)
    const diasUteisTotal = getDiasUteis(startD.getFullYear(), startD.getMonth())
    const diasUteisPassados = diasUteisPeriodo

    // Contagem global por tipo de atividade
    const tiposTotais: Record<string, number> = {}
    // Heatmap global: dia → hora → count
    const heatmapGlobal: Record<string, Record<number, number>> = {}

    // Agrupa por pré-vendedor
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
      const pvActivities = pvActivitiesMap.get(pv.name) || []

      const realizado = pvActivities.length
      totalAtividades += realizado

      // Atividades por dia, por tipo e por hora
      const porDia: Record<string, number> = {}
      const porTipo: Record<string, number> = {}
      const porHora: Record<number, number> = {}

      for (const a of pvActivities) {
        const doneDate = a.marked_as_done_time
          ? a.marked_as_done_time.split(' ')[0]
          : a.due_date
        if (doneDate) {
          porDia[doneDate] = (porDia[doneDate] || 0) + 1
        }

        // Por tipo
        const tipo = (a.type || 'other').toLowerCase()
        porTipo[tipo] = (porTipo[tipo] || 0) + 1
        tiposTotais[tipo] = (tiposTotais[tipo] || 0) + 1

        // Por hora (do done_time ou due_time)
        const timeStr = a.marked_as_done_time || a.due_time || ''
        const timePart = timeStr.includes(' ') ? timeStr.split(' ')[1] : timeStr
        if (timePart) {
          const hour = parseInt(timePart.split(':')[0], 10)
          if (!isNaN(hour)) {
            porHora[hour] = (porHora[hour] || 0) + 1

            // Heatmap global
            if (doneDate) {
              if (!heatmapGlobal[doneDate]) heatmapGlobal[doneDate] = {}
              heatmapGlobal[doneDate][hour] = (heatmapGlobal[doneDate][hour] || 0) + 1
            }
          }
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

    // Monta lista de tipos com cores e labels
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
    console.error('Erro na rota /api/squad/activities:', error)
    return NextResponse.json(
      { error: 'Erro interno ao calcular métricas de atividades' },
      { status: 500 }
    )
  }
}
