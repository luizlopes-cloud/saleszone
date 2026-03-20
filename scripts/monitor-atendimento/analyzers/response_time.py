"""
Analyzer: Response Time — merge de dados e cálculo de métricas combinadas.
"""

import logging
from config import TEAM

log = logging.getLogger(__name__)


def _empty_metrics():
    """Template vazio de métricas."""
    return {
        "seller_name": "",
        "seller_email": "",
        "role": "closer",
        "pipeline_slug": None,
        # WhatsApp
        "wpp_response_time_median_min": None,
        "wpp_response_time_p90_min": None,
        "wpp_messages_sent": 0,
        "wpp_messages_received": 0,
        "wpp_chats_unanswered_2h": 0,
        "wpp_chats_unanswered_8h": 0,
        "wpp_chats_unanswered_24h": 0,
        "wpp_followup_rate": None,
        # Calls
        "calls_made": 0,
        "calls_received": 0,
        "calls_answered": 0,
        "calls_missed": 0,
        "calls_missed_no_return": 0,
        "call_duration_avg_sec": None,
        "call_answer_rate": None,
        # Meetings (populated by Phase 2)
        "meetings_scheduled": 0,
        "meetings_recorded": 0,
        "meetings_no_show": 0,
        "meeting_duration_avg_min": None,
        "meeting_quality_score": None,
        "meeting_talk_ratio": None,
        "meeting_action_items_avg": None,
        # Morada
        "morada_conversations": 0,
        "morada_handoff_time_avg_min": None,
        # Computed
        "overall_activity_score": None,
    }


def compute_response_metrics(wpp_data, call_data, target_date):
    """
    Merge dados de WhatsApp e Api4Com por email.
    Enriquece com info da equipe (nome, role, pipeline).

    Retorna: dict[email] → métricas combinadas
    """
    all_emails = set(list(wpp_data.keys()) + list(call_data.keys()))

    results = {}
    for email in all_emails:
        m = _empty_metrics()
        m["seller_email"] = email

        # Enriquecer com TEAM
        if email in TEAM:
            m["seller_name"] = TEAM[email]["name"]
            m["role"] = TEAM[email]["role"]
            m["pipeline_slug"] = TEAM[email]["pipeline"]
        else:
            m["seller_name"] = email  # fallback

        # Merge WhatsApp
        if email in wpp_data:
            for k, v in wpp_data[email].items():
                if k in m:
                    m[k] = v

        # Merge Api4Com
        if email in call_data:
            for k, v in call_data[email].items():
                if k in m:
                    m[k] = v

        results[email] = m

    log.info("Métricas combinadas para %d vendedores", len(results))
    return results
