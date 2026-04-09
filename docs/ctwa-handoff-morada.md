# Handoff Morada — CTWA Should Be (Vendas Spot)

**Para:** Time Morada / MIA
**Data:** 09/04/2026
**Contexto:** Processo Click to WhatsApp — Vendas Spot (pipeline 28 do Pipedrive)
**Referência visual:** `ctwa-should-be-bpmn.html` (abrir no browser)

---

## Resumo da Mudança

Estamos mudando o processo Click to WhatsApp para que **somente leads qualificados e com agenda virem Deals** no Pipedrive. O pipeline fica mais limpo e a análise de funil mais precisa.

**O que muda para a MIA:**

| Antes | Depois |
|---|---|
| Cria **Deal** no Pipedrive | Cria **Lead** no Pipedrive |
| Preenche campos no **Deal** | Preenche campos no **Lead** (mesmos campos) |
| Executa lógica de negócio (Lost, transbordo, calendar) | **Só preenche campos** — a lógica é da Edge Function |
| Transbordo quando não qualifica | **Sem transbordo** para não qualificado — só preenche campo |
| Transbordo quando não consegue agendar | Preenche campo → transbordo automático |

**O que NÃO muda:**
- As 3 perguntas de qualificação (mesmas)
- O fluxo de conversa no WhatsApp (mesmo)
- Os campos preenchidos (mesmos nomes, mesmos valores)
- A proposta de agenda ao lead qualificado (mesma)

---

## Mudanças Necessárias na MIA

### 1. Criar Lead em vez de Deal

**Antes:**
```
POST /v1/deals
```

**Depois:**
```
POST /v1/leads
```

**Body mínimo:**
```json
{
  "title": "Nome do Lead — Empreendimento",
  "person_id": 12345,
  "owner_id": null,
  "label_ids": [],
  "was_seen": 0
}
```

> Leads herdam os custom fields dos Deals. Os mesmos campos (forma de pagamento, valor de investimento, etc.) estão disponíveis no Lead.

### 2. Preencher campos no Lead (não no Deal)

**Antes:**
```
PUT /v1/deals/{deal_id}
```

**Depois:**
```
PATCH /v1/leads/{lead_id}
```

**Os campos são os mesmos.** Exemplo:
```json
{
  "977b711b69cf4efd9f5221bf17600b7e23b94256": "À vista via PIX ou boleto",
  "55bb0bbb3ffd7ac235c453d8c237fa2edcf6fb44": "R$ 200.001 a R$ 300.000",
  "f9b23753a78ed314d9ad42f51a9dd02da0b8c751": "Investimento - renda com aluguel"
}
```

### 3. Remover lógica de negócio

A MIA **NÃO precisa mais** executar estas ações diretamente:

| Ação | Antes (MIA fazia) | Depois (MIA só preenche campo) |
|---|---|---|
| Dar Lost | MIA dava Lost no Deal | MIA preenche `Etapa final - cadência = Lost` + `Motivo de Lost [MIA]` → EF arquiva |
| Transbordo | MIA executava transbordo | MIA preenche `Etapa final - cadência = Transbordo` → EF assign PV |
| Criar evento Calendar | MIA criava evento | MIA preenche `Status Reunião = Confirmada` + `Data/Hora Reunião` → EF cria evento |
| Converter Deal | MIA movia stages | MIA preenche `Status Reunião = Confirmada` → EF converte Lead → Deal |

**A MIA agora é "burra" no sentido de lógica de negócio — ela só conversa e preenche campos. O resto é automático.**

---

## Campos que a MIA preenche (por momento)

### Ao receber mensagem CTWA
| Campo | Key | Valor |
|---|---|---|
| Empreendimento | `6d565fd4fce66c16da078f520a685fa2fa038272` | Enum do empreendimento (via metadados campanha) |
| [RD] Source | `ff53f6910138fa1d8969b686acb4b1336d50c9bd` | "Click to WhatsApp" |
| leadgen_id | `5c2b5585058df45ab36ce6a66eff9dd3dafc63c9` | ID do lead Meta Ads |
| Link da Conversa | `3dda4dab1781dcfd8839a5fd6c0b7d5e7acfbcfc` | URL Morada |

