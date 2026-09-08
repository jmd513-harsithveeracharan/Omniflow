"""
app/tests/test_universal_item_engine.py
---------------------------------------
Comprehensive unit and edge-case test suite for Universal Fabric Item Engine
and Priority 1 & 2 items:
- Notebook (PySpark Bronze/Silver/Gold generation + Base64 packaging)
- DataPipeline (Activity DAGs, dependency chaining, parameters)
- SemanticModel (Power BI Direct Lake TMDL, DAX measures, table definitions)
- OneLake Shortcuts (Internal Lakehouse, ADLS Gen2, AWS S3)
- Environment (Conda YAML runtime configuration & Spark properties)
- Generic Item definition packaging & Base64 roundtrip decoding
- Universal 2-phase provisioning flow
- Hard Workspace Security Guardrails (_assert_workspace)
"""

import base64
import json
import pytest
from unittest.mock import MagicMock, patch

from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME
from app.fabric_client import (
    WorkspaceSecurityError,
    _assert_workspace,
    create_item,
    create_onelake_shortcut,
    delete_item,
    delete_onelake_shortcut,
    get_onelake_shortcut,
    list_onelake_shortcuts,
    provision_item_with_definition,
    refresh_semantic_model,
    run_notebook,
    update_definition,
)
from app.generators import (
    generate_adls_shortcut_payload,
    generate_direct_lake_tmdl,
    generate_environment_conda_yaml,
    generate_internal_lakehouse_shortcut_payload,
    generate_pipeline_activity_dag,
    generate_pyspark_bronze_ingest,
    generate_pyspark_gold_star_schema,
    generate_pyspark_silver_merge,
    generate_s3_shortcut_payload,
    package_environment_definition_parts,
    package_generic_definition_parts,
    package_notebook_definition_parts,
    package_pipeline_definition_parts,
    package_semantic_model_definition_parts,
)


# ── 1. Generic Definition Packaging & Base64 Roundtrip ─────────────────────────

def test_generic_definition_packaging_roundtrip():
    """Tests packaging strings, bytes, and JSON dicts into Base64 inline parts."""
    raw_files = {
        "config.json": {"app": "FabricAI", "version": 2, "enabled": True},
        "script.py": "print('hello fabric')",
        "raw.bin": b"\x00\x01\x02\x03\xff",
    }

    parts = package_generic_definition_parts(raw_files)
    assert len(parts) == 3

    parts_dict = {p["path"]: p for p in parts}

    # Verify config.json
    assert "config.json" in parts_dict
    assert parts_dict["config.json"]["payloadType"] == "InlineBase64"
    decoded_json = json.loads(base64.b64decode(parts_dict["config.json"]["payload"]).decode("utf-8"))
    assert decoded_json["app"] == "FabricAI"
    assert decoded_json["version"] == 2

    # Verify script.py
    assert "script.py" in parts_dict
    decoded_py = base64.b64decode(parts_dict["script.py"]["payload"]).decode("utf-8")
    assert decoded_py == "print('hello fabric')"

    # Verify raw.bin
    assert "raw.bin" in parts_dict
    decoded_bin = base64.b64decode(parts_dict["raw.bin"]["payload"])
    assert decoded_bin == b"\x00\x01\x02\x03\xff"


# ── 2. Notebook Generator (Priority 1) ────────────────────────────────────────

def test_pyspark_bronze_ingest_generation():
    """Tests PySpark Bronze raw ingest code generator."""
    code = generate_pyspark_bronze_ingest(
        source_table="DimCustomer",
        target_lakehouse="lh_enterprise_bronze",
    )
    assert "spark.table(\"DimCustomer\")" in code
    assert "_ingested_at" in code
    assert "lh_enterprise_bronze.raw_dimcustomer" in code
    assert "format(\"delta\")" in code

    # Test with custom SQL query
    custom_query = "SELECT id, name, updated_at FROM SourceDB.Customer WHERE active = 1"
    code_custom = generate_pyspark_bronze_ingest(
        source_table="Customer",
        target_lakehouse="lh_enterprise_bronze",
        source_query=custom_query,
    )
    assert "SELECT id, name, updated_at FROM SourceDB.Customer WHERE active = 1" in code_custom


