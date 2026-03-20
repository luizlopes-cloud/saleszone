#!/usr/bin/env python3
"""
Relatorio Semanal do Claudio — Comparativo seg vs sex.

Envia um resumo na DM do JP com evolucoes e pioras por funil, lider e analista.

Uso:
    python3 relatorio_semanal.py --now              # Envia na DM do JP
    python3 relatorio_semanal.py --now --dry-run    # Apenas loga, nao envia
    python3 relatorio_semanal.py --now --test       # Envia no #supervisor-claudio
"""

import sys
import os
import json
import logging
import time
import urllib.request
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from config import (
    SLACK_BOT_TOKEN,
    TEST_CHANNEL,
    PIPELINES,
    TEAM_MAP,
    MANAGERS,
    SLACK_DELAY_SECONDS,
)

# ── Config do relatorio ─────────────────────────────────────

JP_DM_CHANNEL = "D0AKXC8AJP3"
TOP_N = 5  # Top analistas para mostrar

# ── Logging ─────────────────────────────────────────────────

LOG_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "logs")
os.makedirs(LOG_DIR, exist_ok=True)

log_file = os.path.join(LOG_DIR, f"{datetime.now().strftime('%Y-%m-%d')}-relatorio.log")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s  %(message)s",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler(),
    ],
)
log = logging.getLogger("relatorio")

# ── Snapshots ───────────────────────────────────────────────

SNAP_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "snapshots")


