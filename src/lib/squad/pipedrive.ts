import { squadEnv } from '@/lib/squad/env'

// Tipos do Pipedrive
export interface PipedrivePerson {
  id: number
  name: string
  email: { value: string; primary: boolean }[]
  phone: { value: string; primary: boolean }[]
}

export interface PipedriveDeal {
  id: number
  title: string
  status: string
  stage_id: number
  pipeline_id: number
  person_id: number | null
  person_name: string | null
  org_id: number | null
  org_name: string | null
  owner_id: number
  owner_name: string
  value: number
  currency: string
  add_time: string
  update_time: string
  stage_change_time: string
  won_time: string | null
  lost_time: string | null
  expected_close_date: string | null
  next_activity_date: string | null
  next_activity_time: string | null
  last_activity_date: string | null
  activities_count: number
  [key: string]: unknown
}

interface PipedriveResponse<T> {
  success: boolean
  data: T | null
  additional_data?: {
    pagination?: {
      start: number
      limit: number
      more_items_in_collection: boolean
      next_start: number
    }
  }
}

const BASE_URL = `https://${squadEnv.PIPEDRIVE_COMPANY_DOMAIN}.pipedrive.com/api/v1`

export async function pipedriveGet<T>(
  endpoint: string,
  params?: Record<string, string | number>
): Promise<PipedriveResponse<T>> {
  const url = new URL(`${BASE_URL}/${endpoint}`)
  url.searchParams.set('api_token', squadEnv.PIPEDRIVE_API_TOKEN)

  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      url.searchParams.set(key, String(value))
    })
  }

  const res = await fetch(url.toString(), { cache: 'no-store' })

  if (!res.ok) {
    throw new Error(`Pipedrive API error: ${res.status} ${res.statusText}`)
  }

  return res.json()
}

export async function getAllDeals(
  filters?: Record<string, string | number>
): Promise<PipedriveDeal[]> {
  const allDeals: PipedriveDeal[] = []
  let start = 0
  const limit = 500
  let hasMore = true

  while (hasMore) {
    const response = await pipedriveGet<PipedriveDeal[]>('deals', {
      start, limit, ...filters,
    })
    if (response.data) allDeals.push(...response.data)
    hasMore = response.additional_data?.pagination?.more_items_in_collection ?? false
    start = response.additional_data?.pagination?.next_start ?? start + limit
  }

  return allDeals
}

export async function getDealsInPipeline(
  pipelineId: number,
  stageId?: number
): Promise<PipedriveDeal[]> {
  const allDeals: PipedriveDeal[] = []
  let start = 0
  const limit = 500
  let hasMore = true

  const endpoint = stageId
    ? `stages/${stageId}/deals`
    : `pipelines/${pipelineId}/deals`

  while (hasMore) {
    const response = await pipedriveGet<PipedriveDeal[]>(endpoint, { start, limit })
    if (response.data) allDeals.push(...response.data)
    hasMore = response.additional_data?.pagination?.more_items_in_collection ?? false
    start = response.additional_data?.pagination?.next_start ?? start + limit
  }

  return allDeals
}

export async function getDeal(dealId: number): Promise<PipedriveDeal | null> {
  const response = await pipedriveGet<PipedriveDeal>(`deals/${dealId}`)
  return response.data
}

export async function getDealActivities(dealId: number) {
  const response = await pipedriveGet<unknown[]>(`deals/${dealId}/activities`)
  return response.data ?? []
}

/**
 * Match robusto de owner_name contra nome configurado.
 * Usa todos os tokens do nome (>2 chars) para evitar falhas
 * como "Maria Carolina Rosário" → Pipedrive mostra "Carol Rosário".
 */
export function matchOwnerName(ownerName: string, configName: string): boolean {
  if (!ownerName || !configName) return false
  const ownerLower = ownerName.toLowerCase()
  const tokens = configName.toLowerCase().split(' ').filter(t => t.length > 2)
  return tokens.some(token => ownerLower.includes(token))
}
