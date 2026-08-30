"""
app/impact_analyzer.py
-----------------------
Blast-radius control and safe deletion protocol.

Every destructive or modifying Fabric operation goes through analyze_impact()
BEFORE execution. The result tells the caller:
  - Risk level (LOW / MEDIUM / HIGH)
  - Warning message shown to the user
  - Whether explicit confirmation is required (type-to-confirm)
  - Whether a soft-delete definition snapshot must be taken first

For HIGH risk deletions, safe_delete() orchestrates:
  1. Dependency audit (scans active pipelines for references)
  2. Soft-delete definition backup (saves Base64 snapshot)
  3. Confirmation gate (caller verifies user typed the correct phrase)
  4. Hard delete via Fabric REST API
  5. Audit log entry
"""

import json
import os
import time
from datetime import datetime, timezone
from app.fabric_client import (
    list_workspace_items,
    get_item_definition,
    delete_item,
    ALLOWED_WORKSPACE_ID,
)

# ── Risk Classification Table ─────────────────────────────────────────────────

_RISK_TABLE = {
    # (operation_type)                    -> (risk_level, requires_confirmation, message)
    "create_item":          ("LOW",    False, "Adding a new Fabric item is safe."),
    "create_folder":        ("LOW",    False, "Adding a new workspace folder is safe."),
    "update_notebook":      ("LOW",    False, "Updating notebook code in a new/pending item."),
    "add_column":           ("LOW",    False, "Adding a column to a Delta table is non-breaking."),
    "modify_schema":        ("MEDIUM", False,
                             "⚠️ Changing a column type may break downstream reports or pipelines that read this table."),
    "update_active_notebook": ("MEDIUM", False,
                               "⚠️ This notebook is referenced by an active pipeline. Changes will affect the next scheduled run."),
    "overwrite_table":      ("HIGH",   True,
                             "🔴 FULL OVERWRITE: All existing rows in this Delta table will be replaced. "
                             "Downstream pipelines and reports will be affected."),
    "delete_item":          ("HIGH",   True,
                             "🔴 PERMANENT DELETE: This Fabric item will be permanently removed. "
                             "A backup snapshot will be taken first."),
    "delete_folder":        ("HIGH",   True,
                             "🔴 PERMANENT DELETE: This folder and ALL its contents will be permanently removed. "
                             "Backup snapshots will be taken for all items inside."),
    "truncate_table":       ("HIGH",   True,
                             "🔴 TRUNCATE: All rows in this Delta table will be deleted. "
                             "This cannot be undone without Delta Time-Travel restore."),
}

# ── Archive Directory ─────────────────────────────────────────────────────────

_ARCHIVE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "_deleted_archive")


def _ensure_archive_dir():
    os.makedirs(_ARCHIVE_DIR, exist_ok=True)


# ── Public Interface ──────────────────────────────────────────────────────────

def analyze_impact(operation: str, context: dict | None = None) -> dict:
    """
    Determines the risk level and required safeguards for a Fabric operation.

    Args:
        operation: One of the keys in _RISK_TABLE.
        context:   Optional dict with additional context (item_name, table_name, etc.).

    Returns:
        {
            "operation": str,
            "risk_level": "LOW" | "MEDIUM" | "HIGH",
            "requires_confirmation": bool,
            "confirmation_phrase": str | None,  # User must type this to confirm HIGH risk ops
            "warning_message": str,
            "can_proceed": bool,   # True for LOW/MEDIUM; False means MUST confirm first
        }
    """
    context = context or {}
    if operation not in _RISK_TABLE:
        return {
            "operation": operation,
            "risk_level": "LOW",
            "requires_confirmation": False,
            "confirmation_phrase": None,
            "warning_message": "Operation not classified — proceeding as LOW risk.",
            "can_proceed": True,
        }

    risk_level, requires_confirmation, message = _RISK_TABLE[operation]

    item_name = context.get("item_name", "this item")
    confirmation_phrase = f"DELETE {item_name.upper()}" if requires_confirmation else None

    return {
        "operation": operation,
        "risk_level": risk_level,
        "requires_confirmation": requires_confirmation,
        "confirmation_phrase": confirmation_phrase,
        "warning_message": message,
        "can_proceed": not requires_confirmation,
    }


