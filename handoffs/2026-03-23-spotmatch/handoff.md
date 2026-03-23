# SpotMatch — Handoff de Discovery

**Data:** 2026-03-23
**Solicitante:** Matheus Ambrosi
**Tipo:** Produto novo
**Tamanho:** G
**Prioridade:** Máxima
**Usuários:** 5 closers SZI (Laura, Camila, Filipe, Luana, Priscila)

---

## Parte A — Visão de Negócio

### Problema

Os closers da Seazone Investimentos escolhem quais unidades apresentar a cada lead com base na memória e intuição. Não há cruzamento sistemático entre o que a Seazone já sabe sobre o lead (origem, conversas, comportamento) e o estoque de unidades disponíveis. Isso resulta em reuniões menos assertivas — o closer pode mostrar unidades que não fazem sentido pro perfil do cliente.

### Proposta

**SpotMatch** — assistente de recomendação de unidades que cruza o perfil completo do lead com o estoque disponível e sugere **1 unidade principal + 2 backups**, refinando a sugestão em 3 rodadas:

1. **Preparação (antes da reunião)** — o closer busca o lead e recebe recomendações automáticas com base em tudo que a Seazone sabe
2. **Reunião (ao vivo)** — o closer faz perguntas complementares e o sistema refina em tempo real
3. **Feedback (durante apresentação)** — o cliente reage às unidades e o sistema ajusta novamente

### User Stories

**US1 — Busca e perfil do lead**
> Como closer, quero buscar um lead por email, telefone ou deal ID e ver um resumo de tudo que a Seazone sabe sobre ele, para me preparar antes da reunião.

**Critérios de aceite:**
- Busca por email, telefone ou deal ID
- Exibe dados agregados de: Pipedrive, MIA, Meta Ads, Nekt (Baserow + RD Station), LinkedIn, Instagram, email
- Mostra: campanha de origem, formulários preenchidos, conversas com MIA/pré-vendas, perfil redes sociais
- Funciona como preparação (antes) e com tela aberta (durante reunião)

**US2 — Recomendação automática (Rodada 1)**
> Como closer, quero receber 1 unidade principal + 2 backups com justificativa, baseado no perfil do lead e nas unidades disponíveis.

**Critérios de aceite:**
- Cruza perfil do lead com estoque disponível do Sapron
- Considera: preço, andar, vista, rentabilidade, metragem, posição solar, área externa
- Exibe justificativa para cada recomendação (ex: "investidor com budget de 600k que busca rentabilidade → unidade X tem melhor rentabilidade na faixa")
- Somente unidades com status disponível

**US3 — Refinamento por perguntas (Rodada 2)**
> Como closer, quero responder perguntas complementares durante a reunião e ver a recomendação se ajustar.

**Critérios de aceite:**
- Perguntas pré-definidas apresentadas na interface:
  - Já comprou imóveis? Qual modelo jurídico?
  - Imóveis investidos são para aluguel short stay?
  - Qual o orçamento considerando parcelamento de 54 meses?
  - Pretende usar? Com a família?
  - Por que busca investir? Renda passiva ou revenda?
  - Qual o fator determinante para a compra?
  - De onde é? Tem preferência por localização?
- Cada resposta refina a recomendação 1+2
- Interface conversacional (não formulário rígido)

**US4 — Refinamento por feedback (Rodada 3)**
> Como closer, quero registrar as reações do cliente às unidades apresentadas e ver novas sugestões ajustadas.

**Critérios de aceite:**
- Closer registra feedback em linguagem natural (ex: "achou caro", "quer vista mar", "gostou da planta")
- Sistema reprocessa e sugere novas 1+2 ou reordena as existentes
- Interface conversacional

**US5 — Visualização completa da unidade**
> Como closer, quero ver todos os dados de venda da unidade recomendada em uma tela, para apresentar ao cliente sem sair do sistema.

**Critérios de aceite:**
- Exibe: preço, andar, vista, rentabilidade, metragem, posição solar, área externa
- Exibe: planta, fluxo de pagamento, vista da unidade
- Referência visual: protótipo seazone360.lovable.app
- Unidades indisponíveis não aparecem

**US6 — Override do closer com feedback**
> Como closer, quero poder ignorar a recomendação e escolher outra unidade, sabendo que isso será registrado para aprendizado.

**Critérios de aceite:**
- Closer pode navegar livremente pelo estoque e escolher manualmente
- Sistema registra: unidade recomendada vs. unidade escolhida vs. resultado final (reservou ou não)
- Dados alimentam aprendizado (Fase 1) e gestão (feedback ao closer se override foi desnecessário)

