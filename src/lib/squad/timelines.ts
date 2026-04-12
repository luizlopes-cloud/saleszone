const TIMELINES_API_URL = 'https://api.timelines.ai'

export interface TimelinesChat {
  id: number
  phone: string
  name: string
  last_message_at: string
}

export interface TimelinesMessage {
  id: number
  chat_id: number
  content: string
  from_me: boolean
  created_at: string
  type: string
}

async function timelinesGet<T>(path: string): Promise<T | null> {
  const apiKey = process.env.TIMELINES_API_KEY
  if (!apiKey) return null
  try {
    const res = await fetch(`${TIMELINES_API_URL}${path}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    })
    if (!res.ok) return null
    return await res.json() as T
  } catch {
    return null
  }
}

export async function getChatByPhone(phone: string): Promise<TimelinesChat | null> {
  const data = await timelinesGet<{ data: TimelinesChat[] }>(`/chats?phone=${encodeURIComponent(phone)}&page=1&per_page=1`)
  return data?.data?.[0] ?? null
}

export async function getChatMessages(chatId: number, limit = 50): Promise<TimelinesMessage[]> {
  const data = await timelinesGet<{ data: TimelinesMessage[] }>(`/chats/${chatId}/messages?per_page=${limit}`)
  return data?.data ?? []
}

export async function getWhatsAppResponseTime(phone: string, afterDate: string): Promise<{
  firstOutboundDate: string | null
  responseMinutes: number | null
} | null> {
  if (!process.env.TIMELINES_API_KEY) return null

  const chat = await getChatByPhone(phone)
  if (!chat) return null

  const messages = await getChatMessages(chat.id, 100)
  const afterMs = new Date(afterDate).getTime()

  const outbound = messages
    .filter(m => m.from_me && new Date(m.created_at).getTime() > afterMs)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())

  if (outbound.length === 0) return { firstOutboundDate: null, responseMinutes: null }

  const firstMsg = outbound[0]
  const deltaMs = new Date(firstMsg.created_at).getTime() - afterMs
  const deltaMin = Math.round(deltaMs / 60000)

  return {
    firstOutboundDate: firstMsg.created_at,
    responseMinutes: deltaMin,
  }
}

export function isTimelinesConfigured(): boolean {
  return !!process.env.TIMELINES_API_KEY
}
