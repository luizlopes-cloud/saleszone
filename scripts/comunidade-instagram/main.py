#!/usr/bin/env python3
from __future__ import annotations
"""
Comunidade Instagram — Automacao Semanal
Seleciona oportunidades, scrapa imagens, gera textos e envia no Slack.
"""
import argparse
import sys
from datetime import datetime

from config import load_sent_log, save_sent_log
from data_marketplace import pick_marketplace
from data_lancamentos import pick_lancamento
from scraper import get_image_and_description
from text_generator import generate_posts
from slack_sender import send_opportunity_posts


def run(dry_run: bool = False):
    """Executa a automacao semanal."""
    now = datetime.now()
    current_month = now.strftime("%Y-%m")
    week_start = now.strftime("%d/%m")

    print(f"[comunidade-instagram] Executando para semana de {week_start}")

    # Carregar log e resetar se mudou o mes
    log = load_sent_log()
    if log.get("last_month") != current_month:
        print(f"[comunidade-instagram] Novo mes ({current_month}), resetando log")
        log = {"lancamentos": [], "marketplace": [], "last_month": current_month}

    # 1. Selecionar lancamento (via Spotometro Supabase)
    lanc_result = pick_lancamento(log["lancamentos"])
    if not lanc_result:
        print("[comunidade-instagram] Sem lancamentos disponiveis (todos ja enviados no mes)")
        sys.exit(0)

    lanc_name, lanc_unit = lanc_result
    print(f"[comunidade-instagram] Lancamento: {lanc_name} - ROI {lanc_unit.roi}%")

    # 2. Selecionar marketplace (Google Sheets)
    mkt_unit = pick_marketplace(log["marketplace"])
    if not mkt_unit:
        print("[comunidade-instagram] Sem marketplace disponivel (todos ja enviados no mes)")
        sys.exit(0)

    print(f"[comunidade-instagram] Marketplace: {mkt_unit.nome} - ROI {mkt_unit.roi}%")

    # 3. Scrapar imagens e descricoes (uma chamada por empreendimento)
    print("[comunidade-instagram] Scrapando imagens e descricoes...")
    lanc_image, lanc_desc = get_image_and_description(lanc_name, is_lancamento=True)
    mkt_image, mkt_desc = get_image_and_description(mkt_unit.nome, is_lancamento=False)

    print(f"  Lancamento imagem: {'OK' if lanc_image else 'NAO ENCONTRADA'}")
    print(f"  Marketplace imagem: {'OK' if mkt_image else 'NAO ENCONTRADA'}")

    # 4. Montar dados para geracao de textos
    lanc_data = {
        "localizacao": f"{lanc_unit.cidade}, {lanc_unit.estado}",
        "preco_min": lanc_unit.valor,
        "roi": lanc_unit.roi,
        "area": f"{lanc_unit.area:.1f}m²" if lanc_unit.area else "N/A",
        "capacidade": lanc_unit.capacidade,
        "entradas": f"1x R$ {lanc_unit.entrada_rs:,.0f}" if lanc_unit.entrada_rs else "N/A",
        "parcelas": f"{lanc_unit.total_parcelas}x R$ {lanc_unit.valor_parcela:,.0f}" if lanc_unit.total_parcelas else "N/A",
        "reforcos": f"{lanc_unit.total_reforcos}x R$ {lanc_unit.valor_reforco:,.0f}" if lanc_unit.total_reforcos else "N/A",
        "vista_mar": lanc_unit.vista_mar or "nao informada",
    }
    mkt_data = {
        "localizacao": f"{mkt_unit.localizacao}, {mkt_unit.estado}",
        "preco_min": mkt_unit.preco_min,
        "roi": mkt_unit.roi,
        "area": "",
        "capacidade": "",
        "caracteristicas": mkt_unit.caracteristicas,
        "unidades": mkt_unit.unidades,
    }

    # 5. Gerar textos com Claude
    print("[comunidade-instagram] Gerando textos com Claude...")
    lanc_posts = generate_posts(
        lanc_name, lanc_data, lanc_desc, lanc_image,
        day_labels=("SEG", "TER", "QUA"),
    )
    mkt_posts = generate_posts(
        mkt_unit.nome, mkt_data, mkt_desc, mkt_image,
        day_labels=("QUI", "SEX", "SAB"),
    )

    # 6. Enviar ou dry-run
    if dry_run:
        print("\n[DRY RUN] Posts gerados mas NAO enviados:")
        print(f"\n=== {lanc_name} ===")
        for p in lanc_posts:
            print(f"\n--- {p.get('day')} - {p.get('type')} ---")
            print(p.get("text", "")[:500])
        print(f"\n=== {mkt_unit.nome} ===")
        for p in mkt_posts:
            print(f"\n--- {p.get('day')} - {p.get('type')} ---")
            print(p.get("text", "")[:500])
        return

    print("[comunidade-instagram] Enviando no Slack...")
    lanc_links = send_opportunity_posts(
        lanc_name, lanc_data, lanc_posts, ("SEG", "TER", "QUA"),
    )
    mkt_links = send_opportunity_posts(
        mkt_unit.nome, mkt_data, mkt_posts, ("QUI", "SEX", "SAB"),
    )

    # 7. Atualizar log
    log["lancamentos"].append(lanc_name)
    log["marketplace"].append(mkt_unit.nome)
    save_sent_log(log)

    print(f"\n[comunidade-instagram] Enviado com sucesso!")
    print(f"  Lancamento: {lanc_name} - {lanc_links}")
    print(f"  Marketplace: {mkt_unit.nome} - {mkt_links}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Comunidade Instagram - Automacao Semanal")
    parser.add_argument("--dry-run", action="store_true", help="Simular sem enviar")
    args = parser.parse_args()
    run(dry_run=args.dry_run)
