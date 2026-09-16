"""
scripts/migrate_sqlite_to_postgres.py
------------------------------------
Automated data migration tool: copies all historical data from SQLite (fabric_ai_memory.db)
into PostgreSQL + pgvector without losing any chat history, projects, runs, or token audit logs.
Ensures foreign key integrity by resolving orphaned session references.
"""

import json
import os
import sqlite3
import sys
from datetime import UTC, datetime

# Ensure project root is in sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from dotenv import load_dotenv
load_dotenv()

from app.domain.storage.postgres_adapter import PostgresStorageAdapter

try:
    import psycopg
    from psycopg.rows import dict_row
except ImportError:
    pass


def ensure_session(pcur, session_id: str, workspace_id: str = "default"):
    """Ensures a session row exists in PostgreSQL to satisfy foreign key constraints."""
    if not session_id:
        return
    now = datetime.now(UTC).isoformat()
    pcur.execute(
        """
        INSERT INTO sessions (session_id, workspace_id, created_at, last_active, metadata)
        VALUES (%s, %s, %s, %s, %s)
        ON CONFLICT (session_id) DO NOTHING
        """,
        (session_id, workspace_id, now, now, json.dumps({"source": "migrated_orphan"})),
    )


def migrate():
    sqlite_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "fabric_ai_memory.db")
    if not os.path.exists(sqlite_path):
        print(f"[*] No SQLite database found at {sqlite_path}. Nothing to migrate.")
        return

    db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/fabric_ai")
    print("\n" + "=" * 75)
    print("      MIGRATING SQLITE (fabric_ai_memory.db) -> POSTGRESQL + PGVECTOR")
    print("=" * 75 + "\n")
    print(f"[*] Source SQLite: {sqlite_path}")
    print(f"[*] Target Postgres: {db_url}\n")

    # Connect to SQLite
    sconn = sqlite3.connect(sqlite_path)
    sconn.row_factory = sqlite3.Row
    scur = sconn.cursor()

    # Initialize Postgres
    adapter = PostgresStorageAdapter(db_url)
    pconn = psycopg.connect(db_url, row_factory=dict_row)
    pcur = pconn.cursor()

    # Helper to check if SQLite table exists
    def sqlite_table_exists(tbl: str) -> bool:
        scur.execute("SELECT name FROM sqlite_master WHERE type='table' AND name=?", (tbl,))
        return scur.fetchone() is not None

    # 1. Migrate Sessions
    if sqlite_table_exists("sessions"):
        scur.execute("SELECT * FROM sessions")
        sessions = scur.fetchall()
        print(f"[*] Migrating {len(sessions)} sessions...")
        for s in sessions:
            meta = s["metadata"] if "metadata" in s.keys() else "{}"
            pcur.execute(
                """
                INSERT INTO sessions (session_id, workspace_id, created_at, last_active, metadata)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (session_id) DO UPDATE SET
                    last_active = EXCLUDED.last_active,
                    metadata = EXCLUDED.metadata
                """,
                (s["session_id"], s["workspace_id"], s["created_at"], s["last_active"], meta),
            )
        pconn.commit()
        print(f"[+] Migrated {len(sessions)} sessions.")

    # 2. Migrate Messages
    if sqlite_table_exists("messages"):
        scur.execute("SELECT * FROM messages")
        messages = scur.fetchall()
        print(f"[*] Migrating {len(messages)} messages...")
        migrated_msg_count = 0
        for m in messages:
            sid = m["session_id"]
            ensure_session(pcur, sid)
            pcur.execute(
                """
                INSERT INTO messages (session_id, turn_index, role, content, token_est, created_at)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (sid, m["turn_index"], m["role"], m["content"], m["token_est"], m["created_at"]),
            )
            migrated_msg_count += 1
        pconn.commit()
        print(f"[+] Migrated {migrated_msg_count} messages.")

    # 3. Migrate Projects
    if sqlite_table_exists("projects"):
        scur.execute("SELECT * FROM projects")
        projects = scur.fetchall()
        print(f"[*] Migrating {len(projects)} projects...")
        for p in projects:
            pcur.execute(
                """
                INSERT INTO projects (id, name, description, is_pinned, is_archived, metadata, created_at, updated_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (id) DO UPDATE SET
                    name = EXCLUDED.name,
                    description = EXCLUDED.description,
                    is_pinned = EXCLUDED.is_pinned,
                    is_archived = EXCLUDED.is_archived,
                    metadata = EXCLUDED.metadata,
                    updated_at = EXCLUDED.updated_at
                """,
                (
                    p["id"], p["name"], p["description"], p["is_pinned"],
                    p["is_archived"], p["metadata"], p["created_at"], p["updated_at"]
                ),
            )
        pconn.commit()
        print(f"[+] Migrated {len(projects)} projects.")

    # 4. Migrate Runs
    if sqlite_table_exists("runs"):
        scur.execute("SELECT * FROM runs")
        runs = scur.fetchall()
        print(f"[*] Migrating {len(runs)} runs...")
        for r in runs:
            sid = r["session_id"]
            if sid:
                ensure_session(pcur, sid)
            pcur.execute(
                """
                INSERT INTO runs (
                    run_id, session_id, status, source_name, database_name, plan_json,
                    steps_json, pipeline_item_id, failure_reason, created_at, updated_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (run_id) DO UPDATE SET
                    status = EXCLUDED.status,
                    steps_json = EXCLUDED.steps_json,
                    pipeline_item_id = EXCLUDED.pipeline_item_id,
                    failure_reason = EXCLUDED.failure_reason,
                    updated_at = EXCLUDED.updated_at
                """,
                (
                    r["run_id"], r["session_id"], r["status"], r["source_name"],
                    r["database_name"], r["plan_json"], r["steps_json"],
                    r["pipeline_item_id"], r["failure_reason"], r["created_at"], r["updated_at"]
                ),
            )
        pconn.commit()
        print(f"[+] Migrated {len(runs)} runs.")

    # 5. Migrate Learned Facts
    if sqlite_table_exists("learned_facts"):
        scur.execute("SELECT * FROM learned_facts")
        facts = scur.fetchall()
        print(f"[*] Migrating {len(facts)} learned facts...")
        for f in facts:
            sid = f["session_id"]
            ensure_session(pcur, sid)
            pcur.execute(
                """
                INSERT INTO learned_facts (session_id, fact_key, fact_value, confidence, created_at)
                VALUES (%s, %s, %s, %s, %s)
                ON CONFLICT (session_id, fact_key) DO UPDATE SET
                    fact_value = EXCLUDED.fact_value,
                    confidence = EXCLUDED.confidence
                """,
                (sid, f["fact_key"], f["fact_value"], f["confidence"], f["created_at"]),
            )
        pconn.commit()
        print(f"[+] Migrated {len(facts)} learned facts.")

    # 6. Migrate Workspace Cache
    if sqlite_table_exists("workspace_cache"):
        scur.execute("SELECT * FROM workspace_cache")
        cache_rows = scur.fetchall()
        print(f"[*] Migrating {len(cache_rows)} workspace cache entries...")
        for c in cache_rows:
            pcur.execute(
                """
                INSERT INTO workspace_cache (workspace_id, items_json, folders_json, synced_at)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (workspace_id) DO UPDATE SET
                    items_json = EXCLUDED.items_json,
                    folders_json = EXCLUDED.folders_json,
                    synced_at = EXCLUDED.synced_at
                """,
                (c["workspace_id"], c["items_json"], c["folders_json"], c["synced_at"]),
            )
        pconn.commit()
        print(f"[+] Migrated {len(cache_rows)} workspace cache entries.")

    # 7. Migrate Token Usage
    if sqlite_table_exists("token_usage"):
        scur.execute("SELECT * FROM token_usage")
        tokens = scur.fetchall()
        print(f"[*] Migrating {len(tokens)} token usage records...")
        for t in tokens:
            sid = t["session_id"]
            if sid:
                ensure_session(pcur, sid)
            pcur.execute(
                """
                INSERT INTO token_usage (
                    session_id, provider, model, prompt_tokens, completion_tokens,
                    total_tokens, cost_usd, duration_ms, complexity, status, error_message, created_at
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    sid, t["provider"], t["model"], t["prompt_tokens"],
                    t["completion_tokens"], t["total_tokens"], t["cost_usd"],
                    t["duration_ms"], t["complexity"], t["status"], t["error_message"], t["created_at"]
                ),
            )
        pconn.commit()
        print(f"[+] Migrated {len(tokens)} token usage records.")

    sconn.close()
    pconn.close()

    print("\n" + "=" * 75)
    print("  MIGRATION COMPLETE: All SQLite data successfully copied into PostgreSQL!")
    print("=" * 75 + "\n")


if __name__ == "__main__":
    migrate()
