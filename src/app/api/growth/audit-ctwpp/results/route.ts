import { NextResponse } from "next/server"
import { readAuditCTWPP, dateKeyBRT } from "@/lib/audit-ctwpp"

export const dynamic = "force-dynamic"

export async function GET(req: Request & { nextUrl: URL }) {
  const date = req.nextUrl.searchParams.get("date") || dateKeyBRT(new Date(Date.now() - 86_400_000))

  if (date === "all") {
    const days = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(Date.now() - (i + 1) * 86_400_000)
      return dateKeyBRT(d)
    })
    const results = await Promise.all(days.map(d => readAuditCTWPP(d)))
    const valid = results.filter(Boolean) as Awaited<ReturnType<typeof readAuditCTWPP>>[]
    if (!valid.length) return NextResponse.json({ error: "not_found" }, { status: 404 })
    const leads = valid.flatMap(d => d!.leads)
    return NextResponse.json({
      date: "all",
      ran_at: valid[0]!.ran_at,
      total_leads: leads.length,
      leads,
    })
  }

  const data = await readAuditCTWPP(date)
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 })

  return NextResponse.json(data)
}