### Regras de Negócio

| # | Regra |
|---|-------|
| RN1 | Somente unidades com status "disponível" no Sapron são recomendadas |
| RN2 | Qualquer closer pode vender qualquer unidade de qualquer empreendimento |
| RN3 | Recomendação sempre exibe 1 principal + 2 backups |
| RN4 | A campanha/empreendimento de origem do lead é contexto primário para a primeira recomendação |
| RN5 | Override do closer é permitido mas registrado para aprendizado e feedback |
| RN6 | Estoque deve refletir disponibilidade em tempo real (unidade vendida sai imediatamente) |

### Integrações (MVP)

| Fonte | Tipo de dado | Sistema | Acesso |
|-------|-------------|---------|--------|
| Pipedrive | Deal, histórico, atividades, campanha, owner | API REST | API token existente |
| MIA | Conversas com leads | Metabase (metabase.morada.ai) | **[PENDÊNCIA]** banco por trás, identificador do lead |
| Meta Ads | Campanha de origem, anúncios clicados, formulários | API Meta + squad_meta_ads | Existente |
| Nekt | Baserow (leads, formulários) + RD Station (conversões) | Nekt SQL | Existente |
| LinkedIn | Perfil profissional do lead | MCP LinkedIn | Disponível |
| Instagram | Perfil do lead | MCP Instagram | Disponível |
| Email | Histórico de comunicações | **[NEEDS CLARIFICATION]** qual sistema de email? |
| Sapron | Estoque de unidades disponíveis | MySQL no Google Cloud SQL | **[PENDÊNCIA]** API ou SQL direto? Tabelas/colunas? |
| seazone360 | Visualização da unidade (planta, fluxo, vista) | Lovable app | **[PENDÊNCIA]** exportar código pro GitHub |

### Outcome Mensurável

| Métrica | Baseline atual | Meta |
|---------|---------------|------|
| Conversão OPP→WON | ~20-25% (ratios 90d via `squad_ratios_daily`) | ≥35% |

**Como medir:** Acompanhar a taxa OPP→WON no dashboard saleszone (aba Acompanhamento / Performance Vendas). Comparar os 90 dias pré-SpotMatch vs. pós-SpotMatch, controlando por closer.

**Indicadores secundários:**
- Tempo médio da reunião até reserva (leadtime OPP→Reserva via aba Leadtime)
- Taxa de override do closer (SpotMatch recomendou X, closer escolheu Y — quanto menor, mais assertivo o sistema)
- Quantidade de reuniões por reserva (menos reuniões = recomendação mais assertiva)

### Appetite

**Prioridade:** Máxima — investir todo o tempo necessário. Sem limite de time-box.
**Decisão do cliente:** "Para amanhã. Todo tempo possível."

### Viabilidade

**Complexidade técnica:**
- Agregação de 8+ fontes de dados heterogêneas (APIs REST, SQL, MCPs, Metabase)
- Motor de recomendação com IA (matching perfil × unidades + refinamento conversacional)
- Interface dual: preparação (dados estáticos) + reunião ao vivo (refinamento em tempo real)
- 3 pendências técnicas que podem impactar escopo/prazo

**Riscos:**
- **Sapron sem API** → se não tiver API, precisa criar uma camada de acesso. Pode atrasar
- **MIA sem identificador claro** → se conversas não são ligadas por deal ID/email, o cruzamento fica manual ou impossível
- **Qualidade dos dados** → se dados do lead estão incompletos (ex: sem LinkedIn), a recomendação perde assertividade. Precisa de fallback gracioso
- **Atualização do estoque** → se o Sapron não reflete venda em tempo real, closer pode recomendar unidade já vendida

**Custos potenciais:**
- APIs LinkedIn/Instagram podem ter limites de uso
- Infra para o motor de recomendação (chamadas de IA por consulta)
- Possível necessidade de criar API intermediária pro Sapron

### Faseamento

#### Fase 0 — MVP

**Dados do lead (todas as fontes):**
- Pipedrive (deal, histórico, campanha de origem)
- Nekt (Baserow, RD Station)
- MIA (conversas via Metabase)
- LinkedIn e Instagram (via MCPs)
- Email (histórico de comunicações)
- Meta Ads (jornada: anúncios clicados, formulários preenchidos)

