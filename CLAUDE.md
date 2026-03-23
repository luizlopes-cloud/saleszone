# Squad Dashboard

## O que e
Dashboard de acompanhamento de vendas por squads para a Seazone (Pipeline SZI).
Centraliza dados do Pipedrive, Meta Ads e Google Calendar em uma interface unificada.

- **Deploy:** Vercel (saleszone.vercel.app)
- **GitHub:** seazone-socios/saleszone
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
Vercel (saleszone.vercel.app)
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
      dashboard/planejamento/route.ts        — Conversao midia paga vs historico (?days=N filtro periodo)
      dashboard/planejamento/historico/route.ts — Historico TODAS campanhas Meta Ads (API direta)
      dashboard/orcamento/route.ts           — GET/POST orcamento mensal + gasto diario
      dashboard/performance/route.ts         — Funil por pessoa (closer, preseller, marketing) + time series
      dashboard/performance/baseline/route.ts — Cohort analysis: closers alinhados pelo mes de contratacao
      dashboard/diagnostico-vendas/route.ts  — Leadtime de follow-up por closer (deals abertos sem atividade)
      dashboard/forecast/route.ts            — Forecast: previsao de vendas do mes (pipeline aberto × conv. historica)
      dashboard/leadtime/route.ts             — Leadtime: tempo medio por etapa do funil (?days=N filtro periodo)
      dashboard/ratios/route.ts               — Historico de ratios de conversao (?days=N)
      dashboard/avaliacoes/route.ts            — Avaliação de Reuniões: notas por closer via Fireflies + Claude
      backlog/contributions/route.ts           — Contribuicoes GitHub: stats do repo filtradas por users cadastrados
  components/dashboard/
    header.tsx                               — Navegacao, usuario, botao Atualizar. Dropdown "Meta Ads" agrupa Campanhas/Diagnostico Mkt/Orcamento/Planejamento. Dropdown "Vendas" agrupa Perf. Vendas/Base-Line/Diagnostico Vendas/Ociosidade/Leadtime
    acompanhamento-view.tsx                  — Heatmap 28 dias + metas
    alinhamento-view.tsx                     — Matriz pre-venda x closer + deals desalinhados por squad
    campanhas-view.tsx                       — Summary cards Meta Ads + tabelas por squad
    diagnostico-mkt-view.tsx                 — Outliers CPL/CTR/CPM, acoes imediatas, oportunidades de escala
    ociosidade-view.tsx                      — Ocupacao closers (passado/futuro)
    balanceamento-view.tsx                   — Taxas de qualificacao por empreendimento/fonte
    resultados-view.tsx                      — Funil comercial Leads→WON + Reserva/Contrato
    presales-view.tsx                        — Performance pre-vendedores + deals recentes
    planejamento-view.tsx                    — Metricas atuais vs historicas + filtro periodo (30d/60d/90d/6m/12m/all) + Historico de Campanhas (drill-down campanha→adset→ad)
    orcamento-view.tsx                       — Budget mensal editavel, barra progresso, breakdown squad/emp
    performance-view.tsx                     — Perf. Vendas (closers + empreendimentos) + Perf. Pre-Vendas. Graficos OPP→WON com mediana e filtro de periodo
    baseline-view.tsx                        — Base-Line: cohort analysis de closers alinhados pela data de contratacao. Toggle conversao/OPP/WON, heatmap, grafico acumulado com mediana
    diagnostico-vendas-view.tsx              — Diagnostico Vendas: leadtime follow-up closers, deals sem atividade futura, atividades atrasadas
    forecast-view.tsx                        — Forecast: previsao de vendas (cards, range bar, pipeline por etapa, tabela squad/closer)
    leadtime-view.tsx                        — Leadtime: tempo medio por etapa do funil (criacao→venda), deal mais antigo por etapa, breakdown por closer
    avaliacoes-view.tsx                     — Avaliação Reuniões: nota media por closer (5 pilares), reunioes x transcricoes
    conversoes-view.tsx                      — Historico de conversoes: cards de ratios atuais + grafico SVG (abaixo do heatmap na aba Acompanhamento)
    ui.tsx                                   — Componentes reutilizaveis (MediaFilterToggle, Pill, TH, etc)
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
    sync-squad-deals/index.ts               — ETL deals centralizados Pipedrive → squad_deals (4 modos)
    sync-squad-presales/index.ts             — ETL pre-vendas (deals + atividades)
    sync-baserow-forms/index.ts              — ETL Baserow formularios → Supabase
    sync-baserow-leads/index.ts              — ETL Baserow leads → Supabase
