"""
omniflow/connectors/catalog.py
------------------------------
Microsoft Fabric Connector Intelligence & Dynamic Source Classification.

Determines:
1. Whether Microsoft Fabric has a native Data Pipeline Copy connector.
2. Ingestion Pathway:
   - NATIVE_PIPELINE: Native Fabric Copy Activity via /v1/connections
   - PYSPARK_NOTEBOOK: Custom PySpark Ingestion Notebook (API/Driver extraction)
3. Dynamic LLM-driven Parameter Synthesis for ANY enterprise source.
"""

from __future__ import annotations

import logging
import re
from enum import Enum
from typing import Any
from pydantic import BaseModel

logger = logging.getLogger("omniflow.connectors.catalog")


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
    return (
        False,
        IngestionPathway.PYSPARK_NOTEBOOK,
        f"Microsoft Fabric does not have a native Copy connector for '{source_slug}'. An automated PySpark Ingestion Notebook with API/Driver extraction and Key Vault credentials will be synthesized.",
    )


def synthesize_dynamic_connector(source_name: str, session_id: str | None = None) -> ConnectorDefinition:
    """
    Dynamically synthesizes a complete ConnectorDefinition using LLM domain intelligence.
    The AI model reasons about the specific technology (Kafka, Cassandra, MongoDB, Postgres,
    Salesforce, Stripe, ServiceNow, etc.), inferring its required authentication credentials,
    parameter types, Microsoft Fabric pathway, and realistic schema entities.
    """
    clean_name = source_name.strip()
    slug = re.sub(r"[^a-zA-Z0-9_]", "_", clean_name.lower()).strip("_") or "custom_source"

    # 1. Attempt LLM-driven parametric synthesis
    try:
        from omniflow.config.llm_adapter import chat_json

        prompt = f"""You are a Microsoft Fabric Enterprise Data Integration Specialist.
A data engineering project needs to connect to the external data source: '{clean_name}'.

Using your deep domain knowledge of enterprise databases, streaming brokers, SaaS APIs, and Microsoft Fabric:
1. Classify the source category (e.g. "Relational Database", "Cloud Data Warehouse", "Streaming / Event Broker", "NoSQL Database", "SaaS API / Microservice", "Enterprise ERP").
2. Determine whether Microsoft Fabric supports this natively via Data Pipeline Copy Activity (is_fabric_native: true, pathway: "native_pipeline") or requires an automated PySpark Ingestion Notebook / Fabric Eventstream (is_fabric_native: false, pathway: "pyspark_notebook").
3. Determine the EXACT connection credentials & parameters required for authentication.
   - For passwords, tokens, API keys, or private keys: set type="password".
   - For ports or numeric rates: set type="number".
   - For connection strings/URLs, hosts, usernames: set type="text".
4. Recommend 3 to 6 realistic tables, collections, or topic names for this source with schema, estimated row count, and primary keys.

Return ONLY valid JSON matching this schema:
{{
  "connector_name": "{clean_name}",
  "category": "...",
  "icon": "database" | "api" | "layers",
  "is_fabric_native": true | false,
  "pathway": "native_pipeline" | "pyspark_notebook",
  "pathway_explanation": "...",
  "default_gateway": "Corp-OnPremises-Data-Gateway-01" | null,
  "required_params": [
    {{
      "key": "...",
      "label": "...",
      "type": "text" | "password" | "number",
      "placeholder": "...",
      "default": "...",
      "required": true | false
    }}
  ],
  "sample_presets": {{
    "<key>": "<sample_value>"
  }},
  "mock_tables": [
    {{
      "name": "...",
      "schema": "...",
      "description": "...",
      "est_rows": 50000,
      "pk": ["..."],
      "watermark": "..."
    }}
  ]
}}"""

        res = chat_json([{"role": "user", "content": prompt}], complexity="standard", session_id=session_id)
        if isinstance(res, dict) and res.get("required_params"):
            fields: list[ConnectorField] = []
            for p in res.get("required_params", []):
                fields.append(
                    ConnectorField(
                        key=str(p.get("key", "param")),
                        label=str(p.get("label", p.get("key", "Parameter"))),
                        type=str(p.get("type", "text")),
                        placeholder=str(p.get("placeholder", "")),
                        default=str(p.get("default", "")),
                        required=bool(p.get("required", True)),
                        help_text=str(p.get("help_text", "")),
                    )
                )

            pathway_str = str(res.get("pathway", "native_pipeline")).lower()
            pathway_enum = (
                IngestionPathway.PYSPARK_NOTEBOOK
                if "notebook" in pathway_str or "pyspark" in pathway_str
                else IngestionPathway.NATIVE_PIPELINE
            )

            return ConnectorDefinition(
                connector_type=slug,
                name=str(res.get("connector_name", clean_name)),
                category=str(res.get("category", "Enterprise Data Source")),
                icon=str(res.get("icon", "database")),
                description=f"Ingestion integration for {clean_name} into Microsoft Fabric Medallion Lakehouse.",
                is_fabric_native=bool(res.get("is_fabric_native", True)),
                pathway=pathway_enum,
                pathway_explanation=str(res.get("pathway_explanation", "Microsoft Fabric data ingestion integration.")),
                default_gateway=res.get("default_gateway"),
                required_params=fields,
                sample_presets=res.get("sample_presets", {}) or {},
                mock_tables=res.get("mock_tables", []) or [],
            )
    except Exception as exc:
        logger.warning("LLM dynamic connector synthesis failed for '%s': %s. Using baseline inference.", clean_name, exc)

    # 2. Resilient Fallback (only if LLM call is offline)
    is_native, pathway, explanation = classify_source_pathway(slug)
    is_api = any(k in slug for k in ["api", "rest", "stripe", "service", "workday", "hubspot", "jira", "auth"])
    
    if is_api:
        category = "SaaS API / Microservice"
        fields = [
            ConnectorField(key="endpoint_url", label=f"{clean_name} Base URL", type="text", placeholder=f"https://api.{slug}.com/v1", default=f"https://api.{slug}.com/v1", required=True),
            ConnectorField(key="api_key", label="API Key / Bearer Token", type="password", placeholder="••••••••••••", default="", required=True),
            ConnectorField(key="client_id", label="Client ID / Org ID (Optional)", type="text", placeholder=f"{slug}_org_123", default="", required=False),
        ]
        sample_presets = {"endpoint_url": f"https://api.{slug}.com/v1", "api_key": f"demo_{slug}_token_9921"}
        mock_tables = [{"name": f"{slug}_feed", "schema": "api", "description": f"{clean_name} Raw Feed", "est_rows": 100000, "pk": ["id"], "watermark": "updated_at"}]
    else:
        category = "Database / Data Store" if not is_native else "Enterprise Source"
        fields = [
            ConnectorField(key="connection_url", label="Connection URL / URI (Optional — overrides individual fields)", type="text", placeholder=f"{slug}://user:password@host:5432/database", default="", required=False),
            ConnectorField(key="host", label=f"{clean_name} Host / FQDN", type="text", placeholder=f"{slug}-db.corp.internal", default="", required=False),
            ConnectorField(key="port", label="Port", type="number", placeholder="5432", default="5432", required=False),
            ConnectorField(key="database", label="Database Name", type="text", placeholder=f"{slug}_db", default="", required=False),
            ConnectorField(key="username", label="Username", type="text", placeholder="postgres", default="", required=False),
            ConnectorField(key="password", label="Password", type="password", placeholder="••••••••••••", default="", required=False),
        ]
        sample_presets = {"host": f"{slug}-db.corp.internal", "port": "5432", "database": f"{slug}_db"}
        mock_tables = [{"name": "records", "schema": "public", "description": f"{clean_name} Core Records", "est_rows": 50000, "pk": ["id"], "watermark": "updated_at"}]

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
