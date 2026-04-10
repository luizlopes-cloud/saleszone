from flask import Blueprint, request, jsonify
from datetime import datetime, timezone
import supabase_client as db

bp = Blueprint("messages", __name__)

MAX_CONTENT_LENGTH = 500


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
def send_message():
    data = request.get_json(silent=True) or {}
    session_id = data.get("session_id")
    token = data.get("token")
    content = data.get("content", "")

    if not session_id or not token:
        return jsonify({"error": "Campos session_id e token são obrigatórios"}), 400

    if not content:
        return jsonify({"error": "Campo content é obrigatório"}), 400

    if len(content) > MAX_CONTENT_LENGTH:
        return jsonify({"error": f"Mensagem deve ter no máximo {MAX_CONTENT_LENGTH} caracteres"}), 400

    reg = _validate_token(session_id, token)
    if not reg:
        return jsonify({"error": "Token inválido ou expirado"}), 401

    message = {
        "session_id": session_id,
        "registration_id": reg["id"],
        "content": content,
        "sender_type": "lead",
        "sender_name": reg.get("name", ""),
    }

    result = db.insert("webinar_messages", message)
    created = result[0] if result else message
    return jsonify(created), 201


@bp.route("/<session_id>", methods=["GET"])
def list_messages(session_id):
    messages = db.select(
        "webinar_messages",
        filters=[
            ("session_id", f"eq.{session_id}"),
            ("is_deleted", "eq.false"),
        ],
        order="created_at.asc"
    ) or []
    return jsonify(messages), 200


@bp.route("/<message_id>", methods=["DELETE"])
def delete_message(message_id):
    from app import require_admin
    require_admin()

    result = db.update(
        "webinar_messages",
        filters={"id": f"eq.{message_id}"},
        data={"is_deleted": True}
    )
    updated = result[0] if result else {"id": message_id, "is_deleted": True}
    return jsonify(updated), 200
