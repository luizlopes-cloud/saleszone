# CTWA Should Be — Integrações e Automações (Fase B)

**Data:** 2026-04-09
**Status:** Spec aprovada
**Referência:** `2026-04-07-processo-click-to-whatsapp-design.md` (Fase A — processo as-is/should-be)
**Escopo:** Mapeamento técnico das integrações e automações necessárias para implementar o processo should-be do Click to WhatsApp (Vendas Spot).

---

## Contexto

A Fase A documentou o processo as-is e should-be. A principal mudança é:

- **As-Is:** Deal criado imediatamente no Pipedrive → pipeline inflado com contatos não qualificados
- **Should Be:** Lead criado → qualificação → MQL → só vira Deal quando recebe proposta de agenda

Este documento mapeia as integrações e automações necessárias para implementar essa mudança.

---

## Arquitetura: Mínima Dependência da Morada

**Princípio:** a Morada/MIA faz apenas duas coisas — **conversar** e **preencher campos no Lead do Pipedrive**. Toda a lógica de negócio (MQL, conversão Lead→Deal, Lost, transbordo) é executada por uma **Edge Function nossa** (saleszone) que reage a webhooks do Pipedrive.

```
MIA (conversa + preenche campos no Lead)
  → Pipedrive Lead atualizado
  → Webhook Pipedrive dispara
  → Supabase Edge Function (saleszone)
  → Executa lógica de negócio (MQL, convert Deal, Lost, transbordo, Calendar)
```

**Benefícios:**
- Se trocar de chatbot, basta o novo preencher os mesmos campos
- Lógica de negócio é testável e versionada no nosso repo
- Morada não precisa saber de Pipedrive Leads API, Google Calendar, etc.

---

## Fluxo Should Be (Swimlanes para Miro)

### Raias

| Raia | Cor Miro | Ator |
|------|----------|------|
| Lead/Cliente | Azul claro | Prospect |
| MIA (IA) | Roxo | Bot WhatsApp (Morada.ai) — só conversa e preenche campos |
| Edge Function | Azul escuro | Automação saleszone (reage a webhooks) |
| Pré-Vendedor | Amarelo | Humano (SDR/PV) |
| Pipedrive | Verde | CRM (sistema) |

### Fluxo

```
RAIA: Lead/Cliente
  (Start) → [Envia mensagem via WhatsApp]
        |
        v
RAIA: MIA
  [Identifica empreendimento (metadados da campanha)]
        |
        v
RAIA: Edge Function (webhook: lead criado)
  [Cria LEAD no Pipedrive Leads Inbox]
        |
        v
RAIA: MIA
  [Conduz 3 perguntas de qualificação]
  [Preenche campos: forma_pagamento, valor_investimento, intencao]
        |
        v
  <MIA consegue qualificar?>
   |          |
  Sim        Não (cadência esgotada)
   |          |
   |          v
   |   [MIA preenche: Etapa final - cadência = "Lost"]
   |          |
   |          v
   |   RAIA: Edge Function (webhook: Etapa final = Lost)
   |   [Arquiva Lead → Lost: Sem resposta] → (End X)
   |
   v
  <Qualificado?>
   |    |
  Sim  Não
   |    |
   |    v
   |   [MIA preenche: Etapa final - cadência = "Lost"
   |    + Motivo de Lost [MIA] = motivo]
   |          |
   |          v
   |   RAIA: Edge Function (webhook: Etapa final = Lost)
   |   [Arquiva Lead → Lost: Não qualificado]
   |         |
   |         v
   |   (Nutrição futura) → (End X)
   |
   v
  [MIA preenche: Data de Qualificação = hoje]
        |
        v
RAIA: Edge Function (webhook: Data de Qualificação preenchida)
  [Atualiza label do Lead → "MQL"]
        |
        v
RAIA: MIA
  [Propõe agenda ao lead]
        |
        v
  <MIA consegue agendar?>
   |              |
  Sim            Não
   |              |
   |   [MIA preenche: Etapa final - cadência = "Transbordo"]
   |              |
   |              v
   |   RAIA: Edge Function (webhook: Etapa final = Transbordo)
   |   [Assign Pré Vendedor(a) ao Lead]
   |              |
   |              v
   |     RAIA: Pré-Vendedor
   |     [PV assume com histórico da conversa]
   |              |
   |              v
   |     [PV agenda manualmente]
   |              |
  Sim            Sim
   |              |
   v              v
  [MIA/PV preenche: Status Reunião = "Confirmada"
   + Data da Reunião [MIA] + Hora da Reunião [MIA]]
        |
        v
RAIA: Edge Function (webhook: Status Reunião = Confirmada)
  [1. Cria evento no Google Calendar (agendamentos@seazone.com.br)]
  [2. Converte Lead → Deal (pipeline Vendas Spot, ID 28)]
        |
        v
       (End - Sucesso)
```

