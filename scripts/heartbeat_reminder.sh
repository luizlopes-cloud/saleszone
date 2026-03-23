#!/bin/bash
# Thursday morning reminder — notify all heartbeat channels
# Sends @channel reminder to post heartbeats by end of day

TOKEN="${HEARTBEATS_SLACK_TOKEN:-}"
if [ -z "$TOKEN" ]; then
  source /Users/matheusambrosi/Claude-Code/saleszone/.env.local 2>/dev/null
  TOKEN="${HEARTBEATS_SLACK_TOKEN:-}"
fi
if [ -z "$TOKEN" ]; then echo "ERROR: HEARTBEATS_SLACK_TOKEN not set"; exit 1; fi

CHANNELS=(
  "C06SLRZVBTL"   # heartbeats-cro
  "C04QY0ALXAS"   # heartbeats-marketing
  "C08AE1Y6BGR"   # heartbeats-comercial
  "C0ANV4SP38Q"   # heartbeats-comercial-szi-cro
  "C0AN63WCQ30"   # heartbeats-comercial-szs-cro
  "C0AN85JLRL2"   # heartbeats-comercial-decor-cro
  "C0AN9SUPY5P"   # heartbeats-marketplace
)

MSG="<!channel> Lembrete: enviem seu heartbeat semanal ate o final do dia de hoje (quinta-feira). 5 bullet points objetivos sobre os principais desafios e progressos da semana."

for CH in "${CHANNELS[@]}"; do
  curl -s "https://slack.com/api/chat.postMessage" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"channel\": \"$CH\",
      \"text\": \"$MSG\",
      \"username\": \"Heartbeats\",
      \"icon_emoji\": \":clipboard:\"
    }" >> /tmp/heartbeat_reminder.log 2>&1
  echo "" >> /tmp/heartbeat_reminder.log
done

echo "[$(date)] Reminder sent to ${#CHANNELS[@]} channels" >> /tmp/heartbeat_reminder.log
