#!/usr/bin/env python3
"""
Review Semanal de Calls — Envia DM no Slack com a melhor call da semana por closer.
Roda sexta 16h BRT via GitHub Actions.
Lê notas do Supabase (squad_calendar_events.avaliacao) gravadas pelo sync_fireflies.py.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone

import requests

# --- Config ---
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SLACK_TOKEN = os.environ.get("SLACK_BOT_TOKEN", "")
SLACK_DM_CHANNEL = os.environ.get("SLACK_DM_CHANNEL", "D07M0MKUJUS")  # JP
DRY_RUN = os.environ.get("DRY_RUN", "false").lower() == "true"
DAYS_BACK = int(os.environ.get("DAYS_BACK", "7"))

BRT = timezone(timedelta(hours=-3))

# --- Closers por funil (email -> nome) ---
FUNIS = {
    "VENDAS SPOT": {
        "emoji": ":building_construction:",
        "closers": {
            "filipe.padoveze@seazone.com.br": "Filipe Padoveze",
            "priscila.pestana@seazone.com.br": "Priscila Perrone",
            "luana.schaikoski@seazone.com.br": "Luana Schaikoski",
        },
    },
    "COMERCIAL SZS": {
        "emoji": ":house:",
        "closers": {
            "giovanna.araujo@seazone.com.br": "Giovanna Zanchetta",
            "gabriela.lemos@seazone.com.br": "Gabriela Lemos",
            "gabriela.branco@seazone.com.br": "Gabriela Branco",
            "maria.amaral@seazone.com.br": "Maria Vitoria",
        },
    },
    "COMERCIAL DECOR": {
        "emoji": ":triangular_ruler:",
        "closers": {
            "eduardo.albani@seazone.com.br": "Eduardo Albani",
            "maria.paul@seazone.com.br": "Maria Carolina Rosario",
        },
    },
}

ALL_CLOSER_EMAILS = []
for funil in FUNIS.values():
    ALL_CLOSER_EMAILS.extend(funil["closers"].keys())


def log(msg: str):
    print(f"[{datetime.now(BRT).strftime('%H:%M:%S')}] {msg}")


def fetch_evaluated_events(days_back: int) -> list[dict]:
    """Busca eventos com avaliacao dos ultimos N dias no Supabase."""
    end_date = datetime.now(BRT).date()
    start_date = end_date - timedelta(days=days_back)

    url = (
        f"{SUPABASE_URL}/rest/v1/squad_calendar_events"
        f"?select=id,titulo,dia,hora,closer_email,closer_name,empreendimento,"
        f"fireflies_id,avaliacao,diagnostico,cancelou"
        f"&dia=gte.{start_date.isoformat()}"
        f"&dia=lte.{end_date.isoformat()}"
        f"&cancelou=neq.true"
        f"&fireflies_id=not.is.null"
        f"&avaliacao=not.is.null"
    )
    resp = requests.get(
        url,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        },
        timeout=15,
    )
    resp.raise_for_status()
    events = resp.json()
    log(f"Supabase: {len(events)} eventos com avaliacao ({start_date} a {end_date})")
    return events


def fetch_all_events(days_back: int) -> list[dict]:
    """Busca TODOS os eventos dos ultimos N dias (para contar reunioes sem avaliacao)."""
    end_date = datetime.now(BRT).date()
    start_date = end_date - timedelta(days=days_back)

    url = (
        f"{SUPABASE_URL}/rest/v1/squad_calendar_events"
        f"?select=id,closer_email,fireflies_id,avaliacao,cancelou"
        f"&dia=gte.{start_date.isoformat()}"
        f"&dia=lte.{end_date.isoformat()}"
        f"&cancelou=neq.true"
    )
    resp = requests.get(
        url,
        headers={
            "apikey": SUPABASE_KEY,
            "Authorization": f"Bearer {SUPABASE_KEY}",
        },
        timeout=15,
    )
    resp.raise_for_status()
    return resp.json()


def get_nota(event: dict) -> float:
    """Extrai nota_final da avaliacao JSONB."""
    avaliacao = event.get("avaliacao")
    if not avaliacao:
        return 0.0
    if isinstance(avaliacao, str):
        try:
            avaliacao = json.loads(avaliacao)
        except (json.JSONDecodeError, TypeError):
            return 0.0
    return float(avaliacao.get("nota_final", 0))


def build_fireflies_url(event: dict) -> str:
    """Constroi URL do Fireflies a partir do fireflies_id."""
    ff_id = event.get("fireflies_id", "")
    titulo = event.get("titulo") or "reuniao"
    # Fireflies URL pattern: titulo-slug::id
    slug = titulo.replace(" ", "-").replace("|", "").replace("  ", "-")
    return f"https://app.fireflies.ai/view/{slug}::{ff_id}"


def pick_best_per_closer(events: list[dict]) -> dict[str, dict]:
    """Para cada closer, seleciona o evento com maior nota (ignora nota 0)."""
    best: dict[str, dict] = {}
    for event in events:
        email = (event.get("closer_email") or "").lower()
        if email not in ALL_CLOSER_EMAILS:
            continue
        nota = get_nota(event)
        if nota <= 0:
            continue
        if email not in best or nota > get_nota(best[email]):
            best[email] = event
    return best


def build_slack_message(
    best_per_closer: dict[str, dict],
    all_events: list[dict],
    days_back: int,
) -> str:
    """Monta a mensagem Slack no formato aprovado."""
    now = datetime.now(BRT)
    end_date = now.date()
    start_date = end_date - timedelta(days=days_back)
    date_range = f"{start_date.strftime('%d/%m')} a {end_date.strftime('%d/%m')}"

    # Contar reunioes por closer (para a secao "sem calls")
    events_by_closer: dict[str, int] = {}
    for ev in all_events:
        email = (ev.get("closer_email") or "").lower()
        if email in ALL_CLOSER_EMAILS:
            events_by_closer[email] = events_by_closer.get(email, 0) + 1

    lines = [
        f":bar_chart: *Review Semanal de Calls \u2014 {date_range}*",
        "",
    ]

    for funil_name, funil_data in FUNIS.items():
        emoji = funil_data["emoji"]
        closers = funil_data["closers"]

        lines.append("\u2501" * 24)
        lines.append(f"{emoji} *{funil_name}*")
        lines.append("\u2501" * 24)
        lines.append("")

        # Closers com call avaliada neste funil
        ranked = []
        sem_call = []

        for email, nome in closers.items():
            if email in best_per_closer:
                ranked.append((email, best_per_closer[email]))
            else:
                sem_call.append(nome)

        # Ordenar por nota desc
        ranked.sort(key=lambda x: get_nota(x[1]), reverse=True)

        if ranked:
            for i, (email, event) in enumerate(ranked, 1):
                nome = closers[email]
                nota = get_nota(event)
                titulo = event.get("titulo") or event.get("empreendimento") or "Reuniao"
                duracao = ""  # Nao temos duracao no Supabase, omitir
                ff_url = build_fireflies_url(event)

                lines.append(f"{i}. *{nome}* \u2014 {nota}/10")
                lines.append(f"    :telephone_receiver: \"{titulo}\"")
                lines.append(f"    :link: {ff_url}")
                lines.append("")

        if sem_call:
            lines.append(f":warning: _Sem calls avaliadas: {', '.join(sem_call)}_")
            lines.append("")

    lines.append("_Responda com o nome do closer para analise completa_")

    return "\n".join(lines)


def send_slack_dm(message: str) -> bool:
    """Envia DM no Slack via Bot token."""
    resp = requests.post(
        "https://slack.com/api/chat.postMessage",
        json={
            "channel": SLACK_DM_CHANNEL,
            "text": message,
        },
        headers={
            "Authorization": f"Bearer {SLACK_TOKEN}",
            "Content-Type": "application/json",
        },
        timeout=15,
    )
    data = resp.json()
    if not data.get("ok"):
        log(f"ERRO Slack: {data.get('error', 'unknown')}")
        return False
    log(f"Slack DM enviada: {data.get('ts')}")
    return True


def main():
    log("=" * 60)
    log(f"Review Semanal de Calls — DAYS_BACK={DAYS_BACK}, DRY_RUN={DRY_RUN}")
    log("=" * 60)

    # Validar env vars
    missing = []
    if not SUPABASE_URL:
        missing.append("SUPABASE_URL")
    if not SUPABASE_KEY:
        missing.append("SUPABASE_SERVICE_ROLE_KEY")
    if not SLACK_TOKEN and not DRY_RUN:
        missing.append("SLACK_BOT_TOKEN")
    if missing:
        log(f"ERRO: Variaveis faltando: {', '.join(missing)}")
        sys.exit(1)

    # 1. Buscar eventos avaliados
    log("\n1. Buscando eventos avaliados...")
    evaluated = fetch_evaluated_events(DAYS_BACK)

    # 2. Buscar todos os eventos (para contagem)
    log("\n2. Buscando todos os eventos...")
    all_events = fetch_all_events(DAYS_BACK)

    # 3. Selecionar melhor por closer
    log("\n3. Selecionando melhor call por closer...")
    best = pick_best_per_closer(evaluated)
    log(f"   {len(best)} closers com calls avaliadas")

    for email, event in best.items():
        nota = get_nota(event)
        titulo = event.get("titulo", "?")
        log(f"   {email}: {nota}/10 — {titulo}")

    # 4. Montar mensagem
    log("\n4. Montando mensagem Slack...")
    message = build_slack_message(best, all_events, DAYS_BACK)

    if DRY_RUN:
        log("\nDRY_RUN — Mensagem que seria enviada:")
        log("-" * 40)
        print(message)
        log("-" * 40)
        _write_summary(len(evaluated), len(best), dry_run=True)
        return

    # 5. Enviar DM
    log("\n5. Enviando DM no Slack...")
    ok = send_slack_dm(message)

    _write_summary(len(evaluated), len(best), sent=ok)

    if not ok:
        sys.exit(1)

    log("\nConcluido com sucesso!")


def _write_summary(
    n_evaluated: int,
    n_closers: int,
    sent: bool = False,
    dry_run: bool = False,
):
    """Escreve summary para GitHub Actions UI."""
    lines = [
        "## Review Semanal de Calls",
        "",
        "| Metrica | Valor |",
        "|---------|-------|",
        f"| Eventos avaliados | {n_evaluated} |",
        f"| Closers com call | {n_closers} |",
        f"| DM enviada | {'sim' if sent else ('dry_run' if dry_run else 'falhou')} |",
        f"| DRY_RUN | {dry_run} |",
        f"| DAYS_BACK | {DAYS_BACK} |",
    ]
    summary = "\n".join(lines)
    try:
        with open("/tmp/review_summary.txt", "w") as f:
            f.write(summary)
    except OSError:
        pass
    log(f"\n{summary}")


if __name__ == "__main__":
    main()