```

## 8 Views (abas no header)
| View | Componente | API Route | Descrição |
|------|-----------|-----------|-----------|
| Campanhas (default) | campanhas-view.tsx | /api/dashboard/campanhas | Meta Ads SZI: summary, por squad, Top 10 |
| Diagnóstico Mkt | diagnostico-mkt-view.tsx | (usa campanhas) | Badges squad, resumo empreendimento, ads |
| Alinhamento Squad | alinhamento-view.tsx | /api/dashboard/alinhamento | Deals abertos × owner × empreendimento |
| Acompanhamento | acompanhamento-view.tsx | /api/dashboard?tab=X | Contagens diárias MQL/SQL/OPP/WON |
| Pré-Venda | presales-view.tsx | /api/dashboard/presales | Tempo resposta pré-vendedores |
| Ociosidade | ociosidade-view.tsx | /api/dashboard/ociosidade | Ocupação closers via Calendar |
| Balanceamento | balanceamento-view.tsx | /api/dashboard/regras-mql | Regras MQL por empreendimento/fonte |
| Venda | (em construção) | /api/dashboard/funil | Funil ponta a ponta |

## Tabelas Supabase
| Tabela | Descricao |
|--------|-----------|
| `squad_daily_counts` | Contagens diarias por tab (mql/sql/opp/won/reserva/contrato) x empreendimento (35 dias). CHECK constraint inclui todos os 6 tabs. |
| `squad_alignment` | Deals abertos por empreendimento x owner |
| `squad_metas` | Metas mensais por squad x tab (upsert month,squad_id,tab) |
| `squad_ratios` | Ratios 90d MQL→SQL→OPP→WON e contagens (1 row por mes) |
| `squad_ratios_daily` | Histórico diário de ratios de conversão. PK = `(date, squad_id)`. 4 rows/dia (global squad_id=0 + squads 1/2/3). Colunas JSONB: ratios {mql_sql, sql_opp, opp_won}, counts_90d {mql, sql, opp, won}. Populada pelo modo `metas` do sync-squad-dashboard |
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
| `squad_orcamento_log` | Log de alteracoes de orcamento. PK = `(date, empreendimento)`. Registrado quando gasto diario real = budget recomendado. Colunas: budget_recomendado, budget_real, tipo (Escalar/Manter/Otimizar/Reduzir), explicacao. |
| `user_access_log` | Log de acessos ao dashboard. Colunas: email, full_name, accessed_at, ip_address, session_id (UUID), last_heartbeat (atualizado a cada 3min). RPCs: `log_user_access(p_email, p_full_name, p_session_id)`, `update_session_heartbeat(p_session_id)`, `get_user_access_analytics()` (aggregated), `get_recent_accesses(p_limit)`. Chamado do `page.tsx` useEffect ao carregar dashboard. |
| `user_profiles` | Perfis de usuario. Colunas: id, email, full_name, role (operador/diretor), status, invited_by, created_at, updated_at. RLS ativado. |
| `user_invitations` | Convites pendentes por email. Colunas: email (unique), role, invited_by, expires_at (30 dias). RLS ativado. |
| `user_invite_links` | Links de convite compartilhaveis. Colunas: token (unique, gerado auto), role, created_by, max_uses (0=ilimitado), used_count, active, expires_at (7 dias). RLS ativado. |
| `squad_deals` | Banco centralizado de deals Pipedrive (1 row por deal). PK = `deal_id`. Colunas: status, stage_id, canal, empreendimento, is_marketing (gerada), max_stage_order (Flow API), flow_fetched, lost_reason, rd_source, last_activity_date, next_activity_date, owner_name, preseller_name. RPC `get_planejamento_counts` usa essa tabela. Filtros RPC: `is_marketing=true`, `rd_source ILIKE '%paga%'`, `lost_reason <> 'Duplicado/Erro'`. |

## Edge Functions

### sync-squad-dashboard
ETL principal. Roda em 6 modos separados (cada um fica dentro do limite de 150MB de memoria):

| Modo | O que faz | Escrita |
|------|-----------|---------|
| `daily-open` | Busca deals abertos via `/pipelines/28/deals` | **Substitui** squad_daily_counts (source=open) |
| `daily-won` | Busca deals ganhos via `/deals?status=won&stage_id=X` por stage | **Substitui** (source=won) |
| `daily-lost` | Busca deals perdidos via `/deals?status=lost&stage_id=X` com cutoff 90d | **Substitui** (source=lost) |
| `alignment` | Deals abertos + `/users` API | Substitui squad_alignment |
| `metas` | Calculo DB-only (squad_daily_counts + nekt_meta26_metas) | Upsert squad_metas + squad_ratios + squad_ratios_daily |
| `monthly-rollup` | Agrega squad_daily_counts por mes (DB-only) | Upsert squad_monthly_counts |

**Sync Idempotente:** Cada modo usa coluna `source` (open/won/lost) e substitui somente suas proprias rows. PK = `(date, tab, empreendimento, source)`. Rodar qualquer modo multiplas vezes produz o mesmo resultado. API routes somam todos os sources automaticamente.

**Filtros para contagem de deals:**
- `isMarketingDeal(deal)`: campo canal = "12" (Marketing)
- `getEmpreendimento(deal)`: campo empreendimento deve estar no EMPREENDIMENTO_MAP (11 empreendimentos)
- Data por tab: MQL = `add_time`, SQL = campo qualificacao, OPP = campo reuniao, WON = `won_time`
- Janela: ultimos 35 dias

### sync-squad-deals
Banco centralizado de deals do Pipedrive pipeline 28. Roda em 4 modos:

| Modo | O que faz | Escrita |
|------|-----------|---------|
| `deals-open` | Busca deals abertos via `/pipelines/28/deals` + `/users` para resolver owner_name | Upsert squad_deals (max_stage_order = stage_order, flow_fetched = true) |
| `deals-won` | Busca deals ganhos via stage_id loop, dedup | Upsert squad_deals (max_stage_order = 14, flow_fetched = true) |
| `deals-lost` | Busca deals perdidos, cutoff 365d, batched 5000/invocação | Upsert squad_deals (flow_fetched = false) |
| `deals-flow` | Busca Flow API para deals lost pendentes (500/batch, concurrency=20) | Update max_stage_order + flow_fetched = true |

- **Tabela:** `squad_deals` (1 row por deal, PK = deal_id)
- **Coluna gerada:** `is_marketing = (canal = '12')` — evita recheck em queries
- **max_stage_order:** open = stage_order atual, won = 14, lost = Flow API (historico de stages)
- **RPC:** `get_planejamento_counts(months_back, days_back)` — counts MQL/SQL/OPP/WON por month/empreendimento usando max_stage_order thresholds (2/5/9). Param `days_back`: 0 = default 12 meses, >0 = N dias, -1 = sem filtro de data
- **Planejamento** usa essa tabela via RPC ao inves de squad_monthly_counts
- **Deploy:** `supabase functions deploy sync-squad-deals --no-verify-jwt`

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
- **Reserva/Contrato (cards)** = snapshots de deals nos stages 191/192 (sem filtro de data, estado atual)
- **Reserva/Contrato (conversoes)** = coorte de deals fechados no mes via `squad_deals`. Conta deals por `max_stage_order`: OPP (>=9), Reserva (>=13), Contrato (>=14), WON (status=won). Exclui `lost_reason = 'Duplicado/Erro'` em JS. Filtro: `won_time >= mesInicio OR lost_time >= mesInicio`
- **IMPORTANTE:** Cards e conversoes usam fontes DIFERENTES. Card = `squad_daily_counts` (acumulado/snapshot). Conversao = `squad_deals` (coorte de fechados). NAO misturar — gera percentuais absurdos (ex: 600% quando snapshot tem 2 e WON tem 12)
- **Investimento** = `spend_month` do Meta Ads (somente gasto do mes corrente)
- **Custos:** CMQL (spend/MQL), COPP (spend/OPP), CPW (spend/WON) — todos usando dados do mes
- **Sync:** usa `["dashboard", "meta-ads", "deals"]` (precisa dos tres — deals para conversoes)

## Filtro "Todos / Midia Paga"
Toggle localizado dentro de cada view Meta Ads (Campanhas, Diagnostico Mkt). Default: **"Midia Paga"**.
Componente reutilizavel `MediaFilterToggle` em `ui.tsx`. Type `MediaFilter` centralizado em `types.ts`.

**Onde aparece:**
- Campanhas — toggle no topo, ao lado dos summary cards
- Diagnostico Mkt — toggle no topo, ao lado dos summary cards
- Orcamento / Planejamento — SEM toggle (API nao suporta filtro)
- Resultados / Acompanhamento — sempre buscam com `"all"` (sem toggle)

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

**Frontend:** ao trocar filtro, limpa campData e re-busca dados da aba atual (campanhas ou diagnostico-mkt).

## Meta Ads — Armadilhas Conhecidas
- **Atribuicao de funil por ad:** NAO existe link direto entre ad_id do Meta Ads e deal_id do Pipedrive. A conexao e indireta via **empreendimento**. Para calcular MQL/SQL/OPP/WON por ad, usar distribuicao proporcional pelo share de spend do ad dentro do empreendimento. RPCs `get_ad_funnel_counts` e `get_ad_won_cross_emp` NAO existem no banco (foram planejadas mas nunca criadas). Usar `get_planejamento_counts(-1, -1)` para historico ou `get_emp_counts_summary` para dados mensais
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
- `/pipelines/{id}/deals` retorna `user_id` como **integer** (nao objeto como `/deals`). Para resolver `owner_name`, buscar `/users` antes e mapear. `sync-squad-deals` modo `deals-open` ja faz isso
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
- **LIMITE 1000 ROWS:** Supabase retorna no maximo 1000 rows por request (queries `.from()` E `.rpc()`). Para tabelas/RPCs com mais de 1000 rows, DEVE paginar com `.range(offset, offset+999)` em loop. Exemplo: `get_historico_campanhas` retorna 1776 ads — sem paginacao, 776 ads ficam de fora silenciosamente (sem erro). `.limit(N)` NAO funciona para aumentar alem de 1000 em RPCs — usar `.range()` obrigatoriamente
- **RPCs inexistentes:** `get_ad_funnel_counts` e `get_ad_won_cross_emp` NAO existem no banco (planejadas mas nunca criadas). Chamar RPCs inexistentes nao da throw — o erro e silenciado se checado com `if (res.error) console.warn(...)`. Sempre verificar se a RPC existe nas migrations antes de usa-la
- **CUIDADO migrations fantasma:** `supabase db push` pode marcar uma migration como aplicada na tabela `supabase_migrations.schema_migrations` mesmo quando o SQL falha silenciosamente (ex: ALTER TABLE referenciando coluna inexistente em outra migration). Resultado: `db push` diz "up to date" mas as alteracoes nao existem no banco. Diagnostico: testar RPCs/queries diretamente. Fix: criar migration de reparo que re-aplica os comandos com `IF NOT EXISTS`
- **CUIDADO `.neq()` exclui NULLs:** `.neq("campo", "valor")` no Supabase/PostgREST exclui rows onde o campo e NULL. Para filtrar "campo diferente de X mas incluir NULLs", filtrar em JS: `if (d.campo === "X") continue`. Exemplo: `.neq("lost_reason", "Duplicado/Erro")` remove TODOS os deals WON porque `lost_reason` e NULL neles
- **CUIDADO RLS + anon key:** tabela `nekt_meta26_metas` tem RLS e NAO tem policy para anon. Query com anon key retorna array vazio (sem erro). Para acessar em API routes server-side, usar `SUPABASE_SERVICE_ROLE_KEY` via `createClient(url, srk)`. Exemplo: forecast route busca metas de la
- **`squad_metas` vs `nekt_meta26_metas`:** `squad_metas` armazena meta PROPORCIONAL ao dia (meta_to_date). `nekt_meta26_metas` armazena meta TOTAL do mes (won_szi_meta_pago + won_szi_meta_direto). Para forecast (previsao fim do mes), usar `nekt_meta26_metas`. Para acompanhamento diario, usar `squad_metas`

## Navegacao Header
Ordem dos botoes: `Resultados ▼ | Meta Ads ▼ | Alinhamento Squad | Pré-Venda ▼ | Vendas ▼`

- **Resultados** e um dropdown que agrupa: Funil, Acompanhamento, Forecast

- **Meta Ads** e um dropdown que agrupa: Campanhas, Diagnostico Mkt, Orcamento, Planejamento
- **Vendas** e um dropdown que agrupa: Perf. Vendas, Base-Line, Diagnostico Vendas, Ociosidade, Leadtime, Avaliação Reuniões
- Dropdowns usam `useState` + `useRef` + `useEffect` (click outside listener) em `header.tsx`
- Constantes `META_ADS_VIEWS` e `VENDAS_VIEWS` definem os view keys agrupados
- Botao fica ativo (dark bg) quando `mainView` e qualquer um dos valores do grupo

## Botao "Atualizar" (sync)
O botao sincroniza TODAS as abas de uma vez (nao so a aba atual). Usa modos **light** para evitar timeout/WORKER_LIMIT:
- `dashboard-light`: pula `daily-lost` (58k+ deals, estoura 150MB)
- `deals-light`: pula `deals-lost` e `deals-flow` (muito pesados, timeout 504)
- As funcoes pesadas rodam no **pg_cron a cada 2h**

**Concurrency Pool (max 4 workers, slowest-first):**
- Steps API ordenados por duracao estimada (presales=0 mais lento, baserow=8 mais rapido)
- Pool de 4 workers processa steps em FIFO — max 4 EFs concorrentes a qualquer momento
- Steps DB-only (metas, monthly-rollup) rodam apos pool terminar
- **Sem timeout artificial** — Vercel (300s) e Supabase (150s) sao os limites naturais
- Retry somente em HTTP 504 (delay 3s). Sem retry em timeout de cliente
- `durationMs` retornado em cada resultado para diagnostico
- Tempo total ≈ **~35-40s** (limitado pela funcao mais lenta: presales ~35s)
- **CUIDADO — Meta API rate limit:** `meta-ads` pode dar 403 se rodar proximo ao pg_cron ou apos multiplas tentativas. Rate limit reseta em ~15 min

**Timer:** botao mostra segundos decorridos durante sync: `"Atualizando... (12s)"`

**Persistencia localStorage:** `lastUpdated` (timestamp do ultimo sync) e `mainView` (aba ativa) sao salvos no `localStorage`. Ao recarregar a pagina, o dashboard restaura a aba e o horario da ultima atualizacao. Componente `DataSourceFooter` (em `ui.tsx`) renderiza `"Pipedrive · DD/MM/YYYY HH:MM"` no rodape de cada view

**Apos sync:** limpa TODOS os caches do frontend. A aba atual re-busca dados imediatamente; outras abas buscam dados frescos ao serem acessadas.

**CUIDADO — Sync parcial:** Se alguma funcao falhar, o front mostra banner de warning com detalhes.
**CUIDADO — Rate limit Pipedrive 429:** Nao rodar sync manual proximo ao horario do pg_cron (minutos :03 a :11 a cada 2h).

### Sync functions (botao Atualizar — modo light)
O botao envia: `["dashboard-light", "meta-ads", "deals-light", "calendar", "presales", "baserow"]`

| Function | Steps | O que pula vs full |
|----------|-------|-------------------|
| `dashboard-light` | daily-open, daily-won, alignment, metas, monthly-rollup | Pula `daily-lost` (58k+ deals, WORKER_LIMIT) |
| `deals-light` | deals-open, deals-won | Pula `deals-lost` e `deals-flow` (timeout 504) |
| Demais | Igual ao full | — |

### Sync functions por tab (referencia — para pg_cron)
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
| Planejamento | `["deals", "meta-ads"]` |
| Orcamento | `["meta-ads"]` |
| Diagnostico Vendas | `["deals"]` (deals-open popula last/next_activity_date + owner_name) |
| Forecast | `["deals"]` (usa squad_deals para pipeline aberto + historico conversao) |
| Leadtime | `["deals"]` (usa squad_deals para ciclo criacao→venda + deals abertos por etapa) |

## Planejamento — Filtro de Periodo
- Select no topo da view com opcoes: 30d, 60d, 90d, 6 meses, 12 meses (default), Todo historico
- Param `?days=N` na API route (`0` = 12 meses, `>0` = N dias, `-1` = sem filtro de data)
- RPC `get_planejamento_counts(months_back, days_back)` aceita ambos os params
- Meta Ads historico tambem respeita o filtro (`gte snapshot_date` com cutoff calculado)
- Ao trocar filtro, limpa `planejData` e re-busca (state `planejDays` em page.tsx)
- Filtros de deals na RPC: pipeline SZI (28), canal Marketing, rd_source contendo "paga", motivo de perda ≠ "Duplicado/Erro"

## Planejamento — Metricas de Conversao (Summary Cards)
- **IMPORTANTE:** A API retorna `current` (mes atual) e `historical` (meses anteriores no periodo). Os cards devem mostrar o **total combinado** (`current + historical`) como valor principal, nao so o mes atual
- Cards: Investimento Total, WON Total, CPW Medio, MQL→SQL, SQL→OPP, OPP→WON
- Valor principal = total do periodo selecionado (current + historical combinados via `tCombined`)
- Linha de comparacao = "Mes atual" (so o mes corrente, para referencia)
- Seta de direcao compara valor do periodo vs mes atual
- **Armadilha:** se usar so `tc` (current = mes atual) como valor principal, os numeros ficam artificialmente baixos (ex: 1 WON no mes vs 168 no periodo). Sempre combinar current + historical para o valor dos cards

## Historico de Campanhas (dentro de Planejamento)
- Secao sempre aberta na aba Planejamento, fetch automatico ao carregar
- **Busca dados via RPC** `get_historico_campanhas` — agrega snapshots de `squad_meta_ads` por ad_id (MAX spend/leads/impressions/clicks lifetime). RPC retorna ~1776 rows, DEVE ser paginada com `.range()` (limite 1000 por request)
- Funil (MQL/SQL/OPP/WON) via `get_planejamento_counts(-1, -1)` por empreendimento, distribuido proporcionalmente pelo spend share de cada ad (nao existe link direto ad→deal)
- **Status ativo/pausado:** determinado pelo snapshot mais recente — se o ad aparece no ultimo snapshot com `effective_status=ACTIVE`, e ativo. NAO usar o `effective_status` retornado pela RPC (que pega o ultimo snapshot POR AD, podendo ser de meses atras quando ja estava pausado)
- **Drill-down 3 niveis:** Campanha → Conjunto de Anuncio → Criativo (clique para expandir)
- **Filtros:** empreendimento (todos / em comercializacao / individual), status (todas / ativas / pausadas — filtra no nivel da campanha apos agregacao), colunas (Conversoes / Custos / Midia), "Somente com WON"
- Sort em todas as colunas, totais refletindo filtros
- CPL com color coding: verde = abaixo da media, vermelho = acima
- Campanhas sem match de empreendimento aparecem com empreendimento vazio

## Orcamento — Controle de Budget
- Orcamento global SZI (um valor mensal para todos os squads)
- Input direto na tela: clicar no card "Orcamento Mensal" para editar
- Salva em `squad_orcamento` (upsert por `mes`)
- **Gasto diario**: calculado como `gasto_campanhas_ativas / dias_passados` (media real, NAO daily_budget do Meta API)
- **gastoDiario = 0** quando empreendimento tem 0 campanhas ativas (gasto de campanhas pausadas nao conta como diario)
- **Projecao**: se diasPassados >= 3, usa `(gastoAtual / diasPassados) * diasNoMes`; senao usa `gastoDiario * diasNoMes`
- **Status**: ok (projecao <= 105% orcamento), alerta (<= 115%), critico (> 115%)
- Breakdown por squad e empreendimento na tabela
- NAO usa campo `daily_budget` da Meta API (retorna valores inconsistentes) — usa gasto real dividido pelos dias
- **Coluna Budget Recom.**: budget diario aprovado por empreendimento. Valores FIXOS lidos da tabela `squad_orcamento_approved` (PK = mes, empreendimento). NAO recalcula dinamicamente — so muda com aprovacao do usuario via `/gestao-orcamento`
- **CUIDADO: budget NAO e dinamico**: calculo antigo de CPW/funnel que recalculava a cada request foi REMOVIDO. Valores mudam SOMENTE com aprovacao do usuario. Motivo: valores que mudam sozinhos confundem o acompanhamento
- Tooltip com explicacao ao passar o mouse
- **Barra de projecao azul**: mostra projecao de gasto com budget recomendado (overlay azul na barra de progresso)
- **Log de Alteracoes**: registra quando gasto diario real = budget recomendado (match exato). Tabela `squad_orcamento_log` com tipo (Escalar/Manter/Otimizar/Reduzir) e explicacao
- **Skill `/gestao-orcamento`**: analise completa de distribuicao de orcamento. Propoe nova distribuicao, usuario aprova, grava na `squad_orcamento_approved`. Apos gravar, SEMPRE publicar (commit + push)

## Performance Pre-Vendas — Armadilhas Conhecidas
- **Campo Pre Vendedor(a)** do Pipedrive (field key `34a7f4f5f78e8a8d4751ddfb3cfcfb224d8ff908`, tipo user) — diferente do `owner_name` (proprietario). Salvo em `squad_deals.preseller_name`
- **Filtro de periodo**: Pipedrive "Negocio fechado em" usa `won_time`/`lost_time` (data de fechamento), NAO `add_time`. Um deal antigo fechado recentemente aparece no Pipedrive mas nao aparecia no dashboard. Corrigido: API usa `status=open OR won_time>=cutoff OR lost_time>=cutoff OR add_time>=cutoff`
- **max_stage_order para deals lost**: o `stage_order` do deal lost ja reflete o stage onde foi perdido (correto para maioria). O `deals-flow` corrige via Flow API para casos de regressao, mas e lento (200-500 deals/invocacao)
- **Normalizacao de nomes**: preseller_name no banco pode vir sem acento ("Patricio" vs "Patricio"). Usar `norm()` (NFD + remove diacritics) ao comparar
- **Atividades por tipo**: busca diretamente da API Pipedrive `/activities?user_id=X&done=1&start_date=Y&end_date=Z`. Categorias:
  - Ligacoes: call, chamada_atendida_api4com, chamada_nao_atendida_api4c
  - Mensagens: mensagem, email, whatsapp_chat, szi___*, mensagem_respondida, mensagem_nao_respondida
  - Reunioes: reuniao, meeting, no_show, reuniao_apresentacao_contr, reuniao_avaliacao
- **Paginacao Supabase**: squad_deals tem 50k+ rows. Queries com `.select()` retornam max 1000 por default. SEMPRE paginar com loop + `.range()` ou usar RPCs

## Edge Functions — Auth
- Edge Functions NAO precisam de verificacao manual de auth (isServiceRole)
- O gateway do Supabase ja valida o token Bearer antes de invocar a funcao
- Se `--no-verify-jwt` NAO estiver setado no deploy, o gateway rejeita tokens invalidos
- Verificacao manual causava 401 quando o service_role_key do Vercel diferia do ambiente Edge

## Vercel — Notas
- `maxDuration = 300` no sync route (sem isso, default e 10s e sync timeout)
- Deploy: conta do Fernando (fernandopereira-ship-it). Colaboradores precisam ser adicionados pelo owner
- Auto-deploy via push para branch main no GitHub

## Admin — Gerenciamento de Usuarios
- **Rota:** `/admin` (restrito a role `diretor`)
- **APIs:** `/api/admin/users` (profiles + invitations), `/api/admin/invite-links` (links), `/api/admin/analytics` (acessos)
- **Convite por email:** diretor preenche email+nome+papel → cria `user_invitation` → email via Edge Function → usuario faz login Google → middleware auto-cria `user_profile`
- **Convite por link:** diretor gera link → copia URL `/invite?token=X` → compartilha → usuario clica → pagina salva token em cookie → OAuth Google → middleware valida token (ativo + nao expirado + dentro do limite de usos), auto-cria `user_profile`, incrementa `used_count`, limpa cookie
- **Middleware (`src/lib/supabase/middleware.ts`):** checagem: (1) profile ativo → OK, (2) inativo → bloqueia, (3) convite email → auto-provision, (4) invite link cookie → auto-provision, (5) nada → bloqueia
- **Rota `/invite` excluida do middleware** (matcher em `src/middleware.ts`) para carregar sem auth e setar cookie
- **Analytics:** heartbeat a cada 3min (`page.tsx` useEffect). Admin mostra acessos 7d/30d, sessao media, tempo total 7d, timeline recente

## Diagnostico Vendas (Leadtime de Follow-up)
- Aba dentro do dropdown "Perf. Vendas" no header
- **API:** `/api/dashboard/diagnostico-vendas` — busca deals abertos de `squad_deals`, filtra pelos 5 closers (V_COLS)
- **Leadtime:** horas desde `last_activity_date` (ou `add_time` se null) ate agora. `last_activity_date` e DATE (sem hora), precisao ~1 dia
- **Thresholds severidade:** CRITICO >= 24h, ALERTA >= 12h, OK < 12h
- **Severidade do closer:** baseada na media do leadtime dos seus deals (mesmos thresholds)
- **Atividade futura:** `next_activity_date` do Pipedrive. Deal "sem atividade futura" = campo null. Deal "atividade atrasada" = `next_activity_date < hoje`
- **Summary cards:** Deals Abertos, Leadtime Medio, Criticos, Alertas, Sem Atividade Futura, Atividades Atrasadas
- **Ranking closers:** tabela sortavel com colunas Deals, Leadtime Medio/Max, Criticos, Alertas, OK, Sem Futura, Atrasadas, Severidade
- **Filtros deals:** Squad, Closer, Severidade, Etapa, Atividade (todas/sem futura/atrasada)
- **Deal links:** titulo clicavel abre no Pipedrive (`https://seazone-fd92b9.pipedrive.com/deal/{id}`)
- **CUIDADO owner_name:** `/pipelines/{id}/deals` retorna `user_id` como integer (nao objeto). `syncDealsOpen` busca `/users` primeiro e mapeia `user_id → name`. Sem isso, `owner_name` fica null e a aba nao mostra dados
- **Paginacao:** API route pagina com `.range()` (>1000 deals abertos possiveis)

