"""
Configuração do Monitor de Atendimento.
TUDO que muda vai aqui — nunca no script principal.
Tokens via .env (nunca hardcoded).
"""

import os
from pathlib import Path

# ── Carregar .env ────────────────────────────────────────────
_env_path = Path(__file__).parent / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

# ── Tokens (via env vars) ───────────────────────────────────
TIMELINES_API_KEY = os.environ.get("TIMELINES_API_KEY", "")
API4COM_TOKEN = os.environ.get("API4COM_TOKEN", "")
FIREFLIES_API_KEY = os.environ.get("FIREFLIES_API_KEY", "")
METABASE_API_KEY = os.environ.get("METABASE_API_KEY", "")
SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "")
PIPEDRIVE_API_TOKEN = os.environ.get("PIPEDRIVE_API_TOKEN", "")
SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://iobxudcyihqfdwiggohz.supabase.co")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

# ── Google Calendar ──────────────────────────────────────────
GOOGLE_SERVICE_ACCOUNT_EMAIL = os.environ.get("GOOGLE_SERVICE_ACCOUNT_EMAIL", "")
GOOGLE_PRIVATE_KEY = os.environ.get("GOOGLE_PRIVATE_KEY", "")

# ── URLs ─────────────────────────────────────────────────────
TIMELINES_BASE_URL = "https://app.timelines.ai/integrations/api"
API4COM_BASE_URL = "https://api.api4com.com/api/v1"
FIREFLIES_GRAPHQL_URL = "https://api.fireflies.ai/graphql"
METABASE_BASE_URL = "https://metabase.morada.ai/api"
METABASE_CARD_ID = 1427  # Conversas Seazone
PIPEDRIVE_BASE_URL = "https://seazone-fd92b9.pipedrive.com/v1"

# ── Slack ────────────────────────────────────────────────────
SLACK_DM_JP = "D07M0MKUJUS"       # DM do JP
SLACK_RATE_LIMIT_SEC = 1           # Delay entre mensagens

