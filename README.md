# Squad Dashboard

Dashboard de acompanhamento de vendas por squads para a Seazone (Pipeline SZI).
Centraliza dados de Pipedrive, Meta Ads e Google Calendar em uma interface unificada.

**Deploy:** [saleszone.vercel.app](https://saleszone.vercel.app)

## Stack
Next.js 16 · React 19 · TypeScript 5 · Tailwind 4 · Supabase (PostgreSQL + Edge Functions Deno) · Vercel

## Comandos
```bash
npm run dev              # Dev server (porta 3000)
npm run build            # Build produção
npm run lint             # ESLint
npm run lint -- --fix    # ESLint com auto-fix
```

## Documentação
Toda a documentação técnica (arquitetura, tabelas, edge functions, armadilhas, regras de negócio) está nos `CLAUDE.md`:

- [`CLAUDE.md`](./CLAUDE.md) — overview, stack, squads, env, admin, SZS, heartbeats
- [`src/app/api/CLAUDE.md`](./src/app/api/CLAUDE.md) — API routes, cálculo de metas, filtros, forecast
- [`src/components/dashboard/CLAUDE.md`](./src/components/dashboard/CLAUDE.md) — views, header, sync button, regras de cada tela
- [`supabase/CLAUDE.md`](./supabase/CLAUDE.md) — tabelas, Edge Functions, pg_cron, armadilhas Pipedrive/Meta/Supabase
