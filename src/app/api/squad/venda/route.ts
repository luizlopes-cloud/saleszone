import { NextRequest, NextResponse } from 'next/server'
import { getPipeline, PIPEDRIVE_EMPREENDIMENTO_FIELD, Squad } from '@/lib/squad/config'
import { getSquadsFromDB } from '@/lib/squad/config-db'
import { pipedriveGet, PipedriveDeal, matchOwnerName } from '@/lib/squad/pipedrive'
import { getCallsByExtension, calcCallMetrics, findRamal } from '@/lib/squad/api4com'

async function getAllPipelineDeals(filterId: number, status?: string): Promise<PipedriveDeal[]> {
  const allDeals: PipedriveDeal[] = []
  let start = 0
  let hasMore = true
  while (hasMore && start < 3000) {
    const params: Record<string, string | number> = {
      start, limit: 500, filter_id: filterId,
    }
    if (status) params.status = status
    const response = await pipedriveGet<PipedriveDeal[]>('deals', params)
    if (response.data) allDeals.push(...response.data)
    hasMore = response.additional_data?.pagination?.more_items_in_collection ?? false
    start = response.additional_data?.pagination?.next_start ?? start + 500
  }
  return allDeals
}

/**
 * Resolve o empreendimento de um deal e retorna o squad correspondente.
 * Usa o campo customizado "Empreendimento" do Pipedrive.
 */
