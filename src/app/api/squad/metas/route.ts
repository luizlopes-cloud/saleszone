import { NextRequest, NextResponse } from 'next/server'
import { getPipeline, PIPEDRIVE_CANAL_FIELD } from '@/lib/squad/config'
import { pipedriveGet, PipedriveDeal } from '@/lib/squad/pipedrive'
import {
  METAS_2026, METAS_SZS_SUBREGIOES,
  classificarCanal, getMetaTotalMensal, getCanaisMeta,
  getDiasUteis, getDiasUteisPassados
} from '@/lib/squad/metas-2026'
import { getPipeline as getPipelineConfig, PIPEDRIVE_EMPREENDIMENTO_FIELD } from '@/lib/squad/config'

export const runtime = 'nodejs'

// TODO: descobrir campo custom "Cidade onde fica o imóvel" no Pipedrive
const PIPEDRIVE_CIDADE_FIELD = '' // placeholder

// ─── Forecast de Pipeline ────────────────────────────────────────────────────
// Estágios avançados e taxas de conversão por pipeline
// "Avançado" = últimas etapas de OPP (mais perto de fechar)
// "WON stages" = estágios que contam como ganho (Reserva, Contrato)

interface ForecastConfig {
  // Stages OPP avançados (alta probabilidade de conversão)
  advancedOppStages: number[]
  // Todos os stages OPP (para deals em pipeline)
  allOppStages: number[]
  // Stages WON
  wonStages: number[]
  // Taxa de conversão para OPP avançado (ex: 70%)
  advancedConversion: number
  // Taxa de conversão para OPP inicial (ex: 30%)
  earlyConversion: number
}

const FORECAST_CONFIG: Record<string, ForecastConfig> = {
  szi: {
    advancedOppStages: [312, 313, 311], // Proposta Enviada, Análise Jurídica, Negociação
    allOppStages: [340, 208, 312, 313, 311],
    wonStages: [191, 192], // Reservas, Contrato
    advancedConversion: 0.70,
    earlyConversion: 0.30,
  },
  marketplace: {
    advancedOppStages: [308, 309], // últimas etapas OPP
    allOppStages: [337, 274, 308, 309],
    wonStages: [393, 305, 271],
    advancedConversion: 0.70,
    earlyConversion: 0.30,
  },
  szs: {
    advancedOppStages: [74, 75], // Aguardando Dados, Contrato
    allOppStages: [342, 151, 74, 75],
    wonStages: [152, 76],
    advancedConversion: 0.70,
    earlyConversion: 0.30,
  },
  decor: {
    advancedOppStages: [358, 357], // Aguardando Dados, Contrato
    allOppStages: [354, 355, 358, 357],
    wonStages: [356, 359],
    advancedConversion: 0.70,
    earlyConversion: 0.30,
  },
}

interface ForecastResult {
  wonCount: number
  advancedOppCount: number
  advancedOppValue: number
  earlyOppCount: number
  earlyOppValue: number
  forecastTotal: number
  advancedConversion: number
  earlyConversion: number
  leadtimeMedio: number
}

// Calcula leadtime médio (dias entre add_time e won_time) dos deals WON recentes
function calcLeadtimeDias(wonDeals: PipedriveDeal[]): number {
  const leadtimes: number[] = []
  for (const d of wonDeals) {
    if (!d.won_time || !d.add_time) continue
    const addDate = new Date(d.add_time)
    const wonDate = new Date(d.won_time)
    const dias = Math.round((wonDate.getTime() - addDate.getTime()) / 86400000)
    if (dias >= 0 && dias < 365) leadtimes.push(dias)
  }
  if (leadtimes.length === 0) return 30 // fallback
  return Math.round(leadtimes.reduce((a, b) => a + b, 0) / leadtimes.length)
}

