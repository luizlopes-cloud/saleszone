import { createSquadSupabaseAdmin } from '@/lib/squad/supabase'
import { getPipeline, Squad } from '@/lib/squad/config'

export async function getSquadsFromDB(pipelineSlug: string): Promise<Squad[]> {
  try {
    const supabase = createSquadSupabaseAdmin()
    const { data, error } = await supabase
      .from('dashboard_config')
      .select('config_data')
      .eq('pipeline_slug', pipelineSlug)
      .eq('config_type', 'squads')
      .single()

    if (!error && data?.config_data && Array.isArray(data.config_data)) {
      return data.config_data as Squad[]
    }
  } catch {
    // Fallback silencioso
  }
  return getPipeline(pipelineSlug).squads
}
