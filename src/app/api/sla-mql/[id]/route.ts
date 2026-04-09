import { NextRequest, NextResponse } from "next/server"
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase"

export const dynamic = "force-dynamic"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const numId = parseInt(id, 10)
    if (isNaN(numId)) return NextResponse.json({ error: "id inválido" }, { status: 400 })

    const body = await req.json() as {
      status: boolean
      mql_intencoes: string[]
      mql_faixas: string[]
      mql_pagamentos: string[]
    }

    const supabase = createSquadSupabaseAdmin()
    const { error } = await supabase
      .from("sla_mql_rows")
      .update({
        status:         body.status,
        mql_intencoes:  body.mql_intencoes,
        mql_faixas:     body.mql_faixas,
        mql_pagamentos: body.mql_pagamentos,
        updated_at:     new Date().toISOString(),
      })
      .eq("id", numId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const numId = parseInt(id, 10)
    if (isNaN(numId)) return NextResponse.json({ error: "id inválido" }, { status: 400 })

    const supabase = createSquadSupabaseAdmin()
    const { error } = await supabase.from("sla_mql_rows").delete().eq("id", numId)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
