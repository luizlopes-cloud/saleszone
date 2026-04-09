import pytest
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).parent.parent))

@pytest.fixture
def app():
    with patch("supabase_client.SUPABASE_URL", "http://test.supabase.co"), \
         patch("supabase_client.SUPABASE_SERVICE_ROLE_KEY", "test-key"), \
         patch("supabase_client.SUPABASE_ANON_KEY", "test-anon-key"):
        from app import app
        app.config["TESTING"] = True
        yield app

@pytest.fixture
def client(app):
    return app.test_client()

@pytest.fixture
def mock_supabase():
    with patch("supabase_client._request") as mock_req:
        mock_req.return_value = []
        yield mock_req
