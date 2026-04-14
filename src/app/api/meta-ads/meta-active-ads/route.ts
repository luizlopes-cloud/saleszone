import { NextResponse } from "next/server"

const META_API = "https://graph.facebook.com/v21.0"

export const maxDuration = 60

const ACCOUNTS: Record<string, string> = {
  Investimentos: "act_205286032338340",
  SZS: "act_721191188358261",
  Marketplace: "act_799783985155825",
}

interface MetaAd {
  ad_id: string
  ad_name: string
  campaign_name: string
  adset_name: string
  vertical: string
  thumbnail?: string
  created_time?: string
}

export async function GET() {
  const token = process.env.META_ADS_TOKEN || ""
  if (!token) return NextResponse.json({ error: "No token" }, { status: 400 })

  const ads: MetaAd[] = []

  await Promise.all(
    Object.entries(ACCOUNTS).map(async ([vertical, accountId]) => {
      try {
        let url =
          `${META_API}/${accountId}/ads` +
          `?fields=id,name,effective_status,campaign{name},adset{name},created_time,creative{thumbnail_url,image_url,object_story_spec{link_data{picture}}}` +
          `&filtering=${encodeURIComponent(JSON.stringify([{ field: "effective_status", operator: "IN", value: ["ACTIVE"] }]))}` +
          `&limit=500&access_token=${token}`

        while (url) {
          const res = await fetch(url, { signal: AbortSignal.timeout(30000) })
          if (!res.ok) break
          const data = await res.json()
          for (const ad of data.data || []) {
            // Meta API bug: filtro effective_status=ACTIVE retorna CAMPAIGN_PAUSED também
            if (ad.effective_status !== "ACTIVE") continue
            const thumb = ad.creative?.thumbnail_url || ad.creative?.image_url || ad.creative?.object_story_spec?.link_data?.picture
            ads.push({
              ad_id: ad.id,
              ad_name: ad.name || "",
              campaign_name: ad.campaign?.name || "",
              adset_name: ad.adset?.name || "",
              vertical,
              thumbnail: thumb || undefined,
              created_time: ad.created_time || undefined,
            })
          }
          url = data.paging?.next || ""
        }
      } catch {
        /* skip failed account */
      }
    })
  )

  return NextResponse.json({ ads }, { headers: { "Cache-Control": "no-store" } })
}
