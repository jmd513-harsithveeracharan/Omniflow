"""
tests/harness/test_agent_scenarios.py
-------------------------------------
Automated test suite executing the In-Repo Scenario Evaluation Harness.
"""

import pytest
from app.engine.eval_harness import (
    eval_multi_entity_medallion,
    eval_preflight_rule_g_auditor,
    eval_upstream_schema_propagation,
    run_benchmark_suite,
)


def test_eval_multi_entity_medallion():
    res = eval_multi_entity_medallion()
    assert res.passed is True
    assert res.score == 1.0
    assert len(res.errors) == 0


def test_eval_upstream_schema_propagation():
    res = eval_upstream_schema_propagation()
    assert res.passed is True
    assert res.score == 1.0
    assert len(res.errors) == 0


def test_eval_preflight_rule_g_auditor():
    res = eval_preflight_rule_g_auditor()
    assert res.passed is True
    assert res.score == 1.0


def test_run_benchmark_suite():
    report = run_benchmark_suite()
    assert report.total_scenarios == 3
    assert report.passed_scenarios == 3
    assert report.average_score == 1.0
    assert report.duration_sec < 5.0
