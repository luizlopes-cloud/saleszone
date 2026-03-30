import { NextRequest, NextResponse } from 'next/server'
import { pipedriveGet, PipedriveDeal } from '@/lib/squad/pipedrive'
import { getFirefliesTranscripts } from '@/lib/squad/fireflies'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const dealId = parseInt(id)
  if (isNaN(dealId)) {
    return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  }

  try {
    // 1. Busca deal no Pipedrive
    const dealResponse = await pipedriveGet<PipedriveDeal>(`deals/${dealId}`)
    const deal = dealResponse.data
    if (!deal) {
      return NextResponse.json({ error: 'Deal não encontrado' }, { status: 404 })
    }

    // 2. Busca pessoa associada ao deal
    let personPhone: string | null = null
    let personEmail: string | null = null
    let personName: string | null = null
    if (deal.person_id) {
      try {
        const personId = typeof deal.person_id === 'object'
          ? (deal.person_id as { value: number }).value
          : deal.person_id
        const personRes = await pipedriveGet<{
          name: string
          phone: { value: string }[]
          email: { value: string }[]
        }>(`persons/${personId}`)
        const person = personRes.data
        if (person) {
          personName = person.name || null
          personPhone = person.phone?.[0]?.value || null
          personEmail = person.email?.[0]?.value || null
        }
      } catch { /* ignore */ }
    }

    // 3. Busca transcrições Fireflies relacionadas (±30 dias do deal)
    let firefliesData: {
      id: string
      title: string
      date: string
      duration: number
      transcriptUrl: string
      speakers: string[]
      summaryStatus: string
    } | null = null

    const dealDate = deal.won_time || deal.add_time || ''
    if (dealDate) {
      try {
        const baseDate = new Date(dealDate)
        const fromDate = new Date(baseDate)
        fromDate.setDate(fromDate.getDate() - 30)
        const toDate = new Date(baseDate)
        toDate.setDate(toDate.getDate() + 7)

        const transcripts = await getFirefliesTranscripts(
          fromDate.toISOString(),
          toDate.toISOString()
        )

        const pName = personName?.toLowerCase() || ''

        const matched = transcripts.filter(t => {
          const title = t.title.toLowerCase()
          if (pName && pName.length > 3 && title.includes(pName)) return true
          if (personEmail && t.participants.includes(personEmail)) return true
          return false
        })

        if (matched.length > 0) {
          const best = matched[0]
          firefliesData = {
            id: best.id,
            title: best.title,
            date: best.dateString,
            duration: Math.round(best.duration),
            transcriptUrl: best.transcript_url,
            speakers: best.speakers.map(s => s.name),
            summaryStatus: best.meeting_info?.summary_status || 'unknown',
          }
        }
      } catch { /* ignore */ }
    }

    // 4. Link WhatsApp (Timelines.ai) — só gera o link, sem chamar API
    let whatsappLink: string | null = null
    if (personPhone) {
      const cleanPhone = personPhone.replace(/\D/g, '')
      if (cleanPhone.length >= 10) {
        whatsappLink = `https://app.timelines.ai/chats/wa${cleanPhone}`
      }
    }

    // 5. Monta timeline
    const timeline = {
      deal: {
        id: deal.id,
        title: deal.title,
        url: `https://seazone-fd92b9.pipedrive.com/deal/${deal.id}`,
        status: deal.status,
        owner: deal.owner_name,
        addTime: deal.add_time,
        wonTime: deal.won_time,
        value: deal.value,
        currency: deal.currency,
      },
      person: {
        name: personName,
        phone: personPhone,
        email: personEmail,
      },
      fireflies: firefliesData,
      whatsapp: whatsappLink ? { link: whatsappLink, phone: personPhone } : null,
      updatedAt: new Date().toISOString(),
    }

    return NextResponse.json(timeline)
  } catch (error) {
    console.error('Erro na rota /api/squad/deal-timeline:', error)
    return NextResponse.json({ error: 'Erro ao buscar timeline do deal' }, { status: 500 })
  }
}
