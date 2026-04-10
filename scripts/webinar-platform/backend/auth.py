"""Admin authentication helper — used by route modules."""
import json
import urllib.request as urllib_req
from flask import request, abort
import config


def require_admin():
    auth = request.headers.get("Authorization", "")
    if not auth.startswith("Bearer "):
        abort(401)
    token = auth[7:]
    try:
        req = urllib_req.Request(
            f"{config.SUPABASE_URL}/auth/v1/user",
            headers={"apikey": config.SUPABASE_ANON_KEY, "Authorization": f"Bearer {token}"}
        )
        with urllib_req.urlopen(req) as resp:
            user = json.loads(resp.read().decode())
            if not user.get("email", "").endswith("@seazone.com.br"):
                abort(403)
            return user
    except Exception:
        abort(401)
