"""
Collector Api4Com — VoIP call metrics per extension.

API docs: https://api.api4com.com/api/v1
Endpoints:
  GET /calls?filter[created_at][gte]=YYYY-MM-DD&filter[created_at][lte]=YYYY-MM-DD&filter[extension]={ramal}
  GET /extensions

Auth: Authorization: {token} (sem Bearer prefix)

Retorna dict[email] com métricas de chamada do dia.
"""

import logging

from config import API4COM_TOKEN, API4COM_BASE_URL, TEAM
from http_helper import http_get

log = logging.getLogger(__name__)

HEADERS = {"Authorization": API4COM_TOKEN}


def _get_calls_by_ramal(ramal, target_date):
    """Busca chamadas de um ramal no dia."""
    url = f"{API4COM_BASE_URL}/calls"
    # Api4Com usa colchetes nos filtros — urllib.parse.urlencode lida com isso
    params = {
        "filter[created_at][gte]": f"{target_date} 00:00:00",
        "filter[created_at][lte]": f"{target_date} 23:59:59",
        "filter[extension]": ramal,
        "per_page": 200,
    }

    try:
        # Construir URL manualmente para preservar colchetes
        param_parts = []
        for k, v in params.items():
            param_parts.append(f"{k}={v}")
        full_url = f"{url}?{'&'.join(param_parts)}"

        data = http_get(full_url, headers=HEADERS)
        return data.get("data", []) if isinstance(data, dict) else data
    except Exception as e:
        log.warning("Api4Com calls para ramal %s falhou: %s", ramal, e)
        return []


def _compute_call_metrics(calls):
    """
    Calcula métricas de um conjunto de chamadas.

    Retorna: {
        calls_made, calls_received, calls_answered, calls_missed,
        call_duration_avg_sec, call_answer_rate
    }
    """
    made = 0
    received = 0
    answered = 0
    missed = 0
    durations = []

    for call in calls:
        direction = call.get("direction", "")
        status = call.get("status", call.get("disposition", ""))

        if direction == "outbound":
            made += 1
        elif direction == "inbound":
            received += 1

        # Status pode ser answered, no-answer, busy, failed, etc.
        status_lower = str(status).lower()
        if status_lower in ("answered", "answer"):
            answered += 1
            duration = call.get("duration", call.get("billsec", 0))
            if duration and int(duration) > 0:
                durations.append(int(duration))
        elif status_lower in ("no-answer", "noanswer", "missed"):
            missed += 1

    total = made + received
    answer_rate = round((answered / total) * 100, 1) if total > 0 else None
    avg_duration = round(sum(durations) / len(durations), 0) if durations else None

    return {
        "calls_made": made,
        "calls_received": received,
        "calls_answered": answered,
        "calls_missed": missed,
        "calls_missed_no_return": 0,  # TODO: calcular em analyze
        "call_duration_avg_sec": avg_duration,
        "call_answer_rate": answer_rate,
    }


def collect_api4com(target_date, test=False):
    """
    Coleta métricas de chamadas de todos os vendedores para o dia alvo.

    Retorna: dict[email] → {calls_made, calls_received, calls_answered, ...}
    """
    if test:
        return _mock_api4com_data()

    results = {}
    for email, info in TEAM.items():
        ramal = info.get("ramal")
        if not ramal:
            log.debug("Sem ramal para %s — pulando Api4Com", info["name"])
            continue

        log.info("  Api4Com: %s (ramal %s)...", info["name"], ramal)

        calls = _get_calls_by_ramal(ramal, target_date)
        metrics = _compute_call_metrics(calls)
        results[email] = metrics

    return results


def _mock_api4com_data():
    """Dados mockados para teste."""
    return {
        "test.closer@seazone.com.br": {
            "calls_made": 15,
            "calls_received": 8,
            "calls_answered": 18,
            "calls_missed": 5,
            "calls_missed_no_return": 2,
            "call_duration_avg_sec": 245,
            "call_answer_rate": 78.3,
        },
        "test.sdr@seazone.com.br": {
            "calls_made": 42,
            "calls_received": 12,
            "calls_answered": 45,
            "calls_missed": 9,
            "calls_missed_no_return": 3,
            "call_duration_avg_sec": 180,
            "call_answer_rate": 83.3,
        },
    }
