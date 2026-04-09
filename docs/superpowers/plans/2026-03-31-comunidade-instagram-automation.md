# Comunidade Instagram — Automacao Semanal

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Automacao que toda segunda 8h BRT seleciona 2 oportunidades (1 lancamento + 1 marketplace), scrapa imagens reais dos sites, gera 6 posts e envia no Slack.

**Architecture:** Script Python standalone em `scripts/comunidade-instagram/`. Playwright scrapa imagens de lancamentos/revendas.seazone.com.br. Claude API gera textos adaptados ao perfil de investidores de alto padrao. Slack API envia 2 mensagens + 3 replies cada no canal #comunidade-investidores e DM do JP.

**Tech Stack:** Python 3.12, Playwright, Anthropic SDK, Slack SDK (requests), Google Sheets CSV export

---

## Chunk 1: Estrutura Base e Config

### Task 1: Criar estrutura do projeto

**Files:**
- Create: `scripts/comunidade-instagram/config.py`
- Create: `scripts/comunidade-instagram/sent_log.json`

- [ ] **Step 1: Criar config.py com constantes**

```python
import os
import json
from pathlib import Path

# Slack
SLACK_BOT_TOKEN = os.environ["SLACK_BOT_TOKEN"]
SLACK_CHANNEL_COMUNIDADE = "C0AQ0C94DM0"  # #comunidade-investidores
SLACK_DM_JP = "D07M0MKUJUS"

# Claude API
ANTHROPIC_API_KEY = os.environ["ANTHROPIC_API_KEY"]
MODEL = "claude-sonnet-4-20250514"

# Data sources
MARKETPLACE_SHEET_URL = (
    "https://docs.google.com/spreadsheets/d/"
    "1TxQPhsa7Z8LP4eL9E7y-PfPiD4ds5RUrhti-48_Qo1c/export?format=csv"
)
LANCAMENTOS_URL = "https://lancamentos.seazone.com.br"
REVENDAS_URL = "https://revendas.seazone.com.br"

# Spotometro Supabase (acesso direto ao banco do Lovable app)
SPOTOMETRO_SUPABASE_URL = "https://pjbwfqtmacmpuvaosxxo.supabase.co"
SPOTOMETRO_SUPABASE_KEY = os.environ["SPOTOMETRO_SUPABASE_KEY"]

# ROI por empreendimento (fonte: Spotometro PDF 2026-03-31 + estimativas para novos)
ROI_MAP = {
    "Barra Grande Spot": 22.88,
    "Natal Spot": 21.65,
    "Itacaré Spot": 18.56,
    "Jurerê Spot III": 18.0,
    "Jurerê Spot II": 17.5,
    "Novo Campeche Spot II": 17.0,
    "Ponta das Canas Spot II": 16.5,
    "Caraguá Spot": 15.5,
    "Bonito Spot II": 14.5,
    "Vistas de Anitá II": 14.0,
}

# Config
POSTS_PER_OPPORTUNITY = 3  # spoiler + oportunidade + educativo
OPPORTUNITIES_PER_WEEK = 2  # 1 lancamento + 1 marketplace
POST_TIME = "19h"
SEND_TO = ["channel", "dm"]  # onde enviar

# Sent log (evita repeticao no mes)
SENT_LOG_PATH = Path(__file__).parent / "sent_log.json"

def load_sent_log() -> dict:
    if SENT_LOG_PATH.exists():
        return json.loads(SENT_LOG_PATH.read_text())
    return {"lancamentos": [], "marketplace": [], "last_month": ""}

def save_sent_log(log: dict):
    SENT_LOG_PATH.write_text(json.dumps(log, indent=2, ensure_ascii=False))
```

- [ ] **Step 2: Criar sent_log.json inicial**

```json
{
  "lancamentos": [],
  "marketplace": [],
  "last_month": ""
}
```

- [ ] **Step 3: Commit**

