"""
tests/test_agent_pipeline_granular.py
-------------------------------------
End-to-end integration and unit tests for the Granular Fabric Items,
Direct Lake TMDL compilation, OneLake shortcuts, Universal Deployment Engine,
and automated cyclic self-healing loop.
"""

from unittest.mock import MagicMock, patch
import pytest
from fastapi.testclient import TestClient

from api_server import app
from app.config import ALLOWED_WORKSPACE_ID
from app.deployment_executor import (
    deploy_fabric_plan,
    _deploy_notebook_with_healing,
)
from app.fabric_compiler import (
    compile_environment,
    compile_lakehouse,
    compile_notebook,
    compile_pipeline,
    compile_semantic_model,
)
from app.generators.environment_gen import generate_environment_conda_yaml
from app.generators.semantic_gen import (
    generate_direct_lake_tmdl,
    package_semantic_model_definition_parts,
)
from app.generators.shortcut_gen import (
    generate_adls_shortcut_payload,
    generate_internal_lakehouse_shortcut_payload,
    generate_s3_shortcut_payload,
)
from app.agent_pipeline import _heuristic_dag, _run_builder


@pytest.fixture
def mock_auth():
    with patch("app.fabric_client.get_auth_headers", return_value={"Authorization": "Bearer mock-token"}):
        yield


def test_generators_direct_lake_tmdl():
    """Verifies generation of TMDL files and packaging for Power BI Direct Lake."""
    tmdl = generate_direct_lake_tmdl(
        model_name="SalesDirectLakeModel",
        lakehouse_id="lh-12345",
        lakehouse_name="lh_sales_gold",
        workspace_id="ws-99999",
        tables=[
            {
                "name": "FactOrders",
                "columns": [
                    {"name": "order_id", "type": "int"},
                    {"name": "amount", "type": "double"},
                    {"name": "order_date", "type": "date"},
                ],
            }
        ],
        measures=[{"table": "FactOrders", "name": "TotalRevenue", "dax": "SUM(FactOrders[amount])"}],
    )

    assert "definition.tmdl" in tmdl
    assert "model.tmdl" in tmdl
    assert "tables/FactOrders.tmdl" in tmdl
    assert "DirectLakeConnectionId" in tmdl["model.tmdl"]
    assert "mode: directLake" in tmdl["tables/FactOrders.tmdl"]
    assert "TotalRevenue" in tmdl["tables/FactOrders.tmdl"]

    parts = package_semantic_model_definition_parts(tmdl)
    assert len(parts) == 3
    for part in parts:
        assert part["payloadType"] == "InlineBase64"
        assert len(part["payload"]) > 10


def test_generators_onelake_shortcuts():
    """Verifies generation of Lakehouse internal, ADLS Gen2, and S3 shortcut payloads."""
    # Internal Lakehouse shortcut
    lh_sc = generate_internal_lakehouse_shortcut_payload(
        shortcut_path="Tables",
        shortcut_name="dim_customer",
        source_workspace_id="ws-src",
        source_lakehouse_id="lh-src",
        source_path="Tables/dim_customer",
    )
    assert lh_sc["name"] == "dim_customer"
    assert lh_sc["target"]["oneLake"]["workspaceId"] == "ws-src"

    # ADLS shortcut
    adls_sc = generate_adls_shortcut_payload(
        shortcut_path="Files/raw",
        shortcut_name="adls_logs",
        storage_account="datalakeacc",
        container="telemetry",
        sub_path="/2026/09",
    )
    assert adls_sc["name"] == "adls_logs"
    assert "datalakeacc.dfs.core.windows.net" in adls_sc["target"]["adlsGen2"]["location"]

    # S3 shortcut
    s3_sc = generate_s3_shortcut_payload(
        shortcut_path="Files/s3",
        shortcut_name="s3_landing",
        bucket_name="enterprise-s3-bucket",
        sub_path="landing/orders",
    )
    assert s3_sc["name"] == "s3_landing"
    assert "enterprise-s3-bucket.s3.amazonaws.com" in s3_sc["target"]["amazonS3"]["location"]


def test_generators_environment_conda():
    """Verifies generation of custom Conda environment YAML specification."""
    yaml_content = generate_environment_conda_yaml(
        environment_name="pyspark_analytics_env",
        extra_pip_packages=["xgboost>=1.7.0", "statsmodels"],
        python_version="3.10",
    )
    assert "name: pyspark_analytics_env" in yaml_content
    assert "python=3.10" in yaml_content
    assert "xgboost>=1.7.0" in yaml_content
    assert "statsmodels" in yaml_content


