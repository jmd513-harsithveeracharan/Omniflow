"""
app/ingestion_planner.py
------------------------
Builds the full ingestion plan for a source connector.

Improvements over the original ingestion_planner.py:
  1. Full vs. Incremental strategy classifier (based on PKs, watermarks, row counts).
  2. Dynamic DAG layout — y-positions computed from table count, not hardcoded pixels.
  3. Strategy matrix included in the plan for HITL approval before deployment.
"""

import re
import uuid
from datetime import UTC, datetime, timedelta

# ── Watermark Detection ───────────────────────────────────────────────────────

_WATERMARK_KEYWORDS = {
    "updated_at", "modified_date", "last_modified_date", "modifiedon",
    "sys_modstamp", "systemmodstamp", "change_time", "updated_on",
    "rowversion", "timestamp", "last_updated", "modified_at",
}

_INCREMENTAL_ROW_THRESHOLD = 10_000


# ── Strategy Classifier ───────────────────────────────────────────────────────

def classify_strategy(table_meta: dict) -> dict:
    """
    Classifies a table as Full Load or Incremental Load.

    Decision criteria:
      - Incremental: has a primary key AND a watermark timestamp column AND > 10k rows.
      - Full: everything else (small tables, no reliable timestamps, no PKs).

    Returns a strategy dict containing:
      load_type, watermark_column, primary_key, delta_strategy, reason.
    """
    columns = table_meta.get("columns", [])
    estimated_rows = table_meta.get("estimated_rows", 0)

    pk_col = next((c for c in columns if c.get("is_primary_key")), None)
    watermark_col = next(
        (c for c in columns if c.get("column", "").lower() in _WATERMARK_KEYWORDS),
        None,
    )

    if pk_col and watermark_col and estimated_rows > _INCREMENTAL_ROW_THRESHOLD:
        return {
            "load_type": "Incremental",
            "watermark_column": watermark_col["column"],
            "primary_key": pk_col["column"],
            "delta_strategy": "MERGE_UPSERT",
            "reason": (
                f"High volume ({estimated_rows:,} rows), "
                f"primary key '{pk_col['column']}', "
                f"watermark column '{watermark_col['column']}' detected."
            ),
        }

    reason_parts = []
    if not pk_col:
        reason_parts.append("no primary key detected")
    if not watermark_col:
        reason_parts.append("no watermark timestamp column found")
    if estimated_rows <= _INCREMENTAL_ROW_THRESHOLD:
        reason_parts.append(f"small table ({estimated_rows:,} rows)")

    return {
        "load_type": "Full",
        "watermark_column": None,
        "primary_key": pk_col["column"] if pk_col else None,
        "delta_strategy": "OVERWRITE",
        "reason": "; ".join(reason_parts) if reason_parts else "Default full load.",
    }


# ── Schedule Parser ───────────────────────────────────────────────────────────