**Motor de recomendação:**
- Busca do lead por email, telefone ou deal ID
- Resumo agregado do lead (perfil, interesses, comportamento)
- Rodada 1: recomendação automática 1+2 com justificativa
- Rodada 2: perguntas complementares que refinam
- Rodada 3: feedback do cliente que refina novamente
- Visualização completa da unidade (ref. seazone360)
- Override do closer com registro

**Banco de unidades:** Sapron (somente disponíveis)

#### Fase 1 — Inteligência e escala

- Histórico de recomendações passadas (o que foi mostrado + feedback)
- Aprendizado com vendas fechadas (quais combinações lead × unidade converteram)
- Feedback ao closer quando override foi desnecessário
- Sugestão proativa antes da reunião (integração Google Calendar)
- Dashboard de uso e taxa de acerto das recomendações

### Validação

**Sucesso:** O cliente sai da reunião com unidade escolhida, fluxo de pagamento aprovado, reserva feita e informações para partir pro contrato.

**Fracasso:** A reunião não gera reserva.

**Caminhos felizes:**
1. Closer busca lead → vê perfil completo → recebe recomendação assertiva → mostra na reunião → cliente escolhe → reserva
2. Primeira recomendação não agrada → closer faz perguntas → sistema refina → cliente gosta → reserva
3. Cliente dá feedback negativo → sistema ajusta → nova recomendação acerta → reserva

**Caminhos tristes:**
1. Lead não tem dados suficientes em nenhuma fonte → recomendação genérica (fallback por orçamento + localização)
2. Unidade recomendada vendida entre a preparação e a reunião → sistema precisa atualizar em tempo real
3. Closer faz override → escolhe errado → não converte → sistema registra para aprendizado
4. MIA não tem conversa com esse lead → sistema segue sem esse dado

---

## Parte B — Spec Técnica para Dev

### Pendências técnicas (BLOQUEAR antes de iniciar desenvolvimento)

| # | Pendência | Quem resolver | Impacto |
|---|-----------|---------------|---------|
| P1 | Sapron: tem API ou só SQL direto? Quais tabelas/colunas de unidades? | Equipe dev | Arquitetura de integração |
| P2 | Metabase MIA: qual banco por trás? Acesso direto possível? Identificador de ligação lead↔conversa (deal ID? email? telefone?) | Equipe dev | Viabilidade do cruzamento de dados MIA |
| P3 | Lovable seazone360: exportar código pro repo seazone-socios (instalar Lovable GitHub App na org) | Equipe dev / admin GitHub | Referência visual e funcional para tela de unidade |
| P4 | Email: qual sistema é usado para comunicação com leads? Tem API? | Equipe dev | Integração de histórico de emails |

### Contexto do codebase existente

O dashboard saleszone já tem integrações com:
- **Pipedrive API** (deals, atividades, users, stages) — token em vault Supabase
- **Meta Ads API** (campanhas, ads, insights) — token em vault Supabase
- **Google Calendar API** (eventos closers) — Service Account com Domain-wide Delegation
- **Nekt** (via MCP tools — `execute_sql`, `get_relevant_tables_ddl`, `list_tables`)
- **Supabase** (PostgreSQL — tabelas squad_*, auth, RLS)
- **Baserow** (via Edge Function sync-baserow-forms)

Closers já cadastrados em `src/lib/constants.ts` (V_COLS com squad, email, prefixo).

### Arquitetura sugerida (pendente validação do gerente técnico)

```
Lead Input (email/telefone/deal_id)
    |
    v
Agregador de Dados (paralelo)
    ├── Pipedrive API → deal, histórico, campanha
    ├── Nekt SQL → Baserow + RD Station
    ├── Metabase/banco MIA → conversas [PENDÊNCIA P2]
    ├── Meta Ads → jornada de anúncios
    ├── MCPs → LinkedIn, Instagram
    └── Email API [PENDÊNCIA P4]
    |
    v
Perfil Unificado do Lead
    |
    v
Motor de Recomendação (IA)
    ├── Input: perfil do lead + estoque Sapron [PENDÊNCIA P1]
    ├── Output: 1 principal + 2 backups + justificativa
    ├── Rodada 2: + respostas das perguntas → re-rank
    └── Rodada 3: + feedback do cliente → re-rank
    |
    v
Interface do Closer
    ├── Busca do lead
    ├── Resumo do perfil
    ├── Recomendações com justificativa
    ├── Perguntas complementares (conversacional)
    ├── Feedback do cliente (conversacional)
    ├── Visualização da unidade [ref. seazone360, PENDÊNCIA P3]
    └── Override com registro
```

### Integrações técnicas

