"""
app/storage/pg_facade.py
------------------------
PostgreSQL + pgvector storage facade functions for Fabric AI Studio.
Provides high-level bridge between PostgresStorageAdapter and application layer.
"""

from __future__ import annotations

import json
import os
from typing import Any

from app.domain.models.session import (
    LearnedFact,
    MessageRecord,
    RunRecord,
    SessionRecord,
)
from app.domain.storage.factory import get_storage
from app.domain.storage.postgres_adapter import PostgresStorageAdapter


def get_pg() -> PostgresStorageAdapter:
    """Retrieves the active PostgresStorageAdapter."""
    adapter = get_storage()
    if not isinstance(adapter, PostgresStorageAdapter):
        db_url = os.getenv("DATABASE_URL_POOLED", "").strip() or os.getenv("DATABASE_URL", "").strip()
        adapter = PostgresStorageAdapter(db_url)
    return adapter


def init_db() -> None:
    get_pg().init_db()


def get_db_stats() -> dict[str, int]:
    return get_pg().get_db_stats()


def create_session(session_id: str, workspace_id: str, metadata: dict | None = None) -> str:
    rec = SessionRecord(
        session_id=session_id,
        workspace_id=workspace_id,
        metadata=metadata or {},
    )
    get_pg().create_session(rec)
    return session_id


def touch_session(session_id: str) -> None:
    get_pg().touch_session(session_id)


def get_session(session_id: str) -> dict | None:
    rec = get_pg().get_session(session_id)
    if not rec:
        return None
    return {
        "session_id": rec.session_id,
        "workspace_id": rec.workspace_id,
        "created_at": str(rec.created_at),
        "last_active": str(rec.last_active),
        "metadata": json.dumps(rec.metadata) if isinstance(rec.metadata, dict) else (rec.metadata or "{}"),
    }


def list_sessions(workspace_id: str | None = None) -> list[dict]:
    recs = get_pg().list_sessions(workspace_id)
    return [
        {
            "session_id": r.session_id,
            "workspace_id": r.workspace_id,
            "created_at": str(r.created_at),
            "last_active": str(r.last_active),
            "metadata": json.dumps(r.metadata) if isinstance(r.metadata, dict) else (r.metadata or "{}"),
        }
        for r in recs
    ]


def list_conversations_with_metadata(workspace_id: str | None = None) -> list[dict]:
    return get_pg().list_conversations_with_metadata(workspace_id)


def rename_conversation(session_id: str, title: str) -> bool:
    return get_pg().rename_conversation(session_id, title)


def delete_conversation(session_id: str) -> bool:
    return get_pg().delete_conversation(session_id)


def truncate_messages_from(session_id: str, from_turn_index: int) -> int:
    return get_pg().truncate_messages_from(session_id, from_turn_index)


def add_message(session_id: str, role: str, content: str, token_est: int = 0) -> int:
    pg = get_pg()
    existing = pg.get_messages(session_id, limit=1000)
    turn_idx = len(existing)
    t_est = token_est or int(len(content.split()) * 1.3)
    rec = MessageRecord(
        session_id=session_id,
        turn_index=turn_idx,
        role=role,
        content=content,
        token_est=t_est,
    )
    saved = pg.add_message(rec)
    return saved.id or 1


def get_messages(session_id: str, last_n: int = 20) -> list[dict]:
    msgs = get_pg().get_messages(session_id, limit=last_n or 50)
    tail = msgs[-last_n:] if last_n else msgs
    return [{"role": m.role, "content": m.content} for m in tail]


def get_conversation_messages(session_id: str) -> list[dict]:
    msgs = get_pg().get_messages(session_id, limit=1000)
    return [
        {
            "role": m.role,
            "content": m.content,
            "turn_index": m.turn_index,
            "created_at": str(m.created_at),
        }
        for m in msgs
    ]


