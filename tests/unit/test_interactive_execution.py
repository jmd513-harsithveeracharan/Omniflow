"""
tests/unit/test_interactive_execution.py
----------------------------------------
Unit tests for fast interactive notebook execution mode.
"""

from unittest.mock import MagicMock, patch
import pytest

from app.engine.executor import run_single_notebook_interactive


@patch("app.engine.executor.run_notebook")
@patch("app.engine.executor._poll_job_completion")
def test_run_single_notebook_interactive_success(mock_poll, mock_run):
    mock_run.return_value = {"success": True, "job_id": "job_12345"}
    mock_poll.return_value = {"success": True, "status": "Completed", "duration_sec": 8.5}

    res = run_single_notebook_interactive(
        notebook_id="nb_guid_123",
        notebook_name="nb_orders_silver",
        workspace_id="ws_123",
        timeout_sec=60,
    )

    assert res["success"] is True
    assert res["status"] == "Completed"
    assert res["notebook"] == "nb_orders_silver"
    assert res["duration_sec"] == 8.5
    assert mock_run.call_count == 1
    # Verify interactive task_type was passed to poll
    assert mock_poll.call_args[1]["task_type"] == "interactive"
    assert mock_poll.call_args[1]["skip_initial_delay"] is True


@patch("app.engine.executor.run_notebook")
@patch("app.engine.executor._poll_job_completion")
@patch("app.engine.executor.diagnose_and_patch_code")
@patch("app.engine.executor.compile_notebook")
@patch("app.engine.executor.update_definition")
def test_run_single_notebook_interactive_self_healing(
    mock_update, mock_compile, mock_diagnose, mock_poll, mock_run
):
    mock_run.return_value = {"success": True, "job_id": "job_12345"}
    # Fail on first run, succeed on second run
    mock_poll.side_effect = [
        {"success": False, "status": "Failed", "failure_reason": "AnalysisException: table not found"},
        {"success": True, "status": "Completed", "duration_sec": 12.0},
    ]
    mock_diagnose.return_value = {
        "success": True,
        "patched_code": "df = spark.read.table('orders')",
        "diagnosis": "Fixed table reference",
    }
    mock_compile.return_value = {"definition": {"parts": []}}
    mock_update.return_value = {"success": True}

    res = run_single_notebook_interactive(
        notebook_id="nb_guid_123",
        notebook_name="nb_orders_silver",
        current_code="df = spark.read.table('wrong')",
        max_heal_retries=1,
    )

    assert res["success"] is True
    assert res["status"] == "Completed"
    assert len(res["healing_events"]) == 1
    assert res["healing_events"][0]["diagnosis"] == "Fixed table reference"
    assert mock_update.call_count == 1

