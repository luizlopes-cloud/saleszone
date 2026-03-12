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
      dashboard/alinhamento/deals/route.ts   — Deals desalinhados por pessoa (com links Pipedrive)
      dashboard/campanhas/route.ts           — Meta Ads por squad/empreendimento
      dashboard/funil/route.ts               — Funil Leads→MQL→SQL→OPP→Reserva→Contrato→WON
      dashboard/ociosidade/route.ts          — Disponibilidade closers (Google Calendar)
      dashboard/presales/route.ts            — Tempo de resposta pre-vendedores
      dashboard/regras-mql/route.ts          — Regras e taxas de qualificacao MQL
      dashboard/planejamento/route.ts        — Conversao midia paga vs historico
      dashboard/orcamento/route.ts           — GET/POST orcamento mensal + gasto diario
  components/dashboard/
    header.tsx                               — Navegacao, usuario, botao Atualizar. Dropdown "Meta Ads" agrupa Campanhas/Diagnostico Mkt/Orcamento/Planejamento
    acompanhamento-view.tsx                  — Heatmap 28 dias + metas
    alinhamento-view.tsx                     — Matriz pre-venda x closer + deals desalinhados por squad
    campanhas-view.tsx                       — Summary cards Meta Ads + tabelas por squad
    diagnostico-mkt-view.tsx                 — Outliers CPL/CTR/CPM, acoes imediatas, oportunidades de escala
    ociosidade-view.tsx                      — Ocupacao closers (passado/futuro)
    balanceamento-view.tsx                   — Taxas de qualificacao por empreendimento/fonte
    resultados-view.tsx                      — Funil comercial Leads→WON + Reserva/Contrato
    presales-view.tsx                        — Performance pre-vendedores + deals recentes
    planejamento-view.tsx                    — Metricas atuais vs historicas por empreendimento
    orcamento-view.tsx                       — Budget mensal editavel, barra progresso, breakdown squad/emp
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
    sync-baserow-forms/index.ts              — ETL Baserow formularios → Supabase
    sync-baserow-leads/index.ts              — ETL Baserow leads → Supabase
