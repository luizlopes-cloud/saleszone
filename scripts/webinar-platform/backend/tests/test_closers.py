from unittest.mock import patch


def test_list_closers(client, mock_supabase):
    mock_supabase.return_value = [
        {"id": "c1", "slug": "gabriela-lemos", "name": "Gabriela Lemos",
         "email": "gabriela.lemos@seazone.com.br", "is_active": True}
    ]
    resp = client.get("/api/closers/")
    assert resp.status_code == 200
    data = resp.get_json()
    assert len(data) == 1
    assert data[0]["slug"] == "gabriela-lemos"


def test_list_closers_empty(client, mock_supabase):
    mock_supabase.return_value = []
    resp = client.get("/api/closers/")
    assert resp.status_code == 200
    assert resp.get_json() == []


def test_get_closer_by_slug(client):
    closer = {"id": "c1", "slug": "gabriela-lemos", "name": "Gabriela Lemos",
               "email": "gabriela.lemos@seazone.com.br", "is_active": True}
    with patch("routes.closers.db.select", return_value=[closer]):
        resp = client.get("/api/closers/gabriela-lemos")
    assert resp.status_code == 200
    assert resp.get_json()["name"] == "Gabriela Lemos"


def test_get_closer_by_slug_not_found(client):
    with patch("routes.closers.db.select", return_value=[]):
        resp = client.get("/api/closers/nonexistent")
    assert resp.status_code == 404
    assert "error" in resp.get_json()
