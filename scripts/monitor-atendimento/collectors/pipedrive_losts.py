"""
Collector Pipedrive — Lost deals do pipeline Comercial SZS.

API: https://seazone-fd92b9.pipedrive.com/v1
Auth: ?api_token={token} (query param)
Endpoint: GET /deals?status=lost&sort=lost_time DESC&limit=500

NOTA: pipeline_id filter NÃO funciona em lost deals — filtro client-side.
"""

import logging
from datetime import datetime

from config import (
    PIPEDRIVE_API_TOKEN, PIPEDRIVE_BASE_URL,
    PIPEDRIVE_SZS_PIPELINE_ID, PIPEDRIVE_SZS_STAGES,
    PIPEDRIVE_PRE_VENDAS_STAGES, PIPEDRIVE_VENDAS_STAGES,
    PIPEDRIVE_CANAL_FIELD, PIPEDRIVE_RD_CAMPANHA_FIELD,
    PIPEDRIVE_RD_SOURCE_FIELD, PIPEDRIVE_MIA_LOST_FIELD,
    CANAL_LABELS, TEAM,
)
from http_helper import http_get

log = logging.getLogger(__name__)


# ── Funções internas ─────────────────────────────────────────


def _fetch_lost_deals(start=0, limit=500):
    """Busca deals lost paginados. Retorna (deals_list, more_items_bool)."""
    url = (
        f"{PIPEDRIVE_BASE_URL}/deals"
        f"?status=lost"
        f"&sort=lost_time%20DESC"
        f"&start={start}"
        f"&limit={limit}"
        f"&api_token={PIPEDRIVE_API_TOKEN}"
    )

    data = http_get(url)
    if not data or not data.get("success"):
        log.warning("Pipedrive deals fetch falhou (start=%d): %s", start, data)
        return [], False

    deals = data.get("data") or []
    more = (
        data.get("additional_data", {})
        .get("pagination", {})
        .get("more_items_in_collection", False)
    )
    return deals, more


def _parse_datetime(dt_str):
    """Parse datetime do Pipedrive: '2026-03-18 19:45:12'."""
    if not dt_str:
        return None
    try:
        return datetime.strptime(dt_str[:19], "%Y-%m-%d %H:%M:%S")
    except (ValueError, TypeError):
        return None


def _filter_szs_by_date(deals, target_date):
    """Filtra: apenas pipeline SZS + lost_time no target_date."""
    result = []
    for deal in deals:
        if deal.get("pipeline_id") != PIPEDRIVE_SZS_PIPELINE_ID:
            continue
        lost_dt = _parse_datetime(deal.get("lost_time"))
        if not lost_dt or lost_dt.strftime("%Y-%m-%d") != target_date:
            continue
        result.append(deal)
    return result


def _resolve_owner_email(deal):
    """Busca reversa owner_name → email no TEAM."""
    owner_name = deal.get("owner_name", "")
    for email, info in TEAM.items():
        if info["name"] == owner_name:
            return email
    return None


def _resolve_canal(deal):
    """Resolve ID do canal para label legível."""
    raw = deal.get(PIPEDRIVE_CANAL_FIELD)
    if not raw:
        return "Sem canal"
    return CANAL_LABELS.get(str(raw), f"Canal {raw}")


def _normalize_deal(deal):
    """Normaliza deal cru do Pipedrive para struct interna."""
    stage_id = deal.get("stage_id")
    lost_dt = _parse_datetime(deal.get("lost_time"))
    add_dt = _parse_datetime(deal.get("add_time"))

    days_in_funnel = None
    if lost_dt and add_dt:
        days_in_funnel = (lost_dt - add_dt).days

    lost_hour = lost_dt.hour if lost_dt else None

    if stage_id in PIPEDRIVE_PRE_VENDAS_STAGES:
        stage_category = "pre_vendas"
    elif stage_id in PIPEDRIVE_VENDAS_STAGES:
        stage_category = "vendas"
    else:
        stage_category = "desconhecido"

    return {
        "deal_id": deal.get("id"),
        "title": deal.get("title", ""),
        "pipeline_id": deal.get("pipeline_id"),
        "stage_id": stage_id,
        "stage_name": PIPEDRIVE_SZS_STAGES.get(stage_id, f"Stage {stage_id}"),
        "stage_category": stage_category,
        "owner_name": deal.get("owner_name", ""),
        "owner_email": _resolve_owner_email(deal),
        "lost_time": deal.get("lost_time"),
        "lost_hour": lost_hour,
        "add_time": deal.get("add_time"),
        "days_in_funnel": days_in_funnel,
        "lost_reason": deal.get("lost_reason", ""),
        "canal": _resolve_canal(deal),
        "rd_campanha": deal.get(PIPEDRIVE_RD_CAMPANHA_FIELD) or "",
        "rd_source": deal.get(PIPEDRIVE_RD_SOURCE_FIELD) or "",
        "motivo_lost_mia": deal.get(PIPEDRIVE_MIA_LOST_FIELD) or "",
    }


