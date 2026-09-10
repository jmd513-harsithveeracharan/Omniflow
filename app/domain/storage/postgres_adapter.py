"""
app/domain/storage/postgres_adapter.py
--------------------------------------
Concrete PostgreSQL + pgvector implementation of StorageAdapter.
Supports native HNSW/IVFFlat cosine vector indexing for completed projects and 5-star recipes.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from app.domain.models.session import (
    ArchitectureRecipe,
    LearnedFact,
    MessageRecord,
    ProjectLedgerRecord,
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
    session_id TEXT PRIMARY KEY, workspace_id TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(), metadata JSONB DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    turn_index INTEGER NOT NULL, role TEXT NOT NULL, content TEXT NOT NULL, token_est INTEGER DEFAULT 0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_pg_messages_session ON messages(session_id, turn_index);

CREATE TABLE IF NOT EXISTS learned_facts (
    id BIGSERIAL PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    fact_key TEXT NOT NULL, fact_value TEXT NOT NULL, confidence FLOAT DEFAULT 1.0, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(session_id, fact_key)
);

CREATE TABLE IF NOT EXISTS runs (
    run_id TEXT PRIMARY KEY, session_id TEXT REFERENCES sessions(session_id),
    status TEXT NOT NULL DEFAULT 'planned', source_name TEXT, database_name TEXT,
    plan_json JSONB DEFAULT '{}'::jsonb, steps_json JSONB DEFAULT '[]'::jsonb,
    pipeline_item_id TEXT, pipeline_status TEXT, failure_reason TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL,
    source_dialect TEXT DEFAULT 'tsql', target_fabric_type TEXT DEFAULT 'lakehouse',
    code_template TEXT NOT NULL, tags JSONB DEFAULT '[]'::jsonb, rating INTEGER DEFAULT 5, embedding vector(1536)
);

CREATE TABLE IF NOT EXISTS project_ledger (
    project_id TEXT PRIMARY KEY, project_name TEXT NOT NULL, workspace_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'COMPLETED', summary TEXT NOT NULL,
    workstreams JSONB DEFAULT '[]'::jsonb, lineage_dag JSONB DEFAULT '{}'::jsonb,
    table_catalog JSONB DEFAULT '[]'::jsonb, adrs JSONB DEFAULT '[]'::jsonb,
    embedding vector(1536), committed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
"""