```bash
git add scripts/comunidade-instagram/
git commit -m "feat(comunidade-instagram): estrutura base e config"
```

---

### Task 2: Coletor de dados — Marketplace (Google Sheets)

**Files:**
- Create: `scripts/comunidade-instagram/data_marketplace.py`

- [ ] **Step 1: Criar coletor marketplace**

```python
"""Busca oportunidades de marketplace via Google Sheets CSV export."""
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
    categoria: str  # Repasse ou Lancamento

def fetch_marketplace_data() -> list[MarketplaceUnit]:
    """Busca CSV da planilha e retorna lista de empreendimentos ordenados por ROI."""
    # Segue redirect do Google Sheets
    req = urllib.request.Request(MARKETPLACE_SHEET_URL)
    with urllib.request.urlopen(req) as resp:
        if resp.status in (301, 302, 307):
            with urllib.request.urlopen(resp.headers["Location"]) as resp2:
                content = resp2.read().decode("utf-8")
        else:
            content = resp.read().decode("utf-8")

    reader = csv.DictReader(io.StringIO(content))
    units = []
    for row in reader:
        try:
            roi_str = row.get("ROI", "0").replace("%", "").replace(",", ".").strip()
            preco_str = row.get("Valor mínimo", "0").replace("R$", "").replace(".", "").replace(",", ".").strip()
            fat_str = row.get("Faturamento", "0").replace("R$", "").replace(".", "").replace(",", ".").strip()

            units.append(MarketplaceUnit(
                nome=row.get("Empreendimento", "").strip(),
                localizacao=row.get("Localização", "").strip(),
                estado=row.get("Estado", "").strip(),
                preco_min=float(preco_str) if preco_str else 0,
                roi=float(roi_str) if roi_str else 0,
                faturamento=float(fat_str) if fat_str else 0,
                status=row.get("Status", "").strip(),
                caracteristicas=row.get("Características", "").strip(),
                unidades=int(row.get("Unidades", "0") or 0),
                categoria=row.get("Categoria", "").strip(),
            ))
        except (ValueError, KeyError):
            continue

    # Filtrar apenas repasse com status valido e ordenar por ROI
    valid_status = {"Entregue", "Construção", "Comercialização", "Grupo Fechado"}
    marketplace = [u for u in units if u.categoria == "Repasse" and u.status in valid_status]
    marketplace.sort(key=lambda u: u.roi, reverse=True)
    return marketplace


def pick_marketplace(sent: list[str]) -> MarketplaceUnit | None:
    """Retorna proximo empreendimento marketplace nao enviado no mes (por ROI + preco acessivel)."""
    units = fetch_marketplace_data()
    # Score: ROI alto + preco acessivel (normalizado)
    if not units:
        return None
    max_preco = max(u.preco_min for u in units) or 1
    for u in units:
        u._score = u.roi * 0.6 + (1 - u.preco_min / max_preco) * 40 * 0.4
    units.sort(key=lambda u: u._score, reverse=True)
    for u in units:
        if u.nome not in sent:
            return u
    return None
```

- [ ] **Step 2: Testar localmente**

```bash
cd scripts/comunidade-instagram && python3 -c "
from data_marketplace import fetch_marketplace_data, pick_marketplace
units = fetch_marketplace_data()
print(f'{len(units)} empreendimentos marketplace')
top = pick_marketplace([])
print(f'Pick: {top.nome} - ROI {top.roi}% - R${top.preco_min:,.0f}')
"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/comunidade-instagram/data_marketplace.py
git commit -m "feat(comunidade-instagram): coletor de dados marketplace via Google Sheets"
```

---

### Task 3: Coletor de dados — Lancamentos (Spotometro Supabase)

**Files:**
- Create: `scripts/comunidade-instagram/data_lancamentos.py`

Fonte: Supabase do Spotometro (`pjbwfqtmacmpuvaosxxo`). Tabelas: `project_visibility` (lançamentos visíveis) + `units_cache` (unidades disponíveis). ROI por empreendimento vem do `ROI_MAP` em config.py (valores reais do PDF 2026-03-31 + estimativas para novos).

