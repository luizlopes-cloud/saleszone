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

  // POST com { trim_before: "ISO timestamp", date: "YYYY-MM-DD" } — marca leads anteriores ao timestamp como "descartado"
  // Leads permanecem no blob (impedindo recovery de re-adicioná-los) mas são filtrados do GET /leads
  if (body.trim_before) {
    const cutoff = new Date(body.trim_before)
    const date: string = body.date || today
    const leads = await readLeads(date)
    let discarded = 0
    for (const l of leads) {
      if (new Date(l.created_at) < cutoff && l.status !== "descartado") {
        l.status = "descartado"
        l.notified = true
        discarded++
      }
    }
    if (discarded > 0) await writeLeads(date, leads)
    return NextResponse.json({ trim_before: body.trim_before, date, total: leads.length, discarded, ts: new Date().toISOString() })
  }

  // POST com { reset_baserow: true, emails: ["a@b.com"] } — limpa in_baserow para recheck
  if (body.reset_baserow) {
    const date: string = body.date || today
    const emails: string[] = body.emails || []
    const leads = await readLeads(date)
    let reset = 0
    for (const l of leads) {
      if (emails.includes(l.email)) {
        delete (l as Record<string, unknown>).in_baserow
        reset++
      }
    }
    if (reset > 0) await writeLeads(date, leads)
    return NextResponse.json({ reset_baserow: { date, emails, reset }, ts: new Date().toISOString() })
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
