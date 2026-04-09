import json
import urllib.request
import urllib.error
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY


class SupabaseError(Exception):
    def __init__(self, status, message):
        self.status = status
        self.message = message
        super().__init__(f"Supabase {status}: {message}")


def _request(method, path, data=None, params=None, use_service_role=True):
    key = SUPABASE_SERVICE_ROLE_KEY if use_service_role else SUPABASE_ANON_KEY
    url = f"{SUPABASE_URL}/rest/v1/{path}"
    if params:
        if isinstance(params, list):
            qs = "&".join(f"{k}={v}" for k, v in params)
        else:
            qs = "&".join(f"{k}={v}" for k, v in params.items())
        url = f"{url}?{qs}"
    headers = {
        "apikey": key,
        "Authorization": f"Bearer {key}",
        "Content-Type": "application/json",
        "Prefer": "return=representation",
    }
    body = json.dumps(data).encode() if data else None
    req = urllib.request.Request(url, data=body, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            text = resp.read().decode()
            return json.loads(text) if text else None
    except urllib.error.HTTPError as e:
        err_body = e.read().decode() if e.fp else ""
        raise SupabaseError(e.code, err_body)


def select(table, filters=None, order=None, limit=None):
    params = []
    if filters:
        if isinstance(filters, dict):
            params.extend(filters.items())
        else:
            params.extend(filters)
    if order:
        params.append(("order", order))
    if limit:
        params.append(("limit", str(limit)))
    params.append(("select", "*"))
    return _request("GET", table, params=params)


def insert(table, data):
    return _request("POST", table, data=data if isinstance(data, list) else [data])


def update(table, filters, data):
    params = {}
    for k, v in filters.items():
        params[k] = v
    return _request("PATCH", table, data=data, params=params)


def delete(table, filters):
    params = {}
    for k, v in filters.items():
        params[k] = v
    return _request("DELETE", table, params=params)
