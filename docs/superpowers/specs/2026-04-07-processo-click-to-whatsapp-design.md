# Processo Comercial — Click to WhatsApp (Vendas Spot)

**Data:** 2026-04-07
**Status:** Spec aprovada — aguardando implementação técnica (fase B)
**Escopo:** Documentação do processo AS-IS e Should-Be para teste de campanha Click to WhatsApp no funil Vendas Spot.

---

## Contexto

Teste de campanha Meta Ads com CTA "Click to WhatsApp" para o funil Vendas Spot.

**Diferença do processo padrão:** nos outros funis, o lead preenche um formulário de marketing — se responder corretamente, é considerado MQL. No Click to WhatsApp, o lead demonstra interesse ativamente e inicia a conversa diretamente com a Morada/MIA via WhatsApp. A qualificação acontece dentro dessa conversa.

**Problema identificado no AS-IS:** o deal é criado no Pipedrive imediatamente ao receber a mensagem, antes de qualquer qualificação. Isso infla o pipeline com contatos não qualificados e dificulta a análise do funil.

---

## Identificação do Empreendimento

O empreendimento **não é perguntado pela MIA** — ele é identificado automaticamente pelos metadados da campanha no momento em que o lead clica no anúncio e inicia a conversa. Cada campanha é atribuída a um empreendimento específico, e essa informação está disponível na conversão.

---

## Papéis e Responsabilidades

### AS-IS

| Papel | Responsabilidade |
|---|---|
| **MIA** | Recebe o contato via WhatsApp, cria Deal imediatamente no Pipedrive, conduz qualificação com 3 perguntas |
| **Pré-Vendedor** | Assume em caso de transbordo (MIA não consegue conduzir a conversa) |
| **Pipeline Vendas Spot** | Recebe todos os contatos, qualificados ou não |

### Should-Be

| Papel | Responsabilidade |
|---|---|
| **MIA** | Recebe o contato, cria **Lead** no Pipedrive Leads, conduz qualificação com 3 perguntas, converte Lead → Deal se qualificado, registra Lost se não qualificado ou sem resposta |
| **Pré-Vendedor** | Assume apenas quando MIA não consegue conduzir a conversa — recebe histórico e segue os mesmos critérios de qualificação |
| **Pipeline Vendas Spot** | Recebe apenas Deals qualificados. Etapas: Agendado → No Show/Em reagendamento → FUP → (Ganho / Perdido) |

> **Importante:** não há transbordo para leads não qualificados ou sem resposta — esses vão direto para Lost.

---

## Critérios de Qualificação

A qualificação é composta por 3 perguntas. O empreendimento já é conhecido via metadados da campanha, então as regras de qualificação são carregadas automaticamente.

**Referência das regras:** aba **Regras de Qualificação** no saleszone (`saleszone.vercel.app` → Pré-Venda → Regra de Qualificação).

| # | Pergunta | Campo na Regra de Qualificação |
|---|---|---|
| 1 | "Qual a forma de pagamento?" | Coluna **Pagamentos** (ex: À vista, Parcelado) |
| 2 | "Qual o valor total que você pretende investir?" | Coluna **Faixas de Investimento** (ex: 300-400k, >400k) |
| 3 | "Você procura investimento ou para uso próprio?" | Coluna **Intenções** (ex: Renda, Valorização, Esporádico) |

**Regra de aprovação:** o lead é qualificado se as 3 respostas estiverem marcadas como válidas (verde) para o empreendimento da campanha.

---

## Processo AS-IS (atual)

```
Anúncio Meta Ads (Click to WhatsApp)
        ↓
Lead envia mensagem → empreendimento identificado via metadados
        ↓
⚠️  Deal criado IMEDIATAMENTE no Pipedrive  ← problema
        ↓
MIA conduz qualificação (3 perguntas via WhatsApp)
        ↓
    ┌──────────────────────────────┬────────────────────────────┐
    │                              │
MIA qualifica                 Transbordo para PV
    ↓                         (MIA não consegue conduzir)
Agendamento                        ↓
    └──────────────────────────────┘
        ↓
Pipeline Vendas Spot
Agendado → No Show/Em reagendamento → FUP → (Ganho / Perdido)
```

**Problema:** todos os contatos viram Deal antes de qualificação. Pipeline inflado, análise comprometida.

---

## Processo Should-Be (proposto)

```
Anúncio Meta Ads (Click to WhatsApp)
        ↓
Lead envia mensagem → empreendimento identificado via metadados
        ↓
✅  Lead criado no Pipedrive Leads
        ↓
MIA conduz qualificação (3 perguntas via WhatsApp)
        ↓
    ┌─────────────────┬──────────────────┬─────────────────────┐
    │                 │                  │
Qualificado      Transbordo para PV  Não qualificado     Sem resposta
    ↓            (MIA não consegue)       ↓                   ↓
Lead → Deal           ↓             Lost no Pipedrive    Lost no Pipedrive
    ↓            PV recebe histórico  Motivo:              Motivo:
Agendamento      + mesmo critério    "Não qualificado"    "Sem resposta"
    │                 ↓
    │          Qualificado?
    │          ┌────┴────┐
    │          ↓         ↓
    │      Lead → Deal  Lost
    │      Agendamento  "Não qualificado"
    └──────────┘
        ↓
Pipeline Vendas Spot
Agendado → No Show/Em reagendamento → FUP → (Ganho / Perdido)
```

---

## Motivos de Lost no Pipedrive

| Motivo | Quando usar |
|---|---|
| **Sem resposta** | Lead entrou na cadência mas nunca respondeu as perguntas (cadência esgotada) |
| **Não qualificado** | Lead respondeu mas as respostas estão fora dos critérios de MQL do empreendimento |

> Motivos distintos permitem análise e ação segmentada futuramente (ex: remarketing diferenciado por grupo).

---

## Comparação Resumida

| Aspecto | AS-IS | Should-Be |
|---|---|---|
| Entrada no Pipedrive | Deal imediato | Lead (Leads inbox) |
| Quando vira Deal | Imediatamente | Após qualificação aprovada |
| Não qualificados | Entram no pipeline | Lost com motivo "Não qualificado" |
| Sem resposta | Entram no pipeline | Lost com motivo "Sem resposta" |
| Transbordo para PV | MIA não consegue conduzir | Idem — apenas quando MIA não consegue |
| Qualidade do pipeline | Baixa (inflado) | Alta (só qualificados) |

---

## Fora de Escopo (Fase A)

- Implementação técnica da integração Morada/MIA com Pipedrive Leads API
- Automação de conversão Lead → Deal e registro de Lost no Pipedrive
- Definição das ações pós-descarte (remarketing, nurturing por motivo)
- Métricas de acompanhamento do novo funil no saleszone dashboard

Esses itens fazem parte da **fase B** (spec técnica a ser elaborada em sessão separada).
