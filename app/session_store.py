"""
app/session_store.py
--------------------
SQLite-backed persistent store for Fabric AI Studio.

Stores:
  - sessions        → per-browser-tab identity
  - messages        → full conversation history per session
  - runs            → deployment run tracking (replaces ephemeral _RUNS dict)
  - learned_facts   → preferences/knowledge extracted from conversation
  - workspace_cache → local snapshot of Fabric workspace state

Why SQLite and not plain JSON?
  - Atomic writes — no corruption on crash/restart
  - Concurrent read-safe (WAL mode)
  - Queryable — "give me all failed runs this week"
  - Zero new dependencies (sqlite3 is in Python stdlib)

Database file: <project_root>/fabric_ai_memory.db
"""

import json
import os
import sqlite3
import threading
from datetime import UTC, datetime

_DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fabric_ai_memory.db")
_db_lock = threading.Lock()


# ── Schema ─────────────────────────────────────────────────────────────────────

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
"""


def _get_conn() -> sqlite3.Connection:
    """Returns a thread-local SQLite connection with row_factory set."""
    conn = sqlite3.connect(_DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Initialize the database and create all tables if they don't exist."""
    with _db_lock:
        conn = _get_conn()
        conn.executescript(_SCHEMA)
        conn.commit()
        conn.close()
    print(f"[MEMORY] Database initialized: {_DB_PATH}")


def _now() -> str:
    return datetime.now(UTC).isoformat()


# ── Session CRUD ───────────────────────────────────────────────────────────────

def create_session(session_id: str, workspace_id: str, metadata: dict | None = None) -> str:
    """Creates a new session. Returns session_id."""
    now = _now()
    with _db_lock:
        conn = _get_conn()
        conn.execute(
            "INSERT OR IGNORE INTO sessions (session_id, workspace_id, created_at, last_active, metadata) VALUES (?,?,?,?,?)",
            (session_id, workspace_id, now, now, json.dumps(metadata or {}))
        )
        conn.commit()
        conn.close()
    return session_id


def touch_session(session_id: str):
    """Updates last_active timestamp for a session."""
    with _db_lock:
        conn = _get_conn()
        conn.execute("UPDATE sessions SET last_active=? WHERE session_id=?", (_now(), session_id))
        conn.commit()
        conn.close()


