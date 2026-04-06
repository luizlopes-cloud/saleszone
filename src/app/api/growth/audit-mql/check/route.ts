// Verificação de leads pendentes — roda via GitHub Actions a cada 15min (fallback)
// Processa hoje E ontem (leads que chegam tarde da noite)

import { NextRequest, NextResponse } from "next/server"
import { dateKey } from "@/lib/audit-mql"
import { runCheck } from "@/lib/audit-mql-check"

export const maxDuration = 60
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = dateKey()
  const yesterday = (() => {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  })()

  const [r1, r2] = await Promise.all([runCheck(yesterday), runCheck(today)])

  return NextResponse.json({
    [yesterday]: r1,
    [today]:     r2,
    ts: new Date().toISOString(),
  })
}
