import { NextRequest, NextResponse } from "next/server"
import { queryNekt, buildFilteredSQL } from "@/lib/nekt"

export const maxDuration = 60

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams
    const rawWindow = params.get("window")
    const windowDays = rawWindow ? Math.min(Math.max(parseInt(rawWindow) || 90, 1), 365) : undefined
    const filters = {
      campaign_name: params.get("campaign_name") || undefined,
      vertical: params.get("vertical") || undefined,
      status: params.get("status") || undefined,
      date_from: params.get("date_from") || undefined,
      date_to: params.get("date_to") || undefined,
      window: windowDays,
    }

    const sql = buildFilteredSQL(filters)
    const result = await queryNekt(sql)

    return NextResponse.json(result, {
      headers: { "Cache-Control": "no-store" },
    })
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
