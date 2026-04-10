"""Busca oportunidades de lancamento direto do Supabase do Spotometro."""
from __future__ import annotations
import json
import urllib.request
import urllib.parse
from dataclasses import dataclass
from typing import Optional
from config import SPOTOMETRO_SUPABASE_URL, SPOTOMETRO_SUPABASE_KEY, ROI_MAP


@dataclass
class LancamentoUnit:
    nome: str
    cidade: str
    estado: str
    unidade: str
    valor: float
    area: float
    roi: float
    capacidade: int
    entrada_rs: float
    total_parcelas: int
    valor_parcela: float
    total_reforcos: int
    valor_reforco: float
    vista_mar: str


def _supabase_get(path: str) -> list[dict]:
    """Faz GET na REST API do Supabase do Spotometro."""
    url = f"{SPOTOMETRO_SUPABASE_URL}/rest/v1/{path}"
    req = urllib.request.Request(url, headers={
        "apikey": SPOTOMETRO_SUPABASE_KEY,
        "Authorization": f"Bearer {SPOTOMETRO_SUPABASE_KEY}",
    })
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode("utf-8"))


def fetch_visible_lancamentos() -> list[str]:
    """Retorna lista de empreendimentos visiveis na categoria lancamento."""
    rows = _supabase_get("project_visibility?visible=eq.true&category=eq.lancamento&limit=100")
    return [r["project_name"] for r in rows]


def fetch_units_for_emp(emp_name: str) -> list[dict]:
    """Retorna unidades disponiveis de um empreendimento."""
    encoded = urllib.parse.quote(emp_name)
    return _supabase_get(
        f"units_cache?empreendimento=eq.{encoded}&status=eq.disponivel"
        f"&select=unidade,cidade,estado,area,valor_total,capacidade,entrada_rs,"
        f"total_parcelas,valor_parcela,total_reforcos,valor_reforco,vista_mar"
        f"&limit=200"
    )


def pick_lancamento(sent: list[str]) -> tuple[str, LancamentoUnit] | None:
    """Retorna (nome_empreendimento, melhor_unidade) nao enviado no mes, por ROI desc."""
    visible = fetch_visible_lancamentos()

    # Ordenar pelo ROI_MAP (desc), fallback 15.0 para desconhecidos
    visible_ranked = sorted(
        visible,
        key=lambda n: ROI_MAP.get(n, 15.0),
        reverse=True,
    )

    for emp_name in visible_ranked:
        if emp_name in sent:
            continue
        units = fetch_units_for_emp(emp_name)
        if not units:
            continue

        # Preferir unidade com melhor combinacao: area maior / entrada menor
        def unit_score(u: dict) -> float:
            entrada = u.get("entrada_rs") or u.get("valor_total") or 999999
            area = u.get("area") or 1
            return area / entrada

        best = max(units, key=unit_score)
        roi = ROI_MAP.get(emp_name, 15.0)

        return emp_name, LancamentoUnit(
            nome=emp_name,
            cidade=best.get("cidade") or "",
            estado=best.get("estado") or "",
            unidade=best.get("unidade") or "",
            valor=best.get("valor_total") or 0,
            area=best.get("area") or 0,
            roi=roi,
            capacidade=best.get("capacidade") or 2,
            entrada_rs=best.get("entrada_rs") or 0,
            total_parcelas=best.get("total_parcelas") or 0,
            valor_parcela=best.get("valor_parcela") or 0,
            total_reforcos=best.get("total_reforcos") or 0,
            valor_reforco=best.get("valor_reforco") or 0,
            vista_mar=best.get("vista_mar") or "",
        )

    return None
