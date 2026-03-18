import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();

  // Verify director role
  const { data: { user } } = await supabase.auth.getUser();
  if (!user?.email) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("email", user.email)
    .single();

  if (profile?.role !== "diretor") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [analyticsRes, recentRes] = await Promise.all([
    supabase.rpc("get_user_access_analytics"),
    supabase.rpc("get_recent_accesses", { p_limit: 50 }),
  ]);

  return NextResponse.json({
    analytics: analyticsRes.data || [],
    recent: recentRes.data || [],
  });
}
