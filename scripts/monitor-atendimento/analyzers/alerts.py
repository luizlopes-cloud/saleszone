"""
Analyzer: Alerts — gera alertas baseados em desvio da mediana do time.
"""

import logging
from config import (
    ALERT_WARNING_FACTOR, ALERT_CRITICAL_FACTOR,
    WPP_UNANSWERED_WARNING_HOURS, WPP_UNANSWERED_CRITICAL_HOURS,
    CALLS_MISSED_NO_RETURN_THRESHOLD,
)

log = logging.getLogger(__name__)


def _median(values):
    """Calcula mediana de uma lista."""
    if not values:
        return None
    s = sorted(values)
    n = len(s)
    if n % 2 == 0:
        return (s[n // 2 - 1] + s[n // 2]) / 2
    return s[n // 2]


def _compute_team_baselines(metrics):
    """
    Calcula medianas do time para usar como threshold.
    Retorna dict com baselines.
    """
    wpp_times = [m["wpp_response_time_median_min"] for m in metrics.values()
                 if m.get("wpp_response_time_median_min") is not None]
    call_rates = [m["call_answer_rate"] for m in metrics.values()
                  if m.get("call_answer_rate") is not None]
    calls_made = [m["calls_made"] for m in metrics.values()
                  if m.get("calls_made", 0) > 0]

    return {
        "wpp_response_time_median_min": _median(wpp_times),
        "call_answer_rate_median": _median(call_rates),
        "calls_made_median": _median(calls_made),
        "meeting_quality_median": None,  # Phase 2
    }


def generate_alerts(metrics, target_date):
    """
    Gera alertas para cada vendedor baseado em desvio da mediana.

    Baseline é calculado excluindo o próprio vendedor (evita auto-influência).
    Retorna: list[dict] com alertas.
    """
    alerts = []

    for email, m in metrics.items():
        seller_name = m.get("seller_name", email)

        # Baselines excluindo o próprio vendedor
        peers = {k: v for k, v in metrics.items() if k != email}
        baselines = _compute_team_baselines(peers)

        # 1. Tempo de resposta alto (WhatsApp)
        wpp_time = m.get("wpp_response_time_median_min")
        team_wpp = baselines.get("wpp_response_time_median_min")
        if wpp_time is not None and team_wpp is not None and team_wpp > 0:
            factor = wpp_time / team_wpp
            if factor >= ALERT_CRITICAL_FACTOR:
                alerts.append({
                    "date": target_date,
                    "seller_email": email,
                    "seller_name": seller_name,
                    "alert_type": "response_time",
                    "severity": "critical",
                    "message": f"Tempo de resposta WhatsApp {wpp_time:.0f}min — {factor:.1f}x acima da mediana ({team_wpp:.0f}min)",
                    "metric_value": wpp_time,
                    "threshold_value": team_wpp,
                    "deviation_factor": round(factor, 2),
                })
            elif factor >= ALERT_WARNING_FACTOR:
                alerts.append({
                    "date": target_date,
                    "seller_email": email,
                    "seller_name": seller_name,
                    "alert_type": "response_time",
                    "severity": "warning",
                    "message": f"Tempo de resposta WhatsApp {wpp_time:.0f}min — {factor:.1f}x acima da mediana ({team_wpp:.0f}min)",
                    "metric_value": wpp_time,
                    "threshold_value": team_wpp,
                    "deviation_factor": round(factor, 2),
                })

        # 2. Chats sem resposta
        ua_8h = m.get("wpp_chats_unanswered_8h", 0)
        ua_2h = m.get("wpp_chats_unanswered_2h", 0)
        if ua_8h > 0:
            alerts.append({
                "date": target_date,
                "seller_email": email,
                "seller_name": seller_name,
                "alert_type": "unanswered_chat",
                "severity": "critical",
                "message": f"{ua_8h} chat(s) sem resposta há mais de 8h",
                "metric_value": ua_8h,
                "threshold_value": 0,
                "deviation_factor": None,
            })
        elif ua_2h > 0:
            alerts.append({
                "date": target_date,
                "seller_email": email,
                "seller_name": seller_name,
                "alert_type": "unanswered_chat",
                "severity": "warning",
                "message": f"{ua_2h} chat(s) sem resposta há mais de 2h",
                "metric_value": ua_2h,
                "threshold_value": 0,
                "deviation_factor": None,
            })

        # 3. Sem atividade (0 msgs + 0 calls)
        total_activity = (
            m.get("wpp_messages_sent", 0) +
            m.get("wpp_messages_received", 0) +
            m.get("calls_made", 0) +
            m.get("calls_received", 0)
        )
        if total_activity == 0:
            alerts.append({
                "date": target_date,
                "seller_email": email,
                "seller_name": seller_name,
                "alert_type": "no_activity",
                "severity": "critical",
                "message": f"Nenhuma atividade registrada (0 msgs WhatsApp, 0 chamadas)",
                "metric_value": 0,
                "threshold_value": 1,
                "deviation_factor": None,
            })

        # 4. Chamadas perdidas sem retorno
        missed_nr = m.get("calls_missed_no_return", 0)
        if missed_nr >= CALLS_MISSED_NO_RETURN_THRESHOLD:
            alerts.append({
                "date": target_date,
                "seller_email": email,
                "seller_name": seller_name,
                "alert_type": "missed_calls",
                "severity": "warning",
                "message": f"{missed_nr} chamadas perdidas sem retorno",
                "metric_value": missed_nr,
                "threshold_value": CALLS_MISSED_NO_RETURN_THRESHOLD,
                "deviation_factor": None,
            })

    # Log team-wide baselines (all sellers) for reference
    team_baselines = _compute_team_baselines(metrics)
    log.info("Baselines (team): wpp_median=%s, call_rate=%s, calls_made=%s",
             team_baselines.get("wpp_response_time_median_min"),
             team_baselines.get("call_answer_rate_median"),
             team_baselines.get("calls_made_median"))

    return alerts


def get_team_baselines(metrics, target_date):
    """Retorna baselines para salvar no Supabase."""
    return _compute_team_baselines(metrics)
