# Webinar Platform Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a sales webinar platform where leads schedule, attend, and convert during live presentations by the Seazone commercial team.

**Architecture:** Flask backend (Python 3, port 5060) serves API for a React+Vite frontend. Supabase handles database + Realtime (chat/CTA sync). Google Calendar creates Meet links. Leads access via tokenized URLs (zero login). Admin uses Supabase OAuth (@seazone.com.br).

**Tech Stack:** Python 3, Flask, Flask-Limiter, supabase-py, google-api-python-client, React 19, Vite, TypeScript, Tailwind CSS, Supabase Realtime

**Spec:** `docs/superpowers/specs/2026-04-09-webinar-platform-design.md`

---

## File Map

```
saleszone/scripts/webinar-platform/
├── backend/
│   ├── app.py                    # Flask entry point, CORS, blueprint registration
│   ├── config.py                 # Env vars loader (.env manual, no python-dotenv)
│   ├── supabase_client.py        # Supabase REST helper (service role + anon)
│   ├── routes/
│   │   ├── __init__.py
│   │   ├── slots.py              # Blueprint: CRUD webinar_slots (admin)
│   │   ├── sessions.py           # Blueprint: list/detail/status webinar_sessions
│   │   ├── registrations.py      # Blueprint: register lead, validate token, cancel
│   │   ├── messages.py           # Blueprint: send/list/delete chat messages
│   │   └── admin.py              # Blueprint: auth check, dashboard stats, CTA toggle
│   ├── services/
│   │   ├── __init__.py
│   │   ├── google_calendar.py    # Create event + Meet link, manage attendees
│   │   ├── email_service.py      # SMTP send (reminders, confirmations)
│   │   ├── morada.py             # Morada API confirmation/cancellation
│   │   └── pipedrive.py          # Search deal by email/phone, create activity
│   ├── jobs/
│   │   ├── generate_sessions.py  # Daily: generate sessions 14 days ahead
│   │   └── send_reminders.py     # Hourly: send 24h/1h email reminders
│   ├── requirements.txt
│   └── tests/
│       ├── __init__.py
│       ├── test_slots.py
│       ├── test_sessions.py
│       ├── test_registrations.py
│       ├── test_messages.py
│       └── conftest.py           # Flask test client, mock Supabase
├── frontend/
│   ├── package.json
│   ├── vite.config.ts
│   ├── tailwind.config.js
│   ├── tsconfig.json
│   ├── index.html
│   ├── .env                      # VITE_API_URL, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
│   └── src/
│       ├── main.tsx              # React entry, router setup
│       ├── App.tsx               # Routes definition
│       ├── lib/
│       │   ├── api.ts            # Fetch wrapper for Flask backend
│       │   ├── supabase.ts       # Supabase client (anon key, Realtime)
│       │   └── types.ts          # TypeScript interfaces
│       ├── pages/
│       │   ├── SchedulePage.tsx   # Calendar + time slots + registration form
│       │   ├── WaitingRoom.tsx    # Countdown + session info
│       │   ├── LiveRoom.tsx       # Chat + CTA + Meet link
│       │   ├── ThankYou.tsx       # Post-CTA confirmation
│       │   ├── InvalidLink.tsx    # Error page for bad tokens
│       │   └── admin/
│       │       ├── AdminLayout.tsx    # Auth guard + sidebar nav
│       │       ├── Dashboard.tsx      # Stats overview
│       │       ├── SlotsPage.tsx      # CRUD slots
│       │       ├── SessionsPage.tsx   # List sessions + filters
│       │       ├── LiveControl.tsx    # Presenter control panel
│       │       └── RegistrationsPage.tsx # All registrations + export
│       └── components/
│           ├── Calendar.tsx       # Monthly calendar component
│           ├── TimeSlots.tsx      # Available time slots for a date
│           ├── RegistrationForm.tsx # Name, email, phone form
│           ├── ChatPanel.tsx      # Realtime chat (lead + admin versions)
│           ├── CTAButton.tsx      # CTA button + inline form
│           └── Countdown.tsx      # Timer countdown component
├── .env                          # Backend env vars (shared)
├── .gitignore
└── sql/
    └── 001_create_tables.sql     # Supabase migration
```

---

## Chunk 1: Database + Backend Foundation

### Task 1: Create Supabase Migration SQL

**Files:**
- Create: `scripts/webinar-platform/sql/001_create_tables.sql`

- [ ] **Step 1: Write the SQL migration**

```sql
-- webinar_slots: recurring schedule configuration
CREATE TABLE IF NOT EXISTS webinar_slots (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
    time timetz NOT NULL,
    duration_minutes int NOT NULL DEFAULT 60,
    max_participants int NOT NULL DEFAULT 50,
    is_active bool NOT NULL DEFAULT true,
    presenter_email text NOT NULL CHECK (presenter_email LIKE '%@seazone.com.br'),
    created_at timestamptz NOT NULL DEFAULT now()
);

-- webinar_sessions: concrete instances from slots
CREATE TABLE IF NOT EXISTS webinar_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_id uuid REFERENCES webinar_slots(id) ON DELETE SET NULL,
    date date NOT NULL,
    starts_at timestamptz NOT NULL,
    ends_at timestamptz NOT NULL,
    google_meet_link text,
    calendar_event_id text,
    status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'live', 'ended', 'cancelled')),
    cta_active bool NOT NULL DEFAULT false,
    cancelled_at timestamptz,
    cancel_reason text,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webinar_sessions_status ON webinar_sessions(status);
CREATE INDEX idx_webinar_sessions_date ON webinar_sessions(date);
CREATE UNIQUE INDEX idx_webinar_sessions_slot_date ON webinar_sessions(slot_id, date) WHERE slot_id IS NOT NULL;

-- webinar_registrations: lead sign-ups
CREATE TABLE IF NOT EXISTS webinar_registrations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES webinar_sessions(id) ON DELETE CASCADE,
    access_token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
    name text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL,
    pipedrive_deal_id int,
    confirmed_at timestamptz,
    attended_at timestamptz,
    cancelled_at timestamptz,
    converted bool NOT NULL DEFAULT false,
    converted_at timestamptz,
    cta_response jsonb,
    reminder_24h_sent_at timestamptz,
    reminder_1h_sent_at timestamptz,
    created_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE(session_id, email)
);

CREATE INDEX idx_webinar_registrations_session ON webinar_registrations(session_id);
CREATE INDEX idx_webinar_registrations_email ON webinar_registrations(email);
CREATE INDEX idx_webinar_registrations_token ON webinar_registrations(access_token);

-- webinar_messages: live chat
CREATE TABLE IF NOT EXISTS webinar_messages (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id uuid NOT NULL REFERENCES webinar_sessions(id) ON DELETE CASCADE,
    registration_id uuid REFERENCES webinar_registrations(id) ON DELETE SET NULL,
    sender_type text NOT NULL DEFAULT 'lead' CHECK (sender_type IN ('lead', 'presenter')),
    presenter_email text,
    content text NOT NULL CHECK (char_length(content) <= 500),
    is_deleted bool NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_webinar_messages_session ON webinar_messages(session_id, created_at);

-- RLS policies
ALTER TABLE webinar_slots ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE webinar_messages ENABLE ROW LEVEL SECURITY;

-- Public read for slots and sessions (scheduling page)
CREATE POLICY "anon_read_slots" ON webinar_slots FOR SELECT USING (true);
CREATE POLICY "anon_read_sessions" ON webinar_sessions FOR SELECT USING (true);

-- Public read for messages (Realtime needs this)
CREATE POLICY "anon_read_messages" ON webinar_messages FOR SELECT USING (true);

-- Service role can do everything (Flask backend uses service role key)
CREATE POLICY "service_all_slots" ON webinar_slots FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_all_sessions" ON webinar_sessions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_all_registrations" ON webinar_registrations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "service_all_messages" ON webinar_messages FOR ALL USING (auth.role() = 'service_role');

-- Enable Realtime for messages and sessions (CTA sync)
ALTER PUBLICATION supabase_realtime ADD TABLE webinar_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE webinar_sessions;
```

- [ ] **Step 2: Run the migration on Supabase**

Open Supabase SQL Editor (dashboard) and execute the SQL. Verify tables exist:

```bash
# Via supabase CLI or SQL Editor
SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name LIKE 'webinar_%';
```

Expected: 4 tables (webinar_slots, webinar_sessions, webinar_registrations, webinar_messages).

- [ ] **Step 3: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/sql/001_create_tables.sql
git commit -m "feat(webinar): add Supabase migration for webinar tables"
```

---

### Task 2: Set Up Flask Project Structure

**Files:**
- Create: `scripts/webinar-platform/backend/config.py`
- Create: `scripts/webinar-platform/backend/supabase_client.py`
- Create: `scripts/webinar-platform/backend/app.py`
- Create: `scripts/webinar-platform/backend/routes/__init__.py`
- Create: `scripts/webinar-platform/backend/services/__init__.py`
- Create: `scripts/webinar-platform/backend/requirements.txt`
- Create: `scripts/webinar-platform/.env`
- Create: `scripts/webinar-platform/.gitignore`

- [ ] **Step 1: Create .gitignore**

```gitignore
.env
__pycache__/
*.pyc
node_modules/
dist/
.vite/
```

- [ ] **Step 2: Create config.py with manual .env loader**

Follow monorepo pattern (no python-dotenv):

```python
import os
from pathlib import Path

# Manual .env loader (monorepo pattern — no python-dotenv dependency)
_env_path = Path(__file__).parent.parent / ".env"
if _env_path.exists():
    for line in _env_path.read_text().splitlines():
        if line and not line.startswith("#") and "=" in line:
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

# Supabase
SUPABASE_URL = os.environ.get("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY", "")

# Google Calendar
GOOGLE_CALENDAR_CREDENTIALS = os.environ.get("GOOGLE_CALENDAR_CREDENTIALS", "")
GOOGLE_CALENDAR_ID = os.environ.get("GOOGLE_CALENDAR_ID", "webinar@seazone.com.br")

# SMTP
SMTP_HOST = os.environ.get("SMTP_HOST", "")
SMTP_PORT = int(os.environ.get("SMTP_PORT", "587"))
SMTP_USER = os.environ.get("SMTP_USER", "")
SMTP_PASSWORD = os.environ.get("SMTP_PASSWORD", "")
SMTP_FROM = os.environ.get("SMTP_FROM", "webinar@seazone.com.br")

# Pipedrive
PIPEDRIVE_API_TOKEN = os.environ.get("PIPEDRIVE_API_TOKEN", "")
PIPEDRIVE_DOMAIN = "seazone-fd92b9"

# Morada
MORADA_API_KEY = os.environ.get("MORADA_API_KEY", "")

# Flask
FLASK_PORT = int(os.environ.get("FLASK_PORT", "5060"))
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "http://localhost:5173").split(",")
```

- [ ] **Step 3: Create supabase_client.py**

```python
import json
import urllib.request
from config import SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY


