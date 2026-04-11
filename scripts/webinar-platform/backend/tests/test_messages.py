from unittest.mock import patch


REG = {"id": "r1", "session_id": "s1", "access_token": "tok", "name": "João", "cancelled_at": None}


# ──────────────────────────────────────────────────────────
# POST /api/messages/ — Send message
# ──────────────────────────────────────────────────────────

def test_send_message_success(client):
    msg = {"id": "m1", "session_id": "s1", "content": "Olá!", "sender_type": "lead"}
    with patch("routes.messages.db.select", return_value=[REG]), \
         patch("routes.messages.db.insert", return_value=[msg]):
        resp = client.post("/api/messages/", json={
            "session_id": "s1",
            "token": "tok",
            "content": "Olá!",
        })
    assert resp.status_code == 201
    assert resp.get_json()["sender_type"] == "lead"


def test_send_message_no_token(client, mock_supabase):
    resp = client.post("/api/messages/", json={
        "session_id": "s1",
        "content": "Olá!",
    })
    assert resp.status_code == 400


def test_send_message_invalid_token(client):
    with patch("routes.messages.db.select", return_value=[]):
        resp = client.post("/api/messages/", json={
            "session_id": "s1",
            "token": "bad-token",
            "content": "Olá!",
        })
    assert resp.status_code == 401


def test_send_message_too_long(client):
    with patch("routes.messages.db.select", return_value=[REG]):
        resp = client.post("/api/messages/", json={
            "session_id": "s1",
            "token": "tok",
            "content": "x" * 501,
        })
    assert resp.status_code == 400
    assert "500" in resp.get_json()["error"]


def test_send_message_missing_content(client, mock_supabase):
    resp = client.post("/api/messages/", json={
        "session_id": "s1",
        "token": "tok",
    })
    assert resp.status_code == 400


# ──────────────────────────────────────────────────────────
# GET /api/messages/<session_id> — List messages
# ──────────────────────────────────────────────────────────

def test_list_messages(client):
    messages = [
        {"id": "m1", "session_id": "s1", "content": "Oi", "sender_type": "lead", "is_deleted": False},
        {"id": "m2", "session_id": "s1", "content": "Olá", "sender_type": "presenter", "is_deleted": False},
    ]
    with patch("routes.messages.db.select", return_value=messages):
        resp = client.get("/api/messages/s1")
    assert resp.status_code == 200
    assert len(resp.get_json()) == 2


def test_list_messages_empty(client):
    with patch("routes.messages.db.select", return_value=[]):
        resp = client.get("/api/messages/s1")
    assert resp.status_code == 200
    assert resp.get_json() == []


# ──────────────────────────────────────────────────────────
# DELETE /api/messages/<message_id> — Soft delete (admin)
# ──────────────────────────────────────────────────────────

def test_delete_message(client):
    updated = {"id": "m1", "is_deleted": True}
    with patch("app.require_admin", return_value={"email": "admin@seazone.com.br"}), \
         patch("routes.messages.db.update", return_value=[updated]):
        resp = client.delete(
            "/api/messages/m1",
            headers={"Authorization": "Bearer test-token"},
        )
    assert resp.status_code == 200
    assert resp.get_json()["is_deleted"] is True


def test_delete_message_no_auth(client, mock_supabase):
    """Without auth header, require_admin raises 401."""
    resp = client.delete("/api/messages/m1")
    assert resp.status_code == 401
