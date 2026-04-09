# Plataforma de Webinar de Vendas Seazone

## Contexto

A Seazone precisa de uma plataforma de webinar de vendas para apresentar o modelo Seazone a novos proprietários (captação). Hoje não existe ferramenta própria — a referência é o Viver de IA (call.viverdeia.ai), que oferece agendamento, sala de espera e call ao vivo com funcionalidades de vendas.

## Objetivo

Plataforma web onde leads agendam e assistem a apresentações ao vivo feitas pelo time comercial, com fluxo automatizado de confirmação, lembretes e conversão.

## Stack

- **Backend:** Python 3 + Flask (porta 5060)
- **Frontend:** React + Vite + TypeScript + Tailwind
- **Banco:** Supabase (projeto existente jp-rambo)
- **Realtime:** Supabase Realtime (chat + CTA sync)
- **Localização:** `saleszone/scripts/webinar-platform/`

## Estrutura do Projeto

```
saleszone/scripts/webinar-platform/
├── backend/
│   ├── app.py              # Entry point Flask
│   ├── routes/             # Endpoints por domínio
│   │   ├── slots.py        # CRUD de slots
│   │   ├── sessions.py     # Sessões e controle ao vivo
│   │   ├── registrations.py # Inscrições dos leads
│   │   └── messages.py     # Chat
│   ├── services/           # Lógica de negócio + integrações
│   │   ├── google_calendar.py
│   │   ├── morada.py
│   │   ├── email.py
│   │   └── pipedrive.py
│   ├── models/             # Modelos Supabase
│   └── config.py           # Env vars
├── frontend/
│   ├── src/
│   │   ├── pages/          # Agendamento, Espera, Sala, Admin
│   │   └── components/
│   └── vite.config.ts
└── .env
```

## Banco de Dados (Supabase)

### `webinar_slots`

Configuração dos horários recorrentes.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| day_of_week | int | 0-6 (dom-sáb) |
| time | timetz | Horário em America/Sao_Paulo (ex: 14:30-03) |
| duration_minutes | int | Duração (default 60) |
| max_participants | int | Limite por sessão |
| is_active | bool | Slot ativo/inativo |
| presenter_email | text | Email do apresentador (validar @seazone.com.br) |
| created_at | timestamptz | DEFAULT now() |

### `webinar_sessions`

Sessões concretas geradas a partir dos slots.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| slot_id | uuid | FK → webinar_slots |
| date | date | Data específica |
| starts_at | timestamptz | Horário de início (denormalizado de slot.time + date) |
| ends_at | timestamptz | Horário de término (starts_at + duration_minutes) |
| google_meet_link | text | Link do Meet gerado |
| calendar_event_id | text | ID do evento no Google Calendar |
| status | enum | scheduled / live / ended / cancelled |
| cta_active | bool | Botão de compra visível (default false) |
| cancelled_at | timestamptz | Quando foi cancelada (nullable) |
| cancel_reason | text | Motivo do cancelamento (nullable) |
| created_at | timestamptz | DEFAULT now() |

### `webinar_registrations`

Inscrições dos leads.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| session_id | uuid | FK → webinar_sessions |
| access_token | uuid | DEFAULT gen_random_uuid(), UNIQUE — token opaco para acesso à sala |
| name | text | Nome do lead |
| email | text | Email |
| phone | text | Telefone |
| pipedrive_deal_id | int | Deal associado (nullable) |
| status | enum | registered / confirmed / attended / cancelled |
| confirmed_at | timestamptz | Quando confirmou via Morada |
| attended_at | timestamptz | Quando entrou na call (nullable) |
| cancelled_at | timestamptz | Quando cancelou (nullable) |
| converted | bool | Preencheu formulário do CTA |
| converted_at | timestamptz | Quando converteu (nullable) |
| cta_response | jsonb | Dados do formulário CTA (nullable) |
| reminder_24h_sent_at | timestamptz | Quando lembrete 24h foi enviado |
| reminder_1h_sent_at | timestamptz | Quando lembrete 1h foi enviado |
| created_at | timestamptz | DEFAULT now() |

**Constraints:** UNIQUE(session_id, email) — impede inscrição duplicada na mesma sessão.
**Índices:** INDEX(session_id), INDEX(email), INDEX(access_token).

### `webinar_messages`

