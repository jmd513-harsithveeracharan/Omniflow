"""
app/storage/facts.py
--------------------
Learned preferences, conversational facts, and Squeeze Straw tier caching.
"""

import json
from app.storage.db import _db_lock, _get_conn, _now


def set_fact(session_id: str, key: str, value: str, confidence: float = 1.0) -> None:
    """
    Upserts a learned fact for a session.
    Example: set_fact(sid, 'preferred_schedule', 'nightly')
    """
    now = _now()
    with _db_lock:
        conn = _get_conn()
        conn.execute(
            """INSERT INTO learned_facts (session_id, fact_key, fact_value, confidence, created_at)
               VALUES (?, ?, ?, ?, ?)
               ON CONFLICT(session_id, fact_key)
               DO UPDATE SET fact_value=excluded.fact_value,
                             confidence=excluded.confidence""",
            (session_id, key, value, confidence, now),
        )
        conn.commit()
        conn.close()


def get_facts(session_id: str) -> dict[str, str]:
    """Returns all learned facts for a session as {key: value} dict."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT fact_key, fact_value FROM learned_facts WHERE session_id=? ORDER BY confidence DESC",
        (session_id,),
    ).fetchall()
    conn.close()
    return {r["fact_key"]: r["fact_value"] for r in rows}


def get_tier_summary(session_id: str, tier: int) -> dict | None:
    """
    Returns the cached Squeeze Straw compression summary for a tier.
    Returns dict with {summary, compressed_up_to_turn} or None.
    Stored under reserved fact keys: _tier2_summary, _tier3_summary.
    """
    key = f"_tier{tier}_summary"
    conn = _get_conn()
    row = conn.execute(
        "SELECT fact_value FROM learned_facts WHERE session_id=? AND fact_key=?",
        (session_id, key),
    ).fetchone()
    conn.close()
    if not row:
        return None
    try:
        return json.loads(row["fact_value"])
    except Exception:
        return {"summary": row["fact_value"], "compressed_up_to_turn": -1}


def set_tier_summary(session_id: str, tier: int, summary: str, compressed_up_to_turn: int) -> None:
    """
    Persists a Squeeze Straw compression result for the given tier.
    Uses the learned_facts upsert mechanism with confidence=0.0 (system-generated).
    """
    key = f"_tier{tier}_summary"
    value = json.dumps({"summary": summary, "compressed_up_to_turn": compressed_up_to_turn})
    set_fact(session_id, key, value, confidence=0.0)


def get_messages_with_index(session_id: str) -> list[dict]:
    """
    Returns ALL messages with their turn_index, ordered oldest → newest.
    Used by Squeeze Straw to identify tier boundaries.
    """
    conn = _get_conn()
    rows = conn.execute(
        "SELECT turn_index, role, content FROM messages WHERE session_id=? ORDER BY turn_index ASC",
        (session_id,),
    ).fetchall()
    conn.close()
    return [{"turn_index": r["turn_index"], "role": r["role"], "content": r["content"]} for r in rows]

