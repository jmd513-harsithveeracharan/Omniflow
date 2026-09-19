"""
app/storage/projects.py
-----------------------
Project workspaces management and initial seeding.
"""

import json
import uuid
from app.storage.db import _db_lock, _get_conn, _now


def get_all_projects() -> list[dict]:
    """Returns all projects ordered by pinned first, then last updated."""
    conn = _get_conn()
    rows = conn.execute(
        "SELECT id, name, description, is_pinned, is_archived, created_at, updated_at, metadata FROM projects WHERE is_archived = 0 ORDER BY is_pinned DESC, updated_at DESC"
    ).fetchall()
    conn.close()
    res = []
    for r in rows:
        d = dict(r)
        if isinstance(d.get("metadata"), str):
            try:
                d["metadata"] = json.loads(d["metadata"])
            except Exception:
                d["metadata"] = {}
        res.append(d)
    return res


def create_project(name: str, description: str = "", metadata: dict | None = None) -> dict:
    """Creates a new project and returns the record."""
    pid = f"proj_{uuid.uuid4().hex[:12]}"
    now = _now()
    with _db_lock:
        conn = _get_conn()
        conn.execute(
            "INSERT INTO projects (id, name, description, is_pinned, is_archived, created_at, updated_at, metadata) VALUES (?,?,?,?,?,?,?,?)",
            (pid, name, description, 0, 0, now, now, json.dumps(metadata or {})),
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
        "metadata": metadata or {},
    }


def update_project(
    project_id: str,
    name: str | None = None,
    description: str | None = None,
    is_pinned: int | None = None,
    is_archived: int | None = None,
    metadata: dict | None = None,
) -> bool:
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
    if metadata is not None:
        updates.append("metadata = ?")
        params.append(json.dumps(metadata) if isinstance(metadata, dict) else metadata)

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


def seed_default_projects_if_empty() -> None:
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