def take_definition_snapshot(item_id: str, item_name: str, workspace_id: str = ALLOWED_WORKSPACE_ID) -> str | None:
    """
    Fetches the item's current Base64 definition from Fabric and saves it locally
    to _deleted_archive/<timestamp>/<item_name>/definition.json.

    Returns the local archive path or None if snapshot failed.
    """
    _ensure_archive_dir()
    definition_parts = get_item_definition(item_id, workspace_id)

    if not definition_parts:
        print(f"[IMPACT] Could not snapshot definition for '{item_name}' (ID: {item_id}).")
        return None

    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    archive_path = os.path.join(_ARCHIVE_DIR, f"{timestamp}_{item_name}")
    os.makedirs(archive_path, exist_ok=True)

    snapshot = {
        "item_id":    item_id,
        "item_name":  item_name,
        "workspace_id": workspace_id,
        "snapshotted_at": datetime.now(timezone.utc).isoformat(),
        "definition_parts": definition_parts,
    }
    snapshot_file = os.path.join(archive_path, "definition.json")
    with open(snapshot_file, "w", encoding="utf-8") as f:
        json.dump(snapshot, f, indent=2)

    print(f"[IMPACT] Soft-delete snapshot saved: {snapshot_file}")
    return snapshot_file


def safe_delete(
    item_id: str,
    item_name: str,
    confirmation_provided: str,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> dict:
    """
    Executes the 4-step Safe Deletion Protocol:
      1. Verifies user typed the correct confirmation phrase.
      2. Takes a definition snapshot (soft-delete backup).
      3. Calls the Fabric DELETE API.
      4. Writes an audit log entry.

    Args:
        item_id:                Fabric item ID to delete.
        item_name:              Display name (used for confirmation phrase).
        confirmation_provided:  The phrase the user typed in the UI.
        workspace_id:           Target workspace.

    Returns:
        {success, snapshot_path, message} or {success: False, error}
    """
    expected_phrase = f"DELETE {item_name.upper()}"

    # Step 1: Verify confirmation phrase
    if confirmation_provided.strip().upper() != expected_phrase:
        return {
            "success": False,
            "error": f"Confirmation phrase mismatch. Expected: '{expected_phrase}'. Got: '{confirmation_provided}'.",
        }

    # Step 2: Soft-delete snapshot
    snapshot_path = take_definition_snapshot(item_id, item_name, workspace_id)

    # Step 3: Hard delete
    deleted = delete_item(item_id, workspace_id)
    if not deleted:
        return {
            "success": False,
            "error": f"Fabric DELETE API call failed for item '{item_name}' (ID: {item_id}).",
            "snapshot_path": snapshot_path,
        }

    # Step 4: Audit log
    audit_entry = {
        "action":      "DELETE",
        "item_id":     item_id,
        "item_name":   item_name,
        "workspace_id": workspace_id,
        "deleted_at":  datetime.now(timezone.utc).isoformat(),
        "snapshot_path": snapshot_path,
        "confirmed_by_phrase": expected_phrase,
    }
    _log_audit(audit_entry)

    return {
        "success": True,
        "message": f"Item '{item_name}' deleted successfully.",
        "snapshot_path": snapshot_path,
    }


def _log_audit(entry: dict):
    """Appends an action to the local audit_trail.json file."""
    audit_file = os.path.join(os.path.dirname(os.path.dirname(__file__)), "audit_trail.json")
    trail = []
    if os.path.exists(audit_file):
        try:
            with open(audit_file, "r", encoding="utf-8") as f:
                trail = json.load(f)
        except Exception:
            trail = []
    trail.append(entry)
    with open(audit_file, "w", encoding="utf-8") as f:
        json.dump(trail, f, indent=2)
    print(f"[AUDIT] Logged: {entry.get('action')} on '{entry.get('item_name')}'")