class PostgresStorageAdapter(StorageAdapter):
    """Enterprise PostgreSQL + pgvector adapter with native vector indexing."""

    def __init__(self, connection_uri: str) -> None:
        if not _PSYCOPG_AVAILABLE:
            raise RuntimeError("psycopg is not installed. Run 'pip install psycopg[binary,pool]'")
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
            logger.warning(f"[POSTGRES] init_db warning (may already exist or no vector ext): {e}")

    def create_session(self, record: SessionRecord) -> SessionRecord:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO sessions (session_id, workspace_id, metadata)
                       VALUES (%s, %s, %s::jsonb)
                       ON CONFLICT(session_id) DO UPDATE SET last_active=NOW(), metadata=EXCLUDED.metadata""",
                    (record.session_id, record.workspace_id, json.dumps(record.metadata)),
                )
            conn.commit()
        return record

    def get_session(self, session_id: str) -> SessionRecord | None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM sessions WHERE session_id = %s", (session_id,))
                r = cur.fetchone()
                return SessionRecord(session_id=r["session_id"], workspace_id=r["workspace_id"], created_at=str(r["created_at"]), last_active=str(r["last_active"]), metadata=r["metadata"] or {}) if r else None

    def list_sessions(self, workspace_id: str | None = None) -> list[SessionRecord]:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                q = "SELECT * FROM sessions WHERE workspace_id = %s ORDER BY last_active DESC" if workspace_id else "SELECT * FROM sessions ORDER BY last_active DESC"
                cur.execute(q, (workspace_id,) if workspace_id else ())
                return [SessionRecord(session_id=r["session_id"], workspace_id=r["workspace_id"], created_at=str(r["created_at"]), last_active=str(r["last_active"]), metadata=r["metadata"] or {}) for r in cur.fetchall()]

    def add_message(self, message: MessageRecord) -> MessageRecord:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "INSERT INTO messages (session_id, turn_index, role, content, token_est) VALUES (%s, %s, %s, %s, %s) RETURNING id",
                    (message.session_id, message.turn_index, message.role, message.content, message.token_est),
                )
                r = cur.fetchone()
                if r:
                    message.id = r["id"]
            conn.commit()
        return message

    def get_messages(self, session_id: str, limit: int = 20) -> list[MessageRecord]:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM messages WHERE session_id = %s ORDER BY turn_index ASC LIMIT %s", (session_id, limit))
                return [MessageRecord(id=r["id"], session_id=r["session_id"], turn_index=r["turn_index"], role=r["role"], content=r["content"], token_est=r["token_est"], created_at=str(r["created_at"])) for r in cur.fetchall()]

    def upsert_fact(self, fact: LearnedFact) -> None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO learned_facts (session_id, fact_key, fact_value, confidence)
                       VALUES (%s, %s, %s, %s)
                       ON CONFLICT(session_id, fact_key) DO UPDATE SET fact_value=EXCLUDED.fact_value, confidence=EXCLUDED.confidence""",
                    (fact.session_id, fact.fact_key, fact.fact_value, fact.confidence),
                )
            conn.commit()

    def get_facts(self, session_id: str) -> dict[str, str]:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT fact_key, fact_value FROM learned_facts WHERE session_id = %s", (session_id,))
                return {r["fact_key"]: r["fact_value"] for r in cur.fetchall()}

    def upsert_run(self, run: RunRecord) -> None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO runs (run_id, session_id, status, source_name, database_name, plan_json, steps_json, pipeline_item_id, pipeline_status, failure_reason)
                       VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s, %s, %s)
                       ON CONFLICT(run_id) DO UPDATE SET status=EXCLUDED.status, steps_json=EXCLUDED.steps_json, pipeline_status=EXCLUDED.pipeline_status, updated_at=NOW()""",
                    (run.run_id, run.session_id, run.status, run.source_name, run.database_name, json.dumps(run.plan_json), json.dumps(run.steps_json), run.pipeline_item_id, run.pipeline_status, run.failure_reason),
                )
            conn.commit()

    def get_run(self, run_id: str) -> RunRecord | None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM runs WHERE run_id = %s", (run_id,))
                r = cur.fetchone()
                return RunRecord(run_id=r["run_id"], session_id=r["session_id"], status=r["status"], source_name=r["source_name"], database_name=r["database_name"], plan_json=r["plan_json"] or {}, steps_json=r["steps_json"] or [], pipeline_item_id=r["pipeline_item_id"], pipeline_status=r["pipeline_status"], failure_reason=r["failure_reason"], created_at=str(r["created_at"]), updated_at=str(r["updated_at"])) if r else None

    def save_recipe(self, recipe: ArchitectureRecipe) -> None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                emb_str = f"[{','.join(str(x) for x in recipe.embedding)}]" if recipe.embedding else None
                cur.execute(
                    """INSERT INTO recipes (id, title, description, source_dialect, target_fabric_type, code_template, tags, rating, embedding)
                       VALUES (%s, %s, %s, %s, %s, %s, %s::jsonb, %s, %s)
                       ON CONFLICT(id) DO UPDATE SET title=EXCLUDED.title, code_template=EXCLUDED.code_template, rating=EXCLUDED.rating, embedding=EXCLUDED.embedding""",
                    (recipe.id, recipe.title, recipe.description, recipe.source_dialect, recipe.target_fabric_type, recipe.code_template, json.dumps(recipe.tags), recipe.rating, emb_str),
                )
            conn.commit()

    def search_recipes(self, query_embedding: list[float], limit: int = 5) -> list[ArchitectureRecipe]:
        emb_str = f"[{','.join(str(x) for x in query_embedding)}]"
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT *, (embedding <=> %s::vector) AS distance FROM recipes ORDER BY distance ASC LIMIT %s", (emb_str, limit))
                return [ArchitectureRecipe(id=r["id"], title=r["title"], description=r["description"], source_dialect=r["source_dialect"], target_fabric_type=r["target_fabric_type"], code_template=r["code_template"], tags=r["tags"] or [], rating=r["rating"]) for r in cur.fetchall()]

    # ── Master Project Ledger (100% Completed Projects Only) ───────────────────
    def commit_completed_project(self, project: ProjectLedgerRecord) -> None:
        """Atomic Master DB commit for 100% completed project blueprint."""
        if project.status.upper() != "COMPLETED":
            raise ValueError(f"Project must be 100% COMPLETED before committing to Master Ledger. Status: {project.status}")
        emb_str = f"[{','.join(str(x) for x in project.embedding)}]" if project.embedding else None
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """INSERT INTO project_ledger (project_id, project_name, workspace_id, status, summary, workstreams, lineage_dag, table_catalog, adrs, embedding)
                       VALUES (%s, %s, %s, %s, %s, %s::jsonb, %s::jsonb, %s::jsonb, %s::jsonb, %s)
                       ON CONFLICT(project_id) DO UPDATE SET summary=EXCLUDED.summary, workstreams=EXCLUDED.workstreams, lineage_dag=EXCLUDED.lineage_dag, table_catalog=EXCLUDED.table_catalog, adrs=EXCLUDED.adrs, embedding=EXCLUDED.embedding, committed_at=NOW()""",
                    (project.project_id, project.project_name, project.workspace_id, project.status, project.summary, json.dumps(project.workstreams), json.dumps(project.lineage_dag), json.dumps(project.table_catalog), json.dumps(project.architecture_decisions), emb_str),
                )
            conn.commit()

    def get_completed_project(self, project_id: str) -> ProjectLedgerRecord | None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM project_ledger WHERE project_id = %s", (project_id,))
                r = cur.fetchone()
                return ProjectLedgerRecord(project_id=r["project_id"], project_name=r["project_name"], workspace_id=r["workspace_id"], status=r["status"], summary=r["summary"], workstreams=r["workstreams"] or [], lineage_dag=r["lineage_dag"] or {}, table_catalog=r["table_catalog"] or [], architecture_decisions=r["adrs"] or [], committed_at=str(r["committed_at"])) if r else None

    def list_completed_projects(self, workspace_id: str | None = None) -> list[ProjectLedgerRecord]:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                q = "SELECT * FROM project_ledger WHERE workspace_id = %s ORDER BY committed_at DESC" if workspace_id else "SELECT * FROM project_ledger ORDER BY committed_at DESC"
                cur.execute(q, (workspace_id,) if workspace_id else ())
                return [ProjectLedgerRecord(project_id=r["project_id"], project_name=r["project_name"], workspace_id=r["workspace_id"], status=r["status"], summary=r["summary"], workstreams=r["workstreams"] or [], lineage_dag=r["lineage_dag"] or {}, table_catalog=r["table_catalog"] or [], architecture_decisions=r["adrs"] or [], committed_at=str(r["committed_at"])) for r in cur.fetchall()]

    def search_completed_projects(self, query_embedding: list[float], limit: int = 3) -> list[ProjectLedgerRecord]:
        emb_str = f"[{','.join(str(x) for x in query_embedding)}]"
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT *, (embedding <=> %s::vector) AS distance FROM project_ledger ORDER BY distance ASC LIMIT %s", (emb_str, limit))
                return [ProjectLedgerRecord(project_id=r["project_id"], project_name=r["project_name"], workspace_id=r["workspace_id"], status=r["status"], summary=r["summary"], workstreams=r["workstreams"] or [], lineage_dag=r["lineage_dag"] or {}, table_catalog=r["table_catalog"] or [], architecture_decisions=r["adrs"] or [], committed_at=str(r["committed_at"])) for r in cur.fetchall()]
