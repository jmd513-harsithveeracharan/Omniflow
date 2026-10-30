"""
tests/test_connectors_interceptor.py
-----------------------------------
Automated tests for Microsoft Fabric Connector Interceptor, Zero-Secret Leakage Vault,
and On-The-Fly Dynamic Python Schema Inspection.
"""

import pytest
from omniflow.connectors_interceptor import (
    detect_connector_need,
    execute_source_inspection,
    generate_python_inspector_script,
    CONNECTOR_REGISTRY,
    CONNECTIONS_VAULT,
)


def test_connector_registry_definitions():
    assert "sap" in CONNECTOR_REGISTRY
    assert "salesforce" in CONNECTOR_REGISTRY
    assert "postgres" in CONNECTOR_REGISTRY
    assert "snowflake" in CONNECTOR_REGISTRY
    assert "dummy_sandbox" in CONNECTOR_REGISTRY

    sap_def = CONNECTOR_REGISTRY["sap"]
    assert sap_def.name == "SAP HANA / S/4HANA & ECC"
    assert any(p.key == "password" and p.type == "password" for p in sap_def.required_params)
    assert len(sap_def.mock_tables) > 0


def test_detect_connector_need():
    # Prompt requiring SAP
    res = detect_connector_need("Connect to SAP ERP and build medallion pipeline")
    assert res is not None
    assert res.connector_type == "sap"

    # Prompt requiring Salesforce
    res_sf = detect_connector_need("Integrate Salesforce CRM tables with Bronze lakehouse")
    assert res_sf is not None
    assert res_sf.connector_type == "salesforce"

    # Prompt requiring Postgres
    res_pg = detect_connector_need("Ingest data from postgres database into Fabric")
    assert res_pg is not None
    assert res_pg.connector_type == "postgres"

    # When prompt already includes a verified connectionId, it should NOT halt!
    res_resumed = detect_connector_need("Resume pipeline synthesis with connectionId 'conn_sap_1234' for tables: VBAK, VBAP")
    assert res_resumed is None


def test_execute_source_inspection_zero_leakage():
    params = {
        "host": "sap-s4hana.enterprise.internal",
        "client_id": "800",
        "username": "RFC_USER",
        "password": "SUPER_SECRET_PASSWORD_12345!",
    }

    result = execute_source_inspection("sap", params, test_mode=True)

    assert result["status"] == "success"
    conn_id = result["connection_id"]
    assert conn_id.startswith("conn_sap_")
    assert conn_id in CONNECTIONS_VAULT

    # Verify vault contains original params for execution
    assert CONNECTIONS_VAULT[conn_id]["params"]["password"] == "SUPER_SECRET_PASSWORD_12345!"

    # Verify returned python inspection code REDACTS passwords
    py_code = result["python_inspector_code"]
    assert "SUPER_SECRET_PASSWORD_12345!" not in py_code
    assert "VBAK" in py_code or "inspect_sap_catalog" in py_code

    # Verify discovered tables returned
    tables = result["discovered_tables"]
    table_names = [t["name"] for t in tables]
    assert "VBAK" in table_names
    assert "VBAP" in table_names
    assert "MARA" in table_names


def test_dummy_sandbox_inspection():
    params = {
        "cluster_name": "demo-cluster.fabric-sandbox.io",
        "database": "sandbox_sales",
        "api_token": "demo-secret-token",
    }
    result = execute_source_inspection("dummy_sandbox", params, test_mode=True)
    assert result["status"] == "success"
    assert result["connection_id"].startswith("conn_dummy_sandbox_")
    table_names = [t["name"] for t in result["discovered_tables"]]
    assert "customers" in table_names
    assert "orders" in table_names


def test_dynamic_non_native_source_synthesis():
    from omniflow.connectors_catalog import classify_source_pathway, synthesize_dynamic_connector, IngestionPathway
    from omniflow.connectors_interceptor import detect_connector_need

    # 1. Stripe is not native in Fabric -> PySpark Notebook Ingestion
    is_native, pathway, expl = classify_source_pathway("stripe")
    assert is_native is False
    assert pathway == IngestionPathway.PYSPARK_NOTEBOOK
    assert "PySpark Ingestion Notebook" in expl

    # 2. Dynamic synthesis creates API fields
    conn = synthesize_dynamic_connector("Stripe")
    assert conn.connector_type == "stripe"
    assert conn.pathway == IngestionPathway.PYSPARK_NOTEBOOK
    assert conn.is_fabric_native is False
    field_keys = [f.key for f in conn.required_params]
    assert "endpoint_url" in field_keys
    assert "api_key" in field_keys

    # 3. Detection from prompt dynamically synthesizes Workday
    c_workday = detect_connector_need("Connect to Workday and extract employee records")
    assert c_workday is not None
    assert c_workday.connector_type == "workday"
    assert c_workday.is_fabric_native is False
    assert c_workday.pathway == IngestionPathway.PYSPARK_NOTEBOOK


def test_api_connectors_endpoints():
    from fastapi.testclient import TestClient
    from omniflow.server import app

    client = TestClient(app)

    # 1. Definitions endpoint
    res_def = client.get("/api/connectors/definitions")
    assert res_def.status_code == 200
    defs = res_def.json()
    types = [d["connector_type"] for d in defs]
    assert "sap" in types
    assert "dummy_sandbox" in types

    # 2. Provision and inspect endpoint
    res_insp = client.post(
        "/api/connectors/provision_and_inspect",
        json={
            "connector_type": "sap",
            "params": {
                "host": "sap-prod.corp.io",
                "client_id": "100",
                "username": "RFC_ADMIN",
                "password": "Password99!",
            },
            "test_mode": True,
        },
    )
    assert res_insp.status_code == 200
    data = res_insp.json()
    assert data["status"] == "success"
    assert "connection_id" in data
    assert len(data["discovered_tables"]) > 0
    assert "Password99!" not in data["python_inspector_code"]


def test_chat_stream_credential_interception():
    from fastapi.testclient import TestClient
    from omniflow.server import app
    import json

    client = TestClient(app)

    # When user asks to connect to SAP, server must halt and emit credential_request event
    res = client.post(
        "/api/chat/stream",
        json={
            "message": "Connect to SAP ERP and build medallion pipeline",
            "session_id": "test_interception_sess",
            "stream": True,
        },
    )
    assert res.status_code == 200
    body = res.text
    assert "credential_request" in body
    assert "sap" in body
    assert "Connector" in body or "Connection" in body
    assert "conn_interception" in body


def test_chat_stream_resumed_with_connection_id():
    from fastapi.testclient import TestClient
    from omniflow.server import app

    client = TestClient(app)

    # Resume flow with connectionId and selected tables
    res = client.post(
        "/api/chat/stream",
        json={
            "message": "Resume pipeline synthesis with connectionId 'conn_sap_test881' for selected tables: VBAK, VBAP",
            "session_id": "test_resume_sess",
            "stream": True,
        },
    )
    assert res.status_code == 200
    body = res.text
    # Should NOT halt for credentials again
    assert "credential_request" not in body
    # Should emit thought step referencing the verified connection
    assert "conn_sap_test881" in body
    assert "externalConnections" in body or "conn_sap_test881" in body


