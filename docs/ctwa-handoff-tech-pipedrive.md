# Handoff Técnico — CTWA Should Be (Vendas Spot)

**Para:** Time Tech / Pipedrive
**Data:** 09/04/2026
**Contexto:** Processo Click to WhatsApp — Vendas Spot (pipeline 28)
**Referência visual:** `ctwa-should-be-bpmn.html` (abrir no browser)

---

## Resumo da Mudança

**Hoje (As-Is):** Quando um lead envia mensagem via Click to WhatsApp, a Morada/MIA cria um **Deal** imediatamente no Pipedrive, antes de qualquer qualificação. Isso infla o pipeline Vendas Spot com contatos não qualificados.

**Proposta (Should Be):** O contato entra como **Lead** no Pipedrive Leads Inbox. Só vira **Deal** se for qualificado E agendar uma reunião.

---

## Arquitetura Proposta

```
MIA conversa no WhatsApp + preenche campos no Lead
          ↓
Pipedrive Lead atualizado (campo muda)
          ↓
Webhook Pipedrive dispara
          ↓
Edge Function (nossa) executa lógica de negócio
```

**Princípio:** a MIA faz o mínimo — conversa e preenche campos. A lógica de negócio (marcar MQL, dar Lost, converter Deal, agendar) é toda da **Edge Function**, que reage a webhooks do Pipedrive.

---

## O que precisa ser configurado no Pipedrive

### 1. Criar label "MQL" no Leads Inbox

- Local: Pipedrive → Leads → Labels
- Nome: **MQL**
- Cor: verde (sugestão)
- Será aplicada automaticamente pela Edge Function quando o lead for qualificado

### 2. Registrar Webhook

```
Evento: updated.lead
URL: https://[supabase-url]/functions/v1/webhook-ctwa-lead
```

Pode ser feito via API:
```bash
curl -X POST "https://seazone-fd92b9.pipedrive.com/v1/webhooks?api_token=TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "subscription_url": "https://[supabase-url]/functions/v1/webhook-ctwa-lead",
    "event_action": "updated",
    "event_object": "lead"
  }'
```

---

## Campos do Pipedrive utilizados (já existem)

Nenhum campo novo precisa ser criado. Todos já existem como custom fields de Deal (Leads herdam).

### Campos-trigger (MIA preenche → Edge Function reage)

| Campo | Tipo | Trigger da Edge Function |
|---|---|---|
| **Data de Qualificação** | date | Quando preenchida → marca label "MQL" no Lead |
| **Etapa final - cadência** | enum (Lost / Transbordo) | Lost → arquiva Lead. Transbordo → assign PV |
| **Status Reunião** | enum (Confirmada / ...) | Confirmada → converte Lead → Deal + cria evento Calendar |

### Campos de contexto (MIA preenche durante conversa)

| Campo | Tipo | Uso |
|---|---|---|
| Qual a forma de pagamento? | enum | Q1 qualificação |
| Qual o valor total que pretende investir? | enum | Q2 qualificação |
| Você procura investimento ou uso próprio? | enum | Q3 qualificação |
| Empreendimento | enum | Identificado via metadados campanha |
| Data da Reunião [MIA] | varchar | Data proposta pela MIA |
| Hora da Reunião [MIA] | varchar | Hora proposta pela MIA |
| Motivo de Lost [MIA] | set | Motivo quando não qualifica |
| Respondeu MIA | varchar | Se lead respondeu |
| step_cadencia | double | Step atual da cadência |
| Pré Vendedor(a) | user | PV designado no transbordo |
| Link da Conversa | varchar | Link Morada |

---

## Edge Function — Comportamento

A Edge Function recebe o webhook `updated.lead` e avalia qual campo mudou:

| # | Campo que mudou | Valor | Ação |
|---|---|---|---|
| 1 | `Data de Qualificação` | preenchida (antes vazia) | `PATCH /leads/{id}` → label_ids = [MQL] |
| 2 | `Etapa final - cadência` | **Lost** | `PATCH /leads/{id}` → is_archived: true |
| 3 | `Etapa final - cadência` | **Transbordo** | `PATCH /leads/{id}` → owner_id = PV |
| 4 | `Status Reunião` | **Confirmada** | `POST /v2/leads/{id}/convert/deal` (pipeline_id: 28) + Google Calendar API (evento em agendamentos@seazone.com.br) |

### Filtro de segurança

