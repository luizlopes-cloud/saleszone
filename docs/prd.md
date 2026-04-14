# PRD: Correção do Dashboard SalesZone

> **Author:** Equipe SalesZone
> **Created:** 2026-04-09
> **Status:** Draft

## Problem Statement

O dashboard do SalesZone apresenta múltiplos bugs em cálculos, lógicas de filtro e exibição de dados nas páginas de Resultados dos módulos SZI, SZS e MKTP. Dados incorretos no dashboard comprometem a tomada de decisão dos gestores de vendas e a confiabilidade da ferramenta.

## Goals

1. Corrigir todos os cálculos e lógicas de dados incorretos nas páginas de Resultados (SZI, SZS, MKTP)
2. Garantir que os gráficos e métricas reflitam fielmente os dados do Pipedrive
3. Adicionar métricas faltantes (metas, orçamento de campanha, no-show)

## Non-Goals (Out of Scope)

- Redesign visual ou mudança de layout do dashboard
- Novas funcionalidades além das correções listadas
- Alterações nas Edge Functions de sincronização (assumindo que os dados no Supabase estão corretos)
- Migração de tech stack

## Target Users / Personas

### Persona 1: Gestor de Vendas
- **Description:** Líder de squad que acompanha métricas diárias de funil e performance
- **Needs:** Dados precisos de deals por etapa, ganhos e conversões para gestão do time
- **Pain points:** Números incorretos levam a decisões erradas e perda de confiança no dashboard

### Persona 2: Diretoria Comercial
- **Description:** Diretores que acompanham resultados consolidados de SZI, SZS e MKTP
- **Needs:** Visão geral confiável de receita, metas e performance por vertical
- **Pain points:** Ganhos errados e metas ausentes impossibilitam acompanhamento estratégico

## Functional Requirements

### FR-1: Deals por Etapa — SZI (Resultados)
- Gráfico de "Deals por Etapa" na página de resultados deve exibir dados atuais (não apenas históricos)
- Incluir deals nos estágios WON, Reserva e Contrato no gráfico

### FR-2: Ganhos SZI — Página Geral
- Corrigir cálculo de ganhos gerais de SZI
- Incluir ganho de parceiros que está faltando no total

### FR-3: Vendas Diretas — SZI
- Vendas diretas = tudo que NÃO é indicação de parceiros, expansão e spot
- Revisar e corrigir a lógica de filtro atual

### FR-4: Ocupação da Agenda
- Corrigir cálculo de ocupação da agenda dos closers
- Garantir que reflita corretamente os eventos do Google Calendar

### FR-5: Cálculo de Meta no Tooltip
- Adicionar informação de meta nos tooltips dos gráficos de resultados
- Mostrar: meta mensal, meta até a data, progresso atual

### FR-6: Orçamento de Campanha
- Buscar dados de orçamento de campanha da tabela `nekt_meta26_metas` (metas-nekt)
- Exibir na página de resultados

### FR-7: No Show SZI
- Corrigir dados de no-show de SZI que estão faltando
- Buscar dados dos últimos 7 dias

### FR-8: Resultados SZS — Números Gerais
- Corrigir números de resultados SZS que estão completamente errados em relação ao Pipedrive
- Validar cada métrica contra os dados do pipe

### FR-9: Vendas Diretas SZS
- Revisar lógica de vendas diretas de SZS
- Remover "Spot Seazone" do filtro de vendas diretas

### FR-10: Expansão SZS
- Revisar lógica de expansão de SZS
- Incluir "Spot Seazone" no filtro de expansão

### FR-11: MKTP — Meta na Página de Resultados
- Adicionar exibição de meta na página de resultados do Marketplace
- Buscar da mesma fonte de metas dos outros módulos

### FR-12: Ganhos MKTP — Página de Resultados
- Revisar e corrigir cálculo de ganhos na página de resultados do MKTP

## Non-Functional Requirements

- **Performance:** Correções não devem degradar tempo de carregamento atual
- **Confiabilidade:** Dados do dashboard devem refletir fielmente o Pipedrive (source of truth)
- **Consistência:** Mesma lógica de cálculo aplicada uniformemente entre módulos quando aplicável

## Tech Stack (Atual)

- **Frontend:** Next.js 16, React 19, TypeScript 5, Tailwind 4
- **Backend:** Next.js API Routes (server-side)
- **Database:** Supabase PostgreSQL
- **Infrastructure:** Vercel (deploy), Supabase Edge Functions (sync)
- **Integrações:** Pipedrive API, Meta Ads API, Google Calendar API, Baserow/Nekt

## Success Metrics

| Metric | Target | How Measured |
|--------|--------|--------------|
| Bugs corrigidos | 12/12 | Checklist de FRs validados |
| Dados vs Pipedrive | 100% match | Comparação manual de deals por etapa |
| Metas exibidas | Todos os módulos | Verificação visual SZI, SZS, MKTP |

## Dependencies

- Acesso ao Pipedrive para validação dos dados
- Dados corretos nas tabelas Supabase (squad_*, szs_*, mktp_*)
- Tabela `nekt_meta26_metas` populada com metas atuais

## Risks & Open Questions

| Risk/Question | Impact | Mitigation/Answer |
|---------------|--------|-------------------|
| Dados de sync no Supabase podem estar desatualizados | High | Verificar Edge Functions se dados não baterem |
| Lógica de "Spot Seazone" ambígua entre SZS e expansão | Medium | Definir regra clara com stakeholders |
| Ganho de parceiros SZI — origem do dado não confirmada | Medium | Investigar campo no Pipedrive/tabela |
| Definição exata de "vendas diretas" pode variar | Medium | Confirmar: tudo exceto parceiros + expansão + spot |

## Timeline / Milestones

| Milestone | Target Date | Description |
|-----------|-------------|-------------|
| Correções SZI | TBD | FR-1 a FR-7 (Deals, Ganhos, Vendas Diretas, Agenda, Meta, Orçamento, No Show) |
| Correções SZS | TBD | FR-8 a FR-10 (Números gerais, Vendas Diretas, Expansão) |
| Correções MKTP | TBD | FR-11 e FR-12 (Meta, Ganhos) |
| Validação final | TBD | Comparação completa dashboard vs Pipedrive |

## Related Documents

| Document | Purpose | Status |
|----------|---------|--------|
| CLAUDE.md | Arquitetura e convenções do projeto | Current |
| src/app/api/CLAUDE.md | Lógica de cálculo das API routes | Current |
| src/components/dashboard/CLAUDE.md | Documentação dos componentes | Current |
| supabase/CLAUDE.md | Tabelas e Edge Functions | Current |