# ── Função principal ─────────────────────────────────────────


def collect_pipedrive_losts(target_date, test=False):
    """
    Coleta deals lost do pipeline SZS para o dia alvo.

    Retorna: list[dict] — lista de deals normalizados.

    NOTA: diferente dos outros collectors que retornam dict[email],
    este retorna list[dict] porque cada deal é uma entidade individual.
    """
    if test:
        return _mock_pipedrive_data()

    if not PIPEDRIVE_API_TOKEN:
        log.error("PIPEDRIVE_API_TOKEN não configurado")
        return []

    all_deals = []
    start = 0
    limit = 500

    while True:
        log.info("  Pipedrive: buscando deals lost (start=%d)...", start)
        deals, more = _fetch_lost_deals(start=start, limit=limit)

        if not deals:
            break

        # Filtrar SZS + target_date client-side
        szs_deals = _filter_szs_by_date(deals, target_date)
        all_deals.extend(szs_deals)

        # Se o último deal já é anterior ao target_date, parar
        # (deals vêm ordenados por lost_time DESC)
        last_deal = deals[-1]
        last_dt = _parse_datetime(last_deal.get("lost_time"))
        if last_dt and last_dt.strftime("%Y-%m-%d") < target_date:
            break

        if not more:
            break
        start += limit

    # Normalizar
    normalized = [_normalize_deal(d) for d in all_deals]
    log.info("Pipedrive: %d deals lost SZS em %s", len(normalized), target_date)

    return normalized


# ── Mock data ────────────────────────────────────────────────


def _mock_pipedrive_data():
    """Dados mockados para --test."""
    return [
        {
            "deal_id": 90001,
            "title": "Test Deal - Timing Violation",
            "pipeline_id": 14,
            "stage_id": 72,
            "stage_name": "Qualificação",
            "stage_category": "pre_vendas",
            "owner_name": "Test Closer",
            "owner_email": "test@seazone.com.br",
            "lost_time": "2026-03-18 15:30:00",
            "lost_hour": 15,
            "add_time": "2026-03-10 10:00:00",
            "days_in_funnel": 8,
            "lost_reason": "Timing",
            "canal": "Marketing",
            "rd_campanha": "",
            "rd_source": "Busca Paga | Facebook Ads",
            "motivo_lost_mia": "",
        },
        {
            "deal_id": 90002,
            "title": "Test Deal - Advanced Stage Loss",
            "pipeline_id": 14,
            "stage_id": 76,
            "stage_name": "Contrato",
            "stage_category": "vendas",
            "owner_name": "Test Closer",
            "owner_email": "test@seazone.com.br",
            "lost_time": "2026-03-18 19:00:00",
            "lost_hour": 19,
            "add_time": "2026-01-15 10:00:00",
            "days_in_funnel": 62,
            "lost_reason": "Perfil do proprietário/Investidor - Valor Total",
            "canal": "Expansão",
            "rd_campanha": "",
            "rd_source": "",
            "motivo_lost_mia": "",
        },
        {
            "deal_id": 90003,
            "title": "Test Deal - Não Atende Pós-Reunião",
            "pipeline_id": 14,
            "stage_id": 151,
            "stage_name": "Reunião Realizada",
            "stage_category": "vendas",
            "owner_name": "Test SDR",
            "owner_email": "test.sdr@seazone.com.br",
            "lost_time": "2026-03-18 18:30:00",
            "lost_hour": 18,
            "add_time": "2026-03-05 10:00:00",
            "days_in_funnel": 13,
            "lost_reason": "Não atende/Não responde",
            "canal": "Marketing",
            "rd_campanha": "",
            "rd_source": "",
            "motivo_lost_mia": "",
        },
    ]