## Forecast (Previsão de Vendas do Mês)
- Aba dentro do dropdown "Resultados" no header
- **API SZI:** `/api/dashboard/forecast` — previsão WON do mês, agrupado por squad/closer
- **API SZS:** `/api/szs/forecast` — previsão WON do mês, agrupado por **canal** (Marketing, Parceiros, Expansão, Spots, Outros)
- **Dados SZI:** `squad_deals` (filtro `is_marketing=true`, `empreendimento IS NOT NULL`)
- **Dados SZS:** `szs_deals` (todos os canais, sem filtro de canal)
- **Lógica (mesma para SZI e SZS):**
  1. **Já Ganhos:** deals WON no mês corrente (`status=won`, `won_time >= mes_inicio`)
  2. **Pipeline:** deals abertos por etapa × taxa de conversão histórica 90d por etapa
  3. **Taxa conversão por etapa:** de todos os deals que passaram pela etapa X (`max_stage_order >= X`) nos últimos 90d (filtro `add_time >= 90d`), qual % virou WON. Exclui `lost_reason = 'Duplicado/Erro'` em JS (não no Supabase, por causa do bug do `neq` com NULLs)
  4. **Leadtime por etapa:** tempo médio (média, não mediana — mais conservador) da etapa até WON. Usa deals que FECHARAM nos últimos 90d (`won_time >= 90d`, query separada). Fórmula SZI: `ciclo_total × (14 - stage_order) / 13`. SZS: `ciclo_total × (12 - stage_order) / 11`
  5. **Forecast = Já Ganhos + Pipeline**
