import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

async function getAuthUser(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return null;
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("id, email, full_name, role, status")
    .eq("email", user.email)
    .single();
  if (!profile || profile.status !== "active") return null;
  return profile;
}

// GET — Lista todas as tasks
export async function GET() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: tasks, error } = await supabase
    .from("backlog_tasks")
    .select("*")
    .order("position", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Fetch user profiles for assigned_to and created_by
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, full_name, email");

  const profileMap = new Map((profiles || []).map((p) => [p.id, p]));

  const enriched = (tasks || []).map((t) => ({
    ...t,
    assigned_name: t.assigned_to ? profileMap.get(t.assigned_to)?.full_name || null : null,
    created_by_name: profileMap.get(t.created_by)?.full_name || null,
  }));

  return NextResponse.json({ tasks: enriched, profiles: profiles || [], currentUserId: user.id });
}

// POST — Cria nova task
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { title, description, type, assigned_to, definition_of_done, due_date } = body;

  if (!title || !type) {
    return NextResponse.json({ error: "title and type are required" }, { status: 400 });
  }
  if (!["feature", "bug"].includes(type)) {
    return NextResponse.json({ error: "type must be feature or bug" }, { status: 400 });
  }

  // Get max position in backlog column
  const { data: maxPos } = await supabase
    .from("backlog_tasks")
    .select("position")
    .eq("status", "backlog")
    .order("position", { ascending: false })
    .limit(1)
    .single();

  const position = (maxPos?.position ?? 0) + 1000;

  const { data: task, error } = await supabase
    .from("backlog_tasks")
    .insert({
      title,
      description: description || "",
      type,
      assigned_to: assigned_to || null,
      definition_of_done: definition_of_done || "",
      due_date: due_date || null,
      position,
      created_by: user.id,
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task });
}

// PATCH — Atualiza task
export async function PATCH(request: NextRequest) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id, ...fields } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  // Validate allowed fields
  const allowed = ["title", "description", "type", "status", "assigned_to", "definition_of_done", "due_date", "position", "image_url", "priority"];
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  for (const key of allowed) {
    if (key in fields) {
      updates[key] = fields[key];
    }
  }

  if (updates.type && !["feature", "bug"].includes(updates.type as string)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }
  if (updates.status && !["backlog", "planejado", "fazendo", "review", "done"].includes(updates.status as string)) {
    return NextResponse.json({ error: "Invalid status" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("backlog_tasks")
    .update(updates)
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ task: data });
}

// DELETE — Remove task
export async function DELETE(request: NextRequest) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { id } = body;

  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  const { error } = await supabase.from("backlog_tasks").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
