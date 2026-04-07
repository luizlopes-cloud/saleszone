import { NextRequest, NextResponse } from "next/server"

const META_API = "https://graph.facebook.com/v21.0"

export async function GET(req: NextRequest) {
  const adId = req.nextUrl.searchParams.get("id")
  if (!adId) return NextResponse.json({ error: "id é obrigatório" }, { status: 400 })
  if (!/^\d+$/.test(adId)) return NextResponse.json({ error: "id inválido" }, { status: 400 })

  const token = process.env.META_ADS_TOKEN || ""
  if (!token) return NextResponse.json({ error: "META_ADS_TOKEN não configurado" }, { status: 500 })

  try {
    const res = await fetch(
      `${META_API}/${adId}/previews?ad_format=DESKTOP_FEED_STANDARD&access_token=${token}`,
      { signal: AbortSignal.timeout(10000) }
    )
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      return NextResponse.json({ error: err?.error?.message || `Meta API ${res.status}` }, { status: 502 })
    }
    const data = await res.json()
    const body = data?.data?.[0]?.body || null
    return NextResponse.json({ html: body })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
