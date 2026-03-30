import { NextRequest, NextResponse } from 'next/server'
import { getSquadsFromDB } from '@/lib/squad/config-db'
import { getFirefliesTranscripts, FirefliesTranscript } from '@/lib/squad/fireflies'

// Tenta fazer match do nome do closer com um email @seazone.com.br
// Usa todos os tokens do nome (>2 chars) para cobrir casos como
// "Maria Carolina Rosário" → email "carol.rosario@..."
function matchCloserEmail(closerName: string, seazoneEmails: string[]): string | null {
  const tokens = closerName.toLowerCase().split(' ').filter(t => t.length > 2)
  const match = seazoneEmails.find(email => {
    const localPart = email.split('@')[0].toLowerCase()
    return tokens.some(token => localPart.includes(token))
  })
  return match || null
}

// Verifica se o closer participou da reunião de fato (no meeting_attendance)
// ou se foi um no-show (estava nos attendees mas não no attendance, ou duração < 3min)
function isNoShow(transcript: FirefliesTranscript, email: string): boolean {
  // Duração muito curta = no-show
  if (transcript.duration < 3) return true

  // Se não tem dados de attendance, não podemos determinar
  if (!transcript.meeting_attendance || transcript.meeting_attendance.length === 0) return false

  const firstName = email.split('@')[0].split('.')[0].toLowerCase()
  const wasPresent = transcript.meeting_attendance.some(att =>
    att.name?.toLowerCase().includes(firstName)
  )

  // Estava nos attendees mas não no attendance = no-show
  return !wasPresent
}

export async function GET(request: NextRequest) {
  const apiKey = process.env.FIREFLIES_API_KEY
  if (!apiKey) {
    return NextResponse.json({ available: false, message: 'Fireflies não configurado' })
  }

  try {
    const { searchParams } = new URL(request.url)
    const pipelineSlug = searchParams.get('pipeline') || 'szi'
    const dateFrom = searchParams.get('dateFrom')
    const dateTo = searchParams.get('dateTo')

    if (!dateFrom || !dateTo) {
      return NextResponse.json({ available: false, message: 'dateFrom e dateTo são obrigatórios' })
    }

    const squads = await getSquadsFromDB(pipelineSlug)

    // Extrai nomes dos closers de todas as squads
    const closerNames = squads.flatMap(sq => sq.venda)

    if (closerNames.length === 0) {
      return NextResponse.json({
        available: true,
        closers: [],
        totais: { reunioes: 0, duracaoMedia: '0min', noShows: 0, noShowPct: 0 },
        updatedAt: new Date().toISOString(),
      })
    }

    // Busca todas as transcrições do período
    const allTranscripts = await getFirefliesTranscripts(dateFrom, dateTo)

    // Coleta todos os emails @seazone.com.br que aparecem nas transcrições
    const seazoneEmailSet = new Set<string>()
    for (const t of allTranscripts) {
      for (const p of t.participants) {
        if (p.toLowerCase().includes('@seazone.com.br') && !p.toLowerCase().includes('agendamentos@')) {
          seazoneEmailSet.add(p.toLowerCase())
        }
      }
      for (const att of t.meeting_attendees || []) {
        if (att.email?.toLowerCase().includes('@seazone.com.br') && !att.email.toLowerCase().includes('agendamentos@')) {
          seazoneEmailSet.add(att.email.toLowerCase())
        }
      }
    }
    const seazoneEmails = Array.from(seazoneEmailSet)

    // Mapeia closer name → email
    const closerEmailMap = new Map<string, string>()
    for (const name of closerNames) {
      const email = matchCloserEmail(name, seazoneEmails)
      if (email) {
        closerEmailMap.set(name, email)
      } else {
        // Fallback: gerar email padrão nome.sobrenome@seazone.com.br
        const parts = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(' ')
        if (parts.length >= 2) {
          const generatedEmail = `${parts[0]}.${parts[parts.length - 1]}@seazone.com.br`
          closerEmailMap.set(name, generatedEmail)
        }
      }
    }

    // Calcula métricas por closer
    interface CloserFirefliesStats {
      name: string
      email: string
      reunioes: number
      duracaoMedia: string
      duracaoMediaMin: number
      noShows: number
      noShowPct: number
      totalAgendadas: number
    }

    const closerStats: CloserFirefliesStats[] = []
    let totalReunioes = 0
    let totalDuracaoMin = 0
    let totalNoShows = 0
    let totalAgendadas = 0

    for (const name of closerNames) {
      const email = closerEmailMap.get(name) || ''
      if (!email) {
        closerStats.push({
          name, email: '',
          reunioes: 0, duracaoMedia: '-', duracaoMediaMin: 0,
          noShows: 0, noShowPct: 0, totalAgendadas: 0,
        })
        continue
      }

      const firstName = email.split('@')[0].split('.')[0].toLowerCase()

      // Filtra transcrições onde o closer participou
      const closerTranscripts = allTranscripts.filter(t => {
        const inParticipants = t.participants.some(p => p.toLowerCase() === email)
        const inAttendees = (t.meeting_attendees || []).some(a => a.email?.toLowerCase() === email)
        // Fallback por primeiro nome nos participants (email pode diferir levemente)
        const byFirstName = t.participants.some(p => p.toLowerCase().includes(firstName + '@'))
        return inParticipants || inAttendees || byFirstName
      })

      const reunioes = closerTranscripts.length
      const duracaoTotal = closerTranscripts.reduce((sum, t) => sum + (t.duration || 0), 0)
      const duracaoMediaMin = reunioes > 0 ? Math.round(duracaoTotal / reunioes) : 0

      const noShowCount = closerTranscripts.filter(t => isNoShow(t, email)).length
      const noShowPct = reunioes > 0 ? Math.round((noShowCount / reunioes) * 100) : 0

      closerStats.push({
        name,
        email,
        reunioes,
        duracaoMedia: duracaoMediaMin > 0 ? `${duracaoMediaMin}min` : '-',
        duracaoMediaMin,
        noShows: noShowCount,
        noShowPct,
        totalAgendadas: reunioes,
      })

      totalReunioes += reunioes
      totalDuracaoMin += duracaoTotal
      totalNoShows += noShowCount
      totalAgendadas += reunioes
    }

    const mediaGeralMin = totalReunioes > 0 ? Math.round(totalDuracaoMin / totalReunioes) : 0
    const noShowPctGeral = totalAgendadas > 0 ? Math.round((totalNoShows / totalAgendadas) * 100) : 0

    return NextResponse.json({
      available: true,
      closers: closerStats,
      totais: {
        reunioes: totalReunioes,
        duracaoMedia: mediaGeralMin > 0 ? `${mediaGeralMin}min` : '-',
        noShows: totalNoShows,
        noShowPct: noShowPctGeral,
      },
      updatedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[/api/squad/fireflies] Erro na rota:', error)
    return NextResponse.json(
      { available: false, message: 'Erro ao buscar dados do Fireflies' },
      { status: 500 }
    )
  }
}
