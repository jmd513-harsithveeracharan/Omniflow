# -*- coding: utf-8 -*-
"""
connectors/jit_connector_factory.py — Dynamic JIT Connector Synthesizer & Sandbox Engine
----------------------------------------------------------------------------------------
1. Auto-synthesizes new BaseConnector classes on-demand when user prompts for an unconfigured source.
2. Built-in PII Column Scanner (auto-detects emails, cards, SSNs, phone numbers).
3. Spark Parallelism & Partitioning Boundary Calculator.
4. Built-in Mock Sandbox Mode for instant zero-cloud-account testing!
"""

import os
import re
from typing import Dict, Any, List, Optional
from connectors.base_connector import BaseConnector

# Standard source archetypes for instant dynamic JIT scaffolding
ARCHETYPE_TEMPLATES = {
    "redshift": {
        "name": "Amazon Redshift",
        "category": "Cloud Data Warehouse",
        "default_port": "5439",
        "driver_class": "com.amazon.redshift.jdbc42.Driver",
        "jdbc_prefix": "jdbc:redshift://",
        "required_params": [
            {"key": "host", "label": "Cluster Host / Endpoint", "type": "text", "placeholder": "redshift-cluster.xxx.redshift.amazonaws.com"},
            {"key": "port", "label": "Port", "type": "text", "placeholder": "5439", "default": "5439"},
            {"key": "database", "label": "Database Name", "type": "text", "placeholder": "dev"},
            {"key": "username", "label": "User ID", "type": "text", "placeholder": "awsuser"},
            {"key": "password", "label": "Password", "type": "password", "placeholder": "••••••••••••"}
        ],
        "mock_tables": [
            {"schema": "public", "table": "orders", "type": "TABLE", "full_name": "public.orders", "est_rows": 1250000},
            {"schema": "public", "table": "customers", "type": "TABLE", "full_name": "public.customers", "est_rows": 45000},
            {"schema": "public", "table": "line_items", "type": "TABLE", "full_name": "public.line_items", "est_rows": 4800000}
        ]
    },
    "snowflake": {
        "name": "Snowflake Cloud Data Platform",
        "category": "Cloud Data Warehouse",
        "default_port": "443",
        "driver_class": "net.snowflake.client.jdbc.SnowflakeDriver",
        "jdbc_prefix": "jdbc:snowflake://",
        "required_params": [
            {"key": "account", "label": "Account Identifier", "type": "text", "placeholder": "org-account.snowflakecomputing.com"},
            {"key": "warehouse", "label": "Warehouse Name", "type": "text", "placeholder": "COMPUTE_WH"},
            {"key": "database", "label": "Database", "type": "text", "placeholder": "SALES_DB"},
            {"key": "schema", "label": "Schema", "type": "text", "placeholder": "PUBLIC", "default": "PUBLIC"},
            {"key": "username", "label": "User ID", "type": "text", "placeholder": "snowflake_user"},
            {"key": "password", "label": "Password / Private Key", "type": "password", "placeholder": "••••••••••••"}
        ],
        "mock_tables": [
            {"schema": "PUBLIC", "table": "CUSTOMER_CHURN", "type": "TABLE", "full_name": "PUBLIC.CUSTOMER_CHURN", "est_rows": 85000},
            {"schema": "PUBLIC", "table": "DAILY_SALES", "type": "TABLE", "full_name": "PUBLIC.DAILY_SALES", "est_rows": 3200000}
        ]
    },
    "oracle": {
        "name": "Oracle Database (11g–21c)",
        "category": "Relational Database",
        "default_port": "1521",
        "driver_class": "oracle.jdbc.driver.OracleDriver",
        "jdbc_prefix": "jdbc:oracle:thin:@//",
        "required_params": [
            {"key": "host", "label": "Oracle Host / IP", "type": "text", "placeholder": "oracle.corp.internal"},
            {"key": "port", "label": "Port", "type": "text", "placeholder": "1521", "default": "1521"},
            {"key": "service_name", "label": "Service Name / SID", "type": "text", "placeholder": "ORCLPDB1"},
            {"key": "username", "label": "User ID", "type": "text", "placeholder": "C##SCOTT"},
            {"key": "password", "label": "Password", "type": "password", "placeholder": "••••••••••••"}
        ],
        "mock_tables": [
            {"schema": "SALES", "table": "CUSTOMERS", "type": "TABLE", "full_name": "SALES.CUSTOMERS", "est_rows": 240000},
            {"schema": "SALES", "table": "TRANSACTIONS", "type": "TABLE", "full_name": "SALES.TRANSACTIONS", "est_rows": 9800000}
        ]
    },
    "postgres": {
        "name": "PostgreSQL (RDS / Aurora / Cloud SQL)",
        "category": "Relational Database",
        "default_port": "5432",
        "driver_class": "org.postgresql.Driver",
        "jdbc_prefix": "jdbc:postgresql://",
        "required_params": [
            {"key": "host", "label": "Host", "type": "text", "placeholder": "localhost or pg.domain.com"},
            {"key": "port", "label": "Port", "type": "text", "placeholder": "5432", "default": "5432"},
            {"key": "database", "label": "Database", "type": "text", "placeholder": "postgres"},
            {"key": "username", "label": "User ID", "type": "text", "placeholder": "postgres"},
            {"key": "password", "label": "Password", "type": "password", "placeholder": "••••••••••••"}
        ],
        "mock_tables": [
            {"schema": "public", "table": "users", "type": "TABLE", "full_name": "public.users", "est_rows": 15000},
            {"schema": "public", "table": "audit_logs", "type": "TABLE", "full_name": "public.audit_logs", "est_rows": 670000}
        ]
    },
    "salesforce": {
        "name": "Salesforce CRM & Data Cloud",
        "category": "Enterprise SaaS API",
        "default_port": "443",
        "driver_class": "generic_rest_oauth",
        "required_params": [
            {"key": "instance_url", "label": "Instance URL", "type": "text", "placeholder": "https://yourorg.my.salesforce.com"},
            {"key": "client_id", "label": "Client ID (Consumer Key)", "type": "text", "placeholder": "3MVG9..."},
            {"key": "client_secret", "label": "Client Secret", "type": "password", "placeholder": "••••••••••••"},
            {"key": "refresh_token", "label": "Refresh Token", "type": "password", "placeholder": "••••••••••••"}
        ],
        "mock_tables": [
            {"schema": "sobject", "table": "Contact", "type": "ENTITY", "full_name": "sobject.Contact", "est_rows": 45000},
            {"schema": "sobject", "table": "Opportunity", "type": "ENTITY", "full_name": "sobject.Opportunity", "est_rows": 12000}
        ]
    }
}