Chat durante o webinar.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| session_id | uuid | FK → webinar_sessions |
| registration_id | uuid | FK → quem mandou (nullable para apresentador) |
| sender_type | enum | lead / presenter |
| presenter_email | text | Email do apresentador (nullable, preenchido quando sender_type=presenter) |
| content | text | Mensagem |
| is_deleted | bool | Moderação — mensagem apagada (default false) |
| created_at | timestamptz | DEFAULT now() |

**Índices:** INDEX(session_id, created_at).

**Moderação:** Apresentador pode deletar mensagens via admin (soft delete com is_deleted=true). Mensagens deletadas não aparecem no chat dos leads.

**Segurança:** Mensagens são enviadas via Flask API (não escritas direto no Supabase pelo frontend). O backend valida o access_token do registration antes de inserir, prevenindo spoofing de registration_id.

## Geração de Sessões

Sessões são geradas automaticamente a partir dos slots ativos:

- **Job automático (launchd):** roda diariamente às 00:00, gera sessões para os próximos 14 dias
- Para cada slot ativo, verifica se já existe sessão para cada data futura (slot.day_of_week == data.weekday)
- Se não existe, cria a sessão com status `scheduled` e gera o Google Meet link
- Slots desativados: sessões futuras sem inscrições são removidas; com inscrições, mantidas mas marcadas `cancelled` + leads notificados
- Admin pode criar sessões extras manualmente (fora dos slots recorrentes)

## Segurança e Acesso

### Acesso do Lead (zero login)

- Ao se inscrever, o lead recebe um `access_token` (UUID opaco) no link: `/webinar/sala/{session_id}?token={access_token}`
- O backend valida que o token pertence a uma registration ativa da sessão antes de permitir:
  - Acesso à página de espera/sala
  - Envio de mensagens no chat
  - Submissão do formulário CTA
- Sem token válido → página de erro "Link inválido ou expirado"
- Rate limiting: 5 registros por IP por hora (Flask-Limiter)

### Acesso do Admin

- Usa o Supabase Auth existente do projeto saleszone (OAuth Google, domínio @seazone.com.br)
- Compartilha o mesmo projeto Supabase (`ewgqbkdriflarmmifrvs`) e tabela `user_profiles`
- Frontend admin faz auth via Supabase JS SDK → token JWT → Flask valida via Supabase
- Qualquer usuário com profile ativo e email @seazone.com.br tem acesso admin

### RLS (Row Level Security) no Supabase

- **webinar_slots, webinar_sessions:** leitura pública (anon) para página de agendamento, escrita via service role only
- **webinar_registrations:** leitura/escrita via service role only (Flask API intermedia tudo)
- **webinar_messages:** leitura pública por session_id (para Realtime funcionar), escrita via service role only (Flask valida antes de inserir)
- Frontend do lead se conecta ao Supabase Realtime com anon key para ouvir mensagens e CTA events
- Todas as escritas passam pelo Flask backend (nunca direto do frontend)

## Páginas e Fluxo do Lead

### 1. Página de Agendamento (`/webinar`)

- Calendário mensal com navegação por mês
- Mostra dia atual destacado
- Ao selecionar um dia, mostra horários disponíveis (slots com vagas)
- Slots lotados ficam desabilitados (cinza)
- Horários a cada 30 min ao longo do dia (configurável via admin)
- Ao clicar no horário → formulário de registro (nome, email, telefone)
- Após registro → tela de confirmação "Adicionado à sua agenda"

### 2. Página de Espera (`/webinar/sala/{session_id}?token={access_token}`)

- Backend valida access_token → se inválido, mostra "Link inválido"
- Se sessão cancelada → mostra "Esta apresentação foi cancelada" com opção de reagendar
- Countdown até o horário da sessão
- Branding Seazone (logo, cores)
- Informações: data, horário, tema da apresentação
- Quando countdown chega a zero → botão "Entrar na apresentação" aparece
- Marca `attended_at` quando lead clica no botão

### 3. Sala do Webinar

- Botão "Entrar na apresentação" abre Google Meet em **nova janela** (pop-up)
- A página da plataforma continua aberta com:
  - Chat em tempo real (Supabase Realtime)
  - Botão CTA oculto por padrão
  - Quando apresentador ativa CTA no admin → botão aparece para todos os leads via Realtime
  - CTA abre formulário inline (sem sair da página)

