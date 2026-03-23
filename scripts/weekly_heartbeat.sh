#!/bin/bash
# Weekly Heartbeat Summary — runs every Friday at 18h BRT
# Reads Slack channels, summarizes with Claude, sends DM via Heartbeats app

cd /Users/matheusambrosi/Claude-Code/saleszone

source /Users/matheusambrosi/Claude-Code/saleszone/.env.local 2>/dev/null
export HEARTBEATS_SLACK_TOKEN="${HEARTBEATS_SLACK_TOKEN:-}"
export HEARTBEATS_USER_ID="U0625PXJC4Q"

claude -p "
Rode as 5 skills de heartbeat e me envie os resumos via o app Heartbeats no Slack.

1. Leia o canal #heartbeats-szni (C06HZSR1LCF) dos ultimos 7 dias e gere o resumo executivo conforme a skill /resumo-heartbeat
2. Leia o canal #heartbeats-marketing (C04QY0ALXAS) dos ultimos 7 dias e gere o resumo conforme a skill /resumo-heartbeat-mkt
3. Leia os 4 canais comerciais dos ultimos 7 dias e gere o resumo conforme a skill /resumo-heartbeat-comercial:
   - #heartbeats-comercial (C08AE1Y6BGR)
   - #heartbeats-comercial-szi-cro (C0ANV4SP38Q)
   - #heartbeats-comercial-szs-cro (C0AN63WCQ30)
   - #heartbeats-comercial-decor-cro (C0AN85JLRL2)
4. Leia o canal #heartbeats-marketplace (C0AN9SUPY5P) dos ultimos 7 dias e gere o resumo conforme a skill /resumo-heartbeat-mktp
5. Leia o canal #heartbeats-cro (C06SLRZVBTL) dos ultimos 7 dias e gere o resumo conforme a skill /resumo-heartbeat-cro

Para CADA resumo, envie via curl usando o app Heartbeats:

curl -s https://slack.com/api/chat.postMessage \
  -H \"Authorization: Bearer \$HEARTBEATS_SLACK_TOKEN\" \
  -H \"Content-Type: application/json\" \
  -d '{
    \"channel\": \"\$HEARTBEATS_USER_ID\",
    \"text\": \"CONTEUDO_DO_RESUMO\",
    \"username\": \"Heartbeats\",
    \"icon_emoji\": \":clipboard:\"
  }'

Envie 5 mensagens separadas:
- Mensagem 1: titulo 'Resumo SZNI - DD/MM/YYYY' + top 5 problemas + pontos de atencao + progressos
- Mensagem 2: titulo 'Resumo Marketing - DD/MM/YYYY' + top 5 problemas + pontos de atencao + progressos
- Mensagem 3: titulo 'Resumo Comercial - DD/MM/YYYY' + top 5 problemas + pontos de atencao + progressos + resumo por vertical
- Mensagem 4: titulo 'Resumo Marketplace - DD/MM/YYYY' + top 5 problemas + pontos de atencao + progressos
- Mensagem 5: titulo 'Resumo CRO - DD/MM/YYYY' + top 5 problemas + pontos de atencao + progressos

Nao use emojis unicode. Use texto simples com *bold* para titulos. Escape aspas duplas no JSON.
" 2>&1 >> /tmp/weekly_heartbeat.log
