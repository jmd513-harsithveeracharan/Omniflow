"""
omniflow/tools/introspect_source.py
-----------------------------------
Introspects any live relational database (PostgreSQL / Neon) via information_schema.
Discovers tables, real row counts, columns, data types, primary & foreign keys,
detects sensitive PII columns, and registers metadata into the OmniFlow catalog.
"""

from __future__ import annotations

import os
import re
import sys
import uuid
from typing import Any

_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

import psycopg2
from psycopg2.extras import Json
from omniflow.db.postgres_repo import NEON_URI

DB_URI = NEON_URI

PII_PATTERNS = [
    r"email",
    r"phone",
    r"street",
    r"address",
    r"first_name",
    r"last_name",
    r"ssn",
    r"tax_id",
    r"iban",
    r"credit_card",
    r"postal_code",
    r"zip",
]


def is_pii_column(col_name: str) -> bool:
    name_lower = col_name.lower()
    return any(re.search(pat, name_lower) for pat in PII_PATTERNS)


def introspect_live_source(
    schema_name: str = "source_crm",
    db_uri: str = DB_URI,
    sync_to_catalog: bool = True,
) -> dict[str, Any]:
    """Dynamically queries PostgreSQL information_schema to extract real metadata."""
    conn = psycopg2.connect(db_uri, connect_timeout=10)
    tables_meta: dict[str, dict[str, Any]] = {}
    relationships: list[dict[str, Any]] = []

    try:
        with conn.cursor() as cur:
            # 1. Fetch tables and row counts
            cur.execute(
                """
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_schema = %s AND table_type = 'BASE TABLE'
                ORDER BY table_name;
                """,
                (schema_name,),
            )
            raw_tables = [r[0] for r in cur.fetchall()]

            for tbl in raw_tables:
                cur.execute(f"SELECT COUNT(*) FROM {schema_name}.{tbl};")
                row_count = cur.fetchone()[0]

                # Fetch Primary Key
                cur.execute(
                    """
                    SELECT kcu.column_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.key_column_usage kcu
                      ON tc.constraint_name = kcu.constraint_name
                     AND tc.table_schema = kcu.table_schema
                    WHERE tc.constraint_type = 'PRIMARY KEY'
                      AND tc.table_schema = %s
                      AND tc.table_name = %s;
                    """,
                    (schema_name, tbl),
                )
                pk_rows = cur.fetchall()
                pk_col = pk_rows[0][0] if pk_rows else "id"

                # Fetch Columns
                cur.execute(
                    """
                    SELECT column_name, data_type, is_nullable, column_default
                    FROM information_schema.columns
                    WHERE table_schema = %s AND table_name = %s
                    ORDER BY ordinal_position;
                    """,
                    (schema_name, tbl),
                )
                cols = []
                pii_cols = []
                for c_name, c_type, c_null, c_def in cur.fetchall():
                    is_pii = is_pii_column(c_name)
                    if is_pii:
                        pii_cols.append(c_name)
                    cols.append({
                        "name": c_name,
                        "type": c_type,
                        "nullable": (c_null == "YES"),
                        "is_pii": is_pii,
                        "default": c_def,
                    })

                tables_meta[tbl] = {
                    "table_name": tbl,
                    "schema": schema_name,
                    "row_count": row_count,
                    "primary_key": pk_col,
                    "columns": cols,
                    "pii_columns": pii_cols,
                    "watermark_column": "updated_at" if any(c["name"] == "updated_at" for c in cols) else "_omni_ingested_at",
                }

            # 2. Fetch Foreign Key Relationships
            cur.execute(
                """
                SELECT 
                    tc.table_name AS from_table, 
                    kcu.column_name AS from_column, 
                    ccu.table_name AS to_table, 
                    ccu.column_name AS to_column
                FROM information_schema.table_constraints AS tc 
                JOIN information_schema.key_column_usage AS kcu 
                  ON tc.constraint_name = kcu.constraint_name 
                 AND tc.table_schema = kcu.table_schema 
                JOIN information_schema.constraint_column_usage AS ccu 
                  ON ccu.constraint_name = tc.constraint_name 
                 AND ccu.table_schema = tc.table_schema 
                WHERE tc.constraint_type = 'FOREIGN KEY' 
                  AND tc.table_schema = %s;
                """,
                (schema_name,),
            )
            for f_tbl, f_col, t_tbl, t_col in cur.fetchall():
                relationships.append({
                    "from_table": f_tbl,
                    "from_column": f_col,
                    "to_table": t_tbl,
                    "to_column": t_col,
                    "type": "MANY_TO_ONE",
                })

            # 3. Synchronize with OmniFlow PostgreSQL Catalog tables
            if sync_to_catalog:
                # Register Data Source
                ds_name = f"PostgreSQL Operational CRM ({schema_name})"
                cur.execute("SELECT source_id FROM data_sources WHERE source_name = %s;", (ds_name,))
                srow = cur.fetchone()
                if srow:
                    source_id = srow[0]
                else:
                    source_id = str(uuid.uuid4())
                    cur.execute(
                        """
                        INSERT INTO data_sources (source_id, source_name, source_type, system_name, host, database_name, status, metadata)
                        VALUES (%s, %s, 'PostgreSQL', 'Neon Serverless', 'neon.tech', 'neondb', 'active', %s);
                        """,
                        (source_id, ds_name, Json({"schema": schema_name, "tables_count": len(tables_meta)})),
                    )

                # Register Tables & Columns
                for tbl_name, t_info in tables_meta.items():
                    pk_list = [t_info["primary_key"]]
                    cur.execute("SELECT table_id FROM tables WHERE table_name = %s;", (tbl_name,))
                    trow = cur.fetchone()
                    if trow:
                        tbl_id = trow[0]
                        cur.execute(
                            """
                            UPDATE tables 
                            SET primary_key = %s, watermark_column = %s, row_count = %s, metadata = %s
                            WHERE table_id = %s;
                            """,
                            (pk_list, t_info["watermark_column"], t_info["row_count"], Json({"pii_columns": t_info["pii_columns"]}), tbl_id),
                        )
                    else:
                        tbl_id = str(uuid.uuid4())
                        cur.execute(
                            """
                            INSERT INTO tables (table_id, table_name, layer, primary_key, is_incremental, watermark_column, row_count, status, metadata)
                            VALUES (%s, %s, 'raw', %s, true, %s, %s, 'active', %s);
                            """,
                            (tbl_id, tbl_name, pk_list, t_info["watermark_column"], t_info["row_count"], Json({"pii_columns": t_info["pii_columns"]})),
                        )

                    # Update columns
                    for col in t_info["columns"]:
                        cur.execute("SELECT column_id FROM columns WHERE table_id = %s AND column_name = %s;", (tbl_id, col["name"]))
                        if not cur.fetchone():
                            cur.execute(
                                """
                                INSERT INTO columns (column_id, table_id, column_name, data_type, nullable, is_pii, metadata)
                                VALUES (%s, %s, %s, %s, %s, %s, %s);
                                """,
                                (str(uuid.uuid4()), tbl_id, col["name"], col["type"], col["nullable"], col["is_pii"], Json({"seeded_from_schema": schema_name})),
                            )

                conn.commit()

    finally:
        conn.close()

    all_pii = []
    for t in tables_meta.values():
        all_pii.extend(t["pii_columns"])

    return {
        "status": "success",
        "schema": schema_name,
        "tables_count": len(tables_meta),
        "tables": tables_meta,
        "relationships": relationships,
        "pii_columns_detected": sorted(list(set(all_pii))),
    }


if __name__ == "__main__":
    res = introspect_live_source()
    print(f"[SUCCESS] Introspected {res['tables_count']} tables:")
    for tname, tdata in res["tables"].items():
        print(f"  - {tname}: {len(tdata['columns'])} cols, PK={tdata['primary_key']}, Rows={tdata['row_count']}, PII={tdata['pii_columns']}")
    print("Relationships:", res["relationships"])
