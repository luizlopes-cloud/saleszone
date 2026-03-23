#!/usr/bin/env python3
"""
Friday morning follow-up — check who hasn't posted heartbeat and notify individually.
Runs Friday 9h BRT via launchd.
"""

import json
import requests
from datetime import datetime, timedelta, timezone

TOKEN = os.environ.get("HEARTBEATS_SLACK_TOKEN", "")
BRT = timezone(timedelta(hours=-3))
HEADERS = {"Authorization": f"Bearer {TOKEN}", "Content-Type": "application/json"}

# Channels to monitor
CHANNELS = {
    "C06SLRZVBTL": "heartbeats-cro",
    "C04QY0ALXAS": "heartbeats-marketing",
    "C08AE1Y6BGR": "heartbeats-comercial",
    "C0ANV4SP38Q": "heartbeats-comercial-szi-cro",
    "C0AN63WCQ30": "heartbeats-comercial-szs-cro",
    "C0AN85JLRL2": "heartbeats-comercial-decor-cro",
    "C0AN9SUPY5P": "heartbeats-marketplace",
}

# Bot/app user IDs to exclude from "missing" list
EXCLUDE_USERS = {
    "U0625PXJC4Q",  # Ambrosi (admin)
    "USLACKBOT",
}


def get_channel_members(channel_id: str) -> list[str]:
    """Get all members of a channel."""
    members = []
    cursor = ""
    while True:
        params = {"channel": channel_id, "limit": 200}
        if cursor:
            params["cursor"] = cursor
        resp = requests.get(
            "https://slack.com/api/conversations.members",
            headers=HEADERS,
            params=params,
        )
        data = resp.json()
        if not data.get("ok"):
            print(f"  Error getting members for {channel_id}: {data.get('error')}")
            return []
        members.extend(data.get("members", []))
        cursor = data.get("response_metadata", {}).get("next_cursor", "")
        if not cursor:
            break
    return members


def get_posters_since(channel_id: str, oldest: str) -> set[str]:
    """Get set of user IDs who posted messages (not joins/system) since timestamp."""
    posters = set()
    cursor = ""
    while True:
        params = {"channel": channel_id, "oldest": oldest, "limit": 200}
        if cursor:
            params["cursor"] = cursor
        resp = requests.get(
            "https://slack.com/api/conversations.history",
            headers=HEADERS,
            params=params,
        )
        data = resp.json()
        if not data.get("ok"):
            print(f"  Error getting history for {channel_id}: {data.get('error')}")
            return posters
        for msg in data.get("messages", []):
            # Skip system messages (joins, topic changes, etc.)
            subtype = msg.get("subtype", "")
            if subtype in ("channel_join", "channel_leave", "channel_topic",
                           "channel_purpose", "channel_name", "channel_archive",
                           "channel_unarchive", "bot_message", "reminder_add"):
                continue
            user = msg.get("user")
            if user:
                posters.add(user)
            # Also check thread replies
            if msg.get("reply_count", 0) > 0:
                thread_ts = msg.get("ts")
                tresp = requests.get(
                    "https://slack.com/api/conversations.replies",
                    headers=HEADERS,
                    params={"channel": channel_id, "ts": thread_ts, "limit": 200},
                )
                tdata = tresp.json()
                if tdata.get("ok"):
                    for reply in tdata.get("messages", [])[1:]:  # skip parent
                        reply_user = reply.get("user")
                        if reply_user:
                            posters.add(reply_user)
        cursor = data.get("response_metadata", {}).get("next_cursor", "")
        if not cursor:
            break
    return posters


def get_user_name(user_id: str) -> str:
    """Get display name for a user."""
    resp = requests.get(
        "https://slack.com/api/users.info",
        headers=HEADERS,
        params={"user": user_id},
    )
    data = resp.json()
    if data.get("ok"):
        user = data["user"]
        return (
            user.get("profile", {}).get("display_name")
            or user.get("real_name")
            or user.get("name")
            or user_id
        )
    return user_id


def send_message(channel_id: str, text: str):
    """Send message via Heartbeats app."""
    resp = requests.post(
        "https://slack.com/api/chat.postMessage",
        headers=HEADERS,
        json={
            "channel": channel_id,
            "text": text,
            "username": "Heartbeats",
            "icon_emoji": ":clipboard:",
        },
    )
    data = resp.json()
    if not data.get("ok"):
        print(f"  Error sending to {channel_id}: {data.get('error')}")
    return data.get("ok", False)


def main():
    now = datetime.now(BRT)
    print(f"[{now.strftime('%H:%M:%S')}] Heartbeat follow-up starting...")

    # Look back to Wednesday 00:00 (gives people Thu + Fri morning)
    days_since_wed = (now.weekday() - 2) % 7  # Wednesday = 2
    cutoff = now.replace(hour=0, minute=0, second=0, microsecond=0) - timedelta(days=days_since_wed)
    oldest = str(int(cutoff.timestamp()))
    print(f"  Checking messages since {cutoff.strftime('%Y-%m-%d %H:%M')} BRT")

    for channel_id, channel_name in CHANNELS.items():
        print(f"\n  #{channel_name} ({channel_id}):")

        members = get_channel_members(channel_id)
        if not members:
            print(f"    Skipping — no members or no access")
            continue

        # Filter out bots and excluded users
        human_members = [m for m in members if m not in EXCLUDE_USERS]
        posters = get_posters_since(channel_id, oldest)

        missing = [m for m in human_members if m not in posters]
        print(f"    Members: {len(human_members)}, Posted: {len(posters)}, Missing: {len(missing)}")

        if not missing:
            print(f"    Everyone posted!")
            continue

        # Get names for missing users
        missing_mentions = []
        for user_id in missing:
            missing_mentions.append(f"<@{user_id}>")

        mentions_str = ", ".join(missing_mentions)
        msg = f"Falta o heartbeat de: {mentions_str}\n\nPor favor enviem ate o meio-dia de hoje (sexta-feira)."
        send_message(channel_id, msg)
        print(f"    Sent follow-up mentioning {len(missing)} people")

    print(f"\n[{datetime.now(BRT).strftime('%H:%M:%S')}] Done.")


if __name__ == "__main__":
    main()
