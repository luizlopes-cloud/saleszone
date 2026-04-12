import { NextResponse } from "next/server"
import { readAuditCTWPP, dateKeyBRT } from "@/lib/audit-ctwpp"

export const dynamic = "force-dynamic"

export async function GET(req: Request & { nextUrl: URL }) {
  const date = req.nextUrl.searchParams.get("date") || dateKeyBRT(new Date(Date.now() - 86_400_000))

  const data = await readAuditCTWPP(date)
  if (!data) return NextResponse.json({ error: "not_found" }, { status: 404 })

  return NextResponse.json(data)
}
