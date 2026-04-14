# Spec: Relatório Semanal — Losts da MIA

**Data:** 2026-04-07  
**Status:** Aprovado

---

## Objetivo

Relatório semanal automático que lista todos os deals marcados como lost pela MIA (Morada - Mia) na semana anterior, agrupados por funil, destacando os casos em que o motivo do lost diverge do conteúdo real da conversa.

---

## Contexto

A MIA (bot da Morada.ai, `integracoes@morada.ai`, user_id Pipedrive: `21490680`) marca deals como lost via API. Em alguns casos, o motivo registrado não condiz com o que foi dito na conversa. O time precisa de visibilidade semanal para revisar e reabrir os casos errados.

---

## Implementação

### Tipo
Slash command Claude: `~/.claude/commands/relatorio-mia-losts.md`

### Automação
- **launchd:** `com.seazone.relatorio-mia-losts`
- **Horário:** toda segunda-feira às 08:30
- **Comando:** `claude -p /relatorio-mia-losts`
- **WorkingDirectory:** `~/Claude-Code/saleszone/scripts/monitor-atendimento` (para encontrar o `.env`)

### Credenciais
O slash command lê tokens do arquivo `~/Claude-Code/saleszone/scripts/monitor-atendimento/.env`.
Variáveis necessárias: `PIPEDRIVE_API_TOKEN`, `SLACK_BOT_TOKEN`, `METABASE_MORADA_API_KEY`.
**NUNCA hardcodar tokens no arquivo de comando ou no spec.**

---

## Fluxo de Execução

### 1. Janela de tempo
Sempre segunda a domingo da semana anterior (ex: se hoje é 07/Abr, busca 31/Mar–06/Abr).

### 2. Identificação de losts da MIA (Pipedrive)
- `GET /deals?status=lost&sort=lost_time DESC&limit=500` — paginar enquanto `lost_time >= inicio_semana`
- Filtrar deals com `lost_time` dentro da janela (filtro client-side — Pipedrive ignora `pipeline_id` em lost/won)
- Para cada deal, buscar notas: `GET /deals/{id}/notes`
- Deal é "da MIA" se tiver **qualquer nota** de `user_id: 21490680`, independente de data (a MIA sempre posta nota quando dá lost)
- Extrair: `deal_id`, `pipeline_id`, `stage_name`, `lost_reason`, `title`, conteúdo das notas da MIA

**Caso zero losts:** se nenhum deal da MIA for encontrado na semana, enviar mensagem: "✅ Sem losts da MIA na semana de DD/Mês a DD/Mês."

### 3. Cruzamento com Metabase Morada
- `POST /api/card/1427/query` → carregar todas as conversas (2000 rows mais recentes)
- Coluna de cruzamento: `deal_id_externo` (verificar nome exato no response antes de cruzar)
- Filtrar por `deal_id_externo` nos deals identificados
- Obter: `conversa_id`, `conversation_link` (URL `app.morada.ai/conversations/...`)
- `POST /api/card/1428/query` → carregar mensagens (2000 rows mais recentes)
- Filtrar por `conversa_id` → montar texto da conversa por deal (concatenar campo `conteudo` em ordem cronológica)
- **Fallback obrigatório:** se deal não encontrado no card 1427, ou se `conversa_id` não tiver mensagens no card 1428, usar conteúdo das notas da MIA no Pipedrive como texto da conversa
- **Sem dados suficientes:** se nem nota MIA nem mensagens Metabase disponíveis, classificar como "sem dados suficientes" e listar separadamente

### 4. Análise de consistência (Claude)
Para cada deal, avaliar:
- **Input:** `lost_reason` + texto da conversa (ou resumo da nota MIA)
- **Output:** classificação + justificativa curta (1-2 linhas)
  - ✅ `consistente` — motivo bate com a conversa
  - ⚠️ `duvidoso` — motivo parcialmente justificado, mas ambíguo
  - 🚨 `inconsistente` — conversa contradiz o motivo do lost
  - ❓ `sem dados` — não foi possível obter a conversa
- Deals com `lost_reason` vazio → classificar diretamente como `duvidoso`

### 5. Agrupamento por pipeline (IDs verificados em 2026-04-07)
| Pipeline ID | Nome |
|-------------|------|
| 14 | Comercial SZS |
| 28 | Vendas Spot |
| 37 | Marketplace |
| 44 | Comercial Decor |
| 13 | Franquias |
| 7 | Prospecção Parceiros |
| 31 | Prospecção Expansão |
| outros | nome via Pipedrive |

---

## Formato do Relatório (Slack)

### Canal
`#feedback-losts-mia` (ID: `C0ARALB7PT4`)

### Mensagem principal
```
🤖 Losts da MIA — Semana DD/Mês a DD/Mês

📊 Total por funil:
• Comercial SZS: N losts
• Vendas Spot: N losts
• Marketplace: N losts
• Comercial Decor: N losts
• Franquias: N losts
(apenas funis com losts aparecem)

🚨 Suspeitos: N casos com divergência entre conversa e motivo
↓ ver detalhes na thread
```

Se não houver suspeitos: "✅ Nenhum caso suspeito encontrado esta semana."

### Thread (um bloco por caso ⚠️ ou 🚨)
Limite: máximo 20 casos na thread. Se houver mais, incluir ao final: "_...e mais N casos. Filtrar no Pipedrive: [link]._"

```
⚠️ Deal #ID – Nome do Lead (Pipeline)
Stage: [nome do stage] | Motivo MIA: "[lost_reason]"
Conversa: [resumo da divergência em 1-2 linhas]
🔗 Pipedrive: https://seazone-fd92b9.pipedrive.com/deal/{id}
🔗 Morada: https://app.morada.ai/conversations/{conversa_id}
```

Se `conversation_link` não disponível:
```
🔗 Morada: conversa_id {conversa_id} (sem link direto)
```

Se nem conversa_id disponível:
```
🔗 Morada: não encontrado (verificar manualmente)
```

---

## Dados Técnicos

### Pipedrive
- Base URL: `https://seazone-fd92b9.pipedrive.com/v1`
- Auth: `?api_token={PIPEDRIVE_API_TOKEN}` (via `.env`)
- MIA user_id: `21490680` | email: `integracoes@morada.ai`
- **ATENÇÃO:** `pipeline_id` é ignorado para `status=lost` — sempre filtrar client-side

### Metabase Morada
- Base URL: `https://metabase.morada.ai`
- Auth: header `x-api-key` com valor de `METABASE_MORADA_API_KEY` (via `.env`)
- Card conversas: `1427` | Card mensagens: `1428`
- Limite: 2000 rows/card — suficiente para janela semanal com fallback garantido
- **REGRA:** usar `POST /api/card/{id}/query`, NÃO usar Composio, NÃO usar `/api/dataset` (sem permissão)

### Slack
- Canal: `#feedback-losts-mia` (ID: `C0ARALB7PT4`)
- Bot token: `SLACK_BOT_TOKEN` (via `.env`)
- Confirmar que o bot tem permissão no canal antes do primeiro envio

---

## Entregáveis

1. `~/.claude/commands/relatorio-mia-losts.md` — slash command
2. Adicionar `METABASE_MORADA_API_KEY` ao `~/Claude-Code/saleszone/scripts/monitor-atendimento/.env`
3. `~/Library/LaunchAgents/com.seazone.relatorio-mia-losts.plist` — agendamento launchd com `WorkingDirectory` correto
