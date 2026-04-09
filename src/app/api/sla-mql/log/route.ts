import { NextRequest, NextResponse } from "next/server"
import { createSquadSupabaseAdmin } from "@/lib/squad/supabase"

export const dynamic = "force-dynamic"

export async function GET() {
  try {
    const supabase = createSquadSupabaseAdmin()
    const { data, error } = await supabase
      .from("sla_mql_log")
      .select("*")
      .order("ts", { ascending: false })
      .limit(500)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ entries: data || [] })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

// POST /api/sla-mql/log
// Body: { entries: Array<{ user_name, user_email, vertical, section, action, entity, detail }> }
export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as {
      entries: Array<{
        user_name: string
        user_email: string
        vertical: string
        section: string
        action: string
        entity: string
        detail: string
      }>
    }

    if (!Array.isArray(body.entries) || body.entries.length === 0) {
      return NextResponse.json({ ok: true })
    }

    const supabase = createSquadSupabaseAdmin()
    const { error } = await supabase.from("sla_mql_log").insert(body.entries)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
