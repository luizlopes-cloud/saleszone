# Squad Dashboard

## O que e
Dashboard de acompanhamento de vendas por squads para a Seazone (Pipeline SZI).
Centraliza dados do Pipedrive, Meta Ads e Google Calendar em uma interface unificada.

- **Deploy:** Vercel (squad-dashboard-eight.vercel.app)
- **GitHub:** fernandopereira-ship-it/squad-dashboard
- **Supabase:** projeto `ewgqbkdriflarmmifrvs` (plano Pro)

## Stack
- **Framework:** Next.js 16 (App Router, Turbopack)
- **UI:** React 19, TypeScript 5, Tailwind 4
- **Icons:** Lucide React
- **Validacao:** Zod 4
- **Auth:** Supabase Auth (OAuth Google, dominio @seazone.com.br)
- **Database:** Supabase (PostgreSQL) + Edge Functions (Deno)
- **Deploy:** Vercel (auto-deploy via GitHub push to main)

## Arquitetura
```
Pipedrive API / Meta Ads API / Google Calendar API
    |
    v
Supabase Edge Functions (Deno) — triggered by pg_cron a cada 2h
    |
    v
Supabase PostgreSQL (tabelas squad_*)
    |
    v
Next.js API Routes (/api/dashboard/*) — leem do Supabase, agregam por squad
    |
    v
React Client Components — exibem tabs, charts, tabelas
    |
    v
Vercel (squad-dashboard-eight.vercel.app)
```

## Estrutura do Projeto
```
src/
  app/
    page.tsx                                 — Dashboard principal (client component, state global)
    login/page.tsx                           — Pagina de login
    auth/callback/route.ts                   — OAuth callback Supabase
    api/
      sync/route.ts                          — Orquestrador: chama Edge Functions sequencialmente
      dashboard/route.ts                     — API principal (daily counts por tab)
      dashboard/acompanhamento/route.ts      — Heatmap diario por empreendimento
      dashboard/alinhamento/route.ts         — Distribuicao deals por owner/squad
      dashboard/campanhas/route.ts           — Meta Ads por squad/empreendimento
      dashboard/funil/route.ts               — Funil impressions→clicks→leads→MQL→SQL→OPP→WON
      dashboard/ociosidade/route.ts          — Disponibilidade closers (Google Calendar)
      dashboard/presales/route.ts            — Tempo de resposta pre-vendedores
      dashboard/regras-mql/route.ts          — Regras e taxas de qualificacao MQL
  components/dashboard/
    header.tsx                               — Navegacao, usuario, botao Atualizar
    acompanhamento-view.tsx                  — Heatmap 28 dias + metas
    alinhamento-view.tsx                     — Matriz pre-venda x closer
    campanhas-view.tsx                       — Summary cards Meta Ads + tabelas por squad
    diagnostico-mkt-view.tsx                 — Outliers CPL/CTR/CPM, acoes imediatas
    ociosidade-view.tsx                      — Ocupacao closers (passado/futuro)
    balanceamento-view.tsx                   — Taxas de qualificacao por empreendimento/fonte
    presales-view.tsx                        — Performance pre-vendedores + deals recentes
    ui.tsx                                   — Componentes reutilizaveis
  lib/
    constants.ts                             — Squads, empreendimentos, closers, UI tokens (T)
    types.ts                                 — Todas as interfaces TypeScript do projeto
    dates.ts                                 — Gerador de datas 28 dias
    supabase.ts                              — Cliente browser (anon key)
    supabase/client.ts                       — createBrowserClient wrapper
    supabase/server.ts                       — createServerClient (cookies)
    supabase/middleware.ts                    — Valida sessao + dominio @seazone.com.br
  middleware.ts                              — Protege rotas (redireciona /login se nao autenticado)
supabase/
  functions/
    sync-squad-dashboard/index.ts            — ETL principal Pipedrive → Supabase
    sync-squad-presales/index.ts             — ETL pre-vendas (deals + atividades)
```