- [ ] **Step 1: Criar coletor lancamentos via Supabase**

```python
"""Busca oportunidades de lancamento direto do Supabase do Spotometro."""
import json
import urllib.request
from dataclasses import dataclass
from config import SPOTOMETRO_SUPABASE_URL, SPOTOMETRO_SUPABASE_KEY, ROI_MAP


@dataclass
class LancamentoUnit:
    nome: str
    cidade: str
    estado: str
    unidade: str
    valor: float
    area: float
    roi: float          # do ROI_MAP
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
    """Retorna unidades disponíveis de um empreendimento."""
    encoded = urllib.parse.quote(emp_name)
    rows = _supabase_get(
        f"units_cache?empreendimento=eq.{encoded}&status=eq.disponivel"
        f"&select=unidade,cidade,estado,area,valor_total,capacidade,entrada_rs,"
        f"total_parcelas,valor_parcela,total_reforcos,valor_reforco,vista_mar"
        f"&limit=200"
    )
    return rows


def pick_lancamento(sent: list[str]) -> tuple[str, LancamentoUnit] | None:
    """Retorna (nome_empreendimento, melhor_unidade) nao enviado no mes, por ROI desc."""
    import urllib.parse

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

        # Preferir unidade com melhor combinacao: entrada menor + area maior
        # (sem entrada_rs valida, usar valor_total como proxy)
        def unit_score(u: dict) -> float:
            entrada = u.get("entrada_rs") or u.get("valor_total", 999999)
            area = u.get("area") or 1
            return area / entrada  # area/entrada alta = melhor custo-beneficio

        best = max(units, key=unit_score)
        roi = ROI_MAP.get(emp_name, 15.0)

        return emp_name, LancamentoUnit(
            nome=emp_name,
            cidade=best.get("cidade", ""),
            estado=best.get("estado", ""),
            unidade=best.get("unidade", ""),
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
```

- [ ] **Step 2: Testar localmente**

```bash
cd scripts/comunidade-instagram
export SPOTOMETRO_SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqYndmcXRtYWNtcHV2YW9zeHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMjAwMTcsImV4cCI6MjA4NTY5NjAxN30.1CFr2v69lWQZ45ba6o4QoGl7fGDugT8zTljdpyRoBCA"
python3 -c "
from data_lancamentos import pick_lancamento, fetch_visible_lancamentos
emps = fetch_visible_lancamentos()
print(f'{len(emps)} lançamentos visíveis: {emps}')
result = pick_lancamento([])
if result:
    name, unit = result
    print(f'Pick: {name} - Unid {unit.unidade} - ROI {unit.roi}% - R\${unit.valor:,.0f}')
"
```

Expected: `10 lançamentos visíveis` + pick com Barra Grande Spot (ROI 22.88%).

- [ ] **Step 3: Commit**

```bash
git add scripts/comunidade-instagram/data_lancamentos.py
git commit -m "feat(comunidade-instagram): coletor de dados lancamentos via Spotometro Supabase"
```

---

## Chunk 2: Scraping de Imagens e Geracao de Textos

### Task 4: Scraper de imagens com Playwright

**Files:**
- Create: `scripts/comunidade-instagram/scraper.py`

- [ ] **Step 1: Criar scraper de imagens**

