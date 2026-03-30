# Monitor de Atendimento Seazone

## O que faz
Script Python que coleta métricas de atendimento de múltiplas fontes (Timelines.ai,
Api4Com, Fireflies, Metabase Morada) e grava no Supabase. Gera alertas via Slack DM
quando vendedores desviam da mediana do time.

## Stack
- Python 3 (stdlib only — sem dependências externas)
- Supabase PostgreSQL (via REST API)
- Slack API (chat.postMessage)

## Arquivos
- `config.py` — TODOS os parâmetros editáveis (tokens, equipe, thresholds)
- `collector.py` — Entry point
- `collectors/` — Fetch de cada fonte (timelines, api4com, fireflies, metabase, calendar)
- `analyzers/` — Cálculo de métricas, alertas, scores
- `outputs/` — Supabase upsert + Slack DM
- `tests/` — Testes unitários dos analyzers
- `logs/` — Logs diários YYYY-MM-DD.log

## Execução
```bash
python3 collector.py --now                    # Produção (ontem)
python3 collector.py --now --date 2026-03-14  # Data específica
python3 collector.py --now --dry-run           # Apenas log
python3 collector.py --now --test              # Dados mockados
```

## Agendamento
- **Método**: macOS launchd
- **Plist**: `~/Library/LaunchAgents/com.seazone.monitor-atendimento.plist`
- **Quando**: Seg a Sex, 07:00
- **Verificar**: `launchctl list | grep monitor-atendimento`

## Regras
- Sempre editar `config.py` para ajustar parâmetros — nunca o script principal
- Nomes devem ser idênticos ao Pipedrive/Timelines (case-sensitive)
- Email é a chave de cruzamento entre todas as ferramentas
- Sem dependências externas (apenas stdlib Python 3)
- Alertas baseados em mediana do time (não valores fixos)
- Retry 3x com backoff exponencial em toda chamada HTTP

## Lições Aprendidas
- **Timelines.ai API URL:** NUNCA usar `api.timelines.ai` (DNS NXDOMAIN). URL real: `app.timelines.ai/integrations/api`
- **Timelines.ai Auth:** usar `Authorization: Bearer {token}`, NÃO `X-API-KEY`
- **Timelines.ai Response:** formato `{"status":"ok","data":{"chats":[...]}}`, NÃO lista direta
- **Timelines.ai Timestamp:** campo `timestamp` (formato `"2023-04-25 17:14:49 -0300"`), NÃO `created_at`
- **Cloudflare:** sempre enviar User-Agent nas requests HTTP para evitar bloqueio 1010
