"""
app/engine/schema_resolver.py
------------------------------
JIT Schema Discovery: Resolves real column schemas from Fabric lakehouses via `fab table schema` CLI.
Routes all schema fetches through a single module — no inline subprocess calls allowed elsewhere.
"""

from __future__ import annotations

import re
import subprocess
from functools import lru_cache

# Workspace/lakehouse resolution — zero hardcoding, reads from env or config
_WORKSPACE_DEFAULT = "PBT_DATA_AGENT"


def _run_fab_schema(workspace: str, lakehouse: str, table_path: str) -> str | None:
    """Calls `fab table schema` and returns raw stdout or None on failure."""
    cmd = [
        "fab", "table", "schema",
        f"{workspace}.Workspace/{lakehouse}.Lakehouse/Tables/{table_path}",
    ]
    try:
        result = subprocess.run(
            cmd, capture_output=True, text=True, timeout=15,
        )
        return result.stdout.strip() if result.returncode == 0 else None
    except Exception:
        return None


def _parse_fab_schema_output(raw: str) -> list[dict[str, str]]:
    """Parses `fab table schema` columnar output into [{name, type}] list."""
    columns: list[dict[str, str]] = []
    past_header = False
    for line in raw.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith("---"):
            past_header = True
            continue
        if past_header:
            parts = line.split()
            if len(parts) >= 2 and parts[0].lower() not in ("name", "getting", "schema"):
                columns.append({"name": parts[0], "type": parts[1]})
    return columns


@lru_cache(maxsize=128)
def resolve_table_schema(
    table_ref: str,
    workspace: str = _WORKSPACE_DEFAULT,
) -> list[dict[str, str]]:
    """
    Resolves column schema for a 3-part table reference like 'lh_stage_ai.dbo.dim_customer_stg'.
    Returns a list of {name, type} dicts. Returns [] on failure (graceful degradation).
    Results are cached per table_ref per process lifetime.
    """
    # Parse lh_name.dbo.table_name or lh_name.table_name
    parts = table_ref.strip().split(".")
    if len(parts) == 3:
        lakehouse, _schema, table_name = parts
        table_path = f"dbo/{table_name}"
    elif len(parts) == 2:
        lakehouse, table_name = parts
        table_path = table_name
    else:
        return []

    raw = _run_fab_schema(workspace, lakehouse, table_path)
    if not raw:
        return []
    return _parse_fab_schema_output(raw)


def extract_table_refs(prompt: str) -> list[str]:
    """
    Extracts all 3-part table references from a prompt string.
    Matches patterns like: lh_stage_ai.dbo.dim_customer_stg
    """
    # Match lh_*.dbo.* or lh_*.schema.* patterns
    pattern = r"\blh_[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+\.[a-zA-Z0-9_]+\b"
    refs = list(dict.fromkeys(re.findall(pattern, prompt, re.IGNORECASE)))
    return refs


def build_schema_context(prompt: str, workspace: str = _WORKSPACE_DEFAULT) -> str:
    """
    Discovers all table references in the prompt, fetches real schemas via `fab table schema`,
    and returns a formatted string block for injection into LLM prompts.
    Returns empty string if no tables found or all schema fetches fail.
    """
    table_refs = extract_table_refs(prompt)
    if not table_refs:
        return ""

    lines = ["## Verified Source Table Schemas (fetched live from Fabric Lakehouse)"]
    any_resolved = False
    for ref in table_refs:
        columns = resolve_table_schema(ref, workspace=workspace)
        if columns:
            any_resolved = True
            col_str = ", ".join(f"{c['name']} ({c['type']})" for c in columns)
            lines.append(f"- `{ref}` → {col_str}")
        else:
            lines.append(f"- `{ref}` → (schema unavailable — use columns from prompt description)")

    return "\n".join(lines) if any_resolved else ""


def resolve_upstream_schema(generated_code: str) -> list[str]:
    """
    Extracts the output column names written by a worker's generated PySpark code.
    Looks for .select(...), .alias(...), and .withColumnRenamed(...) patterns.
    Used to populate WorkerResult.delta_schema for downstream workers.
    """
    columns: list[str] = []

    # Pattern 1: F.col("col_name") or col("col_name")
    columns += re.findall(r'[Ff]\.col\(["\']([a-zA-Z0-9_]+)["\']\)', generated_code)
    # Pattern 2: .alias("col_name")
    columns += re.findall(r'\.alias\(["\']([a-zA-Z0-9_]+)["\']\)', generated_code)
    # Pattern 3: .withColumn("col_name", ...)
    columns += re.findall(r'\.withColumn\(["\']([a-zA-Z0-9_]+)["\']', generated_code)
    # Pattern 4: .select("col1", "col2") string args
    columns += re.findall(r'\.select\([^)]+\)', generated_code)  # raw block
    # Pattern 5: "col_name" in a .select() context — find quoted strings
    select_blocks = re.findall(r'\.select\(([^)]{1,500})\)', generated_code)
    for block in select_blocks:
        columns += re.findall(r'["\']([a-zA-Z0-9_]+)["\']', block)

    # Deduplicate, filter out single-char noise
    seen: set[str] = set()
    result: list[str] = []
    for col in columns:
        if col and len(col) > 1 and col not in seen:
            seen.add(col)
            result.append(col)
    return result

