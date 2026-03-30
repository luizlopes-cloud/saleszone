import { NextRequest, NextResponse } from "next/server"

const META_API = "https://graph.facebook.com/v21.0"
const BATCH_SIZE = 50
const CONCURRENCY = 10

export const maxDuration = 60

async function fetchBatch(ids: string[], token: string, retries = 2): Promise<{ statuses: Record<string, string>; thumbnails: Record<string, string> }> {
  const statuses: Record<string, string> = {}
  const thumbnails: Record<string, string> = {}
  const idsStr = ids.join(",")

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(
        `${META_API}/?ids=${idsStr}&fields=effective_status,creative{thumbnail_url,image_url}&access_token=${token}`,
        { signal: AbortSignal.timeout(15000) }
      )
      if (!res.ok) {
        if (attempt < retries) continue
        return { statuses, thumbnails }
      }
      const data = await res.json()
      for (const [id, info] of Object.entries(data)) {
        const adInfo = info as { effective_status?: string; creative?: { thumbnail_url?: string; image_url?: string } }
        if (adInfo.effective_status) {
          statuses[id] = adInfo.effective_status === "ACTIVE" ? "ACTIVE" : "PAUSED"
        }
        const thumb = adInfo.creative?.thumbnail_url || adInfo.creative?.image_url
        if (thumb) thumbnails[id] = thumb
      }
      return { statuses, thumbnails }
    } catch {
      if (attempt >= retries) return { statuses, thumbnails }
    }
  }
  return { statuses, thumbnails }
}

export async function POST(req: NextRequest) {
  try {
    const { adIds } = await req.json() as { adIds: string[] }
    const token = req.headers.get("x-meta-token") || process.env.META_ADS_TOKEN || ""

    if (!token) return NextResponse.json({ error: "No Meta token" }, { status: 400 })
    if (!adIds || adIds.length === 0) return NextResponse.json({ statuses: {}, thumbnails: {} })

    const batches: string[][] = []
    for (let i = 0; i < adIds.length; i += BATCH_SIZE) {
      batches.push(adIds.slice(i, i + BATCH_SIZE))
    }

    const statuses: Record<string, string> = {}
    const thumbnails: Record<string, string> = {}
    for (let i = 0; i < batches.length; i += CONCURRENCY) {
      const chunk = batches.slice(i, i + CONCURRENCY)
      const results = await Promise.all(chunk.map(batch => fetchBatch(batch, token)))
      for (const result of results) {
        Object.assign(statuses, result.statuses)
        Object.assign(thumbnails, result.thumbnails)
      }
    }

    return NextResponse.json({ statuses, thumbnails })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