def test_agent_pipeline_heuristic_granular_dag():
    """Verifies that heuristic DAG extracts notebooks, lakehouses, models, and environments."""
    prompt = (
        "Create project folder Data_Hub with lh_bronze, lh_gold, "
        "notebooks nb_ingest and nb_transform, environment env_ml, "
        "direct lake model sm_sales_model, and schedule pl_sync daily at 04:00"
    )
    dag = _heuristic_dag(prompt)
    assert dag.folder == "Data_Hub"
    types = [s.type for s in dag.steps]
    assert "lakehouse" in types
    assert "notebook" in types
    assert "environment" in types
    assert "semantic_model" in types

    # Verify run builder builds flow nodes and edges for all items
    worker_results = {
        "step_nb_ingest": MagicMock(pyspark="# Ingest code", delta_schema=[]),
        "step_nb_transform": MagicMock(pyspark="# Transform code", delta_schema=[]),
    }
    plan = _run_builder(dag, worker_results, run_id="run_test_01")
    assert len(plan["flow_nodes"]) >= 5
    assert len(plan["flow_edges"]) >= 4
    assert "sm_sales_model" in plan["semantic_models"]


def test_deployment_executor_full_plan_mocked(mock_auth):
    """Verifies that deploy_fabric_plan correctly orchestrates all granular items."""
    plan = {
        "run_id": "run_test_full",
        "folder": "AI_Test_Folder",
        "environments": [{"name": "env_spark", "packages": ["scipy"]}],
        "lakehouses": ["lh_test_bronze", "lh_test_gold"],
        "notebooks": [
            {"name": "nb_bronze_ingest", "pyspark_code": "print('ingest')"},
            {"name": "nb_gold_agg", "pyspark_code": "print('gold')"},
        ],
        "semantic_models": [{"name": "sm_gold_model", "lakehouse_name": "lh_test_gold"}],
        "shortcuts": [
            {
                "name": "sc_bronze_link",
                "lakehouse_name": "lh_test_gold",
                "payload": {"name": "sc_bronze_link", "path": "Tables", "target": {"oneLake": {}}},
            }
        ],
        "pipeline": {"name": "pl_full_sync", "schedule": {"cron": "0 2 * * *", "time_str": "02:00"}},
    }

    with patch("app.deployment_executor.get_or_create_folder", return_value="fld-1234"), \
         patch("app.deployment_executor.provision_item_with_definition") as mock_prov, \
         patch("app.deployment_executor.create_onelake_shortcut", return_value={"success": True}), \
         patch("app.deployment_executor.create_pipeline_schedule", return_value={"success": True}):

        # Mock successful responses for each provisioned item
        mock_prov.side_effect = lambda display_name, item_type, **kwargs: {
            "success": True,
            "item_id": f"id_{item_type.lower()}_{display_name}",
        }

        report = deploy_fabric_plan(plan, workspace_id=ALLOWED_WORKSPACE_ID)

        assert report.status == "completed"
        assert report.folder_id == "fld-1234"
        assert len(report.errors) == 0
        deployed_names = [i.name for i in report.deployed_items]
        assert "AI_Test_Folder" in deployed_names
        assert "env_spark" in deployed_names
        assert "lh_test_bronze" in deployed_names
        assert "lh_test_gold" in deployed_names
        assert "nb_bronze_ingest" in deployed_names
        assert "nb_gold_agg" in deployed_names
        assert "sm_gold_model" in deployed_names
        assert "sc_bronze_link" in deployed_names
        assert "pl_full_sync" in deployed_names


def test_deployment_executor_self_healing(mock_auth):
    """Verifies that notebook deployment failures trigger cyclic self-healing recovery."""
    attempts = 0

    def mock_provision(display_name, item_type, parts=None, **kwargs):
        nonlocal attempts
        attempts += 1
        if attempts == 1:
            return {"success": False, "error": "AnalysisException: Table not found 'raw_data'"}
        return {"success": True, "item_id": "nb-healed-id"}

    with patch("app.deployment_executor.provision_item_with_definition", side_effect=mock_provision), \
         patch("app.deployment_executor.diagnose_and_patch_code", return_value={
             "success": True,
             "patched_code": "# Patched code\nspark.read.table('lh_bronze.raw_data')",
             "diagnosis": {"root_cause": "Fixed table reference"},
         }):

        step = _deploy_notebook_with_healing(
            name="nb_test_healing",
            pyspark_code="# Failing code\nspark.read.table('raw_data')",
            folder_id="fld-1",
            workspace_id=ALLOWED_WORKSPACE_ID,
            max_retries=2,
        )

        assert step.status == "healed"
        assert step.item_id == "nb-healed-id"
        assert step.retry_count == 1
        assert attempts == 2


def test_api_fabric_deploy_endpoint(mock_auth):
    """Verifies the /api/fabric/deploy FastAPI endpoint returns structured deployment response."""
    client = TestClient(app)
    sample_plan = {
        "run_id": "run_api_test",
        "folder": "AI_Test_Folder",
        "lakehouses": ["lh_api_lakehouse"],
        "notebooks": [{"name": "nb_api_task", "pyspark_code": "print(1)"}],
    }

    with patch("app.deployment_executor.get_or_create_folder", return_value="fld-api"), \
         patch("app.deployment_executor.provision_item_with_definition", return_value={"success": True, "item_id": "item-api-01"}):

        resp = client.post("/api/fabric/deploy", json={"plan": sample_plan})
        assert resp.status_code == 200
        data = resp.json()
        assert data["status"] == "success"
        assert data["run_id"] == "run_api_test"
        assert len(data["deployed_items"]) >= 3  # folder, lakehouse, notebook
