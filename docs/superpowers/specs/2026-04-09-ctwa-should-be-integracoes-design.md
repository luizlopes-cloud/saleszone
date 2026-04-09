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

## Fluxo Should Be (Swimlanes para Miro)

### Raias

| Raia | Cor Miro | Ator |
|------|----------|------|
| Lead/Cliente | Azul claro | Prospect |
| MIA (IA) | Roxo | Bot WhatsApp (Morada.ai) |
| Pré-Vendedor | Amarelo | Humano (SDR/PV) |
| Pipedrive | Verde | CRM (sistema) |

### Fluxo

```
RAIA: Lead/Cliente
  (Start) → [Envia mensagem via WhatsApp]
        |
        v
RAIA: Pipedrive
  [Cria LEAD no Leads Inbox]
        |
        v
RAIA: MIA
  [Identifica empreendimento (metadados da campanha)]
        |
        v
  [Conduz 3 perguntas de qualificação]
        |
        v
  <MIA consegue?>
   |          |
  Sim        Não
   |          |
   v          v
  <Qualif?>  (timer) cadência esgotada (24h)
   |    |                    |
  Sim  Não                   v
   |    |          RAIA: Pipedrive
   |    |          [Lost: Sem resposta] → (End X)
   |    |
   |    +-------------------------> RAIA: Pipedrive
   |                                [Lost: Não qualificado]
   |                                      |
   |                                      v
   |                                (Nutrição futura) → (End X)
   |
   v
RAIA: Pipedrive
  [Lead → MQL (atualiza label)]
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
   |              v
   |     RAIA: Pré-Vendedor
   |     [PV assume com histórico da conversa]
   |              |
   |              v
   |     [PV agenda manualmente]
   |              |
   v              v
RAIA: Pipedrive
  [MQL → DEAL (pipeline Vendas Spot, ID 28)]
        |
        v
  [Agendamento criado (Google Calendar)]
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
| Lane roxa | MIA (IA) |
| Lane amarela | Pré-Vendedor |
| Lane verde | Pipedrive |

---

## Mapa de Integrações e Automações

### A1. Criação automática de Lead

| Campo | Detalhe |
|-------|---------|
| **Trigger** | Nova conversa CTWA recebida pela MIA |
| **Ação** | Criar Lead no Pipedrive Leads Inbox |
| **Dados** | Nome, telefone, empreendimento (da campanha), source CTWA |
| **Integração** | Morada webhook → Pipedrive API `POST /leads` |
| **Status** | MODIFICAR (hoje cria Deal, precisa criar Lead) |

### A2. Qualificação pela MIA

| Campo | Detalhe |
|-------|---------|
| **Trigger** | Lead responde no WhatsApp |
| **Ação** | MIA conduz 3 perguntas de qualificação |
| **Critérios** | Forma de pagamento, valor de investimento, investimento ou uso próprio |
| **Referência** | saleszone.vercel.app → Pré-Venda → Regra de Qualificação |
| **Integração** | Morada (já existe) |
| **Status** | MANTER |

### A3. Cadência 24h → Lost

| Campo | Detalhe |
|-------|---------|
| **Trigger** | 24h sem resposta do lead |
| **Ação** | Marcar Lead como Lost (motivo: "Sem resposta") |
| **Integração** | Morada timer → Pipedrive API `DELETE /leads/{id}` ou archive |
| **Status** | MODIFICAR (hoje opera em Deal, precisa operar em Lead) |

### A4. Não qualificado → Lost

| Campo | Detalhe |
|-------|---------|
| **Trigger** | MIA determina que lead não qualifica |
| **Ação** | Marcar Lead como Lost (motivo: "Não qualificado") — sem transbordo |
| **Integração** | Morada webhook → Pipedrive API archive Lead |
| **Status** | MODIFICAR (hoje pode ir pro PV; no should-be é Lost direto) |

### A5. Lead → MQL (nova automação)

| Campo | Detalhe |
|-------|---------|
| **Trigger** | MIA qualifica positivamente (3 perguntas OK) |
| **Ação** | Atualizar label do Lead para "MQL" no Pipedrive |
| **Integração** | Morada webhook → Pipedrive API `PATCH /leads/{id}` (label) |
| **Status** | CRIAR |

### A6. Agendamento direto pela MIA (nova automação)

| Campo | Detalhe |
|-------|---------|
| **Trigger** | Lead MQL aceita proposta de agenda |
| **Ação** | 1. Criar evento no Google Calendar (agendamentos@seazone.com.br) |
|  | 2. Converter Lead → Deal (pipeline Vendas Spot, ID 28) |
| **Integração** | Morada → Google Calendar API (criar evento) → Pipedrive API (convert lead → deal) |
| **Status** | CRIAR (hoje MIA não agenda direto) |

### A7. Transbordo para PV (qualificado + MIA não agenda)

| Campo | Detalhe |
|-------|---------|
| **Trigger** | Lead MQL + MIA não consegue agendar |
| **Condição** | Somente leads qualificados — não qualificados vão para Lost direto |
| **Ação** | Transferir conversa para PV com histórico completo |
| **Integração** | Morada (transbordo) → Timelines.ai (histórico) → PV assume |
| **Status** | MODIFICAR (hoje transbordo acontece se MIA não qualifica; agora só se não agenda) |

### A8. PV agenda → Lead → Deal

| Campo | Detalhe |
|-------|---------|
| **Trigger** | PV confirma agendamento |
| **Ação** | Converter Lead MQL → Deal no pipeline Vendas Spot (ID 28) |
| **Integração** | PV action → Google Calendar (evento) → Pipedrive API (convert lead → deal) |
| **Status** | MODIFICAR (hoje PV já trabalha com Deal; agora converte Lead → Deal) |

### A9. Nutrição de Leads Lost (futura)

| Campo | Detalhe |
|-------|---------|
| **Trigger** | Lead marcado Lost (Não qualificado) |
| **Ação** | Entrar em cadência de nutrição para re-engajamento |
| **Integração** | TBD (WhatsApp nurturing? Email? RD Station?) |
| **Status** | FUTURO (definir ferramenta e cadência) |

---

## Resumo de Esforço

| Status | Qtd | Automações |
|--------|-----|------------|
| MANTER | 1 | A2 (qualificação MIA) |
| MODIFICAR | 5 | A1 (Lead em vez de Deal), A3 (cadência em Lead), A4 (Lost direto), A7 (transbordo só p/ agenda), A8 (PV converte Lead) |
| CRIAR | 2 | A5 (label MQL), A6 (MIA agenda direto) |
| FUTURO | 1 | A9 (nutrição) |

---

## Ferramentas Envolvidas

| Ferramenta | Papel no Should Be |
|------------|-------------------|
| **Morada/MIA** | Qualificação, agendamento direto, transbordo |
| **Pipedrive API** | Leads Inbox (criar, atualizar label, converter → Deal, archive) |
| **Google Calendar** | Criar evento de apresentação (agendamentos@seazone.com.br) |
| **Timelines.ai** | Histórico de conversa WhatsApp (contexto no transbordo) |

---

## Pipedrive — Mudanças Necessárias

### Leads Inbox
- Hoje: não é usado no fluxo CTWA (deal é criado direto)
- Should Be: todo contato CTWA entra como Lead → só vira Deal se qualificado + agenda

### Labels de Lead
- Criar label "MQL" para identificar leads qualificados
- Label permite filtrar e reportar separadamente

### Motivos de Lost (Lead)
- "Sem resposta" — cadência 24h esgotada
- "Não qualificado" — respostas fora dos critérios do empreendimento

### Pipeline Vendas Spot (ID 28)
- Sem mudança de stages
- Diferença: só recebe Deals qualificados (pipeline limpo)

---

## Dependências e Ordem de Implementação

1. **Pipedrive**: criar label "MQL" no Leads Inbox
2. **Morada/MIA**: modificar para criar Lead (não Deal) ao receber CTWA
3. **Morada/MIA**: adicionar lógica de atualizar Lead para MQL após qualificação
4. **Morada/MIA**: implementar agendamento direto (Google Calendar + convert Lead → Deal)
5. **Morada/MIA**: modificar transbordo — só quando qualificado + não consegue agendar
6. **Morada/MIA**: Lost direto para não qualificados (sem transbordo)
7. **Morada/MIA**: cadência 24h opera em Lead (não Deal)
8. **(Futuro)**: definir ferramenta e cadência de nutrição para Lost

> **Nota:** A maioria das mudanças são na Morada/MIA. O Pipedrive recebe as ações via API.
