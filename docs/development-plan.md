# Development Plan: Correção do Dashboard SalesZone

> **Generated from:** docs/prd.md
> **Created:** 2026-04-09
> **Last synced:** 2026-04-09
> **Status:** Active Planning Document
> **VibeKanban Project ID:** [To be assigned]

## Overview

Correção de 12 bugs nas páginas de Resultados do dashboard SalesZone, abrangendo os módulos SZI, SZS e MKTP. Os problemas envolvem cálculos incorretos, filtros errados e dados faltantes.

## Tech Stack

- **Frontend:** Next.js 16, React 19, TypeScript 5, Tailwind 4
- **Backend:** Next.js API Routes
- **Database:** Supabase PostgreSQL
- **Infrastructure:** Vercel, Supabase Edge Functions

---

## Completion Status Summary

| Epic | Status | Progress |
|------|--------|----------|
| 1. Correções SZI | Not Started | 0% |
| 2. Correções SZS | Not Started | 0% |
| 3. Correções MKTP | Not Started | 0% |

---

## Epic 1: Correções SZI (NOT STARTED)

Corrigir bugs na página de Resultados do módulo SZI (Seazone Investimentos).

### Acceptance Criteria

- [ ] Gráfico "Deals por Etapa" mostra dados atuais incluindo WON, Reserva e Contrato
- [ ] Ganhos gerais SZI incluem ganho de parceiros
- [ ] Vendas diretas exclui parceiros, expansão e spot
- [ ] Ocupação da agenda calcula corretamente
- [ ] Tooltips mostram cálculo de meta
- [ ] Orçamento de campanha vem de nekt_meta26_metas
- [ ] No-show SZI mostra dados dos últimos 7 dias

### Tasks

| ID | Title | Description | Priority | Complexity | Depends On | Status |
|----|-------|-------------|----------|------------|------------|--------|
| 1.1 | Deals por Etapa — dados atuais | Gráfico não exibe dados atuais. `HIST_STAGES` em `geral/route.ts:345` só inclui mql/sql/opp. Adicionar won/reserva/contrato. | High | M | — | <!-- vk: --> |
| 1.2 | Deals por Etapa — WON/Reserva/Contrato | Estágios WON, Reserva e Contrato ausentes no gráfico. `HIST_STAGE_MIN` em `geral/route.ts:386` não tem thresholds para esses estágios. | High | M | 1.1 | <!-- vk: --> |
| 1.3 | Ganhos SZI geral — incluir parceiros | `countExcludeIndica()` em `geral/route.ts:128-152` filtra parceiros do total Geral. Total deveria somar Vendas Diretas + Parceiros. | High | S | — | <!-- vk: --> |
| 1.4 | Vendas diretas — corrigir lógica | Filtro em `geral/route.ts:202-210` só exclui `tipo_de_venda === "Parceiro"`. Falta excluir expansão e spot. | High | S | — | <!-- vk: --> |
| 1.5 | Ocupação da agenda | Cálculo em `geral/route.ts:441-462` usa `WORK_DAYS=5` hardcoded mas busca 7 dias corridos. Corrigir para contar dias úteis reais. | Medium | S | — | <!-- vk: --> |
| 1.6 | Meta no tooltip | Tooltip em `geral-view.tsx:209-224` só mostra `filterDescription`. Adicionar meta mensal, meta até a data e progresso. | Medium | M | — | <!-- vk: --> |
| 1.7 | Orçamento de campanha — nekt_meta26_metas | Em `geral/route.ts:279-286` lê de `squad_orcamento`. Trocar para `nekt_meta26_metas`. | Medium | S | — | <!-- vk: --> |
| 1.8 | No-show SZI — últimos 7 dias | API `noshow/route.ts:36-42` não filtra por setor SZI. Adicionar filtro por closers SZI e garantir dados dos últimos 7 dias. | Medium | S | — | <!-- vk: --> |

### Task Details

**1.1 - Deals por Etapa — dados atuais**
- [ ] `HIST_STAGES` em `geral/route.ts` inclui `won`, `reserva`, `contrato` além de `mql`, `sql`, `opp`
- [ ] Gráfico renderiza dados de todos os estágios para o período atual
- [ ] Dados do gráfico batem com Pipedrive

**1.2 - Deals por Etapa — WON/Reserva/Contrato**
- [ ] `HIST_STAGE_MIN` em `geral/route.ts` tem thresholds para won (stage_order 11), reserva (13), contrato (14)
- [ ] Estágios WON, Reserva e Contrato aparecem no gráfico com dados corretos
- [ ] MultiLineChart em `geral-view.tsx` renderiza as novas séries

**1.3 - Ganhos SZI geral — incluir parceiros**
- [ ] Total Geral de WON = Vendas Diretas WON + Parceiros WON
- [ ] ProgressBar de "Ganhos (WON)" na view Geral mostra valor correto
- [ ] Valor confere com soma manual no Pipedrive

**1.4 - Vendas diretas — corrigir lógica**
- [ ] Filtro de Vendas Diretas exclui deals com canal parceiros, expansão e spot
- [ ] Contagem de Vendas Diretas bate com Pipedrive (tudo que não é parceiro/expansão/spot)

**1.5 - Ocupação da agenda**
- [ ] Cálculo usa dias úteis reais na janela de 7 dias (excluindo fins de semana)
- [ ] Percentual de ocupação confere com eventos no Google Calendar

**1.6 - Meta no tooltip**
- [ ] Tooltip mostra meta mensal do estágio
- [ ] Tooltip mostra meta proporcional até a data atual (meta_to_date)
- [ ] Tooltip mostra valor real atual vs meta

