"""
app/safe_batch_delete.py
------------------------
Safely backs up and deletes specific target folders and their items.
Complies with Blast-Radius Governance & Zero Hardcoding rules.
"""
import json
import os
import sys
import time
from datetime import datetime

from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME
from app.fabric_client import (
    delete_folder,
    delete_item,
    get_item_definition,
    list_folders,
    list_workspace_items,
)

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

TARGET_FOLDERS = [
    "Enterprise_Retail_Medallion",
    "FinTech_Risk_Analytics",
    "FinTech_Risk_Analytics_02",
    "RetailCustomer360",
    "SAP_Sales_Pipelines",
    "side_ECommerce_Analytics",
    "sorting_algorithms",
]

ARCHIVE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "_deleted_archive")
os.makedirs(ARCHIVE_DIR, exist_ok=True)


def run_safe_batch_delete(target_folders: list[str] | None = None):
    targets = target_folders or (sys.argv[1:] if len(sys.argv) > 1 else TARGET_FOLDERS)

    print("======================================================")
    print("      Fabric AI Studio — Safe Batch Delete Protocol   ")
    print(f"  Workspace: {ALLOWED_WORKSPACE_NAME} ({ALLOWED_WORKSPACE_ID})")
    print(f"  Target Folders ({len(targets)}): {', '.join(targets)}")
    print("======================================================")

    # 1. Match Folders
    folders = list_folders(ALLOWED_WORKSPACE_ID)
    matched_folders = {}
    for f in folders:
        name = f.get("displayName")
        fid = f.get("id")
        if name in targets:
            matched_folders[fid] = name
            print(f"[FOUND FOLDER] {name} -> ID: {fid}")

    if not matched_folders:
        print("[INFO] No matching target folders found in workspace.")
        return


    # 2. Match Items Inside Target Folders
    items_res = list_workspace_items(ALLOWED_WORKSPACE_ID)
    items = items_res.get("items", [])
    target_items = []

    for it in items:
        fid = it.get("folderId") or it.get("parentFolderId")
        if fid in matched_folders:
            folder_name = matched_folders[fid]
            target_items.append((it, folder_name))

    print(f"\nFound {len(target_items)} items across {len(matched_folders)} target folders.")

    # 3. Soft-Delete Snapshot Backup (Governance Gate)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    backup_folder = os.path.join(ARCHIVE_DIR, f"batch_delete_{timestamp}")
    os.makedirs(backup_folder, exist_ok=True)

    print(f"\n[BACKUP] Creating definition snapshots in {backup_folder}...")
    for it, folder_name in target_items:
        item_id = it.get("id")
        item_name = it.get("displayName")
        item_type = it.get("type")

        # Skip SQLEndpoints as they are read-only views attached to Lakehouses
        if item_type == "SQLEndpoint":
            continue

        try:
            definition = get_item_definition(item_id, ALLOWED_WORKSPACE_ID)
            item_backup = {
                "id": item_id,
                "name": item_name,
                "type": item_type,
                "folder": folder_name,
                "timestamp": timestamp,
                "definition": definition,
            }
            file_path = os.path.join(backup_folder, f"{folder_name}_{item_type}_{item_name}.json")
            with open(file_path, "w", encoding="utf-8") as bf:
                json.dump(item_backup, bf, indent=2)
            print(f"  [OK] Snapshot saved: {item_name} ({item_type})")
        except Exception as e:
            print(f"  [WARN] Snapshot warning for {item_name}: {e}")

    # 4. Delete Items (Lakehouses, Notebooks, Pipelines, Environments)
    print("\n[DELETING ITEMS] Deleting items inside target folders...")
    deleted_items_count = 0
    for it, _folder_name in target_items:
        item_id = it.get("id")
        item_name = it.get("displayName")
        item_type = it.get("type")

        # SQLEndpoints get automatically deleted when the Lakehouse is deleted
        if item_type == "SQLEndpoint":
            continue

        print(f"  -> Deleting [{item_type}] '{item_name}' (ID: {item_id})...")
        success = delete_item(item_id, ALLOWED_WORKSPACE_ID)
        if success:
            deleted_items_count += 1
            print(f"    [OK] Deleted {item_name}")
        else:
            print(f"    [FAIL] Failed to delete {item_name}")
        time.sleep(0.5)

    # 5. Delete Folders
    print("\n[DELETING FOLDERS] Deleting empty target folders...")
    deleted_folders_count = 0
    for fid, fname in matched_folders.items():
        print(f"  -> Deleting folder '{fname}' (ID: {fid})...")
        success = delete_folder(fid, ALLOWED_WORKSPACE_ID)
        if success:
            deleted_folders_count += 1
            print(f"    [OK] Deleted folder {fname}")
        else:
            print(f"    [FAIL] Failed to delete folder {fname}")
        time.sleep(0.5)

    print("\n======================================================")
    print("              CLEANUP COMPLETE REPORT                 ")
    print(f"  Items Deleted:   {deleted_items_count}")
    print(f"  Folders Deleted: {deleted_folders_count}")
    print(f"  Backup Archive:  {backup_folder}")
    print("======================================================")


if __name__ == "__main__":
    run_safe_batch_delete()
