# Relatório Semanal Losts da MIA — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar slash command `/relatorio-mia-losts` que gera relatório semanal dos deals marcados como lost pela MIA (Morada - Mia) no Pipedrive, analisa se o motivo bate com a conversa e posta no canal `#feedback-losts-mia`.

**Architecture:** Slash command Claude (`~/.claude/commands/relatorio-mia-losts.md`) que orquestra: leitura de tokens do `.env` → coleta Pipedrive → cruzamento Metabase → análise Claude → envio Slack. Launchd executa toda segunda às 08:30 via `claude -p /relatorio-mia-losts`.

**Tech Stack:** Claude Code slash command (markdown), curl (Pipedrive REST + Metabase REST), Slack MCP (`slack_send_message`), macOS launchd.

---

## Chunk 1: Preparação de ambiente e slash command

### Task 1: Adicionar METABASE_MORADA_API_KEY ao .env

**Files:**
- Modify: `~/Claude-Code/saleszone/scripts/monitor-atendimento/.env`

- [ ] **Step 1: Verificar se a chave já existe no .env**

```bash
grep "METABASE" ~/Claude-Code/saleszone/scripts/monitor-atendimento/.env
```

Expected: linha vazia (chave ausente) ou `METABASE_API_KEY=...` (chave com nome diferente)

- [ ] **Step 2: Adicionar METABASE_MORADA_API_KEY ao .env**

Abrir `~/Claude-Code/saleszone/scripts/monitor-atendimento/.env` e adicionar ao final:

```
METABASE_MORADA_API_KEY=mb_DNSFJ0tq1BareTB+1gRGCQ7I2u3k39uwyYFoSfGG4q0=
```

- [ ] **Step 3: Verificar que a chave foi adicionada**

```bash
grep "METABASE_MORADA_API_KEY" ~/Claude-Code/saleszone/scripts/monitor-atendimento/.env
```

Expected: `METABASE_MORADA_API_KEY=mb_DNSFJ0tq1BareTB+1gRGCQ7I2u3k39uwyYFoSfGG4q0=`

---

### Task 2: Criar o slash command

**Files:**
- Create: `~/.claude/commands/relatorio-mia-losts.md`

O arquivo é uma instrução em markdown para o Claude executar. Deve conter todas as etapas de forma clara e auto-contida.

- [ ] **Step 1: Criar o arquivo `~/.claude/commands/relatorio-mia-losts.md` com o conteúdo abaixo**

```markdown
# Relatório Semanal — Losts da MIA

Você é um agente que gera o relatório semanal de deals marcados como lost pela MIA (bot da Morada.ai) no Pipedrive, identifica inconsistências entre o motivo do lost e a conversa real, e posta o resultado no canal #feedback-losts-mia.

## Etapa 0 — Carregar tokens

Leia o arquivo `~/Claude-Code/saleszone/scripts/monitor-atendimento/.env` e extraia:
- `PIPEDRIVE_API_TOKEN`
- `SLACK_BOT_TOKEN`
- `METABASE_MORADA_API_KEY`

## Etapa 1 — Calcular janela semanal

Calcule a janela da semana anterior:
- `inicio`: segunda-feira da semana anterior (00:00:00)
- `fim`: domingo da semana anterior (23:59:59)

Exemplo: se hoje é 07/04/2026 (terça), a janela é 31/03/2026 a 06/04/2026.

Formatos:
- Para exibição: `DD/Mês a DD/Mês` (ex: "31/Mar a 06/Abr")
- Para comparação com `lost_time` do Pipedrive: `YYYY-MM-DD`

## Etapa 2 — Buscar deals lost no Pipedrive

Buscar todos os deals com `status=lost` na janela calculada. O Pipedrive ordena por `lost_time DESC`.

Paginar enquanto `lost_time` do último deal retornado for >= `inicio` da janela:

```bash
curl -s "https://seazone-fd92b9.pipedrive.com/v1/deals?status=lost&sort=lost_time%20DESC&start={OFFSET}&limit=500&api_token={PIPEDRIVE_API_TOKEN}"
```

**ATENÇÃO:** `pipeline_id` é IGNORADO pela API para deals lost — filtrar por `pipeline_id` client-side.

Para cada deal retornado com `lost_time` dentro da janela, guardar:
- `id`, `title`, `pipeline_id`, `stage_id`, `stage_order_nr`, `owner_name`, `lost_reason`, `lost_time`

## Etapa 3 — Identificar losts da MIA

Para cada deal da janela, buscar as notas:

```bash
curl -s "https://seazone-fd92b9.pipedrive.com/v1/deals/{DEAL_ID}/notes?api_token={PIPEDRIVE_API_TOKEN}"
```

Deal é "da MIA" se tiver **qualquer nota com `user_id: 21490680`** (Morada - Mia, integracoes@morada.ai).

Para cada deal da MIA, guardar também o `content` das notas com `user_id: 21490680` — esse é o resumo da conversa.

Se nenhum deal da MIA for encontrado na janela, enviar no Slack:
> "✅ Sem losts da MIA na semana de {inicio} a {fim}."

E encerrar.

## Etapa 4 — Mapear pipeline_id para nome

| pipeline_id | nome |
|-------------|------|
| 14 | Comercial SZS |
| 28 | Vendas Spot |
| 37 | Marketplace |
| 44 | Comercial Decor |
| 13 | Franquias |
| 7 | Prospecção Parceiros |
| 31 | Prospecção Expansão |
| outros | buscar nome via `/pipelines/{id}` |

## Etapa 5 — Buscar conversas no Metabase

Fazer uma única chamada para cada card (não chamar por deal):

```bash
# Card 1427 — Conversas (deal_id_externo)
curl -s -X POST \
  -H "x-api-key: {METABASE_MORADA_API_KEY}" \
  -H "Content-Type: application/json" \
  "https://metabase.morada.ai/api/card/1427/query"

