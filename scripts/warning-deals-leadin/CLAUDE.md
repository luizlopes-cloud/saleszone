# Warning Deals Lead in — Agente de Alerta

## O que faz
Script Python que roda automaticamente (seg-sex, 9h) e envia alerta no Slack com deals parados há mais de 60h no estágio "Lead in" do funil "Comercial SZS" no Pipedrive.

## Arquivos
- `config.py` — Todos os parâmetros editáveis (tokens, canal, executivos, thresholds)
- `warning_deals_leadin.py` — Script principal
- `logs/` — Logs de execução diária

## Agendamento
- **Método**: macOS launchd
- **Plist**: `~/Library/LaunchAgents/com.seazone.warning-deals-leadin.plist`
- **Quando**: Seg a Sex, 09:00
- **Verificar**: `launchctl list | grep seazone`
- **Recarregar**: `launchctl unload ~/Library/LaunchAgents/com.seazone.warning-deals-leadin.plist && launchctl load ~/Library/LaunchAgents/com.seazone.warning-deals-leadin.plist`

## Slack Bot
- **App**: analista pré-vendas (A097Y3V5JFK)
- **Bot user**: analista.pre.vendas (U097HEUU0VB)
- **Escopos**: channels:history, chat:write
- **Canal**: #szs-parcerias-comercial (C09AK6B3SSY)
- O bot DEVE estar adicionado ao canal para funcionar

## Regras
- Sempre editar `config.py` para ajustar parâmetros — nunca o script principal
- Ao adicionar/remover executivos, atualizar `EXEC_SLACK_MAP` no config
- O nome do executivo DEVE ser idêntico ao Pipedrive
- Nunca hardcodar tokens fora do config.py
- Testar manualmente antes de alterar agendamento: `cd ~/Claude-Code/warning-deals-leadin && python3 warning_deals_leadin.py`