def get_session(session_id: str) -> dict | None:
    conn = _get_conn()
    row = conn.execute("SELECT * FROM sessions WHERE session_id=?", (session_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def list_sessions(workspace_id: str | None = None) -> list[dict]:
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
            # Clean first prompt for title
            cleaned = " ".join(first_p.split())
            d["title"] = (cleaned[:42] + "...") if len(cleaned) > 42 else cleaned
        else:
            d["title"] = "New Conversation"

        # Only list conversations that actually have messages or runs
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
    Used when editing a previous prompt or retrying a response in the middle of a chat.
    """
    with _db_lock:
        conn = _get_conn()
        cursor = conn.execute(
            "DELETE FROM messages WHERE session_id=? AND turn_index >= ?",
            (session_id, turn_index)
        )
        deleted = cursor.rowcount
        conn.commit()
        conn.close()
    return deleted


# ── Message CRUD ───────────────────────────────────────────────────────────────

def add_message(session_id: str, role: str, content: str) -> int:
    """
    Appends a message to the session conversation.
    Returns the new message ID.
    Token estimate = rough word count * 1.3 (good enough for windowing).
    """
    now = _now()
    token_est = int(len(content.split()) * 1.3)
    with _db_lock:
        conn = _get_conn()
        # Get next turn_index
        row = conn.execute(
            "SELECT COALESCE(MAX(turn_index), -1) + 1 FROM messages WHERE session_id=?",
            (session_id,)
        ).fetchone()
        turn_index = row[0]
        cursor = conn.execute(
            "INSERT INTO messages (session_id, turn_index, role, content, token_est, created_at) VALUES (?,?,?,?,?,?)",
            (session_id, turn_index, role, content, token_est, now)
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
                    cleaned = " ".join(content.strip().split())
                    meta["title"] = (cleaned[:42] + "...") if len(cleaned) > 42 else cleaned
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
        (session_id, last_n)
    ).fetchall()
    conn.close()
    # Reverse so oldest comes first (correct LLM message order)
    return [{"role": r["role"], "content": r["content"]} for r in reversed(rows)]


def get_conversation_messages(session_id: str) -> list[dict]:
    """
    Returns ALL messages for a conversation session in chronological order.
    """
    conn = _get_conn()
    rows = conn.execute(
        """
        SELECT id, turn_index, role, content, token_est, created_at FROM messages
        WHERE session_id = ?
        ORDER BY turn_index ASC
        """,
        (session_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_conversation_full(session_id: str) -> dict | None:
    """
    Returns full conversation bundle: session metadata, all messages,
    learned facts, and the latest run/plan.
    """
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

    # Derive title
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
    conn = _get_conn()
    row = conn.execute("SELECT COUNT(*) FROM messages WHERE session_id=?", (session_id,)).fetchone()
    conn.close()
    return row[0]



# ── Run CRUD ───────────────────────────────────────────────────────────────────

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
                (run_id, session_id, now, now)
            )

        for key, val in fields.items():
            if isinstance(val, (dict, list)):
                val = json.dumps(val)
            conn.execute(
                f"UPDATE runs SET {key}=?, updated_at=? WHERE run_id=?",
                (val, now, run_id)
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
    conn = _get_conn()
    row = conn.execute("SELECT * FROM runs WHERE run_id=?", (run_id,)).fetchone()
    conn.close()
    if not row:
        return None
    return _deserialize_run(dict(row))


def get_session_runs(session_id: str) -> list[dict]:
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


# ── Learned Facts CRUD ─────────────────────────────────────────────────────────

def set_fact(session_id: str, key: str, value: str, confidence: float = 1.0):
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
            (session_id, key, value, confidence, now)
        )
        conn.commit()
        conn.close()


def get_facts(session_id: str) -> dict[str, str]:
    """Returns all learned facts for a session as {key: value} dict."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT fact_key, fact_value FROM learned_facts WHERE session_id=? ORDER BY confidence DESC",
        (session_id,)
    ).fetchall()
    conn.close()
    return {r["fact_key"]: r["fact_value"] for r in rows}


# ── Squeeze Straw Tier Helpers ────────────────────────────────────────────────

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
        (session_id, key)
    ).fetchone()
    conn.close()
    if not row:
        return None
    try:
        import json as _json
        return _json.loads(row["fact_value"])
    except Exception:
        return {"summary": row["fact_value"], "compressed_up_to_turn": -1}


def set_tier_summary(session_id: str, tier: int, summary: str, compressed_up_to_turn: int):
    """
    Persists a Squeeze Straw compression result for the given tier.
    Uses the existing learned_facts upsert mechanism.
    """
    import json as _json
    key = f"_tier{tier}_summary"
    value = _json.dumps({"summary": summary, "compressed_up_to_turn": compressed_up_to_turn})
    set_fact(session_id, key, value, confidence=0.0)  # confidence=0 marks as system-generated


def get_messages_with_index(session_id: str) -> list[dict]:
    """
    Returns ALL messages with their turn_index, ordered oldest → newest.
    Used by Squeeze Straw to identify tier boundaries.
    """
    conn = _get_conn()
    rows = conn.execute(
        "SELECT turn_index, role, content FROM messages WHERE session_id=? ORDER BY turn_index ASC",
        (session_id,)
    ).fetchall()
    conn.close()
    return [{"turn_index": r["turn_index"], "role": r["role"], "content": r["content"]} for r in rows]



# ── Workspace Cache ────────────────────────────────────────────────────────────

def update_workspace_cache(workspace_id: str, items: list, folders: list):
    """Persists the latest Fabric workspace snapshot."""
    now = _now()
    with _db_lock:
        conn = _get_conn()
        conn.execute(
            """INSERT INTO workspace_cache (workspace_id, items_json, folders_json, synced_at)
               VALUES (?, ?, ?, ?)
               ON CONFLICT(workspace_id)
               DO UPDATE SET items_json=excluded.items_json,
                             folders_json=excluded.folders_json,
                             synced_at=excluded.synced_at""",
            (workspace_id, json.dumps(items), json.dumps(folders), now)
        )
        conn.commit()
        conn.close()


