"""Testes unitários para analyzers."""

import unittest
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))


class TestResponseTime(unittest.TestCase):
    """Testes para analyzers.response_time."""

    def test_compute_response_metrics_merges_wpp_and_calls(self):
        """Merge de dados WhatsApp e Api4Com por email."""
        from analyzers.response_time import compute_response_metrics

        wpp_data = {
            "a@test.com": {"wpp_response_time_median_min": 10.0, "wpp_messages_sent": 5, "wpp_messages_received": 3,
                           "wpp_response_time_p90_min": 20.0, "wpp_chats_unanswered_2h": 0,
                           "wpp_chats_unanswered_8h": 0, "wpp_chats_unanswered_24h": 0},
        }
        call_data = {
            "a@test.com": {"calls_made": 10, "calls_received": 5, "calls_answered": 12,
                           "calls_missed": 3, "calls_missed_no_return": 1,
                           "call_duration_avg_sec": 200, "call_answer_rate": 80.0},
        }

        result = compute_response_metrics(wpp_data, call_data, "2026-03-14")
        self.assertIn("a@test.com", result)
        m = result["a@test.com"]
        self.assertEqual(m["wpp_response_time_median_min"], 10.0)
        self.assertEqual(m["calls_made"], 10)
        self.assertEqual(m["call_answer_rate"], 80.0)
        self.assertEqual(m["seller_name"], "a@test.com")  # fallback if not in TEAM

    def test_compute_response_metrics_seller_only_in_wpp(self):
        """Vendedor só tem dados WhatsApp."""
        from analyzers.response_time import compute_response_metrics

        wpp_data = {
            "b@test.com": {"wpp_response_time_median_min": 5.0, "wpp_messages_sent": 10, "wpp_messages_received": 8,
                           "wpp_response_time_p90_min": 15.0, "wpp_chats_unanswered_2h": 1,
                           "wpp_chats_unanswered_8h": 0, "wpp_chats_unanswered_24h": 0},
        }
        result = compute_response_metrics(wpp_data, {}, "2026-03-14")
        self.assertIn("b@test.com", result)
        self.assertEqual(result["b@test.com"]["calls_made"], 0)


class TestAlerts(unittest.TestCase):
    """Testes para analyzers.alerts."""

    def test_response_time_warning(self):
        """Alerta warning quando tempo > 2x mediana."""
        from analyzers.alerts import generate_alerts

        metrics = {
            "fast@test.com": {
                "seller_name": "Fast", "seller_email": "fast@test.com",
                "role": "closer", "pipeline_slug": "szi",
                "wpp_response_time_median_min": 5.0,
                "calls_made": 10, "calls_received": 5,
                "wpp_messages_sent": 10, "wpp_messages_received": 8,
            },
            "slow@test.com": {
                "seller_name": "Slow", "seller_email": "slow@test.com",
                "role": "closer", "pipeline_slug": "szi",
                "wpp_response_time_median_min": 30.0,
                "calls_made": 10, "calls_received": 5,
                "wpp_messages_sent": 10, "wpp_messages_received": 8,
            },
            "very_slow@test.com": {
                "seller_name": "Very Slow", "seller_email": "very_slow@test.com",
                "role": "closer", "pipeline_slug": "szi",
                "wpp_response_time_median_min": 60.0,
                "calls_made": 10, "calls_received": 5,
                "wpp_messages_sent": 10, "wpp_messages_received": 8,
            },
        }

        alerts = generate_alerts(metrics, "2026-03-14")
        critical = [a for a in alerts if a["severity"] == "critical" and a["seller_email"] == "very_slow@test.com"]
        self.assertTrue(len(critical) > 0, "Deveria gerar alerta critical para very_slow")

    def test_no_activity_alert(self):
        """Alerta quando vendedor tem 0 atividades."""
        from analyzers.alerts import generate_alerts

        metrics = {
            "idle@test.com": {
                "seller_name": "Idle", "seller_email": "idle@test.com",
                "role": "closer", "pipeline_slug": "szi",
                "wpp_response_time_median_min": None,
                "wpp_messages_sent": 0, "wpp_messages_received": 0,
                "calls_made": 0, "calls_received": 0,
            },
        }

        alerts = generate_alerts(metrics, "2026-03-14")
        no_activity = [a for a in alerts if a["alert_type"] == "no_activity"]
        self.assertTrue(len(no_activity) > 0, "Deveria gerar alerta no_activity")


if __name__ == "__main__":
    unittest.main()