def get_conversation_full(session_id: str) -> dict | None:
    pg = get_pg()
    with pg._get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM sessions WHERE session_id = %s", (session_id,))
            s_row = cur.fetchone()
            if not s_row:
                return None
            sess = dict(s_row)
            sess["created_at"], sess["last_active"] = str(sess.get("created_at", "")), str(sess.get("last_active", ""))
            if isinstance(sess.get("metadata"), dict):
                sess["metadata"] = json.dumps(sess["metadata"])

            cur.execute("SELECT role, content, turn_index, created_at FROM messages WHERE session_id = %s ORDER BY turn_index ASC", (session_id,))
            messages = [{"role": m["role"], "content": m["content"], "turn_index": m["turn_index"], "created_at": str(m["created_at"])} for m in cur.fetchall()]

            cur.execute("SELECT fact_key, fact_value FROM learned_facts WHERE session_id = %s", (session_id,))
            facts = {r["fact_key"]: r["fact_value"] for r in cur.fetchall()}

            cur.execute("SELECT * FROM runs WHERE session_id = %s ORDER BY created_at DESC LIMIT 5", (session_id,))
            runs = [dict(r) for r in cur.fetchall()]
            latest_run = runs[0] if runs else None

    meta = sess.get("metadata")
    if isinstance(meta, str):
        try:
            meta = json.loads(meta)
        except Exception:
            meta = {}
    elif not isinstance(meta, dict):
        meta = {}

    custom_title = meta.get("title")
    first_p = next((m["content"] for m in messages if m["role"] == "user"), "")
    if custom_title:
        title = custom_title
    elif first_p:
        cleaned = " ".join(first_p.strip().split())
        title = (cleaned[:42] + "...") if len(cleaned) > 42 else cleaned
    else:
        title = f"Chat {session_id[:8]}"

    return {
        "session_id": session_id,
        "title": title,
        "session": sess,
        "messages": messages,
        "message_count": len(messages),
        "facts": facts,
        "latest_run": latest_run,
    }


def get_message_count(session_id: str) -> int:
    return len(get_pg().get_messages(session_id, limit=1000))


def upsert_run(run_id: str, session_id: str | None = None, **fields: Any) -> None:
    plan = fields.get("plan_json") or fields.get("plan_dict") or {}
    steps = fields.get("steps_json") or fields.get("steps") or []
    rec = RunRecord(
        run_id=run_id,
        session_id=session_id,
        status=fields.get("status", "planned"),
        source_name=fields.get("source_name"),
        database_name=fields.get("database_name"),
        plan_json=plan if isinstance(plan, dict) else json.loads(plan or "{}"),
        steps_json=steps if isinstance(steps, list) else json.loads(steps or "[]"),
        pipeline_item_id=fields.get("pipeline_item_id"),
        failure_reason=fields.get("failure_reason"),
    )
    get_pg().upsert_run(rec)


def get_run(run_id: str) -> dict | None:
    rec = get_pg().get_run(run_id)
    if not rec:
        return None
    return {
        "run_id": rec.run_id,
        "session_id": rec.session_id,
        "status": rec.status,
        "source_name": rec.source_name,
        "database_name": rec.database_name,
        "plan_json": rec.plan_json,
        "steps_json": rec.steps_json,
        "pipeline_item_id": rec.pipeline_item_id,
        "failure_reason": rec.failure_reason,
        "created_at": str(rec.created_at),
        "updated_at": str(rec.updated_at),
    }


def get_session_runs(session_id: str) -> list[dict]:
    with get_pg()._get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM runs WHERE session_id = %s ORDER BY created_at DESC", (session_id,))
            return [dict(r) for r in cur.fetchall()]


def get_recent_runs(limit: int = 20) -> list[dict]:
    with get_pg()._get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT * FROM runs ORDER BY created_at DESC LIMIT %s", (limit,))
            return [dict(r) for r in cur.fetchall()]


def set_fact(session_id: str, fact_key: str, fact_value: str, confidence: float = 1.0) -> None:
    rec = LearnedFact(
        session_id=session_id,
        fact_key=fact_key,
        fact_value=fact_value,
        confidence=confidence,
    )
    get_pg().upsert_fact(rec)


def get_facts(session_id: str) -> dict[str, str]:
    return get_pg().get_facts(session_id)


def get_tier_summary(session_id: str, tier: int = 2) -> dict | None:
    facts = get_pg().get_facts(session_id)
    key = f"_tier{tier}_summary"
    val = facts.get(key)
    if not val:
        return None
    try:
        return json.loads(val)
    except Exception:
        return {"summary": val, "compressed_up_to_turn": -1}


def set_tier_summary(session_id: str, tier: int, summary: str, compressed_up_to_turn: int = -1) -> None:
    key = f"_tier{tier}_summary"
    val = json.dumps({"summary": summary, "compressed_up_to_turn": compressed_up_to_turn})
    set_fact(session_id, key, val, confidence=0.0)


def update_workspace_cache(workspace_id: str, items: list[dict], folders: list[dict] | None = None) -> None:
    get_pg().update_workspace_cache(workspace_id, items, folders or [])


def get_workspace_cache(workspace_id: str) -> dict | None:
    return get_pg().get_workspace_cache(workspace_id)


def get_all_projects() -> list[dict]:
    return get_pg().get_all_projects()


def create_project(name: str, description: str = "", metadata: dict | None = None) -> dict:
    return get_pg().create_project(name, description, metadata)


def update_project(
    project_id: str,
    name: str | None = None,
    description: str | None = None,
    is_pinned: int | None = None,
    is_archived: int | None = None,
) -> bool:
    return get_pg().update_project(project_id, name, description, is_pinned, is_archived)


def delete_project(project_id: str) -> bool:
    return get_pg().delete_project(project_id)

