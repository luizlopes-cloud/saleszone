"""
Analyzer: Lost Deals — agrega métricas e gera alertas de compliance.

Regras de compliance baseadas no SLA de Gestão de Lost (Comercial SZS).
"""

import logging

from config import (
    PIPEDRIVE_POST_MEETING_STAGES, PIPEDRIVE_ADVANCED_STAGES,
    PIPEDRIVE_PRE_VENDAS_STAGES,
    LOST_TIMING_MIN_DAYS, LOST_BULK_THRESHOLD,
    LOST_BATCH_HOUR_THRESHOLD, LOST_BATCH_PERCENT_THRESHOLD,
)

log = logging.getLogger(__name__)


# ── Agregação ────────────────────────────────────────────────


def compute_lost_summary(deals, target_date):
    """
    Agrega deals em métricas diárias.

    Retorna dict com:
    - total, pre_vendas, vendas (contagem + %)
    - by_reason, by_owner, by_canal (dicts de contagem)
    - median_days_in_funnel, same_day_lost_pct, batch_after_18h_pct
    """
    if not deals:
        return {"total": 0, "date": target_date, "pipeline": "szs"}

    total = len(deals)

    pre_vendas = [d for d in deals if d["stage_category"] == "pre_vendas"]
    vendas = [d for d in deals if d["stage_category"] == "vendas"]

    by_reason = {}
    for d in deals:
        reason = d.get("lost_reason") or "Sem motivo"
        by_reason[reason] = by_reason.get(reason, 0) + 1

    by_owner = {}
    for d in deals:
        owner = d.get("owner_name") or "Desconhecido"
        by_owner[owner] = by_owner.get(owner, 0) + 1

    by_canal = {}
    for d in deals:
        canal = d.get("canal") or "Sem canal"
        by_canal[canal] = by_canal.get(canal, 0) + 1

    days_list = [d["days_in_funnel"] for d in deals if d.get("days_in_funnel") is not None]
    median_days = _median(days_list)
    same_day = sum(1 for d in days_list if d == 0)
    same_day_pct = round((same_day / total) * 100, 1) if total > 0 else 0

    after_18h = sum(
        1 for d in deals
        if d.get("lost_hour") is not None and d["lost_hour"] >= LOST_BATCH_HOUR_THRESHOLD
    )
    batch_pct = round((after_18h / total) * 100, 1) if total > 0 else 0

    return {
        "date": target_date,
        "pipeline": "szs",
        "total": total,
        "pre_vendas": len(pre_vendas),
        "vendas": len(vendas),
        "pre_vendas_pct": round((len(pre_vendas) / total) * 100, 1),
        "vendas_pct": round((len(vendas) / total) * 100, 1),
        "by_reason": by_reason,
        "by_owner": by_owner,
        "by_canal": by_canal,
        "median_days_in_funnel": median_days,
        "same_day_lost_pct": same_day_pct,
        "batch_after_18h_pct": batch_pct,
    }


# ── Alertas de compliance ────────────────────────────────────


