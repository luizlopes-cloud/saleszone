#!/usr/bin/env python3
"""
List all Slack channel canvases, filtering out those not updated in the last 7 days.
Outputs a CSV with columns: Nome, Tipo, Funil, Link

Usage:
  HEARTBEATS_SLACK_TOKEN=xoxb-... python3 scripts/slack_canvas_list.py
"""

import csv
import os
import sys
import time
import datetime
import requests

TOKEN = os.environ.get("HEARTBEATS_SLACK_TOKEN", "")
if not TOKEN:
    print("ERROR: Set HEARTBEATS_SLACK_TOKEN env var", file=sys.stderr)
    sys.exit(1)

HEADERS = {"Authorization": f"Bearer {TOKEN}"}
OUTPUT_FILE = "slack_canvas_list.csv"
TEAM_ID = "TDLTVAWQ6"
CUTOFF_DAYS = 7


def api_get(method, params=None):
    """Call Slack API GET with rate limit handling."""
    url = f"https://slack.com/api/{method}"
    r = requests.get(url, headers=HEADERS, params=params or {})
    data = r.json()
    if not data.get("ok"):
        err = data.get("error", "unknown")
        if err == "ratelimited":
            wait = int(r.headers.get("Retry-After", 10))
            print(f"  Rate limited, waiting {wait}s...", file=sys.stderr)
            time.sleep(wait + 1)
            return api_get(method, params)
        return data
    return data


def api_post(method, payload=None):
    """Call Slack API POST with rate limit handling."""
    url = f"https://slack.com/api/{method}"
    r = requests.post(url, headers={**HEADERS, "Content-Type": "application/json"}, json=payload or {})
    data = r.json()
    if not data.get("ok"):
        if data.get("error") == "ratelimited":
            wait = int(r.headers.get("Retry-After", 10))
            print(f"  Rate limited, waiting {wait}s...", file=sys.stderr)
            time.sleep(wait + 1)
            return api_post(method, payload)
    return data


def get_all_channels():
    """List all channels with pagination."""
    channels = []
    cursor = None
    page = 0
    while True:
        params = {"types": "public_channel,private_channel", "limit": 200}
        if cursor:
            params["cursor"] = cursor
        data = api_get("conversations.list", params)
        if not data.get("ok"):
            print(f"  conversations.list error: {data.get('error')}", file=sys.stderr)
            break
        batch = data.get("channels", [])
        channels.extend(batch)
        page += 1
        print(f"  Page {page}: +{len(batch)} = {len(channels)} total", file=sys.stderr)
        cursor = data.get("response_metadata", {}).get("next_cursor")
        if not cursor:
            break
        time.sleep(1)
    return channels


def get_canvas_updated(channel_id, canvas_id):
    """Get canvas updated timestamp via files.list on the channel."""
    # Join channel first (needed for visibility)
    api_post("conversations.join", {"channel": channel_id})
    time.sleep(0.3)

    # List files in channel, filter for our canvas
    page = 1
    data = api_get("files.list", {"channel": channel_id, "count": 100, "types": "all"})
    if not data.get("ok"):
        return None

    for f in data.get("files", []):
        if f.get("id") == canvas_id:
            return f.get("updated") or f.get("created")
        # Canvas files have filetype "quip"
        if f.get("filetype") == "quip" and f.get("id") == canvas_id:
            return f.get("updated") or f.get("created")

    return None


def main():
    cutoff = time.time() - (CUTOFF_DAYS * 86400)
    cutoff_dt = datetime.datetime.fromtimestamp(cutoff)
    print(f"Cutoff: {cutoff_dt.strftime('%Y-%m-%d %H:%M')} ({CUTOFF_DAYS} days ago)\n", file=sys.stderr)

    # Step 1: Get all channels with canvas
    print("Step 1: Fetching all channels...", file=sys.stderr)
    channels = get_all_channels()
    print(f"Found {len(channels)} channels\n", file=sys.stderr)

    canvas_channels = []
    for ch in channels:
        props = ch.get("properties", {})
        canvas_id = props.get("canvas", {}).get("file_id")
        if canvas_id:
            canvas_channels.append({
                "name": ch.get("name", "?"),
                "id": ch["id"],
                "canvas_id": canvas_id,
                "is_private": ch.get("is_private", False),
            })

    print(f"Channels with canvas: {len(canvas_channels)}\n", file=sys.stderr)

    # Step 2: Check updated time for each canvas
    print("Step 2: Checking canvas update times...", file=sys.stderr)
    rows_active = []
    rows_stale = []
    skipped = 0

    for i, cc in enumerate(canvas_channels):
        ch_name = cc["name"]
        ch_id = cc["id"]
        canvas_id = cc["canvas_id"]

        print(f"  [{i+1}/{len(canvas_channels)}] #{ch_name}...", end="", file=sys.stderr)

        updated_ts = get_canvas_updated(ch_id, canvas_id)
        time.sleep(0.5)  # Rate limit friendly

        link = f"https://app.slack.com/docs/{TEAM_ID}/{canvas_id}"
        row = {
            "Nome": f"#{ch_name}",
            "Tipo": "Canvas",
            "Funil": ch_name,
            "Link": link,
        }

        if updated_ts is None:
            # Can't determine — keep it (private channels where bot can't join)
            print(f" unknown (keeping)", file=sys.stderr)
            rows_active.append(row)
            skipped += 1
        else:
            dt = datetime.datetime.fromtimestamp(updated_ts)
            if updated_ts >= cutoff:
                print(f" active ({dt.strftime('%Y-%m-%d')})", file=sys.stderr)
                rows_active.append(row)
            else:
                print(f" STALE ({dt.strftime('%Y-%m-%d')})", file=sys.stderr)
                rows_stale.append(row)

    # Sort
    rows_active.sort(key=lambda r: r["Funil"])

    # Write CSV
    print(f"\n--- Results ---", file=sys.stderr)
    print(f"Active (updated < {CUTOFF_DAYS}d): {len(rows_active)}", file=sys.stderr)
    print(f"Stale (removed): {len(rows_stale)}", file=sys.stderr)
    print(f"Unknown (kept): {skipped}", file=sys.stderr)

    with open(OUTPUT_FILE, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["Nome", "Tipo", "Funil", "Link"])
        writer.writeheader()
        writer.writerows(rows_active)

    print(f"\nCSV saved to {OUTPUT_FILE} ({len(rows_active)} rows)", file=sys.stderr)

    # Print removed ones
    if rows_stale:
        print(f"\nRemoved (stale > {CUTOFF_DAYS} days):", file=sys.stderr)
        for r in rows_stale:
            print(f"  {r['Nome']}", file=sys.stderr)


if __name__ == "__main__":
    main()