# ── Equipe Comercial ────────────────────────────────────────
# Chave: email | Valor: {name, role, pipeline, phone, ramal}
# role: closer, sdr, farmer, admin
# phone: formato +55XXXXXXXXXXX (para Timelines)
# ramal: número Api4Com (None se não tem)
TEAM = {
    # ── Pipeline: Todos (Farmers) ────────────────────────────
    "amanda.peixoto@seazone.com.br": {
        "name": "Amanda Piobelo",
        "role": "farmer",
        "pipeline": "szs",
        "phone": "+5548935053669",
        "ramal": "1129",
    },
    "fabio.jesus@seazone.com.br": {
        "name": "Fabio Cristiano de Jesus Jr",
        "role": "farmer",
        "pipeline": "szs",
        "phone": "+554831978156",
        "ramal": "1154",
    },
    "l.grosbelli@seazone.com.br": {
        "name": "Leonardo Júnior Grosbelli",
        "role": "farmer",
        "pipeline": "szs",
        "phone": "+554825000324",
        "ramal": "1038",
    },
    "pedro.eckert@seazone.com.br": {
        "name": "Pedro Ricardo Vaz Tostes Eckert",
        "role": "farmer",
        "pipeline": "szs",
        "phone": "+554861363377",
        "ramal": "1138",
    },
    "rodrigo.paixao@seazone.com.br": {
        "name": "Rodrigo Silva da Paixão",
        "role": "farmer",
        "pipeline": "szs",
        "phone": "+554891600521",
        "ramal": "1095",
    },
    "silas.rocha@seazone.com.br": {
        "name": "Silas Rocha de Miranda",
        "role": "farmer",
        "pipeline": "szs",
        "phone": "+554891733837",
        "ramal": "1187",
    },
    "thaynara.grincevicus@seazone.com.br": {
        "name": "Thaynara Grincevicus",
        "role": "farmer",
        "pipeline": "szs",
        "phone": "+554861365907",
        "ramal": "1168",
    },
    # ── Pipeline: Comercial SZS ──────────────────────────────
    "giovanna.araujo@seazone.com.br": {
        "name": "Giovanna Araujo Zanchetta",
        "role": "closer",
        "pipeline": "szs",
        "phone": "+554891278155",
        "ramal": "1121",
    },
    "gabriela.lemos@seazone.com.br": {
        "name": "Gabriela Lemos",
        "role": "closer",
        "pipeline": "szs",
        "phone": "+554891180806",
        "ramal": "1159",
    },
    "gabriela.branco@seazone.com.br": {
        "name": "Gabriela Alves Branco",
        "role": "closer",
        "pipeline": "szs",
        "phone": "+554891950380",
        "ramal": "1082",
    },
    "samuel.barreto@seazone.com.br": {
        "name": "Samuel Barreto",
        "role": "closer",
        "pipeline": "szs",
        "phone": "+554898200357",
        "ramal": "1158",
    },
    "caio.garcia@seazone.com.br": {
        "name": "Caio Garcia",
        "role": "closer",
        "pipeline": "szs",
        "phone": "+5548936180629",
        "ramal": None,
    },
    "kamille.gomes@seazone.com.br": {
        "name": "Kamille Santos Gomes",
        "role": "sdr",
        "pipeline": "szs",
        "phone": "+554888586521",
        "ramal": "1090",
    },
    "larissa.marques@seazone.com.br": {
        "name": "Larissa Marques",
        "role": "sdr",
        "pipeline": "szs",
        "phone": "+554861365053",
        "ramal": "1171",
    },
    "raynara.lopes@seazone.com.br": {
        "name": "Raynara Lopes",
        "role": "sdr",
        "pipeline": "szs",
        "phone": "+554888141639",
        "ramal": "1110",
    },
    "raquel.lacerda@seazone.com.br": {
        "name": "Raquel Levi",
        "role": "sdr",
        "pipeline": "szs",
        "phone": "+553184842548",
        "ramal": "1102",
    },
    # ── Pipeline: Vendas Spot (szi) ──────────────────────────
    "l.schaikoski@seazone.com.br": {
        "name": "Luana Schaikoski",
        "role": "closer",
        "pipeline": "szi",
        "phone": "+554891498893",
        "ramal": "1080",
    },
    "filipe.padoveze@seazone.com.br": {
        "name": "Filipe Padoveze",
        "role": "closer",
        "pipeline": "szi",
        "phone": "+554831941789",
        "ramal": "1137",
    },
    "priscila.pestana@seazone.com.br": {
        "name": "Priscila Perrone",
        "role": "closer",
        "pipeline": "szi",
        "phone": "+554831999447",
        "ramal": "1119",
    },
    "camila.santos@seazone.com.br": {
        "name": "Camila Silva Santos",
        "role": "closer",
        "pipeline": "szi",
        "phone": "+554831941702",
        "ramal": "1147",
    },
    "ricardo.perrone@seazone.com.br": {
        "name": "Ricardo Perrone",
        "role": "closer",
        "pipeline": "szi",
        "phone": "+5548936181547",
        "ramal": "1146",
    },
    "laura.danieli@seazone.com.br": {
        "name": "Laura Danieli",
        "role": "closer",
        "pipeline": "szi",
        "phone": "+5548936180811",
        "ramal": "1166",
    },
    "natalia.saramago@seazone.com.br": {
        "name": "Natália Saramago",
        "role": "sdr",
        "pipeline": "szi",
        "phone": "+554831999256",
        "ramal": "1150",
    },
    "jeniffer.correa@seazone.com.br": {
        "name": "Jeniffer Correa",
        "role": "sdr",
        "pipeline": "szi",
        "phone": "+5548935053726",
        "ramal": "1083",
    },
    # ── Pipeline: Marketplace ────────────────────────────────
    "w.miranda@seazone.com.br": {
        "name": "Willian Miranda",
        "role": "closer",
        "pipeline": "marketplace",
        "phone": "+554199665465",
        "ramal": "1024",
    },
    "nevine.saratt@seazone.com.br": {
        "name": "Nevine Saratt",
        "role": "closer",
        "pipeline": "marketplace",
        "phone": "+5548936180907",
        "ramal": "1142",
    },
    "julia.servagio@seazone.com.br": {
        "name": "Julia Servagio",
        "role": "closer",
        "pipeline": "marketplace",
        "phone": "+5548936181840",
        "ramal": None,
    },
    "karoane.soares@seazone.com.br": {
        "name": "Karoane Soares",
        "role": "sdr",
        "pipeline": "marketplace",
        "phone": "+554861360248",
        "ramal": "1170",
    },
    # ── Pipeline: Comercial Decor ────────────────────────────
    "eduardo.albani@seazone.com.br": {
        "name": "Eduardo Henrique Albani",
        "role": "closer",
        "pipeline": "decor",
        "phone": "+554891789745",
        "ramal": "1076",
    },
    "maria.paul@seazone.com.br": {
        "name": "Maria Carolina Rosário",
        "role": "closer",
        "pipeline": "decor",
        "phone": "+5548936180875",
        "ramal": "1160",
    },
    "rubia.lorena@seazone.com.br": {
        "name": "Rubia Lorena Santos",
        "role": "sdr",
        "pipeline": "decor",
        "phone": "+554831941888",
        "ramal": "1149",
    },
    # ── Pipeline: Franquias ──────────────────────────────────
    "abner.weber@seazone.com.br": {
        "name": "Abner Weber Gomes",
        "role": "closer",
        "pipeline": "szs",
        "phone": "+5548936180807",
        "ramal": None,
    },
    # ── Sem pipeline definido ────────────────────────────────
    "gabriel.souza@seazone.com.br": {
        "name": "Gabriel Souza",
        "role": "admin",
        "pipeline": "szs",
        "phone": "+554830272444",
        "ramal": None,
    },
    "businessoperations@seazone.com.br": {
        "name": "BizOps (Parcerias)",
        "role": "admin",
        "pipeline": "szs",
        "phone": "+554831941728",
        "ramal": None,
    },
    "maria.amaral@seazone.com.br": {
        "name": "Maria Cabral (Amaral)",
        "role": "admin",
        "pipeline": "szs",
        "phone": "+5548936180242",
        "ramal": None,
    },
    "ricardo.macedo@seazone.com.br": {
        "name": "Ricardo Macedo",
        "role": "admin",
        "pipeline": "szs",
        "phone": "+554891987220",
        "ramal": None,
    },
    "vivianny.aguilera@seazone.com.br": {
        "name": "Vivianny Aguilera",
        "role": "admin",
        "pipeline": "szs",
        "phone": "+5548936181815",
        "ramal": None,
    },
    "izadora.parckert@seazone.com.br": {
        "name": "Izadora Parckert",
        "role": "admin",
        "pipeline": "szs",
        "phone": "+554899145433",
        "ramal": None,
    },
    "lukas.acioli@seazone.com.br": {
        "name": "Lukas Acioli (Terrenos)",
        "role": "admin",
        "pipeline": "szs",
        "phone": "+5548936181316",
        "ramal": None,
    },
}

