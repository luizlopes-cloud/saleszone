"""Scrapa imagens e descricoes dos sites lancamentos/revendas.seazone.com.br."""
from __future__ import annotations
import asyncio
import re
import unicodedata


def _slugify(name: str) -> str:
    """Converte nome do empreendimento para slug de URL."""
    # Remove "Spot" e sufixos numericos, converte para slug
    slug = name.lower()
    slug = slug.replace(" spot", "").replace(" ii", "-ii").replace(" i", "-i")
    # Normalizar acentos
    slug = unicodedata.normalize("NFD", slug)
    slug = "".join(c for c in slug if unicodedata.category(c) != "Mn")
    slug = re.sub(r"[^a-z0-9\-]", "-", slug)
    slug = re.sub(r"-+", "-", slug).strip("-")
    return slug


async def _scrape_async(emp_name: str, base_url: str) -> tuple[str | None, str]:
    """Scrapa imagem e descricao de um site Notion. Retorna (image_url, descricao)."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("[scraper] playwright nao instalado - usando fallback")
        return None, ""

    slug = _slugify(emp_name)
    urls_to_try = [
        f"{base_url}/{slug}",
        f"{base_url}/{slug}-spot",
        base_url,
    ]

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        try:
            for url in urls_to_try:
                try:
                    page = await browser.new_page()
                    await page.goto(url, wait_until="networkidle", timeout=30000)
                    await page.wait_for_timeout(3000)

                    # Tentar achar imagem do empreendimento
                    image_url = None

                    # 1. Notion page cover
                    cover = await page.query_selector(".notion-page-cover-image img, .notion-cover img")
                    if cover:
                        image_url = await cover.get_attribute("src")

                    # 2. Primeira imagem grande no conteudo
                    if not image_url:
                        imgs = await page.query_selector_all("img[src*='amazonaws'], img[src*='notion'], img[src*='seazone']")
                        for img in imgs:
                            src = await img.get_attribute("src")
                            if src and len(src) > 50:
                                # Verificar tamanho minimo (nao icone)
                                box = await img.bounding_box()
                                if box and box.get("width", 0) > 300:
                                    image_url = src
                                    break

                    # Extrair texto descritivo
                    text_content = await page.evaluate("""() => {
                        const blocks = document.querySelectorAll('.notion-text-block, .notion-header-block, p');
                        return Array.from(blocks).slice(0, 20).map(b => b.textContent).join(' ');
                    }""")

                    await browser.close()
                    return image_url, (text_content or "")[:3000]

                except Exception:
                    continue

        finally:
            try:
                await browser.close()
            except Exception:
                pass

    return None, ""


def get_image_url(emp_name: str, is_lancamento: bool = True) -> str | None:
    """Retorna URL da imagem principal do empreendimento."""
    base_url = "https://lancamentos.seazone.com.br" if is_lancamento else "https://revendas.seazone.com.br"
    image_url, _ = asyncio.run(_scrape_async(emp_name, base_url))
    return image_url


def get_description(emp_name: str, is_lancamento: bool = True) -> str:
    """Retorna descricao textual do empreendimento."""
    base_url = "https://lancamentos.seazone.com.br" if is_lancamento else "https://revendas.seazone.com.br"
    _, description = asyncio.run(_scrape_async(emp_name, base_url))
    return description


def get_image_and_description(emp_name: str, is_lancamento: bool = True) -> tuple[str | None, str]:
    """Retorna (image_url, descricao) em uma unica chamada (mais eficiente)."""
    base_url = "https://lancamentos.seazone.com.br" if is_lancamento else "https://revendas.seazone.com.br"
    return asyncio.run(_scrape_async(emp_name, base_url))