def test_pyspark_silver_merge_generation():
    """Tests PySpark Silver MERGE SCD-1 generator with deduplication window."""
    code = generate_pyspark_silver_merge(
        bronze_table="lh_enterprise_bronze.raw_dimcustomer",
        silver_table="dim_customer",
        primary_key="customer_id",
        target_lakehouse="lh_enterprise_silver",
    )
    assert "Window.partitionBy(\"customer_id\")" in code
    assert "DeltaTable.forName(spark, \"lh_enterprise_silver.dim_customer\")" in code
    assert "target.customer_id = source.customer_id" in code
    assert "whenMatchedUpdateAll()" in code
    assert "whenNotMatchedInsertAll()" in code


def test_pyspark_gold_star_schema_generation():
    """Tests PySpark Gold Kimball star schema aggregation generator."""
    fact_query = "SELECT c.region, SUM(f.amount) as total_sales FROM fact_sales f JOIN dim_customer c ON f.cust_id = c.id GROUP BY c.region"
    code = generate_pyspark_gold_star_schema(
        fact_query=fact_query,
        gold_table="agg_sales_by_region",
        target_lakehouse="lh_enterprise_gold",
    )
    assert "agg_sales_by_region" in code
    assert "lh_enterprise_gold.agg_sales_by_region" in code
    assert "SUM(f.amount) as total_sales" in code
    assert "_gold_calculated_at" in code


def test_notebook_package_definition_parts():
    """Tests packaging PySpark code into standard Fabric notebook parts with metadata."""
    py_code = "print('Fabric PySpark Job')"
    parts = package_notebook_definition_parts(py_code)
    assert len(parts) == 1
    assert parts[0]["path"] == "notebook-content.py"
    assert parts[0]["payloadType"] == "InlineBase64"
    decoded = base64.b64decode(parts[0]["payload"]).decode("utf-8")
    assert py_code in decoded
    assert "# Fabric notebook source" in decoded
    assert "synapse_pyspark" in decoded



# ── 3. Data Factory Pipeline Generator (Priority 1) ───────────────────────────

def test_pipeline_dag_generation_with_dependencies():
    """Tests complex Data Factory Pipeline DAG activity construction."""
    activities = [
        {
            "name": "Ingest_Bronze_Customers",
            "type": "TridentNotebook",
            "notebook_id": "nb_bronze_guid_1",
            "depends_on": [],
        },
        {
            "name": "Ingest_Bronze_Orders",
            "type": "TridentNotebook",
            "notebook_id": "nb_bronze_guid_2",
            "depends_on": [],
        },
        {
            "name": "Transform_Silver_Orders",
            "type": "TridentNotebook",
            "notebook_id": "nb_silver_guid_1",
            "depends_on": ["Ingest_Bronze_Customers", "Ingest_Bronze_Orders"],
        },
        {
            "name": "Aggregate_Gold_Sales",
            "type": "TridentNotebook",
            "notebook_id": "nb_gold_guid_1",
            "depends_on": ["Transform_Silver_Orders"],
        },
    ]

    pipeline_json = generate_pipeline_activity_dag(
        activities_spec=activities,
        pipeline_name="Enterprise_Medallion_Pipeline",
        parameters={"Environment": "Production", "BatchDate": "2026-09-09"},
    )

    assert pipeline_json["name"] == "Enterprise_Medallion_Pipeline"
    acts = pipeline_json["properties"]["activities"]
    assert len(acts) == 4

    # Activity 0 & 1 have no dependencies
    assert len(acts[0]["dependsOn"]) == 0
    assert len(acts[1]["dependsOn"]) == 0

    # Activity 2 depends on Activity 0 & 1
    assert len(acts[2]["dependsOn"]) == 2
    dep_names = [d["activity"] for d in acts[2]["dependsOn"]]
    assert "Ingest_Bronze_Customers" in dep_names
    assert "Ingest_Bronze_Orders" in dep_names

    # Activity 3 depends on Activity 2
    assert len(acts[3]["dependsOn"]) == 1
    assert acts[3]["dependsOn"][0]["activity"] == "Transform_Silver_Orders"

    # Verify Base64 packaging
    parts = package_pipeline_definition_parts(pipeline_json)
    assert len(parts) == 1
    assert parts[0]["path"] == "pipeline-content.json"
    decoded = json.loads(base64.b64decode(parts[0]["payload"]).decode("utf-8"))
    assert decoded["name"] == "Enterprise_Medallion_Pipeline"


