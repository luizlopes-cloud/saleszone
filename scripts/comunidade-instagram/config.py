import os
import json
from pathlib import Path

# Slack
SLACK_BOT_TOKEN = os.environ["SLACK_BOT_TOKEN"]
SLACK_CHANNEL_COMUNIDADE = "C0AQ0C94DM0"  # #comunidade-investidores
SLACK_DM_JP = "D07M0MKUJUS"

# Claude API
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
MODEL = "claude-sonnet-4-20250514"

# Data sources
MARKETPLACE_SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1TxQPhsa7Z8LP4eL9E7y-PfPiD4ds5RUrhti-48_Qo1c/export?format=csv"
)
LANCAMENTOS_URL = "https://lancamentos.seazone.com.br"
REVENDAS_URL = "https://revendas.seazone.com.br"

# Spotometro Supabase (acesso direto ao banco do Lovable app)
SPOTOMETRO_SUPABASE_URL = "https://pjbwfqtmacmpuvaosxxo.supabase.co"
SPOTOMETRO_SUPABASE_KEY = os.environ["SPOTOMETRO_SUPABASE_KEY"]

# ROI por empreendimento (fonte: Spotometro PDF 2026-03-31 + estimativas para novos)
ROI_MAP = {
    "Barra Grande Spot": 22.88,
    "Natal Spot": 21.65,
    "Itacaré Spot": 18.56,
    "Jurerê Spot III": 18.0,
    "Jurerê Spot II": 17.5,
    "Novo Campeche Spot II": 17.0,
    "Ponta das Canas Spot II": 16.5,
    "Caraguá Spot": 15.5,
    "Bonito Spot II": 14.5,
    "Vistas de Anitá II": 14.0,
}

# Config
POSTS_PER_OPPORTUNITY = 3  # spoiler + oportunidade + educativo
POST_TIME = "19h"

# Sent log (evita repeticao no mes)
SENT_LOG_PATH = Path(__file__).parent / "sent_log.json"


def load_sent_log() -> dict:
    if SENT_LOG_PATH.exists():
        return json.loads(SENT_LOG_PATH.read_text())
    return {"lancamentos": [], "marketplace": [], "last_month": ""}


def save_sent_log(log: dict):
    SENT_LOG_PATH.write_text(json.dumps(log, indent=2, ensure_ascii=False))
