"""
app/storage/cache.py
--------------------
Fabric workspace metadata caching.
"""

import json
from app.storage.db import _db_lock, _get_conn, _now


def update_workspace_cache(workspace_id: str, items: list, folders: list) -> None:
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
            (workspace_id, json.dumps(items), json.dumps(folders), now),
        )
        conn.commit()
        conn.close()


def get_workspace_cache(workspace_id: str) -> dict | None:
    """Retrieves cached workspace items and folders snapshot."""
    conn = _get_conn()
    row = conn.execute(
        "SELECT * FROM workspace_cache WHERE workspace_id=?", (workspace_id,)
    ).fetchone()
    conn.close()
    if not row:
        return None
    d = dict(row)
    d["items"] = json.loads(d.pop("items_json", "[]"))
    d["folders"] = json.loads(d.pop("folders_json", "[]"))
    return d

