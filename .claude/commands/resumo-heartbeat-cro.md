# Resumo Heartbeat CRO

Lê as mensagens mais recentes do canal privado **#heartbeats-cro** no Slack e gera um resumo executivo dos principais problemas e atualizações reportados pelo time de CRO.

## Parâmetros

- `$ARGUMENTS` (opcional): período em dias para buscar (default: 7). Ex: `/resumo-heartbeat-cro 14` busca últimos 14 dias.

## Instruções

### 1. Calcular timestamp de corte

```
dias = $ARGUMENTS ou 7 se vazio
oldest_timestamp = timestamp Unix de (hoje - dias)
```

Usar Python para calcular: `python3 -c "from datetime import datetime, timedelta; print(int((datetime.now() - timedelta(days=DIAS)).timestamp()))"`

### 2. Buscar mensagens do canal

Canal: **#heartbeats-cro** — ID: `C06SLRZVBTL` (canal privado)

Usar a tool `mcp__claude_ai_Slack__slack_read_channel` com:
- `channel_id`: `C06SLRZVBTL`
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
## Resumo Heartbeat CRO — DD/MM a DD/MM/YYYY

### 🔴 Top 5 Problemas Críticos
1. **[Área] Título do problema** — descrição concisa do impacto e status
2. ...

### 🟡 Pontos de Atenção
- Item que requer monitoramento mas não é crítico ainda

### 🟢 Progressos Positivos
- Entregas concluídas ou marcos atingidos

### 📊 Resumo por Área/Pessoa
| Área | Responsável | Status Geral |
|------|------------|-------------|
| Área X | Nome | 🔴/🟡/🟢 |
| ... | ... | ... |
```

#### Regras de análise
- **Problemas críticos**: bloqueios de processo, atrasos em entregas, problemas de conversão, gargalos operacionais, dependências não resolvidas
- **Pontos de atenção**: metas em risco, dependências de outras áreas, processos que podem atrasar
- **Progressos**: entregas concluídas, marcos atingidos, melhorias de processo, automações implementadas
- Identificar padrões recorrentes entre as áreas
- Destacar itens que requerem decisão da liderança
- Usar linguagem direta e objetiva, sem repetir o texto original
- Quando houver métricas, incluir os números no resumo