- **Ranges:** pessimista (pipeline ×0.7), esperado (×1.0), otimista (×1.3)
- **Breakdown SZI:** por squad (expansível para closers) com meta e % meta
- **Breakdown SZS:** por canal (Marketing, Parceiros, Mônica, Expansão, Spots, Outros). Usa `ForecastSquadRow` reutilizado (canal = "squad", closers = [])
- **Metas SZI:** `nekt_meta26_metas.won_szi_meta_pago + won_szi_meta_direto` via service role key. Divide por 5 closers e distribui por squad
- **Metas SZS:** `nekt_meta26_metas` campos por canal: `won_szs_meta_pago` (Marketing), `won_szs_meta_parceiro` (Parceiros), `won_szs_meta_exp` (Expansão), `won_szs_meta_spot` (Spots), `won_szs_meta_direto` (Outros)
- **IMPORTANTE meta:** SEMPRE usar `nekt_meta26_metas` (meta TOTAL do mês). NAO usar `squad_metas`/`szs_metas` — essas tabelas armazenam meta proporcional ao dia (meta_to_date), não meta total do mês. Extrapolar meta_to_date gera valores imprecisos
- **View:** cards resumo (Já Ganhos, Pipeline, Forecast Total), range bar visual com linha de meta, tabela pipeline por etapa (com coluna Leadtime → WON), tabela squad/closer (SZI) ou canal (SZS)
- **Sync SZI:** usa `["deals"]` (depende de `squad_deals` atualizado)
- **Sync SZS:** usa `["szs-deals"]` (depende de `szs_deals` atualizado). **CUIDADO:** `szs_deals` tem ~20k+ lost deals. `deals-lost` carrega em batches de 5000. `deals-flow` processa 500/batch (~2 min cada). Precisa de múltiplas rodadas para preencher `max_stage_order` de todos os lost deals. Sem flow, conversões dos stages intermediários ficam infladas (100%)
- **CUIDADO queries de leadtime vs conversão:** conversão usa `add_time >= 90d` (deals criados no período). Leadtime usa `won_time >= 90d` (deals que fecharam no período, independente de quando foram criados). Misturar os filtros gera leadtimes artificialmente curtos porque `add_time >= 90d` só pega deals recentes com ciclos rápidos
- **CUIDADO neq + NULL:** Supabase `.neq("campo", "valor")` exclui rows onde campo é NULL. Para filtrar `lost_reason != 'Duplicado/Erro'` sem excluir NULLs, filtrar em JS com `if (d.lost_reason === "Duplicado/Erro") continue`
- **CUIDADO datas UTC:** `new Date("2026-03-01")` em BRT (UTC-3) vira 28/fev 21h. Usar `new Date("2026-03-01T12:00:00")` para exibição de mês