```python
"""Scrapa imagens dos empreendimentos de lancamentos/revendas.seazone.com.br"""
import asyncio
import re
from pathlib import Path

async def scrape_empreendimento_image(emp_name: str, is_lancamento: bool = True) -> str | None:
    """Scrapa imagem principal do empreendimento. Retorna URL da imagem ou None."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        raise ImportError("pip install playwright && playwright install chromium")

    base_url = "https://lancamentos.seazone.com.br" if is_lancamento else "https://revendas.seazone.com.br"
    slug = emp_name.lower().replace(" ", "-").replace("á", "a").replace("ê", "e").replace("ú", "u")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        # Tenta pagina especifica do empreendimento
        try:
            await page.goto(f"{base_url}/{slug}", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(3000)  # Notion precisa de tempo pra renderizar
        except Exception:
            # Fallback: pagina principal
            await page.goto(base_url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(3000)

        # Buscar imagens relevantes (Notion usa img tags com src de S3/CDN)
        images = await page.query_selector_all("img")
        image_urls = []
        for img in images:
            src = await img.get_attribute("src")
            if src and ("prod-files" in src or "amazonaws" in src or "notion" in src):
                # Filtrar logos e icones pequenos
                width = await img.evaluate("el => el.naturalWidth")
                if width and width > 200:
                    image_urls.append(src)

        # Se nao achou na pagina especifica, buscar na pagina principal por nome
        if not image_urls:
            await page.goto(base_url, wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(3000)

            # Procurar por texto do empreendimento
            elements = await page.query_selector_all(f"text=/{re.escape(emp_name)}/i")
            for el in elements:
                parent = await el.evaluate_handle("el => el.closest('div')")
                if parent:
                    imgs = await parent.query_selector_all("img")
                    for img in imgs:
                        src = await img.get_attribute("src")
                        if src and len(src) > 50:
                            image_urls.append(src)

        await browser.close()
        return image_urls[0] if image_urls else None


def get_image_url(emp_name: str, is_lancamento: bool = True) -> str | None:
    """Wrapper sync para scrape de imagem."""
    return asyncio.run(scrape_empreendimento_image(emp_name, is_lancamento))


async def scrape_empreendimento_description(emp_name: str, is_lancamento: bool = True) -> str:
    """Scrapa descricao/textos do empreendimento para enriquecer posts."""
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        return ""

    base_url = "https://lancamentos.seazone.com.br" if is_lancamento else "https://revendas.seazone.com.br"
    slug = emp_name.lower().replace(" ", "-").replace("á", "a").replace("ê", "e").replace("ú", "u")

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page()

        try:
            await page.goto(f"{base_url}/{slug}", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(3000)
            # Pegar todo o texto visivel
            text = await page.inner_text("body")
            await browser.close()
            return text[:5000]  # Limitar tamanho
        except Exception:
            await browser.close()
            return ""


def get_description(emp_name: str, is_lancamento: bool = True) -> str:
    """Wrapper sync."""
    return asyncio.run(scrape_empreendimento_description(emp_name, is_lancamento))
```

- [ ] **Step 2: Testar scraper localmente**

```bash
cd scripts/comunidade-instagram && python3 -c "
from scraper import get_image_url
url = get_image_url('Barra Grande Spot', is_lancamento=True)
print(f'Image URL: {url}')
"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/comunidade-instagram/scraper.py
git commit -m "feat(comunidade-instagram): scraper Playwright para imagens dos sites Notion"
```

---

### Task 5: Gerador de textos com Claude API

**Files:**
- Create: `scripts/comunidade-instagram/text_generator.py`

- [ ] **Step 1: Criar gerador de textos**

