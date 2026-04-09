// Verificação de leads pendentes — roda via GitHub Actions a cada 15min (fallback)

import { NextRequest, NextResponse } from "next/server"
import { dateKey, readLeads, writeLeads } from "@/lib/audit-mql"
import { runCheck, recheckSla } from "@/lib/audit-mql-check"

export const maxDuration = 120
export const dynamic = "force-dynamic"

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const today = dateKey()

  const body = await req.json().catch(() => ({}))

  // POST com { dedup: true } — remove duplicatas por leadgen_id do blob
  if (body.dedup) {
    const dates: string[] = body.dates || [today]
    const results: Record<string, { before: number; after: number; removed: number }> = {}
    for (const d of dates) {
      const leads = await readLeads(d)
      const seen = new Set<string>()
      const deduped = leads.filter(l => {
        if (seen.has(l.leadgen_id)) return false
        seen.add(l.leadgen_id)
        return true
      })
      const removed = leads.length - deduped.length
      if (removed > 0) await writeLeads(d, deduped)
      results[d] = { before: leads.length, after: deduped.length, removed }
    }
    return NextResponse.json({ dedup: results, ts: new Date().toISOString() })
  }

  // POST com { trim_before: "ISO timestamp", date: "YYYY-MM-DD" } — remove leads anteriores ao timestamp
  if (body.trim_before) {
    const cutoff = new Date(body.trim_before)
    const date: string = body.date || today
    const leads = await readLeads(date)
    const kept = leads.filter(l => new Date(l.created_at) >= cutoff)
    await writeLeads(date, kept)
    return NextResponse.json({ trim_before: body.trim_before, date, before: leads.length, after: kept.length, removed: leads.length - kept.length })
  }

  // POST com { recheck_sla: true } re-avalia SLA de todos os leads retroativamente
  // Adicionar { dry: true } para preview sem gravar
  if (body.recheck_sla) {
    const dates: string[] = body.dates || [today]
    const dry = body.dry === true
    const results: Record<string, { total: number; fixed: number; changes: unknown[] }> = {}
    for (const d of dates) {
      results[d] = await recheckSla(d, dry)
    }
    return NextResponse.json({ recheck_sla: results, dry, ts: new Date().toISOString() })
  }

  const r = await runCheck(today)

  // recheckSla garante que leads já classificados são reavaliados quando o SLA muda
  const s = await recheckSla(today)

  return NextResponse.json({
    [today]: { ...r, sla_recheck: s },
    ts: new Date().toISOString(),
  })
}