def get_workspace_cache(workspace_id: str) -> dict | None:
    conn = _get_conn()
    row = conn.execute(
        "SELECT * FROM workspace_cache WHERE workspace_id=?", (workspace_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["items"]   = json.loads(d.pop("items_json", "[]"))
    d["folders"] = json.loads(d.pop("folders_json", "[]"))
    return d


# ── Stats / Housekeeping ───────────────────────────────────────────────────────

def get_db_stats() -> dict:
    """Returns row counts for all tables — useful for diagnostics."""
    conn = _get_conn()
    stats = {}
    for table in ("sessions", "messages", "runs", "learned_facts", "workspace_cache", "projects"):
        row = conn.execute(f"SELECT COUNT(*) FROM {table}").fetchone()
        stats[table] = row[0]
    conn.close()
    return stats


def prune_old_sessions(days: int = 30):
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


# ── Projects CRUD ─────────────────────────────────────────────────────────────

def get_all_projects() -> list[dict]:
    """Returns all projects ordered by pinned first, then last updated."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, name, description, is_pinned, is_archived, created_at, updated_at, metadata FROM projects WHERE is_archived = 0 ORDER BY is_pinned DESC, updated_at DESC"
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_project(name: str, description: str = "", metadata: dict | None = None) -> dict:
    """Creates a new project and returns the record."""
    import uuid
    pid = f"proj_{uuid.uuid4().hex[:12]}"
    now = _now()
    with _db_lock:
        conn = _get_conn()
        conn.execute(
            "INSERT INTO projects (id, name, description, is_pinned, is_archived, created_at, updated_at, metadata) VALUES (?,?,?,?,?,?,?,?)",
            (pid, name, description, 0, 0, now, now, json.dumps(metadata or {}))
        )
        conn.commit()
        conn.close()
    return {
        "id": pid,
        "name": name,
        "description": description,
        "is_pinned": 0,
        "is_archived": 0,
        "created_at": now,
        "updated_at": now,
        "metadata": metadata or {}
    }


def update_project(project_id: str, name: str | None = None, description: str | None = None, is_pinned: int | None = None, is_archived: int | None = None) -> bool:
    """Updates fields of an existing project."""
    now = _now()
    updates = ["updated_at = ?"]
    params = [now]
    if name is not None:
        updates.append("name = ?")
        params.append(name)
    if description is not None:
        updates.append("description = ?")
        params.append(description)
    if is_pinned is not None:
        updates.append("is_pinned = ?")
        params.append(1 if is_pinned else 0)
    if is_archived is not None:
        updates.append("is_archived = ?")
        params.append(1 if is_archived else 0)

    params.append(project_id)
    with _db_lock:
        conn = _get_conn()
        cur = conn.execute(f"UPDATE projects SET {', '.join(updates)} WHERE id = ?", tuple(params))
        conn.commit()
        affected = cur.rowcount
        conn.close()
    return affected > 0


def delete_project(project_id: str) -> bool:
    """Permanently deletes a project."""
    with _db_lock:
        conn = _get_conn()
        cur = conn.execute("DELETE FROM projects WHERE id = ?", (project_id,))
        conn.commit()
        affected = cur.rowcount
        conn.close()
    return affected > 0


def seed_default_projects_if_empty():
    """Seeds initial projects matching user reference if table is empty."""
    conn = _get_conn()
    count = conn.execute("SELECT COUNT(*) FROM projects").fetchone()[0]
    conn.close()
    if count == 0:
        samples = [
            ("Paxafe-PBT", "need to orchestrate data and move it btw sources", 1),
            ("Peli Bio Thermal", "Working on the client Project where need to establish a data platform.", 0),
            ("Peli Run Team", "Production ELT and orchestration pipeline management.", 1),
            ("GATE 2027", "Structured technical study roadmap and AI research benchmarks.", 1),
            ("Github", "Source repository sync, CI/CD runners, and automated release branches.", 1),
            ("JMAN-Learning", "Enterprise data engineering modules and PySpark deep dives.", 1),
            ("Hackathon", "Fast prototyping and multi-agent workflow experiments.", 0),
            ("Data Engineering", "Core medallion architecture, Delta lake optimization, and star schemas.", 0),
            ("Obsidian", "Knowledge graph synchronization and Architecture Decision Records (ADRs).", 0),
            ("Peli-Paxafe", "Inter-workspace data sharing and cross-tenant direct lake models.", 0),
        ]
        for name, desc, pinned in samples:
            p = create_project(name, desc)
            if pinned:
                update_project(p["id"], is_pinned=1)


# ── Auto-init on import ────────────────────────────────────────────────────────
init_db()
seed_default_projects_if_empty()

