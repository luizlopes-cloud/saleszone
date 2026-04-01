"""Gera textos dos posts semanais usando Claude API."""
from __future__ import annotations
import json
from anthropic import Anthropic
from config import ANTHROPIC_API_KEY, MODEL

client = Anthropic(api_key=ANTHROPIC_API_KEY)

SYSTEM_PROMPT = """Voce e um copywriter especializado em investimentos imobiliarios de alto padrao.
Seu publico: investidores sofisticados buscando oportunidades estrategicas com alta rentabilidade na area de short stay / Airbnb.

Tom: consultivo, direto, baseado em dados. Sem exageros, sem emojis excessivos.
Linguagem: portugues brasileiro, formal mas acessivel.
Formato: texto para comunidade do Instagram (canal de broadcast).

REGRAS:
- Use no maximo 2 emojis por post (apenas pontuais, funcionais)
- Trabalhe com dados concretos: ROI, preco, area, capacidade, condicoes de pagamento
- Nao diferencie nos textos se e lancamento ou marketplace (repasse) — trate como "oportunidade"
- Nao use termos como "bombando", "queridinho", "imperdivel", "incrivel"
- Prefira: "performance consistente", "posicionamento estrategico", "janela de oportunidade", "retorno documentado"
- Cada post deve funcionar de forma independente mas criar continuidade na semana
- Use formatacao Slack: *negrito*, _italico_, mas nao use markdown de heading (#)
- Posts devem ser de 150-300 palavras cada
"""


def generate_posts(
    emp_name: str,
    emp_data: dict,
    site_description: str = "",
    image_url: str | None = None,
    day_labels: tuple[str, str, str] = ("SEG", "TER", "QUA"),
) -> list[dict]:
    """Gera 3 posts (spoiler + oportunidade + educativo) para um empreendimento."""

    cond_parts = []
    if emp_data.get("entradas") and emp_data["entradas"] != "N/A":
        cond_parts.append(f"Entrada: {emp_data['entradas']}")
    if emp_data.get("parcelas") and emp_data["parcelas"] != "N/A":
        cond_parts.append(f"Parcelas: {emp_data['parcelas']}")
    if emp_data.get("reforcos") and emp_data["reforcos"] != "N/A":
        cond_parts.append(f"Reforcos: {emp_data['reforcos']}")
    condicoes = " | ".join(cond_parts) if cond_parts else "Consultar condições"

    user_prompt = f"""Gere 3 posts para a comunidade de investidores do Instagram sobre o empreendimento abaixo.

EMPREENDIMENTO: {emp_name}
LOCALIZACAO: {emp_data.get("localizacao", "N/A")}
DADOS:
- Preco: R$ {emp_data.get("preco_min", 0):,.0f}
- ROI Liquido anual: {emp_data.get("roi", 0):.2f}%
- Area: {emp_data.get("area", "N/A")}
- Capacidade: {emp_data.get("capacidade", "N/A")} hospedes
- Vista para o mar: {emp_data.get("vista_mar", "nao informada")}
- Condicoes de pagamento: {condicoes}
- Caracteristicas adicionais: {emp_data.get("caracteristicas", "N/A")}

DESCRICAO DO SITE (use para enriquecer os posts com contexto de localizacao e diferenciais):
{site_description[:2000] if site_description else "Nao disponivel — use o que sabe sobre o destino"}

IMAGEM DISPONIVEL: {"Sim — mencione nos posts que ha uma imagem ilustrativa" if image_url else "Nao"}

Retorne um JSON com exatamente este formato:
{{
  "posts": [
    {{
      "day": "{day_labels[0]}",
      "type": "spoiler",
      "text": "texto completo do post — gere expectativa para a oportunidade sem revelar o empreendimento ainda. Termine com uma enquete de 3 opcoes.",
      "enquete": ["opcao1", "opcao2", "opcao3"]
    }},
    {{
      "day": "{day_labels[1]}",
      "type": "oportunidade",
      "text": "texto completo com todos os dados, condicoes e CTA: entre em contato para conhecer melhor"
    }},
    {{
      "day": "{day_labels[2]}",
      "type": "educativo",
      "text": "conteudo educativo de valor sobre a localizacao, mercado de short stay ou tipo de investimento — nao repita os dados do post anterior, agregue conhecimento"
    }}
  ]
}}

Retorne APENAS o JSON, sem texto antes ou depois."""

    response = client.messages.create(
        model=MODEL,
        max_tokens=2000,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": user_prompt}],
    )

    raw = response.content[0].text.strip()
    # Remover markdown se Claude envolver em ```json
    if raw.startswith("```"):
        raw = raw.split("```")[1]
        if raw.startswith("json"):
            raw = raw[4:]
    raw = raw.strip()

    try:
        data = json.loads(raw)
        posts = data.get("posts", [])
        # Adicionar image_url aos posts se disponivel
        for p in posts:
            if image_url:
                p["image_url"] = image_url
        return posts
    except json.JSONDecodeError:
        # Fallback: retornar post de erro para debug
        return [{"day": day_labels[0], "type": "error", "text": raw[:500]}]
