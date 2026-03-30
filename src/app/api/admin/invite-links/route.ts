import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function getDiretorEmail(supabase: Awaited<ReturnType<typeof createClient>>): Promise<string | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("email", user.email)
    .single();
  if (profile?.role !== "diretor") return null;
  return user.email;
}

// GET — Lista links de convite
export async function GET() {
  const supabase = await createClient();
  const directorEmail = await getDiretorEmail(supabase);
  if (!directorEmail) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data } = await supabase
    .from("user_invite_links")
    .select("*")
    .order("created_at", { ascending: false });

  return NextResponse.json({ links: data || [] });
}

// POST — Criar novo link
export async function POST(request: Request) {
  const supabase = await createClient();
  const directorEmail = await getDiretorEmail(supabase);
  if (!directorEmail) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await request.json();
  const role = body.role || "operador";
  const maxUses = body.max_uses ?? 0;
  const expiresInDays = body.expires_in_days ?? 7;

  if (!["operador", "diretor"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + expiresInDays);

  const { data, error } = await supabase
    .from("user_invite_links")
    .insert({
      role,
      created_by: directorEmail,
      max_uses: maxUses,
      expires_at: expiresAt.toISOString(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ link: data });
}

// PATCH — Desativar link
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const directorEmail = await getDiretorEmail(supabase);
  if (!directorEmail) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await request.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });

  const { error } = await supabase
    .from("user_invite_links")
    .update({ active: false })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