def load_snapshot(date_str):
    """Carrega snapshot de uma data. Retorna dict ou None."""
    path = os.path.join(SNAP_DIR, f"{date_str}.json")
    if not os.path.exists(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def find_week_snapshots():
    """
    Encontra o snapshot de segunda e sexta da semana atual.
    Se nao encontrar segunda, pega o mais antigo da semana.
    Se nao encontrar sexta, pega hoje.
    """
    today = datetime.now().date()
    # Achar segunda da semana (weekday 0 = segunda)
    monday = today - timedelta(days=today.weekday())
    friday = monday + timedelta(days=4)

    # Snapshot de inicio: tenta segunda, depois terca, etc
    start_snap = None
    start_date = None
    for i in range(5):
        d = monday + timedelta(days=i)
        snap = load_snapshot(d.isoformat())
        if snap:
            start_snap = snap
            start_date = d
            break

    # Snapshot de fim: tenta sexta (hoje), depois dia anterior, etc
    end_snap = None
    end_date = None
    for i in range(4, -1, -1):
        d = monday + timedelta(days=i)
        if d > today:
            continue
        snap = load_snapshot(d.isoformat())
        if snap:
            end_snap = snap
            end_date = d
            break

    return start_snap, start_date, end_snap, end_date


# ── Calculo de deltas ───────────────────────────────────────

def delta_icon(val):
    """Retorna emoji de tendencia."""
    if val > 0:
        return ":small_red_triangle:"
    elif val < 0:
        return ":small_red_triangle_down:"
    return "➖"


def delta_str(val):
    """Formata delta com sinal."""
    if val > 0:
        return f"+{val}"
    return str(val)


def get_pipeline_totals(snap, pipeline_key):
    """Retorna (sem_atividade_total, parados_total) de um pipeline."""
    p = snap.get("pipelines", {}).get(pipeline_key, {})
    sa = 0
    pa = 0
    for role in ("PV", "Closer"):
        sa += p.get("sem_atividade", {}).get(role, {}).get("total", 0)
        pa += p.get("atrasados", {}).get(role, {}).get("total", 0)
    return sa, pa


def get_role_totals(snap, pipeline_key, category, role):
    """Retorna total de uma role especifica."""
    return (snap.get("pipelines", {})
            .get(pipeline_key, {})
            .get(category, {})
            .get(role, {})
            .get("total", 0))


def get_owner_count(snap, pipeline_key, category, role, owner):
    """Retorna contagem de deals de um owner."""
    return (snap.get("pipelines", {})
            .get(pipeline_key, {})
            .get(category, {})
            .get(role, {})
            .get("owners", {})
            .get(owner, 0))


# ── Construcao do relatorio ─────────────────────────────────

def build_report(start_snap, start_date, end_snap, end_date):
    """Constroi as mensagens do relatorio semanal."""
    start_label = start_date.strftime("%d/%m")
    end_label = end_date.strftime("%d/%m")
    week_range = f"{start_label} a {end_label}"

    messages = []

    # ── Header ──
    header = (
        f":bar_chart: *Relatório Semanal — Claudio | Semana {week_range}*\n"
        f"Comparativo entre {start_label} ({_weekday_name(start_date)}) "
        f"e {end_label} ({_weekday_name(end_date)})"
    )
    messages.append(header)

    # ── Visao por Funil ──
    funil_lines = [":office: *Visão por Funil*\n"]
    for key in PIPELINES:
        name = PIPELINES[key]["name"]
        sa_start, pa_start = get_pipeline_totals(start_snap, key)
        sa_end, pa_end = get_pipeline_totals(end_snap, key)
        sa_delta = sa_end - sa_start
        pa_delta = pa_end - pa_start

        funil_lines.append(
            f"*{name}*\n"
            f"  :red_circle: Sem atividade: {sa_end} ({delta_icon(sa_delta)} {delta_str(sa_delta)})\n"
            f"  :large_yellow_circle: Atrasados: {pa_end} ({delta_icon(pa_delta)} {delta_str(pa_delta)})"
        )
    messages.append("\n".join(funil_lines))

    # ── Visao por Lider ──
    lider_lines = [":bust_in_silhouette: *Visão por Líder*\n"]
    for key in PIPELINES:
        name = PIPELINES[key]["name"]
        mgrs = MANAGERS.get(key, {})

        for role, role_label, mgr_key in [("PV", "Pré-vendas", "pv"), ("Closer", "Vendas", "vendas")]:
            mgr_id = mgrs.get(mgr_key)
            if not mgr_id:
                continue

            sa_s = get_role_totals(start_snap, key, "sem_atividade", role)
            sa_e = get_role_totals(end_snap, key, "sem_atividade", role)
            pa_s = get_role_totals(start_snap, key, "atrasados", role)
            pa_e = get_role_totals(end_snap, key, "atrasados", role)

            sa_d = sa_e - sa_s
            pa_d = pa_e - pa_s
            total_d = sa_d + pa_d

            if total_d > 2:
                trend = ":warning: Piorando"
            elif total_d < -2:
                trend = ":white_check_mark: Melhorando"
            else:
                trend = "➖ Estável"

            lider_lines.append(
                f"<@{mgr_id}> — {name} {role_label} | {trend}\n"
                f"  Sem ativ: {sa_s}→{sa_e} ({delta_str(sa_d)}) · "
                f"Atrasados: {pa_s}→{pa_e} ({delta_str(pa_d)})"
            )
    messages.append("\n".join(lider_lines))

    # ── Top analistas — Pioras e Evolucoes ──
    analyst_deltas = []
    for key in PIPELINES:
        name = PIPELINES[key]["name"]
        for role in ("PV", "Closer"):
            role_label = "PV" if role == "PV" else "Vendas"
            # Coletar todos os owners do end_snap e start_snap
            end_owners = (end_snap.get("pipelines", {})
                          .get(key, {}).get("sem_atividade", {}).get(role, {}).get("owners", {}))
            end_owners_p = (end_snap.get("pipelines", {})
                           .get(key, {}).get("atrasados", {}).get(role, {}).get("owners", {}))
            start_owners = (start_snap.get("pipelines", {})
                            .get(key, {}).get("sem_atividade", {}).get(role, {}).get("owners", {}))
            start_owners_p = (start_snap.get("pipelines", {})
                              .get(key, {}).get("atrasados", {}).get(role, {}).get("owners", {}))

            all_names = set(list(end_owners.keys()) + list(end_owners_p.keys()) +
                           list(start_owners.keys()) + list(start_owners_p.keys()))

            for owner in all_names:
                sa_s = start_owners.get(owner, 0)
                sa_e = end_owners.get(owner, 0)
                pa_s = start_owners_p.get(owner, 0)
                pa_e = end_owners_p.get(owner, 0)

                total_delta = (sa_e + pa_e) - (sa_s + pa_s)

                info = TEAM_MAP.get(owner, {})
                slack_id = info.get("slackId", "")

                analyst_deltas.append({
                    "owner": owner,
                    "slackId": slack_id,
                    "pipeline": name,
                    "role": role_label,
                    "sa_s": sa_s, "sa_e": sa_e,
                    "pa_s": pa_s, "pa_e": pa_e,
                    "total_delta": total_delta,
                })

    # Top pioras (delta positivo = mais deals com problema)
    pioras = sorted(analyst_deltas, key=lambda x: x["total_delta"], reverse=True)[:TOP_N]
    pioras = [p for p in pioras if p["total_delta"] > 0]

    if pioras:
        piora_lines = [":rotating_light: *Top Analistas — Maiores Pioras*\n"]
        for p in pioras:
            mention = f"<@{p['slackId']}>" if p["slackId"] else p["owner"]
            piora_lines.append(
                f"{mention} _{p['owner']}_ — {p['pipeline']} {p['role']}\n"
                f"  Sem ativ: {p['sa_s']}→{p['sa_e']} ({delta_str(p['sa_e']-p['sa_s'])}) · "
                f"Atrasados: {p['pa_s']}→{p['pa_e']} ({delta_str(p['pa_e']-p['pa_s'])}) · "
                f"*Total: {delta_str(p['total_delta'])}*"
            )
        messages.append("\n".join(piora_lines))

    # Top evolucoes (delta negativo = menos deals com problema)
    evolucoes = sorted(analyst_deltas, key=lambda x: x["total_delta"])[:TOP_N]
    evolucoes = [e for e in evolucoes if e["total_delta"] < 0]

    if evolucoes:
        evo_lines = [":trophy: *Top Analistas — Maiores Evoluções*\n"]
        for e in evolucoes:
            mention = f"<@{e['slackId']}>" if e["slackId"] else e["owner"]
            evo_lines.append(
                f"{mention} _{e['owner']}_ — {e['pipeline']} {e['role']}\n"
                f"  Sem ativ: {e['sa_s']}→{e['sa_e']} ({delta_str(e['sa_e']-e['sa_s'])}) · "
                f"Atrasados: {e['pa_s']}→{e['pa_e']} ({delta_str(e['pa_e']-e['pa_s'])}) · "
                f"*Total: {delta_str(e['total_delta'])}*"
            )
        messages.append("\n".join(evo_lines))

    if not pioras and not evolucoes:
        messages.append("_Sem dados suficientes para comparativo (apenas 1 snapshot disponível)._")

    return messages


def _weekday_name(d):
    """Retorna nome do dia da semana em portugues."""
    names = ["seg", "ter", "qua", "qui", "sex", "sáb", "dom"]
    return names[d.weekday()]


# ── Slack ───────────────────────────────────────────────────

def slack_post(channel, text, thread_ts=None, dry_run=False):
    """Envia mensagem no Slack."""
    if dry_run:
        thread_info = f" (thread: {thread_ts})" if thread_ts else ""
        log.info("[DRY-RUN] Canal %s%s:\n%s", channel, thread_info, text)
        return "dry-run-ts"

    payload = {
        "channel": channel,
        "text": text,
        "unfurl_links": False,
        "unfurl_media": False,
    }
    if thread_ts:
        payload["thread_ts"] = thread_ts

    body = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        "https://slack.com/api/chat.postMessage",
        data=body,
        method="POST",
    )
    req.add_header("Content-Type", "application/json; charset=utf-8")
    req.add_header("Authorization", f"Bearer {SLACK_BOT_TOKEN}")

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            result = json.loads(resp.read())
            if result.get("ok"):
                ts = result.get("ts", "")
                log.info("Slack OK (ts: %s, canal: %s)", ts, channel)
                return ts
            else:
                log.error("Slack erro: %s (canal: %s)", result.get("error", "?"), channel)
                return None
    except Exception as e:
        log.error("Slack falhou: %s", e)
        return None


