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
| time | time | Horário (ex: 14:30) |
| duration_minutes | int | Duração (default 60) |
| max_participants | int | Limite por sessão |
| is_active | bool | Slot ativo/inativo |
| presenter_email | text | Email do apresentador |

### `webinar_sessions`

Sessões concretas geradas a partir dos slots.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| slot_id | uuid | FK → webinar_slots |
| date | date | Data específica |
| google_meet_link | text | Link do Meet gerado |
| calendar_event_id | text | ID do evento no Google Calendar |
| status | enum | scheduled / live / ended / cancelled |
| cta_active | bool | Botão de compra visível (default false) |

### `webinar_registrations`

Inscrições dos leads.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| session_id | uuid | FK → webinar_sessions |
| name | text | Nome do lead |
| email | text | Email |
| phone | text | Telefone |
| pipedrive_deal_id | int | Deal associado (nullable) |
| confirmed_at | timestamp | Quando confirmou via Morada |
| attended | bool | Entrou na call |
| converted | bool | Clicou no CTA / preencheu formulário |

### `webinar_messages`

Chat durante o webinar.

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | uuid | PK |
| session_id | uuid | FK → webinar_sessions |
| registration_id | uuid | FK → quem mandou |
| content | text | Mensagem |
| created_at | timestamp | Quando |

## Páginas e Fluxo do Lead

### 1. Página de Agendamento (`/webinar`)

- Calendário mensal com navegação por mês
- Mostra dia atual destacado
- Ao selecionar um dia, mostra horários disponíveis (slots com vagas)
- Slots lotados ficam desabilitados (cinza)
- Horários a cada 30 min ao longo do dia (configurável via admin)
- Ao clicar no horário → formulário de registro (nome, email, telefone)
- Após registro → tela de confirmação "Adicionado à sua agenda"

### 2. Página de Espera (`/webinar/sala/{session_id}`)

- Countdown até o horário da sessão
- Branding Seazone (logo, cores)
- Informações: data, horário, tema da apresentação
- Quando countdown chega a zero → botão "Entrar na apresentação" aparece

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

- Zero login — lead acessa com o link que recebeu
- Zero download — tudo no browser

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

- **Ao criar sessão:** gera evento com Google Meet link automaticamente (conta agendamentos@seazone.com.br)
- **Ao lead se inscrever:** envia convite de calendário para o email do lead
- **Cancelamento:** remove evento se lead cancelar

### Morada

- **Após registro:** envia confirmação ao lead com data, horário e link da sala
- Backend chama API da Morada após inscrição confirmada

### Email (SMTP)

- **24h antes:** "Sua apresentação Seazone é amanhã às {hora}"
- **1h antes:** "Falta 1 hora! Acesse aqui: {link da sala de espera}"
- Serviço: SMTP simples inicialmente, evoluir para Resend/Mailgun se necessário

### Pipedrive

- **Ao se inscrever:** buscar deal existente pelo email/telefone e associar
- **Ao converter (CTA):** atualizar status do deal / criar atividade
- **Sem deal existente:** criar lead/deal automaticamente

### Supabase Realtime

- **Chat ao vivo:** mensagens via channels do Supabase Realtime
- **CTA sync:** admin ativa botão → todos os leads conectados recebem evento em tempo real

## Evolução Futura

- Substituir Google Meet por LiveKit (stream embutido na página, zero fricção)
- Gravação automática das sessões
- Analytics avançado (funil completo, heatmap de engajamento)
- Sistema de permissões no admin (roles: apresentador, gestor)
