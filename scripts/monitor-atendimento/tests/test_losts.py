"""Testes unitários para analyzers/losts.py."""

import unittest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from analyzers.losts import compute_lost_summary, generate_lost_alerts


def _make_deal(**overrides):
    """Helper: cria deal com defaults sensatos."""
    base = {
        "deal_id": 1,
        "title": "Test Deal",
        "pipeline_id": 14,
        "stage_id": 71,
        "stage_name": "Contatados",
        "stage_category": "pre_vendas",
        "owner_name": "Test Owner",
        "owner_email": "test@seazone.com.br",
        "lost_time": "2026-03-18 15:00:00",
        "lost_hour": 15,
        "add_time": "2026-03-10 10:00:00",
        "days_in_funnel": 8,
        "lost_reason": "Não atende/Não responde",
        "canal": "Marketing",
        "rd_campanha": "",
        "rd_source": "",
        "motivo_lost_mia": "",
    }
    base.update(overrides)
    return base


class TestComputeLostSummary(unittest.TestCase):

    def test_empty_deals(self):
        result = compute_lost_summary([], "2026-03-18")
        self.assertEqual(result["total"], 0)

    def test_basic_counts(self):
        deals = [
            _make_deal(deal_id=1, stage_category="pre_vendas"),
            _make_deal(deal_id=2, stage_category="pre_vendas"),
            _make_deal(deal_id=3, stage_category="vendas"),
        ]
        result = compute_lost_summary(deals, "2026-03-18")
        self.assertEqual(result["total"], 3)
        self.assertEqual(result["pre_vendas"], 2)
        self.assertEqual(result["vendas"], 1)
        self.assertAlmostEqual(result["pre_vendas_pct"], 66.7, places=1)

    def test_by_reason(self):
        deals = [
            _make_deal(deal_id=1, lost_reason="Timing"),
            _make_deal(deal_id=2, lost_reason="Timing"),
            _make_deal(deal_id=3, lost_reason="Concorrência"),
        ]
        result = compute_lost_summary(deals, "2026-03-18")
        self.assertEqual(result["by_reason"]["Timing"], 2)
        self.assertEqual(result["by_reason"]["Concorrência"], 1)

    def test_batch_pattern(self):
        deals = [
            _make_deal(deal_id=1, lost_hour=19),
            _make_deal(deal_id=2, lost_hour=20),
            _make_deal(deal_id=3, lost_hour=10),
        ]
        result = compute_lost_summary(deals, "2026-03-18")
        self.assertAlmostEqual(result["batch_after_18h_pct"], 66.7, places=1)


class TestGenerateLostAlerts(unittest.TestCase):

    def test_no_deals_no_alerts(self):
        alerts = generate_lost_alerts([], "2026-03-18")
        self.assertEqual(alerts, [])

    def test_advanced_stage_alert(self):
        """Deal em Contrato (76) gera critical."""
        deals = [_make_deal(
            deal_id=100,
            stage_id=76,
            stage_name="Contrato",
            stage_category="vendas",
            lost_reason="Timing",
            days_in_funnel=60,
        )]
        alerts = generate_lost_alerts(deals, "2026-03-18")
        criticals = [a for a in alerts if a["alert_type"] == "lost_in_advanced_stage"]
        self.assertEqual(len(criticals), 1)
        self.assertEqual(criticals[0]["severity"], "critical")

    def test_timing_violation(self):
        """Timing + <30d gera warning."""
        deals = [_make_deal(
            deal_id=101,
            lost_reason="Timing",
            days_in_funnel=8,
        )]
        alerts = generate_lost_alerts(deals, "2026-03-18")
        timing = [a for a in alerts if a["alert_type"] == "timing_violation"]
        self.assertEqual(len(timing), 1)
        self.assertEqual(timing[0]["severity"], "warning")
        self.assertEqual(timing[0]["metric_value"], 8)

    def test_timing_no_violation(self):
        """Timing + >=30d NÃO gera alerta de timing."""
        deals = [_make_deal(
            deal_id=102,
            lost_reason="Timing",
            days_in_funnel=45,
        )]
        alerts = generate_lost_alerts(deals, "2026-03-18")
        timing = [a for a in alerts if a["alert_type"] == "timing_violation"]
        self.assertEqual(len(timing), 0)

    def test_nao_atende_post_meeting(self):
        """'Não atende' em Reunião Realizada (151) gera warning."""
        deals = [_make_deal(
            deal_id=103,
            stage_id=151,
            stage_name="Reunião Realizada",
            stage_category="vendas",
            lost_reason="Não atende/Não responde",
        )]
        alerts = generate_lost_alerts(deals, "2026-03-18")
        suspicious = [a for a in alerts if a["alert_type"] == "suspicious_reason_stage"]
        self.assertEqual(len(suspicious), 1)
        self.assertEqual(suspicious[0]["severity"], "warning")

    def test_nao_atende_pre_vendas_no_alert(self):
        """'Não atende' em Lead in (70) NÃO gera alerta de suspicious."""
        deals = [_make_deal(
            deal_id=104,
            stage_id=70,
            stage_name="Lead in",
            stage_category="pre_vendas",
            lost_reason="Não atende/Não responde",
        )]
        alerts = generate_lost_alerts(deals, "2026-03-18")
        suspicious = [a for a in alerts if a["alert_type"] == "suspicious_reason_stage"]
        self.assertEqual(len(suspicious), 0)

    def test_duplicate_in_advanced(self):
        """'Duplicado/Erro' em Negociação (75) gera warning."""
        deals = [_make_deal(
            deal_id=105,
            stage_id=75,
            stage_name="Negociação",
            stage_category="vendas",
            lost_reason="Duplicado/Erro",
        )]
        alerts = generate_lost_alerts(deals, "2026-03-18")
        dup = [a for a in alerts if a["alert_type"] == "duplicate_in_advanced"]
        self.assertEqual(len(dup), 1)

    def test_bulk_alert(self):
        """Owner com >20 deals gera warning."""
        deals = [
            _make_deal(deal_id=i, owner_name="Heavy Loser", owner_email="heavy@seazone.com.br")
            for i in range(25)
        ]
        alerts = generate_lost_alerts(deals, "2026-03-18")
        bulk = [a for a in alerts if a["alert_type"] == "bulk_lost_alert"]
        self.assertEqual(len(bulk), 1)
        self.assertEqual(bulk[0]["metric_value"], 25)

    def test_batch_pattern(self):
        """>60% após 18h gera info."""
        deals = [
            _make_deal(deal_id=1, lost_hour=19),
            _make_deal(deal_id=2, lost_hour=20),
            _make_deal(deal_id=3, lost_hour=19),
            _make_deal(deal_id=4, lost_hour=10),
        ]
        alerts = generate_lost_alerts(deals, "2026-03-18")
        batch = [a for a in alerts if a["alert_type"] == "batch_lost_pattern"]
        self.assertEqual(len(batch), 1)
        self.assertEqual(batch[0]["severity"], "info")


if __name__ == "__main__":
    unittest.main()
