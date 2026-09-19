"""
app/storage/db.py
-----------------
SQLite database connection management, table schemas, and housekeeping.
Supports dynamic path resolution for isolated test fixtures.
"""

import os
import sqlite3
import sys
import threading
from datetime import UTC, datetime

# Database file placed at <project_root>/fabric_ai_memory.db
_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "fabric_ai_memory.db")
_db_lock = threading.Lock()

_SCHEMA = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS sessions (
    session_id   TEXT PRIMARY KEY,
    workspace_id TEXT NOT NULL,
    created_at   TEXT NOT NULL,
    last_active  TEXT NOT NULL,
    metadata     TEXT DEFAULT '{}'   -- JSON: browser info, user label, etc.
);

CREATE TABLE IF NOT EXISTS messages (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id    TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    turn_index    INTEGER NOT NULL,
    role          TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
    content       TEXT NOT NULL,
    token_est     INTEGER DEFAULT 0,  -- rough estimate for window trimming
    created_at    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id, turn_index);

CREATE TABLE IF NOT EXISTS runs (
    run_id           TEXT PRIMARY KEY,
    session_id       TEXT REFERENCES sessions(session_id),
    status           TEXT NOT NULL DEFAULT 'planned',
    source_id        TEXT,
    source_name      TEXT,
    database_name    TEXT,
    plan_json        TEXT,           -- full plan dict serialized
    steps_json       TEXT DEFAULT '[]',
    pipeline_item_id TEXT,
    pipeline_job_id  TEXT,
    pipeline_status  TEXT,
    failure_reason   TEXT,
    self_heal_needed INTEGER DEFAULT 0,
    error_context    TEXT,
    created_at       TEXT NOT NULL,
    updated_at       TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_runs_session ON runs(session_id);
CREATE INDEX IF NOT EXISTS idx_runs_status  ON runs(status);

CREATE TABLE IF NOT EXISTS learned_facts (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
    fact_key    TEXT NOT NULL,   -- e.g. 'preferred_schedule', 'source_database'
    fact_value  TEXT NOT NULL,
    confidence  REAL DEFAULT 1.0,
    created_at  TEXT NOT NULL,
    UNIQUE(session_id, fact_key)   -- one value per fact per session (upsert)
);

CREATE TABLE IF NOT EXISTS workspace_cache (
    workspace_id TEXT PRIMARY KEY,
    items_json   TEXT NOT NULL DEFAULT '[]',
    folders_json TEXT NOT NULL DEFAULT '[]',
    synced_at    TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    description TEXT DEFAULT '',
    is_pinned   INTEGER DEFAULT 0,
    is_archived INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL,
    updated_at  TEXT NOT NULL,
    metadata    TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS token_usage (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    session_id        TEXT,
    provider          TEXT NOT NULL,
    model             TEXT NOT NULL,
    prompt_tokens     INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens      INTEGER NOT NULL DEFAULT 0,
    cost_usd          REAL NOT NULL DEFAULT 0.0,
    duration_ms       REAL NOT NULL DEFAULT 0.0,
    complexity        TEXT DEFAULT 'standard',
    status            TEXT DEFAULT 'success',
    error_message     TEXT,
    created_at        TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_token_usage_session ON token_usage(session_id);
CREATE INDEX IF NOT EXISTS idx_token_usage_provider ON token_usage(provider);
CREATE INDEX IF NOT EXISTS idx_token_usage_model ON token_usage(model);
CREATE INDEX IF NOT EXISTS idx_token_usage_created ON token_usage(created_at);
"""


def get_db_path() -> str:
    """Dynamically resolves db path from facade if monkeypatched during tests."""
    ss = sys.modules.get("app.session_store")
    if ss is not None and hasattr(ss, "_DB_PATH"):
        return ss._DB_PATH
    return _DB_PATH


def _get_conn() -> sqlite3.Connection:
    """Returns a thread-local SQLite connection with row_factory set."""
    conn = sqlite3.connect(get_db_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Initialize the database and create all tables if they don't exist."""
    with _db_lock:
        conn = _get_conn()
        conn.executescript(_SCHEMA)
        conn.commit()
        conn.close()
    print(f"[MEMORY] Database initialized: {get_db_path()}")


def _now() -> str:
    return datetime.now(UTC).isoformat()


def get_db_stats() -> dict:
    """Returns row counts for all tables — useful for diagnostics."""
    conn = _get_conn()
    stats = {}
    for table in ("sessions", "messages", "runs", "learned_facts", "workspace_cache", "projects"):
        row = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()
        stats[table] = row[0]
    conn.close()
    return stats


def prune_old_sessions(days: int = 30) -> int:
    """Deletes sessions (and cascaded messages/facts) older than N days."""
    cutoff = datetime.now(UTC).replace(
        day=datetime.now(UTC).day - days
    ).isoformat()
    with _db_lock:
        conn = _get_conn()
        conn.execute("DELETE FROM sessions WHERE last_active < ?", (cutoff,))
        conn.commit()
        deleted = conn.total_changes
        conn.close()
    print(f"[MEMORY] Pruned {deleted} sessions older than {days} days.")
    return deleted