```
┌──────── Plataforma ────────┐  ┌──── Google Meet ────┐
│                             │  │                     │
│   Chat                      │  │   Vídeo do          │
│   mensagem 1                │  │   apresentador      │
│   mensagem 2                │  │                     │
│   [________]                │  │                     │
│                             │  │                     │
│ [ Garantir minha vaga ]     │  │                     │
└─────────────────────────────┘  └─────────────────────┘
```

- Zero login — lead acessa com o link tokenizado que recebeu
- Zero download — tudo no browser
- Botão "Entrar na apresentação" abre o Meet via click direto do usuário (não auto-open via Realtime, evitando bloqueio de popup)
- Em mobile: botão usa `<a target="_blank">` em vez de `window.open()` para evitar bloqueio do Safari

### 4. Página de Confirmação (`/webinar/obrigado`)

- Mensagem de agradecimento após preencher formulário do CTA
- Próximos passos

## Painel Admin

### Dashboard (`/admin`)

- Próximas sessões do dia, total de inscritos, taxa de conversão
- Sessões ao vivo agora, leads aguardando

### Gerenciar Slots (`/admin/slots`)

- Tabela com horários recorrentes (dia, hora, apresentador)
- Criar/editar/desativar slots
- Definir limite de participantes por sessão

### Sessões (`/admin/sessoes`)

- Lista de sessões futuras e passadas
- Por sessão: inscritos, confirmados, presentes, convertidos
- Filtro por data, apresentador, status

### Controle ao Vivo (`/admin/sessoes/{id}/live`)

- Página do apresentador durante a call
- Lista de participantes presentes
- Chat em tempo real
- **Botão "Ativar CTA"** — liga/desliga o botão de compra para todos os leads
- **Moderação do chat** — deletar mensagens (soft delete)
- Status da sessão: iniciar / encerrar

### Inscrições (`/admin/inscricoes`)

- Tabela com todos os leads registrados
- Filtro por sessão, data, status
- Exportar CSV

### Autenticação

- Login via email corporativo (@seazone.com.br)
- Sem sistema de permissões complexo — quem tem acesso é admin

## Integrações

### Google Calendar API

- **Conta:** webinar@seazone.com.br (conta dedicada, separada de agendamentos@ que é para calls 1:1)
- **Ao criar sessão:** cria evento com conferenceData (Google Meet link gerado automaticamente)
- **Ao lead se inscrever:** adiciona lead como attendee no evento existente da sessão
- **Ao lead cancelar:** remove attendee do evento (não deleta o evento)
- **Ao cancelar sessão:** deleta o evento (ou atualiza status para cancelled)

### Morada

- **Após registro:** envia confirmação ao lead com data, horário e link tokenizado da sala
- **Template:** nome do lead, data formatada, horário, link `/webinar/sala/{session_id}?token={access_token}`
- **Em caso de erro:** registro prossegue normalmente (confirmação é best-effort, não bloqueia inscrição)
- **Ao cancelar sessão:** envia notificação de cancelamento aos leads inscritos

### Email (SMTP)

- **24h antes:** "Sua apresentação Seazone é amanhã às {hora}" + link da sala
- **1h antes:** "Falta 1 hora! Acesse aqui: {link da sala de espera}"
- **Mecanismo de envio:** launchd job rodando a cada hora (padrão do monorepo), script Python verifica sessões nas próximas 24h/1h e envia para leads que ainda não receberam o lembrete
- Serviço: SMTP simples inicialmente, evoluir para Resend/Mailgun se necessário
- Campo de controle: `reminder_24h_sent_at` e `reminder_1h_sent_at` em webinar_registrations (evita reenvio)

### Pipedrive

- **Ao se inscrever:** buscar deal existente pelo email/telefone e associar (pipedrive_deal_id)
- **Ao converter (CTA):** criar atividade "Webinar — interesse demonstrado" no deal + atualizar nota
- **Sem deal existente:** NÃO criar deal automaticamente (evita poluir CRM). Apenas registrar no Supabase. O time comercial decide manualmente se converte em deal após o webinar

### Supabase Realtime

- **Chat ao vivo:** mensagens via channels do Supabase Realtime
- **CTA sync:** admin ativa botão → todos os leads conectados recebem evento em tempo real

## Evolução Futura

- Substituir Google Meet por LiveKit (stream embutido na página, zero fricção)
- Gravação automática das sessões
- Analytics avançado (funil completo, heatmap de engajamento)
- Sistema de permissões no admin (roles: apresentador, gestor)
