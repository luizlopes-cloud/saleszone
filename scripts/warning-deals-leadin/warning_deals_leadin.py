#!/usr/bin/env python3
"""
Agente: Alerta de deals parados em Lead in — Funil Comercial SZS (Pipedrive → Slack)

Busca deals abertos no estágio "Lead in" do funil "Comercial SZS" no Pipedrive
que estejam parados há mais de HOURS_THRESHOLD horas, com Canal válido.
Agrupa por Executivo de Parceiros e envia mensagem no Slack.

Todos os parâmetros editáveis estão em config.py.

Uso manual:
    cd ~/Claude-Code/warning-deals-leadin
    python3 warning_deals_leadin.py
"""

import sys
import os
import json
import logging
import urllib.request
import urllib.parse
from datetime import datetime, timezone

# Garantir que imports locais funcionem independente de onde o script é chamado
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import (
    PIPEDRIVE_API_TOKEN,
    SLACK_BOT_TOKEN,
    PIPELINE_ID,
    STAGE_ID,
    HOURS_THRESHOLD,
    HOURS_THRESHOLD_WARN,
    HOURS_THRESHOLD_URGENT,
    PIPEDRIVE_DEAL_URL,
    CANAL_FIELD_KEY,
    EXEC_FIELD_KEY,
    VALID_CANALS,
    SLACK_CHANNEL_ID,
    KAMILLE_SLACK_ID,
    DEBORA_SLACK_ID,
    EXEC_SLACK_MAP,
)

# ── Logging ──────────────────────────────────────────────────
LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

