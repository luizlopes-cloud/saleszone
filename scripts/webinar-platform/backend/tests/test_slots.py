from unittest.mock import patch


def test_list_slots(client, mock_supabase):
    mock_supabase.return_value = [{"id": "abc", "day_of_week": 1, "time": "14:30:00-03", "is_active": True}]
    resp = client.get("/api/slots/")
    assert resp.status_code == 200
    assert len(resp.get_json()) == 1


def test_create_slot(client, mock_supabase):
    mock_supabase.return_value = [{"id": "new-id", "day_of_week": 2}]
    resp = client.post("/api/slots/", json={
        "day_of_week": 2, "time": "15:00", "duration_minutes": 60,
        "max_participants": 50, "presenter_email": "joao@seazone.com.br"
    })
    assert resp.status_code == 201


def test_create_slot_invalid_email(client, mock_supabase):
    resp = client.post("/api/slots/", json={
        "day_of_week": 2, "time": "15:00", "duration_minutes": 60,
        "max_participants": 50, "presenter_email": "external@gmail.com"
    })
    assert resp.status_code == 400


def test_create_slot_missing_fields(client, mock_supabase):
    resp = client.post("/api/slots/", json={
        "day_of_week": 2, "presenter_email": "joao@seazone.com.br"
    })
    assert resp.status_code == 400


def test_create_slot_invalid_day_of_week(client, mock_supabase):
    resp = client.post("/api/slots/", json={
        "day_of_week": 7, "time": "15:00", "duration_minutes": 60,
        "max_participants": 50, "presenter_email": "joao@seazone.com.br"
    })
    assert resp.status_code == 400


def test_update_slot(client, mock_supabase):
    mock_supabase.return_value = [{"id": "abc", "is_active": False}]
    resp = client.put("/api/slots/abc", json={"is_active": False})
    assert resp.status_code == 200


def test_update_slot_invalid_email(client, mock_supabase):
    resp = client.put("/api/slots/abc", json={"presenter_email": "external@gmail.com"})
    assert resp.status_code == 400


def test_delete_slot(client, mock_supabase):
    mock_supabase.return_value = None
    resp = client.delete("/api/slots/abc")
    assert resp.status_code == 204
