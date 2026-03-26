#!/usr/bin/env python3
"""
Alerta Diário de Contratos Premium — Comercial SZS.
Busca deals ganhos no dia anterior no funil Comercial SZS com plano Premium
e envia DM no Slack para Mayara Cabral. Se não houver fechamentos, não envia.

Roda seg-sex 10h BRT via GitHub Actions.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone

try:
    import requests
except ImportError:
    print("ERRO: requests não instalado. Rode: pip install requests")
    sys.exit(1)

# --- Config ---
PIPEDRIVE_TOKEN = os.environ.get("PIPEDRIVE_API_TOKEN", "")
SLACK_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "")
SLACK_CHANNEL = os.environ.get("SLACK_DM_CHANNEL_MAYARA", "")
DRY_RUN = os.environ.get("DRY_RUN", "false").lower() == "true"

BRT = timezone(timedelta(hours=-3))

# Pipedrive IDs
PIPELINE_SZS = 14
PLANO_FIELD_KEY = "0b8546d3ab3156224126675b930d5d5c4061fa04"
PLANO_PREMIUM_ID = "3480"

PIPEDRIVE_BASE = "https://seazone-fd92b9.pipedrive.com/v1"


def log(msg: str) -> None:
    ts = datetime.now(BRT).strftime("%H:%M:%S")
    print(f"[{ts}] {msg}")


def fetch_won_deals_yesterday() -> list[dict]:
    """Busca deals ganhos ontem no Pipedrive (pipeline SZS, plano Premium)."""
    yesterday = datetime.now(BRT) - timedelta(days=1)
    date_str = yesterday.strftime("%Y-%m-%d")

    log(f"Buscando deals ganhos em {date_str} no Comercial SZS com plano Premium...")

    all_deals: list[dict] = []
    start = 0
    limit = 100

    while True:
        params = {
            "api_token": PIPEDRIVE_TOKEN,
            "status": "won",
            "start": start,
            "limit": limit,
            "sort": "won_time DESC",
        }
        resp = requests.get(f"{PIPEDRIVE_BASE}/deals", params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()

        items = data.get("data") or []
        if not items:
            break

        for deal in items:
            won_time = deal.get("won_time", "") or ""
            if not won_time.startswith(date_str):
                continue
            if deal.get("pipeline_id") != PIPELINE_SZS:
                continue

            plano_raw = deal.get(PLANO_FIELD_KEY)
            plano_id = str(plano_raw) if plano_raw else ""
            if plano_id != PLANO_PREMIUM_ID:
                continue

            all_deals.append(deal)

        pagination = data.get("additional_data", {}).get("pagination", {})
        if not pagination.get("more_items_in_collection"):
            break
        start += limit

    log(f"  {len(all_deals)} deal(s) Premium encontrado(s)")
    return all_deals


def build_slack_message(deals: list[dict], date_str: str) -> str:
    """Monta mensagem formatada para Slack."""
    count = len(deals)
    emoji = ":trophy:" if count >= 3 else ":star:"
    plural = "contrato" if count == 1 else "contratos"

    lines = [
        f"{emoji} *{count} {plural} Premium fechado(s) — Comercial SZS ({date_str})*",
        "",
    ]

    for i, deal in enumerate(deals, 1):
        title = deal.get("title", "Sem título")
        value = deal.get("value", 0)
        owner = deal.get("owner_name", "")
        deal_id = deal.get("id", "")
        link = f"https://seazone-fd92b9.pipedrive.com/deal/{deal_id}"

        value_fmt = f"R$ {value:,.0f}".replace(",", ".") if value else "—"
        owner_str = f" · {owner}" if owner else ""

        lines.append(f"{i}. <{link}|{title}>{owner_str} · {value_fmt}")

    lines.append("")
    lines.append(f"_Total: {count} {plural} Premium no dia_")
    return "\n".join(lines)


def send_slack_dm(text: str) -> bool:
    """Envia DM no Slack para Mayara."""
    if not SLACK_TOKEN:
        log("ERRO: SLACK_BOT_TOKEN não configurado")
        return False
    if not SLACK_CHANNEL:
        log("ERRO: SLACK_DM_CHANNEL_MAYARA não configurado")
        return False

    resp = requests.post(
        "https://slack.com/api/chat.postMessage",
        headers={"Authorization": f"Bearer {SLACK_TOKEN}"},
        json={"channel": SLACK_CHANNEL, "text": text, "unfurl_links": False},
        timeout=15,
    )
    data = resp.json()
    if data.get("ok"):
        log("Slack: mensagem enviada com sucesso")
        return True
    else:
        log(f"Slack ERRO: {data.get('error', 'unknown')}")
        return False


def main() -> None:
    log("=" * 60)
    log(f"Premium Diário SZS — DRY_RUN={DRY_RUN}")
    log("=" * 60)

    missing: list[str] = []
    if not PIPEDRIVE_TOKEN:
        missing.append("PIPEDRIVE_API_TOKEN")
    if not SLACK_TOKEN:
        missing.append("SLACK_BOT_TOKEN")
    if not SLACK_CHANNEL:
        missing.append("SLACK_DM_CHANNEL_MAYARA")

    if missing:
        log(f"ERRO: variáveis faltando: {', '.join(missing)}")
        sys.exit(1)

    deals = fetch_won_deals_yesterday()

    if not deals:
        log("Nenhum deal Premium fechado ontem. Nada a enviar.")
        # Summary para GitHub Actions
        print("\n## Premium Diário SZS\n")
        print("| Metrica | Valor |")
        print("|---------|-------|")
        print("| Deals Premium | 0 |")
        print("| Mensagem enviada | Não (sem deals) |")
        return

    yesterday = (datetime.now(BRT) - timedelta(days=1)).strftime("%d/%m")
    message = build_slack_message(deals, yesterday)

    if DRY_RUN:
        log("\nDRY_RUN — Mensagem que seria enviada:")
        log("-" * 40)
        print(message)
        log("-" * 40)
    else:
        send_slack_dm(message)

    # Summary para GitHub Actions
    print(f"\n## Premium Diário SZS\n")
    print("| Metrica | Valor |")
    print("|---------|-------|")
    print(f"| Deals Premium | {len(deals)} |")
    print(f"| Enviado | {'DRY_RUN' if DRY_RUN else 'Sim'} |")
    for d in deals:
        print(f"| Deal | {d.get('title', '?')} |")


if __name__ == "__main__":
    main()