log_file = os.path.join(LOG_DIR, f"{datetime.now().strftime('%Y-%m-%d')}.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger(__name__)


# ── Pipedrive ────────────────────────────────────────────────

def pipedrive_get(endpoint, params=None):
    """GET na API do Pipedrive com paginação."""
    base = f"https://api.pipedrive.com/v1/{endpoint}"
    if params is None:
        params = {}
    params["api_token"] = PIPEDRIVE_API_TOKEN
    url = f"{base}?{urllib.parse.urlencode(params)}"
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def fetch_all_deals():
    """Busca todos os deals abertos em Lead in, paginando."""
    all_deals = []
    start = 0
    while True:
        data = pipedrive_get("deals", {
            "pipeline_id": PIPELINE_ID,
            "stage_id": STAGE_ID,
            "status": "open",
            "limit": 100,
            "start": start,
        })
        if not data.get("success") or not data.get("data"):
            break
        all_deals.extend(data["data"])
        pagination = data.get("additional_data", {}).get("pagination", {})
        if not pagination.get("more_items_in_collection"):
            break
        start += 100
    return all_deals


def filter_deals(deals):
    """Filtra deals por Canal válido e tempo > HOURS_THRESHOLD."""
    now = datetime.now(timezone.utc)
    filtered = []
    for d in deals:
        canal_val = str(d.get(CANAL_FIELD_KEY) or "")
        if canal_val not in VALID_CANALS:
            continue

        add_time_str = d.get("add_time", "")
        if not add_time_str:
            continue
        add_time = datetime.strptime(add_time_str, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
        hours_old = (now - add_time).total_seconds() / 3600
        if hours_old <= HOURS_THRESHOLD:
            continue

        exec_data = d.get(EXEC_FIELD_KEY)
        exec_name = None
        if exec_data and isinstance(exec_data, dict):
            name = exec_data.get("name", "")
            if name and name != "Não se Aplica Oficial":
                exec_name = name

        org_data = d.get("org_id")
        org_name = None
        if org_data and isinstance(org_data, dict):
            org_name = org_data.get("name")

        filtered.append({
            "id": d["id"],
            "title": d.get("title", "Sem título"),
            "canal_label": VALID_CANALS[canal_val],
            "exec_name": exec_name,
            "org_name": org_name,
            "hours_old": hours_old,
        })
    return filtered


# ── Agrupamento e mensagem ───────────────────────────────────

def group_by_exec(deals):
    """Agrupa deals por executivo. Retorna (grouped_dict, no_exec_list)."""
    grouped = {}
    no_exec = []
    for d in deals:
        if not d["exec_name"]:
            no_exec.append(d)
        else:
            grouped.setdefault(d["exec_name"], []).append(d)
    return grouped, no_exec


def format_deal_line(deal):
    """Formata uma linha de deal para a mensagem Slack."""
    hours = deal["hours_old"]
    if hours >= HOURS_THRESHOLD_URGENT:
        emoji = ":fire:"
    elif hours >= HOURS_THRESHOLD_WARN:
        emoji = ":rotating_light:"
    else:
        emoji = ":warning:"

    days = int(hours // 24)
    time_label = f"{days} dias" if days > 1 else "1 dia"

    link = f"<{PIPEDRIVE_DEAL_URL}/{deal['id']}|{deal['title']}>"
    line = f"{emoji} *{link}* - {deal['canal_label']}"
    if deal["org_name"]:
        line += f" - {deal['org_name']}"
    line += f" — *{time_label} parado*"
    return line


def build_slack_message(grouped, no_exec):
    """Monta a mensagem completa do Slack."""
    lines = [
        ":wave: *Precisamos de ajuda com algumas indicações paradas em Lead in*",
        "",
        "Estamos com dificuldades de falar com as seguintes indicações. Nos ajudem por favor?",
    ]

    for exec_name, deals in grouped.items():
        slack_id = EXEC_SLACK_MAP.get(exec_name)
        mention = f"<@{slack_id}>" if slack_id else exec_name
        lines.append("")
        lines.append(mention)
        for d in sorted(deals, key=lambda x: x["hours_old"], reverse=True):
            lines.append(format_deal_line(d))

    if no_exec:
        lines.append("")
        lines.append(f"<@{DEBORA_SLACK_ID}> estes deals estão sem executivo de parceiros atribuído, pode nos ajudar?")
        for d in no_exec:
            lines.append(format_deal_line(d))

    lines.append("")
    lines.append(f"cc <@{KAMILLE_SLACK_ID}>")
    lines.append("")
    lines.append("Obrigado! :pray:")

    return "\n".join(lines)


# ── Slack ────────────────────────────────────────────────────

def slack_post_message(channel, text):
    """Envia mensagem no Slack via chat.postMessage."""
    if not SLACK_BOT_TOKEN:
        log.error("SLACK_BOT_TOKEN não configurado em config.py!")
        log.info("Mensagem que seria enviada:\n%s", text)
        return False

    url = "https://slack.com/api/chat.postMessage"
    payload = json.dumps({
        "channel": channel,
        "text": text,
        "unfurl_links": False,
        "unfurl_media": False,
    }).encode("utf-8")

    req = urllib.request.Request(url, data=payload, method="POST")
    req.add_header("Content-Type", "application/json; charset=utf-8")
    req.add_header("Authorization", f"Bearer {SLACK_BOT_TOKEN}")

    with urllib.request.urlopen(req, timeout=30) as resp:
        result = json.loads(resp.read())
        if result.get("ok"):
            log.info("Mensagem enviada no Slack (ts: %s)", result.get("ts", ""))
            return True
        else:
            log.error("Erro ao enviar no Slack: %s", result.get("error", "unknown"))
            return False


# ── Main ─────────────────────────────────────────────────────

def main():
    log.info("Iniciando busca de deals em Lead in...")

    deals = fetch_all_deals()
    log.info("Total de deals em Lead in: %d", len(deals))

    filtered = filter_deals(deals)
    log.info("Deals com Canal correto e >%dh: %d", HOURS_THRESHOLD, len(filtered))

    if not filtered:
        log.info("Nenhum deal encontrado. Nada a enviar.")
        return

    grouped, no_exec = group_by_exec(filtered)
    log.info("Executivos: %d | Sem executivo: %d", len(grouped), len(no_exec))

    message = build_slack_message(grouped, no_exec)
    slack_post_message(SLACK_CHANNEL_ID, message)


if __name__ == "__main__":
    main()