# ── Thresholds (baseados em medianas) ───────────────────────
# Fator multiplicador da mediana do time para gerar alerta
ALERT_WARNING_FACTOR = 2.0     # vendedor > 2x mediana = warning
ALERT_CRITICAL_FACTOR = 3.0    # vendedor > 3x mediana = critical

# Limites absolutos (quando mediana não existe ainda)
WPP_UNANSWERED_WARNING_HOURS = 4
WPP_UNANSWERED_CRITICAL_HOURS = 8
WPP_FOLLOWUP_TIMEOUT_HOURS = 48
CALLS_MISSED_NO_RETURN_THRESHOLD = 3
MEETING_QUALITY_LOW_THRESHOLD = 5.0  # Score < 5/10
NO_ACTIVITY_CHECK_HOUR = 14  # Alerta se 0 atividades até 14h

# ── Score Composto (pesos) ──────────────────────────────────
SCORE_WEIGHT_WPP = 0.40        # WhatsApp response time
SCORE_WEIGHT_CALLS = 0.30      # Call metrics
SCORE_WEIGHT_MEETINGS = 0.30   # Meeting quality

# ── Pipedrive Lost Deals ──────────────────────────────────────
PIPEDRIVE_SZS_PIPELINE_ID = 14

# Stages do pipeline SZS (id -> nome)
PIPEDRIVE_SZS_STAGES = {
    70: "Lead in",
    71: "Contatados",
    72: "Qualificação",
    345: "Qualificado",
    341: "Aguardando data",
    73: "Agendado",
    342: "No Show",
    151: "Reunião Realizada",
    74: "FUP",
    75: "Negociação",
    152: "Aguardando Dados",
    76: "Contrato",
}

