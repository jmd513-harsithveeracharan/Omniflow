"""
omniflow/intake_helpers.py
--------------------------
Structured Intake JSON parsing, Vault-backed schema hydration on resume, and
dynamic architecture summary / plan serialization for the chat workbench.
"""

from __future__ import annotations

import json
import re
from typing import Any


def extract_intake_json(message: str) -> dict[str, Any] | None:
    """Extracts an Enterprise Intake JSON payload from fenced markdown or raw chat text."""
    text = (message or "").strip()
    if not text:
        return None

    fenced = re.search(r"```(?:json)?\s*(\{[\s\S]*\})\s*```", text)
    candidates: list[str] = []
    if fenced:
        candidates.append(fenced.group(1))
    if text.startswith("{"):
        candidates.append(text)
    elif "{" in text and "}" in text:
        start = text.find("{")
        end = text.rfind("}")
        if end > start:
            candidates.append(text[start : end + 1])

    for raw in candidates:
        try:
            parsed = json.loads(raw)
        except Exception:
            continue
        if isinstance(parsed, dict) and (
            "project_context" in parsed
            or "retrieved_context" in parsed
            or "data_sources" in parsed
        ):
            return parsed
    return None


def _table_lookup_key(name: str) -> tuple[str, str]:
    clean = name.strip()
    short = clean.split(".")[-1] if "." in clean else clean
    return clean.lower(), short.lower()


def merge_connection_into_intake(
    pending_intake: dict[str, Any] | None,
    connection_id: str,
    chosen_tables: list[str],
    vault: dict[str, Any],
    proj_name: str,
    proj_code: str,
    workspace_display: str,
) -> dict[str, Any]:
    """
    Merges user-selected tables and live discovered column schemas from CONNECTIONS_VAULT
    back into the pending Intake JSON (zero credentials stored).
    """
    intake: dict[str, Any] = json.loads(json.dumps(pending_intake)) if pending_intake else {}
    p_ctx = intake.setdefault("project_context", {})
    p_sum = p_ctx.setdefault("project_summary", {})
    p_sum.setdefault("project_code", proj_code)
    p_sum.setdefault("project_name", proj_name)
    sol_sum = p_ctx.setdefault("solution_summary", {})
    sol_sum.setdefault(
        "target_folder_structure",
        {
            "root_folder": f"{re.sub(r'[^a-zA-Z0-9_]', '_', proj_name.lower()).strip('_')[:18].title()}_Platform",
            "subfolders": {"raw": "01 Raw", "stage": "02 Stage", "silver": "03 Silver", "gold": "04 Gold"},
        },
    )
    plat_sum = p_ctx.setdefault("platform_summary", {})
    plat_sum["target_workspace"] = workspace_display

    r_ctx = intake.setdefault("retrieved_context", {})
    sources: list[dict[str, Any]] = r_ctx.setdefault("data_sources", [])
    vault_entry = vault.get(connection_id, {})
    discovered = vault_entry.get("discovered_tables", [])

    if not sources:
        sources.append(
            {
                "source_name": vault_entry.get("connector_name", "External Source"),
                "system_type": vault_entry.get("connector_type", "postgres"),
                "connection_id": connection_id,
                "tables": [],
            }
        )
    else:
        sources[0]["connection_id"] = connection_id

    existing_by_key: dict[str, dict[str, Any]] = {}
    for tbl in sources[0].get("tables", []):
        tdict = {"table_name": tbl} if isinstance(tbl, str) else dict(tbl)
        k_full, k_short = _table_lookup_key(str(tdict.get("table_name", "")))
        if k_full:
            existing_by_key[k_full] = tdict
        if k_short and k_short not in existing_by_key:
            existing_by_key[k_short] = tdict

    disc_by_key: dict[str, dict[str, Any]] = {}
    for d in discovered:
        k_full, k_short = _table_lookup_key(str(d.get("full_name") or d.get("name") or ""))
        if k_full:
            disc_by_key[k_full] = d
        if k_short and k_short not in disc_by_key:
            disc_by_key[k_short] = d

    target_names = chosen_tables or [str(d.get("full_name") or d.get("name")) for d in discovered]
    merged_tables: list[dict[str, Any]] = []
    seen_keys: set[str] = set()

    for raw_name in target_names:
        k_full, k_short = _table_lookup_key(raw_name)
        if k_full in seen_keys:
            continue
        seen_keys.add(k_full)

        base = dict(existing_by_key.get(k_full) or existing_by_key.get(k_short) or {})
        live = disc_by_key.get(k_full) or disc_by_key.get(k_short) or {}

        t_name = str(base.get("table_name") or live.get("full_name") or live.get("name") or raw_name)
        cols = base.get("columns") or live.get("columns") or []
        pk_val = base.get("primary_key") or (live["pk"][0] if live.get("pk") else "id")
        wm_val = base.get("watermark_column") or live.get("watermark") or "updated_at"
        pii_val = base.get("pii_columns") or live.get("pii_columns") or []
        row_cnt = base.get("row_count") if base.get("row_count") is not None else live.get("est_rows", 0)

        merged_tables.append(
            {
                **base,
                "table_name": t_name,
                "primary_key": pk_val,
                "watermark_column": wm_val,
                "row_count": row_cnt,
                "columns": cols,
                "pii_columns": pii_val,
                "foreign_keys": base.get("foreign_keys") or live.get("foreign_keys", []),
            }
        )

    if merged_tables:
        sources[0]["tables"] = merged_tables
    return intake


