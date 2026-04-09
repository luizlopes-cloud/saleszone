from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
import supabase_client as db

bp = Blueprint("sessions", __name__)

VALID_STATUSES = {"scheduled", "live", "ended", "cancelled"}


@bp.route("/", methods=["GET"])
def list_sessions():
    date_from = request.args.get("date_from")
    date_to = request.args.get("date_to")
    status = request.args.get("status")

    filters = []
    if date_from:
        filters.append(("date", f"gte.{date_from}"))
    if date_to:
        filters.append(("date", f"lte.{date_to}"))
    if status:
        filters.append(("status", f"eq.{status}"))

    sessions = db.select("webinar_sessions", filters=filters or None, order="date,starts_at") or []
    return jsonify(sessions), 200


@bp.route("/available", methods=["GET"])
def list_available():
    date = request.args.get("date")
    if not date:
        return jsonify({"error": "Parâmetro 'date' obrigatório"}), 400

    sessions = db.select(
        "webinar_sessions",
        filters=[
            ("date", f"eq.{date}"),
            ("status", "eq.scheduled"),
        ],
        order="starts_at"
    ) or []

    # Batch-fetch slots to avoid N+1
    slot_ids = list({s["slot_id"] for s in sessions if s.get("slot_id")})
    slots_map = {}
    if slot_ids:
        slot_filters = [("id", f"in.({','.join(slot_ids)})")]
        slots = db.select("webinar_slots", filters=slot_filters) or []
        slots_map = {s["id"]: s for s in slots}

    result = []
    for session in sessions:
        slot = slots_map.get(session.get("slot_id"), {})
        max_participants = slot.get("max_participants") or session.get("max_participants") or 0
        registrations_count = session.get("registrations_count") or 0
        remaining = max(0, max_participants - registrations_count)
        if remaining > 0:
            result.append({**session, "remaining_capacity": remaining})

    return jsonify(result), 200


@bp.route("/", methods=["POST"])
def create_session():
    from app import require_admin
    require_admin()

    data = request.get_json(silent=True) or {}
    if not data:
        return jsonify({"error": "Payload obrigatório"}), 400

    result = db.insert("webinar_sessions", data)
    created = result[0] if result else data
    return jsonify(created), 201


@bp.route("/<session_id>", methods=["GET"])
def get_session(session_id):
    result = db.select("webinar_sessions", filters={"id": f"eq.{session_id}"}) or []
    if not result:
        return jsonify({"error": "Sessão não encontrada"}), 404
    return jsonify(result[0]), 200


@bp.route("/<session_id>/status", methods=["PATCH"])
def update_status(session_id):
    data = request.get_json(silent=True) or {}
    new_status = data.get("status")

    if not new_status:
        return jsonify({"error": "Campo 'status' obrigatório"}), 400

    if new_status not in VALID_STATUSES:
        return jsonify({"error": f"Status inválido. Valores aceitos: {', '.join(VALID_STATUSES)}"}), 400

    update_data = {"status": new_status}

    if new_status == "cancelled":
        from app import require_admin
        require_admin()

        update_data["cancelled_at"] = datetime.now(timezone.utc).isoformat()
        cancel_reason = data.get("cancel_reason", "Sessão cancelada")
        update_data["cancel_reason"] = cancel_reason

        # Notify leads via Morada (best-effort)
        try:
            from services.morada import send_cancellation
            registrations = db.select(
                "webinar_registrations",
                filters={"session_id": f"eq.{session_id}"}
            ) or []
            session_rows = db.select("webinar_sessions", filters={"id": f"eq.{session_id}"}) or []
            session = session_rows[0] if session_rows else {}
            session_date = session.get("date", "")
            session_time = session.get("starts_at", "")
            for reg in registrations:
                phone = reg.get("phone", "")
                name = reg.get("name", "")
                if phone:
                    send_cancellation(phone, name, session_date, session_time)
        except Exception as e:
            print(f"[morada] Falha ao notificar cancelamento: {e}")

    result = db.update("webinar_sessions", filters={"id": f"eq.{session_id}"}, data=update_data)
    updated = result[0] if result else update_data
    return jsonify(updated), 200