def _request(method, path, data=None, params=None, use_service_role=True):
    """Make a request to Supabase REST API."""
    key = SUPABASE_SERVICE_ROLE_KEY if use_service_role else SUPABASE_ANON_KEY
    url = f"{SUPABASE_URL}/rest/v1/{path}"

    if params:
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

    with urllib.request.urlopen(req) as resp:
        text = resp.read().decode()
        return json.loads(text) if text else None


def select(table, filters=None, order=None, limit=None):
    """SELECT from a table. filters is a dict of column=eq.value pairs."""
    params = {}
    if filters:
        for k, v in filters.items():
            params[k] = v
    if order:
        params["order"] = order
    if limit:
        params["limit"] = str(limit)
    params["select"] = "*"
    return _request("GET", table, params=params)


def insert(table, data):
    """INSERT into a table. data is a dict or list of dicts."""
    return _request("POST", table, data=data if isinstance(data, list) else [data])


def update(table, filters, data):
    """UPDATE rows matching filters."""
    params = {}
    for k, v in filters.items():
        params[k] = v
    return _request("PATCH", table, data=data, params=params)


def delete(table, filters):
    """DELETE rows matching filters."""
    params = {}
    for k, v in filters.items():
        params[k] = v
    return _request("DELETE", table, params=params)
```

- [ ] **Step 4: Create app.py**

```python
import sys
from pathlib import Path

# Add user site-packages (macOS pattern from monorepo)
_site = Path.home() / "Library/Python/3.9/lib/python/site-packages"
if _site.exists() and str(_site) not in sys.path:
    sys.path.insert(0, str(_site))

from flask import Flask
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

import config

app = Flask(__name__)

# Rate limiting
limiter = Limiter(get_remote_address, app=app, default_limits=["200 per hour"])

# CORS
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

# Register blueprints
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
```

- [ ] **Step 5: Create empty route blueprints**

`routes/__init__.py`: empty file

`routes/slots.py`:
```python
from flask import Blueprint

bp = Blueprint("slots", __name__)
```

`routes/sessions.py`:
```python
from flask import Blueprint

bp = Blueprint("sessions", __name__)
```

`routes/registrations.py`:
```python
from flask import Blueprint

bp = Blueprint("registrations", __name__)
```

`routes/messages.py`:
```python
from flask import Blueprint

bp = Blueprint("messages", __name__)
```

`routes/admin.py`:
```python
from flask import Blueprint

bp = Blueprint("admin", __name__)
```

`services/__init__.py`: empty file

- [ ] **Step 6: Create requirements.txt**

```
flask>=3.0
flask-limiter>=3.5
```

Note: Using stdlib `urllib.request` for Supabase/Pipedrive (monorepo pattern), not `requests` or `supabase-py`. Google Calendar will use `google-api-python-client` added later.

- [ ] **Step 7: Create .env template**

```bash
# Supabase
SUPABASE_URL=https://ewgqbkdriflarmmifrvs.supabase.co
SUPABASE_SERVICE_ROLE_KEY=
SUPABASE_ANON_KEY=

# Google Calendar
GOOGLE_CALENDAR_CREDENTIALS=
GOOGLE_CALENDAR_ID=webinar@seazone.com.br

# SMTP
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASSWORD=
SMTP_FROM=webinar@seazone.com.br

# Pipedrive
PIPEDRIVE_API_TOKEN=

# Morada
MORADA_API_KEY=

# Flask
FLASK_PORT=5060
CORS_ORIGINS=http://localhost:5173
```

- [ ] **Step 8: Install deps and verify Flask starts**

```bash
cd ~/Claude-Code/saleszone/scripts/webinar-platform
pip3 install --user -r backend/requirements.txt
cd backend && python3 app.py &
curl http://localhost:5060/api/health
# Expected: {"status":"ok"}
kill %1
```

- [ ] **Step 9: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/
git commit -m "feat(webinar): scaffold Flask backend with config and Supabase client"
```

---

### Task 3: Set Up Test Infrastructure

**Files:**
- Create: `scripts/webinar-platform/backend/tests/__init__.py`
- Create: `scripts/webinar-platform/backend/tests/conftest.py`

- [ ] **Step 1: Create conftest.py with Flask test client and Supabase mock**

```python
import pytest
import json
from unittest.mock import patch, MagicMock
import sys
from pathlib import Path

# Add backend to path
sys.path.insert(0, str(Path(__file__).parent.parent))


@pytest.fixture
def app():
    """Create Flask test app."""
    with patch("supabase_client.SUPABASE_URL", "http://test.supabase.co"), \
         patch("supabase_client.SUPABASE_SERVICE_ROLE_KEY", "test-key"), \
         patch("supabase_client.SUPABASE_ANON_KEY", "test-anon-key"):
        from app import app
        app.config["TESTING"] = True
        yield app


@pytest.fixture
def client(app):
    """Flask test client."""
    return app.test_client()


@pytest.fixture
def mock_supabase():
    """Mock all supabase_client functions."""
    with patch("supabase_client._request") as mock_req:
        mock_req.return_value = []
        yield mock_req
```

- [ ] **Step 2: Create empty tests/__init__.py**

- [ ] **Step 3: Verify pytest runs**

```bash
cd ~/Claude-Code/saleszone/scripts/webinar-platform/backend
pip3 install --user pytest
python3 -m pytest tests/ -v
# Expected: "no tests ran" (0 collected)
```

- [ ] **Step 4: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/backend/tests/
git commit -m "feat(webinar): add test infrastructure with conftest"
```

---

## Chunk 2: Backend API — Slots & Sessions

### Task 4: Slots CRUD API

**Files:**
- Modify: `scripts/webinar-platform/backend/routes/slots.py`
- Create: `scripts/webinar-platform/backend/tests/test_slots.py`

- [ ] **Step 1: Write failing tests for slots CRUD**

```python
# tests/test_slots.py
import json
from unittest.mock import patch


def test_list_slots(client, mock_supabase):
    mock_supabase.return_value = [
        {"id": "abc", "day_of_week": 1, "time": "14:30:00-03", "is_active": True}
    ]
    resp = client.get("/api/slots/")
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 1
    assert data[0]["day_of_week"] == 1


def test_create_slot(client, mock_supabase):
    mock_supabase.return_value = [{"id": "new-id", "day_of_week": 2}]
    resp = client.post("/api/slots/", json={
        "day_of_week": 2,
        "time": "15:00",
        "duration_minutes": 60,
        "max_participants": 50,
        "presenter_email": "joao@seazone.com.br"
    })
    assert resp.status_code == 201


def test_create_slot_invalid_email(client, mock_supabase):
    resp = client.post("/api/slots/", json={
        "day_of_week": 2,
        "time": "15:00",
        "duration_minutes": 60,
        "max_participants": 50,
        "presenter_email": "external@gmail.com"
    })
    assert resp.status_code == 400


def test_update_slot(client, mock_supabase):
    mock_supabase.return_value = [{"id": "abc", "is_active": False}]
    resp = client.put("/api/slots/abc", json={"is_active": False})
    assert resp.status_code == 200


def test_delete_slot(client, mock_supabase):
    mock_supabase.return_value = None
    resp = client.delete("/api/slots/abc")
    assert resp.status_code == 204
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd ~/Claude-Code/saleszone/scripts/webinar-platform/backend
python3 -m pytest tests/test_slots.py -v
# Expected: FAIL — no routes implemented
```

- [ ] **Step 3: Implement slots routes**

```python
# routes/slots.py
from flask import Blueprint, request, jsonify
import supabase_client as db

bp = Blueprint("slots", __name__)

REQUIRED_FIELDS = ["day_of_week", "time", "duration_minutes", "max_participants", "presenter_email"]


@bp.route("/", methods=["GET"])
def list_slots():
    slots = db.select("webinar_slots", order="day_of_week.asc,time.asc")
    return jsonify(slots)


@bp.route("/", methods=["POST"])
def create_slot():
    data = request.get_json()
    for field in REQUIRED_FIELDS:
        if field not in data:
            return jsonify({"error": f"Missing field: {field}"}), 400

    if not data["presenter_email"].endswith("@seazone.com.br"):
        return jsonify({"error": "presenter_email must be @seazone.com.br"}), 400

    if not (0 <= data["day_of_week"] <= 6):
        return jsonify({"error": "day_of_week must be 0-6"}), 400

    result = db.insert("webinar_slots", {
        "day_of_week": data["day_of_week"],
        "time": data["time"],
        "duration_minutes": data["duration_minutes"],
        "max_participants": data["max_participants"],
        "presenter_email": data["presenter_email"],
    })
    return jsonify(result[0] if result else {}), 201


@bp.route("/<slot_id>", methods=["PUT"])
def update_slot(slot_id):
    data = request.get_json()
    if "presenter_email" in data and not data["presenter_email"].endswith("@seazone.com.br"):
        return jsonify({"error": "presenter_email must be @seazone.com.br"}), 400

    result = db.update("webinar_slots", {"id": f"eq.{slot_id}"}, data)
    return jsonify(result[0] if result else {})


@bp.route("/<slot_id>", methods=["DELETE"])
def delete_slot(slot_id):
    db.delete("webinar_slots", {"id": f"eq.{slot_id}"})
    return "", 204
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_slots.py -v
# Expected: 5 passed
```

- [ ] **Step 5: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/backend/routes/slots.py scripts/webinar-platform/backend/tests/test_slots.py
git commit -m "feat(webinar): add slots CRUD API with tests"
```

---

### Task 5: Sessions API

**Files:**
- Modify: `scripts/webinar-platform/backend/routes/sessions.py`
- Create: `scripts/webinar-platform/backend/tests/test_sessions.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_sessions.py
import json
from unittest.mock import patch


def test_list_sessions_by_date_range(client, mock_supabase):
    mock_supabase.return_value = [
        {"id": "s1", "date": "2026-04-10", "status": "scheduled", "starts_at": "2026-04-10T14:30:00-03:00"}
    ]
    resp = client.get("/api/sessions/?date_from=2026-04-10&date_to=2026-04-17")
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 1


def test_list_available_sessions(client, mock_supabase):
    """Public endpoint: sessions with available capacity."""
    mock_supabase.return_value = [
        {"id": "s1", "date": "2026-04-10", "status": "scheduled", "max_participants": 50,
         "starts_at": "2026-04-10T14:30:00-03:00", "registration_count": 3}
    ]
    resp = client.get("/api/sessions/available?date=2026-04-10")
    assert resp.status_code == 200


def test_get_session_detail(client, mock_supabase):
    mock_supabase.return_value = [
        {"id": "s1", "date": "2026-04-10", "status": "scheduled"}
    ]
    resp = client.get("/api/sessions/s1")
    assert resp.status_code == 200


def test_update_session_status(client, mock_supabase):
    mock_supabase.return_value = [{"id": "s1", "status": "live"}]
    resp = client.patch("/api/sessions/s1/status", json={"status": "live"})
    assert resp.status_code == 200


def test_cancel_session(client, mock_supabase):
    mock_supabase.return_value = [{"id": "s1", "status": "cancelled"}]
    resp = client.patch("/api/sessions/s1/status", json={
        "status": "cancelled", "cancel_reason": "Apresentador indisponível"
    })
    assert resp.status_code == 200
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python3 -m pytest tests/test_sessions.py -v
# Expected: FAIL
```

