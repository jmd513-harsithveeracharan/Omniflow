"""
app/storage/runs.py
-------------------
Deployment run tracking and execution telemetry storage.
"""

import json
from app.storage.db import _db_lock, _get_conn, _now


def upsert_run(run_id: str, session_id: str | None, **fields) -> None:
    """
    Creates or updates a run record.
    Pass any run fields as keyword args (status, plan_json, steps_json, etc.)
    """
    now = _now()
    with _db_lock:
        conn = _get_conn()
        existing = conn.execute("SELECT run_id FROM runs WHERE run_id=?", (run_id,)).fetchone()

        if not existing:
            conn.execute(
                """INSERT INTO runs (run_id, session_id, created_at, updated_at)
                   VALUES (?, ?, ?, ?)""",
                (run_id, session_id, now, now),
            )

        for key, val in fields.items():
            if isinstance(val, (dict, list)):
                val = json.dumps(val)
            conn.execute(
                f"UPDATE runs SET {key}=?, updated_at=? WHERE run_id=?",
                (val, now, run_id),
            )
        conn.commit()
        conn.close()


def _deserialize_run(row_dict: dict) -> dict:
    d = dict(row_dict)
    for key in ("plan_json", "steps_json", "error_context"):
        if d.get(key) and isinstance(d[key], str):
            try:
                d[key] = json.loads(d[key])
            except Exception:
                pass
    return d


def get_run(run_id: str) -> dict | None:
    """Fetches a run record by run_id with parsed JSON structures."""
    conn = _get_conn()
    row = conn.execute("SELECT * FROM runs WHERE run_id=?", (run_id,)).fetchone()
    conn.close()
    if not row:
        return None
    return _deserialize_run(dict(row))


def get_session_runs(session_id: str) -> list[dict]:
    """Returns all runs belonging to a session, newest first."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT * FROM runs WHERE session_id=? ORDER BY created_at DESC", (session_id,)
    ).fetchall()
    conn.close()
    return [_deserialize_run(dict(r)) for r in rows]


def get_recent_runs(limit: int = 5) -> list[dict]:
    """Returns the most recent runs across all sessions."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT * FROM runs ORDER BY updated_at DESC LIMIT ?", (limit,)
    ).fetchall()
    conn.close()
    return [_deserialize_run(dict(r)) for r in rows]
