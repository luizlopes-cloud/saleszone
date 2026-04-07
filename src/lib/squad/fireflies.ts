const FIREFLIES_API_URL = 'https://api.fireflies.ai/graphql'

export interface FirefliesTranscript {
  id: string
  title: string
  date: number // epoch ms
  dateString: string
  duration: number // minutos
  participants: string[]
  speakers: { id: number; name: string }[]
  meeting_attendance: { join_time: string; leave_time: string; name: string }[]
  meeting_attendees: { email: string; name: string | null }[]
  organizer_email: string
  transcript_url: string
  meeting_info: { fred_joined: boolean; silent_meeting: boolean; summary_status: string }
}

interface FirefliesResponse {
  data: {
    transcripts: FirefliesTranscript[]
  }
}

export async function getFirefliesTranscripts(
  fromDate: string,
  toDate: string,
  participantEmails?: string[]
): Promise<FirefliesTranscript[]> {
  const apiKey = process.env.FIREFLIES_API_KEY
  if (!apiKey) return []

  const query = `
    query GetTranscripts($fromDate: DateTime, $toDate: DateTime, $limit: Int, $skip: Int) {
      transcripts(fromDate: $fromDate, toDate: $toDate, limit: $limit, skip: $skip) {
        id title date dateString duration
        participants
        speakers { id name }
        meeting_attendance { join_time leave_time name }
        meeting_attendees { email name }
        organizer_email
        transcript_url
        meeting_info { fred_joined silent_meeting summary_status }
      }
    }
  `

  const allTranscripts: FirefliesTranscript[] = []
  let skip = 0
  const limit = 50
  let hasMore = true

  while (hasMore) {
    try {
      const res = await fetch(FIREFLIES_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query,
          variables: { fromDate, toDate, limit, skip },
        }),
      })

      if (!res.ok) break

      const json = await res.json() as FirefliesResponse
      const transcripts = json.data?.transcripts || []
      if (transcripts.length === 0) break

      allTranscripts.push(...transcripts)
      skip += limit
      hasMore = transcripts.length === limit && skip < 500
    } catch {
      break
    }
  }

  if (participantEmails && participantEmails.length > 0) {
    const emailSet = new Set(participantEmails.map(e => e.toLowerCase()))
    return allTranscripts.filter(t =>
      t.participants.some(p => emailSet.has(p.toLowerCase()))
    )
  }

  return allTranscripts
}