# Card 1428 — Mensagens
curl -s -X POST \
  -H "x-api-key: {METABASE_MORADA_API_KEY}" \
  -H "Content-Type: application/json" \
  "https://metabase.morada.ai/api/card/1428/query"
```

O response de cada card tem formato:
```json
{"data": {"cols": [{"name": "coluna1"}, ...], "rows": [[val1, val2, ...], ...]}}
```

Do card 1427, para cada deal da MIA:
- Inspecionar `response.data.cols[*].name` para confirmar o nome do campo de cruzamento (esperado: `deal_id_externo`). Se o nome diferir, usar o campo correto encontrado no response — não abortar.
- Localizar rows onde esse campo == deal_id do Pipedrive
- Extrair `conversa_id` e `conversation_link`

Do card 1428, para cada `conversa_id` encontrado:
- Filtrar mensagens por `conversa_id`
- Ordenar por `enviada_em`
- Concatenar campo `conteudo` de cada mensagem para formar o texto da conversa

Se um deal não for encontrado no card 1427, ou se não houver mensagens no card 1428:
- Usar o conteúdo das notas da MIA (Etapa 3) como texto da conversa
- Marcar `conversation_link` como `null`

Se nem notas nem Metabase disponíveis: classificar como `sem_dados`.

## Etapa 6 — Analisar consistência

Para cada deal da MIA, avaliar:

**Input:**
- `lost_reason`: motivo registrado pela MIA
- `conversa`: texto da conversa (Metabase) ou resumo da nota MIA

**Critério de avaliação:**
- `consistente` (✅): o motivo bate com o que foi dito na conversa
- `duvidoso` (⚠️): motivo parcialmente justificado ou ambíguo
- `inconsistente` (🚨): a conversa contradiz o motivo do lost
- `sem_dados` (❓): não foi possível obter a conversa

**Casos automáticos:**
- `lost_reason` vazio ou null → classificar como `duvidoso` sem precisar analisar

Para os casos `duvidoso` e `inconsistente`, gerar uma justificativa curta (1-2 linhas) explicando a divergência.

## Etapa 7 — Montar e enviar relatório no Slack

**Canal:** `#feedback-losts-mia` (ID: `C0ARALB7PT4`)

### Mensagem principal

Agrupar totais por pipeline. Exibir apenas pipelines com losts.

```
🤖 Losts da MIA — Semana {inicio_formatado} a {fim_formatado}

📊 Total por funil:
• {pipeline_nome}: {N} losts
• ...

🚨 Suspeitos: {N} casos com divergência entre conversa e motivo
↓ ver detalhes na thread
```

Se não houver suspeitos:
```
✅ Nenhum caso suspeito encontrado esta semana.
```

Enviar via Slack MCP (`slack_send_message`, canal `C0ARALB7PT4`). Guardar o `ts` da mensagem para responder na thread.

### Thread — casos suspeitos

Incluir apenas `duvidoso` e `inconsistente`. Ordenar: `inconsistente` primeiro, depois `duvidoso`.

**Limite: máximo 20 casos.** Se houver mais, adicionar ao final:
> `_...e mais {N} casos. Filtrar no Pipedrive por lost_time na semana._`

Para cada caso, enviar como **reply na thread** da mensagem principal:

```
{emoji} Deal #{id} – {title} ({pipeline_nome})
Stage: {stage_name} | Motivo MIA: "{lost_reason}"
{justificativa_divergencia}
🔗 Pipedrive: https://seazone-fd92b9.pipedrive.com/deal/{id}
🔗 Morada: {conversation_link}
```

Se `conversation_link` for null mas `conversa_id` disponível:
```
🔗 Morada: conversa_id {conversa_id} (sem link direto)
```

Se nem conversa_id disponível:
```
🔗 Morada: não encontrado (verificar manualmente)
```

Onde `{emoji}` = 🚨 para `inconsistente`, ⚠️ para `duvidoso`.

## Regras

