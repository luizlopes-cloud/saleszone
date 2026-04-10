from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
import supabase_client as db

bp = Blueprint("slots", __name__)

REQUIRED_FIELDS = ["day_of_week", "time", "duration_minutes", "max_participants", "presenter_email"]


def _validate_slot_data(data, require_all=True):
    if require_all:
        missing = [f for f in REQUIRED_FIELDS if f not in data]
        if missing:
            return f"Campos obrigatórios ausentes: {', '.join(missing)}"

    if "presenter_email" in data:
        email = data["presenter_email"]
        if not isinstance(email, str) or not email.endswith("@seazone.com.br"):
            return "presenter_email deve ser @seazone.com.br"

    if "day_of_week" in data:
        dow = data["day_of_week"]
        if not isinstance(dow, int) or not (0 <= dow <= 6):
            return "day_of_week deve ser um inteiro entre 0 e 6"

    return None


def _cascade_deactivate_slot(slot_id):
    """Deactivates future sessions for a slot.
    - Sessions without registrations: deleted
    - Sessions with registrations: cancelled
    """
    today = datetime.now(timezone.utc).date().isoformat()

    sessions = db.select(
        "webinar_sessions",
        filters=[
            ("slot_id", f"eq.{slot_id}"),
            ("status", "eq.scheduled"),
            ("date", f"gte.{today}"),
        ]
    ) or []

    for session in sessions:
        session_id = session["id"]
        regs = db.select("webinar_registrations", filters={"session_id": f"eq.{session_id}"}) or []
        if regs:
            db.update(
                "webinar_sessions",
                filters={"id": f"eq.{session_id}"},
                data={
                    "status": "cancelled",
                    "cancelled_at": datetime.now(timezone.utc).isoformat(),
                    "cancel_reason": "Slot desativado",
                }
            )
        else:
            db.delete("webinar_sessions", filters={"id": f"eq.{session_id}"})


@bp.route("/", methods=["GET"])
def list_slots():
    closer_id = request.args.get("closer_id")
    filters = {}
    if closer_id:
        filters["closer_id"] = f"eq.{closer_id}"
    slots = db.select("webinar_slots", filters=filters or None, order="day_of_week,time") or []
    return jsonify(slots), 200


@bp.route("/", methods=["POST"])
def create_slot():
    data = request.get_json(silent=True) or {}
    if "closer_id" not in data:
        return jsonify({"error": "Campo obrigatório ausente: closer_id"}), 400
    error = _validate_slot_data(data, require_all=True)
    if error:
        return jsonify({"error": error}), 400

    result = db.insert("webinar_slots", data)
    created = result[0] if result else data
    return jsonify(created), 201


@bp.route("/<slot_id>", methods=["PUT"])
def update_slot(slot_id):
    data = request.get_json(silent=True) or {}
    error = _validate_slot_data(data, require_all=False)
    if error:
        return jsonify({"error": error}), 400

    is_active = data.get("is_active")
    if is_active is False:
        _cascade_deactivate_slot(slot_id)

    result = db.update("webinar_slots", filters={"id": f"eq.{slot_id}"}, data=data)
    updated = result[0] if result else data
    return jsonify(updated), 200


@bp.route("/<slot_id>", methods=["DELETE"])
def delete_slot(slot_id):
    db.delete("webinar_slots", filters={"id": f"eq.{slot_id}"})
    return "", 204
