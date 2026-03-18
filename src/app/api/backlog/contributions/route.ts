import { NextResponse } from "next/server";
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

interface GitHubWeek {
  w: number;
  a: number;
  d: number;
  c: number;
}

interface GitHubContributor {
  author: { login: string };
  total: number;
  weeks: GitHubWeek[];
}

// GET — Busca stats do GitHub API
export async function GET() {
  const supabase = await createClient();
  const user = await getAuthUser(supabase);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "GITHUB_TOKEN not configured" }, { status: 500 });
  }

  try {
    // GitHub may return 202 while computing stats — retry up to 3 times
    let res: Response | null = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      res = await fetch(
        "https://api.github.com/repos/seazone-socios/saleszone/stats/contributors",
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: "application/vnd.github.v3+json",
          },
          cache: "no-store",
        }
      );
      console.log("[contributions] GitHub API status:", res.status, "attempt:", attempt + 1);
      if (res.status !== 202) break;
      // Wait 2s before retrying
      await new Promise((r) => setTimeout(r, 2000));
    }

    if (!res || res.status === 202) {
      return NextResponse.json({ contributors: [], computing: true });
    }

    if (!res.ok) {
      const body = await res.text();
      console.error("[contributions] GitHub API error:", res.status, body);
      return NextResponse.json({ error: `GitHub API error: ${res.status}` }, { status: 500 });
    }

    const data: GitHubContributor[] = await res.json();

    // Fetch user profiles with github_username
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, github_username");

    const ghMap = new Map(
      (profiles || [])
        .filter((p) => p.github_username)
        .map((p) => [p.github_username!.toLowerCase(), p])
    );

    // Show only contributors linked to registered users
    const contributors = data
      .filter((c) => ghMap.has(c.author.login.toLowerCase()))
      .map((c) => {
      const profile = ghMap.get(c.author.login.toLowerCase());
      const totalAdded = c.weeks.reduce((sum, w) => sum + w.a, 0);
      const totalDeleted = c.weeks.reduce((sum, w) => sum + w.d, 0);

      const lastWeekWithCommits = [...c.weeks].reverse().find((w) => w.c > 0);
      const lastCommitDate = lastWeekWithCommits
        ? new Date(lastWeekWithCommits.w * 1000).toISOString()
        : null;

      return {
        name: profile?.full_name || c.author.login,
        email: profile?.email || null,
        github_login: c.author.login,
        totalCommits: c.total,
        totalAdded,
        totalDeleted,
        lastCommitDate,
        weeks: c.weeks.slice(-12).map((w) => ({
          week: new Date(w.w * 1000).toISOString(),
          commits: w.c,
          added: w.a,
          deleted: w.d,
        })),
      };
    });

    // Sort by total commits descending
    contributors.sort((a, b) => b.totalCommits - a.totalCommits);

    return NextResponse.json({ contributors });
  } catch (err) {
    console.error("GitHub API error:", err);
    return NextResponse.json({ error: "Failed to fetch GitHub stats" }, { status: 500 });
  }
}
