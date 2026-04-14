import { put } from "@vercel/blob"

export interface AuditCTWPPLead {
  deal_id: number
  deal_title: string
  owner_name: string
  stage_name: string
  deal_created_at: string
  morada_conversation_url: string
  morada_conversation_id: string
  tem_problema: boolean
  temperatura: string
  tag: string
  resumo: string
  problemas: string
  recomendacao: string
}

export interface AuditCTWPPDay {
  date: string       // YYYY-MM-DD ou "all-open"
  ran_at: string
  total_leads: number
  leads: AuditCTWPPLead[]
}

// ─── Stage map SZI (pipeline 28) ─────────────────────────────────────────────

export const SZI_STAGES: Record<number, string> = {
  186: "Contatados",
  338: "Qualificação",
  346: "Qualificado",
  339: "Aguardando data",
  187: "Agendado",
  340: "No Show/Reagendamento",
  208: "Reunião Realizada/OPP",
  312: "FUP",
  313: "Negociação",
  311: "Fila de espera",
  191: "Reservas",
  192: "Contrato",
  392: "FUP Parceiro",
}

// ─── Blob helpers ─────────────────────────────────────────────────────────────

const BLOB_STORE_URL = process.env.BLOB_URL || "https://r7yanltnwvovfvzj.private.blob.vercel-storage.com"

export function dateKeyBRT(date?: Date): string {
  const d = date || new Date()
  const brt = new Date(d.getTime() - 3 * 60 * 60 * 1000)
  return brt.toISOString().slice(0, 10)
}

export async function readAuditCTWPP(key: string): Promise<AuditCTWPPDay | null> {
  const token = process.env.BLOB_READ_WRITE_TOKEN || ""
  try {
    const res = await fetch(`${BLOB_STORE_URL}/audit-ctwpp/${key}.json`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      cache: "no-store",
    })
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

export async function writeAuditCTWPP(key: string, data: AuditCTWPPDay) {
  await put(`audit-ctwpp/${key}.json`, JSON.stringify(data), {
    access: "private",
    addRandomSuffix: false,
    allowOverwrite: true,
    token: process.env.BLOB_READ_WRITE_TOKEN,
  })
}