| Fonte | Endpoint/Acesso | Autenticação | Notas |
|-------|----------------|--------------|-------|
| Pipedrive | `api.pipedrive.com/v1/deals/{id}`, `/activities`, `/persons/search` | API token (vault) | Pipeline 28, busca por email/telefone via `/persons/search` |
| Nekt | MCP tools: `execute_sql`, `get_relevant_tables_ddl` | Sessão MCP | Dados Baserow + RD Station já integrados |
| MIA | `metabase.morada.ai/question/1428-mensagens-seazone` | **[PENDÊNCIA]** | Filtros: `mensagem_enviada_em`, `id_conversa` |
| Meta Ads | `squad_meta_ads` (Supabase) ou Meta API direta | Token (vault) | Campanha de origem via campaign_name match |
| LinkedIn | MCP LinkedIn | Sessão MCP | Busca por nome/email do lead |
| Instagram | MCP Instagram | Sessão MCP | Busca por nome/email do lead |
| Sapron | MySQL Cloud SQL `investimento-mysql` (GCP `seazone-investimentos`) | **[PENDÊNCIA]** | Unidades com disponibilidade, preço, andar, vista, etc |
| seazone360 | Lovable app | **[PENDÊNCIA]** | Planta, fluxo pagamento, vista |

### Rabbit Holes — Armadilhas Técnicas

O dev DEVE conhecer estas armadilhas antes de começar:

| # | Armadilha | Por que é perigosa | Como evitar |
|---|-----------|-------------------|-------------|
| RH1 | Pipedrive `/deals` **ignora** `pipeline_id` e `stage_id` silenciosamente | Retorna deals de TODOS os pipelines — dados poluídos | Sempre filtrar `deal.pipeline_id === 28` em código após fetch |
| RH2 | `/pipelines/{id}/deals` retorna `user_id` como **integer**, não objeto | Código esperando objeto quebra silenciosamente | Buscar `/users` primeiro e mapear `user_id → name` |
| RH3 | Pipeline 28 tem **58k+ lost deals** | Carregar tudo estoura memória (150MB limite Edge Functions) | Usar cutoff de 90-365 dias + batching (5000/batch) |
| RH4 | Supabase retorna **máx 1000 rows** sem erro | Dados silenciosamente truncados — acha que pegou tudo | Paginar com `.range(offset, offset+999)` em loop |
| RH5 | `.neq("lost_reason", "Duplicado/Erro")` **exclui NULLs** | Remove TODOS os deals WON (lost_reason é NULL neles) | Filtrar em JS: `if (d.lost_reason === "Duplicado/Erro") continue` |
| RH6 | `new Date("2026-03-01")` em BRT vira **28/fev 21h** | Filtros de data ficam off-by-one | Usar `new Date("2026-03-01T12:00:00")` |
| RH7 | Tabelas com RLS + anon key retornam **array vazio sem erro** | `nekt_meta26_metas` com anon key = zero dados | Usar `SUPABASE_SERVICE_ROLE_KEY` para tabelas com RLS |
| RH8 | Vault secrets com JSON e `\n` na private key | Auth falha silenciosamente se newlines corrompidas | Armazenar como base64: `convert_from(decode(...), 'UTF8')` |
| RH9 | Nomes com acento: Pipedrive "Patricio" vs constants "Patrício" | Match de nomes retorna 0 resultados | NFD normalize: `name.normalize("NFD").replace(/[\u0300-\u036f]/g, "")` |
| RH10 | RPCs inexistentes no Supabase **não dão erro** | Resultado silenciosamente vazio, difícil de debugar | Verificar se a RPC existe nas migrations antes de chamar |

### Boundaries — O que NÃO alterar

**Tabelas protegidas (somente leitura para SpotMatch):**
- `squad_*`, `szs_*`, `mktp_*` — NÃO modificar schema (colunas, PKs, constraints)
- `config_pre_vendedores` — configuração de pré-vendedores, somente leitura
- `nekt_meta26_metas` — metas mensais externas, RLS protegida
- `user_profiles`, `user_invitations`, `user_invite_links` — auth/acesso

**Constants imutáveis (`src/lib/constants.ts`):**
- `SQUADS`, `V_COLS`, `PV_COLS`, `SQUAD_V_MAP` — estrutura organizacional
- `EMPREENDIMENTO_MAP` — 11 empreendimentos SZI
- `T` (tokens de UI) — todas as cores, fontes, sombras