def parse_schedule(prompt: str) -> dict:
    """
    Extracts a cron schedule and optional expiration from a natural-language string.
    Supports specific times (e.g. 10.00 am, 5:00 pm, 17:30) and expirations (e.g. with 1 year expiration).
    Falls back to daily 02:00 UTC if nothing is detected.
    """
    p = prompt.lower()
    now = datetime.now(UTC)
    end_time_iso = None
    exp_desc = None

    # Expiration parser: e.g. "with 1 year expiration", "expires in 6 months", "for 30 days"
    exp_match = re.search(r'\b(?:with\s+)?(?:(\d+)\s*(year|month|day|week)s?\s*(?:expiration|expiry)|expires\s+(?:in\s+)?(\d+)\s*(year|month|day|week)s?|for\s+(\d+)\s*(year|month|day|week)s?)\b', p)
    if exp_match:
        qty = int(exp_match.group(1) or exp_match.group(3) or exp_match.group(5))
        unit = (exp_match.group(2) or exp_match.group(4) or exp_match.group(6)).lower()
        if 'year' in unit:
            end_dt = now + timedelta(days=365 * qty)
        elif 'month' in unit:
            end_dt = now + timedelta(days=30 * qty)
        elif 'week' in unit:
            end_dt = now + timedelta(weeks=qty)
        else:
            end_dt = now + timedelta(days=qty)

        end_time_iso = end_dt.strftime('%Y-%m-%dT%H:%M:%SZ')
        exp_desc = f"{qty} {unit}" if qty == 1 else f"{qty} {unit}s"

    # 1. Check for specific time expressions with AM/PM: e.g. '10.00 am', '5:00 pm', '5 pm', '10.30am'
    time_ampm_match = re.search(r'\b(?:at\s+|to\s+)?(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)\b', p)
    if time_ampm_match:
        h = int(time_ampm_match.group(1))
        m = int(time_ampm_match.group(2)) if time_ampm_match.group(2) else 0
        ampm = time_ampm_match.group(3)
        orig_h = h
        if ampm == 'pm' and h < 12:
            h += 12
        elif ampm == 'am' and h == 12:
            h = 0

        time_label = f"{orig_h}:{m:02d} {ampm.upper()}" if time_ampm_match.group(2) else f"{orig_h} {ampm.upper()}"
        human = f"Daily at {time_label} UTC"
        if exp_desc:
            human += f" (expires in {exp_desc} on {end_time_iso[:10]})"
        return {'cron': f'{m} {h} * * *', 'human': human, 'end_time': end_time_iso}

    # 2. Check for 24-hour time expressions: e.g. 'at 17:30', 'at 17.00'
    time_24_match = re.search(r'\b(?:at\s+)?([01]?\d|2[0-3])[:.](\d{2})\b', p)
    if time_24_match:
        h = int(time_24_match.group(1))
        m = int(time_24_match.group(2))
        human = f"Daily at {h:02d}:{m:02d} UTC"
        if exp_desc:
            human += f" (expires in {exp_desc} on {end_time_iso[:10]})"
        return {'cron': f'{m} {h} * * *', 'human': human, 'end_time': end_time_iso}

    # 3. Standard recurring intervals
    patterns = [
        (r"every\s+(\d+)\s+hour",     lambda m: (f"0 */{m.group(1)} * * *", f"Every {m.group(1)} hours")),
        (r"hourly",                    lambda _: ("0 * * * *",               "Hourly")),
        (r"every\s+(\d+)\s+min",       lambda m: (f"*/{m.group(1)} * * * *", f"Every {m.group(1)} minutes")),
        (r"midnight",                  lambda _: ("0 0 * * *",               "Daily at midnight UTC")),
        (r"nightly",                   lambda _: ("0 2 * * *",               "Nightly at 02:00 UTC")),
        (r"daily",                     lambda _: ("0 2 * * *",               "Daily at 02:00 UTC")),
        (r"weekly",                    lambda _: ("0 2 * * 1",               "Weekly on Monday at 02:00 UTC")),
        (r"monthly",                   lambda _: ("0 2 1 * *",               "Monthly on the 1st at 02:00 UTC")),
    ]

    for pattern, builder in patterns:
        m = re.search(pattern, p)
        if m:
            cron, human = builder(m)
            if exp_desc:
                human += f" (expires in {exp_desc} on {end_time_iso[:10]})"
            return {"cron": cron, "human": human, "end_time": end_time_iso}

    human = "Daily at 02:00 UTC (default)"
    if exp_desc:
        human += f" (expires in {exp_desc} on {end_time_iso[:10]})"
    return {"cron": "0 2 * * *", "human": human, "end_time": end_time_iso}


# Alias for backward compatibility
parse_schedule_expression = parse_schedule


# ── Naming Helpers ────────────────────────────────────────────────────────────

def _slug(text: str) -> str:
    """Converts any string to a safe Fabric item name slug."""
    return re.sub(r"[^a-zA-Z0-9_]", "_", text).strip("_")


# ── DAG Layout ───────────────────────────────────────────────────────────────

_COL_X = {"source": 60, "folder": 240, "lakehouse": 430, "environment": 430, "notebook": 630, "pipeline": 830}
_NODE_H = 90   # vertical spacing between notebook nodes
_CENTER_Y = 200