- [ ] **Step 3: Implement sessions routes**

```python
# routes/sessions.py
from flask import Blueprint, request, jsonify
from datetime import datetime
import supabase_client as db

bp = Blueprint("sessions", __name__)


@bp.route("/", methods=["GET"])
def list_sessions():
    filters = {}
    if request.args.get("date_from"):
        filters["date"] = f"gte.{request.args['date_from']}"
    if request.args.get("date_to"):
        filters["date"] = f"lte.{request.args['date_to']}"
    if request.args.get("status"):
        filters["status"] = f"eq.{request.args['status']}"

    sessions = db.select("webinar_sessions", filters=filters, order="starts_at.asc")
    return jsonify(sessions)


@bp.route("/available", methods=["GET"])
def list_available():
    """Public: sessions for a given date with remaining capacity."""
    date = request.args.get("date")
    if not date:
        return jsonify({"error": "date parameter required"}), 400

    sessions = db.select("webinar_sessions", filters={
        "date": f"eq.{date}",
        "status": f"eq.scheduled",
    }, order="starts_at.asc")

    # Count registrations per session
    for s in sessions:
        regs = db.select("webinar_registrations", filters={
            "session_id": f"eq.{s['id']}",
            "cancelled_at": "is.null",
        })
        s["registration_count"] = len(regs) if regs else 0
        # Get max_participants from slot
        if s.get("slot_id"):
            slots = db.select("webinar_slots", filters={"id": f"eq.{s['slot_id']}"})
            s["max_participants"] = slots[0]["max_participants"] if slots else 50
        else:
            s["max_participants"] = 50
        s["available"] = s["max_participants"] - s["registration_count"]

    return jsonify([s for s in sessions if s["available"] > 0])


@bp.route("/<session_id>", methods=["GET"])
def get_session(session_id):
    sessions = db.select("webinar_sessions", filters={"id": f"eq.{session_id}"})
    if not sessions:
        return jsonify({"error": "Session not found"}), 404
    return jsonify(sessions[0])


@bp.route("/<session_id>/status", methods=["PATCH"])
def update_status(session_id):
    data = request.get_json()
    new_status = data.get("status")
    valid = ("scheduled", "live", "ended", "cancelled")
    if new_status not in valid:
        return jsonify({"error": f"status must be one of {valid}"}), 400

    update_data = {"status": new_status}
    if new_status == "cancelled":
        update_data["cancelled_at"] = datetime.utcnow().isoformat()
        update_data["cancel_reason"] = data.get("cancel_reason", "")

    result = db.update("webinar_sessions", {"id": f"eq.{session_id}"}, update_data)
    return jsonify(result[0] if result else {})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_sessions.py -v
# Expected: 5 passed
```

- [ ] **Step 5: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/backend/routes/sessions.py scripts/webinar-platform/backend/tests/test_sessions.py
git commit -m "feat(webinar): add sessions API with availability and status management"
```

---

### Task 6: Registrations API

**Files:**
- Modify: `scripts/webinar-platform/backend/routes/registrations.py`
- Create: `scripts/webinar-platform/backend/tests/test_registrations.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_registrations.py
from unittest.mock import patch, call


def test_register_lead(client, mock_supabase):
    # First call: check session exists and not cancelled
    # Second call: check capacity
    # Third call: insert registration
    mock_supabase.side_effect = [
        [{"id": "s1", "status": "scheduled", "slot_id": "slot1"}],  # session
        [{"max_participants": 50}],  # slot
        [],  # existing registrations (count)
        [{"id": "r1", "access_token": "tok-123", "session_id": "s1"}],  # insert
    ]
    resp = client.post("/api/registrations/", json={
        "session_id": "s1",
        "name": "João Silva",
        "email": "joao@email.com",
        "phone": "11999999999",
    })
    assert resp.status_code == 201
    data = resp.get_json()
    assert "access_token" in data


def test_register_cancelled_session(client, mock_supabase):
    mock_supabase.return_value = [{"id": "s1", "status": "cancelled"}]
    resp = client.post("/api/registrations/", json={
        "session_id": "s1",
        "name": "Test",
        "email": "test@email.com",
        "phone": "11999999999",
    })
    assert resp.status_code == 400


def test_validate_token(client, mock_supabase):
    mock_supabase.return_value = [
        {"id": "r1", "session_id": "s1", "name": "João", "cancelled_at": None}
    ]
    resp = client.get("/api/registrations/validate?session_id=s1&token=tok-123")
    assert resp.status_code == 200


def test_validate_invalid_token(client, mock_supabase):
    mock_supabase.return_value = []
    resp = client.get("/api/registrations/validate?session_id=s1&token=bad-token")
    assert resp.status_code == 401


def test_mark_attended(client, mock_supabase):
    # validate token then update
    mock_supabase.side_effect = [
        [{"id": "r1", "session_id": "s1", "cancelled_at": None}],  # validate
        [{"id": "r1", "attended_at": "2026-04-10T14:30:00"}],  # update
    ]
    resp = client.post("/api/registrations/attend", json={
        "session_id": "s1",
        "token": "tok-123",
    })
    assert resp.status_code == 200
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python3 -m pytest tests/test_registrations.py -v
# Expected: FAIL
```

- [ ] **Step 3: Implement registrations routes**

```python
# routes/registrations.py
from flask import Blueprint, request, jsonify
from datetime import datetime
import supabase_client as db
from app import limiter

bp = Blueprint("registrations", __name__)


def _validate_token(session_id, token):
    """Validate access_token belongs to an active registration for this session."""
    regs = db.select("webinar_registrations", filters={
        "session_id": f"eq.{session_id}",
        "access_token": f"eq.{token}",
        "cancelled_at": "is.null",
    })
    return regs[0] if regs else None


@bp.route("/", methods=["POST"])
@limiter.limit("5 per hour")
def register():
    data = request.get_json()
    required = ["session_id", "name", "email", "phone"]
    for field in required:
        if not data.get(field):
            return jsonify({"error": f"Missing: {field}"}), 400

    # Check session exists and is not cancelled
    sessions = db.select("webinar_sessions", filters={"id": f"eq.{data['session_id']}"})
    if not sessions:
        return jsonify({"error": "Session not found"}), 404
    session = sessions[0]
    if session["status"] == "cancelled":
        return jsonify({"error": "Esta apresentação foi cancelada"}), 400

    # Check capacity
    if session.get("slot_id"):
        slots = db.select("webinar_slots", filters={"id": f"eq.{session['slot_id']}"})
        max_p = slots[0]["max_participants"] if slots else 50
    else:
        max_p = 50

    regs = db.select("webinar_registrations", filters={
        "session_id": f"eq.{data['session_id']}",
        "cancelled_at": "is.null",
    })
    if len(regs) >= max_p:
        return jsonify({"error": "Sessão lotada"}), 400

    # Insert registration
    result = db.insert("webinar_registrations", {
        "session_id": data["session_id"],
        "name": data["name"],
        "email": data["email"].lower().strip(),
        "phone": data["phone"].strip(),
    })

    if result:
        reg = result[0]
        return jsonify({
            "id": reg["id"],
            "access_token": reg["access_token"],
            "session_id": reg["session_id"],
            "room_url": f"/webinar/sala/{reg['session_id']}?token={reg['access_token']}",
        }), 201

    return jsonify({"error": "Registration failed"}), 500


@bp.route("/validate", methods=["GET"])
def validate():
    session_id = request.args.get("session_id")
    token = request.args.get("token")
    if not session_id or not token:
        return jsonify({"error": "session_id and token required"}), 400

    reg = _validate_token(session_id, token)
    if not reg:
        return jsonify({"error": "Link inválido ou expirado"}), 401

    return jsonify({"id": reg["id"], "name": reg["name"], "session_id": session_id})


@bp.route("/attend", methods=["POST"])
def mark_attended():
    data = request.get_json()
    reg = _validate_token(data.get("session_id"), data.get("token"))
    if not reg:
        return jsonify({"error": "Invalid token"}), 401

    if not reg.get("attended_at"):
        result = db.update("webinar_registrations",
                           {"id": f"eq.{reg['id']}"},
                           {"attended_at": datetime.utcnow().isoformat()})
        return jsonify(result[0] if result else {})

    return jsonify(reg)
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_registrations.py -v
# Expected: 5 passed
```

- [ ] **Step 5: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/backend/routes/registrations.py scripts/webinar-platform/backend/tests/test_registrations.py
git commit -m "feat(webinar): add registration API with token validation and capacity check"
```

---

### Task 7: Messages API

**Files:**
- Modify: `scripts/webinar-platform/backend/routes/messages.py`
- Create: `scripts/webinar-platform/backend/tests/test_messages.py`

- [ ] **Step 1: Write failing tests**

```python
# tests/test_messages.py
from unittest.mock import patch


def test_send_message_as_lead(client, mock_supabase):
    # validate token, then insert
    mock_supabase.side_effect = [
        [{"id": "r1", "session_id": "s1", "cancelled_at": None}],  # validate
        [{"id": "m1", "content": "Hello", "sender_type": "lead"}],  # insert
    ]
    resp = client.post("/api/messages/", json={
        "session_id": "s1",
        "token": "tok-123",
        "content": "Hello",
    })
    assert resp.status_code == 201


def test_send_message_without_token(client, mock_supabase):
    resp = client.post("/api/messages/", json={
        "session_id": "s1",
        "content": "Hello",
    })
    assert resp.status_code == 401


def test_list_messages(client, mock_supabase):
    mock_supabase.return_value = [
        {"id": "m1", "content": "Hi", "is_deleted": False, "sender_type": "lead"}
    ]
    resp = client.get("/api/messages/s1?token=tok-123")
    assert resp.status_code == 200


def test_delete_message(client, mock_supabase):
    mock_supabase.return_value = [{"id": "m1", "is_deleted": True}]
    resp = client.delete("/api/messages/m1")
    assert resp.status_code == 200
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
python3 -m pytest tests/test_messages.py -v
# Expected: FAIL
```

- [ ] **Step 3: Implement messages routes**

