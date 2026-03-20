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

    console.log("[contributions] Supabase URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
    console.log("[contributions] GitHub contributors count:", data.length);
    console.log("[contributions] GitHub logins:", data.map((c) => c.author.login));

    // Fetch user profiles with github_username
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, full_name, email, github_username");

    console.log("[contributions] Profiles with github_username:",
      (profiles || []).filter((p) => p.github_username).map((p) => ({
        name: p.full_name,
        gh: p.github_username,
        email: p.email,
      }))
    );

    // Map by github_username (primary match)
    const ghMap = new Map(
      (profiles || [])
        .filter((p) => p.github_username)
        .map((p) => [p.github_username!.toLowerCase(), p])
    );

    // Map by email (fallback match)
    const emailMap = new Map(
      (profiles || [])
        .filter((p) => p.email)
        .map((p) => [p.email!.toLowerCase(), p])
    );

    // Fetch GitHub user emails for fallback matching
    const ghEmailCache = new Map<string, string | null>();
    const loginsToCheck = data
      .filter((c) => !ghMap.has(c.author.login.toLowerCase()))
      .map((c) => c.author.login);

    if (loginsToCheck.length > 0) {
      console.log("[contributions] Logins without direct match, checking emails:", loginsToCheck);
      await Promise.all(
        loginsToCheck.map(async (login) => {
          try {
            const userRes = await fetch(`https://api.github.com/users/${login}`, {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
              },
            });
            if (userRes.ok) {
              const userData = await userRes.json();
              ghEmailCache.set(login.toLowerCase(), userData.email?.toLowerCase() || null);
            }
          } catch {
            // Ignore individual user fetch errors
          }
        })
      );
      console.log("[contributions] GitHub email lookups:", Object.fromEntries(ghEmailCache));
    }

    // Show only contributors linked to registered users (by username or email)
    const matchedContributors = data.filter((c) => {
      const login = c.author.login.toLowerCase();
      if (ghMap.has(login)) return true;
      const ghEmail = ghEmailCache.get(login);
      if (ghEmail && emailMap.has(ghEmail)) return true;
      return false;
    });

    // Fetch real last commit date for each contributor via commits API
    const lastCommitDates = new Map<string, string>();
    await Promise.all(
      matchedContributors.map(async (c) => {
        try {
          const commitRes = await fetch(
            `https://api.github.com/repos/seazone-socios/saleszone/commits?author=${c.author.login}&per_page=1`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
                Accept: "application/vnd.github.v3+json",
              },
            }
          );
          if (commitRes.ok) {
            const commits = await commitRes.json();
            if (commits.length > 0 && commits[0].commit?.author?.date) {
              lastCommitDates.set(c.author.login.toLowerCase(), commits[0].commit.author.date);
            }
          }
        } catch {
          // Ignore individual fetch errors
        }
      })
    );

    const contributors = matchedContributors.map((c) => {
      const login = c.author.login.toLowerCase();
      const profile = ghMap.get(login)
        || (ghEmailCache.get(login) ? emailMap.get(ghEmailCache.get(login)!) : undefined);
      const totalAdded = c.weeks.reduce((sum, w) => sum + w.a, 0);
      const totalDeleted = c.weeks.reduce((sum, w) => sum + w.d, 0);

      // Use real last commit date from commits API, fallback to stats week
      const lastCommitDate = lastCommitDates.get(login) || (() => {
        const lastWeek = [...c.weeks].reverse().find((w) => w.c > 0);
        return lastWeek ? new Date(lastWeek.w * 1000).toISOString() : null;
      })();

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

    console.log("[contributions] After filter:", contributors.length, "contributors");
    console.log("[contributions] Matched:", contributors.map((c) => c.github_login));

    // Sort by total lines added descending
    contributors.sort((a, b) => b.totalAdded - a.totalAdded);

    return NextResponse.json({ contributors });
  } catch (err) {
    console.error("GitHub API error:", err);
    return NextResponse.json({ error: "Failed to fetch GitHub stats" }, { status: 500 });
  }
}
