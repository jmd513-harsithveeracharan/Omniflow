"""
ingestion_planner.py
--------------------
Given source connector metadata, generates a complete Fabric provisioning plan.

The plan is returned to the UI BEFORE any deployment happens.
User sees it in the Visual Flow Mode, confirms, then triggers /api/ingestion/deploy.

Plan structure:
{
    "run_id":        str,         # UUID for tracking async deployment
    "source_id":     str,         # connector id e.g. "azure_sql"
    "source_name":   str,         # human name
    "database":      str,
    "folder":        str,         # Fabric workspace folder name
    "lakehouse":     str,         # Fabric lakehouse name
    "environment":   str,         # Fabric environment name
    "notebooks":     list[dict],  # one per selected table
    "pipeline":      dict,        # pipeline name + schedule
    "flow_nodes":    list[dict],  # visual DAG nodes for frontend
    "flow_edges":    list[dict],  # visual DAG edges for frontend
}
"""

import uuid
import re
from datetime import datetime


# ── Schedule Parser ───────────────────────────────────────────────────────────

def parse_schedule(prompt: str) -> dict:
    """
    Extract a cron schedule from a natural-language prompt.
    Falls back to daily 02:00 UTC if nothing is detected.

    Returns:
        {"cron": "0 2 * * *", "human": "Daily at 02:00 UTC"}
    """
    prompt_lower = prompt.lower()

    patterns = [
        (r"every\s+(\d+)\s+hour", lambda m: (f"0 */{m.group(1)} * * *", f"Every {m.group(1)} hours")),
        (r"hourly",               lambda m: ("0 * * * *",               "Hourly")),
        (r"every\s+(\d+)\s+min",  lambda m: (f"*/{m.group(1)} * * * *", f"Every {m.group(1)} minutes")),
        (r"(\d{1,2})[\s:](\d{2})\s*(am|pm|utc|)",
         lambda m: (
             f"{int(m.group(2))} {_to_24h(int(m.group(1)), m.group(3))} * * *",
             f"Daily at {m.group(1)}:{m.group(2)} {m.group(3).upper() or 'UTC'}"
         )),
        (r"midnight",             lambda m: ("0 0 * * *",               "Daily at midnight UTC")),
        (r"nightly",              lambda m: ("0 2 * * *",               "Nightly at 02:00 UTC")),
        (r"daily",                lambda m: ("0 2 * * *",               "Daily at 02:00 UTC")),
        (r"weekly",               lambda m: ("0 2 * * 1",               "Weekly on Monday at 02:00 UTC")),
    ]

    for pattern, builder in patterns:
        m = re.search(pattern, prompt_lower)
        if m:
            cron, human = builder(m)
            return {"cron": cron, "human": human}

    # Default
    return {"cron": "0 2 * * *", "human": "Daily at 02:00 UTC (default)"}


def _to_24h(hour: int, period: str) -> int:
    period = period.lower()
    if period == "pm" and hour != 12:
        return hour + 12
    if period == "am" and hour == 12:
        return 0
    return hour


# ── Naming Helpers ────────────────────────────────────────────────────────────

def _slug(text: str) -> str:
    """Convert any string to a safe Fabric item name slug."""
    return re.sub(r"[^a-zA-Z0-9_]", "_", text).strip("_")


# ── Plan Generator ────────────────────────────────────────────────────────────

