import { NextRequest, NextResponse } from 'next/server'
import { createSquadSupabaseAdmin } from '@/lib/squad/supabase'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const pipelineSlug = searchParams.get('pipeline') || 'szi'

    const supabase = createSquadSupabaseAdmin()
    const { data, error } = await supabase
      .from('dashboard_config')
      .select('config_type, config_data, updated_at, updated_by')
      .eq('pipeline_slug', pipelineSlug)

    if (error) {
      console.error('Erro ao ler config:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const config: Record<string, unknown> = {
      pipeline: pipelineSlug,
    }
    for (const row of data || []) {
      config[row.config_type] = row.config_data
      config[`${row.config_type}_updated_at`] = row.updated_at
      config[`${row.config_type}_updated_by`] = row.updated_by
    }

    return NextResponse.json(config)
  } catch (error) {
    console.error('Erro na rota /api/squad/config GET:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json()
    const { pipeline: pipelineSlug, config_type, config_data } = body

    if (!pipelineSlug || !config_type || config_data === undefined) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: pipeline, config_type, config_data' },
        { status: 400 }
      )
    }

    const validTypes = ['squads', 'canais_visiveis']
    if (!validTypes.includes(config_type)) {
      return NextResponse.json(
        { error: `config_type inválido. Use: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    const supabase = createSquadSupabaseAdmin()

    const { error } = await supabase
      .from('dashboard_config')
      .upsert(
        {
          pipeline_slug: pipelineSlug,
          config_type,
          config_data,
          updated_at: new Date().toISOString(),
          updated_by: 'dashboard-ui',
        },
        { onConflict: 'pipeline_slug,config_type' }
      )

    if (error) {
      console.error('Erro ao salvar config:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Erro na rota /api/squad/config PUT:', error)
    return NextResponse.json({ error: 'Erro interno' }, { status: 500 })
  }
}
