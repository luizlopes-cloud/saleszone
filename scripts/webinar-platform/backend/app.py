import sys
import site
from pathlib import Path

_user_site = site.getusersitepackages()
if _user_site and Path(_user_site).exists() and _user_site not in sys.path:
    sys.path.insert(0, _user_site)

from flask import Flask, jsonify
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

import config
from supabase_client import SupabaseError

app = Flask(__name__)

limiter = Limiter(get_remote_address, app=app, default_limits=["200 per hour"])

@app.errorhandler(SupabaseError)
def handle_supabase_error(e):
    print(f"[supabase] {e}")
    if e.status == 409:
        return jsonify({"error": "Registro duplicado"}), 409
    return jsonify({"error": "Erro interno"}), 500

@app.errorhandler(Exception)
def handle_generic_error(e):
    from werkzeug.exceptions import HTTPException
    if isinstance(e, HTTPException):
        return jsonify({"error": e.description}), e.code
    print(f"[error] {type(e).__name__}: {e}")
    return jsonify({"error": "Erro interno"}), 500

@app.after_request
def add_cors(response):
    origin = response.headers.get("Access-Control-Allow-Origin")
    if not origin:
        from flask import request
        req_origin = request.headers.get("Origin", "")
        if req_origin in config.CORS_ORIGINS:
            response.headers["Access-Control-Allow-Origin"] = req_origin
            response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
            response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    return response

def require_admin():
    from flask import request, abort
    import urllib.request as urllib_req
    import json
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

from routes.slots import bp as slots_bp
from routes.sessions import bp as sessions_bp
from routes.registrations import bp as registrations_bp
from routes.messages import bp as messages_bp
from routes.admin import bp as admin_bp

app.register_blueprint(slots_bp, url_prefix="/api/slots")
app.register_blueprint(sessions_bp, url_prefix="/api/sessions")
app.register_blueprint(registrations_bp, url_prefix="/api/registrations")
app.register_blueprint(messages_bp, url_prefix="/api/messages")
app.register_blueprint(admin_bp, url_prefix="/api/admin")

@app.route("/api/health")
def health():
    return {"status": "ok"}

if __name__ == "__main__":
    import os
    debug = os.environ.get("LAUNCHED_BY_LAUNCHD") != "1"
    app.run(host="0.0.0.0", port=config.FLASK_PORT, debug=debug)
