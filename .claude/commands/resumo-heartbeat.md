# Resumo Heartbeat SZNI

Lê as mensagens mais recentes do canal privado **#heartbeats-szni** (Seazone Investimentos) no Slack e gera um resumo executivo dos principais problemas e atualizações reportados pelo time.

## Parâmetros

- `$ARGUMENTS` (opcional): período em dias para buscar (default: 7). Ex: `/resumo-heartbeat 14` busca últimos 14 dias.

## Instruções

### 1. Calcular timestamp de corte

```
dias = $ARGUMENTS ou 7 se vazio
oldest_timestamp = timestamp Unix de (hoje - dias)
```

Usar Python para calcular: `python3 -c "from datetime import datetime, timedelta; print(int((datetime.now() - timedelta(days=DIAS)).timestamp()))"`

### 2. Buscar mensagens do canal

Canal: **#heartbeats-szni** — ID: `C06HZSR1LCF` (canal privado)

Usar a tool `mcp__claude_ai_Slack__slack_read_channel` com:
- `channel_id`: `C06HZSR1LCF`
- `oldest`: timestamp calculado acima (string)
- `limit`: 100
- `response_format`: `detailed`

Se o resultado for muito grande para ler diretamente, será salvo em arquivo. Nesse caso, ler o arquivo completo em chunks sequenciais antes de resumir.

### 3. Ler threads importantes

Para mensagens que indicam threads (ex: "Thread: N replies"), ler a thread completa usando `mcp__claude_ai_Slack__slack_read_thread` com o `message_ts` da mensagem pai. Priorizar threads com mais respostas.

### 4. Gerar resumo

Produzir um resumo executivo com:

#### Formato de saída

```
## Resumo Heartbeat SZNI — DD/MM a DD/MM/YYYY

### 🔴 Top 5 Problemas Críticos
1. **[Área] Título do problema** — descrição concisa do impacto e status
2. ...

### 🟡 Pontos de Atenção
- Item que requer monitoramento mas não é crítico ainda

### 🟢 Progressos Positivos
- Entregas concluídas ou marcos atingidos

### 📊 Resumo por Área
| Área | Responsável | Status Geral |
|------|------------|-------------|
| Engenharia | Nome | 🔴/🟡/🟢 |
| ... | ... | ... |
```

#### Regras de análise
- **Problemas críticos**: atrasos >30 dias, estouros de orçamento, bloqueios legais/licenciamento, riscos de paralização, escassez de pipeline
- **Pontos de atenção**: prazos apertados, dependências externas, processos que podem atrasar
- **Progressos**: entregas concluídas, aprovações obtidas, marcos atingidos
- Identificar padrões recorrentes entre as áreas
- Destacar itens que requerem decisão da liderança
- Usar linguagem direta e objetiva, sem repetir o texto original
- Agrupar problemas relacionados (ex: vários atrasos de obra = 1 bullet consolidado)
