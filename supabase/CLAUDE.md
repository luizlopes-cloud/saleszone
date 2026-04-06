# supabase/CLAUDE.md — Tables, Edge Functions, pg_cron, Armadilhas APIs

## Tabelas Principais
| Tabela | Descricao |
|--------|-----------|
| `squad_daily_counts` | Contagens diarias por tab (mql/sql/opp/won/reserva/contrato) x empreendimento (35 dias). PK = `(date, tab, empreendimento, source)` |
| `squad_alignment` | Deals abertos por empreendimento x owner |
| `squad_metas` | Metas mensais proporcionais ao dia (meta_to_date) por squad x tab |
| `squad_ratios` | Ratios 90d MQL→SQL→OPP→WON (1 row por mes) |
| `squad_ratios_daily` | Historico diario de ratios SZI. PK = `(date, squad_id)`. JSONB: ratios, counts_90d |
| `squad_deals` | Banco centralizado de deals Pipedrive. PK = `deal_id`. Coluna gerada `is_marketing = (canal = '12')` |
| `squad_meta_ads` | Snapshot diario Meta Ads SZI. `spend`/`leads` = lifetime; `spend_month`/`leads_month` = mes. `effective_status` (ACTIVE/PAUSED) |
| `squad_calendar_events` | Eventos Google Calendar dos closers |
| `squad_presales_response` | Deals com tempo resposta pre-vendedores (30 dias) |
| `squad_orcamento` | Orcamento mensal global SZI. PK = `mes` (YYYY-MM) |
| `squad_orcamento_approved` | Budget diario aprovado por empreendimento. PK = `(mes, empreendimento)` |
| `nekt_meta26_metas` | Metas mensais WON (fonte externa). RLS ativo, SEM policy anon — usar service_role_key |
| `user_profiles` | Perfis (role operador/diretor). RLS ativado |
| `user_access_log` | Log acessos + heartbeat 3min |

## Edge Functions

### sync-squad-dashboard (ETL principal, 6 modos)
| Modo | O que faz | Escrita |
|------|-----------|---------|
| `daily-open` | Deals abertos via `/pipelines/28/deals` | Substitui squad_daily_counts (source=open) |
| `daily-won` | Deals ganhos via `/deals?status=won&stage_id=X` | Substitui (source=won) |
| `daily-lost` | Deals perdidos, cutoff 90d | Substitui (source=lost) |
| `alignment` | Deals abertos + `/users` | Substitui squad_alignment |
| `metas` | Calculo DB-only | Upsert squad_metas + squad_ratios + squad_ratios_daily |
| `monthly-rollup` | Agrega por mes (DB-only) | Upsert squad_monthly_counts |

Sync idempotente: cada modo usa coluna `source` e substitui somente suas rows.
Filtros: `isMarketingDeal` (canal="12"), `getEmpreendimento` (EMPREENDIMENTO_MAP). Datas: MQL=add_time, SQL=qualificacao, OPP=reuniao, WON=won_time.

### sync-squad-deals (4 modos)
| Modo | O que faz |
|------|-----------|
| `deals-open` | `/pipelines/28/deals` + `/users` → upsert (max_stage_order = stage_order) |
| `deals-won` | stage_id loop + dedup → upsert (max_stage_order = 14) |
| `deals-lost` | cutoff 365d, batched 5000 → upsert (flow_fetched = false) |
| `deals-flow` | Flow API para lost pendentes (500/batch) → update max_stage_order |

- **RPC:** `get_planejamento_counts(months_back, days_back)` — counts por max_stage_order thresholds (2/5/9)
- **Deploy:** `supabase functions deploy sync-squad-deals --no-verify-jwt`

### sync-squad-presales
- Calcula `transbordo_at` = max(ultima troca propriedade para PV, ultima atividade MIA), fallback add_time
- REGRA: transbordo NAO e add_time — e quando MIA transferiu o lead
- REGRA: usar ULTIMA troca de propriedade (nao primeira) — deals que voltam de vendas
- Snapshot completo: deleta tudo e insere (30 dias)

### sync-squad-meta-ads
- Conta SZI: `act_205286032338340`
- Match campaign_name contra empreendimentos (sort by name length DESC). Alias: "Vistas de Anita" → "Vistas de Anita II"
- Busca ACTIVE (lifetime + month) e PAUSED (somente month) em chamadas SEPARADAS
- Lead Ads: usar `onsite_conversion.lead_grouped` (nao `action_type=lead` que infla 3-4x)
- Diagnosticos: CRITICO → ALERTA → OPORTUNIDADE (nesta ordem)
- **CHECK constraint** `squad_meta_ads_severidade_check` — atualizar ANTES de adicionar nova severidade