## Tabelas Supabase
| Tabela | Descricao |
|--------|-----------|
| `squad_daily_counts` | Contagens diarias por tab (mql/sql/opp/won) x empreendimento (35 dias) |
| `squad_alignment` | Deals abertos por empreendimento x owner |
| `squad_metas` | Metas mensais por squad x tab (upsert month,squad_id,tab) |
| `squad_ratios` | Ratios 90d MQL→SQL→OPP→WON e contagens (1 row por mes) |
| `squad_calendar_events` | Eventos Google Calendar dos closers |
| `squad_closer_rules` | Regras dos 15 closers (email, prefixo, setor) |
| `squad_meta_ads` | Snapshot diario de ads Meta Ads SZI com diagnosticos |
| `squad_presales_response` | Deals com tempo de resposta dos pre-vendedores (30 dias) |
| `config_pre_vendedores` | Configuracao de pre-vendedores (user_id, user_name, pipeline_id) |
| `nekt_meta26_metas` | Metas mensais WON (fonte externa, campo `data` formato DD/MM/YYYY) |

## Edge Functions

### sync-squad-dashboard
ETL principal. Roda em 5 modos separados (cada um fica dentro do limite de 150MB de memoria):

| Modo | O que faz | Escrita |
|------|-----------|---------|
| `daily-open` | Busca deals abertos via `/pipelines/28/deals` | **Substitui** squad_daily_counts |
| `daily-won` | Busca deals ganhos via `/deals?status=won&stage_id=X` por stage | **Merge** com existente |
| `daily-lost` | Busca deals perdidos via `/deals?status=lost&stage_id=X` com cutoff 90d | **Merge** com existente |
| `alignment` | Deals abertos + `/users` API | Substitui squad_alignment |
| `metas` | Calculo DB-only (squad_daily_counts + nekt_meta26_metas) | Upsert squad_metas + squad_ratios |

**IMPORTANTE — Ordem importa:** daily-open DEVE rodar antes de daily-won/daily-lost (open substitui, won/lost fazem merge).

**Filtros para contagem de deals:**
- `isMarketingDeal(deal)`: campo canal = "12" (Marketing)
- `getEmpreendimento(deal)`: campo empreendimento deve estar no EMPREENDIMENTO_MAP (11 empreendimentos)
- Data por tab: MQL = `add_time`, SQL = campo qualificacao, OPP = campo reuniao, WON = `won_time`
- Janela: ultimos 35 dias

### sync-squad-presales
- Busca deals + atividades (calls) por pre-vendedor do Pipedrive
- Calcula `first_action_at` (primeira call done=true) e `response_time_minutes`
- **transbordo_at** (prioridade): 1) `nekt_transbordo_mia.webhook_received_at_br` → 2) primeira atividade MIA em `nekt_pipedrive_activities` → 3) `deal.add_time` (fallback)
- REGRA: transbordo NAO e o add_time do deal — e o momento em que a MIA transferiu o lead para o pre-vendedor
- Pre-vendedores lidos de `config_pre_vendedores`
- Snapshot completo: deleta tudo e insere (30 dias lookback)

### sync-squad-meta-ads (deploy separado, codigo nao no repo)
- Busca insights Meta Ads conta SZI (act_205286032338340)
- Match campaign_name contra empreendimentos (sort by name length DESC para evitar match parcial)
- Alias: "Vistas de Anita" → "Vistas de Anita II"
- Filtrar por `effective_status=ACTIVE`
- Para Lead Ads usar `onsite_conversion.lead_grouped` (formularios reais). `action_type === "lead"` inclui pixel leads e infla ~3-4x
- Diagnosticos: CRITICO (CPL >2x mediana, CTR <0.5%, gasto >R$200 sem lead, freq >3.5) / ALERTA (CPL >P75, CTR <P25, CPM >2x mediana)
- Loga unmatched_campaigns para detectar novos empreendimentos/aliases

### sync-squad-calendar (deploy separado, codigo nao no repo)
- Google Service Account com Domain-wide Delegation (scope: calendar.events.readonly)
- Impersona cada closer, sync eventos D-2 a D+7
- Filtra por prefixo, extrai empreendimento
- Cancelamento: attendee com responseStatus=declined

## pg_cron
### Dashboard (a cada 2h)
| Minuto | Job ID | Nome | Modo |
|--------|--------|------|------|
| :03 | 51 | squad-daily-open | `daily-open` |
| :05 | 52 | squad-daily-won | `daily-won` |
| :07 | 53 | squad-daily-lost | `daily-lost` |
| :09 | 44 | sync-squad-alignment | `alignment` |
| :11 | 45 | sync-squad-metas | `metas` |

### Diarios (10h UTC / 7h BRT)
| Job | Funcao |
|-----|--------|
| 47 | sync-squad-calendar |
| 48 | sync-squad-meta-ads |

