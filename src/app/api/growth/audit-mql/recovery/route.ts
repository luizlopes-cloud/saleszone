// Recuperação de leads perdidos — busca direto na Meta API e salva no Blob
// POST { date: "2026-04-05" } → compara com Blob e salva o que falta

import { NextRequest, NextResponse } from "next/server"
import { LeadRecord, dateKey, readLeads, appendLeadSafe, extractVertical } from "@/lib/audit-mql"
import crypto from "crypto"

export const maxDuration = 60
export const dynamic = "force-dynamic"

const META_TOKEN = process.env.META_ADS_TOKEN || ""

// Pages subscritas ao webhook leadgen
const PAGE_IDS = ["100873924683761", "842763402253490", "144663558738581"]

// ─── Meta API helpers ─────────────────────────────────────────────────────────

async function metaFetch(url: string) {
  const res = await fetch(url, { cache: "no-store" })
  if (!res.ok) return null
  return res.json()
}

async function getFormsForPage(pageId: string): Promise<{ id: string; name: string }[]> {
  const forms: { id: string; name: string }[] = []
  let url = `https://graph.facebook.com/v19.0/${pageId}/leadgen_forms` +
    `?fields=id,name,status&limit=100&access_token=${META_TOKEN}`

  while (url) {
    const data = await metaFetch(url)
    if (!data?.data) break
    forms.push(...data.data.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name })))
    url = data.paging?.next || ""
  }
  return forms
}

function parseLead(lead: Record<string, unknown>): Partial<LeadRecord> {
  const fields: Record<string, string> = {}
  for (const item of (lead.field_data as { name: string; values: string[] }[]) || []) {
    fields[item.name] = item.values?.[0] || ""
  }
  const firstName = fields["first_name"] || ""
  const lastName  = fields["last_name"]  || ""
  const fullName  = fields["full_name"]  || `${firstName} ${lastName}`.trim()

  return {
    name:    fullName,
    email:   fields["email"] || "",
    phone:   fields["phone_number"] || fields["phone"] || "",
    form_id: String(lead.form_id || ""),
    ad_id:   String(lead.ad_id   || ""),
    page_id: String(lead.page_id || ""),
  }
}

async function getLeadsForForm(
  formId: string,
  minTs: number,
  maxTs: number
): Promise<{ leadgen_id: string; created_time: string; parsed: Partial<LeadRecord> }[]> {
  const results: { leadgen_id: string; created_time: string; parsed: Partial<LeadRecord> }[] = []
  let url = `https://graph.facebook.com/v19.0/${formId}/leads` +
    `?fields=id,created_time,field_data,ad_id,form_id,page_id` +
    `&time_range%5Bmin%5D=${minTs}&time_range%5Bmax%5D=${maxTs}` +
    `&limit=100&access_token=${META_TOKEN}`

  while (url) {
    const data = await metaFetch(url)
    if (!data?.data) break
    for (const lead of data.data) {
      results.push({
        leadgen_id:   String(lead.id),
        created_time: String(lead.created_time || ""),
        parsed:       parseLead(lead as Record<string, unknown>),
      })
    }
    url = data.paging?.next || ""
  }
  return results
}

// ─── Route ────────────────────────────────────────────────────────────────────

async function recoverDate(targetDate: string) {
  // Converter data BRT → timestamps Unix (início e fim do dia em BRT = UTC-3)
  const minDate = new Date(`${targetDate}T03:00:00Z`)               // 00:00 BRT = 03:00 UTC
  const maxDate = new Date(minDate.getTime() + 24 * 60 * 60 * 1000 - 1) // 23:59:59 BRT
  const minUnix = Math.floor(minDate.getTime() / 1000)
  const maxUnix = Math.floor(maxDate.getTime() / 1000)

  const existing = await readLeads(targetDate)
  const existingIds = new Set(existing.map(l => l.leadgen_id))

  let recovered = 0
  let skipped   = 0
  let errors    = 0
  const recoveredLeads: string[] = []

  for (const pageId of PAGE_IDS) {
    let forms: { id: string; name: string }[] = []
    try { forms = await getFormsForPage(pageId) } catch { continue }

    for (const form of forms) {
      let metaLeads: Awaited<ReturnType<typeof getLeadsForForm>> = []
      try { metaLeads = await getLeadsForForm(form.id, minUnix, maxUnix) } catch { continue }

      for (const ml of metaLeads) {
        if (existingIds.has(ml.leadgen_id)) { skipped++; continue }

        let campaign = ""
        if (ml.parsed.ad_id) {
          try {
            const adData = await metaFetch(
              `https://graph.facebook.com/v19.0/${ml.parsed.ad_id}?fields=campaign{name}&access_token=${META_TOKEN}`
            )
            campaign = adData?.campaign?.name || ""
          } catch { /* sem campanha */ }
        }

        const record: LeadRecord = {
          id:            crypto.randomUUID(),
          leadgen_id:    ml.leadgen_id,
          form_id:       ml.parsed.form_id || form.id,
          ad_id:         ml.parsed.ad_id   || "",
          page_id:       ml.parsed.page_id || pageId,
          name:          ml.parsed.name    || "",
          email:         ml.parsed.email   || "",
          phone:         ml.parsed.phone   || "",
          campaign_name: campaign,
          vertical:      extractVertical(campaign),
          created_at:    ml.created_time || new Date().toISOString(),
          status:        "aguardando",
        }

        try {
          const saved = await appendLeadSafe(targetDate, record)
          if (saved) {
            recovered++
            existingIds.add(ml.leadgen_id)
            recoveredLeads.push(`${record.name || record.email} (${record.vertical})`)
          }
        } catch { errors++ }
      }
    }
  }

  return { date: targetDate, recovered, skipped, errors, recoveredLeads, existingBefore: existing.length }
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const body = await req.json().catch(() => ({}))

  if (body.date) {
    return NextResponse.json(await recoverDate(body.date))
  }

  // Sem date → verifica hoje e ontem
  const today = dateKey()
  const yesterday = (() => {
    const d = new Date(Date.now() - 3 * 60 * 60 * 1000)
    d.setDate(d.getDate() - 1)
    return d.toISOString().slice(0, 10)
  })()

  const [r1, r2] = await Promise.all([recoverDate(yesterday), recoverDate(today)])
  return NextResponse.json({ yesterday: r1, today: r2 })
}