```python
"""Gera textos dos 6 posts semanais usando Claude API."""
import json
from anthropic import Anthropic
from config import ANTHROPIC_API_KEY, MODEL

client = Anthropic(api_key=ANTHROPIC_API_KEY)

SYSTEM_PROMPT = """Voce e um copywriter especializado em investimentos imobiliarios de alto padrao.
Seu publico: investidores sofisticados buscando oportunidades estrategicas com alta rentabilidade.

Tom: consultivo, direto, baseado em dados. Sem exageros, sem emojis excessivos.
Linguagem: portugues brasileiro, formal mas acessivel.
Formato: texto para comunidade do Instagram (canal de broadcast).

REGRAS:
- Use no maximo 2 emojis por post (apenas pontuais, funcionais)
- Lide com dados concretos: ROI, preco, faturamento, localizacao
- Nao diferencie entre lancamento e marketplace nos textos
- Nao use termos como "bombando", "queridinho", "imperdivel"
- Prefira: "performance consistente", "posicionamento estrategico", "janela de oportunidade"
- Cada post deve funcionar de forma independente mas criar continuidade na semana
"""

def generate_posts(
    emp_name: str,
    emp_data: dict,
    site_description: str = "",
    image_url: str | None = None,
    day_labels: tuple[str, str, str] = ("SEG", "TER", "QUA"),
) -> list[dict]:
    """Gera 3 posts (spoiler + oportunidade + educativo) para um empreendimento."""

    user_prompt = f"""Gere 3 posts para a comunidade de investidores do Instagram sobre o empreendimento abaixo.

EMPREENDIMENTO: {emp_name}
DADOS:
- Localizacao: {emp_data.get('localizacao', 'N/A')}
- Preco minimo: R$ {emp_data.get('preco_min', 0):,.0f}
- ROI Liquido: {emp_data.get('roi', 0):.2f}%
- Faturamento estimado: R$ {emp_data.get('faturamento', 0):,.0f}/ano
- Area: {emp_data.get('area', 'N/A')}
- Capacidade: {emp_data.get('capacidade', 'N/A')} hospedes
- Condicoes: Entrada {emp_data.get('entradas', 'N/A')} | Parcelas {emp_data.get('parcelas', 'N/A')} | Reforcos {emp_data.get('reforcos', 'N/A')}
- Unidades disponiveis: {emp_data.get('unidades', 'N/A')}
- Caracteristicas: {emp_data.get('caracteristicas', 'N/A')}

DESCRICAO DO SITE (use para enriquecer):
{site_description[:2000] if site_description else 'Nao disponivel'}

IMAGEM: {'Disponivel - referencie nos posts' if image_url else 'Nao disponivel - sugira tipo de imagem'}

FORMATO DE SAIDA (JSON):
{{
  "posts": [
    {{
      "day": "{day_labels[0]}",
      "type": "spoiler",
      "title": "titulo curto para referencia interna",
      "text": "texto completo do post com formatacao Slack (*bold*, _italic_)",
      "enquete": ["opcao1", "opcao2", "opcao3"]
    }},
    {{
      "day": "{day_labels[1]}",
      "type": "oportunidade",
      "title": "titulo curto",
      "text": "texto completo com dados, condicoes e CTA para [LINK LP]"
    }},
    {{
      "day": "{day_labels[2]}",
      "type": "educativo",
      "title": "titulo curto",
      "text": "conteudo educativo de valor referente a essa oportunidade (localizacao, mercado, tipo de investimento)"
    }}
  ]
}}

Retorne APENAS o JSON, sem markdown code blocks."""

    response = client.messages.create(
        model=MODEL,
        max_tokens=4000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    text = response.content[0].text.strip()
    # Limpar possivel markdown
    if text.startswith("```"):
        text = text.split("\n", 1)[1].rsplit("```", 1)[0]

    result = json.loads(text)
    posts = result["posts"]

    # Adicionar imagem URL se disponivel
    for post in posts:
        post["image_url"] = image_url

    return posts
