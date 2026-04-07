import { NextRequest, NextResponse } from "next/server"

const META_API = "https://graph.facebook.com/v21.0"

export async function POST(req: NextRequest) {
  try {
    const { adIds, token: clientToken } = await req.json() as { adIds: string[]; token?: string }
    const token = clientToken || process.env.META_ADS_TOKEN || ""

    if (!token) return NextResponse.json({ error: "Token Meta não configurado" }, { status: 400 })
    if (!adIds || adIds.length === 0) return NextResponse.json({ error: "Nenhum ad_id fornecido" }, { status: 400 })

    const results: { ad_id: string; success: boolean; error?: string }[] = []

    for (const adId of adIds) {
      try {
        const res = await fetch(`${META_API}/${adId}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({ status: "PAUSED", access_token: token }),
          signal: AbortSignal.timeout(10000),
        })

        if (res.ok) {
          results.push({ ad_id: adId, success: true })
        } else {
          const data = await res.json()
          results.push({ ad_id: adId, success: false, error: data.error?.message || `HTTP ${res.status}` })
        }
      } catch (err) {
        results.push({ ad_id: adId, success: false, error: String(err) })
      }
    }

    const successCount = results.filter(r => r.success).length
    return NextResponse.json({ results, successCount, totalCount: adIds.length })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
