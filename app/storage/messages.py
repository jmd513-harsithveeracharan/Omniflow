"""
app/storage/messages.py
-----------------------
Message storage and conversation timeline hydration.
"""

import json
import re
from app.storage.db import _db_lock, _get_conn, _now
from app.storage.sessions import get_session, touch_session


def add_message(session_id: str, role: str, content: str) -> int:
    """
    Appends a message to the session conversation.
    Returns the new message ID.
    Token estimate = rough word count * 1.3.
    """
    now = _now()
    token_est = int(len(content.split()) * 1.3)
    with _db_lock:
        conn = _get_conn()
        row = conn.execute(
            "SELECT COALESCE(MAX(turn_index), -1) + 1 FROM messages WHERE session_id=?",
            (session_id,),
        ).fetchone()
        turn_index = row[0]
        cursor = conn.execute(
            "INSERT INTO messages (session_id, turn_index, role, content, token_est, created_at) VALUES (?,?,?,?,?,?)",
            (session_id, turn_index, role, content, token_est, now),
        )
        msg_id = cursor.lastrowid

        # Auto-set title from first user message if not already set
        if role == "user" and turn_index == 0:
            sess_row = conn.execute("SELECT metadata FROM sessions WHERE session_id=?", (session_id,)).fetchone()
            if sess_row:
                try:
                    meta = json.loads(sess_row[0] or "{}")
                except Exception:
                    meta = {}
                if not meta.get("title"):
                    cleaned = re.sub(r'^[#*"`\'\s\->]+', '', content.strip()).strip()
                    cleaned = " ".join(cleaned.split())
                    meta["title"] = (cleaned[:42] + "...") if len(cleaned) > 42 else (cleaned or "New Conversation")
                    conn.execute("UPDATE sessions SET metadata=? WHERE session_id=?", (json.dumps(meta), session_id))

        conn.commit()
        conn.close()
    touch_session(session_id)
    return msg_id


def get_messages(session_id: str, last_n: int = 20) -> list[dict]:
    """
    Returns the last N messages for a session, ordered oldest → newest.
    Used to build the LLM context window.
    """
    conn = _get_conn()
    rows = conn.execute(
        """
        SELECT role, content, turn_index, created_at FROM messages
        WHERE session_id = ?
        ORDER BY turn_index DESC
        LIMIT ?
        """,
        (session_id, last_n),
    ).fetchall()
    conn.close()
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def get_conversation_messages(session_id: str) -> list[dict]:
    """Returns ALL messages for a conversation session in chronological order."""
    conn = _get_conn()
    rows = conn.execute(
        """
        SELECT id, turn_index, role, content, token_est, created_at FROM messages
        WHERE session_id = ?
        ORDER BY turn_index ASC
        """,
        (session_id,),
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_conversation_full(session_id: str) -> dict | None:
    """
    Returns full conversation bundle: session metadata, all messages,
    learned facts, and the latest run/plan.
    """
    from app.storage.facts import get_facts
    from app.storage.runs import get_session_runs

    session = get_session(session_id)
    if not session:
        return None

    try:
        session["metadata"] = json.loads(session.get("metadata") or "{}")
    except Exception:
        session["metadata"] = {}

    messages = get_conversation_messages(session_id)
    facts = get_facts(session_id)
    runs = get_session_runs(session_id)
    latest_run = runs[0] if runs else None

    custom_title = session["metadata"].get("title")
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
        "session": session,
        "messages": messages,
        "message_count": len(messages),
        "facts": facts,
        "latest_run": latest_run,
    }


def get_message_count(session_id: str) -> int:
    """Returns total count of messages for a session."""
    conn = _get_conn()
    row = conn.execute("SELECT COUNT(*) FROM messages WHERE session_id=?", (session_id,)).fetchone()
    conn.close()
    return row[0]