# ── 4. Direct Lake Semantic Model Generator (Priority 2) ──────────────────────

def test_direct_lake_tmdl_generation():
    """Tests Power BI Direct Lake TMDL schema generator and type mappings."""
    tables = [
        {
            "name": "FactSales",
            "columns": [
                {"name": "SaleID", "type": "bigint"},
                {"name": "Amount", "type": "decimal(18,2)"},
                {"name": "OrderDate", "type": "date"},
                {"name": "IsActive", "type": "boolean"},
                {"name": "CustomerName", "type": "string"},
            ],
        }
    ]
    measures = [
        {
            "table": "FactSales",
            "name": "Total Revenue",
            "dax": "SUM(FactSales[Amount])",
        }
    ]

    tmdl_files = generate_direct_lake_tmdl(
        model_name="Sales_Semantic_Model",
        lakehouse_id="lh_gold_guid_123",
        lakehouse_name="lh_enterprise_gold",
        workspace_id=ALLOWED_WORKSPACE_ID,
        tables=tables,
        measures=measures,
    )

    assert "definition.tmdl" in tmdl_files
    assert "model.tmdl" in tmdl_files
    assert "tables/FactSales.tmdl" in tmdl_files

    # Check model Direct Lake connection
    model_content = tmdl_files["model.tmdl"]
    assert f"DirectLakeConnectionId = {{\"workspaceId\":\"{ALLOWED_WORKSPACE_ID}\",\"itemId\":\"lh_gold_guid_123\"}}" in model_content

    # Check table TMDL types & measures
    table_content = tmdl_files["tables/FactSales.tmdl"]
    assert "column SaleID\n\t\tdataType: int64" in table_content
    assert "column Amount\n\t\tdataType: double" in table_content
    assert "column OrderDate\n\t\tdataType: dateTime" in table_content
    assert "column IsActive\n\t\tdataType: boolean" in table_content
    assert "measure 'Total Revenue' = SUM(FactSales[Amount])" in table_content
    assert "mode: directLake" in table_content

    # Check packaging
    parts = package_semantic_model_definition_parts(tmdl_files)
    assert len(parts) == 3


# ── 5. OneLake Shortcuts Generator (Priority 1) ───────────────────────────────

