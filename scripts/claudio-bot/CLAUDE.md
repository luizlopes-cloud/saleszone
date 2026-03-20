# Claudio — Bot de Alertas de Deals sem Atividade

## O que faz
Script Python que roda automaticamente (seg-sex, 8h) e envia alertas nos canais #warning-comercial-* do Slack com deals abertos no Pipedrive que nao tem proxima atividade agendada ou com atividade atrasada.

## Arquivos
- `config.py` — Todos os parametros editaveis (tokens, pipelines, equipes, gestores)
- `claudio.py` — Script principal
- `relatorio_semanal.py` — Relatorio semanal comparativo (seg vs sex)
- `snapshots/` — Snapshots diarios (JSON) para o relatorio semanal
- `logs/` — Logs de execucao diaria

## Uso
```bash
cd ~/Claude-Code/claudio-bot
python3 claudio.py --now              # Producao
python3 claudio.py --now --test       # Canal #supervisor-claudio
python3 claudio.py --now --dry-run    # Apenas loga
python3 relatorio_semanal.py --now              # Relatorio semanal (DM JP)
python3 relatorio_semanal.py --now --test       # Relatorio no #supervisor-claudio
```

## Agendamento
- **Metodo**: macOS launchd
- **Plist**: `~/Library/LaunchAgents/com.seazone.claudio-bot.plist`
- **Quando**: Seg a Sex, 08:00
- **Verificar**: `launchctl list | grep claudio`
- **Recarregar**: `launchctl unload ~/Library/LaunchAgents/com.seazone.claudio-bot.plist && launchctl load ~/Library/LaunchAgents/com.seazone.claudio-bot.plist`

## Slack App
- **App**: Claudio
- **Escopos**: chat:write, chat:write.customize
- **Canais**: #warning-comercial-szs, #warning-comercial-szi, #warning-comercial-mkp, #warning-comercial-decor
- **Teste**: #supervisor-claudio (C0AJXPJKJ4E)
- O bot DEVE estar adicionado a cada canal para funcionar

## Pipelines monitorados
| Key   | Pipeline             | Canal Slack               |
|-------|---------------------|---------------------------|
| SZS   | Comercial SZS       | #warning-comercial-szs    |
| DECOR | Comercial Decor      | #warning-comercial-decor  |
| SZI   | Comercial SZI        | #warning-comercial-szi    |
| MKT   | Comercial Marketplace| #warning-comercial-mkp    |

## Classificacao de deals (alinhada com dashboard Supervisor Claudio)
Duas categorias de alerta:

1. **sem_atividade** (🔴) — `next_activity_date` e null/vazio
2. **atrasados** (🟡) — `next_activity_date` no passado com `f > 1` (formula do dashboard: `f = floor((today_midnight - eod_next_act) / 86400)`)

Filtros:
- `status == 'open'`
- `owner_name` NAO esta em `EXCLUDED_OWNERS` (espelho do array `di[]` do dashboard)
- **NAO filtra por PIPELINE_USERS** — o dashboard conta TODOS os owners nao-excluidos por pipeline

## Regras
- Sempre editar `config.py` para ajustar parametros — nunca o script principal
- Ao adicionar/remover membros do time, atualizar `TEAM_MAP` no config
- O nome do owner DEVE ser identico ao Pipedrive
- Owners nao mapeados recebem role PV por default e sao logados como info
- Rate limit: 1 segundo entre mensagens Slack
- Retry Pipedrive: 3x com backoff exponencial (2s, 4s, 8s)
- O endpoint correto da API Pipedrive e `pipelines/{id}/deals` (NAO `deals?pipeline_id=`)

## Licoes aprendidas
- EXCLUDED_OWNERS deve espelhar EXATAMENTE o array `di[]` do dashboard JS
- O dashboard NAO usa a aba Configuracoes para filtrar totais dos cards por pipeline
- Os cards do dashboard mostram APENAS "sem atividade" (stalled), NAO "atrasados" (overdue)
- "Sem atividade programada: 141" = soma dos cards = TODOS os owners nao-excluidos
- "Atividade atrasada: 213" = tab separada no dashboard
- PIPELINE_USERS existe no config mas NAO e usado no classify_deals (mantido para referencia)
