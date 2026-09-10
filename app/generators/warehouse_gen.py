"""
app/generators/warehouse_gen.py
--------------------------------
Generates Microsoft Fabric Synapse Data Warehouse DDL schemas,
fact/dimension tables, views, and Base64 definition packages.
"""

from __future__ import annotations

import base64
import json
from typing import Any


def generate_warehouse_ddl(
    warehouse_name: str,
    tables: list[dict[str, Any]],
    views: list[dict[str, str]] | None = None,
) -> str:
    """
    Generates standard T-SQL DDL statements for a Fabric Synapse Warehouse.
    Creates schemas, tables, primary keys, and analytical views.
    """
    ddl_lines = [
        f"-- Synapse Warehouse DDL for: {warehouse_name}",
        "CREATE SCHEMA IF NOT EXISTS dbo;",
        "GO\n",
    ]

    for tbl in tables:
        tname = tbl.get("name", "fact_table")
        cols = tbl.get("columns", [])
        col_defs = []
        pks = []

        for c in cols:
            cname = c.get("name", "id")
            ctype = c.get("type", "VARCHAR(255)").upper()
            # Map common data types to Synapse T-SQL
            if ctype in ("STRING", "STR", "TEXT"):
                ctype = "VARCHAR(500)"
            elif ctype in ("INT", "INTEGER"):
                ctype = "INT"
            elif ctype in ("LONG", "BIGINT"):
                ctype = "BIGINT"
            elif ctype in ("DOUBLE", "FLOAT"):
                ctype = "FLOAT"
            elif ctype in ("DECIMAL", "NUMERIC"):
                ctype = "DECIMAL(18,2)"
            elif ctype in ("TIMESTAMP", "DATETIME"):
                ctype = "DATETIME2(6)"
            elif ctype in ("DATE",):
                ctype = "DATE"

            nullable = "NULL" if c.get("nullable", True) else "NOT NULL"
            col_defs.append(f"    [{cname}] {ctype} {nullable}")
            if c.get("pk") or c.get("is_primary_key"):
                pks.append(f"[{cname}]")

        col_str = ",\n".join(col_defs)
        pk_str = f",\n    CONSTRAINT [PK_{tname}] PRIMARY KEY NONCLUSTERED ({', '.join(pks)}) NOT ENFORCED" if pks else ""

        ddl_lines.append(f"CREATE TABLE [dbo].[{tname}] (\n{col_str}{pk_str}\n);\nGO\n")

    if views:
        for v in views:
            vname = v.get("name", "v_summary")
            vquery = v.get("query", "SELECT 1 AS placeholder")
            ddl_lines.append(f"CREATE OR ALTER VIEW [dbo].[{vname}] AS\n{vquery};\nGO\n")

    return "\n".join(ddl_lines)


def package_warehouse_definition_parts(
    warehouse_name: str,
    ddl_sql: str,
) -> list[dict[str, Any]]:
    """
    Packages warehouse DDL script into Base64 inline definition parts format for Fabric REST API.
    """
    b64_sql = base64.b64encode(ddl_sql.encode("utf-8")).decode("utf-8")
    return [
        {
            "path": "schema.sql",
            "payload": b64_sql,
            "payloadType": "InlineBase64",
        }
    ]
