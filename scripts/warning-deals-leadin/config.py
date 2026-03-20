"""
Configuração do agente de alerta — Deals parados em Lead in.

╔══════════════════════════════════════════════════════════════╗
║  EDITE ESTE ARQUIVO para ajustar regras, canais e tokens.   ║
║  O script principal (warning_deals_leadin.py) importa tudo  ║
║  daqui automaticamente.                                      ║
╚══════════════════════════════════════════════════════════════╝
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

# ─────────────────────────────────────────────────────────────
# TOKENS DE ACESSO (via env vars — nunca hardcode)
# ─────────────────────────────────────────────────────────────
PIPEDRIVE_API_TOKEN = os.environ.get("PIPEDRIVE_API_TOKEN", "")
SLACK_BOT_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "")

# ─────────────────────────────────────────────────────────────
# PIPEDRIVE — Funil e Estágio
# ─────────────────────────────────────────────────────────────
PIPELINE_ID = 14              # Comercial SZS
STAGE_ID = 70                 # Lead in
HOURS_THRESHOLD = 60          # Mínimo de horas para entrar no alerta
HOURS_THRESHOLD_WARN = 72     # :warning: Atenção (60-72h)
HOURS_THRESHOLD_URGENT = 120  # :rotating_light: Urgente (72-120h)
                              # :fire: Crítico (>120h / 5+ dias)
PIPEDRIVE_DEAL_URL = "https://seazone-fd92b9.pipedrive.com/deal"

# Campos customizados do Pipedrive
CANAL_FIELD_KEY = "93b3ada8b94bd1fc4898a25754d6bcac2713f835"
EXEC_FIELD_KEY = "b57803776a6cd6e6b2b0cb8eecaa34b03e3d3eee"

# Canais válidos para filtro (ID do Pipedrive → Nome legível)
VALID_CANALS = {
    "582": "Indicação de Corretor",
    "583": "Indicação de Franquia",
}

# ─────────────────────────────────────────────────────────────
# SLACK — Canal de disparo e menções fixas
# ─────────────────────────────────────────────────────────────
SLACK_CHANNEL_ID = "C09AK6B3SSY"   # #szs-parcerias-comercial
KAMILLE_SLACK_ID = "U081JARBRGX"    # Kamille Gomes — cc no final
DEBORA_SLACK_ID = "U081S8EECTG"     # Débora Brodt — deals sem executivo

# ─────────────────────────────────────────────────────────────
# MAPEAMENTO: Executivo de Parceiros → Slack User ID
# Para adicionar/remover executivos, edite este dicionário.
# O nome DEVE ser exatamente igual ao que aparece no Pipedrive.
# ─────────────────────────────────────────────────────────────
EXEC_SLACK_MAP = {
    "Silas Rocha de Miranda": "U0A51KEPX7S",
    "Leonardo Grosbelli": "U0622R7BGKU",
    "Rodrigo Paixão": "U081JARHZAB",
    "Thaynara Grincevicus Santana": "U09KKALDE04",
    "Amanda Peixoto": "U08G8T0V9G8",
    "Fabio Cristiano": "U09CPNCP00H",
    "Izadora Parckert": "U07HLMWDNGZ",
}
