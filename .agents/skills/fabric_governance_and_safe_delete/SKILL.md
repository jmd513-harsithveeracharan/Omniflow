---
name: fabric_governance_and_safe_delete
description: Protocols for blast-radius impact analysis, automated item definition snapshot backups, and safe deletion confirmation gates. Trigger when deleting, modifying schemas, or overwriting Fabric items.
---

# Fabric Governance & Safe Deletion Playbook

## 1. Risk Tier Classification
- **LOW Risk**: Creating new items (`create_item`), adding non-null columns (`add_column`), reading definitions. -> No confirmation prompt needed.
- **MEDIUM Risk**: Modifying schemas (`modify_schema`), updating notebook definitions (`update_definition`). -> Display warning banner.
- **HIGH Risk**: Deleting lakehouses/notebooks/pipelines (`delete_item`), deleting folders (`delete_folder`), overwriting tables (`overwrite_table`). -> Strict confirmation gate required.

## 2. Automated Definition Snapshot (Soft-Delete)
Before executing a HIGH-risk delete operation:
1. Fetch item definition via `POST /v1/workspaces/{id}/items/{id}/getDefinition`.
2. Save raw definition JSON to disk: `_deleted_archive/{timestamp}_{item_name}/definition.json`.
3. Log audit event in SQLite database.

## 3. Type-to-Confirm Gate
Require the user to type the exact phrase `DELETE <ITEM_NAME>` before triggering the DELETE API call. Reject any mismatched confirmation strings.
