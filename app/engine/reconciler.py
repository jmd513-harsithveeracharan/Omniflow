"""
app/engine/reconciler.py
------------------------
Bidirectional Cloud-to-Local Workspace Reconciliation & Drift Detection Engine.
Inspired by Terraform Plan and TobikoData/sqlmesh virtual environment diffing.
Compares local declarative Git items against live Fabric workspace items.
"""

from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field

from app.config import ALLOWED_WORKSPACE_ID
from app.fabric_client import list_workspace_items
from app.engine.workspace_mirror import load_mirror_catalog


class ReconciliationItem(BaseModel):
    name: str
    item_type: str
    status: str  # SYNCED | LOCAL_ONLY | CLOUD_ONLY | MODIFIED
    details: str = ""


class ReconciliationReport(BaseModel):
    workspace_id: str
    total_local: int = 0
    total_cloud: int = 0
    synced_count: int = 0
    local_only_count: int = 0
    cloud_only_count: int = 0
    items: list[ReconciliationItem] = Field(default_factory=list)


def reconcile_workspace(
    workspace_id: str = ALLOWED_WORKSPACE_ID,
    base_dir: str = "fabric_workspace",
    cloud_items: list[dict[str, Any]] | None = None,
) -> ReconciliationReport:
    """
    Compares local declarative Git artifacts against live Microsoft Fabric workspace items.
    Identifies uncommitted cloud drifts or pending local deployments.
    """
    local_catalog = load_mirror_catalog(base_dir=base_dir)

    if cloud_items is None:
        try:
            cloud_res = list_workspace_items(workspace_id=workspace_id)
            cloud_items = cloud_res.get("items", []) if isinstance(cloud_res, dict) else []
        except Exception:
            cloud_items = []

    # Map cloud items by lower name
    cloud_map: dict[str, dict[str, Any]] = {}
    for c in cloud_items:
        c_name = (c.get("displayName") or c.get("name") or "").strip().lower()
        c_type = (c.get("type") or "").strip()
        if c_name:
            cloud_map[c_name] = {"raw": c, "type": c_type}

    report_items: list[ReconciliationItem] = []
    synced = 0
    local_only = 0
    cloud_only = 0

    # 1. Evaluate Local items vs Cloud
    matched_cloud_names = set()
    for local_name, loc_item in local_catalog.items():
        loc_lower = local_name.lower()
        if loc_lower in cloud_map:
            matched_cloud_names.add(loc_lower)
            synced += 1
            report_items.append(ReconciliationItem(
                name=local_name,
                item_type=loc_item.item_type,
                status="SYNCED",
                details="Item is deployed and synced in cloud workspace.",
            ))
        else:
            local_only += 1
            report_items.append(ReconciliationItem(
                name=local_name,
                item_type=loc_item.item_type,
                status="LOCAL_ONLY",
                details="Item exists in local declarative mirror; pending cloud deployment.",
            ))

    # 2. Evaluate Cloud-only items
    for c_lower, c_data in cloud_map.items():
        if c_lower not in matched_cloud_names:
            cloud_only += 1
            c_disp = c_data["raw"].get("displayName") or c_data["raw"].get("name") or c_lower
            report_items.append(ReconciliationItem(
                name=c_disp,
                item_type=c_data["type"] or "Unknown",
                status="CLOUD_ONLY",
                details="External item in cloud workspace; not tracked in local Git mirror.",
            ))

    return ReconciliationReport(
        workspace_id=workspace_id,
        total_local=len(local_catalog),
        total_cloud=len(cloud_items),
        synced_count=synced,
        local_only_count=local_only,
        cloud_only_count=cloud_only,
        items=report_items,
    )


def format_reconciliation_markdown(report: ReconciliationReport) -> str:
    """Formats a rich Markdown reconciliation diff report."""
    lines = [
        f"### 🔄 Workspace Reconciliation Report (`{report.workspace_id[:8]}...`)",
        f"- **Local Git Items**: `{report.total_local}` · **Live Cloud Items**: `{report.total_cloud}`",
        f"- **Synced**: `✅ {report.synced_count}` · **Local Only**: `📦 {report.local_only_count}` · **Cloud Only**: `☁️ {report.cloud_only_count}`\n",
        "| Status | Item Name | Type | Action / Details |",
        "| :--- | :--- | :--- | :--- |",
    ]
    status_icons = {
        "SYNCED": "✅ SYNCED",
        "LOCAL_ONLY": "📦 LOCAL_ONLY",
        "CLOUD_ONLY": "☁️ CLOUD_ONLY",
        "MODIFIED": "⚠️ MODIFIED",
    }
    for item in report.items:
        icon = status_icons.get(item.status, item.status)
        lines.append(f"| {icon} | `{item.name}` | {item.item_type} | {item.details} |")

    return "\n".join(lines)

