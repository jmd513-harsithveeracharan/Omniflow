"""
tests/test_api_server.py
------------------------
Integration tests for all FastAPI server endpoints and modular domain routes.
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


def test_skills_endpoints():
    """Verifies that /api/skills lists skills and allows single skill retrieval and matching."""
    # List skills
    list_res = client.get("/api/skills")
    assert list_res.status_code == 200
    skills = list_res.json()
    assert len(skills) > 0

    # Skill by name
    first_skill = skills[0]["name"]
    detail_res = client.get(f"/api/skills/{first_skill}")
    assert detail_res.status_code == 200
    assert detail_res.json()["name"] == first_skill

    # Match skill
    match_res = client.post("/api/skills/match", json={"query": "transpile Oracle SQL query into Spark"})
    assert match_res.status_code == 200
    assert match_res.json()["matched"] is True


def test_connectors_endpoints():
    """Verifies that /api/connectors lists registered connectors and tests discovery."""
    from unittest.mock import MagicMock, patch

    list_res = client.get("/api/connectors")
    assert list_res.status_code == 200
    connectors = list_res.json()
    assert len(connectors) > 0

    mock_conn = MagicMock()
    mock_conn.discover_tables.return_value = {"success": True, "tables": [{"schema": "dbo", "table": "orders"}]}

    with patch("app.api.routers.connectors.get_connector", return_value=mock_conn):
        discover_res = client.post(
            "/api/connectors/discover",
            json={"source_id": connectors[0]["source_id"], "params": {}},
        )
        assert discover_res.status_code == 200
        assert discover_res.json()["success"] is True




def test_workspaces_endpoints():
    """Verifies workspace items, tree, and refresh routes."""
    from unittest.mock import patch

    with patch("app.api.routers.workspaces.refresh_cache") as mock_refresh, \
         patch("app.api.routers.workspaces.get_workspace_tree") as mock_tree:
        mock_refresh.return_value = {
            "synced_at": "2026-09-04T12:00:00Z",
            "items": [{"id": "item1", "displayName": "lh_bronze", "type": "Lakehouse"}],
            "folders": [{"id": "f1", "displayName": "AI_Test_Folder"}],
        }
        mock_tree.return_value = {"workspace_id": "test-ws", "folders": [], "root_items": []}

        # Items
        items_res = client.get("/api/workspace/items")
        assert items_res.status_code == 200
        assert "items" in items_res.json()

        # Tree
        tree_res = client.get("/api/workspace/tree")
        assert tree_res.status_code == 200
        assert tree_res.json()["status"] == "success"

        # Refresh
        refresh_res = client.post("/api/workspace/refresh", json={})
        assert refresh_res.status_code == 200
        assert refresh_res.json()["status"] == "success"
        assert refresh_res.json()["item_count"] == 1




def test_governance_impact_analysis():
    """Verifies blast-radius impact analysis route."""
    payload = {
        "operation_type": "delete_item",
        "target_name": "lh_source_bronze",
    }
    res = client.post("/api/governance/analyze", json=payload)
    assert res.status_code == 200
    assert res.json()["status"] == "success"
    assert "risk_level" in res.json()["report"]


def test_pipeline_planning_and_deploy():
    """Verifies Medallion ingestion plan creation and deployment."""
    plan_payload = {
        "source_id": "postgres",
        "selected_tables": [
            {
                "table": "customers",
                "columns": [
                    {"column": "customer_id", "type": "int", "is_primary_key": True},
                    {"column": "updated_at", "type": "timestamp"},
                ],
                "estimated_rows": 25000,
            }
        ],
        "target_lakehouse_prefix": "lh_crm",
    }
    plan_res = client.post("/api/pipeline/plan", json=plan_payload)
    assert plan_res.status_code == 200
    plan_data = plan_res.json()["plan"]

    # Deploy plan
    deploy_res = client.post("/api/pipeline/deploy", json={"plan": plan_data})
    assert deploy_res.status_code == 200
    run_id = deploy_res.json()["run_id"]

    # Check status
    status_res = client.get(f"/api/pipeline/status/{run_id}")
    assert status_res.status_code == 200
    assert status_res.json()["status"] == "completed"


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
