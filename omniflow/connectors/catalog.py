"""
omniflow/connectors_catalog.py
------------------------------
Microsoft Fabric Connector Intelligence & Dynamic Source Classification.

Determines:
1. Whether Microsoft Fabric has a native Data Pipeline Copy connector.
2. Ingestion Pathway:
   - NATIVE_PIPELINE: Native Fabric Copy Activity via /v1/connections
   - PYSPARK_NOTEBOOK: Custom PySpark Ingestion Notebook (API/Driver extraction)
3. Dynamic JIT Parameter Synthesis for any enterprise source.
"""

from __future__ import annotations

import re
from enum import Enum
from typing import Any
from pydantic import BaseModel, Field


class IngestionPathway(str, Enum):
    NATIVE_PIPELINE = "native_pipeline"      # Fabric Pipeline Copy Activity
    PYSPARK_NOTEBOOK = "pyspark_notebook"    # PySpark Notebook API/Driver Ingestion


class ConnectorField(BaseModel):
    key: str
    label: str
    type: str = "text"  # text, password, select, number
    placeholder: str = ""
    default: str = ""
    options: list[str] | None = None
    required: bool = True
    help_text: str = ""


class ConnectorDefinition(BaseModel):
    connector_type: str
    name: str
    category: str
    icon: str
    description: str
    is_fabric_native: bool
    pathway: IngestionPathway
    pathway_explanation: str
    default_gateway: str | None = None
    required_params: list[ConnectorField]
    sample_presets: dict[str, str]
    mock_tables: list[dict[str, Any]]


# Official Microsoft Fabric native pipeline connectors (Copy Activity supported)
FABRIC_NATIVE_CONNECTORS: set[str] = {
    "sap", "sap_hana", "sap_ecc", "sap_bw",
    "salesforce", "salesforce_crm", "salesforce_marketing",
    "postgres", "postgresql", "neon", "aurora_postgres",
    "sqlserver", "azure_sql", "sql_database", "fabric_sql",
    "snowflake",
    "oracle",
    "mysql", "mariadb",
    "amazon_s3", "s3",
    "google_bigquery", "bigquery",
    "azure_blob", "adls_gen2", "azure_data_lake",
    "teradata",
    "db2", "ibm_db2",
    "odata", "rest", "web", "http",
    "sharepoint", "dataverse",
    "dummy_sandbox",
}


def classify_source_pathway(source_slug: str) -> tuple[bool, IngestionPathway, str]:
    """
    Evaluates if Microsoft Fabric provides a native Data Pipeline Copy Activity
    or requires a Custom PySpark Ingestion Notebook.
    """
    slug = re.sub(r"[^a-zA-Z0-9_]", "_", source_slug.lower()).strip("_")
    is_native = slug in FABRIC_NATIVE_CONNECTORS

    if is_native:
        return (
            True,
            IngestionPathway.NATIVE_PIPELINE,
            "Native Microsoft Fabric Data Pipeline Copy Activity supported. High-throughput serverless extraction.",
        )
    else:
        return (
            False,
            IngestionPathway.PYSPARK_NOTEBOOK,
            f"Microsoft Fabric does not have a native Copy connector for '{source_slug}'. An automated PySpark Ingestion Notebook with API/Driver extraction and Key Vault credentials will be synthesized.",
        )