### Legenda

| Elemento | Significado |
|----------|-------------|
| Tarefa verde | Caminho de sucesso |
| Tarefa vermelha | Lost (exceção) |
| Losango amarelo | Gateway — decisão/desvio |
| Lane roxa | MIA (IA) — só conversa e preenche campos |
| Lane azul escuro | Edge Function — executa lógica de negócio |
| Lane amarela | Pré-Vendedor |
| Lane verde | Pipedrive |

---

## Campos do Pipedrive (já existem)

Nenhum campo novo precisa ser criado. A MIA já preenche estes campos hoje — a diferença é que agora ela preenche em um **Lead** (não Deal), e a Edge Function reage.

### Campos de Qualificação (MIA preenche durante conversa)

| Campo | Key | Tipo | Uso |
|-------|-----|------|-----|
| Qual a forma de pagamento? | `977b711b69cf4efd9f5221bf17600b7e23b94256` | enum | Q1 |
| Qual o valor total que pretende investir? | `55bb0bbb3ffd7ac235c453d8c237fa2edcf6fb44` | enum | Q2 |
| Você procura investimento ou uso próprio? | `f9b23753a78ed314d9ad42f51a9dd02da0b8c751` | enum | Q3 |
| Empreendimento | `6d565fd4fce66c16da078f520a685fa2fa038272` | enum | Via metadados campanha |
| Data de Qualificação | `bc74bcc4326527cbeb331d1697d4c8812d68506e` | date | **Trigger → MQL** |

### Campos de Agendamento (MIA preenche quando agenda)

| Campo | Key | Tipo | Uso |
|-------|-----|------|-----|
| Data da Reunião [MIA] | `7d1c61f8b0ff7adb622a5fe24a923d4491e16001` | varchar | Data proposta |
| Hora da Reunião [MIA] | `06ae369dd850925f3ae29678619ac0cdbf265d24` | varchar | Hora proposta |
| Status Reunião | `658f16abb8e4d9ca1c4426664a48e9a82c390bb5` | enum | **Trigger → Convert Deal** |

### Campos de Cadência/Estado (MIA preenche conforme fluxo)

| Campo | Key | Tipo | Uso |
|-------|-----|------|-----|
| Etapa de Conversão | `baf019ccd4c4c4032c5a821b5a24265f3243c3b5` | enum | Tracking cadência |
| Etapa final - cadência | `3fc8446ad245714794555cd9dcc9311409cdece2` | enum | **Trigger → Lost ou Transbordo** |
| Motivo de Lost [MIA] | `bf0e5193f43a49b36990c4ea88c91e01d0858592` | set | Motivo do lost |
| Respondeu MIA | `34336364766f24e1b2fdb25beec9c87856f3ade3` | varchar | Se respondeu |
| step_cadencia | `90db11111ad88f60a3346d04df252660832285ec` | double | Step atual |
| data_ultima_cadencia | `85b830218feefa6ab8f7186f053a2d84b1b0bd2e` | date | Data último contato |

### Campos de Contexto

| Campo | Key | Tipo | Uso |
|-------|-----|------|-----|
| Pré Vendedor(a) | `34a7f4f5f78e8a8d4751ddfb3cfcfb224d8ff908` | user | Assign no transbordo |
| Link da Conversa | `3dda4dab1781dcfd8839a5fd6c0b7d5e7acfbcfc` | varchar | Link Morada |
| Link da Reunião | `3d168fb538411d700912d494cb3ae7d813e2976b` | varchar | Link Google Meet |
| [RD] Source | `ff53f6910138fa1d8969b686acb4b1336d50c9bd` | varchar | "Click to WhatsApp" |
| leadgen_id | `5c2b5585058df45ab36ce6a66eff9dd3dafc63c9` | varchar | ID Meta Ads |
| Erro Morada | `805611c38d6e3670376fb93d19027ef62da41f97` | varchar | Erros da MIA |

---

## Edge Function: Webhook Handler

### Triggers e Ações

