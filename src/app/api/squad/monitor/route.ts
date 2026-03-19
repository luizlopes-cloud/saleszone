import { NextRequest, NextResponse } from 'next/server'
import { createSquadSupabaseAdmin } from '@/lib/squad/supabase'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const date = searchParams.get('date') || new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const pipeline = searchParams.get('pipeline') || null

  const supabase = createSquadSupabaseAdmin()

  try {
    let metricsQuery = supabase
      .from('monitor_daily_metrics')
      .select('*')
      .eq('date', date)
      .order('seller_name')

    if (pipeline) {
      metricsQuery = metricsQuery.eq('pipeline_slug', pipeline)
    }

    const { data: metrics, error: metricsError } = await metricsQuery

    if (metricsError) {
      console.error('Monitor metrics error:', metricsError)
      return NextResponse.json({ error: metricsError.message }, { status: 500 })
    }

    const sellerEmails = (metrics || []).map(m => m.seller_email)
    let alertsQuery = supabase
      .from('monitor_alerts')
      .select('*')
      .eq('date', date)
      .eq('resolved', false)
      .order('severity')

    if (sellerEmails.length > 0) {
      alertsQuery = alertsQuery.in('seller_email', sellerEmails)
    }

    const { data: alerts, error: alertsError } = await alertsQuery

    if (alertsError) {
      console.error('Monitor alerts error:', alertsError)
    }

    const { data: baselines } = await supabase
      .from('monitor_team_baselines')
      .select('*')
      .eq('date', date)
      .is('pipeline_slug', null)
      .single()

    const totalSellers = metrics?.length || 0
    const totalAlerts = alerts?.length || 0
    const criticalAlerts = alerts?.filter(a => a.severity === 'critical').length || 0
    const warningAlerts = alerts?.filter(a => a.severity === 'warning').length || 0

    const unanswered2h = metrics?.reduce((sum, m) => sum + (m.wpp_chats_unanswered_2h || 0), 0) || 0
    const unanswered8h = metrics?.reduce((sum, m) => sum + (m.wpp_chats_unanswered_8h || 0), 0) || 0
    const unanswered24h = metrics?.reduce((sum, m) => sum + (m.wpp_chats_unanswered_24h || 0), 0) || 0

    return NextResponse.json({
      date,
      totalSellers,
      totalAlerts,
      criticalAlerts,
      warningAlerts,
      unanswered: { h2: unanswered2h, h8: unanswered8h, h24: unanswered24h },
      baselines: baselines || null,
      metrics: metrics || [],
      alerts: alerts || [],
      updatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('Monitor route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