```

- [ ] **Step 2: Testar geracao de texto**

```bash
cd scripts/comunidade-instagram && python3 -c "
from text_generator import generate_posts
posts = generate_posts('Barra Grande Spot', {
    'localizacao': 'Barra Grande, Marau - BA',
    'preco_min': 288750, 'roi': 22.88,
    'faturamento': 77110, 'area': '23m2',
    'capacidade': 5, 'entradas': '3x de R\$ 25.025',
    'parcelas': '34x de R\$ 3.142', 'reforcos': '6x de R\$ 17.806',
    'unidades': 18,
})
for p in posts:
    print(f\"--- {p['day']} - {p['type']} ---\")
    print(p['text'][:200])
    print()
"
```

- [ ] **Step 3: Commit**

```bash
git add scripts/comunidade-instagram/text_generator.py
git commit -m "feat(comunidade-instagram): gerador de posts com Claude API"
```

---

## Chunk 3: Envio Slack e Script Principal

### Task 6: Sender Slack

**Files:**
- Create: `scripts/comunidade-instagram/slack_sender.py`

- [ ] **Step 1: Criar sender Slack**

```python
"""Envia posts no Slack com imagens."""
import json
import urllib.request
from config import SLACK_BOT_TOKEN, SLACK_CHANNEL_COMUNIDADE, SLACK_DM_JP

def _slack_post(channel: str, text: str, thread_ts: str | None = None) -> dict:
    """Envia mensagem no Slack. Retorna response com ts."""
    payload = {"channel": channel, "text": text}
    if thread_ts:
        payload["thread_ts"] = thread_ts

    data = json.dumps(payload).encode()
    req = urllib.request.Request(
        "https://slack.com/api/chat.postMessage",
        data=data,
        headers={
            "Authorization": f"Bearer {SLACK_BOT_TOKEN}",
            "Content-Type": "application/json",
        },
    )
    with urllib.request.urlopen(req) as resp:
        result = json.loads(resp.read())
    if not result.get("ok"):
        print(f"Slack error: {result.get('error')}")
    return result


def send_opportunity_posts(
    emp_name: str,
    emp_data: dict,
    posts: list[dict],
    day_labels: tuple[str, str, str],
    channels: list[str] | None = None,
) -> list[str]:
    """Envia 1 mensagem principal + 3 replies para cada canal."""
    if channels is None:
        channels = [SLACK_CHANNEL_COMUNIDADE, SLACK_DM_JP]

    message_links = []

    # Header da oportunidade
    header = (
        f"*Comunidade Instagram — Semana*\n"
        f"*{emp_name}*\n\n"
        f"\U0001f4cd {emp_data.get('localizacao', '')}\n"
        f"\U0001f4b0 A partir de R$ {emp_data.get('preco_min', 0):,.0f} | {emp_data.get('area', '')}\n"
        f"\U0001f4c8 ROI Liquido: *{emp_data.get('roi', 0):.2f}%* | "
        f"Faturamento: R$ {emp_data.get('faturamento', 0):,.0f}/ano\n\n"
        f"Abaixo os 3 posts da semana ({'/'.join(day_labels)}). "
        f"Horario: *19h*.\nRespostas na thread \U0001f447"
    )

    for channel in channels:
        # Enviar header
        result = _slack_post(channel, header)
        ts = result.get("ts")
        link = f"https://seazone-fund.slack.com/archives/{channel}/p{ts.replace('.', '')}" if ts else ""
        message_links.append(link)

        if not ts:
            continue

        # Enviar 3 replies na thread
        for post in posts:
            text = f"*{post['day']} — {post['type'].title()}*\n\n{post['text']}"

            # Adicionar imagem se disponivel
            if post.get("image_url"):
                text += f"\n\n\U0001f4f8 {post['image_url']}"

            # Adicionar enquete se spoiler
            if post.get("enquete"):
                text += "\n\n_Enquete:_"
                for opt in post["enquete"]:
                    text += f"\n\u2022 {opt}"

            _slack_post(channel, text, thread_ts=ts)

    return message_links
```

- [ ] **Step 2: Commit**

```bash
git add scripts/comunidade-instagram/slack_sender.py
git commit -m "feat(comunidade-instagram): sender Slack com thread replies"
```

---

### Task 7: Script principal (orquestrador)

**Files:**
- Create: `scripts/comunidade-instagram/main.py`

- [ ] **Step 1: Criar script principal**

```python
#!/usr/bin/env python3
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
from scraper import get_image_url, get_description
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

    # 2. Selecionar marketplace
    mkt_unit = pick_marketplace(log["marketplace"])
    if not mkt_unit:
        print("[comunidade-instagram] Sem marketplace disponivel (todos ja enviados no mes)")
        sys.exit(0)

    print(f"[comunidade-instagram] Marketplace: {mkt_unit.nome} - ROI {mkt_unit.roi}%")

    # 3. Scrapar imagens e descricoes
    print("[comunidade-instagram] Scrapando imagens e descricoes...")
    lanc_image = get_image_url(lanc_name, is_lancamento=True)
    lanc_desc = get_description(lanc_name, is_lancamento=True)
    mkt_image = get_image_url(mkt_unit.nome, is_lancamento=False)
    mkt_desc = get_description(mkt_unit.nome, is_lancamento=False)

    print(f"  Lancamento imagem: {'OK' if lanc_image else 'NAO ENCONTRADA'}")
    print(f"  Marketplace imagem: {'OK' if mkt_image else 'NAO ENCONTRADA'}")

    # 4. Gerar textos
    print("[comunidade-instagram] Gerando textos com Claude...")
    lanc_data = {
        "localizacao": f"{lanc_unit.cidade}, {lanc_unit.estado}",
        "preco_min": lanc_unit.valor,
        "roi": lanc_unit.roi,
        "area": f"{lanc_unit.area:.1f}m²",
        "capacidade": lanc_unit.capacidade,
        "entradas": f"1x R$ {lanc_unit.entrada_rs:,.0f}" if lanc_unit.entrada_rs else "N/A",
        "parcelas": f"{lanc_unit.total_parcelas}x R$ {lanc_unit.valor_parcela:,.0f}" if lanc_unit.total_parcelas else "N/A",
        "reforcos": f"{lanc_unit.total_reforcos}x R$ {lanc_unit.valor_reforco:,.0f}" if lanc_unit.total_reforcos else "N/A",
        "vista_mar": lanc_unit.vista_mar,
    }
    mkt_data = {
        "localizacao": f"{mkt_unit.localizacao}, {mkt_unit.estado}",
        "preco_min": mkt_unit.preco_min,
        "roi": mkt_unit.roi,
        "faturamento": mkt_unit.faturamento,
        "area": "",
        "caracteristicas": mkt_unit.caracteristicas,
        "unidades": mkt_unit.unidades,
    }

    lanc_posts = generate_posts(
        lanc_name, lanc_data, lanc_desc, lanc_image,
        day_labels=("SEG", "TER", "QUA"),
    )
    mkt_posts = generate_posts(
        mkt_unit.nome, mkt_data, mkt_desc, mkt_image,
        day_labels=("QUI", "SEX", "SAB"),
    )

    # 5. Enviar ou dry-run
    if dry_run:
        print("\n[DRY RUN] Posts gerados mas NAO enviados:")
        for p in lanc_posts + mkt_posts:
            print(f"\n--- {p['day']} - {p['type']} ---")
            print(p["text"][:300])
        return

    print("[comunidade-instagram] Enviando no Slack...")
    lanc_links = send_opportunity_posts(
        lanc_name, lanc_data, lanc_posts, ("SEG", "TER", "QUA"),
    )
    mkt_links = send_opportunity_posts(
        mkt_unit.nome, mkt_data, mkt_posts, ("QUI", "SEX", "SAB"),
    )

    # 6. Atualizar log
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
```

- [ ] **Step 2: Criar requirements.txt local**

```
anthropic>=0.40.0
requests>=2.31.0
pdfplumber>=0.11.0
playwright>=1.40.0
```

- [ ] **Step 3: Testar dry-run**

```bash
cd scripts/comunidade-instagram && python3 main.py --dry-run --pdf /path/to/Spotometro.pdf
```

- [ ] **Step 4: Commit**

```bash
git add scripts/comunidade-instagram/main.py scripts/comunidade-instagram/requirements.txt
git commit -m "feat(comunidade-instagram): script principal com dry-run"
```

---

## Chunk 4: GitHub Actions Workflow

### Task 8: Workflow GitHub Actions

**Files:**
- Create: `.github/workflows/comunidade-instagram.yml`

- [ ] **Step 1: Criar workflow**

```yaml
name: Comunidade Instagram — Envio Semanal

on:
  schedule:
    - cron: '0 11 * * 1'  # Segunda 8h BRT (11h UTC)
  workflow_dispatch:
    inputs:
      dry_run:
        description: 'Apenas simular (true/false)'
        required: false
        default: 'false'

jobs:
  envio-semanal:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-python@v5
        with:
          python-version: '3.12'
          cache: 'pip'
          cache-dependency-path: scripts/comunidade-instagram/requirements.txt

      - name: Install dependencies
        run: |
          pip install -r scripts/comunidade-instagram/requirements.txt
          playwright install chromium --with-deps

      - name: Run comunidade-instagram
        env:
          SLACK_BOT_TOKEN: ${{ secrets.SLACK_BOT_TOKEN }}
          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}
          SPOTOMETRO_SUPABASE_KEY: ${{ secrets.SPOTOMETRO_SUPABASE_KEY }}
          DRY_RUN: ${{ inputs.dry_run || 'false' }}
        run: |
          cd scripts/comunidade-instagram
          if [ "$DRY_RUN" = "true" ]; then
            python main.py --dry-run
          else
            python main.py
          fi

      - name: Summary
        if: always()
        run: |
          echo "## Comunidade Instagram — Envio Semanal" >> $GITHUB_STEP_SUMMARY
          echo "Executado em $(date -u '+%Y-%m-%d %H:%M UTC')" >> $GITHUB_STEP_SUMMARY
