"""
tests/test_granular_generators_phase2.py
-----------------------------------------
Unit tests for Phase 2 granular item generators:
- KQLQueryset (.kql analytical scripts & anomaly detection)
- Dataflow Gen2 (Power Query M mashup.pq)
- Reflex / Data Activator (rules, thresholds, actions)
- Spark Job Definition (Main.py & properties)
- Mirrored Database (CDC OneLake replication)
- ML Experiment & ML Model (MLflow tracking & registry)
"""

import base64
import json
import pytest

from app.generators.dataflow_gen import (
    generate_powerquery_mashup,
    package_dataflow_definition_parts,
)
from app.generators.kql_queryset_gen import (
    generate_kql_queryset_script,
    package_kql_queryset_definition_parts,
)
from app.generators.mirroring_gen import (
    generate_mirroring_config,
    package_mirrored_database_definition_parts,
)
from app.generators.ml_gen import (
    generate_ml_experiment_definition,
    generate_ml_model_definition,
    package_ml_experiment_definition_parts,
    package_ml_model_definition_parts,
)
from app.generators.reflex_gen import (
    generate_reflex_rules,
    package_reflex_definition_parts,
)
from app.generators.spark_job_gen import (
    generate_spark_job_main_py,
    package_spark_job_definition_parts,
)


def _b64_decode(b64_str: str) -> str:
    return base64.b64decode(b64_str).decode("utf-8")


def test_kql_queryset_generator():
    """Verifies KQL Queryset analytical queries, anomaly detection, and definition packaging."""
    script = generate_kql_queryset_script(
        queryset_name="kq_telemetry",
        target_kql_database="kql_iot_hub",
        table_names=["DeviceSensors"],
    )
    assert "DeviceSensors" in script
    assert "series_decompose_anomalies" in script
    assert "render anomalychart" in script

    parts = package_kql_queryset_definition_parts("kq_telemetry", script, kql_database_name="kql_iot_hub")
    assert len(parts) == 2
    paths = [p["path"] for p in parts]
    assert "queryset.kql" in paths
    assert "queryset.json" in paths

    # Verify queryset.json roundtrip
    q_json_part = next(p for p in parts if p["path"] == "queryset.json")
    meta = json.loads(_b64_decode(q_json_part["payload"]))
    assert meta["databaseReference"]["databaseName"] == "kql_iot_hub"


def test_dataflow_mashup_generator():
    """Verifies Power Query M-code mashup generation and Base64 definition packaging."""
    mashup = generate_powerquery_mashup(
        dataflow_name="df_sales_raw",
        target_lakehouse_name="lh_bronze",
        target_table_name="orders_ingest",
        columns=[
            {"name": "order_id", "type": "Int64.Type"},
            {"name": "total", "type": "Double.Type"},
        ],
    )
    assert "section Section1;" in mashup
    assert "Table.TransformColumnTypes" in mashup
    assert "DateTimeZone.UtcNow()" in mashup
    assert "orders_ingest" in mashup

    parts = package_dataflow_definition_parts("df_sales_raw", mashup, target_lakehouse_name="lh_bronze")
    assert len(parts) == 2
    paths = [p["path"] for p in parts]
    assert "mashup.pq" in paths
    assert "dataflow-template.json" in paths

    pq_part = next(p for p in parts if p["path"] == "mashup.pq")
    assert _b64_decode(pq_part["payload"]) == mashup


def test_reflex_data_activator_generator():
    """Verifies Data Activator rule generation, condition thresholds, and webhook packaging."""
    cfg = generate_reflex_rules(
        reflex_name="rfx_sales_monitor",
        rules=[
            {
                "rule_name": "HighValueOrderSpike",
                "event_stream_or_table": "LiveOrders",
                "column_name": "amount",
                "condition": "GreaterThan",
                "threshold_value": 10000.0,
                "action_type": "TeamsNotification",
                "action_target": "https://webhook.teams.microsoft.com/alerts",
            }
        ],
    )
    assert cfg["reflexName"] == "rfx_sales_monitor"
    assert len(cfg["triggers"]) == 1
    assert cfg["triggers"][0]["condition"]["threshold"] == 10000.0

    parts = package_reflex_definition_parts("rfx_sales_monitor", cfg)
    assert len(parts) == 1
    assert parts[0]["path"] == "reflex.json"
    decoded = json.loads(_b64_decode(parts[0]["payload"]))
    assert decoded["reflexName"] == "rfx_sales_monitor"


def test_spark_job_definition_generator():
    """Verifies batch Spark Job Definition Main.py generation and cluster properties packaging."""
    main_py = generate_spark_job_main_py("sjd_nightly_batch", target_lakehouse="lh_gold")
    assert "SparkSession.builder" in main_py
    assert "lh_silver.fact_sales" in main_py
    assert "lh_gold.dim_customer_metrics" in main_py
    assert "argparse.ArgumentParser" in main_py

    parts = package_spark_job_definition_parts("sjd_nightly_batch", main_py, default_lakehouse_name="lh_gold")
    assert len(parts) == 2
    paths = [p["path"] for p in parts]
    assert "Main.py" in paths
    assert "SparkJobDefinitionProperties.json" in paths

    prop_part = next(p for p in parts if p["path"] == "SparkJobDefinitionProperties.json")
    props = json.loads(_b64_decode(prop_part["payload"]))
    assert props["executableFile"] == "Main.py"
    assert props["defaultLakehouseArtifactId"] == "lh_gold"


def test_mirrored_database_generator():
    """Verifies Mirrored Database CDC replication configuration and definition packaging."""
    cfg = generate_mirroring_config(
        database_name="mir_sql_prod",
        source_type="AzureSqlDatabase",
        server_address="prod-sql.database.windows.net",
        source_database_name="SalesDB",
    )
    assert cfg["mirroredDatabaseName"] == "mir_sql_prod"
    assert cfg["sourceConnection"]["type"] == "AzureSqlDatabase"
    assert len(cfg["tables"]) == 3

    parts = package_mirrored_database_definition_parts("mir_sql_prod", cfg)
    assert len(parts) == 1
    assert parts[0]["path"] == "mirroring.json"
    decoded = json.loads(_b64_decode(parts[0]["payload"]))
    assert decoded["replicationSettings"]["targetFormat"] == "DeltaLake"


def test_ml_experiment_and_model_generator():
    """Verifies Synapse ML Experiment & Model definition parts generation."""
    exp_cfg = generate_ml_experiment_definition("mlexp_churn_model", description="Customer Churn MLflow")
    exp_parts = package_ml_experiment_definition_parts("mlexp_churn_model", exp_cfg)
    assert len(exp_parts) == 1
    assert exp_parts[0]["path"] == "experiment.json"

    mod_cfg = generate_ml_model_definition("mlmod_churn_classifier", flavor="spark")
    mod_parts = package_ml_model_definition_parts("mlmod_churn_classifier", mod_cfg)
    assert len(mod_parts) == 1
    assert mod_parts[0]["path"] == "model.json"
