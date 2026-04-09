from unittest.mock import patch, MagicMock


# ──────────────────────────────────────────────────────────
# POST /api/registrations/ — Register
# ──────────────────────────────────────────────────────────

def test_register_success(client):
    """Happy path: session exists, has capacity, insert works."""
    session = {"id": "s1", "status": "scheduled", "slot_id": "slot1", "max_participants": 0}
    slot = {"id": "slot1", "max_participants": 50}
    created_reg = {"id": "r1", "session_id": "s1", "access_token": "tok", "room_url": "/room/s1?token=tok"}

    with patch("routes.registrations.db.select") as mock_select, \
         patch("routes.registrations.db.insert") as mock_insert:
        # select calls: 1=session, 2=slot, 3=count regs
        mock_select.side_effect = [
            [session],   # session lookup
            [slot],      # slot lookup
            [],          # existing registrations count
        ]
        mock_insert.return_value = [created_reg]

        resp = client.post("/api/registrations/", json={
            "session_id": "s1",
            "name": "João Silva",
            "email": "joao@example.com",
            "phone": "+5548999999999",
        })

    assert resp.status_code == 201
    body = resp.get_json()
    assert "access_token" in body
    assert "room_url" in body


def test_register_missing_fields(client, mock_supabase):
    resp = client.post("/api/registrations/", json={
        "session_id": "s1",
        "name": "João",
        # missing email and phone
    })
    assert resp.status_code == 400
    assert "ausentes" in resp.get_json()["error"]


def test_register_session_not_found(client):
    with patch("routes.registrations.db.select") as mock_select:
        mock_select.return_value = []  # session not found
        resp = client.post("/api/registrations/", json={
            "session_id": "nonexistent",
            "name": "João",
            "email": "joao@example.com",
            "phone": "48999999999",
        })
    assert resp.status_code == 404


def test_register_cancelled_session(client):
    with patch("routes.registrations.db.select") as mock_select:
        mock_select.return_value = [{"id": "s1", "status": "cancelled", "slot_id": None}]
        resp = client.post("/api/registrations/", json={
            "session_id": "s1",
            "name": "João",
            "email": "joao@example.com",
            "phone": "48999999999",
        })
    assert resp.status_code == 409
    assert "cancelada" in resp.get_json()["error"]


def test_register_capacity_exceeded(client):
    session = {"id": "s1", "status": "scheduled", "slot_id": "slot1", "max_participants": 0}
    slot = {"id": "slot1", "max_participants": 2}
    existing_regs = [{"id": "r1"}, {"id": "r2"}]  # already full

    with patch("routes.registrations.db.select") as mock_select:
        mock_select.side_effect = [
            [session],
            [slot],
            existing_regs,
        ]
        resp = client.post("/api/registrations/", json={
            "session_id": "s1",
            "name": "João",
            "email": "joao@example.com",
            "phone": "48999999999",
        })
    assert resp.status_code == 409
    assert "esgotada" in resp.get_json()["error"]


# ──────────────────────────────────────────────────────────
# GET /api/registrations/validate — Validate token
# ──────────────────────────────────────────────────────────

def test_validate_valid_token(client):
    reg = {"id": "r1", "session_id": "s1", "name": "João", "access_token": "valid-token"}
    with patch("routes.registrations.db.select", return_value=[reg]):
        resp = client.get("/api/registrations/validate?session_id=s1&token=valid-token")
    assert resp.status_code == 200
    assert resp.get_json()["id"] == "r1"


def test_validate_invalid_token(client):
    with patch("routes.registrations.db.select", return_value=[]):
        resp = client.get("/api/registrations/validate?session_id=s1&token=bad-token")
    assert resp.status_code == 401


def test_validate_missing_params(client, mock_supabase):
    resp = client.get("/api/registrations/validate?session_id=s1")
    assert resp.status_code == 400


# ──────────────────────────────────────────────────────────
# POST /api/registrations/attend
# ──────────────────────────────────────────────────────────

def test_attend_success(client):
    reg = {"id": "r1", "session_id": "s1", "access_token": "tok", "attended_at": None}
    updated = {**reg, "attended_at": "2026-04-09T10:00:00+00:00"}

    with patch("routes.registrations.db.select", return_value=[reg]), \
         patch("routes.registrations.db.update", return_value=[updated]):
        resp = client.post("/api/registrations/attend", json={"session_id": "s1", "token": "tok"})

    assert resp.status_code == 200
    assert resp.get_json()["attended_at"] is not None


def test_attend_invalid_token(client):
    with patch("routes.registrations.db.select", return_value=[]):
        resp = client.post("/api/registrations/attend", json={"session_id": "s1", "token": "bad"})
    assert resp.status_code == 401


def test_attend_missing_fields(client, mock_supabase):
    resp = client.post("/api/registrations/attend", json={"session_id": "s1"})
    assert resp.status_code == 400


# ──────────────────────────────────────────────────────────
# POST /api/registrations/cancel
# ──────────────────────────────────────────────────────────

def test_cancel_success(client):
    reg = {"id": "r1", "session_id": "s1", "access_token": "tok", "email": "joao@ex.com", "cancelled_at": None}
    updated = {**reg, "cancelled_at": "2026-04-09T10:00:00+00:00"}

    with patch("routes.registrations.db.select", return_value=[reg]), \
         patch("routes.registrations.db.update", return_value=[updated]):
        resp = client.post("/api/registrations/cancel", json={"session_id": "s1", "token": "tok"})

    assert resp.status_code == 200
    assert resp.get_json()["cancelled_at"] is not None


def test_cancel_invalid_token(client):
    with patch("routes.registrations.db.select", return_value=[]):
        resp = client.post("/api/registrations/cancel", json={"session_id": "s1", "token": "bad"})
    assert resp.status_code == 401
