"""
app/domain/storage/sqlite_adapter.py
------------------------------------
Concrete SQLite implementation of StorageAdapter with thread safety, WAL mode,
and in-memory cosine vector similarity for offline recipe retrieval.
"""

from __future__ import annotations

import json
import math
import sqlite3
import threading

from app.domain.models.session import (
    ArchitectureRecipe,
    LearnedFact,
    MessageRecord,
    RunRecord,
    SessionRecord,
)
from app.domain.storage.base import StorageAdapter

_SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS sessions (
    session_id   TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    last_active  TEXT NOT NULL,
    metadata     TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS messages (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    turn_index  INTEGER NOT NULL,
    role        TEXT NOT NULL,
    content     TEXT NOT NULL,
    token_est   INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, turn_index);

CREATE TABLE IF NOT EXISTS learned_facts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    fact_key    TEXT NOT NULL,
    fact_value  TEXT NOT NULL,
    confidence  REAL DEFAULT 1.0,
    created_at  TEXT NOT NULL,
    UNIQUE(session_id, fact_key)
);

CREATE TABLE IF NOT EXISTS runs (
    run_id           TEXT PRIMARY KEY,
    session_id       TEXT REFERENCES sessions(session_id),
    status           TEXT NOT NULL DEFAULT 'planned',
    source_name      TEXT,
    database_name    TEXT,
    plan_json        TEXT DEFAULT '{}',
    steps_json       TEXT DEFAULT '[]',
    pipeline_item_id TEXT,
    pipeline_status  TEXT,
    failure_reason   TEXT,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS recipes (
    id                 TEXT PRIMARY KEY,
    title              TEXT NOT NULL,
    description        TEXT NOT NULL,
    source_dialect     TEXT DEFAULT 'tsql',
    target_fabric_type TEXT DEFAULT 'lakehouse',
    code_template      TEXT NOT NULL,
    tags               TEXT DEFAULT '[]',
    rating             INTEGER DEFAULT 5,
    embedding_json     TEXT DEFAULT '[]'
);
"""


def _cosine_sim(v1: list[float], v2: list[float]) -> float:
    if not v1 or not v2 or len(v1) != len(v2):
        return 0.0
    dot = sum(a * b for a, b in zip(v1, v2, strict=False))
    norm_a = math.sqrt(sum(a * a for a in v1))
    norm_b = math.sqrt(sum(b * b for b in v2))
    return dot / (norm_a * norm_b) if norm_a and norm_b else 0.0


class SqliteStorageAdapter(StorageAdapter):
    """Local, single-file SQLite database adapter with in-memory test support."""

    def __init__(self, db_path: str = "fabric_ai_memory.db") -> None:
        self.db_path = db_path
        self._lock = threading.Lock()
        self._mem_conn: sqlite3.Connection | None = None
        if self.db_path == ":memory:":
            self._mem_conn = sqlite3.connect(":memory:", check_same_thread=False)
            self._mem_conn.row_factory = sqlite3.Row
        self.init_db()

    def _get_conn(self) -> sqlite3.Connection:
        if self._mem_conn is not None:
            return self._mem_conn
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        return conn

    def _close_conn(self, conn: sqlite3.Connection) -> None:
        if self._mem_conn is None:
            conn.close()

    def init_db(self) -> None:
        with self._lock:
            conn = self._get_conn()
            conn.executescript(_SCHEMA)
            conn.commit()
            self._close_conn(conn)

    def create_session(self, record: SessionRecord) -> SessionRecord:
        with self._lock:
            conn = self._get_conn()
            conn.execute(
                """INSERT INTO sessions (session_id, workspace_id, created_at, last_active, metadata)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(session_id) DO UPDATE SET last_active=excluded.last_active, metadata=excluded.metadata""",
                (
                    record.session_id,
                    record.workspace_id,
                    record.created_at,
                    record.last_active,
                    json.dumps(record.metadata),
                ),
            )
            conn.commit()
            self._close_conn(conn)
        return record

    def get_session(self, session_id: str) -> SessionRecord | None:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM sessions WHERE session_id=?", (session_id,)).fetchone()
        self._close_conn(conn)
        if not row:
            return None
        return SessionRecord(
            session_id=row["session_id"],
            workspace_id=row["workspace_id"],
            created_at=row["created_at"],
            last_active=row["last_active"],
            metadata=json.loads(row["metadata"] or "{}"),
        )

    def list_sessions(self, workspace_id: str | None = None) -> list[SessionRecord]:
        conn = self._get_conn()
        if workspace_id:
            rows = conn.execute(
                "SELECT * FROM sessions WHERE workspace_id=? ORDER BY last_active DESC", (workspace_id,)
            ).fetchall()
        else:
            rows = conn.execute("SELECT * FROM sessions ORDER BY last_active DESC").fetchall()
        self._close_conn(conn)
        return [
            SessionRecord(
                session_id=r["session_id"],
                workspace_id=r["workspace_id"],
                created_at=r["created_at"],
                last_active=r["last_active"],
                metadata=json.loads(r["metadata"] or "{}"),
            )
            for r in rows
        ]

    def add_message(self, message: MessageRecord) -> MessageRecord:
        with self._lock:
            conn = self._get_conn()
            row = conn.execute(
                "SELECT COALESCE(MAX(turn_index), -1) + 1 FROM messages WHERE session_id=?", (message.session_id,)
            ).fetchone()
            turn_index = row[0]
            cur = conn.execute(
                "INSERT INTO messages (session_id, turn_index, role, content, token_est, created_at) VALUES (?,?,?,?,?,?)",
                (message.session_id, turn_index, message.role, message.content, message.token_est, message.created_at),
            )
            message.id = cur.lastrowid
            message.turn_index = turn_index
            conn.commit()
            self._close_conn(conn)
        return message

    def get_messages(self, session_id: str, limit: int = 20) -> list[MessageRecord]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT * FROM messages WHERE session_id=? ORDER BY turn_index DESC LIMIT ?",
            (session_id, limit),
        ).fetchall()
        self._close_conn(conn)
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
            for r in reversed(rows)
        ]

    def upsert_fact(self, fact: LearnedFact) -> None:
        with self._lock:
            conn = self._get_conn()
            conn.execute(
                """INSERT INTO learned_facts (session_id, fact_key, fact_value, confidence, created_at)
                   VALUES (?, ?, ?, ?, ?)
                   ON CONFLICT(session_id, fact_key) DO UPDATE SET
                   fact_value=excluded.fact_value, confidence=excluded.confidence""",
                (fact.session_id, fact.fact_key, fact.fact_value, fact.confidence, fact.created_at),
            )
            conn.commit()
            self._close_conn(conn)

    def get_facts(self, session_id: str) -> dict[str, str]:
        conn = self._get_conn()
        rows = conn.execute(
            "SELECT fact_key, fact_value FROM learned_facts WHERE session_id=?", (session_id,)
        ).fetchall()
        self._close_conn(conn)
        return {r["fact_key"]: r["fact_value"] for r in rows}

    def upsert_run(self, run: RunRecord) -> None:
        with self._lock:
            conn = self._get_conn()
            conn.execute(
                """INSERT INTO runs (run_id, session_id, status, source_name, database_name, plan_json, steps_json, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(run_id) DO UPDATE SET status=excluded.status, updated_at=excluded.updated_at""",
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
            self._close_conn(conn)

    def get_run(self, run_id: str) -> RunRecord | None:
        conn = self._get_conn()
        row = conn.execute("SELECT * FROM runs WHERE run_id=?", (run_id,)).fetchone()
        self._close_conn(conn)
        if not row:
            return None
        return RunRecord(
            run_id=row["run_id"],
            session_id=row["session_id"],
            status=row["status"],
            source_name=row["source_name"],
            database_name=row["database_name"],
            plan_json=json.loads(row["plan_json"] or "{}"),
            steps_json=json.loads(row["steps_json"] or "[]"),
            pipeline_item_id=row["pipeline_item_id"],
            pipeline_status=row["pipeline_status"],
            failure_reason=row["failure_reason"],
            created_at=row["created_at"],
            updated_at=row["updated_at"],
        )

    def save_recipe(self, recipe: ArchitectureRecipe) -> None:
        with self._lock:
            conn = self._get_conn()
            conn.execute(
                """INSERT INTO recipes (id, title, description, source_dialect, target_fabric_type, code_template, tags, rating, embedding_json)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                   ON CONFLICT(id) DO UPDATE SET title=excluded.title, code_template=excluded.code_template, rating=excluded.rating""",
                (
                    recipe.id,
                    recipe.title,
                    recipe.description,
                    recipe.source_dialect,
                    recipe.target_fabric_type,
                    recipe.code_template,
                    json.dumps(recipe.tags),
                    recipe.rating,
                    json.dumps(recipe.embedding),
                ),
            )
            conn.commit()
            self._close_conn(conn)

    def search_recipes(self, query_embedding: list[float], limit: int = 5) -> list[ArchitectureRecipe]:
        conn = self._get_conn()
        rows = conn.execute("SELECT * FROM recipes").fetchall()
        self._close_conn(conn)

        scored: list[tuple[float, ArchitectureRecipe]] = []
        for r in rows:
            emb = json.loads(r["embedding_json"] or "[]")
            sim = _cosine_sim(query_embedding, emb) if query_embedding and emb else 0.0
            recipe = ArchitectureRecipe(
                id=r["id"],
                title=r["title"],
                description=r["description"],
                source_dialect=r["source_dialect"],
                target_fabric_type=r["target_fabric_type"],
                code_template=r["code_template"],
                tags=json.loads(r["tags"] or "[]"),
                rating=r["rating"],
                embedding=emb,
            )
            scored.append((sim, recipe))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item[1] for item in scored[:limit]]
