from flask import Blueprint, request, jsonify
import supabase_client as db

bp = Blueprint("closers", __name__)


@bp.route("/", methods=["GET"])
def list_closers():
    closers = db.select("webinar_closers", filters={"is_active": "eq.true"}, order="name.asc")
    return jsonify(closers or [])


@bp.route("/<slug>", methods=["GET"])
def get_by_slug(slug):
    closers = db.select("webinar_closers", filters={"slug": f"eq.{slug}", "is_active": "eq.true"})
    if not closers:
        return jsonify({"error": "Closer not found"}), 404
    return jsonify(closers[0])