# Categorias de stage
PIPEDRIVE_PRE_VENDAS_STAGES = {70, 71, 72, 345, 341, 73}     # SDR/MIA
PIPEDRIVE_VENDAS_STAGES = {342, 151, 74, 75, 152, 76}         # Closer
PIPEDRIVE_POST_MEETING_STAGES = {151, 74, 75, 152, 76}        # Reunião Realizada em diante
PIPEDRIVE_ADVANCED_STAGES = {152, 76}                           # Aguardando Dados + Contrato

# Thresholds de alerta para losts
LOST_TIMING_MIN_DAYS = 30           # < 30 dias + motivo Timing = violação
LOST_BULK_THRESHOLD = 20            # > 20 losts/dia por owner = alerta
LOST_BATCH_HOUR_THRESHOLD = 18      # Losts após 18h = padrão batch
LOST_BATCH_PERCENT_THRESHOLD = 0.6  # 60% após 18h = alerta

# Canal (custom field) — mapeamento ID -> label
PIPEDRIVE_CANAL_FIELD = "93b3ada8b94bd1fc4898a25754d6bcac2713f835"
PIPEDRIVE_RD_CAMPANHA_FIELD = "e446c37fb126d0a122ae3a1d2f6a5b5716038731"
PIPEDRIVE_RD_SOURCE_FIELD = "ff53f6910138fa1d8969b686acb4b1336d50c9bd"
PIPEDRIVE_MIA_LOST_FIELD = "bf0e5193f43a49b36990c4ea88c91e01d0858592"

CANAL_LABELS = {
    "12": "Marketing",
    "1748": "Expansão",
    "623": "Cliente SZN",
    "3142": "Colaborador Seazone",
    "583": "Indicação de Franquia",
    "10": "Indicação de Clientes",
    "543": "Indicação de Colaborador",
    "582": "Indicação de Corretor",
    "830": "Indicação de Embaixador",
    "622": "Indicação de Hóspede",
    "2876": "Indicação de Parceiros",
    "804": "Portais de imóveis",
    "276": "Prospecção Ativa",
    "3189": "Spot Seazone",
    "3408": "Prospecção Instagram",
    "3409": "Prospecção LinkedIn",
    "3429": "Prospecção ativa - IA",
    "3434": "Prospecção ativa - planilha CNAEs",
    "3446": "Lista Prospecção Ativa",
    "4009": "Eventos",
    "4550": "Marketing POC",
    "4551": "Mônica",
}

# ── Retry ────────────────────────────────────────────────────
RETRY_COUNT = 3
RETRY_BASE_BACKOFF = 2  # seconds (exponential: 2, 4, 8)
REQUEST_TIMEOUT = 30     # seconds
