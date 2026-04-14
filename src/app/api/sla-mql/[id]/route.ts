import { NextRequest, NextResponse } from "next/server"
import { readData, writeData } from "@/lib/sla-mql-blob"

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
      commercial_squad?: string
      mql_intencoes: string[]
      mql_faixas: string[]
      mql_pagamentos: string[]
      allRows?: { id: number; vertical: string; nome: string; status: boolean; commercial_squad: string; mql_intencoes: string[]; mql_faixas: string[]; mql_pagamentos: string[] }[]
    }

    const before = await readData()
    if (!before.rows.find(r => r.id === numId)) {
      return NextResponse.json({ error: `Row ${numId} não encontrada no blob` }, { status: 404 })
    }
    // Se o cliente enviou o array completo, usá-lo diretamente elimina a race condition
    // de read-modify-write quando múltiplos saves correm em paralelo.
    const rows = body.allRows ?? before.rows.map(r => r.id === numId ? { ...r, ...body } : r)
    await writeData({ ...before, rows })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const numId = parseInt(id, 10)
    if (isNaN(numId)) return NextResponse.json({ error: "id inválido" }, { status: 400 })

    const data = await readData()
    await writeData({ ...data, rows: data.rows.filter(r => r.id !== numId) })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
