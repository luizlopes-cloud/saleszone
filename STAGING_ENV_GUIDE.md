# Staging Environment — Correct Setup

**CRITICAL: Staging env vars are set in Vercel Dashboard, NOT in `.env` files.**

## Vercel Dashboard Settings

Go to: **https://vercel.com/dashboard** → project **saleszone** → Settings → Environment Variables

### Production (always deployed from `main`)
| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://iobxudcyihqfdwiggohz.supabase.co` | Production |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(from Supabase iobxudcyihqfdwiggohz → Settings → API)* | Production |
| `SUPABASE_SERVICE_ROLE_KEY` | *(from Supabase iobxudcyihqfdwiggohz → Settings → API)* | Production |

### Staging (deployed from `feat/saleszone-staging` or preview PRs)
> ⚠️ The staging Supabase project is `gamswizeexihaymfweeq` — **DO NOT** set staging vars on Production environment.

| Name | Value | Environment |
|------|-------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://gamswizeexihaymfweeq.supabase.co` | Preview (or create a `staging` environment) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | *(from Supabase gamswizeexihaymfweeq → Settings → API)* | Preview |
| `SUPABASE_SERVICE_ROLE_KEY` | *(from Supabase gamswizeexihaymfweeq → Settings → API — ROTATE IF EXPOSED)* | Preview |

### How NOT to break production

1. **Never set staging Supabase URL on Production environment** — this redirects Google OAuth login to the wrong Supabase project, breaking login for all users.
2. **Preview environments** inherit Preview env vars, not Production. Use "Preview" for the staging Supabase URL.
3. **If production breaks**, check: Vercel → Settings → Environment Variables → Production → `NEXT_PUBLIC_SUPABASE_URL`

## Supabase Projects Reference

| Project | URL | Used for |
|---------|-----|----------|
| `iobxudcyihqfdwiggohz` | `iobxudcyihqfdwiggohz.supabase.co` | **Production** — squad_dashboard, user_profiles, nekt_meta26_metas |
| `cncistmevwwghtaiyaao` | `cncistmevwwghtaiyaao.supabase.co` | **Squad data** — squad_deals, szs_deals, mktp_deals, squad_daily_counts, squad_meta_ads |
| `gamswizeexihaymfweeq` | `gamswizeexihaymfweeq.supabase.co` | **Staging** — full copy of production for testing |