| # | Webhook Trigger | Condição | Ação | API Pipedrive |
|---|---|---|---|---|
| 1 | Lead updated | `Data de Qualificação` preenchida | Atualiza label do Lead → "MQL" | `PATCH /leads/{id}` (label_ids) |
| 2 | Lead updated | `Etapa final - cadência` = **Lost** | Arquiva Lead (motivo do campo `Motivo de Lost [MIA]`) | `PATCH /leads/{id}` (is_archived: true) |
| 3 | Lead updated | `Etapa final - cadência` = **Transbordo** | Assign owner ao PV (campo `Pré Vendedor(a)`) | `PATCH /leads/{id}` (owner_id) |
| 4 | Lead updated | `Status Reunião` = **Confirmada** | 1. Cria evento Google Calendar 2. Converte Lead → Deal (pipeline 28) | Google Calendar API + `POST /v2/leads/{id}/convert/deal` |

### Dados para criação do evento Calendar (trigger 4)

| Campo do evento | Fonte |
|---|---|
| Título | "Apresentação Seazone \| {Empreendimento}" |
| Data/Hora | `Data da Reunião [MIA]` + `Hora da Reunião [MIA]` |
| Calendário | agendamentos@seazone.com.br |
| Descrição | "Agendamento marcado pela Inteligência Artificial da Seazone" |
| Participante | Email/telefone do lead (person) |

---

## Responsabilidades por Ator

### MIA (Morada) — mínimo necessário

1. Receber mensagem WhatsApp (CTWA)
2. Conversar: identificar empreendimento, fazer 3 perguntas, propor agenda
3. Preencher campos no Lead do Pipedrive via API

**NÃO faz mais:**
- ~~Criar Deal~~ → cria Lead
- ~~Marcar Lost~~ → preenche `Etapa final - cadência`, Edge Function arquiva
- ~~Converter Lead → Deal~~ → Edge Function faz
- ~~Criar evento Calendar~~ → Edge Function faz
- ~~Executar transbordo~~ → preenche campo, Edge Function assign owner

### Edge Function (saleszone) — lógica de negócio

1. Receber webhook do Pipedrive (lead updated)
2. Avaliar qual campo mudou
3. Executar ação correspondente (MQL, Lost, Transbordo, Convert Deal + Calendar)

### Pré-Vendedor — quando transbordo

1. Receber Lead com histórico (Link da Conversa no Morada)
2. Agendar manualmente
3. Preencher `Status Reunião` = Confirmada → Edge Function converte

---

## Webhook Pipedrive — Configuração

```
POST https://[supabase-url]/functions/v1/webhook-ctwa-lead
Event: updated.lead
```

- Filtrar por `[RD] Source` = "Click to WhatsApp" (ignorar leads de outras fontes)
- Comparar `previous` vs `current` para identificar qual campo mudou
- Idempotente: verificar se ação já foi executada antes de re-executar

---

## Resumo de Esforço

### O que a MIA muda
| De | Para |
|---|---|
| Cria **Deal** | Cria **Lead** |
| Preenche campos no **Deal** | Preenche campos no **Lead** (mesmos campos) |
| Executa lógica (Lost, transbordo, etc.) | Só preenche campos — lógica é da Edge Function |

### O que criamos (saleszone)
| Item | Descrição |
|---|---|
| Edge Function `webhook-ctwa-lead` | Handler de webhook com 4 triggers |
| Webhook no Pipedrive | Registrar via API `POST /webhooks` |
| Label "MQL" | Criar no Pipedrive Leads Inbox |

### Pipeline Vendas Spot (ID 28)
- Sem mudança de stages
- Diferença: só recebe Deals qualificados (pipeline limpo)

---

## Dependências e Ordem de Implementação

1. **Pipedrive**: criar label "MQL" no Leads Inbox
2. **Pipedrive**: registrar webhook para `updated.lead`
3. **saleszone**: criar Edge Function `webhook-ctwa-lead` (4 triggers)
4. **Morada/MIA**: modificar para criar Lead (não Deal) ao receber CTWA
5. **Morada/MIA**: preencher campos no Lead (mesmos de antes, mesmo formato)
6. **Morada/MIA**: remover lógica de negócio (Lost, transbordo, calendar — agora é da EF)
7. **(Futuro)**: definir cadência de nutrição para Leads Lost

> **Nota:** Steps 1-3 são nossos (saleszone). Steps 4-6 são da Morada.
> A MIA pode continuar funcionando como hoje até os steps 1-3 estarem prontos.
> Migração pode ser feita em paralelo sem downtime.
