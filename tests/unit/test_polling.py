"""
tests/unit/test_polling.py
--------------------------
Unit tests for Stage 5: Dynamic Task-Based Polling & Pre-Flight Fabric Guardrails.
"""

from unittest.mock import MagicMock, patch
import pytest

from app.engine.polling import (
    get_polling_profile,
    poll_fabric_job_adaptive,
    _format_phase_detail,
)
from app.engine.auditor import _static_code_audit
from app.engine.executor import execute_closed_loop
from app.deployment_executor import DeploymentStepResult, DeploymentReport


# ── Profile Selection Tests ──────────────────────────────────────────────────

def test_get_polling_profile_pipeline():
    """Pipelines get longer initial delay and extended timeout for multi-step DAGs."""
    p = get_polling_profile("pipeline")
    assert p.task_type == "pipeline"
    assert p.initial_delay_sec == 15.0
    assert p.timeout_sec == 480
    assert p.status_interval_map["NotStarted"] >= 10.0


def test_get_polling_profile_notebook_cold_vs_warm():
    """Cold start notebook gets cluster allocation pacing; warm gets tight interval."""
    cold = get_polling_profile("notebook", is_first_run=True)
    assert cold.task_type == "notebook_cold"
    assert cold.initial_delay_sec == 12.0
    assert cold.timeout_sec == 300

    warm = get_polling_profile("notebook", is_first_run=False)
    assert warm.task_type == "notebook_warm"
    assert warm.initial_delay_sec == 3.0
    assert warm.timeout_sec == 180


def test_get_polling_profile_interactive():
    """Interactive queries get fast polling with low timeout."""
    p = get_polling_profile("interactive")
    assert p.task_type == "interactive"
    assert p.timeout_sec == 60


# ── Adaptive Polling Execution Tests ─────────────────────────────────────────

def test_poll_adaptive_immediate_completion():
    """Verify adaptive poller detects Completed terminal state and returns telemetry."""
    mock_status = MagicMock(return_value={
        "success": True,
        "status": "Completed",
        "failure_reason": None,
        "raw": {"id": "job_001"},
    })

    res = poll_fabric_job_adaptive(
        item_id="item_001",
        job_id="job_001",
        task_type="notebook_warm",
        skip_initial_delay=True,
        get_status_fn=mock_status,
    )

    assert res["success"] is True
    assert res["status"] == "Completed"
    assert res["poll_count"] == 1
    assert res["profile_used"] == "notebook_warm"


def test_poll_adaptive_handles_throttling():
    """Verify 429 throttling triggers backoff and continues polling until success."""
    status_sequence = [
        {"success": False, "status_code": 429, "error": "Rate limit"},
        {"success": True, "status": "Completed", "failure_reason": None},
    ]
    mock_status = MagicMock(side_effect=status_sequence)

    with patch("time.sleep"):  # skip actual sleep in test
        res = poll_fabric_job_adaptive(
            item_id="item_001",
            job_id="job_001",
            task_type="notebook_warm",
            skip_initial_delay=True,
            get_status_fn=mock_status,
        )

    assert res["success"] is True
    assert res["status"] == "Completed"
    assert res["poll_count"] == 2


def test_format_phase_detail():
    """Verify phase detail text accurately reflects compute state."""
    cold_not_started = _format_phase_detail("NotStarted", 10.0, "notebook_cold", "nb_bronze")
    assert "Provisioning Spark cluster" in cold_not_started
    assert "nb_bronze" in cold_not_started

    pipe_in_progress = _format_phase_detail("InProgress", 50.0, "pipeline", "pl_orders")
    assert "Executing pipeline activities" in pipe_in_progress


# ── Rule G: Pre-Flight Static Code Guardrail Tests ───────────────────────────

def test_rule_g_flags_multi_part_save_as_table():
    """Rule G must flag 3-part or 2-part saveAsTable identifiers as fatal errors."""
    bad_plan = {
        "notebooks": [
            {
                "name": "nb_bronze",
                "layer": "Bronze",
                "pyspark": "df.write.format('delta').mode('overwrite').saveAsTable('lh_orders_bronze.dbo.orders')",
            },
            {
                "name": "nb_silver",
                "layer": "Silver",
                "pyspark": "df.write.format('delta').mode('overwrite').saveAsTable('lh_orders_silver.orders')",
            },
        ]
    }
    violations = _static_code_audit(bad_plan)
    g_violations = [v for v in violations if v.get("rule") == "G"]
    assert len(g_violations) == 2
    assert "lh_orders_bronze.dbo.orders" in g_violations[0]["description"]
    assert "lh_orders_silver.orders" in g_violations[1]["description"]


def test_rule_g_passes_single_part_save_as_table():
    """Rule G must cleanly pass single-part saveAsTable target names."""
    clean_plan = {
        "notebooks": [
            {
                "name": "nb_bronze",
                "layer": "Bronze",
                "pyspark": "df.write.format('delta').mode('overwrite').saveAsTable('orders')",
            }
        ]
    }
    violations = _static_code_audit(clean_plan)
    g_violations = [v for v in violations if v.get("rule") == "G"]
    assert len(g_violations) == 0


def test_pre_flight_auto_remediates_in_executor():
    """execute_closed_loop pre-flight check automatically converts multi-part saveAsTable."""
    plan_with_bad_target = {
        "run_id": "test_preflight_001",
        "folder": "OrderAnalytics_LiveTest",
        "lakehouses": ["lh_orders_silver"],
        "notebooks": [
            {
                "name": "nb_orders_silver",
                "pyspark_code": "df.write.format('delta').mode('overwrite').saveAsTable('lh_orders_silver.dbo.orders')",
            }
        ],
        "pipeline": None,
    }

    dep_report = DeploymentReport(
        run_id="test_preflight_001",
        status="completed",
        folder_name="OrderAnalytics_LiveTest",
        workspace_id="ws_123",
        deployed_items=[
            DeploymentStepResult(step_id="s1", name="nb_orders_silver", item_type="notebook", item_id="nb_id_1"),
        ],
    )

    with patch("app.engine.executor.deploy_fabric_plan", return_value=dep_report), \
         patch("app.engine.executor.run_notebook", return_value={"success": True, "job_id": "job_1"}), \
         patch("app.engine.executor._poll_job_completion", return_value={"success": True, "status": "Completed"}), \
         patch("app.engine.executor.resolve_table_schema", return_value=[{"name": "order_id", "type": "string"}]):

        report = execute_closed_loop(plan_with_bad_target, workspace_id="ws_123")
        # Pre-flight auto-remediation should have rewritten the code to single-part
        nb = plan_with_bad_target["notebooks"][0]
        assert ".saveAsTable('orders')" in nb["pyspark_code"]
        assert "lh_orders_silver.dbo" not in nb["pyspark_code"]
