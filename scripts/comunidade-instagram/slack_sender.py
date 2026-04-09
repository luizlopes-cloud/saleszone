"""Envia posts no Slack com replies em thread."""
from __future__ import annotations
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
        print(f"[slack] Erro: {result.get('error')} | canal={channel}")
    return result


def send_opportunity_posts(
    emp_name: str,
    emp_data: dict,
    posts: list[dict],
    day_labels: tuple[str, str, str],
    channels: list[str] | None = None,
) -> list[str]:
    """Envia 1 mensagem principal + 3 replies em thread para cada canal."""
    if channels is None:
        channels = [SLACK_CHANNEL_COMUNIDADE, SLACK_DM_JP]

    message_links = []

    # Header da oportunidade
    roi_str = f"{emp_data.get('roi', 0):.2f}%"
    preco_str = f"R$ {emp_data.get('preco_min', 0):,.0f}".replace(",", ".")
    area_str = emp_data.get("area", "")
    loc_str = emp_data.get("localizacao", "")

    header_lines = [
        f"*Comunidade Instagram — Semana {day_labels[0]}-{day_labels[2]}*",
        "",
        f"*{emp_name}*",
        f"📍 {loc_str}" if loc_str else "",
        f"💰 A partir de {preco_str}" + (f" | {area_str}" if area_str else ""),
        f"📈 ROI Líquido: *{roi_str}*",
        "",
        f"Posts abaixo ({'/'.join(day_labels)}) às *19h*. Respostas na thread 👇",
    ]
    header = "\n".join(line for line in header_lines if line is not None)

    for channel in channels:
        result = _slack_post(channel, header)
        ts = result.get("ts")

        if ts:
            channel_clean = channel if channel.startswith("C") else channel
            link = f"https://seazone-fund.slack.com/archives/{channel_clean}/p{ts.replace('.', '')}"
            message_links.append(link)
        else:
            message_links.append("")
            continue

        # Enviar 3 replies na thread
        for post in posts:
            type_label = {"spoiler": "Spoiler", "oportunidade": "Oportunidade", "educativo": "Educativo"}.get(
                post.get("type", ""), post.get("type", "").title()
            )
            text = f"*{post['day']} — {type_label}*\n\n{post['text']}"

            if post.get("image_url"):
                text += f"\n\n{post['image_url']}"

            if post.get("enquete"):
                text += "\n\n_Enquete:_"
                for opt in post["enquete"]:
                    text += f"\n• {opt}"

            _slack_post(channel, text, thread_ts=ts)

    return message_links