function getDealSquad(
  deal: PipedriveDeal,
  empOptions: Record<number, string>,
  empToSquad: Record<string, number>,
  squads: Squad[],
): Squad | null {
  const fieldValue = deal[PIPEDRIVE_EMPREENDIMENTO_FIELD]
  if (!fieldValue) return null

  const numValue = typeof fieldValue === 'number' ? fieldValue : Number(fieldValue)
  let empName: string | null = null

  if (!isNaN(numValue) && empOptions[numValue]) {
    empName = empOptions[numValue]
  }

  if (!empName) return null

  const squadId = empToSquad[empName]
  if (squadId == null) return null

  return squads.find(s => s.id === squadId) || null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pipelineSlug = searchParams.get('pipeline') || 'szi'

    const pipeline = getPipeline(pipelineSlug)
    const squads = await getSquadsFromDB(pipelineSlug)

    // Mapeamento empreendimento → squadId
    const empToSquad: Record<string, number> = {}
    for (const sq of squads) {
      for (const emp of sq.empreendimentos) {
        empToSquad[emp] = sq.id
      }
    }

    // Extrai closers de todas as squads
    const closers = squads
      .flatMap(sq => sq.venda.map(v => ({ name: v, squadId: sq.id, squadName: sq.name, color: sq.color })))

    if (closers.length === 0) {
      return NextResponse.json({
        noData: true,
        message: 'Este funil não possui vendedores (closers) configurados.',
        updatedAt: new Date().toISOString(),
      })
    }

    let deals: PipedriveDeal[] = []
    try {
      const [openDeals, wonDeals] = await Promise.all([
        getAllPipelineDeals(pipeline.filterId),
        getAllPipelineDeals(pipeline.filterId, 'won'),
      ])
      const idSet = new Set(openDeals.map(d => d.id))
      deals = [...openDeals]
      for (const d of wonDeals) {
        if (!idSet.has(d.id)) deals.push(d)
      }
    } catch (err) {
      console.error('Erro ao buscar deals do Pipedrive:', err)
    }

    const oppStages = new Set(pipeline.stageIds.OPP)
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')
    let startDate: Date
    let endDate: Date | null = null
    if (dateFrom) {
      startDate = new Date(dateFrom)
    } else {
      startDate = new Date()
      startDate.setDate(startDate.getDate() - 56)
    }
    if (dateTo) {
      endDate = new Date(dateTo + 'T23:59:59')
    }

    interface CloserStats {
      name: string
      squadName: string
      color: string
      dealsOpp: number
      dealsWon: number
      dealsTotal: number
      valorWon: number
      conversaoPct: number
      chamadasTotal: number
      chamadasDia: number
      duracaoMedia: string
      taxaAtendimento: number
    }

    interface RecentWonDeal {
      dealId: number
      dealTitle: string
      dealUrl: string
      closer: string
      empreendimento: string
      valor: number
      wonDate: string
    }

    const closerStats: CloserStats[] = []
    const recentWonDeals: RecentWonDeal[] = []

    const globalOpp = deals.filter(d => oppStages.has(d.stage_id) && d.status !== 'won').length
    const globalWonDeals = deals.filter(d => {
      if (d.status !== 'won') return false
      const wonTime = d.won_time ? new Date(d.won_time) : null
      if (!wonTime) return false
      if (wonTime < startDate) return false
      if (endDate && wonTime > endDate) return false
      return true
    })
    const globalWon = globalWonDeals.length
    const globalValor = globalWonDeals.reduce((sum, d) => sum + (d.value || 0), 0)

    let totalOpp = 0
    let totalWon = 0
    let totalValor = 0

    const callsMap = new Map<string, { calls: Awaited<ReturnType<typeof getCallsByExtension>>['calls']; totalCount: number }>()
    try {
      const callPromises = closers.map(async (cl) => {
        const ramal = findRamal(cl.name)
        if (ramal) {
          const result = await getCallsByExtension(ramal, 7)
          callsMap.set(cl.name, result)
        }
      })
      await Promise.allSettled(callPromises)
    } catch (err) {
      console.warn('[venda] Api4Com indisponível para closers:', err)
    }

    const allOppDeals = deals.filter(d => oppStages.has(d.stage_id) && d.status !== 'won')
    const oppAssigned = new Set<number>()
    const closerOppDeals = new Map<string, PipedriveDeal[]>()
    for (const c of closers) closerOppDeals.set(c.name, [])

    // Passo 1: match por owner_name
    for (const deal of allOppDeals) {
      for (const closer of closers) {
        if (matchOwnerName(deal.owner_name || '', closer.name)) {
          closerOppDeals.get(closer.name)!.push(deal)
          oppAssigned.add(deal.id)
          break
        }
      }
    }

    // Passo 2: match por empreendimento → squad
    for (const deal of allOppDeals) {
      if (oppAssigned.has(deal.id)) continue
      const sq = getDealSquad(deal, pipeline.empOptions, empToSquad, squads)
      if (!sq) continue
      const squadVenda = sq.venda || []
      if (squadVenda.length === 0) continue
      const idx = deal.id % squadVenda.length
      const closerName = squadVenda[idx]
      if (closerOppDeals.has(closerName)) {
        closerOppDeals.get(closerName)!.push(deal)
        oppAssigned.add(deal.id)
      }
    }

    // Passo 3: round-robin restantes
    const unassignedOpp = allOppDeals.filter(d => !oppAssigned.has(d.id))
    for (let i = 0; i < unassignedOpp.length; i++) {
      const closer = closers[i % closers.length]
      closerOppDeals.get(closer.name)!.push(unassignedOpp[i])
    }

    for (const closer of closers) {
      const inOpp = closerOppDeals.get(closer.name) || []

      const ownerDeals = deals.filter(d =>
        matchOwnerName(d.owner_name || '', closer.name)
      )
      const inWon = ownerDeals.filter(d => {
        if (d.status !== 'won') return false
        const wonTime = d.won_time ? new Date(d.won_time) : null
        if (!wonTime) return false
        if (wonTime < startDate) return false
        if (endDate && wonTime > endDate) return false
        return true
      })
      const valorWon = inWon.reduce((sum, d) => sum + (d.value || 0), 0)

      const allCloserDeals = [...inOpp, ...ownerDeals.filter(d => !oppStages.has(d.stage_id) || d.status === 'won')]
      const uniqueDeals = Array.from(new Map(allCloserDeals.map(d => [d.id, d])).values())
      const closerDeals = uniqueDeals.filter(d => {
        if (!d.add_time) return false
        const addTime = new Date(d.add_time)
        if (addTime < startDate) return false
        if (endDate && addTime > endDate) return false
        return true
      })

      totalOpp += inOpp.length
      totalWon += inWon.length
      totalValor += valorWon

      const convTotal = inOpp.length + inWon.length

      const clCallData = callsMap.get(closer.name) || { calls: [], totalCount: 0 }
      const callMetrics = calcCallMetrics(clCallData.calls, clCallData.totalCount, 7)

      closerStats.push({
        name: closer.name,
        squadName: closer.squadName,
        color: closer.color,
        dealsOpp: inOpp.length,
        dealsWon: inWon.length,
        dealsTotal: closerDeals.length,
        valorWon,
        conversaoPct: convTotal > 0 ? Math.round((inWon.length / convTotal) * 100) : 0,
        chamadasTotal: callMetrics.totalChamadas,
        chamadasDia: callMetrics.chamadasDia,
        duracaoMedia: callMetrics.duracaoMediaStr,
        taxaAtendimento: callMetrics.taxaAtendimento,
      })

      for (const deal of inWon.slice(0, 10)) {
        const empKey = deal[PIPEDRIVE_EMPREENDIMENTO_FIELD] as string | number | undefined
        let empName = '-'
        if (empKey && pipeline.empOptions[Number(empKey)]) {
          empName = pipeline.empOptions[Number(empKey)]
        }

        recentWonDeals.push({
          dealId: deal.id,
          dealTitle: deal.title,
          dealUrl: `https://seazone-fd92b9.pipedrive.com/deal/${deal.id}`,
          closer: closer.name,
          empreendimento: empName,
          valor: deal.value || 0,
          wonDate: deal.won_time?.split(' ')[0] || deal.update_time?.split(' ')[0] || '-',
        })
      }
    }

    const conversaoGeral = (globalOpp + globalWon) > 0
      ? Math.round((globalWon / (globalOpp + globalWon)) * 100)
      : 0

    return NextResponse.json({
      totalOpp: globalOpp,
      totalWon: globalWon,
      totalValor: globalValor,
      conversaoPct: conversaoGeral,
      closers: closerStats,
      recentWonDeals: recentWonDeals
        .sort((a, b) => (b.wonDate > a.wonDate ? 1 : -1))
        .slice(0, 20),
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Erro na rota /api/squad/venda:', error)
    return NextResponse.json(
      { error: 'Erro interno ao calcular métricas de venda' },
      { status: 500 }
    )
  }
}