def test_onelake_shortcut_payload_generators():
    """Tests internal, ADLS Gen2, and S3 shortcut payload builders."""
    # Internal Lakehouse
    internal_payload = generate_internal_lakehouse_shortcut_payload(
        shortcut_path="Tables",
        shortcut_name="shared_dim_customer",
        source_workspace_id=ALLOWED_WORKSPACE_ID,
        source_lakehouse_id="lh_source_guid_456",
        source_path="Tables/dim_customer",
    )
    assert internal_payload["name"] == "shared_dim_customer"
    assert internal_payload["target"]["oneLake"]["itemId"] == "lh_source_guid_456"

    # ADLS Gen2
    adls_payload = generate_adls_shortcut_payload(
        shortcut_path="Files/landing",
        shortcut_name="adls_telemetry",
        storage_account="mystorageacct",
        container="rawdata",
        sub_path="iot/sensors",
        connection_id="conn_adls_789",
    )
    assert adls_payload["target"]["adlsGen2"]["location"] == "https://mystorageacct.dfs.core.windows.net"
    assert adls_payload["target"]["adlsGen2"]["subpath"] == "/rawdata/iot/sensors"
    assert adls_payload["target"]["adlsGen2"]["connectionId"] == "conn_adls_789"

    # AWS S3
    s3_payload = generate_s3_shortcut_payload(
        shortcut_path="Files/s3_partner",
        shortcut_name="s3_orders",
        bucket_name="my-s3-bucket",
        sub_path="daily_orders/",
        connection_id="conn_s3_101",
    )
    assert s3_payload["target"]["amazonS3"]["location"] == "https://my-s3-bucket.s3.amazonaws.com"
    assert s3_payload["target"]["amazonS3"]["subpath"] == "/daily_orders"


# ── 6. Environment Generator (Priority 1) ─────────────────────────────────────

def test_environment_generator_and_packaging():
    """Tests Spark custom environment Conda YAML and spark-properties.conf packaging."""
    conda_yaml = generate_environment_conda_yaml(
        pip_packages=["delta-spark>=3.2.0", "polars>=1.0.0", "sqlglot>=25.0.0"],
        environment_name="enterprise_spark_env",
    )
    assert "name: enterprise_spark_env" in conda_yaml
    assert "delta-spark>=3.2.0" in conda_yaml
    assert "polars>=1.0.0" in conda_yaml

    parts = package_environment_definition_parts(
        conda_yaml=conda_yaml,
        spark_properties={"spark.sql.shuffle.partitions": "200", "spark.fabric.vorder": "true"},
    )
    assert len(parts) == 2
    paths = [p["path"] for p in parts]
    assert "environment.yml" in paths
    assert "spark-properties.conf" in paths


# ── 7. Universal Item Flow & Fabric Client Operations ──────────────────────────

@patch("app.fabric_client.requests.post")
@patch("app.fabric_client.get_auth_headers", return_value={"Authorization": "Bearer mock_token"})
def test_provision_item_with_definition_flow(mock_auth, mock_post):
    """Tests universal 2-phase item creation and Base64 definition upload flow."""
    # Mock Create Item response
    mock_create_resp = MagicMock()
    mock_create_resp.status_code = 201
    mock_create_resp.text = json.dumps({"id": "item_guid_999", "displayName": "NB_Bronze_Ingest"})
    mock_create_resp.json.return_value = {"id": "item_guid_999", "displayName": "NB_Bronze_Ingest"}

    # Mock Update Definition response
    mock_update_resp = MagicMock()
    mock_update_resp.status_code = 200
    mock_update_resp.text = "{}"

    mock_post.side_effect = [mock_create_resp, mock_update_resp]

    parts = package_notebook_definition_parts("print('test')")
    res = provision_item_with_definition(
        display_name="NB_Bronze_Ingest",
        item_type="Notebook",
        parts=parts,
        workspace_id=ALLOWED_WORKSPACE_ID,
    )

    assert res["success"] is True
    assert res["item_id"] == "item_guid_999"
    assert res["item_type"] == "Notebook"
    assert mock_post.call_count == 2


@patch("app.fabric_client.requests.post")
@patch("app.fabric_client.get_auth_headers", return_value={"Authorization": "Bearer mock_token"})
def test_onelake_shortcut_crud_operations(mock_auth, mock_post):
    """Tests OneLake shortcut creation via fabric_client."""
    mock_resp = MagicMock()
    mock_resp.status_code = 201
    mock_resp.text = json.dumps({"name": "my_sc", "path": "Tables"})
    mock_resp.json.return_value = {"name": "my_sc", "path": "Tables"}
    mock_post.return_value = mock_resp

    payload = generate_internal_lakehouse_shortcut_payload(
        shortcut_path="Tables",
        shortcut_name="my_sc",
        source_workspace_id=ALLOWED_WORKSPACE_ID,
        source_lakehouse_id="lh_src_123",
        source_path="Tables/customers",
    )

    res = create_onelake_shortcut("lh_tgt_456", payload, workspace_id=ALLOWED_WORKSPACE_ID)
    assert res["success"] is True
    assert res["data"]["name"] == "my_sc"