def detect_pii_columns(columns: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """
    Automated PII detection scanner. Inspects column names and flags sensitive fields
    (Email, SSN, CreditCard, Phone, Salary, Password) for masking/hashing during Bronze ingestion.
    """
    pii_patterns = {
        "EMAIL": r"(email|mail_addr|user_email)",
        "SSN_TAX": r"(ssn|social_security|tax_id|aadhaar|pan)",
        "CREDIT_CARD": r"(card_no|credit_card|cc_num|cvv|iban)",
        "PHONE": r"(phone|mobile|tel_num|cell)",
        "FINANCIAL": r"(salary|compensation|bank_acct|routing_no)",
        "SECURITY": r"(password|pass_hash|secret|pin|salt)"
    }
    
    enriched = []
    for col in columns:
        col_copy = dict(col)
        name_lower = col_copy.get("name", col_copy.get("column", "")).lower()
        col_copy["is_pii"] = False
        col_copy["pii_category"] = None
        col_copy["suggested_mask"] = None
        
        for category, pattern in pii_patterns.items():
            if re.search(pattern, name_lower):
                col_copy["is_pii"] = True
                col_copy["pii_category"] = category
                col_copy["suggested_mask"] = "sha256_hash" if category in ["EMAIL", "SSN_TAX", "CREDIT_CARD"] else "redact"
                break
        enriched.append(col_copy)
    return enriched


def calculate_spark_partitioning(est_rows: int, pk_column: str) -> Dict[str, Any]:
    """
    Calculates optimal PySpark JDBC extraction partitions and boundaries
    to prevent single-threaded bottlenecking or small-file fragmentation.
    """
    if est_rows < 100_000:
        return {"num_partitions": 1, "use_partitioning": False}
    elif est_rows < 1_000_000:
        return {"num_partitions": 4, "partition_column": pk_column, "use_partitioning": True}
    elif est_rows < 10_000_000:
        return {"num_partitions": 8, "partition_column": pk_column, "use_partitioning": True}
    else:
        return {"num_partitions": 16, "partition_column": pk_column, "use_partitioning": True}


class DynamicJITConnector(BaseConnector):
    """
    Dynamically synthesized connector instance created on-the-fly for any enterprise source.
    """
    source_id = None  # Prevents registry auto-scanner from attempting parameterless instantiation

    def __init__(self, source_id: str, archetype: Dict[str, Any]):
        self.source_id = source_id
        self.name = archetype.get("name", source_id.replace("_", " ").title())
        self.category = archetype.get("category", "Database")
        self.required_params = archetype.get("required_params", [])
        self.driver_class = archetype.get("driver_class", "org.postgresql.Driver")
        self.mock_tables = archetype.get("mock_tables", [])
        self.is_synthetic = True

    def test_connection(self, params: dict) -> dict:
        host = params.get("host", params.get("cluster_host", params.get("account", "")))
        port = params.get("port", "5432")
        
        # Check if real host provided or if running in mock sandbox mode
        if not host or "example" in host or "xxx" in host:
            return {
                "success": True,
                "message": f"Sandbox Handshake Success: Connected to simulated {self.name} cluster.",
                "details": {"mode": "MOCK_SANDBOX", "latency_ms": 1.2}
            }
        
        from connectors.network_doctor import NetworkDoctor
        return NetworkDoctor.diagnose_target(host, int(port) if str(port).isdigit() else 5432)

    def discover_tables(self, params: dict) -> dict:
        return {
            "success": True,
            "tables": self.mock_tables,
            "count": len(self.mock_tables),
            "is_sandbox": True
        }

    def get_schema(self, table: str, params: dict, schema_name: str = "public") -> dict:
        # Sample schema with PK and Watermark for Delta MERGE
        raw_cols = [
            {"name": f"{table.rstrip('s')}_id", "type": "INTEGER", "nullable": False, "is_pk": True},
            {"name": "customer_email", "type": "VARCHAR(255)", "nullable": False, "is_pk": False},
            {"name": "total_amount", "type": "DECIMAL(18,2)", "nullable": True, "is_pk": False},
            {"name": "status", "type": "VARCHAR(50)", "nullable": True, "is_pk": False},
            {"name": "last_modified_date", "type": "TIMESTAMP", "nullable": False, "is_pk": False}
        ]
        return {
            "success": True,
            "table": table,
            "columns": detect_pii_columns(raw_cols),
            "primary_key": f"{table.rstrip('s')}_id",
            "watermark_column": "last_modified_date"
        }

    def generate_pyspark_ingest_code(
        self, table: str, schema: list, target_lakehouse: str, layer: str = "Bronze", params: dict = None
    ) -> str:
        params = params or {}
        pk = f"{table.rstrip('s')}_id"
        part_info = calculate_spark_partitioning(1_500_000, pk)
        
        return f"""# -------------------------------------------------------------------------
# Fabric AI Studio — PySpark Ingestion: {self.name} -> {target_lakehouse}
# Source Table: {table} | Strategy: INCREMENTAL_MERGE (Watermarked)
# -------------------------------------------------------------------------
import mssparkutils
from delta.tables import DeltaTable
from pyspark.sql.functions import col, current_timestamp, sha2

# 1. Retrieve Secure Credentials from Fabric Key Vault
db_password = mssparkutils.credentials.getSecret("FabricVault", "{self.source_id.upper()}_PASSWORD")

# 2. Parallel JDBC Extraction ({part_info.get('num_partitions', 8)} Spark Workers)
jdbc_url = "{params.get('jdbc_prefix', 'jdbc:custom://')}{params.get('host', 'endpoint')}:{params.get('port', '5432')}/{params.get('database', 'db')}"

df_source = (
    spark.read.format("jdbc")
    .option("driver", "{self.driver_class}")
    .option("url", jdbc_url)
    .option("dbtable", "{table}")
    .option("numPartitions", "{part_info.get('num_partitions', 8)}")
    .option("partitionColumn", "{pk}")
    .option("lowerBound", "1")
    .option("upperBound", "10000000")
    .load()
)

# 3. PII Column Masking & Bronze Audit Watermark
df_bronze = (
    df_source
    .withColumn("customer_email", sha2(col("customer_email"), 256)) # PII GDPR Mask
    .withColumn("sys_ingested_at", current_timestamp())
    .withColumn("sys_source", lit("{self.source_id}"))
)

# 4. Upsert into Microsoft Fabric Bronze Lakehouse
target_path = "abfss://{target_lakehouse}@onelake.dfs.fabric.microsoft.com/Tables/{table}"

if DeltaTable.isDeltaTable(spark, target_path):
    target_delta = DeltaTable.forPath(spark, target_path)
    target_delta.alias("t").merge(
        df_bronze.alias("s"),
        "t.{pk} = s.{pk}"
    ).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()
    print(" Delta MERGE Upsert Complete for {table}.")
else:
    df_bronze.write.format("delta").mode("overwrite").option("mergeSchema", "true").save(target_path)
    print(" Bronze Delta Table Created for {table}.")
"""


def synthesize_connector(source_slug: str) -> BaseConnector:
    """Creates a new JIT connector matching the requested source archetype."""
    normalized = source_slug.lower().replace("-", "_").replace(" ", "_")
    archetype = ARCHETYPE_TEMPLATES.get(normalized, {
        "name": source_slug.title(),
        "category": "Relational Database",
        "default_port": "5432",
        "driver_class": "org.postgresql.Driver",
        "required_params": [
            {"key": "host", "label": "Host / Endpoint", "type": "text", "placeholder": "host.domain.com"},
            {"key": "port", "label": "Port", "type": "text", "placeholder": "5432", "default": "5432"},
            {"key": "database", "label": "Database", "type": "text", "placeholder": "main_db"},
            {"key": "username", "label": "User ID", "type": "text", "placeholder": "db_user"},
            {"key": "password", "label": "Password", "type": "password", "placeholder": "••••••••••••"}
        ],
        "mock_tables": [
            {"schema": "dbo", "table": "sales_records", "type": "TABLE", "full_name": "dbo.sales_records", "est_rows": 500000}
        ]
    })
    return DynamicJITConnector(normalized, archetype)
