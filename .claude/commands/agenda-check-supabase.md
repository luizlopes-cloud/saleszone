# Sync Calendar Events to Supabase (Ociosidade)

Sincronize os eventos de calendario dos closers do Google Calendar para a tabela `squad_calendar_events` no Supabase.

## Instrucoes

1. Leia os closers da tabela `squad_closer_rules` no Supabase:
   - URL: use a env var NEXT_PUBLIC_SUPABASE_URL do .env.local
   - Key: use a env var SUPABASE_SERVICE_ROLE_KEY do .env.local
   - GET /rest/v1/squad_closer_rules?select=*

2. Para cada closer, busque eventos do Google Calendar usando a tool `mcp__claude_ai_Google_Calendar__gcal_list_events`:
   - calendarId: email do closer
   - timeMin: D-2 (2 dias atras) as 00:00:00
   - timeMax: D+7 (7 dias a frente) as 23:59:59
   - timeZone: America/Sao_Paulo
   - q: o prefixo do closer (campo `prefixo` da tabela, geralmente "Apresentacao"; para Construtoras e "Seazone")
   - condenseEventDetails: false (precisamos dos attendees)
   - maxResults: 250
   - IMPORTANTE: faca as chamadas em paralelo (5 closers por vez) para ser mais rapido

3. Para cada evento, extraia:
   - event_id: htmlLink do evento (ou gere um ID unico se nao disponivel)
   - closer_email: email do closer
   - closer_name: nome formatado do email (first.last -> "First Last")
   - setor: campo `setor` da tabela squad_closer_rules
   - dia: data do start.dateTime no formato YYYY-MM-DD
   - hora: horario do start.dateTime no formato HH:MM:SS (horario local -03:00)
   - duracao_min: diferenca em minutos entre end e start
   - titulo: summary do evento
   - empreendimento: extrair do titulo (apos "|") ou da descricao ("Empreendimento de interesse: ..."). Se for generico como "Decoracao", usar null
   - cancelou: true se myResponseStatus === "declined"
   - reagendamento: false
   - synced_at: timestamp atual ISO

4. Delete eventos existentes no range de datas (D-2 a D+7) usando:
   - DELETE /rest/v1/squad_calendar_events?dia=gte.{D-2}&dia=lte.{D+7}

5. Insira os novos eventos em batches de 100:
   - POST /rest/v1/squad_calendar_events

6. Ao final, exiba um resumo com:
   - Total de eventos inseridos
   - Quantidade por closer
   - Periodo sincronizado

## Notas
- Use curl para as chamadas ao Supabase REST API
- A data atual pode ser obtida com `new Date()` ou `date` no bash
- Leia o .env.local do projeto para obter as credenciais do Supabase
- NAO hardcode as credenciais — sempre leia do .env.local
