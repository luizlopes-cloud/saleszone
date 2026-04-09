from unittest.mock import patch, MagicMock


def _mock_admin():
    """Return a mock user for require_admin()."""
    return {"email": "admin@seazone.com.br"}


def test_list_sessions_by_date_range(client, mock_supabase):
    mock_supabase.return_value = [{"id": "s1", "date": "2026-04-10", "status": "scheduled"}]
    resp = client.get("/api/sessions/?date_from=2026-04-10&date_to=2026-04-17")
    assert resp.status_code == 200


def test_list_available_sessions(client, mock_supabase):
    mock_supabase.return_value = [
        {
            "id": "s1",
            "date": "2026-04-10",
            "status": "scheduled",
            "slot_id": "slot1",
            "starts_at": "2026-04-10T14:30:00-03:00",
            "registrations_count": 0,
        }
    ]
    with patch("routes.sessions.db.select") as mock_select:
        # First call: sessions, second call: slots
        mock_select.side_effect = [
            [{"id": "s1", "date": "2026-04-10", "status": "scheduled",
              "slot_id": "slot1", "starts_at": "2026-04-10T14:30:00-03:00",
              "registrations_count": 0}],
            [{"id": "slot1", "max_participants": 50}],
        ]
        resp = client.get("/api/sessions/available?date=2026-04-10")
    assert resp.status_code == 200


def test_list_available_sessions_no_date(client, mock_supabase):
    resp = client.get("/api/sessions/available")
    assert resp.status_code == 400


def test_create_session_admin(client, mock_supabase):
    mock_supabase.return_value = [{"id": "s1", "date": "2026-04-10"}]
    with patch("app.require_admin", return_value=_mock_admin()):
        resp = client.post(
            "/api/sessions/",
            json={"slot_id": "slot1", "date": "2026-04-10"},
            headers={"Authorization": "Bearer test-token"},
        )
    assert resp.status_code == 201


def test_get_session_detail(client, mock_supabase):
    mock_supabase.return_value = [{"id": "s1", "date": "2026-04-10", "status": "scheduled"}]
    resp = client.get("/api/sessions/s1")
    assert resp.status_code == 200


def test_get_session_detail_not_found(client, mock_supabase):
    mock_supabase.return_value = []
    resp = client.get("/api/sessions/nonexistent")
    assert resp.status_code == 404


def test_update_session_status(client, mock_supabase):
    mock_supabase.return_value = [{"id": "s1", "status": "live"}]
    resp = client.patch("/api/sessions/s1/status", json={"status": "live"})
    assert resp.status_code == 200


def test_update_session_status_invalid(client, mock_supabase):
    resp = client.patch("/api/sessions/s1/status", json={"status": "invalid_status"})
    assert resp.status_code == 400


def test_cancel_session(client, mock_supabase):
    mock_supabase.return_value = [{"id": "s1", "status": "cancelled"}]
    with patch("app.require_admin", return_value=_mock_admin()), \
         patch("routes.sessions.db.select", return_value=[]), \
         patch("routes.sessions.db.update", return_value=[{"id": "s1", "status": "cancelled"}]):
        resp = client.patch(
            "/api/sessions/s1/status",
            json={"status": "cancelled", "cancel_reason": "Test"},
            headers={"Authorization": "Bearer test-token"},
        )
    assert resp.status_code == 200