## Squads e Pessoas
| Squad | Marketing | Pre-Venda | Closers (qtd) | Empreendimentos |
|-------|-----------|-----------|---------------|-----------------|
| 1 | Mari | Luciana Patricio | Laura (1) | Ponta das Canas II, Itacare, Marista 144 |
| 2 | Jean | Natalia Saramago | Camila Santos, Filipe Padoveze (2) | Natal, Novo Campeche II, Caragua, Bonito II |
| 3 | Jean | Hellen Dias | Luana Schaikoski, Priscila Perrone (2) | Jurere II, Jurere III, Barra Grande, Vistas de Anita II |

Total: 5 closers. Metas WON divididas por closer e distribuidas proporcionalmente por squad.

## Calculo de Metas
1. Ler `nekt_meta26_metas` do mes atual (campo `data` formato DD/MM/YYYY, ex: "01/03/2026")
2. `meta_won_total = won_szi_meta_pago + won_szi_meta_direto`
3. `meta_won_squad = (meta_won_total / 5) * closers_do_squad`
4. `meta_to_date = (dia_atual / dias_no_mes) * meta_won_squad`
5. Metas MQL/SQL/OPP = ratios 90d (de squad_ratios) x meta WON do squad
- NUNCA usar `deal.value` (R$ monetario) como meta — sempre ler da nekt_meta26_metas
- Dividir por closers (nao por squads) e distribuir proporcionalmente

## Pipedrive API — Armadilhas Conhecidas
- `/deals` endpoint **IGNORA** `pipeline_id` param silenciosamente — retorna TODOS os pipelines
- `/pipelines/{id}/deals` retorna **SOMENTE** deals abertos, ignora param `status`
- `/pipelines/{id}/deals` retorna `user_id` como **integer** (nao objeto como `/deals`)
- Para deals won/lost do pipeline 28: usar `/deals?status=X&stage_id=Y` com os 14 stage IDs
- Pipeline 28 stage IDs: `[392, 184, 186, 338, 346, 339, 187, 340, 208, 312, 313, 311, 191, 192]`
- Pipeline 28 tem ~1300 open, ~2900 won, **58k+ lost** — lost deals PRECISAM de sort + cutoff 90d
- Limite de filters atingido — usar stage_id ao inves de criar filters
- Pipedrive domain: seazone-fd92b9.pipedrive.com

## Supabase — Notas
- Auth: service_role JWT (via Bearer token) para Edge Functions
- Token Pipedrive: `vault_read_secret('PIPEDRIVE_API_TOKEN')`
- Token Meta: `vault_read_secret('META_ACCESS_TOKEN')`
- Google SA: `vault_read_secret('GOOGLE_SERVICE_ACCOUNT')`
- `vault.create_secret(secret, name, description)` — 1o param e o VALOR, 2o e o NOME
- Edge Functions tem limite de ~150MB memoria — por isso os 5 modos separados
- `tsconfig.json` DEVE excluir `supabase/` (Deno URL imports quebram build Next.js no Vercel)

## Botao "Atualizar" (sync)
O botao no header chama `POST /api/sync` com `{"functions":["dashboard"]}` que executa sequencialmente:
1. `sync-squad-dashboard` mode=daily-open (~4s)
2. `sync-squad-dashboard` mode=daily-won (~8s)
3. `sync-squad-dashboard` mode=daily-lost (~23s)
4. `sync-squad-dashboard` mode=alignment (~3s)
5. `sync-squad-dashboard` mode=metas (~3s)

Depois re-busca dados da view atual. Total: ~41s.

Outras views usam functions diferentes:
- Campanhas/Diagnostico Mkt: `["meta-ads"]`
- Ociosidade: `["calendar"]`
- Pre-Venda: `["presales"]`

## Convencoes
- Idioma do codigo: ingles
- Idioma da UI: portugues brasileiro
- Commits: conventional commits (feat:, fix:, refactor:)
- Estilos: inline styles com tokens de `T` (constants.ts), NAO Tailwind nos components
- Dados sempre vem do Supabase, NUNCA do Pipedrive direto no frontend
- Squads hardcoded em `src/lib/constants.ts`

## Env Vars (.env.local + Vercel)
- `NEXT_PUBLIC_SUPABASE_URL` — URL do Supabase
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Anon key
- `SUPABASE_SERVICE_ROLE_KEY` — Service role key (server-side only)

## Comandos
```bash
npm run dev          # Dev server (porta 3000)
npm run build        # Build producao
npm run lint         # ESLint
```