def generate_ingestion_plan(
    source_id: str,
    source_name: str,
    database: str,
    selected_tables: list,      # list of {"schema":str, "table":str, "columns":list}
    schedule_prompt: str = "",
    extra_context: str = "",
) -> dict:
    """
    Build the full provisioning plan for one ingestion source.

    Args:
        source_id:       connector id, e.g. "azure_sql"
        source_name:     human name, e.g. "Azure SQL"
        database:        source database name
        selected_tables: list of tables with their schema columns
        schedule_prompt: natural language schedule, e.g. "run every night at 2am"
        extra_context:   optional additional prompt context

    Returns:
        Full plan dict with flow_nodes and flow_edges for the UI DAG.
    """
    run_id = str(uuid.uuid4())[:8]
    schedule = parse_schedule(schedule_prompt or extra_context)

    db_slug = _slug(database)
    source_slug = _slug(source_name.replace(" ", "_").replace("/", "_"))

    folder_name    = f"{source_slug}_{db_slug}_Ingestion"
    lakehouse_name = f"lh_{db_slug}_bronze"
    env_name       = f"env_{db_slug}_spark"
    pipeline_name  = f"pl_{db_slug}_nightly"

    # Build notebook plan per table
    notebooks = []
    for tbl in selected_tables:
        tbl_name   = tbl.get("table", "unknown")
        tbl_schema = tbl.get("schema", "dbo")
        columns    = tbl.get("columns", [])
        nb_name    = f"Ingest_{_slug(tbl_name)}_Bronze"

        notebooks.append({
            "name":         nb_name,
            "source_table": f"{tbl_schema}.{tbl_name}",
            "layer":        "Bronze",
            "column_count": len(columns),
            "columns":      columns,
            "delta_target": f"{lakehouse_name}.bronze_{_slug(tbl_name)}",
            "status":       "pending",
        })

    # Pipeline definition
    pipeline = {
        "name":       pipeline_name,
        "schedule":   schedule,
        "activities": [nb["name"] for nb in notebooks],
        "status":     "pending",
    }

    # ── Build Visual Flow DAG ─────────────────────────────────────────────────
    # Node IDs and positions for the frontend SVG renderer

    nodes = []
    edges = []

    # Source node
    nodes.append({
        "id":    "source",
        "type":  "source",
        "label": source_name,
        "sub":   database,
        "x": 60, "y": 200,
    })

    # Folder node
    nodes.append({
        "id":    "folder",
        "type":  "folder",
        "label": folder_name,
        "sub":   "Workspace Folder",
        "x": 220, "y": 200,
    })
    edges.append({"from": "source", "to": "folder"})

    # Lakehouse node
    nodes.append({
        "id":    "lakehouse",
        "type":  "lakehouse",
        "label": lakehouse_name,
        "sub":   "Bronze Lakehouse",
        "x": 420, "y": 80,
        "status": "pending",
    })
    edges.append({"from": "folder", "to": "lakehouse"})

    # Environment node
    nodes.append({
        "id":    "environment",
        "type":  "environment",
        "label": env_name,
        "sub":   "PySpark 3.4 Runtime",
        "x": 420, "y": 200,
        "status": "pending",
    })
    edges.append({"from": "folder", "to": "environment"})

    # Notebook nodes
    nb_y_start = 80
    nb_x = 640
    for i, nb in enumerate(notebooks):
        nb_node_id = f"nb_{i}"
        y = nb_y_start + i * 90
        nodes.append({
            "id":     nb_node_id,
            "type":   "notebook",
            "label":  nb["name"],
            "sub":    f"{nb['column_count']} columns → {nb['delta_target'].split('.')[-1]}",
            "x": nb_x, "y": y,
            "status": "pending",
        })
        edges.append({"from": "lakehouse", "to": nb_node_id})

    # Pipeline node
    pipeline_y = nb_y_start + len(notebooks) * 90
    nodes.append({
        "id":    "pipeline",
        "type":  "pipeline",
        "label": pipeline_name,
        "sub":   schedule["human"],
        "x": nb_x, "y": pipeline_y,
        "status": "pending",
    })
    # Pipeline connects from all notebooks
    for i in range(len(notebooks)):
        edges.append({"from": f"nb_{i}", "to": "pipeline"})

    return {
        "run_id":       run_id,
        "created_at":   datetime.utcnow().isoformat() + "Z",
        "source_id":    source_id,
        "source_name":  source_name,
        "database":     database,
        "folder":       folder_name,
        "lakehouse":    lakehouse_name,
        "environment":  env_name,
        "notebooks":    notebooks,
        "pipeline":     pipeline,
        "flow_nodes":   nodes,
        "flow_edges":   edges,
        "status":       "planned",
    }
