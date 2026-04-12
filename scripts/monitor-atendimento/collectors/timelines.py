"""
Collector Timelines.ai — WhatsApp response times and message volumes.

API docs: https://api.timelines.ai
Endpoints:
  GET /chats?phone={phone}&page={n}&per_page={n}
  GET /chats/{chat_id}/messages

Retorna dict[email] com métricas WhatsApp do dia.
"""

import logging
from datetime import datetime

from config import TIMELINES_API_KEY, TIMELINES_BASE_URL, TEAM
from http_helper import http_get

log = logging.getLogger(__name__)

HEADERS = {
    "Authorization": f"Bearer {TIMELINES_API_KEY}",
    "User-Agent": "MonitorAtendimento/1.0",
}


def _get_chats_by_phone(phone):
    """Busca chats por telefone."""
    url = f"{TIMELINES_BASE_URL}/chats"
    params = {"phone": phone, "page": 1, "per_page": 50}
    try:
        data = http_get(url, headers=HEADERS, params=params)
        if isinstance(data, list):
            return data
        # Resposta: {"status": "ok", "data": {"chats": [...]}}
        inner = data.get("data", {})
        if isinstance(inner, dict):
            return inner.get("chats", [])
        return inner if isinstance(inner, list) else []
    except Exception as e:
        log.warning("Timelines chats para %s falhou: %s", phone, e)
        return []


def _parse_timestamp(ts_str):
    """Parse Timelines timestamp format: '2023-04-25 17:14:49 -0300'."""
    if not ts_str:
        return None
    try:
        # Formato Timelines: "2023-04-25 17:14:49 -0300"
        # Converter "-0300" para "-03:00" para fromisoformat
        ts_str = ts_str.strip()
        if len(ts_str) >= 5 and ts_str[-5] in ('+', '-') and ts_str[-4:].isdigit():
            ts_str = ts_str[:-2] + ":" + ts_str[-2:]
        return datetime.fromisoformat(ts_str.replace("Z", "+00:00"))
    except (ValueError, AttributeError):
        return None


def _get_messages(chat_id, limit=100):
    """Busca mensagens de um chat."""
    url = f"{TIMELINES_BASE_URL}/chats/{chat_id}/messages"
    try:
        data = http_get(url, headers=HEADERS)
        if isinstance(data, list):
            return data[:limit]
        # Resposta: {"status": "ok", "data": {"messages": [...]}}
        inner = data.get("data", {})
        if isinstance(inner, dict):
            return inner.get("messages", [])[:limit]
        return inner[:limit] if isinstance(inner, list) else []
    except Exception as e:
        log.warning("Timelines messages para chat %s falhou: %s", chat_id, e)
        return []


def _compute_response_times(messages, target_date):
    """
    Calcula tempos de resposta do vendedor para mensagens do lead no dia alvo.

    Lógica:
    - Filtra mensagens do target_date
    - Para cada msg do lead (incoming), encontra a próxima msg do vendedor (outgoing)
    - Calcula delta em minutos

    Retorna lista de tempos em minutos.
    """
    response_times = []
    day_messages = []

    for msg in messages:
        msg_dt = _parse_timestamp(msg.get("timestamp", ""))
        if not msg_dt:
            continue

        if msg_dt.strftime("%Y-%m-%d") == target_date:
            day_messages.append({
                "dt": msg_dt,
                "from_me": bool(msg.get("from_me", False)),
            })

    # Ordenar por tempo
    day_messages.sort(key=lambda m: m["dt"])

    # Para cada msg incoming, encontrar próxima outgoing
    for i, msg in enumerate(day_messages):
        if msg["from_me"]:
            continue
        # Buscar próxima resposta do vendedor
        for j in range(i + 1, len(day_messages)):
            if day_messages[j]["from_me"]:
                delta = (day_messages[j]["dt"] - msg["dt"]).total_seconds() / 60.0
                if delta > 0:
                    response_times.append(delta)
                break

    return response_times


def _count_messages(messages, target_date):
    """Conta msgs enviadas e recebidas no dia."""
    sent = 0
    received = 0
    for msg in messages:
        msg_dt = _parse_timestamp(msg.get("timestamp", ""))
        if not msg_dt or msg_dt.strftime("%Y-%m-%d") != target_date:
            continue

        if msg.get("from_me", False):
            sent += 1
        else:
            received += 1

    return sent, received