def _compute_dag_nodes(
    source_name: str,
    database: str,
    folder_name: str,
    lakehouse_name: str,
    env_name: str,
    pipeline_name: str,
    schedule_human: str,
    notebooks: list[dict],
) -> tuple[list[dict], list[dict]]:
    """
    Dynamically computes visual DAG node positions based on number of tables.
    Returns (nodes, edges).
    """
    n = max(len(notebooks), 1)
    total_h = n * _NODE_H
    top_y = max(60, _CENTER_Y - total_h // 2)

    nodes: list[dict] = []
    edges: list[dict] = []

    # Source
    nodes.append({"id": "source", "type": "source", "label": source_name,
                  "sub": database, "x": _COL_X["source"], "y": _CENTER_Y})

    # Folder
    nodes.append({"id": "folder", "type": "folder", "label": folder_name,
                  "sub": "Workspace Folder", "x": _COL_X["folder"], "y": _CENTER_Y})
    edges.append({"from": "source", "to": "folder"})

    # Lakehouse (top)
    nodes.append({"id": "lakehouse", "type": "lakehouse", "label": lakehouse_name,
                  "sub": "Bronze Lakehouse", "x": _COL_X["lakehouse"], "y": top_y, "status": "pending"})
    edges.append({"from": "folder", "to": "lakehouse"})

    # Environment (bottom anchor)
    env_y = top_y + total_h + 30
    nodes.append({"id": "environment", "type": "environment", "label": env_name,
                  "sub": "PySpark 3.4 Runtime", "x": _COL_X["environment"], "y": env_y, "status": "pending"})
    edges.append({"from": "folder", "to": "environment"})

    # Notebook nodes
    for i, nb in enumerate(notebooks):
        nid = f"nb_{i}"
        y = top_y + i * _NODE_H
        nodes.append({
            "id": nid, "type": "notebook",
            "label": nb["name"],
            "sub": f"{nb.get('column_count', 0)} cols → {nb.get('delta_target', '').split('.')[-1]}",
            "x": _COL_X["notebook"], "y": y,
            "status": "pending",
            "load_type": nb.get("load_type", "Full"),
        })
        edges.append({"from": "lakehouse", "to": nid})

    # Pipeline
    pipeline_y = top_y + (n // 2) * _NODE_H
    nodes.append({"id": "pipeline", "type": "pipeline", "label": pipeline_name,
                  "sub": schedule_human, "x": _COL_X["pipeline"], "y": pipeline_y, "status": "pending"})
    for i in range(n):
        edges.append({"from": f"nb_{i}", "to": "pipeline"})

    return nodes, edges


# ── Plan Generator ────────────────────────────────────────────────────────────

def generate_ingestion_plan(
    source_id: str,
    source_name: str,
    database: str,
    selected_tables: list[dict],
    schedule_prompt: str = "",
    extra_context: str = "",
) -> dict:
    """
    Builds the complete provisioning plan for one ingestion source.

    Each table in selected_tables must be:
      {"schema": str, "table": str, "columns": list[dict], "estimated_rows": int}

    Returns the plan dict including:
      - run_id, source metadata, folder/lakehouse/env/pipeline names
      - notebooks (one per table) with strategy classification
      - strategy_matrix for HITL approval
      - flow_nodes, flow_edges for the visual DAG
    """
    run_id = str(uuid.uuid4())[:8]
    schedule = parse_schedule(schedule_prompt or extra_context)

    db_slug = _slug(database)
    source_slug = _slug(source_name.replace(" ", "_").replace("/", "_"))

    folder_name    = f"{source_slug}_{db_slug}_Ingestion"
    lakehouse_name = f"lh_{db_slug}_bronze"
    env_name       = f"env_{db_slug}_spark"
    pipeline_name  = f"pl_{db_slug}_nightly"

    notebooks: list[dict] = []
    strategy_matrix: list[dict] = []

    for tbl in selected_tables:
        tbl_name     = tbl.get("table", "unknown")
        tbl_schema   = tbl.get("schema", "dbo")
        columns      = tbl.get("columns", [])
        nb_name      = f"Ingest_{_slug(tbl_name)}_Bronze"
        delta_target = f"{lakehouse_name}.bronze_{_slug(tbl_name)}"

        strategy = classify_strategy({
            "table": tbl_name,
            "columns": columns,
            "estimated_rows": tbl.get("estimated_rows", 0),
        })

        nb_entry = {
            "name":          nb_name,
            "source_table":  f"{tbl_schema}.{tbl_name}",
            "layer":         "Bronze",
            "column_count":  len(columns),
            "columns":       columns,
            "delta_target":  delta_target,
            "load_type":     strategy["load_type"],
            "watermark_col": strategy["watermark_column"],
            "primary_key":   strategy["primary_key"],
            "delta_strategy":strategy["delta_strategy"],
            "status":        "pending",
        }
        notebooks.append(nb_entry)
        strategy_matrix.append({
            "table":            f"{tbl_schema}.{tbl_name}",
            "load_type":        strategy["load_type"],
            "primary_key":      strategy["primary_key"],
            "watermark_column": strategy["watermark_column"],
            "delta_strategy":   strategy["delta_strategy"],
            "reason":           strategy["reason"],
        })

    nodes, edges = _compute_dag_nodes(
        source_name, database, folder_name,
        lakehouse_name, env_name, pipeline_name,
        schedule["human"], notebooks,
    )

    return {
        "run_id":          run_id,
        "created_at":      datetime.now(UTC).isoformat(),
        "source_id":       source_id,
        "source_name":     source_name,
        "database":        database,
        "folder":          folder_name,
        "lakehouse":       lakehouse_name,
        "environment":     env_name,
        "notebooks":       notebooks,
        "pipeline": {
            "name":     pipeline_name,
            "schedule": schedule,
            "activities": [nb["name"] for nb in notebooks],
            "status":   "pending",
        },
        "strategy_matrix": strategy_matrix,   # For HITL approval modal
        "flow_nodes":      nodes,
        "flow_edges":      edges,
        "status":          "planned",
    }