def build_dynamic_plan_object(
    intake: dict[str, Any],
    res: dict[str, Any] | None,
    proj_name: str,
    proj_code: str,
    clean_dom: str,
    root_f: str,
    sub_f: dict[str, str],
    ws_display: str,
    connection_id: str | None = None,
) -> tuple[dict[str, Any], str]:
    """Builds a dynamic architecture plan object and markdown summary from synthesized results."""
    sources = intake.get("retrieved_context", {}).get("data_sources", [])
    source_tables: list[dict[str, Any]] = []
    source_names: list[str] = []
    pii_total: list[str] = []

    for src in sources:
        source_names.append(str(src.get("source_name") or src.get("system_type") or "Source System"))
        for tbl in src.get("tables", []):
            tdict = {"table_name": tbl} if isinstance(tbl, str) else tbl
            source_tables.append(tdict)
            for p_col in tdict.get("pii_columns", []):
                if p_col not in pii_total:
                    pii_total.append(p_col)

    raw_label = sub_f.get("raw", "01 Raw")
    stage_label = sub_f.get("stage", "02 Stage")
    silver_label = sub_f.get("silver", "03 Silver")
    gold_label = sub_f.get("gold", "04 Gold")

    plan_tables: list[dict[str, str]] = []
    for tbl in source_tables[:60]:
        tname = str(tbl.get("table_name", "entity")).strip()
        short = tname.split(".")[-1].lower()
        wm = tbl.get("watermark_column") or "full_load"
        plan_tables.append(
            {
                "name": f"brz_{short}",
                "target": f"{raw_label} / lh_{clean_dom}_bronze ({wm})",
            }
        )
        plan_tables.append(
            {
                "name": f"slv_{short}",
                "target": f"{silver_label} / lh_{clean_dom}_silver (Delta MERGE)",
            }
        )

    audit_pct = (res or {}).get("audit_output", {}).get("compliance_score_pct", 100)
    plan_obj: dict[str, Any] = {
        "sourceName": proj_name,
        "project_code": proj_code,
        "domain": clean_dom,
        "connection_id": connection_id,
        "schedule": "Incremental Watermark / Hourly Micro-Batch",
        "root_folder": root_f,
        "folders": sub_f,
        "lakehouses": [f"lh_{clean_dom}_bronze", f"lh_{clean_dom}_silver"],
        "notebooks": [{"name": f"nb_{clean_dom}_curate", "layer": "stage"}],
        "pipeline": f"pl_{clean_dom}_bronze_ingest",
        "items": [
            {"name": f"lh_{clean_dom}_bronze", "type": "Lakehouse", "folder_name": f"{root_f}/{raw_label}"},
            {"name": f"lh_{clean_dom}_silver", "type": "Lakehouse", "folder_name": f"{root_f}/{silver_label}"},
            {"name": f"wh_{clean_dom}_gold", "type": "Warehouse", "folder_name": f"{root_f}/{gold_label}"},
            {"name": f"nb_{clean_dom}_curate", "type": "Notebook", "depends_on": [f"lh_{clean_dom}_bronze"], "folder_name": f"{root_f}/{stage_label}"},
            {"name": f"pl_{clean_dom}_bronze_ingest", "type": "DataPipeline", "depends_on": [f"lh_{clean_dom}_bronze"], "folder_name": f"{root_f}/{raw_label}"},
        ],
        "tables": plan_tables,
    }

    preview_lines = "\n".join(
        f"  - `{t.get('table_name')}` -> `brz_{str(t.get('table_name', '')).split('.')[-1]}` -> `slv_{str(t.get('table_name', '')).split('.')[-1]}` (PK: `{t.get('primary_key', 'id')}`, Watermark: `{t.get('watermark_column', 'full')}`)"
        for t in source_tables[:12]
    )
    more_line = f"\n  - *...and {len(source_tables) - 12} more discovered/selected tables*" if len(source_tables) > 12 else ""

    summary = (
        f"### Microsoft Fabric Architecture Synthesized\n\n"
        f"- **Project**: `{proj_name}` (`{proj_code}`)\n"
        f"- **Target Workspace**: Microsoft Fabric (`{ws_display}`)\n"
        f"- **Source(s)**: {', '.join(source_names) or 'Connected Source'}"
        + (f" (`{connection_id}`)" if connection_id else "")
        + f"\n"
        f"- **Tables Selected**: `{len(source_tables)}` entities mapped across Bronze -> Silver -> Gold\n"
        f"- **Quality Audit**: `{audit_pct}%` Compliance (AST syntax verified"
        + (f", SHA-256 PII masking on `{len(pii_total)}` field(s)" if pii_total else "")
        + ")\n\n"
        f"#### Target Folders & Assets\n"
        f"- **{root_f}/{raw_label}** -> `Lakehouse`: `lh_{clean_dom}_bronze`, `DataPipeline`: `pl_{clean_dom}_bronze_ingest`\n"
        f"- **{root_f}/{stage_label}** -> `Notebook`: `nb_{clean_dom}_curate` (Delta DEDUP, Schema Validation & PII Hashing)\n"
        f"- **{root_f}/{silver_label}** -> `Lakehouse`: `lh_{clean_dom}_silver` (Curated Harmonized Delta Tables)\n"
        f"- **{root_f}/{gold_label}** -> `Warehouse`: `wh_{clean_dom}_gold` (Kimball Star Schema & Reporting Marts)\n\n"
        f"#### Sample Medallion Table Lineage\n"
        f"{preview_lines}{more_line}\n\n"
        f"All generated artifacts are saved under `omniflow/generated_artifacts/{proj_code}/`.\n"
        f"Click **Deploy to Fabric** below or in the right workbench to provision all items into `{ws_display}`."
    )
    return plan_obj, summary
