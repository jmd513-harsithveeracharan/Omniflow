"""
app/engine/workspace_mirror.py
------------------------------
Local Declarative Fabric Workspace Mirror & JIT Context Hydration Engine.
Implements Microsoft Fabric Git Integration and fabric-cicd directory specifications.
Stores assets locally as .Notebook, .Lakehouse, .DataPipeline, and .Warehouse items.
Provides sub-millisecond local schema discovery and JIT context hydration.
"""

from __future__ import annotations

import json
import os
import re
from pathlib import Path
from typing import Any
from pydantic import BaseModel, Field

from app.engine.schema_resolver import resolve_upstream_schema


class MirrorItem(BaseModel):
    name: str
    item_type: str  # Notebook | Lakehouse | DataPipeline | Warehouse | Folder
    folder_path: str
    file_path: str
    description: str = ""
    tables: list[str] = Field(default_factory=list)
    columns: list[str] = Field(default_factory=list)


def _platform_payload(display_name: str, item_type: str, description: str = "") -> dict[str, Any]:
    """Generates standard Fabric .platform file payload."""
    return {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        "metadata": {
            "type": item_type,
            "displayName": display_name,
            "description": description or f"Fabric {item_type} {display_name}",
        },
        "config": {
            "version": "2.0",
        },
    }


def export_plan_to_mirror(plan: dict[str, Any], base_dir: str = "fabric_workspace") -> list[str]:
    """
    Serializes a synthesized Fabric plan into the standard local Git directory structure.
    Returns the list of created file paths.
    """
    created_paths: list[str] = []
    folder_name = plan.get("folder") or "AI_Test_Folder"
    root_path = Path(base_dir) / "AI_Test_Folder"
    if folder_name != "AI_Test_Folder":
        target_dir = root_path / folder_name
    else:
        target_dir = root_path

    target_dir.mkdir(parents=True, exist_ok=True)

    # 1. Write Lakehouses
    for lh_name in plan.get("lakehouses", []):
        lh_dir = target_dir / f"{lh_name}.Lakehouse"
        lh_dir.mkdir(parents=True, exist_ok=True)
        plat_file = lh_dir / ".platform"
        meta_file = lh_dir / "lakehouse.metadata.json"

        plat_file.write_text(json.dumps(_platform_payload(lh_name, "Lakehouse"), indent=2), encoding="utf-8")
        meta_file.write_text(json.dumps({"defaultSchema": "dbo"}, indent=2), encoding="utf-8")
        created_paths.extend([str(plat_file), str(meta_file)])

    # 2. Write Notebooks
    for nb in plan.get("notebooks", []):
        nb_name = nb.get("name", "nb_transform")
        nb_code = nb.get("pyspark_code") or nb.get("pyspark") or ""
        nb_dir = target_dir / f"{nb_name}.Notebook"
        nb_dir.mkdir(parents=True, exist_ok=True)
        plat_file = nb_dir / ".platform"
        py_file = nb_dir / "notebook-content.py"

        plat_file.write_text(json.dumps(_platform_payload(nb_name, "Notebook"), indent=2), encoding="utf-8")
        
        # Format clean Fabric notebook source
        formatted_nb = (
            "# Fabric notebook source\n\n"
            "# METADATA ********************\n\n"
            "# META {\n"
            '# META   "kernel_info": {\n'
            '# META     "name": "synapse_pyspark"\n'
            "# META   }\n"
            "# META }\n\n"
            "# CELL ********************\n\n"
            f"{nb_code}\n\n"
            "# METADATA ********************\n\n"
            "# META {\n"
            '# META   "language": "python",\n'
            '# META   "language_group": "synapse_pyspark"\n'
            "# META }\n"
        )
        py_file.write_text(formatted_nb, encoding="utf-8")
        created_paths.extend([str(plat_file), str(py_file)])

    # 3. Write Data Pipelines
    pipeline = plan.get("pipeline")
    if pipeline and isinstance(pipeline, dict) and pipeline.get("name"):
        pl_name = pipeline["name"]
        pl_dir = target_dir / f"{pl_name}.DataPipeline"
        pl_dir.mkdir(parents=True, exist_ok=True)
        plat_file = pl_dir / ".platform"
        content_file = pl_dir / "pipeline-content.json"

        plat_file.write_text(json.dumps(_platform_payload(pl_name, "DataPipeline"), indent=2), encoding="utf-8")
        
        activities = []
        for nb in plan.get("notebooks", []):
            nb_name = nb.get("name", "nb_transform")
            activities.append({
                "name": nb_name,
                "type": "TridentNotebook",
                "typeProperties": {"notebookName": nb_name},
                "policy": {"timeout": "0.12:00:00", "retry": 0},
                "dependsOn": [],
            })

        pl_payload = {"properties": {"activities": activities}}
        content_file.write_text(json.dumps(pl_payload, indent=2), encoding="utf-8")
        created_paths.extend([str(plat_file), str(content_file)])

    return created_paths


def load_mirror_catalog(base_dir: str = "fabric_workspace") -> dict[str, MirrorItem]:
    """
    Scans the local mirror directory and indexes all items, tables, and schemas in sub-milliseconds.
    """
    catalog: dict[str, MirrorItem] = {}
    base_path = Path(base_dir)
    if not base_path.exists():
        return catalog

    for item_dir in base_path.rglob("*.*"):
        if not item_dir.is_dir():
            continue
        suffix = item_dir.suffix.lstrip(".")
        if suffix not in ("Notebook", "Lakehouse", "DataPipeline", "Warehouse"):
            continue

        item_name = item_dir.stem
        item_type = suffix
        tables: list[str] = []
        columns: list[str] = []

        if item_type == "Notebook":
            py_file = item_dir / "notebook-content.py"
            if py_file.exists():
                code = py_file.read_text(encoding="utf-8")
                tables = re.findall(r'\.saveAsTable\(\s*["\']([a-zA-Z0-9_]+)["\']\s*\)', code)
                columns = resolve_upstream_schema(code)

        catalog[item_name] = MirrorItem(
            name=item_name,
            item_type=item_type,
            folder_path=str(item_dir.parent),
            file_path=str(item_dir),
            tables=tables,
            columns=columns,
        )

    return catalog


def hydrate_context_from_mirror(query: str, base_dir: str = "fabric_workspace") -> str:
    """
    Sub-millisecond JIT Context Hydration from local declarative repository.
    Extracts relevant upstream tables and schemas for LLM prompts without cloud latency.
    """
    catalog = load_mirror_catalog(base_dir=base_dir)
    if not catalog:
        return ""

    matched_items = []
    tokens = set(re.findall(r"\b[a-zA-Z0-9_]{3,}\b", query.lower()))

    for name, item in catalog.items():
        name_lower = name.lower()
        if any(tok in name_lower for tok in tokens) or any(any(tok in t.lower() for tok in tokens) for t in item.tables):
            matched_items.append(item)

    if not matched_items:
        # Fallback to returning all existing lakehouses/tables
        matched_items = list(catalog.values())[:4]

    lines = ["## ⚡ Local Workspace Context (JIT Hydrated)"]
    for it in matched_items[:6]:
        tbl_info = f" -> Tables: {', '.join(it.tables)}" if it.tables else ""
        col_info = f" (Columns: {', '.join(it.columns[:8])})" if it.columns else ""
        lines.append(f"- [{it.item_type}] `{it.name}`{tbl_info}{col_info}")

    return "\n".join(lines)