**Padrões obrigatórios:**
- Auth: domínio `@seazone.com.br` obrigatório (middleware)
- Estilos: inline com tokens `T`, **NÃO usar Tailwind**
- Código em inglês, UI em português
- Commits: conventional commits (`feat:`, `fix:`, `refactor:`)
- Edge Functions: Deno, vault secrets, deploy com `--no-verify-jwt`
- Tokens/secrets: NUNCA em código — usar vault Supabase ou `.env.local`

**SpotMatch PODE:**
- Criar tabelas novas com prefixo `spotmatch_*`
- Criar API routes em `/api/spotmatch/*`
- Criar Edge Functions novas (`sync-spotmatch-*`)
- Ler de qualquer tabela existente
- Criar RPCs e views que leem de tabelas existentes

### Regras SE/ENTÃO para recomendação

| # | Regra |
|---|-------|
| 1 | SE lead veio de campanha de empreendimento X → PRIORIZAR unidades de X |
| 2 | SE lead respondeu orçamento nas perguntas → FILTRAR unidades na faixa (±20%) |
| 3 | SE lead busca renda passiva → PRIORIZAR por rentabilidade projetada |
| 4 | SE lead busca revenda → PRIORIZAR por valorização/localização |
| 5 | SE lead pretende usar com família → PRIORIZAR metragem maior e área externa |
| 6 | SE lead é de outra cidade → DESCARTAR preferência de localização do perfil, usar perguntas |
| 7 | SE lead deu feedback "caro" → REDUZIR faixa de preço em 20% |
| 8 | SE lead deu feedback "quero vista mar" → FILTRAR somente unidades com vista mar |
| 9 | SE lead não tem dados suficientes → FALLBACK: recomendar por orçamento + localização de interesse |
| 10 | SE closer faz override → REGISTRAR: unidade sugerida, unidade escolhida, resultado final |

### Testes com dados de exemplo

**Lead exemplo:**
- Deal ID: 12345 (Pipedrive pipeline 28)
- Veio de campanha Meta Ads "Jurerê III"
- Conversou com MIA: mencionou "investimento", "budget 500k"
- LinkedIn: CEO de empresa de tecnologia em SP
- Formulário RD: marcou "renda passiva"

**Resultado esperado Rodada 1:**
- Principal: unidade do Jurerê III, faixa ~500k, boa rentabilidade
- Backup 1: outra unidade Jurerê III, faixa diferente
- Backup 2: unidade de outro empreendimento com perfil similar

**Rodada 2 (perguntas):**
- "Já comprou imóveis?" → "Sim, 2 apartamentos em SP"
- "Orçamento com parcelamento 54m?" → "Até 600k"
- "Pretende usar?" → "Não, puramente investimento"
- → Sistema ajusta: prioriza rentabilidade sobre metragem/conforto, amplia faixa até 600k

**Rodada 3 (feedback):**
- "A unidade principal é boa mas quero andar mais alto"
- → Sistema filtra andares superiores, mantém demais critérios

### Task Breakdown (Fase 0 — MVP)

**Task 1: Criar schema SpotMatch no Supabase**
- Criar migration: `supabase/migrations/YYYYMMDD_create_spotmatch_tables.sql`
- Tabelas: `spotmatch_sessions` (PK session_id, deal_id, closer_email, created_at), `spotmatch_recommendations` (session_id, rodada, unidade_id, rank, justificativa, escolhida boolean), `spotmatch_feedback` (session_id, rodada, tipo, conteudo)
- RLS: anon read, service write (mesmo padrão das squad_*)
- Dependência: nenhuma

**Task 2: API de busca do lead — Pipedrive**
- Criar: `src/app/api/spotmatch/lead/route.ts`
- Input: `?q=email|telefone|deal_id`
- Buscar via Pipedrive `/persons/search` (email/telefone) ou `/deals/{id}` (deal_id)
- Retornar: deal, person, campanha de origem, atividades recentes, owner
- Pattern: ver `src/app/api/dashboard/diagnostico-vendas/route.ts` (já busca deals + atividades)
- Dependência: nenhuma

**Task 3: API de busca do lead — Nekt (Baserow + RD Station)**
- Criar: `src/app/api/spotmatch/lead/nekt/route.ts`
- Usar MCP Nekt (`execute_sql`) para buscar dados do lead por email/telefone
- Retornar: formulários preenchidos, conversões RD, dados Baserow
- Pattern: ver Edge Function `sync-baserow-forms` (já integra com Baserow)
- Dependência: nenhuma

