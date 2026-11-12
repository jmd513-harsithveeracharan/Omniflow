"""
omniflow/connectors_live_inspector.py
-------------------------------------
Driver-dispatched live source catalog introspection engine.
Connects read-only to user-supplied database endpoints or connection URIs to discover
real schemas, tables, estimated row counts, column types, primary keys, foreign keys,
PII column candidates, and incremental watermark columns.
"""

from __future__ import annotations

import os
import re
from typing import Any
from urllib.parse import quote_plus

import psycopg2
from pydantic import BaseModel, Field

PII_FIELD_PATTERN = re.compile(
    r"(email|e_mail|phone|mobile|ssn|tax_id|iban|passport|password|secret|address|street|birth|dob)",
    re.IGNORECASE,
)

WATERMARK_CANDIDATES = (
    "updated_at",
    "modified_at",
    "last_updated",
    "last_modified",
    "completed_at",
    "created_at",
    "started_at",
    "polled_at",
    "computed_at",
    "order_date",
    "joined_at",
    "event_time",
    "timestamp",
)


class LiveColumnSpec(BaseModel):
    """Typed column descriptor returned from catalog introspection."""

    name: str
    type: str
    nullable: bool = True
    is_pk: bool = False
    is_pii: bool = False


class LiveTableSpec(BaseModel):
    """Typed table descriptor returned to connector forms and pipeline planners."""

    name: str
    schema_name: str = Field(default="public", alias="schema")
    full_name: str = ""
    description: str = ""
    est_rows: int = 0
    pk: list[str] = Field(default_factory=list)
    foreign_keys: list[str] = Field(default_factory=list)
    watermark: str | None = None
    columns: list[LiveColumnSpec] = Field(default_factory=list)
    pii_columns: list[str] = Field(default_factory=list)

    model_config = {"populate_by_name": True}


def is_postgres_connector(connector_type: str) -> bool:
    slug = connector_type.lower().strip()
    return any(k in slug for k in ("postgres", "postgresql", "neon", "aurora_postgres", "redshift"))


def build_postgres_dsn(params: dict[str, Any]) -> str:
    """Builds a PostgreSQL DSN from either connection_url or structured fields."""
    conn_url = str(params.get("connection_url") or params.get("uri") or "").strip()
    if conn_url:
        if conn_url.startswith("postgres://"):
            conn_url = "postgresql://" + conn_url[len("postgres://"):]
        return conn_url

    host = str(params.get("host") or "").strip()
    database = str(params.get("database") or "").strip()
    username = str(params.get("username") or "").strip()
    password = str(params.get("password") or "")
    port = str(params.get("port") or "5432").strip() or "5432"
    sslmode = str(params.get("sslmode") or ("require" if "neon.tech" in host or "azure" in host or "amazonaws" in host else "prefer")).strip()

    if not host or not database or not username:
        raise ValueError("Provide either a Connection URL/URI or Host, Database Name, Username, and Password.")

    user_q = quote_plus(username)
    pass_q = quote_plus(password)
    db_q = quote_plus(database)
    return f"postgresql://{user_q}:{pass_q}@{host}:{port}/{db_q}?sslmode={sslmode}"


def is_demo_or_preset_params(params: dict[str, Any], sample_presets: dict[str, str], test_mode: bool) -> bool:
    """Determines whether the request represents demo preset inspection vs live credentials."""
    conn_url = str(params.get("connection_url") or params.get("uri") or "").strip()
    if conn_url:
        return False

    host = str(params.get("host") or params.get("endpoint_url") or params.get("account") or "").strip().lower()
    if not host:
        return test_mode

    if ".internal" in host or "sandbox" in host or "demo" in host:
        return True

    preset_host = str(sample_presets.get("host") or sample_presets.get("endpoint_url") or "").strip().lower()
    if preset_host and host == preset_host:
        return True

    return False


def _pick_watermark(columns: list[LiveColumnSpec]) -> str | None:
    col_map = {c.name.lower(): c.name for c in columns}
    for cand in WATERMARK_CANDIDATES:
        if cand in col_map:
            return col_map[cand]
    for col in columns:
        t_low = col.type.lower()
        if "timestamp" in t_low or "date" in t_low:
            return col.name
    return None


