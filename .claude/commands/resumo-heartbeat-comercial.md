# Resumo Heartbeat Comercial

Lê as mensagens mais recentes dos 4 canais de heartbeats comerciais no Slack e gera um resumo executivo consolidado dos principais problemas e atualizações reportados pelo time comercial.

## Parâmetros

- `$ARGUMENTS` (opcional): período em dias para buscar (default: 7). Ex: `/resumo-heartbeat-comercial 14` busca últimos 14 dias.

## Instruções

### 1. Calcular timestamp de corte

```
dias = $ARGUMENTS ou 7 se vazio
oldest_timestamp = timestamp Unix de (hoje - dias)
```

Usar Python para calcular: `python3 -c "from datetime import datetime, timedelta; print(int((datetime.now() - timedelta(days=DIAS)).timestamp()))"`

### 2. Buscar mensagens dos 4 canais

Ler TODOS os 4 canais em paralelo:

| Canal | ID |
|-------|-----|
| #heartbeats-comercial | `C08AE1Y6BGR` |
| #heartbeats-comercial-szi-cro | `C0ANV4SP38Q` |
| #heartbeats-comercial-szs-cro | `C0AN63WCQ30` |
| #heartbeats-comercial-decor-cro | `C0AN85JLRL2` |

Usar a tool `mcp__claude_ai_Slack__slack_read_channel` para cada canal com:
- `channel_id`: ID do canal
- `oldest`: timestamp calculado acima (string)
- `limit`: 100
- `response_format`: `detailed`

Se o resultado for muito grande para ler diretamente, será salvo em arquivo. Nesse caso, ler o arquivo completo em chunks sequenciais antes de resumir.

### 3. Ler threads importantes

Para mensagens que indicam threads (ex: "Thread: N replies"), ler a thread completa usando `mcp__claude_ai_Slack__slack_read_thread` com o `message_ts` da mensagem pai. Priorizar threads com mais respostas.

### 4. Gerar resumo

Produzir um resumo executivo consolidado com:

#### Formato de saída

```
## Resumo Heartbeat Comercial — DD/MM a DD/MM/YYYY

### 🔴 Top 5 Problemas Críticos
1. **[Área/Canal] Título do problema** — descrição concisa do impacto e status
2. ...

### 🟡 Pontos de Atenção
- Item que requer monitoramento mas não é crítico ainda

### 🟢 Progressos Positivos
- Entregas concluídas ou marcos atingidos

### 📊 Resumo por Vertical
| Vertical | Canal | Status Geral | Destaques |
|----------|-------|-------------|-----------|
| Geral | #heartbeats-comercial | 🔴/🟡/🟢 | ... |
| SZI | #heartbeats-comercial-szi-cro | 🔴/🟡/🟢 | ... |
| SZS | #heartbeats-comercial-szs-cro | 🔴/🟡/🟢 | ... |
| Decor | #heartbeats-comercial-decor-cro | 🔴/🟡/🟢 | ... |
```

#### Regras de análise
- **Problemas críticos**: queda de conversão, deals travados, falta de leads, problemas de alinhamento entre squads, closers com performance abaixo, pipeline estagnado, atrasos em follow-up
- **Pontos de atenção**: metas em risco, dependências de outras áreas, processos que podem atrasar
- **Progressos**: vendas fechadas (WON), reservas, melhorias de processo, novos deals avançando no funil
- Consolidar os 4 canais em um único resumo — não repetir informações duplicadas entre canais
- Identificar padrões recorrentes entre as verticais (SZI, SZS, Decor)
- Destacar itens que requerem decisão da liderança
- Usar linguagem direta e objetiva, sem repetir o texto original
- Quando houver métricas (conversão, deals, valores), incluir os números
