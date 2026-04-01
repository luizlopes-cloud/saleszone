"""Busca oportunidades de marketplace via Google Sheets CSV export."""
from __future__ import annotations
import csv
import io
import urllib.request
from dataclasses import dataclass
from config import MARKETPLACE_SHEET_URL


@dataclass
class MarketplaceUnit:
    nome: str
    localizacao: str
    estado: str
    preco_min: float
    roi: float
    faturamento: float
    status: str
    caracteristicas: str
    unidades: int
    categoria: str


def fetch_marketplace_data() -> list[MarketplaceUnit]:
    """Busca CSV da planilha e retorna lista de empreendimentos ordenados por ROI."""
    req = urllib.request.Request(
        MARKETPLACE_SHEET_URL,
        headers={"User-Agent": "Mozilla/5.0"},
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            content = resp.read().decode("utf-8")
    except urllib.error.HTTPError as e:
        if e.code in (301, 302, 307, 308):
            with urllib.request.urlopen(e.headers["Location"], timeout=30) as resp2:
                content = resp2.read().decode("utf-8")
        else:
            raise

    reader = csv.DictReader(io.StringIO(content))
    units = []
    for row in reader:
        try:
            # Coluna ROI% no CSV (ex: "20,86%")
            roi_str = row.get("ROI%", "0").replace("%", "").replace(",", ".").strip()
            # Retorno (ex: "14,00%") - fallback se ROI% nao disponivel
            if not roi_str or roi_str == "0":
                roi_str = row.get("Retorno", "0").replace("%", "").replace(",", ".").strip()

            preco_str = row.get("Valor mínimo", row.get("Cota mais barata", "0"))
            preco_str = preco_str.replace("R$", "").replace(".", "").replace(",", ".").replace(" ", "").strip()

            # ROI absoluto como proxy de faturamento anual
            fat_str = row.get("ROI absoluto", "0").replace("R$", "").replace(".", "").replace(",", ".").replace(" ", "").strip()

            # Localizacao: usar Estado + Regiao (campo Localização é placeholder "ver X")
            estado_raw = row.get("Estado", "").strip()
            regiao = row.get("Região", row.get("Regiao", "")).strip()
            # Estado pode ser "SC - norte da ilha" — pegar apenas a sigla
            estado_sigla = estado_raw.split("-")[0].strip() if "-" in estado_raw else estado_raw

            nome = row.get("Empreendimento", "").strip()
            # Localizacao: usar nome sem "Spot" como cidade aproximada
            cidade_aprox = nome.replace(" Spot", "").replace(" II", "").replace(" III", "").strip()

            units.append(MarketplaceUnit(
                nome=nome,
                localizacao=cidade_aprox,
                estado=estado_sigla,
                preco_min=float(preco_str) if preco_str and preco_str != "0" else 0,
                roi=float(roi_str) if roi_str and roi_str != "0" else 0,
                faturamento=float(fat_str) if fat_str and fat_str != "0" else 0,
                status=row.get("Status", "").strip(),
                caracteristicas=row.get("Características", row.get("Caracteristicas", "")).strip(),
                unidades=int(row.get("Número de unidades", row.get("Numero de unidades", "0")) or 0),
                categoria=row.get("Categoria", "").strip(),
            ))
        except (ValueError, KeyError):
            continue

    # Filtrar apenas repasse com status valido e ordenar por ROI
    valid_status = {"Entregue", "Construção", "Construcao", "Comercialização", "Comercializacao", "Grupo Fechado"}
    marketplace = [u for u in units if u.categoria == "Repasse" and u.status in valid_status and u.nome]
    marketplace.sort(key=lambda u: u.roi, reverse=True)
    return marketplace


def pick_marketplace(sent: list[str]) -> MarketplaceUnit | None:
    """Retorna proximo empreendimento marketplace nao enviado no mes (por ROI + preco acessivel)."""
    units = fetch_marketplace_data()
    if not units:
        return None

    max_preco = max(u.preco_min for u in units if u.preco_min > 0) or 1
    scored = []
    for u in units:
        score = u.roi * 0.6 + (1 - u.preco_min / max_preco) * 40 * 0.4
        scored.append((score, u))
    scored.sort(key=lambda x: x[0], reverse=True)

    for _, u in scored:
        if u.nome not in sent:
            return u
    return None
