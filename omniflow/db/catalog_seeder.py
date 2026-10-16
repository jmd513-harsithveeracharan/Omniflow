from __future__ import annotations

import uuid
from typing import Any

import psycopg2
from psycopg2.extras import Json

from omniflow.db.postgres_repo import NEON_URI
from omniflow.intake.intake_model import EnterpriseProjectIntake


def seed_catalog_from_intake(intake: EnterpriseProjectIntake, db_uri: str = NEON_URI) -> dict[str, int]:
    """Seeds data_sources, tables, columns, and constraints into Neon PostgreSQL from the intake spec."""
    counts = {"data_sources": 0, "tables": 0, "columns": 0}

    with psycopg2.connect(db_uri, connect_timeout=8) as conn, conn.cursor() as cur:
        for ds in intake.retrieved_context.data_sources:
            cur.execute("SELECT source_id::text FROM data_sources WHERE source_name = %s;", (ds.source_name,))
            row = cur.fetchone()
            if row:
                source_id = row[0]
            else:
                source_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO data_sources
                        (source_id, source_name, source_type, system_name, host, database_name,
                         authentication_type, status, metadata, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'active', %s, NOW());
                    """,
                    (
                        source_id,
                        ds.source_name,
                        ds.source_type,
                        ds.system_name,
                        ds.host,
                        ds.database_name,
                        ds.authentication_type,
                        Json({"seeded_by": "omniflow_intake"}),
                    ),
                )
                counts["data_sources"] += 1

            for tbl in ds.tables:
                cur.execute("SELECT table_id::text FROM tables WHERE table_name = %s;", (tbl.table_name,))
                trow = cur.fetchone()
                if trow:
                    table_id = trow[0]
                else:
                    table_id = str(uuid.uuid4())
                    cur.execute(
                        """
                        INSERT INTO tables
                            (table_id, table_name, layer, primary_key, is_incremental, watermark_column,
                             status, metadata)
                        VALUES (%s, %s, %s, %s, %s, %s, 'active', %s);
                        """,
                        (
                            table_id,
                            tbl.table_name,
                            tbl.layer,
                            [tbl.primary_key] if isinstance(tbl.primary_key, str) else list(tbl.primary_key),
                            tbl.is_incremental,
                            tbl.watermark_column,
                            Json({"description": tbl.description, "source_id": source_id}),
                        ),
                    )
                    counts["tables"] += 1

                for col in tbl.columns:
                    cur.execute(
                        "SELECT column_id::text FROM columns WHERE table_id = %s AND column_name = %s;",
                        (table_id, col.name),
                    )
                    if not cur.fetchone():
                        col_id = str(uuid.uuid4())
                        cur.execute(
                            """
                            INSERT INTO columns
                                (column_id, table_id, column_name, data_type, nullable,
                                 is_primary_key, is_pii, is_business_key)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s);
                            """,
                            (
                                col_id,
                                table_id,
                                col.name,
                                col.data_type,
                                col.is_nullable,
                                col.is_primary_key,
                                col.is_pii,
                                col.is_business_key,
                            ),
                        )
                        counts["columns"] += 1

        conn.commit()
    return counts


def get_table_schema_context_from_db(table_names: list[str], db_uri: str = NEON_URI) -> list[dict[str, Any]]:
    """Tool function used dynamically by agents to retrieve real column schemas from PostgreSQL."""
    results = []
    with psycopg2.connect(db_uri, connect_timeout=8) as conn, conn.cursor() as cur:
        for tname in table_names:
            cur.execute(
                """
                SELECT t.table_name, t.primary_key, t.watermark_column, t.layer,
                       c.column_name, c.data_type, c.is_primary_key, c.is_pii, c.is_business_key
                FROM tables t
                LEFT JOIN columns c ON t.table_id = c.table_id
                WHERE LOWER(t.table_name) = LOWER(%s)
                ORDER BY c.column_name;
                """,
                (tname,),
            )
            rows = cur.fetchall()
            if rows:
                cols = []
                pii_cols = []
                for r in rows:
                    if r[4]:  # column_name
                        cols.append({"name": r[4], "data_type": r[5], "is_primary_key": r[6], "is_pii": r[7]})
                        if r[7]:  # is_pii
                            pii_cols.append(r[4])
                pk_raw = rows[0][1]
                pk_val = pk_raw[0] if isinstance(pk_raw, (list, tuple)) and pk_raw else (pk_raw or "id")
                results.append(
                    {
                        "table_name": rows[0][0],
                        "primary_key": pk_val,
                        "watermark_column": rows[0][2],
                        "layer": rows[0][3],
                        "columns": cols,
                        "pii_columns": pii_cols,
                    }
                )
    return results