**Task 4: API de busca do lead — Meta Ads (jornada)**
- Criar: `src/app/api/spotmatch/lead/meta/route.ts`
- Buscar campanha de origem do deal (campo `empreendimento` no Pipedrive → match com `squad_meta_ads.campaign_name`)
- Retornar: campanha, conjunto de anúncio, criativo, CPL do empreendimento
- Pattern: ver `src/app/api/dashboard/campanhas/route.ts` (já agrega Meta Ads por empreendimento)
- Dependência: Task 2 (precisa do empreendimento do deal)

**Task 5: API de estoque de unidades — Sapron**
- Criar: `src/app/api/spotmatch/units/route.ts`
- **[PENDÊNCIA P1]** — Definir acesso ao Sapron (API ou SQL direto)
- Retornar: unidades disponíveis com preço, andar, vista, rentabilidade, metragem, posição solar, área externa
- Dependência: resolução da pendência P1

**Task 6: Motor de recomendação (IA)**
- Criar: `src/app/api/spotmatch/recommend/route.ts`
- Input: perfil unificado do lead (Tasks 2-4) + estoque (Task 5) + rodada + contexto anterior
- Usar Claude API para matching perfil × unidades com regras SE/ENTÃO
- Output: 1 principal + 2 backups com justificativa
- Suportar 3 rodadas (initial → perguntas → feedback) via campo `rodada` + `contexto_anterior`
- Dependência: Tasks 2-5

**Task 7: Frontend — Tela de busca e perfil do lead**
- Criar: `src/components/spotmatch/search-view.tsx`
- Campo de busca (email/telefone/deal ID) com autocomplete
- Card de perfil unificado (dados agregados de todas as fontes)
- Estilos: inline com tokens `T` de `constants.ts`
- Dependência: Tasks 2-4

**Task 8: Frontend — Tela de recomendações**
- Criar: `src/components/spotmatch/recommend-view.tsx`
- Cards das 3 unidades (1 principal + 2 backups) com justificativa
- Botões de ação: "Apresentar", "Override", "Nova rodada"
- Perguntas complementares (Rodada 2) como cards clicáveis
- Input de feedback (Rodada 3) em texto livre
- Dependência: Tasks 6-7

**Task 9: Frontend — Visualização da unidade**
- Criar: `src/components/spotmatch/unit-view.tsx`
- Exibir: preço, andar, vista, rentabilidade, metragem, posição solar, área externa
- Exibir: planta, fluxo de pagamento (quando disponível)
- **[PENDÊNCIA P3]** — referência visual do seazone360.lovable.app
- Dependência: Task 5

**Task 10: Frontend — Registro de override e resultado**
- Criar: `src/components/spotmatch/override-view.tsx`
- Permitir navegar pelo estoque e escolher manualmente
- Registrar: unidade sugerida vs. escolhida vs. resultado (reservou/não)
- Salvar em `spotmatch_recommendations` e `spotmatch_feedback`
- Dependência: Tasks 8-9

### Checklist de Verificação

Antes de considerar o MVP pronto, rodar:

- [ ] `npm run build` — sem erros de TypeScript
- [ ] `npm run lint` — sem warnings
- [ ] Buscar lead por email → retorna perfil completo (Pipedrive + Nekt + Meta Ads)
- [ ] Buscar lead por deal ID → mesmo resultado
- [ ] Buscar lead sem dados → fallback gracioso (mostra o que tem, sem crash)
- [ ] Recomendação Rodada 1 → retorna 1+2 com justificativa
- [ ] Rodada 2 (perguntas) → recomendação muda coerentemente
- [ ] Rodada 3 (feedback "caro") → preço reduz
- [ ] Override → registro salvo em `spotmatch_recommendations`
- [ ] Unidade vendida não aparece nas recomendações
- [ ] Auth: acesso restrito a @seazone.com.br
- [ ] Paginação: se estoque tem >1000 unidades, todas aparecem
- [ ] Mobile: tela funciona em tablet (closers usam na reunião)

### Referências

- **Metabase MIA:** https://metabase.morada.ai/question/1428-mensagens-seazone
- **Sapron (GCP Console):** https://console.cloud.google.com/sql/instances/investimento-mysql/insights/executed?project=seazone-investimentos
- **Protótipo visual:** https://seazone360.lovable.app/ (link edição Lovable: https://lovable.dev/projects/e52fbbe6-0e52-423f-81aa-c66e1f3223db)
- **Closers SZI:** Laura (Squad 1), Camila e Filipe (Squad 2), Luana e Priscila (Squad 3) — definidos em `src/lib/constants.ts`