```python
# routes/messages.py
from flask import Blueprint, request, jsonify
import supabase_client as db

bp = Blueprint("messages", __name__)


def _validate_token(session_id, token):
    regs = db.select("webinar_registrations", filters={
        "session_id": f"eq.{session_id}",
        "access_token": f"eq.{token}",
        "cancelled_at": "is.null",
    })
    return regs[0] if regs else None


@bp.route("/", methods=["POST"])
def send_message():
    data = request.get_json()
    session_id = data.get("session_id")
    token = data.get("token")
    content = data.get("content", "").strip()

    if not content or len(content) > 500:
        return jsonify({"error": "Content required (max 500 chars)"}), 400

    # Lead message: validate token
    if token:
        reg = _validate_token(session_id, token)
        if not reg:
            return jsonify({"error": "Invalid token"}), 401
        msg_data = {
            "session_id": session_id,
            "registration_id": reg["id"],
            "sender_type": "lead",
            "content": content,
        }
    else:
        # Presenter message (admin auth checked separately)
        return jsonify({"error": "Token required"}), 401

    result = db.insert("webinar_messages", msg_data)
    return jsonify(result[0] if result else {}), 201


@bp.route("/<session_id>", methods=["GET"])
def list_messages(session_id):
    messages = db.select("webinar_messages", filters={
        "session_id": f"eq.{session_id}",
        "is_deleted": "eq.false",
    }, order="created_at.asc")
    return jsonify(messages)


@bp.route("/<message_id>", methods=["DELETE"])
def delete_message(message_id):
    """Soft delete (admin only)."""
    result = db.update("webinar_messages",
                       {"id": f"eq.{message_id}"},
                       {"is_deleted": True})
    return jsonify(result[0] if result else {})
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
python3 -m pytest tests/test_messages.py -v
# Expected: 4 passed
```

- [ ] **Step 5: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/backend/routes/messages.py scripts/webinar-platform/backend/tests/test_messages.py
git commit -m "feat(webinar): add chat messages API with token validation and moderation"
```

---

### Task 8: Admin API (CTA Toggle, Stats, Presenter Messages)

**Files:**
- Modify: `scripts/webinar-platform/backend/routes/admin.py`

- [ ] **Step 1: Implement admin routes**

```python
# routes/admin.py
from flask import Blueprint, request, jsonify
from datetime import datetime, date
import supabase_client as db

bp = Blueprint("admin", __name__)

# TODO: Add JWT validation for admin auth (Supabase Auth)
# For MVP, admin routes are protected by CORS (only admin frontend origin)


@bp.route("/dashboard", methods=["GET"])
def dashboard():
    """Admin dashboard stats."""
    today = date.today().isoformat()

    # Today's sessions
    sessions_today = db.select("webinar_sessions", filters={
        "date": f"eq.{today}",
    }, order="starts_at.asc")

    live_sessions = [s for s in sessions_today if s["status"] == "live"]

    # Count registrations for today
    total_registered = 0
    total_attended = 0
    total_converted = 0
    for s in sessions_today:
        regs = db.select("webinar_registrations", filters={
            "session_id": f"eq.{s['id']}",
            "cancelled_at": "is.null",
        })
        total_registered += len(regs)
        total_attended += sum(1 for r in regs if r.get("attended_at"))
        total_converted += sum(1 for r in regs if r.get("converted"))

    return jsonify({
        "today": today,
        "sessions_today": len(sessions_today),
        "live_now": len(live_sessions),
        "total_registered": total_registered,
        "total_attended": total_attended,
        "total_converted": total_converted,
        "conversion_rate": round(total_converted / total_attended * 100, 1) if total_attended else 0,
        "sessions": sessions_today,
    })


@bp.route("/sessions/<session_id>/cta", methods=["POST"])
def toggle_cta(session_id):
    """Toggle CTA button visibility for a session."""
    data = request.get_json()
    active = data.get("active", False)

    result = db.update("webinar_sessions",
                       {"id": f"eq.{session_id}"},
                       {"cta_active": active})
    return jsonify(result[0] if result else {})


@bp.route("/sessions/<session_id>/message", methods=["POST"])
def send_presenter_message(session_id):
    """Send a message as presenter."""
    data = request.get_json()
    content = data.get("content", "").strip()
    email = data.get("presenter_email", "")

    if not content:
        return jsonify({"error": "Content required"}), 400

    result = db.insert("webinar_messages", {
        "session_id": session_id,
        "sender_type": "presenter",
        "presenter_email": email,
        "content": content,
    })
    return jsonify(result[0] if result else {}), 201


@bp.route("/sessions/<session_id>/registrations", methods=["GET"])
def session_registrations(session_id):
    """List registrations for a session."""
    regs = db.select("webinar_registrations", filters={
        "session_id": f"eq.{session_id}",
    }, order="created_at.asc")
    return jsonify(regs)


@bp.route("/registrations/cta", methods=["POST"])
def submit_cta():
    """Lead submits CTA form."""
    data = request.get_json()
    token = data.get("token")
    session_id = data.get("session_id")
    form_data = data.get("form_data", {})

    # Validate token
    regs = db.select("webinar_registrations", filters={
        "session_id": f"eq.{session_id}",
        "access_token": f"eq.{token}",
        "cancelled_at": "is.null",
    })
    if not regs:
        return jsonify({"error": "Invalid token"}), 401

    result = db.update("webinar_registrations",
                       {"id": f"eq.{regs[0]['id']}"},
                       {
                           "converted": True,
                           "converted_at": datetime.utcnow().isoformat(),
                           "cta_response": form_data,
                       })
    return jsonify(result[0] if result else {})
```

- [ ] **Step 2: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/backend/routes/admin.py
git commit -m "feat(webinar): add admin API — dashboard stats, CTA toggle, presenter messages"
```

---

## Chunk 3: Frontend — React + Vite Setup & Lead Pages

### Task 9: Scaffold React + Vite Frontend

**Files:**
- Create: `scripts/webinar-platform/frontend/` (entire scaffold)

- [ ] **Step 1: Create Vite React project**

```bash
cd ~/Claude-Code/saleszone/scripts/webinar-platform
npm create vite@latest frontend -- --template react-ts
cd frontend
npm install
npm install -D tailwindcss @tailwindcss/vite
npm install react-router-dom @supabase/supabase-js
```

- [ ] **Step 2: Configure Vite with Tailwind and proxy**

`vite.config.ts`:
```typescript
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:5060",
    },
  },
});
```

- [ ] **Step 3: Add Tailwind to CSS**

`src/index.css`:
```css
@import "tailwindcss";
```

- [ ] **Step 4: Create lib files**

`src/lib/types.ts`:
```typescript
export interface Slot {
  id: string;
  day_of_week: number;
  time: string;
  duration_minutes: number;
  max_participants: number;
  is_active: boolean;
  presenter_email: string;
}

export interface Session {
  id: string;
  slot_id: string | null;
  date: string;
  starts_at: string;
  ends_at: string;
  google_meet_link: string | null;
  status: "scheduled" | "live" | "ended" | "cancelled";
  cta_active: boolean;
  registration_count?: number;
  max_participants?: number;
  available?: number;
}

export interface Registration {
  id: string;
  session_id: string;
  access_token: string;
  name: string;
  email: string;
  phone: string;
  confirmed_at: string | null;
  attended_at: string | null;
  cancelled_at: string | null;
  converted: boolean;
  converted_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  session_id: string;
  registration_id: string | null;
  sender_type: "lead" | "presenter";
  presenter_email: string | null;
  content: string;
  is_deleted: boolean;
  created_at: string;
}
```

`src/lib/api.ts`:
```typescript
const BASE = import.meta.env.VITE_API_URL || "";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "Content-Type": "application/json", ...options?.headers },
    ...options,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error || res.statusText);
  }
  if (res.status === 204) return null as T;
  return res.json();
}

export const api = {
  // Sessions
  getAvailableSessions: (date: string) =>
    request<any[]>(`/api/sessions/available?date=${date}`),
  getSession: (id: string) =>
    request<any>(`/api/sessions/${id}`),

  // Registrations
  register: (data: { session_id: string; name: string; email: string; phone: string }) =>
    request<any>("/api/registrations/", { method: "POST", body: JSON.stringify(data) }),
  validateToken: (sessionId: string, token: string) =>
    request<any>(`/api/registrations/validate?session_id=${sessionId}&token=${token}`),
  markAttended: (sessionId: string, token: string) =>
    request<any>("/api/registrations/attend", {
      method: "POST", body: JSON.stringify({ session_id: sessionId, token }),
    }),

  // Messages
  sendMessage: (sessionId: string, token: string, content: string) =>
    request<any>("/api/messages/", {
      method: "POST", body: JSON.stringify({ session_id: sessionId, token, content }),
    }),
  getMessages: (sessionId: string) =>
    request<any[]>(`/api/messages/${sessionId}`),

  // CTA
  submitCTA: (sessionId: string, token: string, formData: Record<string, any>) =>
    request<any>("/api/admin/registrations/cta", {
      method: "POST", body: JSON.stringify({ session_id: sessionId, token, form_data: formData }),
    }),
};
```

`src/lib/supabase.ts`:
```typescript
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(url, key);
```

- [ ] **Step 5: Create App.tsx with routes**

```typescript
import { BrowserRouter, Routes, Route } from "react-router-dom";
import SchedulePage from "./pages/SchedulePage";
import WaitingRoom from "./pages/WaitingRoom";
import LiveRoom from "./pages/LiveRoom";
import ThankYou from "./pages/ThankYou";
import InvalidLink from "./pages/InvalidLink";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/webinar" element={<SchedulePage />} />
        <Route path="/webinar/sala/:sessionId" element={<WaitingRoom />} />
        <Route path="/webinar/sala/:sessionId/live" element={<LiveRoom />} />
        <Route path="/webinar/obrigado" element={<ThankYou />} />
        <Route path="/webinar/invalid" element={<InvalidLink />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 6: Create .env for frontend**

```
VITE_API_URL=http://localhost:5060
VITE_SUPABASE_URL=https://ewgqbkdriflarmmifrvs.supabase.co
VITE_SUPABASE_ANON_KEY=
```

- [ ] **Step 7: Verify dev server starts**

```bash
cd ~/Claude-Code/saleszone/scripts/webinar-platform/frontend
npm run dev &
curl -s http://localhost:5173 | head -5
# Expected: HTML response
kill %1
```

- [ ] **Step 8: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/frontend/ scripts/webinar-platform/.gitignore
git commit -m "feat(webinar): scaffold React+Vite frontend with routing and API client"
```

---

### Task 10: Schedule Page (Calendar + Time Slots + Registration)

**Files:**
- Create: `scripts/webinar-platform/frontend/src/pages/SchedulePage.tsx`
- Create: `scripts/webinar-platform/frontend/src/components/Calendar.tsx`
- Create: `scripts/webinar-platform/frontend/src/components/TimeSlots.tsx`
- Create: `scripts/webinar-platform/frontend/src/components/RegistrationForm.tsx`

- [ ] **Step 1: Build Calendar component**

