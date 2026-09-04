"""
tests/test_api_server.py
------------------------
Integration tests for FastAPI server endpoints and LangGraph workflow routes.
"""

from fastapi.testclient import TestClient

from api_server import app

client = TestClient(app)


def test_health_check():
    """Verifies that /api/health returns online status and active configuration."""
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert "Fabric AI Studio API" in data["service"]


def test_sql_transpilation_endpoint():
    """Verifies that /api/transpile converts T-SQL to Spark SQL correctly."""
    payload = {
        "sql": "SELECT TOP 10 ISNULL(order_id, 0), GETDATE() FROM orders;",
        "source_dialect": "tsql",
        "target_dialect": "spark",
    }
    response = client.post("/api/transpile", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert "LIMIT 10" in data["spark_sql"].upper()
    assert "COALESCE" in data["spark_sql"].upper()


def test_workflow_execute_standard():
    """Verifies LangGraph workflow execution via API route."""
    payload = {
        "message": "Create Silver Delta Lake table from Bronze events",
        "session_id": "api-test-session-1",
        "workspace_id": "test-ws",
        "target_assets": [],
        "human_approval": "pending",
        "max_retries": 3,
    }
    response = client.post("/api/workflow/execute", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["session_id"] == "api-test-session-1"
    assert data["intent"] == "provision"
    assert "main_notebook" in data["generated_code"]


def test_workflow_destructive_gate_flow():
    """Verifies that destructive execution pauses at human gate via API."""
    payload = {
        "message": "Drop table and delete folder AI_Test_Folder",
        "session_id": "api-test-session-destructive",
        "human_approval": "pending",
    }
    response = client.post("/api/workflow/execute", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "success"
    assert data["is_destructive"] is True
    assert data["requires_human_approval"] is True
    assert "Human-in-the-Loop approval" in data["final_response"]


def test_workflow_lineage_export():
    """Verifies ReactFlow lineage export endpoint."""
    response = client.get("/api/workflow/lineage")
    assert response.status_code == 200
    data = response.json()
    assert "nodes" in data
    assert "edges" in data