def _check_unanswered(messages, target_date):
    """
    Verifica chats sem resposta.
    Retorna dict com contagem por bucket (2h, 8h, 24h).
    """
    unanswered = {"2h": 0, "8h": 0, "24h": 0}

    # Última msg do dia
    day_msgs = []
    for msg in messages:
        msg_dt = _parse_timestamp(msg.get("timestamp", ""))
        if not msg_dt or msg_dt.strftime("%Y-%m-%d") != target_date:
            continue
        day_msgs.append({
            "dt": msg_dt,
            "from_me": bool(msg.get("from_me", False)),
        })

    if not day_msgs:
        return unanswered

    day_msgs.sort(key=lambda m: m["dt"])
    last_msg = day_msgs[-1]

    # Se última msg é do lead (não respondida)
    if not last_msg["from_me"]:
        # Calcular quanto tempo sem resposta (até fim do dia)
        end_of_day = datetime.fromisoformat(f"{target_date}T23:59:59+00:00")
        hours_waiting = (end_of_day - last_msg["dt"]).total_seconds() / 3600.0

        if hours_waiting >= 24:
            unanswered["24h"] = 1
        if hours_waiting >= 8:
            unanswered["8h"] = 1
        if hours_waiting >= 2:
            unanswered["2h"] = 1

    return unanswered


def collect_timelines(target_date, test=False):
    """
    Coleta métricas WhatsApp de todos os vendedores para o dia alvo.

    Retorna: dict[email] → {
        wpp_response_time_median_min, wpp_response_time_p90_min,
        wpp_messages_sent, wpp_messages_received,
        wpp_chats_unanswered_2h, wpp_chats_unanswered_8h, wpp_chats_unanswered_24h
    }
    """
    if test:
        return _mock_timelines_data()

    results = {}
    for email, info in TEAM.items():
        phone = info.get("phone")
        if not phone:
            log.warning("Sem telefone para %s — pulando Timelines", info["name"])
            continue

        log.info("  Timelines: %s (%s)...", info["name"], phone)

        chats = _get_chats_by_phone(phone)
        all_response_times = []
        total_sent = 0
        total_received = 0
        total_unanswered = {"2h": 0, "8h": 0, "24h": 0}

        for chat in chats:
            chat_id = chat.get("id")
            if not chat_id:
                continue

            messages = _get_messages(chat_id)
            if not messages:
                continue

            # Response times
            rt = _compute_response_times(messages, target_date)
            all_response_times.extend(rt)

            # Message counts
            sent, received = _count_messages(messages, target_date)
            total_sent += sent
            total_received += received

            # Unanswered
            ua = _check_unanswered(messages, target_date)
            for k in total_unanswered:
                total_unanswered[k] += ua[k]

        # Compute median and P90
        median_min = None
        p90_min = None
        if all_response_times:
            sorted_rt = sorted(all_response_times)
            n = len(sorted_rt)
            if n % 2 == 0:
                median_min = round((sorted_rt[n // 2 - 1] + sorted_rt[n // 2]) / 2, 1)
            else:
                median_min = round(sorted_rt[n // 2], 1)
            p90_idx = int(n * 0.9)
            p90_min = round(sorted_rt[min(p90_idx, n - 1)], 1)

        results[email] = {
            "wpp_response_time_median_min": median_min,
            "wpp_response_time_p90_min": p90_min,
            "wpp_messages_sent": total_sent,
            "wpp_messages_received": total_received,
            "wpp_chats_unanswered_2h": total_unanswered["2h"],
            "wpp_chats_unanswered_8h": total_unanswered["8h"],
            "wpp_chats_unanswered_24h": total_unanswered["24h"],
        }

    return results


def _mock_timelines_data():
    """Dados mockados para teste."""
    return {
        "test.closer@seazone.com.br": {
            "wpp_response_time_median_min": 12.0,
            "wpp_response_time_p90_min": 35.0,
            "wpp_messages_sent": 45,
            "wpp_messages_received": 38,
            "wpp_chats_unanswered_2h": 2,
            "wpp_chats_unanswered_8h": 0,
            "wpp_chats_unanswered_24h": 0,
        },
        "test.sdr@seazone.com.br": {
            "wpp_response_time_median_min": 8.0,
            "wpp_response_time_p90_min": 20.0,
            "wpp_messages_sent": 60,
            "wpp_messages_received": 52,
            "wpp_chats_unanswered_2h": 1,
            "wpp_chats_unanswered_8h": 0,
            "wpp_chats_unanswered_24h": 0,
        },
    }