// Busca WON dos últimos N dias para calcular conversão real
async function getRecentWonDeals(filterId: number, days: number): Promise<PipedriveDeal[]> {
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const startDate = cutoff.toISOString().split('T')[0]
  const endDate = new Date().toISOString().split('T')[0]
  const allDeals: PipedriveDeal[] = []
  let start = 0
  let hasMore = true
  while (hasMore && start < 5000) {
    const response = await pipedriveGet<PipedriveDeal[]>('deals', {
      filter_id: filterId, status: 'won', start, limit: 500, sort: 'won_time DESC',
    })
    if (!response.data) break
    for (const deal of response.data) {
      if (!deal.won_time) continue
      const wonDate = deal.won_time.split(' ')[0]
      if (wonDate < startDate) { hasMore = false; break }
      if (wonDate <= endDate) allDeals.push(deal)
    }
    hasMore = hasMore && (response.additional_data?.pagination?.more_items_in_collection ?? false)
    start = response.additional_data?.pagination?.next_start ?? start + 500
  }
  return allDeals
}

async function getOpenDealsInStages(filterId: number, stageIds: number[]): Promise<PipedriveDeal[]> {
  const allDeals: PipedriveDeal[] = []
  let start = 0
  let hasMore = true
  while (hasMore && start < 5000) {
    const response = await pipedriveGet<PipedriveDeal[]>('deals', {
      filter_id: filterId,
      status: 'open',
      start,
      limit: 500,
    })
    if (!response.data) break
    for (const deal of response.data) {
      if (stageIds.includes(deal.stage_id)) {
        allDeals.push(deal)
      }
    }
    hasMore = response.additional_data?.pagination?.more_items_in_collection ?? false
    start = response.additional_data?.pagination?.next_start ?? start + 500
  }
  return allDeals
}

