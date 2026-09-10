"""
app/generators/mirroring_gen.py
-------------------------------
Generates Microsoft Fabric Mirrored Database definition parts for continuous
zero-ETL Change Data Capture (CDC) replication into OneLake Delta.
"""

from __future__ import annotations

import base64
import json
from typing import Any
from pydantic import BaseModel, Field


class MirroredTableConfig(BaseModel):
    source_schema: str = "dbo"
    source_table: str
    target_table_name: str | None = None
    replication_enabled: bool = True


def _b64(content: str) -> str:
    """Encodes a UTF-8 string to Base64."""
    return base64.b64encode(content.encode("utf-8")).decode("utf-8")


def generate_mirroring_config(
    database_name: str,
    source_type: str = "AzureSqlDatabase",  # AzureSqlDatabase, Snowflake, CosmosDb, PostgreSql
    server_address: str = "sql-server-prod.database.windows.net",
    source_database_name: str = "ProductionDB",
    tables: list[MirroredTableConfig] | list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Generates the structured JSON configuration for a Mirrored Database."""
    default_tables = [
        {"source_schema": "dbo", "source_table": "Customers", "target_table_name": "dim_customers", "replication_enabled": True},
        {"source_schema": "dbo", "source_table": "Orders", "target_table_name": "fact_orders", "replication_enabled": True},
        {"source_schema": "dbo", "source_table": "Products", "target_table_name": "dim_products", "replication_enabled": True},
    ]

    target_tables = tables or default_tables
    table_mappings = []

    for t in target_tables:
        t_dict = t.model_dump() if isinstance(t, MirroredTableConfig) else t
        src_tbl = t_dict.get("source_table", "table")
        table_mappings.append({
            "sourceSchema": t_dict.get("source_schema", "dbo"),
            "sourceTable": src_tbl,
            "targetTable": t_dict.get("target_table_name") or src_tbl.lower(),
            "status": "Replicating" if t_dict.get("replication_enabled", True) else "Paused",
        })

    return {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/mirroring/1.0.0/schema.json",
        "mirroredDatabaseName": database_name,
        "version": "1.0",
        "sourceConnection": {
            "type": source_type,
            "server": server_address,
            "database": source_database_name,
            "authenticationType": "AzureIdentity",
        },
        "replicationSettings": {
            "syncIntervalSeconds": 60,
            "enableChangeDataCapture": True,
            "targetFormat": "DeltaLake",
        },
        "tables": table_mappings,
    }


def package_mirrored_database_definition_parts(
    database_name: str,
    mirroring_config: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Packages Mirrored Database definition parts into Base64 payload."""
    cfg = mirroring_config or generate_mirroring_config(database_name)
    return [
        {
            "path": "mirroring.json",
            "payload": _b64(json.dumps(cfg, indent=2)),
            "payloadType": "InlineBase64",
        }
    ]
