# Source Repescagem — Requalificação de Leads Marketing

**Data:** 2026-04-10
**Status:** Spec aprovada
**Miro:** https://miro.com/app/board/uXjVGmITAC8= (terceiro diagrama, à direita do Should Be)
**Relação:** Usa mesma arquitetura webhook do CTWA Should Be (Fase B)

---

## Contexto

Leads que vêm de campanhas de marketing e **já possuem dados de formulário**, mas não atingiram o SLA de MQL. Diferente do CTWA (onde não temos nenhuma informação do lead), aqui já sabemos as respostas e conseguimos identificar **o que faltou** para qualificar.

**Objetivo:** Dar uma segunda chance de qualificação com mensagem direcionada ao gap do SLA, sem sobrecarregar pré-vendas.

---

## Diferenças vs CTWA

| Aspecto | CTWA | Repescagem |
|---|---|---|
| Dados iniciais | Nenhum (lead só mandou msg) | Formulário completo |
| Primeira abordagem | 3 perguntas de qualificação | 1 pergunta direcionada ao gap SLA |
| Lógica de qualificação | MIA faz 3 perguntas | De-para: analisa gap → pergunta direcionada |
| Conversão Lead → Deal | No agendamento (Status Reunião = Confirmada) | **Na qualificação** (Data de Qualificação preenchida) |
| Lost não qualificado | Lead → nutrição futura | Lead → **Lost definitivo** |
| Transbordo | Qualificado + MIA não agenda (Lead) | Qualificado + sem resposta na agenda (**Deal**) |
| PV atende | Leads (via transbordo) | **Só Deals** (nunca Leads) |

---

## Fluxo

```
Lead converte via formulário marketing (já tem dados)
  ↓
[EF] Cria Lead no Pipedrive (com dados do form + [RD] Source = "Repescagem")
  ↓
[MIA] Analisa dados do formulário → identifica gap SLA
  ↓
[MIA] Envia mensagem direcionada (de-para: gap → pergunta)
  Ex: "quer para moradia" → "nossos imóveis são para investimento e uso esporádico"
  ↓
<Qualificado?>
  Não / Sem resposta → [MIA] Preenche Etapa final = Lost
    → [EF] Arquiva Lead → Lost definitivo ✗
  Sim → [MIA] Preenche Data de Qualificação
    → [EF] Label MQL + Convert Lead → Deal (pipeline 28)
      ↓
    [MIA] Propõe agenda
      ↓
    <MIA agenda?>
      Sim → [MIA] Preenche Status Reunião = Confirmada
        → [EF] Calendar event → Sucesso ✓
      Não (sem resposta) → [MIA] Preenche Etapa final = Transbordo
        → [EF] Assign PV → PV agenda (já é Deal) → ✓
```

---

## Lógica "De-Para" (Gap SLA → Mensagem)

A MIA consulta os dados do formulário e identifica qual critério do SLA não foi atingido. Com base nisso, envia uma mensagem direcionada.

| Gap SLA identificado | Mensagem MIA (exemplo) |
|---|---|
| Intenção = moradia | "Nossos imóveis são para investimento e uso esporádico. Faz sentido pra você?" |
| Valor abaixo da faixa | "Temos opções a partir de R$ X. Esse valor funciona pra você?" |
| Forma de pagamento incompatível | "Trabalhamos com PIX e boleto à vista ou parcelado. Alguma dessas opções funciona?" |

> **Referência de regras:** saleszone.vercel.app → Pré-Venda → Regra de Qualificação (por empreendimento)

---

## Arquitetura Webhook (mesma do CTWA)

```
MIA (conversa + preenche campos no Lead)
  → Pipedrive Lead atualizado
  → Webhook dispara
  → Edge Function (saleszone) executa lógica
```

### Triggers da Edge Function — Repescagem

| # | Campo trigger | Valor | Ação | Diferença vs CTWA |
|---|---|---|---|---|
| 1 | `Data de Qualificação` | preenchida | Label MQL + **Convert Lead → Deal** | CTWA: só label MQL |
| 2 | `Etapa final - cadência` | Lost | Arquiva Lead (**definitivo**) | CTWA: nutrição futura |
| 3 | `Status Reunião` | Confirmada | Calendar event (Deal já existe) | CTWA: Calendar + Convert |
| 4 | `Etapa final - cadência` | Transbordo | Assign PV (no Deal) | Igual CTWA |

**Filtro:** `[RD] Source` = "Repescagem" (diferencia do CTWA)

---

## Campos Pipedrive (todos já existem)

Mesmos campos do CTWA — sem necessidade de criar nada novo.

| Campo | Key | Quando preencher |
|---|---|---|
| [RD] Source | `ff53f6910138...` | "Repescagem" (na criação do Lead) |
| Empreendimento | `6d565fd4fce6...` | Na criação do Lead (do form) |
| Qual a forma de pagamento? | `977b711b69cf...` | Já vem do form |
| Qual o valor total que pretende investir? | `55bb0bbb3ffd...` | Já vem do form |
| Você procura investimento ou uso próprio? | `f9b23753a78e...` | Já vem do form |
| Data de Qualificação | `bc74bcc4326...` | MIA preenche quando qualifica |
| Status Reunião | `658f16abb8e4...` | MIA preenche quando agenda confirmada |
| Etapa final - cadência | `3fc8446ad245...` | MIA preenche quando Lost ou Transbordo |
| Motivo de Lost [MIA] | `bf0e5193f43a...` | MIA preenche motivo |
| Data/Hora Reunião [MIA] | `7d1c61f8...` / `06ae369d...` | MIA preenche quando agenda |

---

## Regra Importante: PV só atende Deals

- **Enquanto Lead:** MIA resolve tudo. Sem transbordo para PV.
- **Após Convert → Deal:** Se MIA não consegue agendar → transbordo para PV.
- **Motivo:** PV não deve ser sobrecarregado com leads de baixa qualidade.

---

## Implementação

### Na Edge Function `webhook-ctwa-lead` (já será criada para CTWA)

Adicionar lógica condicional baseada no `[RD] Source`:

```
if source == "Click to WhatsApp":
    # CTWA: Convert no agendamento
    if data_qualificacao → label MQL
    if status_reuniao == Confirmada → Convert Lead → Deal + Calendar

elif source == "Repescagem":
    # Repescagem: Convert na qualificação
    if data_qualificacao → label MQL + Convert Lead → Deal
    if status_reuniao == Confirmada → Calendar (Deal já existe)
```

### Na Morada/MIA

1. Ao receber lead de Repescagem → consultar dados do form no Lead
2. Identificar gap SLA (comparar respostas form vs regras do empreendimento)
3. Enviar mensagem direcionada (de-para)
4. Se qualificou → preencher `Data de Qualificação`
5. Propor agenda → preencher `Status Reunião` se confirmou
6. Se Lost → preencher `Etapa final - cadência = Lost`
7. Se sem resposta na agenda → preencher `Etapa final - cadência = Transbordo`

---

## Cronograma

| Step | Responsável | Descrição |
|---|---|---|
| 1 | Saleszone (JP) | Adicionar lógica "Repescagem" na Edge Function (condicional por Source) |
| 2 | Morada | Implementar lógica de-para (gap SLA → mensagem direcionada) |
| 3 | Morada | Criar Lead com Source "Repescagem" + preencher dados do form |
| 4 | Marketing | Configurar campanha com Source "Repescagem" |
| 5 | Todos | Teste integrado → Go-live |

> **Dependência:** Edge Function do CTWA deve estar pronta primeiro (step 3 do CTWA). Repescagem reutiliza a mesma EF com lógica condicional.
