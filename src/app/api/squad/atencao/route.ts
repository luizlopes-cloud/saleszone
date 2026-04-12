import { NextRequest, NextResponse } from 'next/server'
import { getPipeline, PIPEDRIVE_EMPREENDIMENTO_FIELD } from '@/lib/squad/config'
import { getSquadsFromDB } from '@/lib/squad/config-db'
import { pipedriveGet, PipedriveDeal, matchOwnerName } from '@/lib/squad/pipedrive'

// Nomes excluídos (automação/bots, não pessoas reais)
const EXCLUDED_OWNERS = ['automacao', 'automação', 'morada - mia', 'morada-mia', 'morada mia', 'bizops']

// Busca todos os deals abertos de um pipeline (paginação automática)
async function getOpenPipelineDeals(pipelineId: number): Promise<PipedriveDeal[]> {
  const allDeals: PipedriveDeal[] = []
  let start = 0
  let hasMore = true
  while (hasMore && start < 5000) {
    const response = await pipedriveGet<PipedriveDeal[]>(`pipelines/${pipelineId}/deals`, {
      start, limit: 500, status: 'open',
    })
    if (response.data) allDeals.push(...response.data)
    hasMore = response.additional_data?.pagination?.more_items_in_collection ?? false
    start = response.additional_data?.pagination?.next_start ?? start + 500
  }
  return allDeals
}

// Classifica deal: 'sem_atividade' | 'atrasada' | 'ok'
function classifyDeal(deal: PipedriveDeal): 'sem_atividade' | 'atrasada' | 'ok' {
  const nextDate = deal.next_activity_date
  if (!nextDate) return 'sem_atividade'

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const next = new Date(nextDate + 'T00:00:00')

  if (next < today) return 'atrasada'
  return 'ok'
}

// Nome do estágio a partir do ID (lookup nas configurações do pipeline)
function getStageName(stageId: number, pipeline: ReturnType<typeof getPipeline>): string {
  for (const [group, ids] of Object.entries(pipeline.stageIds)) {
    if (ids.includes(stageId)) return group
  }
  return `Stage ${stageId}`
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pipelineSlug = searchParams.get('pipeline') || 'szi'

    const pipeline = getPipeline(pipelineSlug)
    const role = searchParams.get('role') || 'prevenda'

    // Busca squads para saber quem é pré-venda vs venda
    const squads = await getSquadsFromDB(pipelineSlug)

    // Coleta nomes por cargo (deduplica)
    const roleNames = new Set<string>()
    for (const sq of squads) {
      const names = role === 'venda' ? sq.venda : sq.preVenda
      for (const n of names) {
        if (n) roleNames.add(n)
      }
    }

    // Busca deals abertos
    let deals: PipedriveDeal[] = []
    try {
      deals = await getOpenPipelineDeals(pipeline.id)
    } catch (err) {
      console.error('Erro ao buscar deals do Pipedrive:', err)
    }

    // Filtra apenas deals com status open
    const openDeals = deals.filter(d => d.status === 'open')

    // Se role=venda, filtra apenas deals em estágios OPP
    let filteredDeals = openDeals
    if (role === 'venda') {
      const oppStages = new Set(pipeline.stageIds.OPP)
      filteredDeals = openDeals.filter(d => oppStages.has(d.stage_id))
    }

    // Filtra deals: só mostra os cujo responsável pertence ao cargo (prevenda/venda)
    // e exclui automação/bots
    const isExcluded = (name: string) =>
      EXCLUDED_OWNERS.some(ex => name.toLowerCase().includes(ex))

    const isRoleMember = (ownerName: string) =>
      [...roleNames].some(configName => matchOwnerName(ownerName, configName))

    filteredDeals = filteredDeals.filter(d => {
      const owner = d.owner_name || ''
      if (!owner || isExcluded(owner)) return false
      return isRoleMember(owner)
    })

    // Classifica cada deal
    interface DealAtencao {
      dealId: number
      dealTitle: string
      dealUrl: string
      responsavel: string
      etapa: string
      etapaGroup: string
      empreendimento: string
      nextActivityDate: string | null
      lastActivityDate: string | null
      motivo: 'sem_atividade' | 'atrasada'
    }

    const semAtividade: DealAtencao[] = []
    const atrasada: DealAtencao[] = []

    // Contadores por responsável
    const porResponsavel: Record<string, { sem: number; atrasada: number; total: number }> = {}

    for (const deal of filteredDeals) {
      const classification = classifyDeal(deal)
      if (classification === 'ok') continue

      const empKey = deal[PIPEDRIVE_EMPREENDIMENTO_FIELD] as string | number | undefined
      let empName = '-'
      if (empKey && pipeline.empOptions[Number(empKey)]) {
        empName = pipeline.empOptions[Number(empKey)]
      }

      const responsavel = deal.owner_name || 'Sem responsável'
      const etapaGroup = getStageName(deal.stage_id, pipeline)

      const item: DealAtencao = {
        dealId: deal.id,
        dealTitle: deal.title,
        dealUrl: `https://seazone-fd92b9.pipedrive.com/deal/${deal.id}`,
        responsavel,
        etapa: etapaGroup,
        etapaGroup,
        empreendimento: empName,
        nextActivityDate: deal.next_activity_date,
        lastActivityDate: deal.last_activity_date,
        motivo: classification === 'sem_atividade' ? 'sem_atividade' : 'atrasada',
      }

      if (classification === 'sem_atividade') {
        semAtividade.push(item)
      } else {
        atrasada.push(item)
      }

      // Acumula por responsável
      if (!porResponsavel[responsavel]) {
        porResponsavel[responsavel] = { sem: 0, atrasada: 0, total: 0 }
      }
      porResponsavel[responsavel].total++
      if (classification === 'sem_atividade') {
        porResponsavel[responsavel].sem++
      } else {
        porResponsavel[responsavel].atrasada++
      }
    }

    // Top ranking por responsável (ordenado por total desc)
    const ranking = Object.entries(porResponsavel)
      .map(([name, counts]) => ({ name, ...counts }))
      .sort((a, b) => b.total - a.total)

    // Ordena deals: mais antigos primeiro (last_activity_date ASC, ou sem data no topo)
    const sortByOldest = (a: DealAtencao, b: DealAtencao) => {
      const aDate = a.lastActivityDate || '2000-01-01'
      const bDate = b.lastActivityDate || '2000-01-01'
      return aDate.localeCompare(bDate)
    }
    semAtividade.sort(sortByOldest)
    atrasada.sort(sortByOldest)

    return NextResponse.json({
      totalOpen: filteredDeals.length,
      totalSemAtividade: semAtividade.length,
      totalAtrasada: atrasada.length,
      totalComProblema: semAtividade.length + atrasada.length,
      pctComProblema: filteredDeals.length > 0
        ? Math.round(((semAtividade.length + atrasada.length) / filteredDeals.length) * 100)
        : 0,
      ranking,
      semAtividade,
      atrasada,
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Erro na rota /api/squad/atencao:', error)
    return NextResponse.json(
      { error: 'Erro interno ao buscar deals sem atenção' },
      { status: 500 }
    )
  }
}