def generate_lost_alerts(deals, target_date):
    """
    Gera alertas de compliance para deals lost.

    Retorna list[dict] no formato padrão de alertas:
    {date, seller_email, seller_name, alert_type, severity, message,
     metric_value, threshold_value, deviation_factor}
    """
    alerts = []

    for deal in deals:
        owner_email = deal.get("owner_email") or "desconhecido"
        owner_name = deal.get("owner_name") or "Desconhecido"
        deal_id = deal.get("deal_id")
        stage_name = deal.get("stage_name", "")
        reason = deal.get("lost_reason", "")
        days = deal.get("days_in_funnel")

        # 1. Lost em stage avançado (Contrato / Aguardando Dados) = CRITICAL
        if deal.get("stage_id") in PIPEDRIVE_ADVANCED_STAGES:
            alerts.append({
                "date": target_date,
                "seller_email": owner_email,
                "seller_name": owner_name,
                "alert_type": "lost_in_advanced_stage",
                "severity": "critical",
                "message": (
                    f"Deal #{deal_id} perdido em '{stage_name}'"
                    f" — motivo: {reason or 'N/A'}"
                ),
                "metric_value": deal_id,
                "threshold_value": None,
                "deviation_factor": None,
            })

        # 2. Timing violation (motivo=Timing mas < 30 dias no funil)
        if "Timing" in reason and days is not None and days < LOST_TIMING_MIN_DAYS:
            alerts.append({
                "date": target_date,
                "seller_email": owner_email,
                "seller_name": owner_name,
                "alert_type": "timing_violation",
                "severity": "warning",
                "message": (
                    f"Deal #{deal_id} marcado Timing com apenas {days}d"
                    f" no funil (mín {LOST_TIMING_MIN_DAYS}d)"
                    f" — stage: {stage_name}"
                ),
                "metric_value": days,
                "threshold_value": LOST_TIMING_MIN_DAYS,
                "deviation_factor": None,
            })

        # 3. "Não atende" em stages pós-reunião (suspeito)
        if ("Não atende" in reason
                and deal.get("stage_id") in PIPEDRIVE_POST_MEETING_STAGES):
            alerts.append({
                "date": target_date,
                "seller_email": owner_email,
                "seller_name": owner_name,
                "alert_type": "suspicious_reason_stage",
                "severity": "warning",
                "message": (
                    f"Deal #{deal_id} 'Não atende' em '{stage_name}'"
                    f" (lead já teve reunião)"
                ),
                "metric_value": deal_id,
                "threshold_value": None,
                "deviation_factor": None,
            })

        # 4. "Duplicado/Erro" em stages pós-qualificação (suspeito)
        if ("Duplicado" in reason
                and deal.get("stage_id") not in PIPEDRIVE_PRE_VENDAS_STAGES):
            alerts.append({
                "date": target_date,
                "seller_email": owner_email,
                "seller_name": owner_name,
                "alert_type": "duplicate_in_advanced",
                "severity": "warning",
                "message": (
                    f"Deal #{deal_id} 'Duplicado/Erro' em '{stage_name}'"
                    f" (stage avançado)"
                ),
                "metric_value": deal_id,
                "threshold_value": None,
                "deviation_factor": None,
            })

    # 5. Alerta de volume por owner (> N losts/dia)
    owner_counts = {}
    for deal in deals:
        owner = deal.get("owner_name") or "Desconhecido"
        email = deal.get("owner_email") or "desconhecido"
        owner_counts.setdefault(owner, {"email": email, "count": 0})
        owner_counts[owner]["count"] += 1

    for owner_name, info in owner_counts.items():
        if info["count"] > LOST_BULK_THRESHOLD:
            alerts.append({
                "date": target_date,
                "seller_email": info["email"],
                "seller_name": owner_name,
                "alert_type": "bulk_lost_alert",
                "severity": "warning",
                "message": (
                    f"{info['count']} deals lost em um dia"
                    f" (threshold: {LOST_BULK_THRESHOLD})"
                ),
                "metric_value": info["count"],
                "threshold_value": LOST_BULK_THRESHOLD,
                "deviation_factor": round(info["count"] / LOST_BULK_THRESHOLD, 2),
            })

    # 6. Padrão batch (>60% após 18h) — alerta único (não por vendedor)
    total = len(deals)
    if total > 0:
        after_18h = sum(
            1 for d in deals
            if d.get("lost_hour") is not None
            and d["lost_hour"] >= LOST_BATCH_HOUR_THRESHOLD
        )
        batch_pct = after_18h / total
        if batch_pct >= LOST_BATCH_PERCENT_THRESHOLD:
            alerts.append({
                "date": target_date,
                "seller_email": "team",
                "seller_name": "Time SZS",
                "alert_type": "batch_lost_pattern",
                "severity": "info",
                "message": (
                    f"{round(batch_pct * 100)}% dos losts ({after_18h}/{total})"
                    f" ocorreram após 18h — possível limpeza batch"
                ),
                "metric_value": round(batch_pct * 100, 1),
                "threshold_value": round(LOST_BATCH_PERCENT_THRESHOLD * 100),
                "deviation_factor": None,
            })

    log.info("Lost alerts gerados: %d", len(alerts))
    return alerts


# ── Utilitários ──────────────────────────────────────────────


def _median(values):
    """Calcula mediana de uma lista de números."""
    if not values:
        return None
    s = sorted(values)
    n = len(s)
    if n % 2 == 0:
        return (s[n // 2 - 1] + s[n // 2]) / 2
    return s[n // 2]
