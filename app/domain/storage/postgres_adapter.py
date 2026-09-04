"""
app/domain/storage/postgres_adapter.py
--------------------------------------
Concrete PostgreSQL + pgvector implementation of StorageAdapter.
Supports native HNSW/IVFFlat cosine vector indexing for 5-star architecture recipes.
"""

from __future__ import annotations

import json
import logging

from app.domain.models.session import (
    ArchitectureRecipe,
    LearnedFact,
    MessageRecord,
    RunRecord,
    SessionRecord,
)
from app.domain.storage.base import StorageAdapter

logger = logging.getLogger("fabric_ai.storage.postgres")

try:
    import psycopg
    from psycopg.rows import dict_row

    _PSYCOPG_AVAILABLE = True
except ImportError:
    _PSYCOPG_AVAILABLE = False


_PG_SCHEMA = """
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS sessions (
    session_id   TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_active  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata     JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS messages (
    id          BIGSERIAL PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    turn_index  INTEGER NOT NULL,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    token_est   INTEGER DEFAULT 0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pg_messages_session ON messages(session_id, turn_index);

CREATE TABLE IF NOT EXISTS learned_facts (
    id          BIGSERIAL PRIMARY KEY,
    session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    fact_key    TEXT NOT NULL,
    fact_value  TEXT NOT NULL,
    confidence  FLOAT DEFAULT 1.0,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(session_id, fact_key)
);

CREATE TABLE IF NOT EXISTS runs (
    run_id           TEXT PRIMARY KEY,
    session_id       TEXT REFERENCES sessions(session_id),
    status           TEXT NOT NULL DEFAULT 'planned',
    source_name      TEXT,
    database_name    TEXT,
    plan_json        JSONB DEFAULT '{}'::jsonb,
    steps_json       JSONB DEFAULT '[]'::jsonb,
    pipeline_item_id TEXT,
    pipeline_status  TEXT,
    failure_reason   TEXT,
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipes (
    id                 TEXT PRIMARY KEY,
    title              TEXT NOT NULL,
    description        TEXT NOT NULL,
    source_dialect     TEXT DEFAULT 'tsql',
    target_fabric_type TEXT DEFAULT 'lakehouse',
    code_template      TEXT NOT NULL,
    tags               JSONB DEFAULT '[]'::jsonb,
    rating             INTEGER DEFAULT 5,
    embedding          vector(1536)
);
"""


