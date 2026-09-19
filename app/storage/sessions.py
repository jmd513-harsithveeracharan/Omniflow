"""
app/storage/sessions.py
-----------------------
Session identity and conversation lifecycle management.
"""

import json
import re
from app.storage.db import _db_lock, _get_conn, _now


def create_session(session_id: str, workspace_id: str, metadata: dict | None = None) -> str:
    """Creates a new session. Returns session_id."""
    now = _now()
    with _db_lock:
        conn = _get_conn()
        conn.execute(
            "INSERT OR IGNORE INTO sessions (session_id, workspace_id, created_at, last_active, metadata) VALUES (?,?,?,?,?)",
            (session_id, workspace_id, now, now, json.dumps(metadata or {})),
        )
        conn.commit()
        conn.close()
    return session_id


def touch_session(session_id: str) -> None:
    """Updates last_active timestamp for a session."""
    with _db_lock:
        conn = _get_conn()
        conn.execute("UPDATE sessions SET last_active=? WHERE session_id=?", (_now(), session_id))
        conn.commit()
        conn.close()


def get_session(session_id: str) -> dict | None:
    """Fetches session row by ID."""
    conn = _get_conn()
    row = conn.execute("SELECT * FROM sessions WHERE session_id=?", (session_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def list_sessions(workspace_id: str | None = None) -> list[dict]:
    """Lists all sessions, optionally filtered by workspace_id."""
    conn = _get_conn()
    if workspace_id:
        rows = conn.execute(
            "SELECT * FROM sessions WHERE workspace_id=? ORDER BY last_active DESC", (workspace_id,)
        ).fetchall()
    else:
        rows = conn.execute("SELECT * FROM sessions ORDER BY last_active DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def list_conversations_with_metadata(workspace_id: str | None = None) -> list[dict]:
    """
    Returns all conversations with message count, first prompt snippet,
    session context, and formatted titles.
    """
    conn = _get_conn()
    query = """
        SELECT s.session_id, s.workspace_id, s.created_at, s.last_active, s.metadata,
               COUNT(m.id) as message_count,
               (SELECT content FROM messages WHERE session_id = s.session_id AND role = 'user' ORDER BY turn_index ASC LIMIT 1) as first_prompt,
               (SELECT fact_value FROM learned_facts WHERE session_id = s.session_id AND fact_key = 'session_context') as session_context,
               (SELECT COUNT(run_id) FROM runs WHERE session_id = s.session_id) as run_count
        FROM sessions s
        LEFT JOIN messages m ON s.session_id = m.session_id
    """
    if workspace_id:
        query += " WHERE s.workspace_id = ? GROUP BY s.session_id ORDER BY s.last_active DESC"
        rows = conn.execute(query, (workspace_id,)).fetchall()
    else:
        query += " GROUP BY s.session_id ORDER BY s.last_active DESC"
        rows = conn.execute(query).fetchall()
    conn.close()

    results = []
    for r in rows:
        d = dict(r)
        try:
            d["metadata"] = json.loads(d.get("metadata") or "{}")
        except Exception:
            d["metadata"] = {}

        custom_title = d["metadata"].get("title")
        first_p = (d.get("first_prompt") or "").strip()
        if custom_title and not custom_title.startswith("Chat "):
            d["title"] = custom_title
        elif first_p:
            cleaned = re.sub(r'^[#*"`\'\s\->]+', '', first_p).strip()
            cleaned = " ".join(cleaned.split())
            d["title"] = (cleaned[:42] + "...") if len(cleaned) > 42 else (cleaned or "New Conversation")
        else:
            d["title"] = "New Conversation"

        if d.get("message_count", 0) > 0 or d.get("run_count", 0) > 0:
            results.append(d)
    return results


def rename_conversation(session_id: str, title: str) -> bool:
    """Updates the display title of a conversation in its metadata."""
    now = _now()
    with _db_lock:
        conn = _get_conn()
        row = conn.execute("SELECT metadata FROM sessions WHERE session_id=?", (session_id,)).fetchone()
        if not row:
            conn.close()
            return False
        try:
            meta = json.loads(row[0] or "{}")
        except Exception:
            meta = {}
        meta["title"] = title.strip()
        conn.execute("UPDATE sessions SET metadata=?, last_active=? WHERE session_id=?", (json.dumps(meta), now, session_id))
        conn.commit()
        conn.close()
    return True


def delete_conversation(session_id: str) -> bool:
    """Deletes a conversation and all its messages, learned facts, and runs."""
    with _db_lock:
        conn = _get_conn()
        conn.execute("DELETE FROM messages WHERE session_id=?", (session_id,))
        conn.execute("DELETE FROM learned_facts WHERE session_id=?", (session_id,))
        conn.execute("DELETE FROM runs WHERE session_id=?", (session_id,))
        cursor = conn.execute("DELETE FROM sessions WHERE session_id=?", (session_id,))
        deleted = cursor.rowcount > 0
        conn.commit()
        conn.close()
    return deleted


def truncate_messages_from(session_id: str, turn_index: int) -> int:
    """
    Deletes all messages in session_id starting from turn_index onwards.
    Used when editing a previous prompt or retrying a response.
    """
    with _db_lock:
        conn = _get_conn()
        cursor = conn.execute(
            "DELETE FROM messages WHERE session_id=? AND turn_index >= ?",
            (session_id, turn_index),
        )
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
    return deleted