## Leadtime (Tempo Medio por Etapa do Funil)
- Aba dentro do dropdown "Vendas" no header
- **API:** `/api/dashboard/leadtime?days=N` — calcula tempo medio criacao→venda e breakdown por etapa
- **Dados:** usa `squad_deals` (filtro `is_marketing=true`, `empreendimento IS NOT NULL`)
- **Logica:**
  1. **Ciclo global:** `cycleDays = (won_time - add_time)` para cada deal ganho no periodo (filtro `won_time >= cutoff`). Calcula avg/median/P90
  2. **Leadtime por etapa:** estimativa proporcional ponderada — stages mais altos recebem mais tempo. Peso de cada stage = `stage_order / sum(1..max_stage_order)`. Ex: deal com max_stage_order=9, peso stage 1 = 1/45, peso stage 9 = 9/45
  3. **Deals abertos por etapa:** agrupados por `stage_order`. Encontra o deal mais antigo (menor `add_time`) em cada stage com link Pipedrive
  4. **By closer:** agrupa deals por `owner_name`. API retorna lista completa de deals (won + open) por closer com `cycleDays` (won: won_time - add_time; open: now - add_time). So inclui closers de V_COLS
- **Parametro:** `?days=N` (default 90) — periodo de analise para deals ganhos (filtro por `won_time`). Deals abertos sao sempre incluidos independente do periodo
- **View:** summary cards (Leadtime Medio, Mediana, P90, Deals Ganhos, Deals Abertos), tabela por etapa com lead mais antigo, tabela por closer (expansivel com deals). Filtro de periodo (30d/60d/90d/180d/12m)
- **Toggle Todos/Abertos:** na secao "Leadtime por Closer", toggle recalcula media/mediana/contagem. "Todos" = deals ganhos + abertos (cycleDays de cada). "Abertos" = so deals open (idade desde criacao). Metricas sao recalculadas no frontend com `computeStats()` sobre os deals filtrados
- **Deals expandiveis:** clicar no closer expande lista de deals ordenados por maior leadtime. Cada deal tem link Pipedrive, empreendimento, etapa, status (Ganho/Aberto), dias, data criacao
- **Color coding:** verde (abaixo de 80% da media filtrada), vermelho (acima de 120%). Para dias individuais: verde <30d, amarelo 30-89d, vermelho >=90d
- **Sync:** usa `["deals"]` (depende de `squad_deals` atualizado)
- **CUIDADO:** usa distribuicao proporcional ponderada para estimativa de tempo por etapa (NAO uniforme). Stages mais altos do funil (negociacao, reservas) tendem a ter mais tempo que stages iniciais

