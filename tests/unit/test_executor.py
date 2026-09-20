"""
tests/unit/test_executor.py
----------------------------
Unit tests for Stage 5: Autonomous Closed-Loop Executor & Self-Healing.
"""

from unittest.mock import patch, MagicMock
import pytest
from app.deployment_executor import DeploymentStepResult, DeploymentReport
from app.engine.executor import execute_closed_loop, _poll_job_completion


@pytest.fixture
def mock_plan():
    return {
        "run_id": "test_exec_001",
        "folder": "OrderAnalytics_LiveTest",
        "lakehouses": ["lh_orders_silver", "lh_orders_gold"],
        "notebooks": [
            {
                "name": "nb_orders_silver",
                "pyspark": "# Clean silver data\nspark.read.table('raw').filter('id is not null')",
            }
        ],
        "pipeline": {
            "name": "pl_orders_orchestrator",
            "activities": ["nb_orders_silver"],
        },
    }


def test_poll_job_completion_success():
    """Verify polling stops and reports success upon Completed status."""
    with patch("app.engine.executor.get_job_status") as mock_status:
        mock_status.return_value = {
            "success": True,
            "status": "Completed",
            "failure_reason": None,
        }
        res = _poll_job_completion("item_123", "job_456", "ws_789", timeout_sec=5, poll_interval_sec=0.01)
        assert res["success"] is True
        assert res["status"] == "Completed"


def test_execute_closed_loop_pipeline_success(mock_plan):
    """Verify closed loop triggers pipeline and formats summary report."""
    dep_report = DeploymentReport(
        run_id="test_exec_001",
        status="completed",
        folder_name="OrderAnalytics_LiveTest",
        workspace_id="ws_123",
        deployed_items=[
            DeploymentStepResult(step_id="s1", name="pl_orders_orchestrator", item_type="pipeline", item_id="pl_id_1"),
            DeploymentStepResult(step_id="s2", name="nb_orders_silver", item_type="notebook", item_id="nb_id_1"),
        ],
    )

    with patch("app.engine.executor.deploy_fabric_plan", return_value=dep_report), \
         patch("app.engine.executor.trigger_pipeline_run", return_value={"success": True, "job_id": "job_999"}), \
         patch("app.engine.executor._poll_job_completion", return_value={"success": True, "status": "Completed", "duration_sec": 4.5}), \
         patch("app.engine.executor.resolve_table_schema", return_value=[{"name": "order_id", "type": "string"}]):

        report = execute_closed_loop(mock_plan, workspace_id="ws_123")
        assert report.status == "success"
        assert len(report.job_results) == 1
        assert report.job_results[0]["status"] == "Completed"
        assert "OrderAnalytics_LiveTest" in report.summary_markdown
        assert "Autonomous Execution Complete" in report.summary_markdown


def test_execute_closed_loop_self_healing(mock_plan):
    """Verify failed notebook triggers diagnose_and_patch and updates definition."""
    # Plan without pipeline to test sequential notebook healing
    plan_no_pipe = dict(mock_plan)
    plan_no_pipe["pipeline"] = None

    dep_report = DeploymentReport(
        run_id="test_exec_002",
        status="completed",
        folder_name="OrderAnalytics_LiveTest",
        workspace_id="ws_123",
        deployed_items=[
            DeploymentStepResult(step_id="s1", name="nb_orders_silver", item_type="notebook", item_id="nb_id_1"),
        ],
    )

    # First run fails, second run succeeds
    poll_side_effects = [
        {"success": False, "status": "Failed", "failure_reason": "AnalysisException: Table not found", "duration_sec": 3.0},
        {"success": True, "status": "Completed", "duration_sec": 2.5},
    ]

    with patch("app.engine.executor.deploy_fabric_plan", return_value=dep_report), \
         patch("app.engine.executor.run_notebook", return_value={"success": True, "job_id": "nb_job_1"}), \
         patch("app.engine.executor._poll_job_completion", side_effect=poll_side_effects), \
         patch("app.engine.executor.diagnose_and_patch_code", return_value={"success": True, "patched_code": "# Patched\nspark.read", "diagnosis": "Fixed table reference"}), \
         patch("app.engine.executor.compile_notebook", return_value={"definition": {"parts": []}}), \
         patch("app.engine.executor.update_definition", return_value={"success": True}), \
         patch("app.engine.executor.resolve_table_schema", return_value=[{"name": "order_id", "type": "string"}]):

        report = execute_closed_loop(plan_no_pipe, workspace_id="ws_123")
        assert len(report.healing_events) == 1
        assert report.healing_events[0]["notebook"] == "nb_orders_silver"
        assert report.healing_events[0]["diagnosis"] == "Fixed table reference"
        assert len(report.job_results) == 1
        assert report.job_results[0]["status"] == "Completed"
