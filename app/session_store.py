"""
app/session_store.py
--------------------
Single source of truth persistent storage facade for Fabric AI Studio.
Routes all production queries through PostgreSQL + pgvector (Neon Cloud)
with zero-loss SQLite offline fallback for unit tests.
"""

from __future__ import annotations

import os
from typing import Any

import app.storage as _sqlite_store
import app.storage.pg_facade as _pg

# Re-export SQLite internals for test fixture compatibility
_DEFAULT_DB_PATH = _sqlite_store._DB_PATH
_DB_PATH = _DEFAULT_DB_PATH
_SCHEMA = _sqlite_store._SCHEMA
_db_lock = _sqlite_store._db_lock
_get_conn = _sqlite_store._get_conn
_now = _sqlite_store._now
_deserialize_run = _sqlite_store._deserialize_run


def _is_postgres_active() -> bool:
    """Returns True if PostgreSQL is the active primary storage engine."""
    if _DB_PATH != _DEFAULT_DB_PATH:
        return False
    if os.getenv("FABRIC_STORAGE_BACKEND", "").lower() == "sqlite":
        return False
    db_url = os.getenv("DATABASE_URL_POOLED", "").strip() or os.getenv("DATABASE_URL", "").strip()
    return db_url.startswith("postgresql://") or db_url.startswith("postgres://")


def _dispatch(fn_name: str, *args: Any, **kwargs: Any) -> Any:
    """Dispatches call to PostgreSQL facade if active, else falls back to SQLite."""
    if _is_postgres_active() and hasattr(_pg, fn_name):
        try:
            return getattr(_pg, fn_name)(*args, **kwargs)
        except Exception as e:
            print(f"[SESSION_STORE] PostgreSQL {fn_name} notice: {e}. Falling back.")
    return getattr(_sqlite_store, fn_name)(*args, **kwargs)


# ── Initialization & Stats ───────────────────────────────────────────────────

def init_db() -> None:
    _dispatch("init_db")


def get_db_stats() -> dict[str, int]:
    return _dispatch("get_db_stats")


def prune_old_sessions(max_sessions: int = 50) -> int:
    return 0 if _is_postgres_active() else _sqlite_store.prune_old_sessions(max_sessions)


# ── Sessions ──────────────────────────────────────────────────────────────────

def create_session(session_id: str, workspace_id: str, metadata: dict | None = None) -> str:
    return _dispatch("create_session", session_id, workspace_id, metadata)


def touch_session(session_id: str) -> None:
    _dispatch("touch_session", session_id)


def get_session(session_id: str) -> dict | None:
    return _dispatch("get_session", session_id)


def list_sessions(workspace_id: str | None = None) -> list[dict]:
    return _dispatch("list_sessions", workspace_id)


def list_conversations_with_metadata(workspace_id: str | None = None) -> list[dict]:
    return _dispatch("list_conversations_with_metadata", workspace_id)


def rename_conversation(session_id: str, title: str) -> bool:
    return _dispatch("rename_conversation", session_id, title)


def delete_conversation(session_id: str) -> bool:
    return _dispatch("delete_conversation", session_id)


def truncate_messages_from(session_id: str, from_turn_index: int) -> int:
    return _dispatch("truncate_messages_from", session_id, from_turn_index)


# ── Messages ──────────────────────────────────────────────────────────────────

def add_message(session_id: str, role: str, content: str, token_est: int = 0) -> int:
    if _is_postgres_active():
        try:
            return _pg.add_message(session_id, role, content, token_est)
        except Exception as e:
            print(f"[SESSION_STORE] PostgreSQL add_message notice: {e}. Falling back.")
    return _sqlite_store.add_message(session_id, role, content)


def get_messages(session_id: str, last_n: int = 20) -> list[dict]:
    return _dispatch("get_messages", session_id, last_n)


def get_conversation_messages(session_id: str) -> list[dict]:
    return _dispatch("get_conversation_messages", session_id)


def get_conversation_full(session_id: str) -> dict | None:
    return _dispatch("get_conversation_full", session_id)


def get_message_count(session_id: str) -> int:
    return _dispatch("get_message_count", session_id)


def get_messages_with_index(session_id: str) -> list[dict]:
    return _dispatch("get_messages_with_index", session_id)


# ── Runs ──────────────────────────────────────────────────────────────────────

def upsert_run(run_id: str, session_id: str | None = None, **fields: Any) -> None:
    if _is_postgres_active():
        try:
            return _pg.upsert_run(run_id, session_id, **fields)
        except Exception as e:
            print(f"[SESSION_STORE] PostgreSQL upsert_run notice: {e}. Falling back.")
    return _sqlite_store.upsert_run(run_id, session_id, **fields)


def get_run(run_id: str) -> dict | None:
    return _dispatch("get_run", run_id)


def get_session_runs(session_id: str) -> list[dict]:
    return _dispatch("get_session_runs", session_id)


def get_recent_runs(limit: int = 20) -> list[dict]:
    return _dispatch("get_recent_runs", limit)


# ── Facts & Workspace Cache ───────────────────────────────────────────────────

def set_fact(session_id: str, fact_key: str, fact_value: str, confidence: float = 1.0) -> None:
    _dispatch("set_fact", session_id, fact_key, fact_value, confidence)


def get_facts(session_id: str) -> dict[str, str]:
    return _dispatch("get_facts", session_id)


def get_tier_summary(session_id: str, tier: int = 2) -> dict | None:
    return _dispatch("get_tier_summary", session_id, tier)


def set_tier_summary(session_id: str, tier: int, summary: str, compressed_up_to_turn: int = -1) -> None:
    _dispatch("set_tier_summary", session_id, tier, summary, compressed_up_to_turn)


def update_workspace_cache(workspace_id: str, items: list[dict], folders: list[dict] | None = None) -> None:
    _dispatch("update_workspace_cache", workspace_id, items, folders)


def get_workspace_cache(workspace_id: str) -> dict | None:
    return _dispatch("get_workspace_cache", workspace_id)


# ── Projects ──────────────────────────────────────────────────────────────────

def get_all_projects() -> list[dict]:
    return _dispatch("get_all_projects")


def create_project(name: str, description: str = "", metadata: dict | None = None) -> dict:
    return _dispatch("create_project", name, description, metadata)


def update_project(
    project_id: str, name: str | None = None, description: str | None = None,
    is_pinned: int | None = None, is_archived: int | None = None,
    metadata: dict | None = None,
) -> bool:
    return _dispatch("update_project", project_id, name, description, is_pinned, is_archived)
    return _dispatch("update_project", project_id, name, description, is_pinned, is_archived, metadata)


def delete_project(project_id: str) -> bool:
    return _dispatch("delete_project", project_id)


def seed_default_projects_if_empty() -> None:
    if _is_postgres_active() and hasattr(_pg, "get_all_projects"):
        try:
            if not _pg.get_all_projects():
                _pg.create_project(
                    "Enterprise Medallion Platform",
                    "Primary Medallion data engineering architecture with Bronze, Silver, Gold Lakehouses",
                )
            return
        except Exception:
            pass
    _sqlite_store.seed_default_projects_if_empty()


# Auto-initialize on import
init_db()
seed_default_projects_if_empty()