### Durante qualificação (3 perguntas)
| Campo | Key | Valor |
|---|---|---|
| Qual a forma de pagamento? | `977b711b69cf4efd9f5221bf17600b7e23b94256` | Resposta Q1 (enum) |
| Qual o valor total que pretende investir? | `55bb0bbb3ffd7ac235c453d8c237fa2edcf6fb44` | Resposta Q2 (enum) |
| Você procura investimento ou uso próprio? | `f9b23753a78ed314d9ad42f51a9dd02da0b8c751` | Resposta Q3 (enum) |
| Respondeu MIA | `34336364766f24e1b2fdb25beec9c87856f3ade3` | "Sim" |

### Ao finalizar qualificação
| Resultado | Campos a preencher |
|---|---|
| **Qualificado** | `Data de Qualificação` = data de hoje (`bc74bcc4326527cbeb331d1697d4c8812d68506e`) |
| **Não qualificado** | `Etapa final - cadência` = "Lost" (`3fc8446ad245714794555cd9dcc9311409cdece2`) + `Motivo de Lost [MIA]` = motivo (`bf0e5193f43a49b36990c4ea88c91e01d0858592`) |
| **Sem resposta (cadência)** | `Etapa final - cadência` = "Lost" (`3fc8446ad245714794555cd9dcc9311409cdece2`) + `Motivo de Lost [MIA]` = "Sem resposta" |

### Ao propor agenda (lead qualificado)
| Resultado | Campos a preencher |
|---|---|
| **Lead aceita agenda** | `Status Reunião` = "Confirmada" (`658f16abb8e4d9ca1c4426664a48e9a82c390bb5`) + `Data da Reunião [MIA]` (`7d1c61f8b0ff7adb622a5fe24a923d4491e16001`) + `Hora da Reunião [MIA]` (`06ae369dd850925f3ae29678619ac0cdbf265d24`) |
| **MIA não consegue agendar** | `Etapa final - cadência` = "Transbordo" (`3fc8446ad245714794555cd9dcc9311409cdece2`) |

---

## Fluxo resumido

```
1. Lead envia msg WhatsApp (CTWA)
2. MIA → POST /v1/leads (cria Lead com empreendimento + source)
3. MIA conversa, faz 3 perguntas, preenche campos no Lead
4. Se qualificado → MIA preenche Data de Qualificação
   Se não qualificado → MIA preenche Etapa final = Lost + Motivo
   Se sem resposta (24h) → MIA preenche Etapa final = Lost
5. Se qualificado, MIA propõe agenda
6. Se agenda confirmada → MIA preenche Status Reunião = Confirmada + Data + Hora
   Se MIA não consegue agendar → MIA preenche Etapa final = Transbordo
7. FIM — tudo que acontece depois é automático (Edge Function)
```

---

## API Pipedrive — Referência rápida

| Ação | Método | Endpoint |
|---|---|---|
| Criar Lead | POST | `/v1/leads` |
| Atualizar Lead | PATCH | `/v1/leads/{id}` |
| Consultar Lead | GET | `/v1/leads/{id}` |

**Base URL:** `https://seazone-fd92b9.pipedrive.com`
**Auth:** `?api_token=TOKEN` (query param)

---

## Importante: o que a MIA NÃO faz mais

1. **NÃO cria Deal** — cria Lead
2. **NÃO move stages** no Pipedrive — só preenche campos
3. **NÃO dá Lost** diretamente — preenche `Etapa final - cadência = Lost`
4. **NÃO executa transbordo** — preenche `Etapa final - cadência = Transbordo`
5. **NÃO cria evento no Google Calendar** — preenche `Status Reunião = Confirmada`
6. **NÃO converte Lead → Deal** — a Edge Function faz isso automaticamente

**A MIA só conversa e preenche campos. Todo o resto é automático.**

---

## Cronograma

| Step | Responsável | O que |
|---|---|---|
| 1-3 | Tech (JP) | Configurar Pipedrive (label, webhook) + criar Edge Function |
| 4 | **Morada** | Modificar MIA: criar Lead + preencher campos + remover lógica |
| 5 | Todos | Teste integrado |
| 6 | Todos | Go-live |

> A MIA pode continuar funcionando como hoje até que os steps 1-3 estejam prontos.
> A migração pode ser feita sem downtime — é só trocar o endpoint de criação (Deal → Lead) e remover a lógica extra.

---

## Dúvidas?

Entrar em contato com JP (joao.coutinho@seazone.com.br) para alinhar testes e go-live.