Replicates the UI from the reference screenshot — monthly calendar with day selection.

```typescript
// src/components/Calendar.tsx
import { useState } from "react";

interface Props {
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
}

const DAYS = ["D", "S", "T", "Q", "Q", "S", "S"];
const MONTHS = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

export default function Calendar({ selectedDate, onSelectDate }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayStr = today.toISOString().split("T")[0];

  const days: (number | null)[] = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= daysInMonth; d++) days.push(d);

  const fmtDate = (d: number) =>
    `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const prev = () => {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  };
  const next = () => {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  };

  const isPast = (d: number) => fmtDate(d) < todayStr;

  return (
    <div className="max-w-md mx-auto">
      <div className="flex items-center justify-between mb-4">
        <button onClick={prev} className="p-2 rounded-full hover:bg-gray-100">&lt;</button>
        <h2 className="text-lg font-semibold">{MONTHS[month]} {year}</h2>
        <button onClick={next} className="p-2 rounded-full hover:bg-gray-100">&gt;</button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm text-gray-500 mb-2">
        {DAYS.map((d, i) => <div key={i}>{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {days.map((d, i) => (
          <div key={i} className="aspect-square flex items-center justify-center">
            {d && (
              <button
                disabled={isPast(d)}
                onClick={() => onSelectDate(fmtDate(d))}
                className={`w-10 h-10 rounded-full text-sm transition-colors
                  ${isPast(d) ? "text-gray-300 cursor-not-allowed" : "hover:bg-gray-100 cursor-pointer"}
                  ${fmtDate(d) === todayStr ? "bg-gray-900 text-white" : ""}
                  ${selectedDate === fmtDate(d) && fmtDate(d) !== todayStr ? "bg-blue-600 text-white" : ""}
                `}
              >
                {d}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Build TimeSlots component**

```typescript
// src/components/TimeSlots.tsx
import type { Session } from "../lib/types";

interface Props {
  sessions: Session[];
  selectedDate: string;
  onSelect: (session: Session) => void;
}

export default function TimeSlots({ sessions, selectedDate, onSelect }: Props) {
  const fmt = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const fmtDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-");
    return `${d} de ${["janeiro","fevereiro","março","abril","maio","junho","julho","agosto","setembro","outubro","novembro","dezembro"][parseInt(m)-1]}`;
  };

  if (!sessions.length) {
    return <p className="text-gray-500 text-center mt-4">Nenhum horário disponível para este dia.</p>;
  }

  return (
    <div className="mt-6">
      <h3 className="text-sm text-gray-600 mb-3">Horários para {fmtDate(selectedDate)}</h3>
      <div className="grid grid-cols-3 gap-3">
        {sessions.map((s) => (
          <button
            key={s.id}
            onClick={() => onSelect(s)}
            className="py-3 px-4 border border-gray-200 rounded-lg text-sm
              hover:border-blue-500 hover:bg-blue-50 transition-colors"
          >
            {fmt(s.starts_at)}
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Build RegistrationForm component**

```typescript
// src/components/RegistrationForm.tsx
import { useState } from "react";
import { api } from "../lib/api";
import type { Session } from "../lib/types";

interface Props {
  session: Session;
  onSuccess: (roomUrl: string) => void;
  onBack: () => void;
}

export default function RegistrationForm({ session, onSuccess, onBack }: Props) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fmt = (iso: string) =>
    new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const result = await api.register({
        session_id: session.id,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phone: phone.trim(),
      });
      onSuccess(result.room_url);
    } catch (err: any) {
      setError(err.message || "Erro ao registrar");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-6">
      <button onClick={onBack} className="text-sm text-gray-500 mb-4">&larr; Voltar</button>
      <h3 className="text-lg font-semibold mb-1">Agendar apresentação</h3>
      <p className="text-sm text-gray-500 mb-4">{fmt(session.starts_at)}</p>

      <form onSubmit={submit} className="space-y-4">
        <input
          type="text" required placeholder="Seu nome"
          value={name} onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg"
        />
        <input
          type="email" required placeholder="Seu e-mail"
          value={email} onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg"
        />
        <input
          type="tel" required placeholder="Seu telefone"
          value={phone} onChange={(e) => setPhone(e.target.value)}
          className="w-full px-4 py-3 border border-gray-200 rounded-lg"
        />
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <button
          type="submit" disabled={loading}
          className="w-full py-3 bg-gray-900 text-white rounded-lg font-medium
            hover:bg-gray-800 disabled:opacity-50"
        >
          {loading ? "Registrando..." : "Confirmar agendamento"}
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 4: Build SchedulePage**

```typescript
// src/pages/SchedulePage.tsx
import { useState, useEffect } from "react";
import Calendar from "../components/Calendar";
import TimeSlots from "../components/TimeSlots";
import RegistrationForm from "../components/RegistrationForm";
import { api } from "../lib/api";
import type { Session } from "../lib/types";

type Step = "calendar" | "form" | "confirmed";

export default function SchedulePage() {
  const [step, setStep] = useState<Step>("calendar");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSession, setSelectedSession] = useState<Session | null>(null);
  const [roomUrl, setRoomUrl] = useState("");
  const [loading, setLoading] = useState(false);

  const now = new Date();
  const dayName = now.toLocaleDateString("pt-BR", { weekday: "long" });
  const time = now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

  useEffect(() => {
    if (!selectedDate) return;
    setLoading(true);
    api.getAvailableSessions(selectedDate)
      .then(setSessions)
      .catch(() => setSessions([]))
      .finally(() => setLoading(false));
  }, [selectedDate]);

  if (step === "confirmed") {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">&#10003;</div>
          <h2 className="text-xl font-semibold mb-2">Agendamento confirmado!</h2>
          <p className="text-gray-500 mb-6">Adicionado à sua agenda. Você receberá um lembrete por e-mail.</p>
          <a
            href={roomUrl}
            className="inline-block px-6 py-3 bg-gray-900 text-white rounded-lg"
          >
            Acessar sala de espera
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-4">
      <div className="max-w-lg mx-auto pt-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-block px-4 py-1 bg-gray-100 rounded-full text-sm text-gray-600 mb-4">
            Hoje é {dayName}, {time}
          </div>
        </div>

        {step === "calendar" && (
          <>
            <Calendar
              selectedDate={selectedDate}
              onSelectDate={(d) => { setSelectedDate(d); setSelectedSession(null); }}
            />
            {selectedDate && !loading && (
              <TimeSlots
                sessions={sessions}
                selectedDate={selectedDate}
                onSelect={(s) => { setSelectedSession(s); setStep("form"); }}
              />
            )}
            {loading && <p className="text-center text-gray-400 mt-4">Carregando horários...</p>}
          </>
        )}

        {step === "form" && selectedSession && (
          <RegistrationForm
            session={selectedSession}
            onBack={() => setStep("calendar")}
            onSuccess={(url) => { setRoomUrl(url); setStep("confirmed"); }}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Verify page renders**

```bash
cd ~/Claude-Code/saleszone/scripts/webinar-platform/frontend
npm run dev
# Open http://localhost:5173/webinar — should show calendar
```

- [ ] **Step 6: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/frontend/src/
git commit -m "feat(webinar): add schedule page with calendar, time slots, and registration form"
```

---

### Task 11: Waiting Room + Live Room Pages

**Files:**
- Create: `scripts/webinar-platform/frontend/src/pages/WaitingRoom.tsx`
- Create: `scripts/webinar-platform/frontend/src/pages/LiveRoom.tsx`
- Create: `scripts/webinar-platform/frontend/src/pages/ThankYou.tsx`
- Create: `scripts/webinar-platform/frontend/src/pages/InvalidLink.tsx`
- Create: `scripts/webinar-platform/frontend/src/components/Countdown.tsx`
- Create: `scripts/webinar-platform/frontend/src/components/ChatPanel.tsx`
- Create: `scripts/webinar-platform/frontend/src/components/CTAButton.tsx`

- [ ] **Step 1: Build Countdown component**

```typescript
// src/components/Countdown.tsx
import { useState, useEffect } from "react";

interface Props {
  targetTime: string; // ISO string
  onReached: () => void;
}

export default function Countdown({ targetTime, onReached }: Props) {
  const [remaining, setRemaining] = useState("");
  const [reached, setReached] = useState(false);

  useEffect(() => {
    const tick = () => {
      const diff = new Date(targetTime).getTime() - Date.now();
      if (diff <= 0) {
        setReached(true);
        onReached();
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(
        h > 0 ? `${h}h ${m}m ${s}s` : m > 0 ? `${m}m ${s}s` : `${s}s`
      );
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [targetTime, onReached]);

  if (reached) return null;

  return (
    <div className="text-center">
      <p className="text-sm text-gray-500 mb-2">Começa em</p>
      <p className="text-4xl font-bold font-mono">{remaining}</p>
    </div>
  );
}
```

- [ ] **Step 2: Build ChatPanel component**

```typescript
// src/components/ChatPanel.tsx
import { useState, useEffect, useRef } from "react";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import type { Message } from "../lib/types";

interface Props {
  sessionId: string;
  token: string;
  userName: string;
}

export default function ChatPanel({ sessionId, token, userName }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Load existing messages
  useEffect(() => {
    api.getMessages(sessionId).then(setMessages).catch(() => {});
  }, [sessionId]);

  // Subscribe to new messages via Supabase Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`messages:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "webinar_messages", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const msg = payload.new as Message;
          if (!msg.is_deleted) {
            setMessages((prev) => [...prev, msg]);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "webinar_messages", filter: `session_id=eq.${sessionId}` },
        (payload) => {
          const msg = payload.new as Message;
          if (msg.is_deleted) {
            setMessages((prev) => prev.filter((m) => m.id !== msg.id));
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    try {
      await api.sendMessage(sessionId, token, input.trim());
      setInput("");
    } catch {}
    setSending(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.map((m) => (
          <div key={m.id} className={`text-sm ${m.sender_type === "presenter" ? "font-semibold text-blue-700" : ""}`}>
            <span className="text-gray-400 text-xs">
              {m.sender_type === "presenter" ? "Apresentador" : "Participante"}
            </span>
            <p>{m.content}</p>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
      <form onSubmit={send} className="p-3 border-t flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Digite sua mensagem..."
          maxLength={500}
          className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
        />
        <button
          type="submit" disabled={sending}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm disabled:opacity-50"
        >
          Enviar
        </button>
      </form>
    </div>
  );
}
```

- [ ] **Step 3: Build CTAButton component**

```typescript
// src/components/CTAButton.tsx
import { useState } from "react";
import { api } from "../lib/api";

interface Props {
  visible: boolean;
  sessionId: string;
  token: string;
}

export default function CTAButton({ visible, sessionId, token }: Props) {
  const [showForm, setShowForm] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [interest, setInterest] = useState("");
  const [loading, setLoading] = useState(false);

  if (!visible || submitted) return null;

  if (showForm) {
    return (
      <div className="p-4 bg-white border-t">
        <h3 className="font-semibold mb-3">Quero saber mais!</h3>
        <select
          value={interest}
          onChange={(e) => setInterest(e.target.value)}
          className="w-full px-3 py-2 border rounded-lg mb-3"
        >
          <option value="">Qual seu interesse?</option>
          <option value="investir">Quero investir</option>
          <option value="proprietario">Já sou proprietário</option>
          <option value="conhecer">Quero conhecer mais</option>
        </select>
        <button
          onClick={async () => {
            setLoading(true);
            try {
              await api.submitCTA(sessionId, token, { interest });
              setSubmitted(true);
              window.location.href = "/webinar/obrigado";
            } catch {}
            setLoading(false);
          }}
          disabled={!interest || loading}
          className="w-full py-3 bg-green-600 text-white rounded-lg font-medium
            hover:bg-green-700 disabled:opacity-50"
        >
          {loading ? "Enviando..." : "Confirmar interesse"}
        </button>
      </div>
    );
  }

  return (
    <div className="p-4 bg-white border-t animate-pulse">
      <button
        onClick={() => setShowForm(true)}
        className="w-full py-4 bg-green-600 text-white rounded-lg font-bold text-lg
          hover:bg-green-700 transition-colors"
      >
        Garantir minha vaga
      </button>
    </div>
  );
}
```

- [ ] **Step 4: Build WaitingRoom page**

```typescript
// src/pages/WaitingRoom.tsx
import { useState, useEffect, useCallback } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import Countdown from "../components/Countdown";
import { api } from "../lib/api";
import type { Session } from "../lib/types";

export default function WaitingRoom() {
  const { sessionId } = useParams();
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();

  const [session, setSession] = useState<Session | null>(null);
  const [userName, setUserName] = useState("");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId || !token) { setError("Link inválido"); return; }

    Promise.all([
      api.validateToken(sessionId, token),
      api.getSession(sessionId),
    ]).then(([reg, sess]) => {
      setUserName(reg.name);
      setSession(sess);
      if (sess.status === "cancelled") setError("Esta apresentação foi cancelada");
      // If session already started, go straight to live
      if (sess.status === "live") setReady(true);
    }).catch(() => {
      navigate("/webinar/invalid");
    });
  }, [sessionId, token, navigate]);

  const onCountdownReached = useCallback(() => setReady(true), []);

  const enterMeet = async () => {
    if (!sessionId || !session) return;
    await api.markAttended(sessionId, token);
    // Open Meet in new window/tab
    if (session.google_meet_link) {
      const link = document.createElement("a");
      link.href = session.google_meet_link;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();
    }
    navigate(`/webinar/sala/${sessionId}/live?token=${token}`);
  };

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg text-gray-600 mb-4">{error}</p>
          <a href="/webinar" className="text-blue-600 underline">Reagendar</a>
        </div>
      </div>
    );
  }

  if (!session) {
    return <div className="min-h-screen bg-white flex items-center justify-center">
      <p className="text-gray-400">Carregando...</p>
    </div>;
  }

  const fmtDate = new Date(session.starts_at).toLocaleDateString("pt-BR", {
    weekday: "long", day: "numeric", month: "long",
  });
  const fmtTime = new Date(session.starts_at).toLocaleTimeString("pt-BR", {
    hour: "2-digit", minute: "2-digit",
  });

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-2">Apresentação Seazone</h1>
        <p className="text-gray-500 mb-1">{fmtDate}</p>
        <p className="text-gray-500 mb-8">{fmtTime}</p>
        <p className="text-gray-600 mb-6">Olá, {userName}!</p>

        {!ready && <Countdown targetTime={session.starts_at} onReached={onCountdownReached} />}

        {ready && (
          <button
            onClick={enterMeet}
            className="px-8 py-4 bg-gray-900 text-white rounded-lg font-medium text-lg
              hover:bg-gray-800 transition-colors"
          >
            Entrar na apresentação
          </button>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Build LiveRoom page**

```typescript
// src/pages/LiveRoom.tsx
import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import ChatPanel from "../components/ChatPanel";
import CTAButton from "../components/CTAButton";
import { supabase } from "../lib/supabase";
import { api } from "../lib/api";
import type { Session } from "../lib/types";

export default function LiveRoom() {
  const { sessionId } = useParams();
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [session, setSession] = useState<Session | null>(null);
  const [userName, setUserName] = useState("");

  useEffect(() => {
    if (!sessionId || !token) return;
    Promise.all([
      api.validateToken(sessionId, token),
      api.getSession(sessionId),
    ]).then(([reg, sess]) => {
      setUserName(reg.name);
      setSession(sess);
    }).catch(() => {});
  }, [sessionId, token]);

  // Listen for CTA toggle via Realtime
  useEffect(() => {
    if (!sessionId) return;
    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "webinar_sessions", filter: `id=eq.${sessionId}` },
        (payload) => {
          setSession((prev) => prev ? { ...prev, ...payload.new } : prev);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  if (!session || !sessionId) return null;

  return (
    <div className="h-screen flex flex-col bg-white">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center gap-3">
        <span className="inline-block w-3 h-3 bg-red-500 rounded-full animate-pulse" />
        <span className="font-semibold">AO VIVO</span>
        <span className="text-gray-500 text-sm ml-2">Apresentação Seazone</span>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-hidden">
        <ChatPanel sessionId={sessionId} token={token} userName={userName} />
      </div>

      {/* CTA */}
      <CTAButton visible={session.cta_active} sessionId={sessionId} token={token} />
    </div>
  );
}
```

- [ ] **Step 6: Build simple pages (ThankYou, InvalidLink)**

```typescript
// src/pages/ThankYou.tsx
export default function ThankYou() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold mb-4">Obrigado pelo interesse!</h1>
        <p className="text-gray-500">Nossa equipe entrará em contato em breve.</p>
      </div>
    </div>
  );
}
```

```typescript
// src/pages/InvalidLink.tsx
export default function InvalidLink() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="text-center max-w-md">
        <h1 className="text-xl font-semibold mb-4">Link inválido ou expirado</h1>
        <p className="text-gray-500 mb-6">Este link de acesso não é válido.</p>
        <a href="/webinar" className="text-blue-600 underline">Agendar uma nova apresentação</a>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/frontend/src/
git commit -m "feat(webinar): add waiting room, live room with chat/CTA, and static pages"
```

---

## Chunk 4: Frontend Admin & Integrations

### Task 12: Admin Pages

**Files:**
- Create: `scripts/webinar-platform/frontend/src/pages/admin/AdminLayout.tsx`
- Create: `scripts/webinar-platform/frontend/src/pages/admin/Dashboard.tsx`
- Create: `scripts/webinar-platform/frontend/src/pages/admin/SlotsPage.tsx`
- Create: `scripts/webinar-platform/frontend/src/pages/admin/SessionsPage.tsx`
- Create: `scripts/webinar-platform/frontend/src/pages/admin/LiveControl.tsx`
- Create: `scripts/webinar-platform/frontend/src/pages/admin/RegistrationsPage.tsx`
- Modify: `scripts/webinar-platform/frontend/src/App.tsx`

- [ ] **Step 1: Add admin routes to App.tsx**

Add to the Routes:
```typescript
import AdminLayout from "./pages/admin/AdminLayout";
import Dashboard from "./pages/admin/Dashboard";
import SlotsPage from "./pages/admin/SlotsPage";
import SessionsPage from "./pages/admin/SessionsPage";
import LiveControl from "./pages/admin/LiveControl";
import RegistrationsPage from "./pages/admin/RegistrationsPage";

// Inside <Routes>:
<Route path="/admin" element={<AdminLayout />}>
  <Route index element={<Dashboard />} />
  <Route path="slots" element={<SlotsPage />} />
  <Route path="sessoes" element={<SessionsPage />} />
  <Route path="sessoes/:sessionId/live" element={<LiveControl />} />
  <Route path="inscricoes" element={<RegistrationsPage />} />
</Route>
```

- [ ] **Step 2: Build AdminLayout with Supabase Auth guard**

```typescript
// src/pages/admin/AdminLayout.tsx
import { useState, useEffect } from "react";
import { Outlet, NavLink, Navigate } from "react-router-dom";
import { supabase } from "../../lib/supabase";

export default function AdminLayout() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user);
      setLoading(false);
    });
  }, []);

  const login = () => {
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/admin" },
    });
  };

  if (loading) return <div className="p-8">Carregando...</div>;

  if (!user || !user.email?.endsWith("@seazone.com.br")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-xl font-bold mb-4">Admin — Webinar Seazone</h1>
          <button onClick={login}
            className="px-6 py-3 bg-gray-900 text-white rounded-lg">
            Entrar com Google
          </button>
        </div>
      </div>
    );
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `block px-4 py-2 rounded-lg text-sm ${isActive ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"}`;

  return (
    <div className="min-h-screen flex">
      <nav className="w-56 bg-gray-50 border-r p-4 space-y-1">
        <h2 className="font-bold mb-4">Webinar Admin</h2>
        <NavLink to="/admin" end className={linkClass}>Dashboard</NavLink>
        <NavLink to="/admin/slots" className={linkClass}>Horários</NavLink>
        <NavLink to="/admin/sessoes" className={linkClass}>Sessões</NavLink>
        <NavLink to="/admin/inscricoes" className={linkClass}>Inscrições</NavLink>
      </nav>
      <main className="flex-1 p-6">
        <Outlet />
      </main>
    </div>
  );
}
```

- [ ] **Step 3: Build Dashboard page**

```typescript
// src/pages/admin/Dashboard.tsx
import { useState, useEffect } from "react";

export default function Dashboard() {
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    fetch("/api/admin/dashboard").then((r) => r.json()).then(setStats).catch(() => {});
  }, []);

  if (!stats) return <p>Carregando...</p>;

  const cards = [
    { label: "Sessões hoje", value: stats.sessions_today },
    { label: "Ao vivo agora", value: stats.live_now },
    { label: "Inscritos hoje", value: stats.total_registered },
    { label: "Presentes", value: stats.total_attended },
    { label: "Convertidos", value: stats.total_converted },
    { label: "Taxa de conversão", value: `${stats.conversion_rate}%` },
  ];

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Dashboard — {stats.today}</h1>
      <div className="grid grid-cols-3 gap-4 mb-8">
        {cards.map((c) => (
          <div key={c.label} className="p-4 bg-white border rounded-lg">
            <p className="text-sm text-gray-500">{c.label}</p>
            <p className="text-2xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Build SlotsPage (CRUD)**

Build a table with add/edit/toggle active forms inline. Uses `/api/slots/` endpoints. Standard CRUD form — fetch list, show table with columns (Dia, Horário, Duração, Max. Participantes, Apresentador, Ativo, Ações), Add button opens inline form, Edit/Delete buttons per row.

- [ ] **Step 5: Build SessionsPage (list + filters)**

Table of sessions with filters (date range, status, presenter). Each row shows: date, time, status badge, inscritos/presentes/convertidos counts, link to LiveControl. Uses `/api/sessions/` and `/api/admin/sessions/{id}/registrations`.

- [ ] **Step 6: Build LiveControl page**

The presenter's control panel during a live session:
- Session status (scheduled/live/ended) with Start/End buttons
- Participant list (realtime via `/api/admin/sessions/{id}/registrations`)
- Chat panel (same ChatPanel component, but presenter version that uses `/api/admin/sessions/{id}/message` to send)
- CTA toggle button (uses `/api/admin/sessions/{id}/cta`)
- Delete message buttons (uses `DELETE /api/messages/{id}`)

- [ ] **Step 7: Build RegistrationsPage**

Table of all registrations with filters (session, date, status). CSV export button. Uses `/api/admin/sessions/{id}/registrations` for per-session view.

- [ ] **Step 8: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/frontend/src/
git commit -m "feat(webinar): add admin panel — dashboard, slots CRUD, sessions, live control"
```

---

### Task 13: Google Calendar Integration

**Files:**
- Create: `scripts/webinar-platform/backend/services/google_calendar.py`

- [ ] **Step 1: Implement Google Calendar service**

```python
# services/google_calendar.py
import json
from google.oauth2.service_account import Credentials
from googleapiclient.discovery import build
from config import GOOGLE_CALENDAR_CREDENTIALS, GOOGLE_CALENDAR_ID

SCOPES = ["https://www.googleapis.com/auth/calendar"]


def _get_service():
    creds_json = json.loads(GOOGLE_CALENDAR_CREDENTIALS)
    creds = Credentials.from_service_account_info(creds_json, scopes=SCOPES)
    # Impersonate the webinar calendar account
    creds = creds.with_subject(GOOGLE_CALENDAR_ID)
    return build("calendar", "v3", credentials=creds)


def create_session_event(title, starts_at, ends_at, presenter_email):
    """Create a Calendar event with Google Meet link. Returns (event_id, meet_link)."""
    service = _get_service()
    event = service.events().insert(
        calendarId=GOOGLE_CALENDAR_ID,
        conferenceDataVersion=1,
        body={
            "summary": title,
            "start": {"dateTime": starts_at, "timeZone": "America/Sao_Paulo"},
            "end": {"dateTime": ends_at, "timeZone": "America/Sao_Paulo"},
            "attendees": [{"email": presenter_email}],
            "guestsCanSeeOtherGuests": False,
            "conferenceData": {
                "createRequest": {
                    "requestId": f"webinar-{starts_at}",
                    "conferenceSolutionKey": {"type": "hangoutsMeet"},
                },
            },
        },
    ).execute()

    meet_link = event.get("hangoutLink", "")
    return event["id"], meet_link


def add_attendee(event_id, email):
    """Add a lead as attendee to an existing event."""
    service = _get_service()
    event = service.events().get(calendarId=GOOGLE_CALENDAR_ID, eventId=event_id).execute()
    attendees = event.get("attendees", [])
    if not any(a["email"] == email for a in attendees):
        attendees.append({"email": email})
        service.events().patch(
            calendarId=GOOGLE_CALENDAR_ID,
            eventId=event_id,
            body={"attendees": attendees, "guestsCanSeeOtherGuests": False},
        ).execute()


def remove_attendee(event_id, email):
    """Remove a lead from event attendees."""
    service = _get_service()
    event = service.events().get(calendarId=GOOGLE_CALENDAR_ID, eventId=event_id).execute()
    attendees = [a for a in event.get("attendees", []) if a["email"] != email]
    service.events().patch(
        calendarId=GOOGLE_CALENDAR_ID,
        eventId=event_id,
        body={"attendees": attendees},
    ).execute()


def delete_event(event_id):
    """Delete a calendar event."""
    service = _get_service()
    service.events().delete(calendarId=GOOGLE_CALENDAR_ID, eventId=event_id).execute()
```

- [ ] **Step 2: Add google deps to requirements.txt**

```
flask>=3.0
flask-limiter>=3.5
google-api-python-client>=2.100
google-auth>=2.25
```

- [ ] **Step 3: Install and verify import**

```bash
pip3 install --user google-api-python-client google-auth
cd ~/Claude-Code/saleszone/scripts/webinar-platform/backend
python3 -c "from services.google_calendar import _get_service; print('OK')"
# Expected: OK (or credential error, which is fine — import works)
```

- [ ] **Step 4: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/backend/services/google_calendar.py scripts/webinar-platform/backend/requirements.txt
git commit -m "feat(webinar): add Google Calendar integration — events, Meet links, attendees"
```

---

### Task 14: Email, Morada, and Pipedrive Services

**Files:**
- Create: `scripts/webinar-platform/backend/services/email_service.py`
- Create: `scripts/webinar-platform/backend/services/morada.py`
- Create: `scripts/webinar-platform/backend/services/pipedrive.py`

- [ ] **Step 1: Implement email service (SMTP)**

```python
# services/email_service.py
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from config import SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_FROM


def send_email(to_email, subject, html_body):
    """Send an HTML email via SMTP."""
    if not SMTP_HOST:
        print(f"[email] SMTP not configured, skipping: {subject} -> {to_email}")
        return False

    msg = MIMEMultipart("alternative")
    msg["From"] = SMTP_FROM
    msg["To"] = to_email
    msg["Subject"] = subject
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.sendmail(SMTP_FROM, to_email, msg.as_string())
        return True
    except Exception as e:
        print(f"[email] Error sending to {to_email}: {e}")
        return False


def send_reminder(to_email, name, session_date, session_time, room_url, hours_before):
    """Send a reminder email."""
    if hours_before == 24:
        subject = f"Sua apresentação Seazone é amanhã às {session_time}"
    else:
        subject = f"Falta 1 hora! Apresentação Seazone às {session_time}"

    html = f"""
    <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto;">
        <h2>Olá, {name}!</h2>
        <p>{'Amanhã' if hours_before == 24 else 'Em 1 hora'} você tem uma apresentação Seazone agendada.</p>
        <p><strong>Data:</strong> {session_date}<br>
           <strong>Horário:</strong> {session_time}</p>
        <p><a href="{room_url}" style="display:inline-block; padding:12px 24px;
            background:#111; color:#fff; text-decoration:none; border-radius:8px;">
            Acessar sala de espera
        </a></p>
    </div>
    """
    return send_email(to_email, subject, html)
```

- [ ] **Step 2: Implement Morada service (stub)**

```python
# services/morada.py
import json
import urllib.request
from config import MORADA_API_KEY


def send_confirmation(phone, name, session_date, session_time, room_url):
    """Send confirmation message via Morada."""
    if not MORADA_API_KEY:
        print(f"[morada] Not configured, skipping confirmation to {phone}")
        return False

    # TODO: Replace with actual Morada API endpoint and template
    # This is a placeholder — Morada API details TBD
    print(f"[morada] Would send confirmation to {phone}: {name}, {session_date} {session_time}")
    return True


def send_cancellation(phone, name, session_date, session_time):
    """Send cancellation notification via Morada."""
    if not MORADA_API_KEY:
        print(f"[morada] Not configured, skipping cancellation to {phone}")
        return False

    print(f"[morada] Would send cancellation to {phone}: {name}, {session_date} {session_time}")
    return True
```

- [ ] **Step 3: Implement Pipedrive service**

```python
# services/pipedrive.py
import json
import urllib.request
from config import PIPEDRIVE_API_TOKEN, PIPEDRIVE_DOMAIN

BASE_URL = f"https://{PIPEDRIVE_DOMAIN}.pipedrive.com/api/v1"


def _get(path, params=None):
    url = f"{BASE_URL}{path}?api_token={PIPEDRIVE_API_TOKEN}"
    if params:
        url += "&" + "&".join(f"{k}={v}" for k, v in params.items())
    req = urllib.request.Request(url)
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def _post(path, data):
    url = f"{BASE_URL}{path}?api_token={PIPEDRIVE_API_TOKEN}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read().decode())


def find_deal_by_email(email):
    """Search for a deal by person email. Returns deal_id or None."""
    if not PIPEDRIVE_API_TOKEN:
        return None
    try:
        result = _get("/persons/search", {"term": email, "fields": "email", "limit": "1"})
        items = result.get("data", {}).get("items", [])
        if not items:
            return None
        person_id = items[0]["item"]["id"]
        # Get deals for this person
        deals = _get(f"/persons/{person_id}/deals", {"status": "open", "limit": "1"})
        deal_items = deals.get("data", [])
        return deal_items[0]["id"] if deal_items else None
    except Exception as e:
        print(f"[pipedrive] Error searching deal for {email}: {e}")
        return None


def create_activity(deal_id, subject, note=""):
    """Create an activity on a deal."""
    if not PIPEDRIVE_API_TOKEN or not deal_id:
        return None
    try:
        return _post("/activities", {
            "deal_id": deal_id,
            "subject": subject,
            "note": note,
            "type": "task",
            "done": 0,
        })
    except Exception as e:
        print(f"[pipedrive] Error creating activity on deal {deal_id}: {e}")
        return None
```

- [ ] **Step 4: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/backend/services/
git commit -m "feat(webinar): add email, Morada, and Pipedrive service integrations"
```

---

### Task 15: Wire Integrations Into Registration Flow

**Files:**
- Modify: `scripts/webinar-platform/backend/routes/registrations.py`

- [ ] **Step 1: Add integration calls after successful registration**

After the `db.insert` call in the `register()` function, add:

```python
# After successful insert, trigger integrations (best-effort)
try:
    from services.pipedrive import find_deal_by_email
    deal_id = find_deal_by_email(data["email"])
    if deal_id:
        db.update("webinar_registrations",
                   {"id": f"eq.{reg['id']}"},
                   {"pipedrive_deal_id": deal_id})
except Exception as e:
    print(f"[register] Pipedrive lookup failed: {e}")

try:
    from services.google_calendar import add_attendee
    if session.get("calendar_event_id"):
        add_attendee(session["calendar_event_id"], data["email"])
except Exception as e:
    print(f"[register] Calendar invite failed: {e}")

try:
    from services.morada import send_confirmation
    room_url = f"https://DOMAIN/webinar/sala/{reg['session_id']}?token={reg['access_token']}"
    starts = session.get("starts_at", "")
    send_confirmation(data["phone"], data["name"], session.get("date", ""), starts, room_url)
except Exception as e:
    print(f"[register] Morada confirmation failed: {e}")
```

- [ ] **Step 2: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/backend/routes/registrations.py
git commit -m "feat(webinar): wire Pipedrive, Calendar, and Morada into registration flow"
```

---

## Chunk 5: Jobs & Deploy

### Task 16: Session Generation Job

**Files:**
- Create: `scripts/webinar-platform/backend/jobs/generate_sessions.py`

- [ ] **Step 1: Implement session generation script**

```python
#!/usr/bin/env python3
"""Generate webinar sessions for the next 14 days from active slots.
Run daily via launchd at 00:00."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import date, timedelta, datetime, timezone
import config
import supabase_client as db
from services.google_calendar import create_session_event


def main():
    today = date.today()
    slots = db.select("webinar_slots", filters={"is_active": "eq.true"})
    if not slots:
        print("[generate] No active slots")
        return

    created = 0
    for day_offset in range(14):
        target_date = today + timedelta(days=day_offset)
        weekday = target_date.weekday()  # Monday=0
        # Convert to JS-style (Sunday=0)
        js_weekday = (weekday + 1) % 7

        for slot in slots:
            if slot["day_of_week"] != js_weekday:
                continue

            # Check if session already exists
            existing = db.select("webinar_sessions", filters={
                "slot_id": f"eq.{slot['id']}",
                "date": f"eq.{target_date.isoformat()}",
            })
            if existing:
                continue

            # Parse time from slot
            time_str = slot["time"]  # e.g. "14:30:00-03"
            hour, minute = int(time_str[:2]), int(time_str[3:5])
            starts = datetime(target_date.year, target_date.month, target_date.day,
                              hour, minute, tzinfo=timezone(timedelta(hours=-3)))
            ends = starts + timedelta(minutes=slot["duration_minutes"])

            # Create Google Calendar event with Meet link
            try:
                event_id, meet_link = create_session_event(
                    title="Apresentação Seazone",
                    starts_at=starts.isoformat(),
                    ends_at=ends.isoformat(),
                    presenter_email=slot["presenter_email"],
                )
            except Exception as e:
                print(f"[generate] Calendar error for {target_date} {time_str}: {e}")
                event_id, meet_link = None, None

            db.insert("webinar_sessions", {
                "slot_id": slot["id"],
                "date": target_date.isoformat(),
                "starts_at": starts.isoformat(),
                "ends_at": ends.isoformat(),
                "google_meet_link": meet_link,
                "calendar_event_id": event_id,
                "status": "scheduled",
            })
            created += 1
            print(f"[generate] Created session: {target_date} {time_str}")

    print(f"[generate] Done. Created {created} sessions.")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Test manually**

```bash
cd ~/Claude-Code/saleszone/scripts/webinar-platform/backend
python3 jobs/generate_sessions.py
# Expected: creates sessions for next 14 days (or fails gracefully if no Calendar creds)
```

- [ ] **Step 3: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/backend/jobs/generate_sessions.py
git commit -m "feat(webinar): add daily session generation job"
```

---

### Task 17: Email Reminder Job

**Files:**
- Create: `scripts/webinar-platform/backend/jobs/send_reminders.py`

- [ ] **Step 1: Implement reminder script**

```python
#!/usr/bin/env python3
"""Send email reminders for upcoming webinar sessions.
Run hourly via launchd. Sends 24h and 1h reminders."""

import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).parent.parent))

from datetime import datetime, timedelta, timezone
import config
import supabase_client as db
from services.email_service import send_reminder

BRT = timezone(timedelta(hours=-3))


def main():
    now = datetime.now(BRT)
    sent_count = 0

    # Find sessions starting in ~24h (23-25h window)
    window_24h_start = now + timedelta(hours=23)
    window_24h_end = now + timedelta(hours=25)

    # Find sessions starting in ~1h (0.5-1.5h window)
    window_1h_start = now + timedelta(minutes=30)
    window_1h_end = now + timedelta(minutes=90)

    sessions = db.select("webinar_sessions", filters={
        "status": "eq.scheduled",
    })

    for session in sessions:
        starts = datetime.fromisoformat(session["starts_at"])
        session_date = starts.strftime("%d/%m/%Y")
        session_time = starts.strftime("%H:%M")

        regs = db.select("webinar_registrations", filters={
            "session_id": f"eq.{session['id']}",
            "cancelled_at": "is.null",
        })

        for reg in regs:
            room_url = f"https://DOMAIN/webinar/sala/{session['id']}?token={reg['access_token']}"

            # 24h reminder
            if window_24h_start <= starts <= window_24h_end and not reg.get("reminder_24h_sent_at"):
                if send_reminder(reg["email"], reg["name"], session_date, session_time, room_url, 24):
                    db.update("webinar_registrations",
                              {"id": f"eq.{reg['id']}"},
                              {"reminder_24h_sent_at": now.isoformat()})
                    sent_count += 1

            # 1h reminder
            if window_1h_start <= starts <= window_1h_end and not reg.get("reminder_1h_sent_at"):
                if send_reminder(reg["email"], reg["name"], session_date, session_time, room_url, 1):
                    db.update("webinar_registrations",
                              {"id": f"eq.{reg['id']}"},
                              {"reminder_1h_sent_at": now.isoformat()})
                    sent_count += 1

    print(f"[reminders] Sent {sent_count} reminders")


if __name__ == "__main__":
    main()
```

- [ ] **Step 2: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/backend/jobs/send_reminders.py
git commit -m "feat(webinar): add hourly email reminder job"
```

---

### Task 18: launchd Plists

**Files:**
- Create: `~/Library/LaunchAgents/com.seazone.webinar-platform.plist` (Flask server)
- Create: `~/Library/LaunchAgents/com.seazone.webinar-sessions.plist` (daily session generation)
- Create: `~/Library/LaunchAgents/com.seazone.webinar-reminders.plist` (hourly reminders)

- [ ] **Step 1: Create Flask server plist**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.seazone.webinar-platform</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/joaopedrocoutinho/Claude-Code/saleszone/scripts/webinar-platform/backend/app.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/joaopedrocoutinho/Claude-Code/saleszone/scripts/webinar-platform/backend</string>
    <key>EnvironmentVariables</key>
    <dict>
        <key>LAUNCHED_BY_LAUNCHD</key>
        <string>1</string>
        <key>PYTHONPATH</key>
        <string>/Users/joaopedrocoutinho/Library/Python/3.9/lib/python/site-packages</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/Users/joaopedrocoutinho/Claude-Code/saleszone/scripts/webinar-platform/backend/logs/flask-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/joaopedrocoutinho/Claude-Code/saleszone/scripts/webinar-platform/backend/logs/flask-stderr.log</string>
</dict>
</plist>
```

- [ ] **Step 2: Create session generation plist (daily 00:00)**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.seazone.webinar-sessions</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/joaopedrocoutinho/Claude-Code/saleszone/scripts/webinar-platform/backend/jobs/generate_sessions.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/joaopedrocoutinho/Claude-Code/saleszone/scripts/webinar-platform/backend</string>
    <key>StartCalendarInterval</key>
    <dict>
        <key>Hour</key>
        <integer>0</integer>
        <key>Minute</key>
        <integer>0</integer>
    </dict>
    <key>StandardOutPath</key>
    <string>/Users/joaopedrocoutinho/Claude-Code/saleszone/scripts/webinar-platform/backend/logs/sessions-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/joaopedrocoutinho/Claude-Code/saleszone/scripts/webinar-platform/backend/logs/sessions-stderr.log</string>
</dict>
</plist>
```

- [ ] **Step 3: Create reminder plist (hourly)**

```xml
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.seazone.webinar-reminders</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/bin/python3</string>
        <string>/Users/joaopedrocoutinho/Claude-Code/saleszone/scripts/webinar-platform/backend/jobs/send_reminders.py</string>
    </array>
    <key>WorkingDirectory</key>
    <string>/Users/joaopedrocoutinho/Claude-Code/saleszone/scripts/webinar-platform/backend</string>
    <key>StartInterval</key>
    <integer>3600</integer>
    <key>StandardOutPath</key>
    <string>/Users/joaopedrocoutinho/Claude-Code/saleszone/scripts/webinar-platform/backend/logs/reminders-stdout.log</string>
    <key>StandardErrorPath</key>
    <string>/Users/joaopedrocoutinho/Claude-Code/saleszone/scripts/webinar-platform/backend/logs/reminders-stderr.log</string>
</dict>
</plist>
```

- [ ] **Step 4: Create logs directory and load plists**

```bash
mkdir -p ~/Claude-Code/saleszone/scripts/webinar-platform/backend/logs

# Load Flask server
launchctl load ~/Library/LaunchAgents/com.seazone.webinar-platform.plist

# Load jobs
launchctl load ~/Library/LaunchAgents/com.seazone.webinar-sessions.plist
launchctl load ~/Library/LaunchAgents/com.seazone.webinar-reminders.plist

# Verify
launchctl list | grep webinar
```

- [ ] **Step 5: Commit**

```bash
cd ~/Claude-Code/saleszone
git add scripts/webinar-platform/backend/jobs/ scripts/webinar-platform/.gitignore
git commit -m "feat(webinar): add launchd plists for Flask server, session generation, and reminders"
```

---

### Task 19: Final Integration Test

- [ ] **Step 1: Run all backend tests**

```bash
cd ~/Claude-Code/saleszone/scripts/webinar-platform/backend
python3 -m pytest tests/ -v
# Expected: all tests pass
```

- [ ] **Step 2: Start Flask and frontend, test full flow**

```bash
# Terminal 1: Backend
cd ~/Claude-Code/saleszone/scripts/webinar-platform/backend
python3 app.py

# Terminal 2: Frontend
cd ~/Claude-Code/saleszone/scripts/webinar-platform/frontend
npm run dev
```

Manual test:
1. Open http://localhost:5173/webinar — verify calendar renders
2. Open http://localhost:5173/admin — verify Google login prompt
3. Test `/api/health` returns OK
4. Test `/api/slots/` returns empty array

- [ ] **Step 3: Final commit**

```bash
cd ~/Claude-Code/saleszone
git add -A scripts/webinar-platform/
git commit -m "feat(webinar): complete MVP — webinar platform with scheduling, live room, and admin"
```

- [ ] **Step 4: Create PR**

```bash
cd ~/Claude-Code/saleszone
git push -u origin feat/webinar-platform
gh pr create --title "feat: webinar platform MVP" --body "$(cat <<'EOF'
## Summary
- Sales webinar platform for Seazone property owner acquisition
- Leads schedule via calendar, join via tokenized links, chat + CTA during live sessions
- Admin panel for slot management, live control (CTA toggle, chat moderation)
- Integrations: Google Calendar (Meet links), email reminders, Morada, Pipedrive

## Test plan
- [ ] Run backend tests: `python3 -m pytest tests/ -v`
- [ ] Start Flask + Vite, test scheduling flow end-to-end
- [ ] Verify admin auth with @seazone.com.br Google account
- [ ] Create a slot, generate sessions, register a lead, validate token access
- [ ] Test chat Realtime and CTA toggle

## Spec
`docs/superpowers/specs/2026-04-09-webinar-platform-design.md`
EOF
)"
```
