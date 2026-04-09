import { NextRequest, NextResponse } from "next/server"
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase"

export const dynamic = "force-dynamic"

// PUT /api/sla-mql/forms
// Body: { vertical: string; questions: Array<{ pergunta: string; opcoes: string[] }> }
// Replaces all questions for the given vertical (delete + re-insert ordered)
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json() as {
      vertical: string
      questions: Array<{ pergunta: string; opcoes: string[] }>
    }
    const { vertical, questions } = body

    if (!vertical || !Array.isArray(questions)) {
      return NextResponse.json({ error: "params inválidos" }, { status: 400 })
    }

    const supabase = createSquadSupabaseAdmin()

    // Delete existing rows for this vertical
    const { error: delError } = await supabase
      .from("sla_mql_forms")
      .delete()
      .eq("vertical", vertical)

    if (delError) return NextResponse.json({ error: delError.message }, { status: 500 })

    // Re-insert with sort_order
    if (questions.length > 0) {
      const rows = questions.map((q, i) => ({
        vertical,
        sort_order: i,
        pergunta: q.pergunta,
        opcoes: q.opcoes,
      }))
      const { error: insError } = await supabase.from("sla_mql_forms").insert(rows)
      if (insError) return NextResponse.json({ error: insError.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
