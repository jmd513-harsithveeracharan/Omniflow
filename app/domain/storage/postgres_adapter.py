"""
app/domain/storage/postgres_adapter.py
--------------------------------------
Enterprise PostgreSQL + pgvector Concrete Storage Adapter for Fabric AI Studio (OmniFlow).
Implements the StorageAdapter abstract interface with native HNSW vector cosine search,
atomic transaction gates, JSONB indexing, and connection management.
"""

from __future__ import annotations

import json
import logging
import os
import threading
from datetime import UTC, datetime
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
from app.domain.storage.postgres_schema import PG_SCHEMA_DDL

logger = logging.getLogger("fabric_ai.storage.postgres")

try:
    import psycopg
    from psycopg.rows import dict_row
    _PSYCOPG_AVAILABLE = True
except ImportError:
    _PSYCOPG_AVAILABLE = False


class PostgresStorageAdapter(StorageAdapter):
    """
    Enterprise-grade PostgreSQL + pgvector storage adapter.
    """

    def __init__(self, connection_uri: str) -> None:
        if not _PSYCOPG_AVAILABLE:
            raise RuntimeError("psycopg v3 is not installed. Run 'pip install psycopg[binary,pool]'")
        self.connection_uri = connection_uri
        self._lock = threading.Lock()
        self.init_db()

    def _get_conn(self) -> psycopg.Connection:
        """Returns a connection to the PostgreSQL database with dict_row factory."""
        return psycopg.connect(self.connection_uri, row_factory=dict_row)
        """Returns a connection to the PostgreSQL database with dict_row factory and 10s connect timeout."""
        return psycopg.connect(self.connection_uri, row_factory=dict_row, connect_timeout=10)

    def init_db(self) -> None:
        """Initializes tables, pgvector extensions, and HNSW indexes with seamless migrations."""
        try:
            with self._get_conn() as conn:
                with conn.cursor() as cur:
                    # 1. Execute schema migrations for evolving columns
                    cur.execute("""
                        CREATE EXTENSION IF NOT EXISTS vector;
                        CREATE TABLE IF NOT EXISTS workspaces (
                            id TEXT PRIMARY KEY,
                            name TEXT NOT NULL,
                            capacity_id TEXT,
                            environment TEXT NOT NULL DEFAULT 'dev',
                            description TEXT DEFAULT '',
                            is_active INTEGER DEFAULT 1,
                            settings JSONB DEFAULT '{}'::jsonb,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                        );
                        CREATE TABLE IF NOT EXISTS team_members (
                            id TEXT PRIMARY KEY,
                            workspace_id TEXT REFERENCES workspaces(id) ON DELETE CASCADE,
                            email TEXT NOT NULL,
                            display_name TEXT NOT NULL,
                            role TEXT NOT NULL DEFAULT 'data_engineer',
                            entra_user_id TEXT,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                        );
                        CREATE TABLE IF NOT EXISTS projects (
                            id TEXT PRIMARY KEY,
                            name TEXT NOT NULL,
                            description TEXT DEFAULT '',
                            is_pinned INTEGER DEFAULT 0,
                            is_archived INTEGER DEFAULT 0,
                            metadata JSONB DEFAULT '{}'::jsonb,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                        );
                        ALTER TABLE projects ADD COLUMN IF NOT EXISTS workspace_id TEXT;
                        ALTER TABLE projects ADD COLUMN IF NOT EXISTS created_by TEXT;
                        ALTER TABLE projects ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active';
                        
                        CREATE TABLE IF NOT EXISTS sessions (
                            session_id TEXT PRIMARY KEY,
                            workspace_id TEXT NOT NULL,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            last_active TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            metadata JSONB DEFAULT '{}'::jsonb
                        );
                        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS project_id TEXT;
                        ALTER TABLE sessions ADD COLUMN IF NOT EXISTS user_id TEXT;

                        CREATE TABLE IF NOT EXISTS messages (
                            id BIGSERIAL PRIMARY KEY,
                            session_id TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
                            turn_index INTEGER NOT NULL,
                            role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
                            content TEXT NOT NULL,
                            token_est INTEGER DEFAULT 0,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                        );
                        ALTER TABLE messages ADD COLUMN IF NOT EXISTS thought_trace TEXT;

                        CREATE TABLE IF NOT EXISTS runs (
                            run_id TEXT PRIMARY KEY,
                            session_id TEXT REFERENCES sessions(session_id) ON DELETE SET NULL,
                            status TEXT NOT NULL DEFAULT 'planned',
                            source_id TEXT,
                            source_name TEXT,
                            database_name TEXT,
                            plan_json JSONB DEFAULT '{}'::jsonb,
                            steps_json JSONB DEFAULT '[]'::jsonb,
                            pipeline_item_id TEXT,
                            pipeline_job_id TEXT,
                            pipeline_status TEXT,
                            failure_reason TEXT,
                            self_heal_needed INTEGER DEFAULT 0,
                            error_context TEXT,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                        );
                        ALTER TABLE runs ADD COLUMN IF NOT EXISTS project_id TEXT;

                        CREATE TABLE IF NOT EXISTS token_usage (
                            id BIGSERIAL PRIMARY KEY,
                            session_id TEXT REFERENCES sessions(session_id) ON DELETE SET NULL,
                            provider TEXT NOT NULL,
                            model TEXT NOT NULL,
                            prompt_tokens INTEGER NOT NULL DEFAULT 0,
                            completion_tokens INTEGER NOT NULL DEFAULT 0,
                            total_tokens INTEGER NOT NULL DEFAULT 0,
                            cost_usd DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                            duration_ms DOUBLE PRECISION NOT NULL DEFAULT 0.0,
                            complexity TEXT DEFAULT 'standard',
                            status TEXT DEFAULT 'success',
                            error_message TEXT,
                            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                        );
                        ALTER TABLE token_usage ADD COLUMN IF NOT EXISTS run_id TEXT;

                        CREATE TABLE IF NOT EXISTS lineage_nodes (
                            id TEXT PRIMARY KEY,
                            name TEXT NOT NULL,
                            asset_type TEXT NOT NULL,
                            layer TEXT NOT NULL,
                            schema_definition JSONB DEFAULT '[]'::jsonb,
                            workspace_id TEXT,
                            metadata JSONB DEFAULT '{}'::jsonb,
                            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                        );
                        ALTER TABLE lineage_nodes ADD COLUMN IF NOT EXISTS parent_asset_id TEXT;
                    """)
                    conn.commit()
                    # 2. Run full schema DDL for all remaining tables & indexes
                    cur.execute(PG_SCHEMA_DDL)
                conn.commit()
            logger.info("[POSTGRES] Database initialized and schema verified.")
        except Exception as e:
            logger.warning(f"[POSTGRES] Schema initialization notice: {e}")

    # ── Sessions ──────────────────────────────────────────────────────────────

    def create_session(self, record: SessionRecord) -> SessionRecord:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO sessions (session_id, workspace_id, created_at, last_active, metadata)
                    VALUES (%(session_id)s, %(workspace_id)s, %(created_at)s, %(last_active)s, %(metadata)s)
                    ON CONFLICT (session_id) DO UPDATE SET
                        last_active = EXCLUDED.last_active,
                        metadata = EXCLUDED.metadata
                    """,
                    {
                        "session_id": record.session_id,
                        "workspace_id": record.workspace_id,
                        "created_at": record.created_at,
                        "last_active": record.last_active,
                        "metadata": json.dumps(record.metadata),
                    },
                )
            conn.commit()
        return record

    def get_session(self, session_id: str) -> SessionRecord | None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT session_id, workspace_id, created_at, last_active, metadata FROM sessions WHERE session_id = %s",
                    (session_id,),
                )
                row = cur.fetchone()
                if not row:
                    return None
                meta = row["metadata"] if isinstance(row["metadata"], dict) else json.loads(row["metadata"] or "{}")
                return SessionRecord(
                    session_id=row["session_id"],
                    workspace_id=row["workspace_id"],
                    created_at=row["created_at"],
                    last_active=row["last_active"],
                    metadata=meta,
                )

    def touch_session(self, session_id: str) -> None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("UPDATE sessions SET last_active = NOW() WHERE session_id = %s", (session_id,))
            conn.commit()

    def list_sessions(self, workspace_id: str | None = None) -> list[SessionRecord]:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                if workspace_id:
                    cur.execute(
                        "SELECT * FROM sessions WHERE workspace_id = %s ORDER BY last_active DESC",
                        (workspace_id,),
                    )
                else:
                    cur.execute("SELECT * FROM sessions ORDER BY last_active DESC")
                rows = cur.fetchall()
                res = []
                for r in rows:
                    meta = r["metadata"] if isinstance(r["metadata"], dict) else json.loads(r["metadata"] or "{}")
                    res.append(
                        SessionRecord(
                            session_id=r["session_id"],
                            workspace_id=r["workspace_id"],
                            created_at=r["created_at"],
                            last_active=r["last_active"],
                            metadata=meta,
                        )
                    )
                return res

    def list_conversations_with_metadata(self, workspace_id: str | None = None) -> list[dict[str, Any]]:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                query = """
                SELECT 
                    s.session_id,
                    s.workspace_id,
                    s.created_at,
                    s.last_active,
                    s.metadata,
                    COUNT(m.id) as message_count,
                    COALESCE((
                        SELECT content FROM messages 
                        WHERE session_id = s.session_id AND role = 'user' 
                        ORDER BY turn_index ASC LIMIT 1
                    ), 'New Chat') as first_user_message
                FROM sessions s
                LEFT JOIN messages m ON s.session_id = m.session_id
                """
                if workspace_id:
                    query += " WHERE s.workspace_id = %s GROUP BY s.session_id ORDER BY s.last_active DESC"
                    cur.execute(query, (workspace_id,))
                else:
                    query += " GROUP BY s.session_id ORDER BY s.last_active DESC"
                    cur.execute(query)
                
                rows = cur.fetchall()
                results = []
                for r in rows:
                    meta = r["metadata"] if isinstance(r["metadata"], dict) else json.loads(r["metadata"] or "{}")
                    custom_title = meta.get("title")
                    title = custom_title or r["first_user_message"][:40]
                    results.append({
                        "session_id": r["session_id"],
                        "workspace_id": r["workspace_id"],
                        "title": title,
                        "created_at": str(r["created_at"]),
                        "last_active": str(r["last_active"]),
                        "message_count": r["message_count"],
                        "metadata": meta,
                    })
                return results

    def rename_conversation(self, session_id: str, title: str) -> bool:
        session = self.get_session(session_id)
        if not session:
            return False
        session.metadata["title"] = title.strip()
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "UPDATE sessions SET metadata = %s WHERE session_id = %s",
                    (json.dumps(session.metadata), session_id),
                )
            conn.commit()
        return True

    def delete_conversation(self, session_id: str) -> bool:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM sessions WHERE session_id = %s", (session_id,))
                affected = cur.rowcount
            conn.commit()
        return affected > 0

    # ── Messages ──────────────────────────────────────────────────────────────

    def add_message(self, message: MessageRecord) -> MessageRecord:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO messages (session_id, turn_index, role, content, token_est, created_at)
                    VALUES (%(session_id)s, %(turn_index)s, %(role)s, %(content)s, %(token_est)s, %(created_at)s)
                    RETURNING id
                    """,
                    {
                        "session_id": message.session_id,
                        "turn_index": message.turn_index,
                        "role": message.role,
                        "content": message.content,
                        "token_est": message.token_est,
                        "created_at": message.created_at,
                    },
                )
                row = cur.fetchone()
                if row:
                    message.id = row["id"]
                cur.execute("UPDATE sessions SET last_active = NOW() WHERE session_id = %s", (message.session_id,))
            conn.commit()
        return message

    def get_messages(self, session_id: str, limit: int = 50) -> list[MessageRecord]:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, session_id, turn_index, role, content, token_est, created_at
                    FROM messages
                    WHERE session_id = %s
                    ORDER BY turn_index ASC
                    LIMIT %s
                    """,
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
                        created_at=r["created_at"],
                    )
                    for r in rows
                ]

    def truncate_messages_from(self, session_id: str, turn_index: int) -> int:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    "DELETE FROM messages WHERE session_id = %s AND turn_index >= %s",
                    (session_id, turn_index),
                )
                deleted = cur.rowcount
            conn.commit()
        return deleted

    # ── Learned Facts ─────────────────────────────────────────────────────────

    def upsert_fact(self, fact: LearnedFact) -> None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO learned_facts (session_id, fact_key, fact_value, confidence, created_at)
                    VALUES (%(session_id)s, %(fact_key)s, %(fact_value)s, %(confidence)s, %(created_at)s)
                    ON CONFLICT (session_id, fact_key) DO UPDATE SET
                        fact_value = EXCLUDED.fact_value,
                        confidence = EXCLUDED.confidence
                    """,
                    {
                        "session_id": fact.session_id,
                        "fact_key": fact.fact_key,
                        "fact_value": fact.fact_value,
                        "confidence": fact.confidence,
                        "created_at": fact.created_at,
                    },
                )
            conn.commit()

    def get_facts(self, session_id: str) -> dict[str, str]:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT fact_key, fact_value FROM learned_facts WHERE session_id = %s", (session_id,))
                return {row["fact_key"]: row["fact_value"] for row in cur.fetchall()}

    # ── Runs & Deployment State ───────────────────────────────────────────────

    def upsert_run(self, run: RunRecord) -> None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO runs (
                        run_id, session_id, status, source_name, database_name,
                        plan_json, steps_json, pipeline_item_id, failure_reason,
                        created_at, updated_at
                    ) VALUES (
                        %(run_id)s, %(session_id)s, %(status)s, %(source_name)s, %(database_name)s,
                        %(plan_json)s, %(steps_json)s, %(pipeline_item_id)s, %(failure_reason)s,
                        %(created_at)s, %(updated_at)s
                    )
                    ON CONFLICT (run_id) DO UPDATE SET
                        status = EXCLUDED.status,
                        plan_json = EXCLUDED.plan_json,
                        steps_json = EXCLUDED.steps_json,
                        pipeline_item_id = EXCLUDED.pipeline_item_id,
                        failure_reason = EXCLUDED.failure_reason,
                        updated_at = EXCLUDED.updated_at
                    """,
                    {
                        "run_id": run.run_id,
                        "session_id": run.session_id,
                        "status": run.status,
                        "source_name": run.source_name,
                        "database_name": run.database_name,
                        "plan_json": json.dumps(run.plan_json),
                        "steps_json": json.dumps(run.steps_json),
                        "pipeline_item_id": run.pipeline_item_id,
                        "failure_reason": run.failure_reason,
                        "created_at": run.created_at,
                        "updated_at": run.updated_at,
                    },
                )
            conn.commit()

    def get_run(self, run_id: str) -> RunRecord | None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM runs WHERE run_id = %s", (run_id,))
                row = cur.fetchone()
                if not row:
                    return None
                plan = row["plan_json"] if isinstance(row["plan_json"], dict) else json.loads(row["plan_json"] or "{}")
                steps = row["steps_json"] if isinstance(row["steps_json"], list) else json.loads(row["steps_json"] or "[]")
                return RunRecord(
                    run_id=row["run_id"],
                    session_id=row["session_id"],
                    status=row["status"],
                    source_name=row["source_name"],
                    database_name=row["database_name"],
                    plan_json=plan,
                    steps_json=steps,
                    pipeline_item_id=row["pipeline_item_id"],
                    failure_reason=row["failure_reason"],
                    created_at=row["created_at"],
                    updated_at=row["updated_at"],
                )

    # ── Architecture Recipes & Vector Search ──────────────────────────────────

    def save_recipe(self, recipe: ArchitectureRecipe) -> None:
        emb_str = f"[{','.join(str(x) for x in recipe.embedding)}]" if recipe.embedding else None
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO recipes (id, title, description, source_dialect, target_fabric_type, code_template, tags, rating, embedding)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s::vector)
                    ON CONFLICT (id) DO UPDATE SET
                        title = EXCLUDED.title,
                        description = EXCLUDED.description,
                        code_template = EXCLUDED.code_template,
                        rating = EXCLUDED.rating,
                        embedding = EXCLUDED.embedding
                    """,
                    (
                        recipe.id, recipe.title, recipe.description, recipe.source_dialect,
                        recipe.target_fabric_type, recipe.code_template, json.dumps(recipe.tags),
                        recipe.rating, emb_str
                    ),
                )
            conn.commit()

    def search_recipes(self, query_embedding: list[float], limit: int = 5) -> list[ArchitectureRecipe]:
        if not query_embedding:
            return []
        emb_str = f"[{','.join(str(x) for x in query_embedding)}]"
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, title, description, source_dialect, target_fabric_type, code_template, tags, rating
                    FROM recipes
                    WHERE embedding IS NOT NULL
                    ORDER BY embedding <=> %s::vector ASC
                    LIMIT %s
                    """,
                    (emb_str, limit),
                )
                rows = cur.fetchall()
                res = []
                for r in rows:
                    tags = r["tags"] if isinstance(r["tags"], list) else json.loads(r["tags"] or "[]")
                    res.append(
                        ArchitectureRecipe(
                            id=r["id"],
                            title=r["title"],
                            description=r["description"],
                            source_dialect=r["source_dialect"],
                            target_fabric_type=r["target_fabric_type"],
                            code_template=r["code_template"],
                            tags=tags,
                            rating=r["rating"],
                        )
                    )
                return res

    def upsert_recipe(self, recipe: ArchitectureRecipe) -> None:
        """Alias for save_recipe for seamless backwards compatibility."""
        self.save_recipe(recipe)

    def search_similar_recipes(self, query_embedding: list[float], top_k: int = 5) -> list[dict[str, Any]]:
        """Vector similarity search returning dictionary records with similarity_score."""
        if not query_embedding:
            return []
        emb_str = f"[{','.join(str(x) for x in query_embedding)}]"
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT id, title, description, source_dialect, target_fabric_type, code_template, tags, rating,
                           (1.0 - (embedding <=> %s::vector)) as similarity_score
                    FROM recipes
                    WHERE embedding IS NOT NULL
                    ORDER BY embedding <=> %s::vector ASC
                    LIMIT %s
                    """,
                    (emb_str, emb_str, top_k),
                )
                rows = cur.fetchall()
                res = []
                for r in rows:
                    tags = r["tags"] if isinstance(r["tags"], list) else json.loads(r["tags"] or "[]")
                    res.append({
                        "id": r["id"],
                        "title": r["title"],
                        "description": r["description"],
                        "source_dialect": r["source_dialect"],
                        "target_fabric_type": r["target_fabric_type"],
                        "code_template": r["code_template"],
                        "tags": tags,
                        "rating": r["rating"],
                        "similarity_score": float(r.get("similarity_score", 1.0)),
                    })
                return res

    # ── Master Project Ledger & Vector Memory ─────────────────────────────────

    def commit_completed_project(self, project: ProjectLedgerRecord) -> None:
        emb_str = f"[{','.join(str(x) for x in project.embedding)}]" if project.embedding else None
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO project_ledger (
                        project_id, project_name, workspace_id, status, summary,
                        workstreams, lineage_dag, table_catalog, adrs, embedding, committed_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s::vector, %s)
                    ON CONFLICT (project_id) DO UPDATE SET
                        project_name = EXCLUDED.project_name,
                        status = EXCLUDED.status,
                        summary = EXCLUDED.summary,
                        workstreams = EXCLUDED.workstreams,
                        lineage_dag = EXCLUDED.lineage_dag,
                        table_catalog = EXCLUDED.table_catalog,
                        adrs = EXCLUDED.adrs,
                        embedding = EXCLUDED.embedding,
                        committed_at = EXCLUDED.committed_at
                    """,
                    (
                        project.project_id, project.project_name, project.workspace_id,
                        project.status, project.summary, json.dumps(project.workstreams),
                        json.dumps(project.lineage_dag), json.dumps(project.table_catalog),
                        json.dumps(project.adrs), emb_str, project.committed_at
                    ),
                )
            conn.commit()

    def get_completed_project(self, project_id: str) -> ProjectLedgerRecord | None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM project_ledger WHERE project_id = %s", (project_id,))
                row = cur.fetchone()
                if not row:
                    return None
                return ProjectLedgerRecord(
                    project_id=row["project_id"],
                    project_name=row["project_name"],
                    workspace_id=row["workspace_id"],
                    status=row["status"],
                    summary=row["summary"],
                    workstreams=row["workstreams"] if isinstance(row["workstreams"], list) else json.loads(row["workstreams"] or "[]"),
                    lineage_dag=row["lineage_dag"] if isinstance(row["lineage_dag"], dict) else json.loads(row["lineage_dag"] or "{}"),
                    table_catalog=row["table_catalog"] if isinstance(row["table_catalog"], list) else json.loads(row["table_catalog"] or "[]"),
                    adrs=row["adrs"] if isinstance(row["adrs"], list) else json.loads(row["adrs"] or "[]"),
                    committed_at=row["committed_at"],
                )

    def list_completed_projects(self, workspace_id: str | None = None) -> list[ProjectLedgerRecord]:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                if workspace_id:
                    cur.execute("SELECT * FROM project_ledger WHERE workspace_id = %s ORDER BY committed_at DESC", (workspace_id,))
                else:
                    cur.execute("SELECT * FROM project_ledger ORDER BY committed_at DESC")
                rows = cur.fetchall()
                res = []
                for row in rows:
                    res.append(
                        ProjectLedgerRecord(
                            project_id=row["project_id"],
                            project_name=row["project_name"],
                            workspace_id=row["workspace_id"],
                            status=row["status"],
                            summary=row["summary"],
                            workstreams=row["workstreams"] if isinstance(row["workstreams"], list) else json.loads(row["workstreams"] or "[]"),
                            lineage_dag=row["lineage_dag"] if isinstance(row["lineage_dag"], dict) else json.loads(row["lineage_dag"] or "{}"),
                            table_catalog=row["table_catalog"] if isinstance(row["table_catalog"], list) else json.loads(row["table_catalog"] or "[]"),
                            adrs=row["adrs"] if isinstance(row["adrs"], list) else json.loads(row["adrs"] or "[]"),
                            committed_at=row["committed_at"],
                        )
                    )
                return res

    def search_completed_projects(self, query_embedding: list[float], limit: int = 5) -> list[ProjectLedgerRecord]:
        if not query_embedding:
            return []
        emb_str = f"[{','.join(str(x) for x in query_embedding)}]"
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT * FROM project_ledger
                    WHERE embedding IS NOT NULL
                    ORDER BY embedding <=> %s::vector ASC
                    LIMIT %s
                    """,
                    (emb_str, limit),
                )
                rows = cur.fetchall()
                res = []
                for row in rows:
                    res.append(
                        ProjectLedgerRecord(
                            project_id=row["project_id"],
                            project_name=row["project_name"],
                            workspace_id=row["workspace_id"],
                            status=row["status"],
                            summary=row["summary"],
                            workstreams=row["workstreams"] if isinstance(row["workstreams"], list) else json.loads(row["workstreams"] or "[]"),
                            lineage_dag=row["lineage_dag"] if isinstance(row["lineage_dag"], dict) else json.loads(row["lineage_dag"] or "{}"),
                            table_catalog=row["table_catalog"] if isinstance(row["table_catalog"], list) else json.loads(row["table_catalog"] or "[]"),
                            adrs=row["adrs"] if isinstance(row["adrs"], list) else json.loads(row["adrs"] or "[]"),
                            committed_at=row["committed_at"],
                        )
                    )
                return res

    # ── Project CRUD Helper Methods ───────────────────────────────────────────

    def create_project(self, name: str, description: str = "", metadata: dict | None = None) -> dict[str, Any]:
        import uuid
        project_id = f"proj_{uuid.uuid4().hex[:8]}"
        now = datetime.now(UTC).isoformat()
        meta = metadata or {}
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO projects (id, name, description, is_pinned, is_archived, metadata, created_at, updated_at)
                    VALUES (%s, %s, %s, 0, 0, %s, %s, %s)
                    """,
                    (project_id, name.strip(), description.strip(), json.dumps(meta), now, now),
                )
            conn.commit()
        return {
            "id": project_id,
            "name": name.strip(),
            "description": description.strip(),
            "is_pinned": 0,
            "is_archived": 0,
            "metadata": meta,
            "created_at": now,
            "updated_at": now,
        }

    def get_all_projects(self) -> list[dict[str, Any]]:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM projects WHERE is_archived = 0 ORDER BY is_pinned DESC, updated_at DESC")
                rows = cur.fetchall()
                res = []
                for r in rows:
                    meta = r["metadata"] if isinstance(r["metadata"], dict) else json.loads(r["metadata"] or "{}")
                    res.append({
                        "id": r["id"],
                        "name": r["name"],
                        "description": r["description"],
                        "is_pinned": r["is_pinned"],
                        "is_archived": r["is_archived"],
                        "metadata": meta,
                        "created_at": str(r["created_at"]),
                        "updated_at": str(r["updated_at"]),
                    })
                return res

    def get_project(self, project_id: str) -> dict[str, Any] | None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM projects WHERE id = %s", (project_id,))
                r = cur.fetchone()
                if not r:
                    return None
                meta = r["metadata"] if isinstance(r["metadata"], dict) else json.loads(r["metadata"] or "{}")
                return {
                    "id": r["id"],
                    "name": r["name"],
                    "description": r["description"],
                    "is_pinned": r["is_pinned"],
                    "is_archived": r["is_archived"],
                    "metadata": meta,
                    "created_at": str(r["created_at"]),
                    "updated_at": str(r["updated_at"]),
                }

    def update_project(
        self,
        project_id: str,
        name: str | None = None,
        description: str | None = None,
        is_pinned: int | None = None,
        is_archived: int | None = None,
    ) -> bool:
        fields = []
        values = []
        if name is not None:
            fields.append("name = %s")
            values.append(name.strip())
        if description is not None:
            fields.append("description = %s")
            values.append(description.strip())
        if is_pinned is not None:
            fields.append("is_pinned = %s")
            values.append(int(is_pinned))
        if is_archived is not None:
            fields.append("is_archived = %s")
            values.append(int(is_archived))

        if not fields:
            return False

        fields.append("updated_at = NOW()")
        values.append(project_id)

        query = f"UPDATE projects SET {', '.join(fields)} WHERE id = %s"
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(query, tuple(values))
                affected = cur.rowcount
            conn.commit()
        return affected > 0

    def delete_project(self, project_id: str) -> bool:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("DELETE FROM projects WHERE id = %s", (project_id,))
                affected = cur.rowcount
            conn.commit()
        return affected > 0

    # ── Token Usage & Auditor ─────────────────────────────────────────────────

    def record_token_usage(
        self,
        provider: str,
        model: str,
        prompt_tokens: int,
        completion_tokens: int,
        total_tokens: int,
        cost_usd: float,
        duration_ms: float,
        session_id: str | None = None,
        complexity: str = "standard",
        status: str = "success",
        error_message: str | None = None,
    ) -> None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO token_usage (
                        session_id, provider, model, prompt_tokens, completion_tokens,
                        total_tokens, cost_usd, duration_ms, complexity, status, error_message
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        session_id, provider, model, prompt_tokens, completion_tokens,
                        total_tokens, cost_usd, duration_ms, complexity, status, error_message
                    ),
                )
            conn.commit()

    def get_token_usage_summary(self, session_id: str | None = None) -> dict[str, Any]:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                if session_id:
                    cur.execute(
                        """
                        SELECT 
                            COUNT(*) as total_calls,
                            COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
                            COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
                            COALESCE(SUM(total_tokens), 0) as total_tokens,
                            COALESCE(SUM(cost_usd), 0.0) as estimated_cost_usd,
                            COALESCE(AVG(duration_ms), 0.0) as avg_duration_ms
                        FROM token_usage WHERE session_id = %s
                        """,
                        (session_id,),
                    )
                else:
                    cur.execute(
                        """
                        SELECT 
                            COUNT(*) as total_calls,
                            COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
                            COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
                            COALESCE(SUM(total_tokens), 0) as total_tokens,
                            COALESCE(SUM(cost_usd), 0.0) as estimated_cost_usd,
                            COALESCE(AVG(duration_ms), 0.0) as avg_duration_ms
                        FROM token_usage
                        """
                    )
                row = cur.fetchone()
                return dict(row) if row else {
                    "total_calls": 0, "total_prompt_tokens": 0, "total_completion_tokens": 0,
                    "total_tokens": 0, "estimated_cost_usd": 0.0, "avg_duration_ms": 0.0
                }

    # ── Workspace Cache & Stats ───────────────────────────────────────────────

    def update_workspace_cache(self, workspace_id: str, items: list, folders: list) -> None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute(
                    """
                    INSERT INTO workspace_cache (workspace_id, items_json, folders_json, synced_at)
                    VALUES (%s, %s, %s, NOW())
                    ON CONFLICT (workspace_id) DO UPDATE SET
                        items_json = EXCLUDED.items_json,
                        folders_json = EXCLUDED.folders_json,
                        synced_at = EXCLUDED.synced_at
                    """,
                    (workspace_id, json.dumps(items), json.dumps(folders)),
                )
            conn.commit()

    def get_workspace_cache(self, workspace_id: str) -> dict[str, Any] | None:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT * FROM workspace_cache WHERE workspace_id = %s", (workspace_id,))
                row = cur.fetchone()
                if not row:
                    return None
                items = row["items_json"] if isinstance(row["items_json"], list) else json.loads(row["items_json"] or "[]")
                folders = row["folders_json"] if isinstance(row["folders_json"], list) else json.loads(row["folders_json"] or "[]")
                return {
                    "workspace_id": row["workspace_id"],
                    "items": items,
                    "folders": folders,
                    "synced_at": str(row["synced_at"]),
                }

    def get_db_stats(self) -> dict[str, int]:
        with self._get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT COUNT(*) as cnt FROM sessions")
                sessions_cnt = cur.fetchone()["cnt"]
                cur.execute("SELECT COUNT(*) as cnt FROM messages")
                messages_cnt = cur.fetchone()["cnt"]
                cur.execute("SELECT COUNT(*) as cnt FROM runs")
                runs_cnt = cur.fetchone()["cnt"]
                cur.execute("SELECT COUNT(*) as cnt FROM projects")
                projects_cnt = cur.fetchone()["cnt"]
                cur.execute("SELECT COUNT(*) as cnt FROM token_usage")
                token_cnt = cur.fetchone()["cnt"]
                return {
                    "sessions": sessions_cnt,
                    "messages": messages_cnt,
                    "runs": runs_cnt,
                    "projects": projects_cnt,
                    "token_records": token_cnt,
                }
