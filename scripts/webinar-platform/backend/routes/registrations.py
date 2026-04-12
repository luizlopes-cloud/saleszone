from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
import secrets
import supabase_client as db
from extensions import limiter

bp = Blueprint("registrations", __name__)

REQUIRED_FIELDS = ["session_id", "name", "email", "phone"]


def _validate_token(session_id, token):
    """Returns registration dict if token is valid, else None."""
    results = db.select(
        "webinar_registrations",
        filters=[
            ("session_id", f"eq.{session_id}"),
            ("access_token", f"eq.{token}"),
            ("cancelled_at", "is.null"),
        ]
    ) or []
    return results[0] if results else None


@bp.route("/", methods=["POST"])
@limiter.limit("5 per hour")
def register():
    data = request.get_json(silent=True) or {}

    missing = [f for f in REQUIRED_FIELDS if not data.get(f)]
    if missing:
        return jsonify({"error": f"Campos obrigatórios ausentes: {', '.join(missing)}"}), 400

    session_id = data["session_id"]

    # Check session exists and is not cancelled
    sessions = db.select("webinar_sessions", filters={"id": f"eq.{session_id}"}) or []
    if not sessions:
        return jsonify({"error": "Sessão não encontrada"}), 404
    session = sessions[0]
    if session.get("status") == "cancelled":
        return jsonify({"error": "Sessão cancelada"}), 409

    # Check capacity
    slot_id = session.get("slot_id")
    max_participants = 0
    if slot_id:
        slots = db.select("webinar_slots", filters={"id": f"eq.{slot_id}"}) or []
        if slots:
            max_participants = slots[0].get("max_participants") or 0
    if not max_participants:
        max_participants = session.get("max_participants") or 0

    if max_participants > 0:
        regs = db.select(
            "webinar_registrations",
            filters=[
                ("session_id", f"eq.{session_id}"),
                ("cancelled_at", "is.null"),
            ]
        ) or []
        if len(regs) >= max_participants:
            return jsonify({"error": "Capacidade esgotada"}), 409

    access_token = secrets.token_urlsafe(32)
    room_url = f"/room/{session_id}?token={access_token}"

    registration = {
        "session_id": session_id,
        "name": data["name"],
        "email": data["email"],
        "phone": data["phone"],
        "access_token": access_token,
        "room_url": room_url,
    }

    result = db.insert("webinar_registrations", registration)
    reg = result[0] if result else registration

    # Best-effort integrations (don't fail registration if these fail)

    # 1. Pipedrive: find and associate deal
    try:
        from services.pipedrive import find_deal_by_email
        deal_id = find_deal_by_email(data["email"])
        if deal_id:
            db.update("webinar_registrations", {"id": f"eq.{reg['id']}"}, {"pipedrive_deal_id": deal_id})
    except Exception as e:
        print(f"[register] Pipedrive lookup failed: {e}")

    # 2. Google Calendar: add lead as attendee
    try:
        from services.google_calendar import add_attendee
        if session.get("calendar_event_id"):
            add_attendee(session["calendar_event_id"], data["email"])
    except Exception as e:
        print(f"[register] Calendar invite failed: {e}")

    # 3. Morada: send confirmation
    try:
        from services.morada import send_confirmation
        room_url = f"/webinar/sala/{reg['session_id']}?token={reg['access_token']}"
        send_confirmation(data["phone"], data["name"], session.get("date", ""), session.get("starts_at", ""), room_url)
    except Exception as e:
        print(f"[register] Morada confirmation failed: {e}")

    return jsonify({
        "access_token": access_token,
        "room_url": room_url,
        "registration": reg,
    }), 201


@bp.route("/validate", methods=["GET"])
def validate():
    session_id = request.args.get("session_id")
    token = request.args.get("token")

    if not session_id or not token:
        return jsonify({"error": "Parâmetros session_id e token são obrigatórios"}), 400

    reg = _validate_token(session_id, token)
    if not reg:
        return jsonify({"error": "Token inválido ou expirado"}), 401

    return jsonify(reg), 200


@bp.route("/attend", methods=["POST"])
def attend():
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id")
    token = data.get("token")

    if not session_id or not token:
        return jsonify({"error": "Campos session_id e token são obrigatórios"}), 400

    reg = _validate_token(session_id, token)
    if not reg:
        return jsonify({"error": "Token inválido ou expirado"}), 401

    now = datetime.now(timezone.utc).isoformat()
    result = db.update(
        "webinar_registrations",
        filters={"id": f"eq.{reg['id']}"},
        data={"attended_at": now}
    )
    updated = result[0] if result else {**reg, "attended_at": now}
    return jsonify(updated), 200


@bp.route("/cancel", methods=["POST"])
def cancel():
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id")
    token = data.get("token")

    if not session_id or not token:
        return jsonify({"error": "Campos session_id e token são obrigatórios"}), 400

    reg = _validate_token(session_id, token)
    if not reg:
        return jsonify({"error": "Token inválido ou expirado"}), 401

    now = datetime.now(timezone.utc).isoformat()
    result = db.update(
        "webinar_registrations",
        filters={"id": f"eq.{reg['id']}"},
        data={"cancelled_at": now}
    )
    updated = result[0] if result else {**reg, "cancelled_at": now}

    # Remove attendee from Google Calendar event (best-effort)
    try:
        from services.google_calendar import remove_attendee
        remove_attendee(session_id, reg.get("email"))
    except Exception as e:
        print(f"[calendar] Falha ao remover participante: {e}")

    return jsonify(updated), 200