```

- [ ] **Step 2: Adicionar secret no GitHub**

Secrets que precisam existir em `seazone-socios/saleszone`:
- `SLACK_BOT_TOKEN` (ja existe)
- `ANTHROPIC_API_KEY` (verificar se ja existe)
- `SPOTOMETRO_SUPABASE_KEY` — **NOVO**: anon key do Supabase do Spotometro

```bash
gh secret set SPOTOMETRO_SUPABASE_KEY \
  --body "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqYndmcXRtYWNtcHV2YW9zeHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMjAwMTcsImV4cCI6MjA4NTY5NjAxN30.1CFr2v69lWQZ45ba6o4QoGl7fGDugT8zTljdpyRoBCA" \
  --repo seazone-socios/saleszone
```

- [ ] **Step 3: Commit e push**

```bash
git add .github/workflows/comunidade-instagram.yml
git commit -m "feat(comunidade-instagram): workflow GitHub Actions toda segunda 8h BRT"
```

---

## Chunk 5: Teste End-to-End

### Task 9: Teste completo da automacao

- [ ] **Step 1: Definir secrets locais e testar dry-run**

```bash
cd scripts/comunidade-instagram
export SLACK_BOT_TOKEN="..."
export ANTHROPIC_API_KEY="..."
export SPOTOMETRO_SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBqYndmcXRtYWNtcHV2YW9zeHhvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxMjAwMTcsImV4cCI6MjA4NTY5NjAxN30.1CFr2v69lWQZ45ba6o4QoGl7fGDugT8zTljdpyRoBCA"
python main.py --dry-run
```

Expected:
- `10 lançamentos visíveis`
- Pick: Barra Grande Spot (ROI 22.88%)
- Pick: Marista 144 Spot (marketplace)
- 6 posts gerados, nenhum enviado

- [ ] **Step 2: Disparar workflow manualmente no GitHub com dry_run=true**

```bash
gh workflow run comunidade-instagram.yml \
  --repo seazone-socios/saleszone \
  --field dry_run=true
```

- [ ] **Step 3: Verificar logs no GitHub Actions**

- [ ] **Step 4: Commit final com tudo**

```bash
git add -A
git commit -m "feat(comunidade-instagram): automacao completa v1 (Supabase + Playwright + Claude + Slack)"
```