# ── Main ────────────────────────────────────────────────────

def main():
    args = sys.argv[1:]
    dry_run = "--dry-run" in args
    test_mode = "--test" in args
    now = "--now" in args

    if not now:
        print("Uso: python3 relatorio_semanal.py --now [--test] [--dry-run]")
        sys.exit(0)

    log.info("=" * 60)
    log.info("Relatorio Semanal — Iniciado")
    log.info("=" * 60)

    start_snap, start_date, end_snap, end_date = find_week_snapshots()

    if not start_snap or not end_snap:
        log.error("Snapshots insuficientes para gerar relatorio.")
        log.error("Encontrados: inicio=%s, fim=%s",
                  start_date.isoformat() if start_date else "nenhum",
                  end_date.isoformat() if end_date else "nenhum")
        sys.exit(1)

    log.info("Comparando: %s → %s", start_date.isoformat(), end_date.isoformat())

    channel = TEST_CHANNEL if test_mode else JP_DM_CHANNEL
    messages = build_report(start_snap, start_date, end_snap, end_date)

    # Envia header como msg principal, resto como thread
    main_ts = slack_post(channel, messages[0], dry_run=dry_run)
    time.sleep(SLACK_DELAY_SECONDS)

    for msg in messages[1:]:
        slack_post(channel, msg, thread_ts=main_ts, dry_run=dry_run)
        time.sleep(SLACK_DELAY_SECONDS)

    log.info("=" * 60)
    log.info("Relatorio Semanal — Concluido")
    log.info("=" * 60)


if __name__ == "__main__":
    main()