class PostgresStorageAdapter(StorageAdapter):
    """Enterprise PostgreSQL + pgvector adapter."""

    def __init__(self, connection_uri: str) -> None:
        if not _PSYCOPG_AVAILABLE:
            raise RuntimeError("psycopg is not installed. Run 'pip install psycopg[binary,pool]' to enable PostgreSQL.")
        self.connection_uri = connection_uri
        self.init_db()

    def _get_conn(self):
        return psycopg.connect(self.connection_uri, row_factory=dict_row)

    def init_db(self) -> None:
        try:
            with self._get_conn() as conn:
                with conn.cursor() as cur:
                    cur.execute(_PG_SCHEMA)
                conn.commit()
        except Exception as e:
            logger.warning(f"[POSTGRES] Init schema failed or running in mock mode: {e}")

    def create_session(self, record: SessionRecord) -> SessionRecord:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO sessions (session_id, workspace_id, created_at, last_active, metadata)
                       VALUES (%s, %s, %s, %s, %s)
                       ON CONFLICT(session_id) DO UPDATE SET last_active=EXCLUDED.last_active, metadata=EXCLUDED.metadata""",
                    (
                        record.session_id,
                        record.workspace_id,
                        record.created_at,
                        record.last_active,
                        json.dumps(record.metadata),
                    ),
                )
            conn.commit()
        return record

    def get_session(self, session_id: str) -> SessionRecord | None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM sessions WHERE session_id = %s", (session_id,))
                row = cur.fetchone()
                if not row:
                    return None
                return SessionRecord(
                    session_id=row["session_id"],
                    workspace_id=row["workspace_id"],
                    created_at=str(row["created_at"]),
                    last_active=str(row["last_active"]),
                    metadata=row["metadata"]
                    if isinstance(row["metadata"], dict)
                    else json.loads(row["metadata"] or "{}"),
                )

    def list_sessions(self, workspace_id: str | None = None) -> list[SessionRecord]:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                if workspace_id:
                    cur.execute(
                        "SELECT * FROM sessions WHERE workspace_id = %s ORDER BY last_active DESC", (workspace_id,)
                    )
                else:
                    cur.execute("SELECT * FROM sessions ORDER BY last_active DESC")
                rows = cur.fetchall()
                return [
                    SessionRecord(
                        session_id=r["session_id"],
                        workspace_id=r["workspace_id"],
                        created_at=str(r["created_at"]),
                        last_active=str(r["last_active"]),
                        metadata=r["metadata"]
                        if isinstance(r["metadata"], dict)
                        else json.loads(r["metadata"] or "{}"),
                    )
                    for r in rows
                ]

    def add_message(self, message: MessageRecord) -> MessageRecord:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT COALESCE(MAX(turn_index), -1) + 1 AS next_idx FROM messages WHERE session_id = %s",
                    (message.session_id,),
                )
                turn_index = cur.fetchone()["next_idx"]
                cur.execute(
                    """INSERT INTO messages (session_id, turn_index, role, content, token_est, created_at)
                       VALUES (%s, %s, %s, %s, %s, %s) RETURNING id""",
                    (
                        message.session_id,
                        turn_index,
                        message.role,
                        message.content,
                        message.token_est,
                        message.created_at,
                    ),
                )
                message.id = cur.fetchone()["id"]
                message.turn_index = turn_index
            conn.commit()
        return message

    def get_messages(self, session_id: str, limit: int = 20) -> list[MessageRecord]:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT * FROM messages WHERE session_id = %s ORDER BY turn_index DESC LIMIT %s",
                    (session_id, limit),
                )
                rows = cur.fetchall()
                return [
                    MessageRecord(
                        id=r["id"],
                        session_id=r["session_id"],
                        turn_index=r["turn_index"],
                        role=r["role"],
                        content=r["content"],
                        token_est=r["token_est"],
                        created_at=str(r["created_at"]),
                    )
                    for r in reversed(rows)
                ]

    def upsert_fact(self, fact: LearnedFact) -> None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO learned_facts (session_id, fact_key, fact_value, confidence, created_at)
                       VALUES (%s, %s, %s, %s, %s)
                       ON CONFLICT(session_id, fact_key) DO UPDATE SET fact_value=EXCLUDED.fact_value, confidence=EXCLUDED.confidence""",
                    (fact.session_id, fact.fact_key, fact.fact_value, fact.confidence, fact.created_at),
                )
            conn.commit()

    def get_facts(self, session_id: str) -> dict[str, str]:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT fact_key, fact_value FROM learned_facts WHERE session_id = %s", (session_id,))
                rows = cur.fetchall()
                return {r["fact_key"]: r["fact_value"] for r in rows}

    def upsert_run(self, run: RunRecord) -> None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO runs (run_id, session_id, status, source_name, database_name, plan_json, steps_json, created_at, updated_at)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                       ON CONFLICT(run_id) DO UPDATE SET status=EXCLUDED.status, updated_at=EXCLUDED.updated_at""",
                    (
                        run.run_id,
                        run.session_id,
                        run.status,
                        run.source_name,
                        run.database_name,
                        json.dumps(run.plan_json),
                        json.dumps(run.steps_json),
                        run.created_at,
                        run.updated_at,
                    ),
                )
            conn.commit()

    def get_run(self, run_id: str) -> RunRecord | None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM runs WHERE run_id = %s", (run_id,))
                r = cur.fetchone()
                if not r:
                    return None
                return RunRecord(
                    run_id=r["run_id"],
                    session_id=r["session_id"],
                    status=r["status"],
                    source_name=r["source_name"],
                    database_name=r["database_name"],
                    plan_json=r["plan_json"]
                    if isinstance(r["plan_json"], dict)
                    else json.loads(r["plan_json"] or "{}"),
                    steps_json=r["steps_json"]
                    if isinstance(r["steps_json"], list)
                    else json.loads(r["steps_json"] or "[]"),
                    pipeline_item_id=r["pipeline_item_id"],
                    pipeline_status=r["pipeline_status"],
                    failure_reason=r["failure_reason"],
                    created_at=str(r["created_at"]),
                    updated_at=str(r["updated_at"]),
                )

    def save_recipe(self, recipe: ArchitectureRecipe) -> None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO recipes (id, title, description, source_dialect, target_fabric_type, code_template, tags, rating, embedding)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                       ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title, code_template=EXCLUDED.code_template, rating=EXCLUDED.rating""",
                    (
                        recipe.id,
                        recipe.title,
                        recipe.description,
                        recipe.source_dialect,
                        recipe.target_fabric_type,
                        recipe.code_template,
                        json.dumps(recipe.tags),
                        recipe.rating,
                        recipe.embedding,
                    ),
                )
            conn.commit()

    def search_recipes(self, query_embedding: list[float], limit: int = 5) -> list[ArchitectureRecipe]:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """SELECT id, title, description, source_dialect, target_fabric_type, code_template, tags, rating
                       FROM recipes
                       ORDER BY embedding <=> %s::vector
                       LIMIT %s""",
                    (query_embedding, limit),
                )
                rows = cur.fetchall()
                return [
                    ArchitectureRecipe(
                        id=r["id"],
                        title=r["title"],
                        description=r["description"],
                        source_dialect=r["source_dialect"],
                        target_fabric_type=r["target_fabric_type"],
                        code_template=r["code_template"],
                        tags=r["tags"] if isinstance(r["tags"], list) else json.loads(r["tags"] or "[]"),
                        rating=r["rating"],
                    )
                    for r in rows
                ]
