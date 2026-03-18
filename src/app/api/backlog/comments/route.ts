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

// GET — Lista comentários de uma task
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const taskId = request.nextUrl.searchParams.get("task_id");
  if (!taskId) return NextResponse.json({ error: "task_id is required" }, { status: 400 });

  const { data: comments, error } = await supabase
    .from("backlog_comments")
    .select("*")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Enrich with author names
  const authorIds = [...new Set((comments || []).map((c) => c.author_id))];
  const { data: profiles } = await supabase
    .from("user_profiles")
    .select("id, full_name")
    .in("id", authorIds);

  const profileMap = new Map((profiles || []).map((p) => [p.id, p.full_name]));

  const enriched = (comments || []).map((c) => ({
    ...c,
    author_name: profileMap.get(c.author_id) || "Desconhecido",
  }));

  return NextResponse.json({ comments: enriched });
}

// POST — Cria comentário
export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { task_id, content } = body;

  if (!task_id || !content?.trim()) {
    return NextResponse.json({ error: "task_id and content are required" }, { status: 400 });
  }

  const { data: comment, error } = await supabase
    .from("backlog_comments")
    .insert({
      task_id,
      author_id: user.id,
      content: content.trim(),
    })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    comment: { ...comment, author_name: user.full_name },
  });
}