- Processar APENAS leads com `[RD] Source` contendo "Click to WhatsApp"
- Comparar `previous` vs `current` para identificar mudança real
- Idempotente: não executar ação se já foi feita

---

## Endpoints da API Pipedrive utilizados

| Método | Endpoint | Uso |
|---|---|---|
| POST | `/v1/leads` | MIA cria Lead |
| PATCH | `/v1/leads/{id}` | Atualizar label, owner, is_archived |
| POST | `/v2/leads/{id}/convert/deal` | Converter Lead → Deal |
| GET | `/v1/leads/{id}` | Consultar dados do Lead |
| POST | `/v1/webhooks` | Registrar webhook |

---

## Pipeline Vendas Spot (ID 28)

**Sem mudança de stages.** A única diferença é que Deals só entram no pipeline quando já são qualificados e têm agenda confirmada.

Stages existentes:
```
Lead in → Contatados → Qualificação → Qualificado → Aguardando data → 
Agendado → No Show → Reunião Realizada → FUP → Negociação → 
Aguardando Dados → Contrato
```

**Stage de entrada:** Agendado (já tem reunião confirmada)

---

## Diagrama de Sequência

```
Lead          MIA              Pipedrive         Edge Function        Calendar
 │              │                   │                  │                  │
 ├─ msg CTWA ──►│                   │                  │                  │
 │              ├── POST /leads ───►│ (Lead criado)    │                  │
 │              │                   │                  │                  │
 │◄── Q1,Q2,Q3─┤                   │                  │                  │
 │── respostas─►│                   │                  │                  │
 │              ├── PATCH campos ──►│                  │                  │
 │              │                   │                  │                  │
 │              │  [Se qualificado] │                  │                  │
 │              ├── PATCH Data     ►│── webhook ──────►│                  │
 │              │   Qualificação    │                  ├── PATCH label ──►│
 │              │                   │                  │   (MQL)          │
 │              │                   │                  │                  │
 │◄── propõe   ─┤                   │                  │                  │
 │    agenda    │                   │                  │                  │
 │── confirma ─►│                   │                  │                  │
 │              ├── PATCH Status   ►│── webhook ──────►│                  │
 │              │   Reunião =       │                  ├── convert/deal ─►│
 │              │   Confirmada      │                  ├── POST event ───►│
 │              │                   │                  │                  │
```

---

## Cronograma sugerido

| Step | Responsável | Descrição |
|---|---|---|
| 1 | Tech/Pipedrive | Criar label "MQL" no Leads |
| 2 | Tech/Pipedrive | Registrar webhook `updated.lead` |
| 3 | Saleszone (JP) | Criar Edge Function `webhook-ctwa-lead` |
| 4 | Morada | Modificar MIA (ver doc handoff-morada) |
| 5 | Todos | Teste integrado em ambiente de staging |
| 6 | Todos | Go-live |

> Steps 1-3 podem ser feitos em paralelo com step 4.
> Step 5 deve ser feito antes do go-live para validar o fluxo completo.

---

## Source Repescagem (segundo fluxo, mesma Edge Function)

### Contexto

Leads de campanhas marketing que **já têm dados de formulário** mas não atingiram o SLA de MQL. A MIA tenta requalificar com uma pergunta direcionada ao gap do SLA.

### Diferença na Edge Function

A EF diferencia o fluxo pelo campo `[RD] Source`:

| Source | Trigger `Data de Qualificação` | Trigger `Status Reunião = Confirmada` |
|---|---|---|
| **Click to WhatsApp** | Label MQL (só) | Convert Lead → Deal + Calendar |
| **Repescagem** | Label MQL + **Convert Lead → Deal** | Calendar (Deal já existe) |

```
if source == "Repescagem":
    # Convert acontece NA qualificação, não no agendamento
    on data_qualificacao → label MQL + convert lead → deal
    on status_reuniao == Confirmada → calendar event only
```

### Regra: PV só atende Deals

- **Lead de Repescagem:** MIA resolve tudo. Sem transbordo.
- **Deal de Repescagem (pós-convert):** Se sem resposta na agenda → transbordo para PV.
- Lost no Lead = **definitivo** (sem nutrição futura).

### Nenhuma configuração adicional no Pipedrive

- Mesma label "MQL", mesmo webhook, mesma Edge Function.
- O campo `[RD] Source` = "Repescagem" já diferencia o fluxo.
