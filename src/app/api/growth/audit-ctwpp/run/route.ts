import { NextResponse } from "next/server"
import { runAuditCTWPP, dateKeyBRT } from "@/lib/audit-ctwpp-runner"

export const maxDuration = 300
export const dynamic = "force-dynamic"

// GET — cron diário (07h BRT)
export async function GET(req: Request) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const yesterday = dateKeyBRT(new Date(Date.now() - 86_400_000))

  try {
    const result = await runAuditCTWPP({ mode: "daily", date: yesterday })
    return NextResponse.json({ ok: true, result })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}

// POST — disparo manual: { date } ou { mode: "all_open" }
export async function POST(req: Request) {
  const auth = req.headers.get("authorization")
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))

  try {
    const options = body.mode === "all_open"
      ? ({ mode: "all_open" } as const)
      : ({ mode: "daily", date: body.date || dateKeyBRT(new Date(Date.now() - 86_400_000)) } as const)

    const result = await runAuditCTWPP(options)
    return NextResponse.json({ ok: true, result })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
