import json
import urllib.request
from config import PIPEDRIVE_API_TOKEN, PIPEDRIVE_DOMAIN

BASE_URL = f"https://{PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1"

def _get(path, params=None):
    if not PIPEDRIVE_API_TOKEN:
        return None
    url = f"{BASE_URL}{path}?api_token={PIPEDRIVE_API_TOKEN}"
    if params:
        url += "&" + "&".join(f"{k}={v}" for k, v in params.items())
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def _post(path, data):
    if not PIPEDRIVE_API_TOKEN:
        return None
    url = f"{BASE_URL}{path}?api_token={PIPEDRIVE_API_TOKEN}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())

def find_deal_by_email(email):
    if not PIPEDRIVE_API_TOKEN:
        return None
    try:
        result = _get("/persons/search", {"term": email, "fields": "email", "limit": "1"})
        items = result.get("data", {}).get("items", [])
        if not items:
            return None
        person_id = items[0]["item"]["id"]
        deals = _get(f"/persons/{person_id}/deals", {"status": "open", "limit": "1"})
        deal_items = deals.get("data", [])
        return deal_items[0]["id"] if deal_items else None
    except Exception as e:
        print(f"[pipedrive] Error searching deal for {email}: {e}")
        return None

def create_activity(deal_id, subject, note=""):
    if not PIPEDRIVE_API_TOKEN or not deal_id:
        print(f"[pipedrive] Would create activity on deal {deal_id}: {subject}")
        return None
    try:
        return _post("/activities", {
            "deal_id": deal_id, "subject": subject, "note": note, "type": "task", "done": 0,
        })
    except Exception as e:
        print(f"[pipedrive] Error creating activity on deal {deal_id}: {e}")
        return None