**1.7 - Orçamento de campanha — nekt_meta26_metas**
- [ ] API lê orçamento de `nekt_meta26_metas` em vez de `squad_orcamento`
- [ ] Valor exibido na UI confere com dado na tabela nekt

**1.8 - No-show SZI — últimos 7 dias**
- [ ] API filtra eventos apenas de closers SZI (via `squad_closer_rules` com `setor = 'SZI'`)
- [ ] Retorna dados dos últimos 7 dias
- [ ] Contagem de no-shows confere com cancelamentos reais

---

## Epic 2: Correções SZS (NOT STARTED)

Corrigir bugs na página de Resultados do módulo SZS (Seazone Serviços).

### Acceptance Criteria

- [ ] Números de resultados SZS batem com o Pipedrive
- [ ] Vendas diretas SZS não inclui Spot Seazone
- [ ] Expansão SZS inclui Spot Seazone

### Tasks

| ID | Title | Description | Priority | Complexity | Depends On | Status |
|----|-------|-------------|----------|------------|------------|--------|
| 2.1 | Resultados SZS — números errados | Números completamente errados vs pipe. `szs/resultados/route.ts:144-156` agrega de `szs_daily_counts`. Investigar e corrigir fonte de dados. | High | L | — | <!-- vk: --> |
| 2.2 | Vendas diretas SZS — remover Spot Seazone | Em `szs/resultados/route.ts:10`, `Spots: "Vendas Diretas"` deveria ser `Spots: "Expansão"`. | High | S | — | <!-- vk: --> |
| 2.3 | Expansão SZS — incluir Spot Seazone | Mesmo fix de 2.2: mover Spots de "Vendas Diretas" para "Expansão" no `MACRO_CHANNELS`. | High | S | 2.2 | <!-- vk: --> |

### Task Details

**2.1 - Resultados SZS — números errados**
- [ ] Comparar `szs_daily_counts` com `szs_deals` para identificar divergência
- [ ] Corrigir lógica de agregação ou fonte de dados
- [ ] Números de MQL/SQL/OPP/WON batem com Pipedrive pipeline 14

**2.2 - Vendas diretas SZS — remover Spot Seazone**
- [ ] `MACRO_CHANNELS` em `szs/resultados/route.ts` mapeia `Spots` para `"Expansão"` (não mais `"Vendas Diretas"`)
- [ ] Contagem de Vendas Diretas SZS não inclui deals com canal Spots (3189)

**2.3 - Expansão SZS — incluir Spot Seazone**
- [ ] Contagem de Expansão SZS inclui deals com canal Spots (3189)
- [ ] Números de Expansão batem com Pipedrive (Expansão + Spots)

---

## Epic 3: Correções MKTP (NOT STARTED)

Corrigir bugs na página de Resultados do módulo MKTP (Marketplace).

### Acceptance Criteria

- [ ] Página de resultados MKTP exibe metas
- [ ] Ganhos MKTP calculados corretamente

### Tasks

| ID | Title | Description | Priority | Complexity | Depends On | Status |
|----|-------|-------------|----------|------------|------------|--------|
| 3.1 | MKTP — meta na página de resultados | `MKTP_RESULTADOS_METAS` em `mktp/resultados/route.ts:37-47` falta campos para meses atuais (orcamento, leads). Adicionar metas ou buscar de nekt. | High | M | — | <!-- vk: --> |
| 3.2 | MKTP — revisar ganhos | Loop em `mktp/resultados/route.ts:149-161` itera todos TABS por deal, inflando contagens. Corrigir para contar por stage thresholds. | High | M | — | <!-- vk: --> |

### Task Details

**3.1 - MKTP — meta na página de resultados**
- [ ] Metas de orcamento/leads/won definidas para o mês atual em `MKTP_RESULTADOS_METAS`
- [ ] ProgressBar de meta aparece na UI do MKTP resultados
- [ ] Valores de meta conferem com planejamento

**3.2 - MKTP — revisar ganhos**
- [ ] Contagem de WON usa `won_time` no mês atual (não itera todos os tabs por deal)
- [ ] Contagem de MQL/SQL/OPP usa date columns corretas com thresholds de `max_stage_order`
- [ ] Números do funil MKTP batem com Pipedrive pipeline 37

---

## Dependencies

- Acesso ao Pipedrive para validação manual dos dados
- Dados corretos nas tabelas Supabase (squad_*, szs_*, mktp_*)
- Tabela `nekt_meta26_metas` populada com metas e orçamento atuais

## Out of Scope

- Redesign visual ou mudança de layout
- Novas funcionalidades
- Alterações nas Edge Functions de sincronização
- Migração de tech stack

## Open Questions

- [ ] Confirmar thresholds de stage_order para WON, Reserva e Contrato no pipeline SZI
- [ ] Confirmar se `nekt_meta26_metas` tem coluna de orçamento de campanha
- [ ] Confirmar valores de meta MKTP para abril/2026
- [ ] Investigar por que `szs_daily_counts` diverge do pipe (pode ser bug na Edge Function)

## Related Documents

| Document | Purpose | Status |
|----------|---------|--------|
| docs/prd.md | Product Requirements | Current |
| CLAUDE.md | Arquitetura e convenções | Current |
| src/app/api/CLAUDE.md | Lógica de cálculo das APIs | Current |
| supabase/CLAUDE.md | Tabelas e Edge Functions | Current |

---

## Changelog

- **2026-04-09**: Plano inicial criado a partir do PRD — 13 tarefas em 3 épicos
