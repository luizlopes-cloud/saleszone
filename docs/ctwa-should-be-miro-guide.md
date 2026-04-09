# BPMN Should Be — Guia de Montagem no Miro

**Board:** https://miro.com/app/board/uXjVGmITAC8=/
**Objetivo:** Criar o diagrama "Should Be" ao lado do "As-Is" já existente

---

## Setup Inicial

1. Posicionar à **direita** do diagrama As-Is existente
2. Criar um **Frame** com título: `PROCESSO COMERCIAL — CLICK TO WHATSAPP (VENDAS SPOT) — Should Be`
3. Tamanho sugerido: **1800 x 900px**

---

## 1. Criar as 5 Lanes (retângulos horizontais)

| # | Lane | Cor de fundo | Altura | Label |
|---|------|-------------|--------|-------|
| L1 | Lead / Cliente | Azul claro (#E3F2FD) | 80px | `Lead / Cliente` |
| L2 | MIA (IA) | Roxo claro (#F3E5F5) | 250px | `MIA` (sublabel: "só conversa + campos") |
| L3 | Edge Function | Azul acinzentado (#E8EAF6) | 140px | `Edge Function` (sublabel: "saleszone") |
| L4 | Pré-Vendedor | Amarelo claro (#FFF8E1) | 120px | `Pré-Vendedor` |
| L5 | Pipedrive | Verde claro (#E8F5E9) | 100px | `Pipedrive` |

> **Dica:** copie a estrutura de lanes do As-Is e adicione a lane "Edge Function" entre MIA e Pré-Vendedor.

---

## 2. Elementos por Lane

### L1 — Lead / Cliente

| # | Tipo | Texto | Cor | Posição |
|---|------|-------|-----|---------|
| 1 | Círculo (start) | — | Verde (#4CAF50) | Esquerda |
| 2 | Retângulo arredondado | `Envia mensagem` / `via WhatsApp (CTWA)` | Verde claro (#E8F5E9) borda (#4CAF50) | Após start |

**Setas:** 1 → 2

---

### L2 — MIA

| # | Tipo | Texto | Cor | Posição |
|---|------|-------|-----|---------|
| 3 | Retângulo arredondado | `Identifica empreendimento` / `(metadados da campanha)` | Roxo (#F3E5F5) borda (#9C27B0) | Abaixo de 2 |
| 4 | Retângulo arredondado | `Conduz 3 perguntas` / `de qualificação` / `(preenche campos)` | Roxo (#F3E5F5) borda (#9C27B0) | Direita de 3 |
| G1 | Losango | `MIA consegue?` | Amarelo (#FFF9C4) borda (#F9A825) | Direita de 4 |
| 5 | Retângulo arredondado | `Preenche:` / `Etapa final = Lost` / `(cadência 24h)` | Vermelho (#FFEBEE) borda (#E53935) | Abaixo de G1 |
| G2 | Losango | `Qualificado?` | Amarelo (#FFF9C4) borda (#F9A825) | Direita de G1 |
| 6 | Retângulo arredondado | `Preenche:` / `Etapa final = Lost` / `+ Motivo [MIA]` | Vermelho (#FFEBEE) borda (#E53935) | Abaixo de G2 |
| 7 | Retângulo arredondado | `Preenche:` / `Data de Qualificação` | Roxo (#F3E5F5) borda (#9C27B0) | Direita de G2 |
| 8 | Retângulo arredondado | `Propõe agenda` / `ao lead` | Roxo (#F3E5F5) borda (#9C27B0) | Direita de 7 |
| G3 | Losango | `MIA agenda?` | Amarelo (#FFF9C4) borda (#F9A825) | Direita de 8 |
| 9 | Retângulo arredondado | `Preenche:` / `Status Reunião =` / `Confirmada` | Roxo (#F3E5F5) borda (#9C27B0) | Direita de G3 |
| 10 | Retângulo arredondado | `Preenche:` / `Etapa final =` / `Transbordo` | Roxo (#F3E5F5) borda (#9C27B0) | Abaixo de G3 |

**Setas:**
- 2 → 3 (vertical, descendo)
- 3 → 4
- 4 → G1
- G1 → G2 (label: **Sim**, verde)
- G1 → 5 (label: **Não**, vermelho, vertical descendo)
- G2 → 7 (label: **Sim**, verde)
- G2 → 6 (label: **Não**, vermelho, vertical descendo)
- 7 → 8
- 8 → G3
- G3 → 9 (label: **Sim**, verde)
- G3 → 10 (label: **Não**, vermelho, vertical descendo)

---

### L3 — Edge Function

| # | Tipo | Texto | Cor | Posição |
|---|------|-------|-----|---------|
| 11 | Retângulo arredondado | `Cria Lead no` / `Pipedrive Leads` | Azul (#E3F2FD) borda (#1976D2) | Abaixo de 3 |
| 12 | Retângulo arredondado | `Arquiva Lead` / `Lost: Sem resposta` | Azul (#E3F2FD) borda (#1976D2) | Abaixo de 5 |
| 13 | Retângulo arredondado | `Arquiva Lead` / `Lost: Não qualif.` | Azul (#E3F2FD) borda (#1976D2) | Abaixo de 6 |
| 14 | Retângulo arredondado | `Label → MQL` | Azul (#E3F2FD) borda (#1976D2) | Abaixo de 7 |
| 15 | Retângulo arredondado | `Assign owner` / `→ Pré-Vendedor` | Azul (#E3F2FD) borda (#1976D2) | Abaixo de 10 |
| 16 | Retângulo arredondado | `Convert Lead → Deal` / `(pipeline 28)` / `+ cria Calendar event` | Azul (#E3F2FD) borda (#1976D2) | Abaixo de 9 |

**Setas (todas tracejadas azul — representam webhook):**
- 3 → 11 (tracejada, label: `webhook`)
- 5 → 12 (tracejada, label: `webhook`)
- 6 → 13 (tracejada, label: `webhook`)
- 7 → 14 (tracejada, label: `webhook`)
- 10 → 15 (tracejada, label: `webhook`)
- 9 → 16 (tracejada, label: `webhook`)

---

### L4 — Pré-Vendedor

| # | Tipo | Texto | Cor | Posição |
|---|------|-------|-----|---------|
| 17 | Retângulo arredondado | `PV assume com` / `histórico conversa` | Amarelo (#FFF8E1) borda (#F9A825) | Abaixo de 15 |
| 18 | Retângulo arredondado | `PV agenda` / `manualmente` | Amarelo (#FFF8E1) borda (#F9A825) | Direita de 17 |

**Setas:**
- 15 → 17 (vertical, descendo)
- 17 → 18
- 18 → 9 (sobe até MIA lane — PV preenche Status Reunião = Confirmada. Cor amarela/laranja)

---

### L5 — Pipedrive

| # | Tipo | Texto | Cor | Posição |
|---|------|-------|-----|---------|
| 19 | Círculo (end) | — | Vermelho (#E53935) borda grossa | Abaixo de 12 |
| 20 | Círculo (end) | — | Vermelho (#E53935) borda grossa | Abaixo de 13 |
| 21 | Círculo (end) | — | Verde (#4CAF50) borda grossa | Abaixo de 16 |

**Labels nos end events:**
- 19: `Lost` (vermelho)
- 20: `Lost` + sublabel `(nutrição futura)` (vermelho)
- 21: `Deal criado + Agendamento` (verde)

**Setas:**
- 12 → 19 (vermelho, descendo)
- 13 → 20 (vermelho, descendo)
- 16 → 21 (verde, descendo)

---

## 3. Legenda

Criar na parte inferior (copiar estilo do As-Is e adicionar novas cores):

| Cor | Significado |
|-----|-------------|
| Verde (tarefa) | Caminho de sucesso |
| Vermelho (tarefa) | Lost (exceção) |
| Roxo (lane) | MIA — só conversa + preenche campos |
| **Azul (lane)** | **Edge Function — lógica de negócio (NOVO)** |
| Amarelo (lane) | Pré-Vendedor |
| Verde (lane) | Pipedrive |
| Losango amarelo | Gateway — decisão / desvio |
| **Seta tracejada azul** | **Webhook trigger (NOVO)** |

---

## 4. Sticky Notes (contexto nos gateways)

| Gateway | Sticky Note |
|---------|-------------|
| G1: MIA consegue? | "Se MIA não consegue conduzir conversa ou cadência 24h esgota → Lost" |
| G2: Qualificado? | "3 perguntas: pagamento, valor, intenção. Critérios por empreendimento" |
| G3: MIA agenda? | "Se não consegue agendar → transbordo para PV. Sem transbordo para não qualificados" |

---

## 5. Diferenças visuais vs As-Is

Para facilitar a comparação lado a lado:

| Diferença | Como destacar |
|-----------|--------------|
| Nova lane "Edge Function" | Cor azul distinta |
| Setas tracejadas (webhooks) | Não existiam no As-Is |
| Sem seta direta MIA → Pipedrive | MIA sempre passa pela Edge Function |
| Sem transbordo para não qualificado | Seta vermelha vai direto para Lost |
| MIA tasks dizem "Preenche:" | Evidencia que MIA só preenche campos |

---

## Checklist rápido

- [ ] Frame criado com título
- [ ] 5 lanes com cores e labels
- [ ] Start event (verde) + "Envia mensagem"
- [ ] 8 tarefas MIA (roxo) — 3 normais + 5 "Preenche:"
- [ ] 3 gateways (losango amarelo)
- [ ] 6 tarefas Edge Function (azul)
- [ ] 2 tarefas PV (amarelo)
- [ ] 3 end events (2 vermelho, 1 verde)
- [ ] Setas sólidas (fluxo normal)
- [ ] Setas tracejadas azuis (webhooks)
- [ ] Labels Sim/Não nos gateways
- [ ] Sticky notes nos gateways
- [ ] Legenda atualizada
