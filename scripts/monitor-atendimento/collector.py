#!/usr/bin/env python3
"""
Monitor de Atendimento Seazone — Collector

Coleta métricas de Timelines.ai, Api4Com, Fireflies, Metabase Morada
e Google Calendar. Calcula medianas, gera alertas e grava no Supabase.

Uso:
    python3 collector.py --now                    # Produção (ontem)
    python3 collector.py --now --date 2026-03-14  # Data específica
    python3 collector.py --now --dry-run           # Apenas log
    python3 collector.py --now --test              # Dados mockados
"""

import sys
import os
import logging
from datetime import datetime, timedelta

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

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


def parse_args():
    """Parse CLI arguments."""
    args = sys.argv[1:]
    return {
        "now": "--now" in args,
        "dry_run": "--dry-run" in args,
        "test": "--test" in args,
        "date": None,  # filled below
    }


def get_target_date(args):
    """Get target date from args or default to yesterday."""
    cli_args = sys.argv[1:]
    if "--date" in cli_args:
        idx = cli_args.index("--date")
        if idx + 1 < len(cli_args):
            return cli_args[idx + 1]
    # Default: yesterday
    return (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d")


def main():
    args = parse_args()

    if not args["now"]:
        print(__doc__)
        sys.exit(0)

    target_date = get_target_date(args)
    dry_run = args["dry_run"]
    test_mode = args["test"]

    log.info("=" * 60)
    log.info("Monitor de Atendimento — Iniciado")
    log.info("Data alvo: %s | Dry-run: %s | Test: %s", target_date, dry_run, test_mode)
    log.info("=" * 60)

    try:
        # 1. Coletar dados
        from collectors.timelines import collect_timelines
        from collectors.api4com import collect_api4com

        log.info("Coletando dados do Timelines.ai...")
        wpp_data = collect_timelines(target_date, test=test_mode)
        log.info("Timelines: %d vendedores com dados", len(wpp_data))

        log.info("Coletando dados do Api4Com...")
        call_data = collect_api4com(target_date, test=test_mode)
        log.info("Api4Com: %d vendedores com dados", len(call_data))

        # 2. Analisar
        from analyzers.response_time import compute_response_metrics
        from analyzers.activity import compute_activity_metrics
        from analyzers.alerts import generate_alerts

        log.info("Calculando métricas...")
        daily_metrics = compute_response_metrics(wpp_data, call_data, target_date)
        daily_metrics = compute_activity_metrics(daily_metrics)

        log.info("Gerando alertas...")
        alerts = generate_alerts(daily_metrics, target_date)
        log.info("Alertas gerados: %d", len(alerts))

        # 3. Coletar Lost Deals (Pipedrive)
        from collectors.pipedrive_losts import collect_pipedrive_losts
        from analyzers.losts import compute_lost_summary, generate_lost_alerts

        log.info("Coletando lost deals do Pipedrive...")
        lost_deals = collect_pipedrive_losts(target_date, test=test_mode)
        log.info("Pipedrive: %d deals lost SZS", len(lost_deals))

        log.info("Analisando lost deals...")
        lost_summary = compute_lost_summary(lost_deals, target_date)
        lost_alerts = generate_lost_alerts(lost_deals, target_date)
        log.info("Lost alerts: %d", len(lost_alerts))

        # 4. Output
        if not dry_run:
            from outputs.supabase_out import (
                upsert_daily_metrics, upsert_alerts, upsert_baselines,
                upsert_lost_deals, upsert_lost_summary, upsert_lost_alerts,
            )
            from outputs.slack_out import send_alerts, send_lost_report

            log.info("Gravando métricas no Supabase...")
            upsert_daily_metrics(daily_metrics, target_date)
            upsert_baselines(daily_metrics, target_date)
            upsert_alerts(alerts)

            log.info("Gravando lost deals no Supabase...")
            upsert_lost_deals(lost_deals, target_date)
            upsert_lost_summary(lost_summary)
            upsert_lost_alerts(lost_alerts)

            log.info("Enviando alertas no Slack...")
            send_alerts(alerts)

            log.info("Enviando relatório de losts no Slack...")
            send_lost_report(lost_deals, lost_summary, lost_alerts)
        else:
            log.info("[DRY-RUN] Métricas: %d vendedores", len(daily_metrics))
            for email, m in daily_metrics.items():
                log.info("  %s: wpp=%s min, calls=%s, rate=%s%%",
                         m.get("seller_name", email),
                         m.get("wpp_response_time_median_min", "N/A"),
                         m.get("calls_made", 0),
                         m.get("call_answer_rate", "N/A"))
            log.info("[DRY-RUN] Alertas atendimento: %d", len(alerts))
            for a in alerts:
                log.info("  [%s] %s: %s", a["severity"], a["seller_name"], a["message"])
            log.info("[DRY-RUN] Lost deals: %d | Summary: total=%d, pré=%d, vendas=%d",
                     len(lost_deals),
                     lost_summary.get("total", 0),
                     lost_summary.get("pre_vendas", 0),
                     lost_summary.get("vendas", 0))
            log.info("[DRY-RUN] Lost alerts: %d", len(lost_alerts))
            for a in lost_alerts:
                log.info("  [%s] %s: %s", a["severity"], a["seller_name"], a["message"])

        log.info("=" * 60)
        log.info("Monitor de Atendimento — Concluído")
        log.info("=" * 60)

    except Exception as e:
        log.error("Erro fatal: %s", e, exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
