# Squad Dashboard

## Projeto
Dashboard de acompanhamento de vendas por squads para a Seazone.
- **Stack:** Next.js 16 + React 19 + TypeScript 5 + Tailwind 4
- **Deploy:** Vercel (squad-dashboard-eight.vercel.app)
- **GitHub:** fernandopereira-ship-it/squad-dashboard
- **Supabase:** ewgqbkdriflarmmifrvs

## Arquitetura
```
Pipedrive API → Edge Function (sync-squad-dashboard) → Supabase Tables
                                ↓ pg_cron (a cada 2h)
Supabase Tables → API Routes (Next.js) → JSON → React Frontend → Vercel
```

## Tabelas Supabase
| Tabela | Descrição |
|--------|-----------|
| squad_daily_counts | Contagens diárias por tab/empreendimento (35 dias) |
| squad_alignment | Deals abertos por empreendimento × owner |
| squad_metas | Metas mensais por squad × tab |
| squad_ratios | Ratios 90d e contagens (1 row por mês) |
| squad_calendar_events | Eventos Google Calendar dos closers (ociosidade) |
| squad_closer_rules | Regras dos 15 closers (email, prefixo, setor) |
| squad_meta_ads | Snapshot diário de ads Meta Ads SZI com diagnósticos |

## Edge Function: sync-squad-dashboard
- **Modos:** daily (1 tab), alignment, metas, all
- **Auth:** service_role JWT (via Bearer token)
- **Token Pipedrive:** lido do Vault via RPC `vault_read_secret`
- **pg_cron:** 6 jobs separados a cada 2h (minutos :03 a :08)

## Cálculo de Metas (CORRIGIDO 08/03/2026)
- **Fonte:** tabela `nekt_meta26_metas` (campo `data` formato DD/MM/YYYY)
- **Meta WON mensal** = `won_szi_meta_pago` + `won_szi_meta_direto`
- **Closers:** Squad 1 = 1 (Laura), Squad 2 = 2 (Camila, Filipe), Squad 3 = 2 (Luana, Priscila) → total 5
- **Meta WON por squad** = (meta_total / 5) × closers_do_squad
- **Meta to date** = (dia_atual / dias_no_mês) × meta_mensal_squad
- **Metas MQL/SQL/OPP** = ratios 90d (de squad_ratios) × meta WON do squad
- REGRA: Nunca usar `deal.value` (R$ monetário) como meta — sempre ler da nekt_meta26_metas
- REGRA: Dividir por closers (não por squads) e distribuir proporcionalmente

## Regras
- Dados vêm do Supabase, NÃO do Pipedrive direto
- Pipeline 28 + Canal Marketing filtrados na edge function
- Squads hardcoded em `src/lib/constants.ts`
- REGRA: WORKER_LIMIT no free tier — edge functions separadas em horários distintos
- REGRA: Para popular dados iniciais, usar script local (não edge function)

## Estrutura
```
src/
  app/page.tsx                              -- Dashboard client component
  app/api/dashboard/route.ts                -- API principal (tab + metas do Supabase)
  app/api/dashboard/acompanhamento/route.ts -- Dados de acompanhamento
  app/api/dashboard/alinhamento/route.ts    -- Dados de alinhamento
  app/api/dashboard/campanhas/route.ts      -- Dados Meta Ads por squad
  components/dashboard/                     -- Header, AcompanhamentoView, AlinhamentoView, CampanhasView, UI
  lib/constants.ts                          -- Squads, UI tokens
  lib/supabase.ts                           -- Cliente Supabase (anon key)
  lib/types.ts                              -- Interfaces TypeScript
  lib/dates.ts                              -- Gerador de datas 28d
```

## Edge Function: sync-squad-meta-ads (08/03/2026)
- **Objetivo:** Buscar insights Meta Ads da conta SZI, match empreendimentos, diagnosticar e salvar
- **Conta:** act_205286032338340 (SZI)
- **Token:** META_ACCESS_TOKEN no Vault
- **Lógica:** fetch level=ad month-to-date → match campaign_name contra 11 empreendimentos → benchmarks + diagnósticos
- **Diagnósticos:** CRITICO (CPL >2× mediana, CTR <0.5%, gasto >R$200 sem lead, freq >3.5) / ALERTA (CPL >P75, CTR <P25, CPM >2× mediana)
- **pg_cron:** job 48 `sync-squad-meta-ads-daily` às 10h UTC (7h BRT)
- REGRA: Match empreendimento sorted by name length DESC (evitar "Jurerê Spot II" capturar "Jurerê Spot III")
- REGRA: Alias "Vistas de Anitá" → "Vistas de Anitá II" (campaign_name sem sufixo)
- REGRA: NÃO filtrar por effective_status=ACTIVE — buscar todos os ads com atividade no período
- REGRA: Edge function v6 loga unmatched_campaigns para detectar novos empreendimentos/aliases
- REGRA: vault.create_secret(secret, name, description) — 1º param é o VALOR, 2º é o NOME
- REGRA: Para Lead Ads usar `onsite_conversion.lead_grouped` (formulários reais). `action_type === "lead"` inclui pixel leads e infla ~3-4x
- **Frontend:** view "Campanhas" com summary cards (mês), tabelas por squad, Top 10 ação imediata
- **Arquivos:** `campanhas-view.tsx`, `/api/dashboard/campanhas/route.ts`, types em `types.ts`

## Edge Function: sync-squad-calendar (08/03/2026)
- **Objetivo:** Sync Google Calendar → squad_calendar_events (ociosidade closers)
- **Auth:** Google Service Account com Domain-wide Delegation (impersona cada closer)
- **Vault secret:** `GOOGLE_SERVICE_ACCOUNT` (JSON da Service Account)
- **Janela:** D-2 a D+7
- **Lógica:** filtra por prefixo, extrai empreendimento (cascata pipe/&/<>/dash/Spot)
- **Cancelamento:** attendee closer com responseStatus=declined
- **pg_cron:** `sync-squad-calendar-daily` às 10h UTC (7h BRT)
- **PENDENTE:** Credenciais Google Service Account (requer admin Workspace)
- REGRA: Domain-wide delegation scope = `calendar.events.readonly`

## Env Vars
- `NEXT_PUBLIC_SUPABASE_URL` — URL do Supabase (Vercel + .env.local)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Anon key do Supabase (Vercel + .env.local)
