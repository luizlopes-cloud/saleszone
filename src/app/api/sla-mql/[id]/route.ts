import { NextRequest, NextResponse } from "next/server"
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase"

export const dynamic = "force-dynamic"

const ALLOWED_TABLES = new Set([
  "squad_baserow_empreendimentos",
  "mktp_baserow_empreendimentos",
  "szs_baserow_empreendimentos",
])

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const numId = parseInt(id, 10)
    if (isNaN(numId)) {
      return NextResponse.json({ error: "id inválido" }, { status: 400 })
    }

    const body = await req.json() as {
      table: string
      mql_intencoes: string[]
      mql_faixas: string[]
      mql_pagamentos: string[]
    }

    const { table, mql_intencoes, mql_faixas, mql_pagamentos } = body

    if (!ALLOWED_TABLES.has(table)) {
      return NextResponse.json({ error: `table inválida: ${table}` }, { status: 400 })
    }

    const supabase = createSquadSupabaseAdmin()
    const { error } = await supabase
      .from(table)
      .update({ mql_intencoes, mql_faixas, mql_pagamentos })
      .eq("id", numId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