async function getWonDeals(filterId: number, monthStart: string, monthEnd: string): Promise<PipedriveDeal[]> {
  const allDeals: PipedriveDeal[] = []
  let start = 0
  let hasMore = true
  while (hasMore && start < 5000) {
    const response = await pipedriveGet<PipedriveDeal[]>('deals', {
      filter_id: filterId,
      status: 'won',
      start,
      limit: 500,
      sort: 'won_time DESC',
    })
    if (!response.data) break
    for (const deal of response.data) {
      if (!deal.won_time) continue
      const wonDate = deal.won_time.split(' ')[0]
      if (wonDate < monthStart) { hasMore = false; break }
      if (wonDate <= monthEnd) allDeals.push(deal)
    }
    hasMore = hasMore && (response.additional_data?.pagination?.more_items_in_collection ?? false)
    start = response.additional_data?.pagination?.next_start ?? start + 500
  }
  return allDeals
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pipelineSlug = searchParams.get('pipeline') || 'szi'
    const pipeline = getPipeline(pipelineSlug)

    // Determine month (default: current)
    const now = new Date()
    const year = parseInt(searchParams.get('year') || String(now.getFullYear()))
    const month = parseInt(searchParams.get('month') || String(now.getMonth() + 1)) - 1 // 0-indexed

    const monthStart = `${year}-${String(month + 1).padStart(2, '0')}-01`
    const lastDay = new Date(year, month + 1, 0).getDate()
    const monthEnd = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

    // Fetch won deals
    const wonDeals = await getWonDeals(pipeline.filterId, monthStart, monthEnd)

    // ─── Forecast de Pipeline (deals abertos em OPP) ────────────────────────
    const fcConfig = FORECAST_CONFIG[pipelineSlug]
    let pipelineForecast: ForecastResult | null = null
    let probableDeals: Array<{ dealId: number; title: string; owner: string; stage: string; value: number; canal: string; conversion: number }> = []

    if (fcConfig) {
      // Busca WON dos últimos 90 dias para calcular conversão real e leadtime
      const recentWon = await getRecentWonDeals(pipeline.filterId, 90)
      const leadtimeMedio = calcLeadtimeDias(recentWon)

      // Conversão real: WON dos últimos 90d vs total de deals que passaram por OPP
      // Simplificação: usa taxas fixas ajustadas pelo volume real se disponível
      let advancedConversion = fcConfig.advancedConversion
      let earlyConversion = fcConfig.earlyConversion

      // Se temos dados suficientes, ajusta com base no histórico
      if (recentWon.length >= 10) {
        // Calcula proporção de WON que vieram de stages avançados vs iniciais
        const advancedSet90 = new Set(fcConfig.advancedOppStages)
        const wonFromAdvanced = recentWon.filter(d => advancedSet90.has(d.stage_id)).length
        const ratio = wonFromAdvanced / recentWon.length
        // Se >60% veio de avançado, aumenta taxa avançada; senão mantém
        if (ratio > 0.6) {
          advancedConversion = Math.min(0.85, fcConfig.advancedConversion + 0.1)
          earlyConversion = Math.max(0.15, fcConfig.earlyConversion - 0.05)
        }
      }

      const allOppStages = [...fcConfig.allOppStages]
      const openOppDeals = await getOpenDealsInStages(pipeline.filterId, allOppStages)

      const advancedSet = new Set(fcConfig.advancedOppStages)
      let advancedCount = 0
      let advancedValue = 0
      let earlyCount = 0
      let earlyValue = 0

      const pipelineCfg = getPipelineConfig(pipelineSlug)

      // Classifica deals em OPP e monta lista de prováveis
      for (const deal of openOppDeals) {
        const isAdvanced = advancedSet.has(deal.stage_id)
        if (isAdvanced) {
          advancedCount++
          advancedValue += deal.value || 0
        } else {
          earlyCount++
          earlyValue += deal.value || 0
        }

        // Monta lista de prováveis ganhos
        const canalId = deal[PIPEDRIVE_CANAL_FIELD] as string | number | undefined
        const canal = classificarCanal(pipelineSlug, canalId)

        // Determina nome do estágio
        let stageName = `Stage ${deal.stage_id}`
        for (const [group, ids] of Object.entries(pipelineCfg.stageIds)) {
          if (ids.includes(deal.stage_id)) { stageName = group; break }
        }

        probableDeals.push({
          dealId: deal.id,
          title: deal.title,
          owner: deal.owner_name || 'Sem responsável',
          stage: stageName,
          value: deal.value || 0,
          canal,
          conversion: isAdvanced ? advancedConversion : earlyConversion,
        })
      }

      // Ordena prováveis: avançados primeiro, depois por valor
      probableDeals.sort((a, b) => b.conversion - a.conversion || b.value - a.value)

      const forecastTotal = Math.round(
        wonDeals.length
        + (advancedCount * advancedConversion)
        + (earlyCount * earlyConversion)
      )

      pipelineForecast = {
        wonCount: wonDeals.length,
        advancedOppCount: advancedCount,
        advancedOppValue: advancedValue,
        earlyOppCount: earlyCount,
        earlyOppValue: earlyValue,
        forecastTotal,
        advancedConversion,
        earlyConversion,
        leadtimeMedio,
      }
    }

    // Classify by canal
    const canaisMeta = getCanaisMeta(pipelineSlug)
    const realizadoPorCanal: Record<string, number> = {}
    for (const canal of canaisMeta) realizadoPorCanal[canal] = 0

    for (const deal of wonDeals) {
      const canalId = deal[PIPEDRIVE_CANAL_FIELD] as string | number | undefined
      const canal = classificarCanal(pipelineSlug, canalId)
      if (realizadoPorCanal[canal] !== undefined) {
        realizadoPorCanal[canal]++
      } else {
        // Canal nao mapeado — agrupa no primeiro canal ou "Outros"
        if (realizadoPorCanal['Outros'] !== undefined) realizadoPorCanal['Outros']++
        else if (realizadoPorCanal['Diretas'] !== undefined) realizadoPorCanal['Diretas']++
      }
    }

    // Calculate MTD metrics
    const today = now.getDate()
    const isCurrentMonth = now.getFullYear() === year && now.getMonth() === month
    const diaRef = isCurrentMonth ? today : lastDay
    const diasUteisTotal = getDiasUteis(year, month)
    const diasUteisPassados = getDiasUteisPassados(year, month, diaRef)

    const metaTotal = getMetaTotalMensal(pipelineSlug, month)
    const realizadoTotal = wonDeals.length
    const esperadoMTD = diasUteisTotal > 0 ? Math.round(metaTotal * (diasUteisPassados / diasUteisTotal)) : 0
    const forecast = diasUteisPassados > 0 ? Math.round(realizadoTotal * (diasUteisTotal / diasUteisPassados)) : 0
    const desvio = realizadoTotal - esperadoMTD

    // Per-canal breakdown
    const canaisData = canaisMeta.map(canal => {
      const meta = METAS_2026[pipelineSlug]?.[canal]?.[month] ?? 0
      const realizado = realizadoPorCanal[canal] ?? 0
      const esperado = diasUteisTotal > 0 ? Math.round(meta * (diasUteisPassados / diasUteisTotal)) : 0
      const fc = diasUteisPassados > 0 ? Math.round(realizado * (diasUteisTotal / diasUteisPassados)) : 0
      return {
        canal,
        meta,
        realizado,
        esperadoMTD: esperado,
        forecast: fc,
        desvio: realizado - esperado,
        pctMeta: meta > 0 ? Math.round((realizado / meta) * 100) : 0,
      }
    })

    // SZS sub-regions
    let subregioes: Array<{ regiao: string; meta: number; realizado: number; esperadoMTD: number; forecast: number; desvio: number; pctMeta: number }> | undefined
    if (pipelineSlug === 'szs' && PIPEDRIVE_CIDADE_FIELD) {
      subregioes = Object.entries(METAS_SZS_SUBREGIOES).map(([regiao, metas]) => {
        const meta = metas[month] ?? 0
        const realizado = wonDeals.filter(d => {
          const cidade = String(d[PIPEDRIVE_CIDADE_FIELD] || '')
          if (regiao === 'Salvador') return cidade.toLowerCase().includes('salvador')
          if (regiao === 'SP') return cidade.toLowerCase().includes('são paulo') || cidade.toLowerCase().includes('sao paulo')
          return false
        }).length
        const esperado = diasUteisTotal > 0 ? Math.round(meta * (diasUteisPassados / diasUteisTotal)) : 0
        const fc = diasUteisPassados > 0 ? Math.round(realizado * (diasUteisTotal / diasUteisPassados)) : 0
        return { regiao, meta, realizado, esperadoMTD: esperado, forecast: fc, desvio: realizado - esperado, pctMeta: meta > 0 ? Math.round((realizado / meta) * 100) : 0 }
      })
    }

    // Lista de deals ganhos no mês (para Task 3)
    const pipelineCfgFinal = getPipelineConfig(pipelineSlug)
    const wonDealsList = wonDeals.map(d => {
      const canalId = d[PIPEDRIVE_CANAL_FIELD] as string | number | undefined
      const canal = classificarCanal(pipelineSlug, canalId)
      const empKey = d[PIPEDRIVE_EMPREENDIMENTO_FIELD] as string | number | undefined
      let emp = '-'
      if (empKey && pipelineCfgFinal.empOptions[Number(empKey)]) {
        emp = pipelineCfgFinal.empOptions[Number(empKey)]
      }
      return {
        dealId: d.id,
        title: d.title,
        owner: d.owner_name || '',
        wonTime: d.won_time || '',
        value: d.value || 0,
        canal,
        empreendimento: emp,
      }
    }).sort((a, b) => b.wonTime.localeCompare(a.wonTime))

    return NextResponse.json({
      pipeline: pipelineSlug,
      ano: year,
      mes: month + 1,
      mesNome: new Date(year, month).toLocaleDateString('pt-BR', { month: 'long' }),
      diasUteisTotal,
      diasUteisPassados,
      isCurrentMonth,
      resumo: { metaTotal, realizadoTotal, esperadoMTD, forecast, desvio, pctMeta: metaTotal > 0 ? Math.round((realizadoTotal / metaTotal) * 100) : 0 },
      canais: canaisData,
      subregioes,
      pipelineForecast,
      wonDeals: wonDealsList,
      probableDeals,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Erro na rota /api/squad/metas:', error)
    return NextResponse.json({ error: 'Erro interno ao calcular metas' }, { status: 500 })
  }
}
