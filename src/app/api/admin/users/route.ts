import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createClient as createServiceClient } from "@supabase/supabase-js";

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

// GET — Lista user_profiles + user_invitations
export async function GET() {
  const supabase = await createClient();
  const directorEmail = await getDiretorEmail(supabase);
  if (!directorEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [profilesRes, invitationsRes] = await Promise.all([
    supabase.from("user_profiles").select("*").order("created_at", { ascending: false }),
    supabase.from("user_invitations").select("*").order("created_at", { ascending: false }),
  ]);

  return NextResponse.json({
    profiles: profilesRes.data || [],
    invitations: invitationsRes.data || [],
  });
}

// POST — Convidar usuário
export async function POST(request: Request) {
  const supabase = await createClient();
  const directorEmail = await getDiretorEmail(supabase);
  if (!directorEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { email, full_name, role } = body as { email: string; full_name: string; role: string };

  if (!email || !full_name || !role) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (!["operador", "diretor"].includes(role)) {
    return NextResponse.json({ error: "Invalid role" }, { status: 400 });
  }
  if (!email.endsWith("@seazone.com.br")) {
    return NextResponse.json({ error: "Only @seazone.com.br emails" }, { status: 400 });
  }

  // Verificar se já existe profile ou convite
  const { data: existingProfile } = await supabase
    .from("user_profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (existingProfile) {
    return NextResponse.json({ error: "Usuário já cadastrado" }, { status: 409 });
  }

  const { data: existingInvite } = await supabase
    .from("user_invitations")
    .select("id")
    .eq("email", email)
    .single();
  if (existingInvite) {
    return NextResponse.json({ error: "Convite já enviado" }, { status: 409 });
  }

  // Inserir convite
  const { data: invitation, error: invError } = await supabase
    .from("user_invitations")
    .insert({ email, role, invited_by: directorEmail })
    .select()
    .single();

  if (invError) {
    return NextResponse.json({ error: invError.message }, { status: 500 });
  }

  // Enviar email via Edge Function
  try {
    const serviceClient = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
    const inviterName = directorEmail.split("@")[0].replace(".", " ");
    await serviceClient.functions.invoke("send-invite-email", {
      body: { to: email, inviterName, role, full_name },
    });
  } catch (emailErr) {
    console.error("Failed to send invite email:", emailErr);
    // Convite criado mesmo se email falhar
  }

  return NextResponse.json({ invitation });
}

// PATCH — Alterar role ou status de um profile
export async function PATCH(request: Request) {
  const supabase = await createClient();
  const directorEmail = await getDiretorEmail(supabase);
  if (!directorEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { id, role, status, github_username } = body as { id: string; role?: string; status?: string; github_username?: string };

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const updates: Record<string, string | null> = { updated_at: new Date().toISOString() };
  if (role && ["operador", "diretor"].includes(role)) updates.role = role;
  if (status && ["active", "inactive"].includes(status)) updates.status = status;
  if (github_username !== undefined) updates.github_username = github_username || null;

  const { data, error } = await supabase
    .from("user_profiles")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ profile: data });
}

// DELETE — Remover profile ou cancelar convite
export async function DELETE(request: Request) {
  const supabase = await createClient();
  const directorEmail = await getDiretorEmail(supabase);
  if (!directorEmail) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json();
  const { id, type } = body as { id: string; type: "profile" | "invitation" };

  if (!id || !type) {
    return NextResponse.json({ error: "Missing id or type" }, { status: 400 });
  }

  if (type === "invitation") {
    const { error } = await supabase.from("user_invitations").delete().eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    // Soft delete: desativar em vez de deletar
    const { error } = await supabase
      .from("user_profiles")
      .update({ status: "inactive", updated_at: new Date().toISOString() })
      .eq("id", id);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
