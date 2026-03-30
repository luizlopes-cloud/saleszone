"""
Analyzer: Activity — compute overall activity scores.
"""

import logging

log = logging.getLogger(__name__)


def compute_activity_metrics(daily_metrics):
    """
    Computa score de atividade para cada vendedor.
    Score 0-10 baseado em volume normalizado.

    Modifica daily_metrics in-place e retorna.
    """
    # Coletar máximos para normalização
    max_msgs = max((m.get("wpp_messages_sent", 0) + m.get("wpp_messages_received", 0))
                   for m in daily_metrics.values()) if daily_metrics else 1
    max_calls = max((m.get("calls_made", 0) + m.get("calls_received", 0))
                    for m in daily_metrics.values()) if daily_metrics else 1

    max_msgs = max(max_msgs, 1)  # evitar divisão por zero
    max_calls = max(max_calls, 1)

    for email, m in daily_metrics.items():
        total_msgs = m.get("wpp_messages_sent", 0) + m.get("wpp_messages_received", 0)
        total_calls = m.get("calls_made", 0) + m.get("calls_received", 0)

        # Score normalizado 0-10
        msg_score = (total_msgs / max_msgs) * 10
        call_score = (total_calls / max_calls) * 10

        # Média ponderada (msgs 60%, calls 40%)
        m["overall_activity_score"] = round(msg_score * 0.6 + call_score * 0.4, 1)

    return daily_metrics