- Buscar card 1427 e card 1428 do Metabase UMA VEZ cada (não por deal)
- Se a API do Pipedrive retornar erro em algum deal, pular e continuar
- Tom direto, sem floreios — dados e links acionáveis
- Se o Slack falhar, reportar o erro mas não encerrar o comando com erro silencioso
```

- [ ] **Step 2: Verificar que o arquivo foi criado**

```bash
ls -la ~/.claude/commands/relatorio-mia-losts.md
```

Expected: arquivo listado com tamanho > 0

- [ ] **Step 3: Verificar estrutura do arquivo (primeiras e últimas linhas)**

```bash
head -3 ~/.claude/commands/relatorio-mia-losts.md
tail -3 ~/.claude/commands/relatorio-mia-losts.md
```

Expected: começa com `# Relatório Semanal`, termina com conteúdo do bloco de Regras

---

### Task 3: Teste manual do slash command

- [ ] **Step 1: Executar o slash command manualmente**

No Claude Code, rodar: `/relatorio-mia-losts`

- [ ] **Step 2: Verificar execução — tokens carregados**

Observar se o Claude leu o `.env` e extraiu os tokens sem erro.

- [ ] **Step 3: Verificar execução — janela semanal correta**

Confirmar que a janela calculada é segunda a domingo da semana anterior.

- [ ] **Step 4: Verificar execução — deals Pipedrive**

Confirmar que o Claude buscou deals e identificou os da MIA (user_id 21490680).

- [ ] **Step 5: Verificar execução — Metabase**

Confirmar que o Claude chamou os cards 1427 e 1428 e cruzou por `deal_id_externo`.

- [ ] **Step 6: Verificar execução — mensagem Slack enviada**

Acessar `#feedback-losts-mia` no Slack e confirmar que a mensagem chegou com o formato correto.

- [ ] **Step 7: Verificar execução — thread com suspeitos**

Confirmar que cada caso suspeito tem emoji correto, links Pipedrive e Morada.

---

## Chunk 2: Automação launchd

### Task 4: Criar plist launchd

**Files:**
- Create: `~/Library/LaunchAgents/com.seazone.relatorio-mia-losts.plist`

- [ ] **Step 1: Criar o arquivo plist**

Criar `~/Library/LaunchAgents/com.seazone.relatorio-mia-losts.plist` com o conteúdo:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.seazone.relatorio-mia-losts</string>

    <key>ProgramArguments</key>
    <array>
        <string>/bin/zsh</string>
        <string>-c</string>
        <string>cd ~/Claude-Code/saleszone/scripts/monitor-atendimento && claude -p /relatorio-mia-losts 2>&1</string>
    </array>

    <key>StartCalendarInterval</key>
    <dict>
        <key>Weekday</key>
        <integer>1</integer>
        <key>Hour</key>
        <integer>8</integer>
        <key>Minute</key>
        <integer>30</integer>
    </dict>

    <key>StandardOutPath</key>
    <string>/Users/joaopedrocoutinho/Library/Logs/relatorio-mia-losts.log</string>

    <key>StandardErrorPath</key>
    <string>/Users/joaopedrocoutinho/Library/Logs/relatorio-mia-losts.log</string>

    <key>RunAtLoad</key>
    <false/>
</dict>
</plist>
```

**Nota:** `cd` antes do comando garante que o `WorkingDirectory` seja o do `monitor-atendimento`, onde o `.env` com os tokens está localizado.

- [ ] **Step 2: Verificar syntax do plist antes de carregar**

```bash
plutil -lint ~/Library/LaunchAgents/com.seazone.relatorio-mia-losts.plist
```

Expected: `~/Library/LaunchAgents/com.seazone.relatorio-mia-losts.plist: OK`

- [ ] **Step 3: Carregar o plist no launchd**

```bash
launchctl load ~/Library/LaunchAgents/com.seazone.relatorio-mia-losts.plist
```

Expected: sem output (sucesso silencioso)

- [ ] **Step 4: Verificar que o job está registrado**

```bash
launchctl list | grep relatorio-mia-losts
```

Expected: linha contendo `com.seazone.relatorio-mia-losts`

- [ ] **Step 5: Commit dos artefatos**

```bash
cd ~/Claude-Code/saleszone
git add docs/superpowers/specs/2026-04-07-relatorio-mia-losts-design.md
git add docs/superpowers/plans/2026-04-07-relatorio-mia-losts.md
git commit -m "feat: adicionar spec e plano do relatorio semanal losts da MIA"
```

---

## Referências

- **Spec:** `docs/superpowers/specs/2026-04-07-relatorio-mia-losts-design.md`
- **Tokens:** `~/Claude-Code/saleszone/scripts/monitor-atendimento/.env`
- **Padrão de slash command existente:** `~/.claude/commands/heartbeat-comercial.md`
- **Padrão de plist existente:** `~/Library/LaunchAgents/com.seazone.monitor-atendimento.plist`
- **MIA user_id Pipedrive:** `21490680` | email: `integracoes@morada.ai`
- **Canal Slack:** `#feedback-losts-mia` (ID: `C0ARALB7PT4`)
- **Metabase cards:** 1427 (conversas), 1428 (mensagens)