## Base-Line (Cohort Analysis de Closers)
- Aba dentro do dropdown "Perf. Vendas" no header
- **API:** `/api/dashboard/performance/baseline` — busca TODOS os deals (sem cutoff), filtra marketing + empreendimento + closers (V_COLS), agrupa por monthOffset desde contratacao
- **Data de contratacao** hardcoded em `CLOSER_HIRE_DATES` na API route (nao usa primeiro deal). Valores: Laura=2025-09, Camila=2025-07, Filipe=auto (primeiro deal), Luana=2024-03, Priscila=2025-02. Para alterar, editar o mapa na route
- **monthZero** = data de contratacao (ou primeiro deal se "auto"). Todos os offsets (M0, M1, ...) partem dessa data
- **Toggle 3 modos:** Conversao % (OPP→WON por mes), Volume OPP (acumulado), Volume WON (acumulado) — afeta tabela E grafico
- **Tabela cohort:** heatmap com color coding (verde/amarelo/laranja/vermelho para conversao, intensidade azul para volume). Coluna "vs Mediana" compara total do closer contra mediana do grupo
- **Grafico SVG:** linhas por closer (cor do squad), linha tracejada amarela (#f59e0b) = mediana. Filtro de periodo (90d/180d/12m/Tudo)
- **wonAccumulated** e **oppAccumulated** sao campos computados na API e no frontend respectivamente
- Cada closer tem comprimento de linha diferente (quem entrou depois tem menos meses)

## Graficos OPP→WON (Performance Vendas)
- Componente `OppToWonChart` em `performance-view.tsx` aceita prop `maxMonths` para filtrar pontos
- **Mediana:** linha tracejada amarela (#f59e0b) com label "Mediana X%". Aparece quando ha 2+ series (nao aparece no consolidado)
- **Periodo responsivo:** graficos agora respeitam o filtro de periodo selecionado (30d→1m, 60d→2m, 90d→3m, 180d→6m, 12m→12m, Tudo→sem corte). Antes era fixo em 12 meses
- `maxMonths=0` ou undefined = sem filtro (mostra todos os pontos)

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
- `GITHUB_TOKEN` — Token GitHub com acesso ao repo `seazone-socios/saleszone` (usado pela rota contributions)

## Comandos
```bash
npm run dev          # Dev server (porta 3000)
npm run build        # Build producao
npm run lint         # ESLint
```

## Backlog — Contribuicoes GitHub
- **API:** `/api/backlog/contributions` — busca stats do GitHub API (`/repos/{owner}/{repo}/stats/contributors`) e filtra por usuarios cadastrados em `user_profiles`
- **Repo:** `seazone-socios/saleszone` (migrado de `fernandopereira-ship-it/squad-dashboard`)
- **Matching duplo:** match primario por `github_username` (campo em `user_profiles`), fallback por email (busca email publico do GitHub via `/users/{login}` e compara com `user_profiles.email`)
- **CUIDADO — github_username vs login real:** o `github_username` cadastrado no Admin deve ser o login usado para commitar no repo. Se o usuario commita como `ambrosi-seazone` mas o Admin tem `mathambrosi`, o match direto falha. O fallback por email so funciona se o email publico no GitHub for o mesmo do perfil
- **CUIDADO — GitHub API 202:** a stats API retorna 202 enquanto computa. A rota faz retry ate 3x com delay de 2s
- **CUIDADO — cache Vercel:** a rota usa `force-dynamic` e `cache: "no-store"` no fetch, mas se os numeros parecem do repo antigo, verificar env vars na Vercel
- **Logs de diagnostico:** a rota loga `[contributions]` com Supabase URL, profiles, GitHub logins, email lookups e resultado do filtro. Ver em Vercel Function Logs
- **Usuario ativo:** `ambrosi-seazone` (matheus.ambrosi@seazone.com.br) — commits futuros sao todos com este login. Login antigo `mathambrosi` so aparece em commits historicos e depende do fallback por email

## Avaliação de Reuniões (Fireflies + Claude)
- **Aba:** Vendas → Avaliação Reuniões
- **API:** `/api/dashboard/avaliacoes?days=N` — busca eventos do calendar com transcrições e avaliações
- **Dados:** tabela `squad_calendar_events` (colunas `fireflies_id`, `transcricao`, `avaliacao` JSONB, `diagnostico`)
- **5 Pilares** (20% cada): Conhecimento do Produto, Técnicas de Venda, Rapport e Empatia, Foco no CTA, Objetividade
- **Seções da view:**
  1. **Nota Média por Closer** (principal) — header com 5 pilares + nota média. Expansível para cada reunião com justificativas, destaques e melhorias
  2. **Reuniões × Transcrições** — tabela por closer: total reuniões, válidas, inválidas (expansível com motivo)
- **Reuniões canceladas** excluídas da contagem
- **Transcrições corrompidas** (nota 0 = ASR falhou) classificadas como inválidas e excluídas da média
- **Filtro de período:** 7d / 14d / 30d / 60d / 90d
- **Tipos de invalidez:** sem gravação (Fireflies não encontrou), transcrição curta (<500 chars), transcrição corrompida (áudio ilegível), alucinação detectada
- **CUIDADO — ASR em idioma errado:** Fireflies às vezes transcreve PT como EN → gibberish. Closers mais afetados: Filipe, Priscila, Luana

## Automação Fireflies (GitHub Actions)
- **Workflow:** `.github/workflows/sync-fireflies.yml` — cron `0 8 * * *` (5h BRT)
- **Script:** `scripts/sync_fireflies.py` — busca transcripts, matching, avaliação Claude Sonnet
- **Script auxiliar:** `/tmp/eval_pending.py` — avalia transcrições pendentes (com fireflies_id mas sem avaliacao)
- **Fireflies API Key:** `97200a22-1632-4022-ae7e-8151f5a64e17` (guardar no vault do Supabase)
- **Secrets GitHub:** FIREFLIES_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY
- **Status:** Script funcional. ANTHROPIC_API_KEY pendente nos GitHub Secrets (conta `matheusalbertoambrosi@gmail.com`)
- **REGRA:** Requests (não urllib) para Fireflies API — urllib dá 403
- **REGRA:** Transcripts >35K chars = truncar antes de enviar ao Claude
- **REGRA:** Alucinações: filtrar patterns conhecidos (opusdei, amara.org, etc)
- **Matching:** email do closer + data + hora (tolerância 30min). Eventos já marcados com `fireflies_id` são pulados
- **Avaliação manual alternativa:** Pode ser feita diretamente pelo Claude Code (sem ANTHROPIC_API_KEY) usando agentes que leem as transcrições do Supabase, avaliam e gravam via curl PATCH

## Módulo SZS (Seazone Serviços) — Notas
- **Pipeline Pipedrive:** 14 (vs SZI = 28)
- **Hierarquia:** Canal Group > Cidade (vs SZI que é Squad > Empreendimento)
- **Canal Groups:** Marketing (12), Parceiros (582+583), Mônica (4551), Expansão (1748), Spots (3189), Outros (fallback)
- **Stages Pipeline 14:** Lead in (70), Contatados (71), Qualificação (72), Qualificado (345), Aguardando data (341), Agendado (73), No Show (342), Reunião Realizada (151), FUP (74), Negociação (75), Aguardando Dados (152), Contrato (76)
- **Stage mapping no funil:** "Reserva" = Aguardando Dados (stage 152), "Contrato" = Contrato (stage 76). Frontend mostra "Ag. Dados" em vez de "Reserva" quando isSZS=true
- **Conversão Ag. Dados/Contrato:** snapshot para exibição, acumulado para conversão. Acumulado = `reservaAcum = reserva + contrato + won`, `contratoAcum = contrato + won` (todo deal WON passou por ambos os stages)
- **Metas WON:** hardcoded em `SZS_METAS_WON` por mês/canal na API route (não usa nekt_meta26_metas)
- **CUIDADO paginação:** `szs_daily_counts` pode ter >1000 rows na janela de 28 dias. Routes DEVEM paginar com queries separadas (não reutilizar query builder com `.range()`). Bug corrigido em `route.ts` e `acompanhamento/route.ts`
- **Edge Function:** `sync-szs-dashboard` — deploy com `supabase functions deploy sync-szs-dashboard --no-verify-jwt`
- **pg_cron:** verificar se jobs SZS estão configurados (sync parou por 4 dias sem ser detectado)

## Heartbeats Slack — Skills e Automação
- **Skills disponíveis:**
  - `/resumo-heartbeat` — #heartbeats-szni (C06HZSR1LCF, privado)
  - `/resumo-heartbeat-mkt` — #heartbeats-marketing (C04QY0ALXAS)
  - `/resumo-heartbeat-comercial` — 4 canais comerciais (C08AE1Y6BGR, C0ANV4SP38Q, C0AN63WCQ30, C0AN85JLRL2)
  - `/resumo-heartbeat-mktp` — #heartbeats-marketplace (C0AN9SUPY5P)
  - `/resumo-heartbeat-cro` — #heartbeats-cro (C06SLRZVBTL, privado)
- **App Slack:** "Heartbeats" (bot token: xoxb-462947370822-..., bot user: U0AN8G720UA). Gera notificações push (DMs normais não notificam)
- **Automação launchd (3 jobs):**
  - `com.seazone.heartbeat-reminder` — Quinta 9h: @channel em 7 canais (exceto SZNI) lembrando de enviar heartbeat
  - `com.seazone.heartbeat-followup` — Sexta 9h: menciona individualmente quem não postou (compara membros vs quem postou desde quarta)
  - `com.seazone.weekly-heartbeat` — Sexta 18h: 5 resumos executivos enviados no DM do Ambrosi via app Heartbeats
- **Scripts:** `scripts/heartbeat_reminder.sh`, `scripts/heartbeat_followup.py`, `scripts/weekly_heartbeat.sh`
- **Plists:** `/Users/matheusambrosi/Library/LaunchAgents/com.seazone.heartbeat-*.plist`
- **CUIDADO:** launchd executa job atrasado ao ligar o Mac, mas precisa que o Mac esteja ligado para rodar no horário certo
