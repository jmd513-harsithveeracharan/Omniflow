"""
tests/test_compiler_and_deployment_phase2.py
--------------------------------------------
Integration and verification tests for:
- Universal Fabric Compiler (all Phase 2 items)
- Heuristic DAG parser & flow node builder
- Deployment Executor with multi-phase items
"""

from unittest.mock import MagicMock, patch
import pytest

from app.agent_pipeline import _heuristic_dag, _run_builder
from app.deployment_executor import deploy_fabric_plan
from app.fabric_compiler import (
    compile_dataflow,
    compile_kql_queryset,
    compile_mirrored_database,
    compile_ml_experiment,
    compile_ml_model,
    compile_reflex,
    compile_spark_job_definition,
)


from app.config import ALLOWED_WORKSPACE_ID


@pytest.fixture
def mock_auth():
    with patch("app.fabric_client.get_auth_headers", return_value={"Authorization": "Bearer mock-token"}):
        yield


def test_compiler_phase2_items():
    """Verifies that all Phase 2 items compile into valid Base64 multi-part payloads."""
    # 1. KQL Queryset
    kq_payload = compile_kql_queryset("kq_devices", target_db="kql_iot_db")
    assert kq_payload["type"] == "KQLQueryset"
    assert len(kq_payload["definition"]["parts"]) == 4  # queryset.kql, queryset.json, item.metadata.json, .platform

    # 2. Dataflow Gen2
    df_payload = compile_dataflow("df_bronze_ingest", lakehouse_name="lh_bronze")
    assert df_payload["type"] == "Dataflow"
    assert len(df_payload["definition"]["parts"]) == 4

    # 3. Reflex
    rfx_payload = compile_reflex("rfx_sla_alerts")
    assert rfx_payload["type"] == "Reflex"
    assert len(rfx_payload["definition"]["parts"]) == 3

    # 4. Spark Job Definition
    sjd_payload = compile_spark_job_definition("sjd_nightly_etl", lakehouse_name="lh_gold")
    assert sjd_payload["type"] == "SparkJobDefinition"
    assert len(sjd_payload["definition"]["parts"]) == 4

    # 5. Mirrored Database
    mir_payload = compile_mirrored_database("mir_sales_sql")
    assert mir_payload["type"] == "MirroredDatabase"
    assert len(mir_payload["definition"]["parts"]) == 3

    # 6. ML Experiment & Model
    exp_payload = compile_ml_experiment("mlexp_fraud_detection")
    assert exp_payload["type"] == "MLExperiment"
    assert len(exp_payload["definition"]["parts"]) == 3

    mod_payload = compile_ml_model("mlmod_fraud_xgb")
    assert mod_payload["type"] == "MLModel"
    assert len(mod_payload["definition"]["parts"]) == 3


def test_heuristic_dag_and_builder_phase2():
    """Verifies that heuristic DAG extraction and flow node builder handle all granular item types."""
    prompt = (
        "Create folder EnterpriseAnalytics with lh_bronze, wh_finance_edw, mir_crm_db, "
        "kql_telemetry, kq_anomalies, es_iot_events, df_powerquery_raw, "
        "nb_gold_calc, sjd_batch_job, rfx_alert_trigger, sm_sales_model, "
        "rpt_executive_dashboard, gql_data_api, mlexp_churn_model and pipeline pl_daily_run at 3AM"
    )
    dag = _heuristic_dag(prompt)

    step_types = [s.type for s in dag.steps]
    assert "folder" in step_types
    assert "lakehouse" in step_types
    assert "warehouse" in step_types
    assert "mirrored_db" in step_types
    assert "kql_database" in step_types
    assert "kql_queryset" in step_types
    assert "eventstream" in step_types
    assert "dataflow" in step_types
    assert "notebook" in step_types
    assert "spark_job" in step_types
    assert "reflex" in step_types
    assert "semantic_model" in step_types
    assert "report" in step_types
    assert "graphql_api" in step_types
    assert "ml_experiment" in step_types
    assert "pipeline" in step_types

    plan = _run_builder(dag, {}, run_id="test_run_123")
    assert plan["folder"] == "EnterpriseAnalytics"
    assert len(plan["flow_nodes"]) >= 15
    assert len(plan["flow_edges"]) >= 10

    node_types = [n["type"] for n in plan["flow_nodes"]]
    assert "lakehouse" in node_types
    assert "warehouse" in node_types
    assert "mirrored_db" in node_types
    assert "dataflow" in node_types
    assert "spark_job" in node_types
    assert "reflex" in node_types


def test_deployment_executor_phase2_items(mock_auth):
    """Verifies that deploy_fabric_plan provisions Phase 2 items cleanly."""
    plan = {
        "folder": "Phase2_Test_Folder",
        "mirrored_databases": [{"name": "mir_sql_sales"}],
        "kql_querysets": [{"name": "kq_metrics", "database": "kql_telemetry"}],
        "dataflows": [{"name": "df_orders"}],
        "spark_job_definitions": [{"name": "sjd_batch"}],
        "reflexes": [{"name": "rfx_alerts"}],
        "ml_experiments": [{"name": "mlexp_forecast"}],
    }

    with patch("app.deployment_executor.get_or_create_folder", return_value="fld-123"), \
         patch("app.deployment_executor.provision_item_with_definition") as mock_prov:
        
        mock_prov.return_value = {"success": True, "item_id": "item-mock-id"}
        
        report = deploy_fabric_plan(plan, workspace_id=ALLOWED_WORKSPACE_ID)

        assert report.status == "completed"
        assert report.folder_id == "fld-123"
        deployed_types = [item.item_type for item in report.deployed_items]
        assert "folder" in deployed_types
        assert "mirrored_database" in deployed_types
        assert "kql_queryset" in deployed_types
        assert "dataflow" in deployed_types
        assert "spark_job_definition" in deployed_types
        assert "reflex" in deployed_types
        assert "ml_experiment" in deployed_types
        assert len(report.errors) == 0