### sync-squad-calendar
- Google SA com Domain-wide Delegation. Impersona cada closer, D-2 a D+7
- **Deploy:** `supabase functions deploy sync-squad-calendar --no-verify-jwt`
- **Vault secret:** `GOOGLE_SERVICE_ACCOUNT` — base64 encode para preservar `\n`

### sync-baserow-forms
- Popula `squad_baserow_forms` e `squad_baserow_empreendimentos`. Usado por Balanceamento

## pg_cron
### Dashboard (a cada 2h)
| Min | Job | Modo |
|-----|-----|------|
| :03 | 51 | daily-open |
| :05 | 52 | daily-won |
| :07 | 53 | daily-lost |
| :09 | 44 | alignment |
| :11 | 45 | metas |

### Diarios (10h UTC / 7h BRT)
47 = sync-squad-calendar, 48 = sync-squad-meta-ads

## Edge Functions — Auth
- NAO precisam de verificacao manual de auth. Gateway Supabase valida o Bearer
- Deployar com `--no-verify-jwt` — sem isso, Vercel (que nao tem service_role_key) falha

## Supabase — Armadilhas Criticas
- **LIMITE 1000 ROWS:** `.from()` e `.rpc()` retornam max 1000. DEVE paginar com `.range(offset, offset+999)`. `.limit(N)` NAO funciona em RPCs
- **`.neq()` exclui NULLs:** `.neq("campo", "valor")` exclui rows com campo NULL. Filtrar em JS: `if (d.campo === "X") continue`
- **RLS + anon key:** `nekt_meta26_metas` tem RLS sem policy anon. Usar `SUPABASE_SERVICE_ROLE_KEY`
- **Migrations fantasma:** `supabase db push` pode marcar migration como aplicada mesmo com SQL falhando. Diagnostico: testar RPCs/queries. Fix: migration de reparo com `IF NOT EXISTS`
- **RPCs inexistentes:** `get_ad_funnel_counts` e `get_ad_won_cross_emp` NAO existem. Chamada nao da throw
- **Vault:** `vault.update_secret((SELECT id FROM vault.secrets WHERE name = 'NOME'), 'NOVO_VALOR')`. UPDATE direto da permission denied
- **Vault + JSON:** usar `convert_from(decode('BASE64', 'base64'), 'UTF8')` para JSON com `\n`
- Edge Functions tem limite ~150MB memoria (motivo dos modos separados)
- `tsconfig.json` DEVE excluir `supabase/` (Deno imports quebram build Vercel)
- Tokens: `vault_read_secret('PIPEDRIVE_API_TOKEN')`, `vault_read_secret('META_ACCESS_TOKEN')`, `vault_read_secret('GOOGLE_SERVICE_ACCOUNT')`

## Pipedrive API — Armadilhas Criticas
- `/deals` IGNORA `pipeline_id` e `stage_id` silenciosamente — retorna TODOS. Filtrar no codigo + dedup por deal.id
- `/pipelines/{id}/deals` retorna SOMENTE deals abertos. `user_id` e integer (nao objeto) — buscar `/users` antes
- Pipeline 28: ~1300 open, ~2900 won, **58k+ lost** — lost PRECISA sort + cutoff
- Pipeline 28 stage IDs: `[392, 184, 186, 338, 346, 339, 187, 340, 208, 312, 313, 311, 191, 192]`
- Domain: seazone-fd92b9.pipedrive.com

## Meta Ads — Armadilhas Criticas
- NAO existe link direto ad→deal. Conexao e via empreendimento (distribuicao proporcional por spend)
- `squad_meta_ads` = snapshots diarios acumulados (lifetime), NAO deltas
- SEMPRE usar `spend_month`/`leads_month` para dados do mes
- Para spend_month: buscar TODOS os snapshots do mes e usar MAX por ad_id
- Para campos lifetime (impressions, clicks): usar snapshot mais recente
- **NUNCA filtrar so ACTIVE** — pausadas no meio do mes perdem gasto acumulado
- Meta API 400 se buscar ACTIVE+PAUSED juntos no lifetime — separar chamadas
- `applyDiagnostics`: CRITICO → ALERTA → OPORTUNIDADE (ordem importa)