```

## Tabelas Supabase
| Tabela | Descricao |
|--------|-----------|
| `squad_daily_counts` | Contagens diarias por tab (mql/sql/opp/won/reserva/contrato) x empreendimento (35 dias). CHECK constraint inclui todos os 6 tabs. |
| `squad_alignment` | Deals abertos por empreendimento x owner |
| `squad_metas` | Metas mensais por squad x tab (upsert month,squad_id,tab) |
| `squad_ratios` | Ratios 90d MQL→SQL→OPP→WON e contagens (1 row por mes) |
| `squad_calendar_events` | Eventos Google Calendar dos closers |
| `squad_closer_rules` | Regras dos 15 closers (email, prefixo, setor) |
| `squad_meta_ads` | Snapshot diario de ads Meta Ads SZI com diagnosticos. Campos `spend`/`leads` sao lifetime; usar `spend_month`/`leads_month` para dados do mes. Coluna `effective_status` (ACTIVE/PAUSED). |
| `squad_alignment_deals` | Deals individuais do alinhamento (deal_id, title, empreendimento, owner_name) para listar desalinhados |
| `squad_presales_response` | Deals com tempo de resposta dos pre-vendedores (30 dias). Inclui `last_mia_at`. |
| `config_pre_vendedores` | Configuracao de pre-vendedores (user_id, user_name, pipeline_id) |
| `nekt_meta26_metas` | Metas mensais WON (fonte externa, campo `data` formato DD/MM/YYYY) |
| `squad_baserow_empreendimentos` | Regras MQL por empreendimento/campanha (fonte: Baserow). Populada por `sync-baserow-forms`. |
| `squad_baserow_forms` | Formularios do Baserow (fonte: Baserow). Populada por `sync-baserow-forms`. |
| `squad_monthly_counts` | Contagens mensais acumuladas por tab x empreendimento (rollup de squad_daily_counts). Populada pelo modo `monthly-rollup`. |
| `squad_orcamento` | Orcamento mensal global SZI. PK = `mes` (YYYY-MM). Input manual via aba Orcamento. |

## Edge Functions

### sync-squad-dashboard
ETL principal. Roda em 6 modos separados (cada um fica dentro do limite de 150MB de memoria):

| Modo | O que faz | Escrita |
|------|-----------|---------|
| `daily-open` | Busca deals abertos via `/pipelines/28/deals` | **Substitui** squad_daily_counts (source=open) |
| `daily-won` | Busca deals ganhos via `/deals?status=won&stage_id=X` por stage | **Substitui** (source=won) |
| `daily-lost` | Busca deals perdidos via `/deals?status=lost&stage_id=X` com cutoff 90d | **Substitui** (source=lost) |
| `alignment` | Deals abertos + `/users` API | Substitui squad_alignment |
| `metas` | Calculo DB-only (squad_daily_counts + nekt_meta26_metas) | Upsert squad_metas + squad_ratios |
| `monthly-rollup` | Agrega squad_daily_counts por mes (DB-only) | Upsert squad_monthly_counts |

**Sync Idempotente:** Cada modo usa coluna `source` (open/won/lost) e substitui somente suas proprias rows. PK = `(date, tab, empreendimento, source)`. Rodar qualquer modo multiplas vezes produz o mesmo resultado. API routes somam todos os sources automaticamente.

**Filtros para contagem de deals:**
- `isMarketingDeal(deal)`: campo canal = "12" (Marketing)
- `getEmpreendimento(deal)`: campo empreendimento deve estar no EMPREENDIMENTO_MAP (11 empreendimentos)
- Data por tab: MQL = `add_time`, SQL = campo qualificacao, OPP = campo reuniao, WON = `won_time`
- Janela: ultimos 35 dias

### sync-squad-presales
- Busca deals + atividades + flow (changelog) por pre-vendedor do Pipedrive
- Calcula `first_action_at` (primeira atividade done=true) e `response_time_minutes`
- **transbordo_at** = `max(ultima troca de propriedade para pre-vendedor, ultima atividade MIA)`, fallback `deal.add_time`
  - Troca de propriedade: via `/deals/{id}/flow` (field_key=user_id, new_value = pre-vendedor ID)
  - Atividade MIA: via `/deals/{id}/activities` (subject contendo "mia", sem filtro de type)
  - Salva `last_mia_at` no banco para exibicao no frontend
- REGRA: transbordo NAO e o add_time do deal — e o momento em que a MIA transferiu o lead para o pre-vendedor
- REGRA: usar a ULTIMA troca de propriedade (nao a primeira) — lida com deals que voltam de vendas para pre-vendas
- Pre-vendedores lidos de `config_pre_vendedores`
- Snapshot completo: deleta tudo e insere (30 dias lookback)

### sync-squad-meta-ads (codigo em `supabase/functions/sync-squad-meta-ads/index.ts`)
- Busca insights Meta Ads conta SZI (act_205286032338340)
- Match campaign_name contra empreendimentos (sort by name length DESC para evitar match parcial)
- Alias: "Vistas de Anita" → "Vistas de Anita II"
- Busca ACTIVE (lifetime + month) e PAUSED/CAMPAIGN_PAUSED/ADSET_PAUSED (somente month) em chamadas separadas, depois combina
- **CUIDADO:** buscar todos os status numa unica chamada lifetime causa erro 400 "numero excessivo de linhas". Separar por status resolve.
- **CUIDADO:** filtrar somente ACTIVE faz com que campanhas pausadas no meio do mes sumam do investimento total. Sempre incluir PAUSED no mes.
- Para Lead Ads usar `onsite_conversion.lead_grouped` (formularios reais). `action_type === "lead"` inclui pixel leads e infla ~3-4x
- Diagnosticos: CRITICO (CPL >2x mediana, CTR <0.5%, gasto >R$200 sem lead, freq >3.5) / ALERTA (CPL >P75, CTR <P25, CPM >2x mediana) / OPORTUNIDADE (ads OK com 2+ criterios: CPL < mediana, CTR > mediana, freq < 2.0, leads >= 10; requer leads >= 3 e spend >= 100)
- **CHECK constraint** na coluna `severidade`: deve incluir `OPORTUNIDADE` (constraint `squad_meta_ads_severidade_check`). Se adicionar nova severidade, atualizar a constraint no banco ou o insert falha silenciosamente
- Armazena `effective_status` por ad (ACTIVE ou PAUSED) no banco
- Loga unmatched_campaigns para detectar novos empreendimentos/aliases
- **Diagnostico MKT** filtra somente ads ACTIVE — campanhas pausadas nao precisam de diagnostico
- **Diagnostico MKT** tem 4 secoes: summary cards (Criticos/Alertas/Oportunidades/OK), Resumo por Emp, Top N Acao Imediata (criticos+alertas), Top 4 Oportunidades de Escala, Todos os Ads (tabela completa com sort)
- **SevDot** (campanhas-view): bolinha colorida por severidade com tooltip hover mostrando diagnosticos. Cores: vermelho=CRITICO, laranja=ALERTA, azul=OPORTUNIDADE, verde=OK

### sync-baserow-forms
- Busca dados do Baserow (api-baserow.seazone.com.br) e popula `squad_baserow_forms` e `squad_baserow_empreendimentos`
- Usado pela aba Balanceamento (regras MQL por empreendimento/fonte)
- Retorna `{ok: true, forms: N, empreendimentos: N}`

### sync-squad-calendar (codigo em `supabase/functions/sync-squad-calendar/index.ts`)
- Google Service Account com Domain-wide Delegation (scope: calendar.events.readonly)
- **Service Account:** `conta-do-ambrosi@seazone-bi-windows.iam.gserviceaccount.com` (Client ID: `100525915104498129919`)
- **Domain-wide Delegation** configurada no Google Workspace Admin Console (Security > API Controls)
- **Vault secret:** `GOOGLE_SERVICE_ACCOUNT` — JSON da SA armazenado via base64 encode para preservar `\n` da private key
- Impersona cada closer, sync eventos D-2 a D+7
- Filtra por prefixo ("Apresentação" para SZI/MKTP/SZS/Expansao/Decor; "Seazone" para Construtoras)
- Extrai empreendimento do titulo (apos "|", "&", "<>", ou " - " apos prefixo)
- Cancelamento: attendee com responseStatus=declined
- **Deploy:** `supabase functions deploy sync-squad-calendar --no-verify-jwt`
- **IMPORTANTE:** deployar com `--no-verify-jwt` — sem isso, a funcao rejeita anon key e o botao Atualizar no Vercel falha (Vercel nao tem SUPABASE_SERVICE_ROLE_KEY)
- **Sync manual alternativo:** comando Claude Code `/agenda-check-supabase` (usa Google Calendar MCP ao inves da SA)

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

## View Resultados (Funil Comercial)
- **Funil:** Leads > MQL > SQL > OPP > Reserva > Contrato > WON + Investimento
- **Leads** = leads Meta Ads (`leads_month`) + MQLs de outros canais (`max(MQL - leads_meta, 0)`)
- **MQL/SQL/OPP/WON** = `squad_daily_counts` filtrado pelo mes (open + won + lost)
- **Reserva/Contrato** = snapshots de deals nos stages 191/192 (sem filtro de data, sempre o ultimo)
- **Investimento** = `spend_month` do Meta Ads (somente gasto do mes corrente)
- **Custos:** CMQL (spend/MQL), COPP (spend/OPP), CPW (spend/WON) — todos usando dados do mes
- **Sync:** usa `["dashboard", "meta-ads"]` (precisa de ambos)

## Filtro "Todos / Midia Paga"
Toggle global no header, visivel em todas as abas (exceto Venda). `?filter=paid` nas APIs.

**Logica Paid (mesma em todas as abas):**
- MQL = `min(MQL total, leads Meta Ads)` por empreendimento
- SQL/OPP/WON = escalados proporcionalmente pelo ratio `MQL_paid / MQL_total`
- Leads = leads Meta Ads somente (sem MQLs de outros canais)

**Logica All:**
- Leads = leads Meta Ads + MQLs nao-pagos
- MQL/SQL/OPP/WON = totais do Pipedrive (todas as fontes)

**APIs que aceitam `?filter=paid`:**
- `/api/dashboard` (acompanhamento) — escala daily counts proporcionalmente
- `/api/dashboard/funil` (resultados)
- `/api/dashboard/campanhas` (campanhas + diagnostico mkt)

**Frontend:** ao trocar filtro, limpa cache (acompData, campData, funilData) e re-busca dados da aba atual.

## Meta Ads — Armadilhas Conhecidas
- `squad_meta_ads` armazena snapshots diarios **acumulados** (lifetime), NAO deltas diarios
- Campos `spend` e `leads` sao lifetime; campos `spend_month` e `leads_month` sao do mes corrente
- SEMPRE usar `spend_month`/`leads_month` para exibir dados do mes (funil, campanhas)
- Para `spend_month`/`leads_month`: buscar **TODOS os snapshots do mes** e usar o **max por ad_id** (ads removidos/pausados mantêm o gasto acumulado)
- Para campos lifetime (impressions, clicks, diagnosticos): usar o **snapshot mais recente** (`eq snapshot_date`)
- `impressions`, `clicks`, `ctr`, `cpm`, `frequency` ainda sao lifetime (Edge Function nao salva versao mensal)
- Edge Function faz 2 chamadas: `fetchAllInsights(lifetime)` + `fetchAllInsights(month)` em paralelo
- **NUNCA filtrar somente `effective_status=ACTIVE`** — campanhas pausadas no meio do mes perdem o gasto acumulado. Buscar PAUSED separadamente (somente month) e combinar
- Meta API retorna erro 400 "numero excessivo de linhas" se buscar ACTIVE+PAUSED juntos no lifetime. Separar as chamadas por status
- **CHECK constraints no banco**: `squad_meta_ads_severidade_check` limita valores validos de `severidade`. Se adicionar nova severidade na Edge Function, DEVE atualizar a constraint no banco primeiro — caso contrario o insert falha silenciosamente (Edge Function nao faz throw no erro de insert, apenas loga)
- Edge Function `applyDiagnostics` roda na ordem: CRITICO → ALERTA → OPORTUNIDADE. OPORTUNIDADE so e avaliada em ads que permaneceram OK apos todas as checagens negativas

## Pipedrive API — Armadilhas Conhecidas
- `/deals` endpoint **IGNORA** `pipeline_id` param silenciosamente — retorna TODOS os pipelines
- `/deals` endpoint **IGNORA** `stage_id` param tambem — retorna TODOS os stages. Deduplicar por `deal.id` obrigatorio
- `/deals` retorna deals de TODOS os pipelines — filtrar `deal.pipeline_id === 28` no codigo
- `/pipelines/{id}/deals` retorna **SOMENTE** deals abertos, ignora param `status`
- `/pipelines/{id}/deals` retorna `user_id` como **integer** (nao objeto como `/deals`)
- Para deals won/lost do pipeline 28: usar `/deals?status=X&stage_id=Y` com os 14 stage IDs + dedup por deal.id + filtro pipeline_id
- Pipeline 28 stage IDs: `[392, 184, 186, 338, 346, 339, 187, 340, 208, 312, 313, 311, 191, 192]`
- Pipeline 28 tem ~1300 open, ~2900 won, **58k+ lost** — lost deals PRECISAM de sort + cutoff 90d
- Limite de filters atingido — usar stage_id ao inves de criar filters
- Pipedrive domain: seazone-fd92b9.pipedrive.com

## Supabase — Notas
- Auth: Edge Functions aceitam anon key (deployadas com `--no-verify-jwt`) — **IMPORTANTE** para funcionar no Vercel que nao tem `SUPABASE_SERVICE_ROLE_KEY`
- Token Pipedrive: `vault_read_secret('PIPEDRIVE_API_TOKEN')`
- Token Meta: `vault_read_secret('META_ACCESS_TOKEN')`
- Google SA: `vault_read_secret('GOOGLE_SERVICE_ACCOUNT')` — JSON da Service Account Google
- `vault.create_secret(secret, name, description)` — 1o param e o VALOR, 2o e o NOME
- **Atualizar secret:** `SELECT vault.update_secret((SELECT id FROM vault.secrets WHERE name = 'NOME'), 'NOVO_VALOR');` — rodar no SQL Editor do Supabase Dashboard. UPDATE direto na tabela `vault.secrets` da permission denied.
- **CUIDADO Vault + JSON:** ao inserir JSON com `\n` (como private_key da SA), usar `convert_from(decode('BASE64_STRING', 'base64'), 'UTF8')` — single quotes e dollar quoting corrompem as newlines
- Edge Functions tem limite de ~150MB memoria — por isso os 5 modos separados
- `tsconfig.json` DEVE excluir `supabase/` (Deno URL imports quebram build Next.js no Vercel)

## Navegacao Header
Ordem dos botoes: `Resultados | Meta Ads ▼ | Alinhamento Squad | Acompanhamento | Pré-Venda | Ociosidade | Balanceamento | Venda`

- **Meta Ads** e um dropdown que agrupa: Campanhas, Diagnostico Mkt, Orcamento, Planejamento
- Dropdown usa `useState` + `useRef` + `useEffect` (click outside listener) em `header.tsx`
- Constante `META_ADS_VIEWS` define os 4 view keys agrupados
- Botao fica ativo (dark bg) quando `mainView` e qualquer um dos 4 valores

## Botao "Atualizar" (sync)
O botao no header chama `POST /api/sync` com `{"functions":["dashboard"]}` que executa sequencialmente:
1. `sync-squad-dashboard` mode=daily-open (~4s)
2. `sync-squad-dashboard` mode=daily-won (~8s)
3. `sync-squad-dashboard` mode=daily-lost (~23s)
4. `sync-squad-dashboard` mode=alignment (~3s)
5. `sync-squad-dashboard` mode=metas (~3s)

Depois re-busca dados da view atual. Total: ~41s.

**CUIDADO — Sync parcial:** Se o Vercel timeout matar a requisicao antes de daily-won/lost rodarem,
o daily-open ja substituiu source=open mas won/lost nao rodaram. Resultado:
dados incompletos (so deals abertos). O front mostra banner de warning quando isso acontece.

### Sync functions por tab
| View | Functions |
|------|-----------|
| Acompanhamento | `["dashboard"]` |
| Alinhamento | `["dashboard"]` |
| Campanhas | `["meta-ads"]` |
| Diagnostico Mkt | `["meta-ads"]` |
| Ociosidade | `["calendar"]` |
| Pre-Venda | `["presales"]` |
| Resultados | `["dashboard", "meta-ads"]` |
| Balanceamento | `["baserow", "meta-ads"]` |
| Planejamento | `["dashboard", "meta-ads"]` |
| Orcamento | `["meta-ads"]` |

## Orcamento — Controle de Budget
- Orcamento global SZI (um valor mensal para todos os squads)
- Input direto na tela: clicar no card "Orcamento Mensal" para editar
- Salva em `squad_orcamento` (upsert por `mes`)
- **Gasto diario**: calculado como `gasto_campanhas_ativas / dias_passados` (media real, NAO daily_budget do Meta API)
- **Projecao**: se diasPassados >= 3, usa `(gastoAtual / diasPassados) * diasNoMes`; senao usa `gastoDiario * diasNoMes`
- **Status**: ok (projecao <= 105% orcamento), alerta (<= 115%), critico (> 115%)
- Breakdown por squad e empreendimento na tabela
- NAO usa campo `daily_budget` da Meta API (retorna valores inconsistentes) — usa gasto real dividido pelos dias

## Edge Functions — Auth
- Edge Functions NAO precisam de verificacao manual de auth (isServiceRole)
- O gateway do Supabase ja valida o token Bearer antes de invocar a funcao
- Se `--no-verify-jwt` NAO estiver setado no deploy, o gateway rejeita tokens invalidos
- Verificacao manual causava 401 quando o service_role_key do Vercel diferia do ambiente Edge

## Vercel — Notas
- `maxDuration = 300` no sync route (sem isso, default e 10s e sync timeout)
- Deploy: conta do Fernando (fernandopereira-ship-it). Colaboradores precisam ser adicionados pelo owner
- Auto-deploy via push para branch main no GitHub

## Convencoes
- Idioma do codigo: ingles
- Idioma da UI: portugues brasileiro
- Commits: conventional commits (feat:, fix:, refactor:)
- Estilos: inline styles com tokens de `T` (constants.ts), NAO Tailwind nos components
- Dados sempre vem do Supabase, NUNCA do Pipedrive direto no frontend
- Squads hardcoded em `src/lib/constants.ts`
- Match de nomes (alinhamento) usa NFD normalize para ignorar acentos — Pipedrive pode ter "Patricio" sem acento vs constants com "Patrício"

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