def inspect_postgres_catalog(dsn: str) -> list[dict[str, Any]]:
    """Queries live PostgreSQL system catalogs read-only and returns rich table specs."""
    conn = psycopg2.connect(dsn, connect_timeout=8)
    try:
        conn.set_session(readonly=True, autocommit=True)
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT n.nspname AS table_schema,
                       c.relname AS table_name,
                       GREATEST(COALESCE(s.n_live_tup, c.reltuples::bigint, 0), 0)::bigint AS est_rows
                FROM pg_class c
                JOIN pg_namespace n ON n.oid = c.relnamespace
                LEFT JOIN pg_stat_user_tables s
                  ON s.schemaname = n.nspname AND s.relname = c.relname
                WHERE c.relkind IN ('r', 'p')
                  AND n.nspname NOT IN ('pg_catalog', 'information_schema')
                ORDER BY n.nspname, c.relname;
                """
            )
            table_rows = cur.fetchall()

            cur.execute(
                """
                SELECT table_schema, table_name, column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
                ORDER BY table_schema, table_name, ordinal_position;
                """
            )
            col_rows = cur.fetchall()

            cur.execute(
                """
                SELECT tc.table_schema, tc.table_name, kcu.column_name
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                WHERE tc.constraint_type = 'PRIMARY KEY'
                ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position;
                """
            )
            pk_rows = cur.fetchall()

            cur.execute(
                """
                SELECT tc.table_schema, tc.table_name, kcu.column_name,
                       ccu.table_schema AS ref_schema, ccu.table_name AS ref_table, ccu.column_name AS ref_column
                FROM information_schema.table_constraints tc
                JOIN information_schema.key_column_usage kcu
                  ON tc.constraint_name = kcu.constraint_name
                 AND tc.table_schema = kcu.table_schema
                JOIN information_schema.constraint_column_usage ccu
                  ON ccu.constraint_name = tc.constraint_name
                 AND ccu.constraint_schema = tc.constraint_schema
                WHERE tc.constraint_type = 'FOREIGN KEY'
                ORDER BY tc.table_schema, tc.table_name, kcu.ordinal_position;
                """
            )
            fk_rows = cur.fetchall()
    finally:
        conn.close()

    pks_by_table: dict[tuple[str, str], list[str]] = {}
    for sch, tbl, col in pk_rows:
        pks_by_table.setdefault((sch, tbl), []).append(col)

    fks_by_table: dict[tuple[str, str], list[str]] = {}
    for sch, tbl, col, rsch, rtbl, rcol in fk_rows:
        fks_by_table.setdefault((sch, tbl), []).append(f"{col} -> {rsch}.{rtbl}.{rcol}")

    cols_by_table: dict[tuple[str, str], list[LiveColumnSpec]] = {}
    for sch, tbl, col, dtype, nullable in col_rows:
        pk_set = set(pks_by_table.get((sch, tbl), []))
        cols_by_table.setdefault((sch, tbl), []).append(
            LiveColumnSpec(
                name=col,
                type=dtype,
                nullable=(nullable == "YES"),
                is_pk=(col in pk_set),
                is_pii=bool(PII_FIELD_PATTERN.search(col)),
            )
        )

    discovered: list[dict[str, Any]] = []
    for sch, tbl, est in table_rows:
        cols = cols_by_table.get((sch, tbl), [])
        pk_list = pks_by_table.get((sch, tbl), [])
        fk_list = fks_by_table.get((sch, tbl), [])
        pii_cols = [c.name for c in cols if c.is_pii]
        wm = _pick_watermark(cols)
        full_name = f"{sch}.{tbl}"
        spec = LiveTableSpec(
            name=tbl,
            schema=sch,
            full_name=full_name,
            description=f"{sch}.{tbl} ({len(cols)} columns" + (f", {len(fk_list)} FK relations" if fk_list else "") + ")",
            est_rows=int(est or 0),
            pk=pk_list,
            foreign_keys=fk_list,
            watermark=wm,
            columns=cols,
            pii_columns=pii_cols,
        )
        discovered.append(spec.model_dump(by_alias=True))
    return discovered


def run_live_schema_inspection(
    connector_type: str,
    params: dict[str, Any],
    sample_presets: dict[str, str],
    test_mode: bool = True,
) -> list[dict[str, Any]] | None:
    """
    Runs live source catalog inspection when real connection inputs are supplied.
    Returns None when operating strictly on sandbox demo presets so callers can use
    connector fallback metadata.
    """
    if is_demo_or_preset_params(params, sample_presets, test_mode):
        return None

    if is_postgres_connector(connector_type):
        dsn = build_postgres_dsn(params)
        return inspect_postgres_catalog(dsn)

    # Non-Postgres connectors without a local Python driver return None cleanly for fallback
    # unless an explicit driver plugin is added here later.
    return None
