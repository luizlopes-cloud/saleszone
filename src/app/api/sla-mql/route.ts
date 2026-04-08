import { NextResponse } from "next/server"
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase"

export const dynamic = "force-dynamic"

const TABLES = [
  { table: "squad_baserow_empreendimentos", vertical: "SZI" },
  { table: "mktp_baserow_empreendimentos",  vertical: "Marketplace" },
  { table: "szs_baserow_empreendimentos",   vertical: "Serviços" },
] as const

export type SlaRow = {
  id: number
  vertical: "SZI" | "Marketplace" | "Serviços"
  table: string
  nome: string
  status: boolean
  commercial_squad: string
  mql_intencoes: string[]
  mql_faixas: string[]
  mql_pagamentos: string[]
}

export async function GET() {
  try {
    const supabase = createSquadSupabaseAdmin()

    const results = await Promise.all(
      TABLES.map(async ({ table, vertical }) => {
        const { data, error } = await supabase
          .from(table)
          .select("id, nome, status, commercial_squad, mql_intencoes, mql_faixas, mql_pagamentos")
          .neq("nome", "")
          .order("id", { ascending: true })

        if (error) {
          console.error(`Error fetching ${table}:`, error.message)
          return []
        }

        return (data || []).map(r => ({
          id:              r.id,
          vertical,
          table,
          nome:            r.nome || "",
          status:          Boolean(r.status),
          commercial_squad: r.commercial_squad || "",
          mql_intencoes:   Array.isArray(r.mql_intencoes)  ? r.mql_intencoes  : [],
          mql_faixas:      Array.isArray(r.mql_faixas)     ? r.mql_faixas     : [],
          mql_pagamentos:  Array.isArray(r.mql_pagamentos) ? r.mql_pagamentos : [],
        })) as SlaRow[]
      })
    )

    const rows: SlaRow[] = results.flat()
    return NextResponse.json({ rows })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
