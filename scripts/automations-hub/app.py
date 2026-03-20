import sys
sys.path.insert(0, '/Users/joaopedrocoutinho/Library/Python/3.9/lib/python/site-packages')

from flask import Flask, render_template, jsonify, request
import subprocess
import json
import os
from pathlib import Path
from datetime import datetime

app = Flask(__name__)

CONFIG_PATH = Path(__file__).parent / "config.json"


def load_config():
    with open(CONFIG_PATH) as f:
        return json.load(f)


def save_config(config):
    with open(CONFIG_PATH, "w") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)


def get_launchd_loaded(label):
    try:
        result = subprocess.run(
            ["launchctl", "list", label],
            capture_output=True, text=True
        )
        return result.returncode == 0
    except Exception:
        return False


def get_last_log(logs_dir):
    if not logs_dir:
        return None
    logs_path = Path(os.path.expanduser(logs_dir))
    if not logs_path.exists():
        return None
    log_files = sorted(logs_path.glob("*.log"), reverse=True)
    if not log_files:
        return None
    content = log_files[0].read_text(errors="replace")
    return {
        "file": str(log_files[0]),
        "date": log_files[0].stem,
        "content": content[-3000:]
    }


@app.route("/")
def index():
    config = load_config()

    for auto in config["automations"]:
        if auto["type"] == "launchd":
            auto["live_loaded"] = get_launchd_loaded(auto.get("launchd_label", ""))
            log = get_last_log(auto.get("logs_dir"))
            auto["last_run"] = log["date"] if log else "—"
        else:
            auto["live_loaded"] = None
            auto["last_run"] = "—"

    return render_template(
        "index.html",
        automations=config["automations"],
        lovable_projects=config.get("lovable_projects", [])
    )


@app.route("/api/automations/<auto_id>/toggle", methods=["POST"])
def toggle_automation(auto_id):
    config = load_config()
    for auto in config["automations"]:
        if auto["id"] == auto_id:
            if auto["type"] == "launchd":
                plist = os.path.expanduser(auto["plist"])
                if auto.get("enabled", True):
                    subprocess.run(["launchctl", "unload", plist], capture_output=True)
                    auto["enabled"] = False
                else:
                    subprocess.run(["launchctl", "load", plist], capture_output=True)
                    auto["enabled"] = True
            else:
                auto["enabled"] = not auto.get("enabled", True)
            save_config(config)
            return jsonify({"success": True, "enabled": auto["enabled"]})
    return jsonify({"error": "Não encontrado"}), 404


@app.route("/api/automations/<auto_id>/logs")
def get_logs(auto_id):
    config = load_config()
    for auto in config["automations"]:
        if auto["id"] == auto_id:
            log = get_last_log(auto.get("logs_dir"))
            if log:
                return jsonify(log)
            return jsonify({"content": "Sem logs disponíveis", "date": "—"})
    return jsonify({"error": "Não encontrado"}), 404


@app.route("/api/automations/<auto_id>/run", methods=["POST"])
def run_automation(auto_id):
    config = load_config()
    for auto in config["automations"]:
        if auto["id"] == auto_id:
            if auto["type"] == "launchd" and auto.get("script"):
                script = os.path.expanduser(auto["script"])
                script_dir = os.path.dirname(script)
                result = subprocess.run(
                    ["python3", script],
                    capture_output=True, text=True,
                    cwd=script_dir,
                    timeout=120
                )
                return jsonify({
                    "success": result.returncode == 0,
                    "output": result.stdout[-2000:],
                    "error": result.stderr[-500:] if result.stderr else None
                })
            elif auto["type"] == "slash-command":
                return jsonify({
                    "success": False,
                    "message": f"Execute no Claude Code: {auto.get('command', '')}"
                })
    return jsonify({"error": "Não encontrado"}), 404


@app.route("/api/config")
def get_config():
    config = load_config()
    return jsonify(config)


@app.route("/api/config", methods=["PUT"])
def update_config():
    try:
        new_config = request.get_json()
        if not new_config:
            return jsonify({"error": "JSON vazio"}), 400
        if "automations" not in new_config or "lovable_projects" not in new_config:
            return jsonify({"error": "Faltam campos obrigatórios (automations, lovable_projects)"}), 400
        # Backup antes de salvar
        import shutil
        backup_path = CONFIG_PATH.with_suffix(".backup.json")
        shutil.copy2(CONFIG_PATH, backup_path)
        save_config(new_config)
        return jsonify({"success": True})
    except json.JSONDecodeError:
        return jsonify({"error": "JSON inválido"}), 400
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/lovable/<project_id>/toggle", methods=["POST"])
def toggle_lovable(project_id):
    config = load_config()
    for proj in config.get("lovable_projects", []):
        if proj["id"] == project_id:
            proj["enabled"] = not proj.get("enabled", True)
            save_config(config)
            return jsonify({"success": True, "enabled": proj["enabled"]})
    return jsonify({"error": "Não encontrado"}), 404


if __name__ == "__main__":
    import os
    is_service = os.environ.get("LAUNCHED_BY_LAUNCHD") == "1"
    app.run(debug=not is_service, port=5050, host="0.0.0.0", use_reloader=not is_service)
