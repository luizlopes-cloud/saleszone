import { NextRequest, NextResponse } from "next/server"
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase"

export const dynamic = "force-dynamic"

export type SlaRow = {
  id: number
  vertical: string
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

    const [rowsRes, formsRes] = await Promise.all([
      supabase.from("sla_mql_rows").select("*").order("id", { ascending: true }),
      supabase.from("sla_mql_forms").select("*").order("vertical").order("sort_order"),
    ])

    if (rowsRes.error) return NextResponse.json({ error: rowsRes.error.message }, { status: 500 })
    if (formsRes.error) return NextResponse.json({ error: formsRes.error.message }, { status: 500 })

    const rows: SlaRow[] = (rowsRes.data || []).map(r => ({
      id:               r.id,
      vertical:         r.vertical,
      nome:             r.nome,
      status:           Boolean(r.status),
      commercial_squad: r.commercial_squad || "",
      mql_intencoes:    Array.isArray(r.mql_intencoes)  ? r.mql_intencoes  : [],
      mql_faixas:       Array.isArray(r.mql_faixas)     ? r.mql_faixas     : [],
      mql_pagamentos:   Array.isArray(r.mql_pagamentos) ? r.mql_pagamentos : [],
    }))

    const forms: Record<string, Array<{ pergunta: string; opcoes: string[] }>> = {}
    for (const f of formsRes.data || []) {
      if (!forms[f.vertical]) forms[f.vertical] = []
      forms[f.vertical].push({ pergunta: f.pergunta, opcoes: Array.isArray(f.opcoes) ? f.opcoes : [] })
    }

    return NextResponse.json({ rows, forms })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      vertical: string
      nome: string
      commercial_squad?: string
      mql_intencoes?: string[]
      mql_faixas?: string[]
      mql_pagamentos?: string[]
    }
    const { vertical, nome, commercial_squad = "", mql_intencoes = [], mql_faixas = [], mql_pagamentos = [] } = body

    if (!vertical || !nome?.trim()) {
      return NextResponse.json({ error: "params inválidos" }, { status: 400 })
    }

    const supabase = createSquadSupabaseAdmin()
    const { data, error } = await supabase
      .from("sla_mql_rows")
      .insert({ vertical, nome: nome.trim(), status: true, commercial_squad, mql_intencoes, mql_faixas, mql_pagamentos })
      .select("id")
      .single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, id: data.id })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