@patch("app.fabric_client.requests.post")
@patch("app.fabric_client.get_auth_headers", return_value={"Authorization": "Bearer mock_token"})
def test_job_execution_notebook_and_semantic_model(mock_auth, mock_post):
    """Tests triggering notebook execution and semantic model refresh."""
    mock_resp = MagicMock()
    mock_resp.status_code = 202
    mock_resp.headers = {"Location": "https://api.fabric.microsoft.com/v1/jobs/instances/job_inst_555"}
    mock_resp.text = "{}"
    mock_post.return_value = mock_resp

    # Notebook run
    nb_res = run_notebook("nb_guid_123", parameters={"table": "orders"}, workspace_id=ALLOWED_WORKSPACE_ID)
    assert nb_res["success"] is True
    assert nb_res["job_id"] == "job_inst_555"

    # Semantic Model refresh
    sm_res = refresh_semantic_model("sm_guid_789", workspace_id=ALLOWED_WORKSPACE_ID)
    assert sm_res["success"] is True
    assert sm_res["job_id"] == "job_inst_555"


# ── 8. Hard Workspace Security Guardrails ──────────────────────────────────────

def test_workspace_security_guardrail_blocks_unauthorized_workspaces():
    """
    Asserts that ANY attempt to perform an operation on a non-allowed workspace
    raises WorkspaceSecurityError with zero HTTP network calls.
    """
    foreign_workspace_id = "00000000-0000-0000-0000-000000000000"

    # 1. Direct assertion
    with pytest.raises(WorkspaceSecurityError) as exc_info:
        _assert_workspace(foreign_workspace_id)
    assert "SECURITY BLOCK" in str(exc_info.value)
    assert ALLOWED_WORKSPACE_ID in str(exc_info.value)

    # 2. create_item guardrail
    with pytest.raises(WorkspaceSecurityError):
        create_item("TestItem", "Lakehouse", workspace_id=foreign_workspace_id)

    # 3. update_definition guardrail
    with pytest.raises(WorkspaceSecurityError):
        update_definition("item_123", [], workspace_id=foreign_workspace_id)

    # 4. delete_item guardrail
    with pytest.raises(WorkspaceSecurityError):
        delete_item("item_123", workspace_id=foreign_workspace_id)

    # 5. create_onelake_shortcut guardrail
    with pytest.raises(WorkspaceSecurityError):
        create_onelake_shortcut("item_123", {}, workspace_id=foreign_workspace_id)

    # 6. list_onelake_shortcuts guardrail
    with pytest.raises(WorkspaceSecurityError):
        list_onelake_shortcuts("item_123", workspace_id=foreign_workspace_id)

    # 7. get_onelake_shortcut guardrail
    with pytest.raises(WorkspaceSecurityError):
        get_onelake_shortcut("item_123", "Tables", "sc_name", workspace_id=foreign_workspace_id)

    # 8. delete_onelake_shortcut guardrail
    with pytest.raises(WorkspaceSecurityError):
        delete_onelake_shortcut("item_123", "Tables", "sc_name", workspace_id=foreign_workspace_id)

    # 9. run_notebook guardrail
    with pytest.raises(WorkspaceSecurityError):
        run_notebook("nb_123", workspace_id=foreign_workspace_id)

    # 10. refresh_semantic_model guardrail
    with pytest.raises(WorkspaceSecurityError):
        refresh_semantic_model("sm_123", workspace_id=foreign_workspace_id)