def synthesize_dynamic_connector(source_name: str) -> ConnectorDefinition:
    """
    Dynamically synthesizes a complete ConnectorDefinition on the fly for ANY source,
    determining whether it uses a Native Pipeline or PySpark Ingestion Notebook.
    """
    clean_name = source_name.strip()
    slug = re.sub(r"[^a-zA-Z0-9_]", "_", clean_name.lower()).strip("_") or "custom_source"
    is_native, pathway, explanation = classify_source_pathway(slug)

    # Detect if source is an API/SaaS platform or a Database
    is_api = any(k in slug for k in [
        "api", "rest", "stripe", "service", "workday", "hubspot", "jira",
        "zendesk", "shopify", "marketo", "twil", "slack", "quickbooks", "auth"
    ])

    if is_api:
        category = "SaaS API / Microservice"
        fields = [
            ConnectorField(key="endpoint_url", label=f"{clean_name} Base URL / Endpoint", type="text", placeholder=f"https://api.{slug}.com/v1", default=f"https://api.{slug}.com/v1", required=True),
            ConnectorField(key="api_key", label="API Key / Bearer Token", type="password", placeholder="sk_live_••••••••••••", default="", required=True),
            ConnectorField(key="client_id", label="Client ID / Org ID (Optional)", type="text", placeholder=f"{slug}_org_12345", default="", required=False),
            ConnectorField(key="rate_limit_rpm", label="Rate Limit (Req/min)", type="number", placeholder="120", default="120", required=False),
        ]
        sample_presets = {
            "endpoint_url": f"https://api.{slug}.com/v1",
            "api_key": f"demo_{slug}_secret_token_9921",
            "client_id": f"{slug}_sandbox_tenant",
            "rate_limit_rpm": "120",
        }
        mock_tables = [
            {"name": f"{slug}_events", "schema": "api", "description": f"{clean_name} Raw Events Stream", "est_rows": 150000, "pk": ["id"], "watermark": "created_at"},
            {"name": f"{slug}_entities", "schema": "api", "description": f"{clean_name} Master Entity Catalog", "est_rows": 24000, "pk": ["id"], "watermark": "updated_at"},
            {"name": f"{slug}_logs", "schema": "api", "description": f"{clean_name} Transaction Logs", "est_rows": 820000, "pk": ["log_id"], "watermark": "timestamp"},
        ]
    else:
        # Default to database / data store pattern
        category = "Database / Data Store" if not is_native else "Enterprise Source"
        fields = [
            ConnectorField(key="connection_url", label="Connection URL / URI (Optional — overrides individual fields)", type="text", placeholder=f"{slug}://user:password@host:5432/database", default="", required=False),
            ConnectorField(key="host", label=f"{clean_name} Server Host / FQDN", type="text", placeholder=f"{slug}-db.corp.internal", default="", required=False),
            ConnectorField(key="port", label="Port", type="number", placeholder="5432", default="5432", required=False),
            ConnectorField(key="database", label="Database Name / Keyspace", type="text", placeholder=f"{slug}_prod", default="", required=False),
            ConnectorField(key="username", label="Service User", type="text", placeholder="fabric_svc", default="", required=False),
            ConnectorField(key="password", label="Password / Secret", type="password", placeholder="••••••••••••", default="", required=False),
            ConnectorField(key="gateway", label="Fabric Gateway Name (Optional)", type="text", placeholder="Corp-Data-Gateway-01", default="Corp-Data-Gateway-01", required=False),
        ]
        sample_presets = {
            "host": f"{slug}-db.corp.internal",
            "port": "5432",
            "database": f"{slug}_prod",
            "username": "fabric_svc",
            "password": f"•{slug.title()}SecurePass2026•",
            "gateway": "Corp-Data-Gateway-01",
        }
        mock_tables = [
            {"name": "customers", "schema": "public", "description": f"{clean_name} Customer Records", "est_rows": 68000, "pk": ["customer_id"], "watermark": "updated_at"},
            {"name": "transactions", "schema": "public", "description": f"{clean_name} Core Transactions", "est_rows": 1450000, "pk": ["txn_id"], "watermark": "txn_date"},
            {"name": "master_data", "schema": "public", "description": f"{clean_name} Reference Master Data", "est_rows": 12000, "pk": ["id"], "watermark": "modified_at"},
        ]

    return ConnectorDefinition(
        connector_type=slug,
        name=clean_name,
        category=category,
        icon="database" if not is_api else "api",
        description=f"Ingestion integration for {clean_name} into Microsoft Fabric Medallion Lakehouse.",
        is_fabric_native=is_native,
        pathway=pathway,
        pathway_explanation=explanation,
        default_gateway="Corp-OnPremises-Data-Gateway-01" if is_native else None,
        required_params=fields,
        sample_presets=sample_presets,
        mock_tables=mock_tables,
    )

