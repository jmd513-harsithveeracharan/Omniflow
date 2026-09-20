"""
tests/unit/test_reconciliation_and_interactive_api.py
------------------------------------------------------
Unit tests for Workspace Reconciliation and Interactive Notebook Execution FastAPI routes.
"""

from unittest.mock import patch
from fastapi.testclient import TestClient
from api_server import app
from app.engine.reconciler import ReconciliationReport, ReconciliationItem

client = TestClient(app)


def test_reconcile_workspace_endpoint_success():
    mock_report = ReconciliationReport(
        workspace_id="ws_mock_123",
        total_local=2,
        total_cloud=3,
        synced_count=1,
        local_only_count=1,
        cloud_only_count=2,
        items=[
            ReconciliationItem(name="orders_silver", item_type="Notebook", status="SYNCED", details="Up-to-date"),
            ReconciliationItem(name="orders_gold", item_type="Notebook", status="LOCAL_ONLY", details="Not deployed"),
            ReconciliationItem(name="raw_staging", item_type="Lakehouse", status="CLOUD_ONLY", details="Uncommitted"),
        ],
    )

    with patch("app.engine.reconciler.reconcile_workspace", return_value=mock_report):
        resp = client.get("/api/workspace/reconcile?workspace_id=ws_mock_123")
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["report"]["total_local"] == 2
        assert data["report"]["total_cloud"] == 3
        assert len(data["report"]["items"]) == 3


def test_interactive_notebook_run_endpoint_pipeline_router():
    mock_res = {
        "success": True,
        "status": "Completed",
        "notebook": "nb_orders_silver",
        "job_id": "job_abc123",
        "duration_sec": 4.2,
        "quality_gate": {"passed": True, "duplicate_pk_count": 0, "total_violations": 0},
        "healing_events": [],
    }

    with patch("app.engine.interactive_runner.run_single_notebook_interactive", return_value=mock_res):
        payload = {
            "notebook_id": "nb_12345",
            "notebook_name": "nb_orders_silver",
            "workspace_id": "ws_mock_123",
            "timeout_sec": 30,
        }
        resp = client.post("/api/pipeline/notebook/run-interactive", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["success"] is True
        assert data["notebook"] == "nb_orders_silver"
        assert data["quality_gate"]["passed"] is True


def test_interactive_notebook_run_endpoint_direct_alias():
    mock_res = {
        "success": True,
        "status": "QualityGateBreached",
        "notebook": "nb_orders_silver",
        "job_id": "job_abc123",
        "duration_sec": 3.8,
        "quality_gate": {"passed": False, "duplicate_pk_count": 5, "total_violations": 5},
        "healing_events": [],
    }

    with patch("app.engine.interactive_runner.run_single_notebook_interactive", return_value=mock_res):
        payload = {
            "notebook_id": "nb_12345",
            "notebook_name": "nb_orders_silver",
            "workspace_id": "ws_mock_123",
            "timeout_sec": 30,
            "max_allowed_duplicates": 0,
        }
        resp = client.post("/api/notebooks/run-interactive", json=payload)
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "QualityGateBreached"
        assert data["quality_gate"]["passed"] is False
        assert data["quality_gate"]["duplicate_pk_count"] == 5

