"""
app/fabric_client.py
--------------------
Single source of truth for ALL Microsoft Fabric REST API calls.

No other module should call requests.get/post directly to the Fabric API.
All raw HTTP interactions go through this module.

Workspace security is enforced here — every write/delete operation asserts
that the target workspace matches the allowed workspace in config.
Single source of truth facade for ALL Microsoft Fabric REST API calls.
Preserves backward compatibility while business logic is modularized
under app/fabric/ as per AGENTS.md rules.
"""

import time

import requests

from app.auth import get_auth_headers
from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME

_BASE = "https://api.fabric.microsoft.com/v1"
_LRO_MAX_POLLS = 20
_LRO_POLL_INTERVAL = 2.0  # seconds
from app.fabric.core import (
    _BASE,
    _LRO_MAX_POLLS,
    _LRO_POLL_INTERVAL,
    WorkspaceSecurityError,
    _assert_workspace,
    _poll_lro,
)
from app.fabric.workspaces import (
    list_workspaces,
    list_workspace_items,
    list_folders,
    get_workspace_tree,
    _get_or_create_single_folder,
    get_or_create_folder,
    delete_folder,
)
from app.fabric.items import (
    create_item,
    move_item,
    update_definition,
    get_item_definition,
    delete_item,
    provision_item_with_definition,
)
from app.fabric.shortcuts import (
    create_onelake_shortcut,
    list_onelake_shortcuts,
    get_onelake_shortcut,
    delete_onelake_shortcut,
)
from app.fabric.jobs import (
    trigger_pipeline_run,
    create_pipeline_schedule,
    get_job_status,
    get_git_status,
    commit_to_git,
    run_notebook,
    refresh_semantic_model,
)


class WorkspaceSecurityError(Exception):
    """Raised when an operation targets a workspace outside the allowed list."""
    pass


def _assert_workspace(workspace_id: str):
    """Hard security guardrail — blocks any operation on non-allowed workspaces."""
    if workspace_id != ALLOWED_WORKSPACE_ID:
        raise WorkspaceSecurityError(
            f"SECURITY BLOCK: Target workspace '{workspace_id}' is NOT allowed. "
            f"Engine is locked to '{ALLOWED_WORKSPACE_NAME}' ({ALLOWED_WORKSPACE_ID})."
        )


def _poll_lro(location: str, headers: dict) -> bool:
    """
    Polls a Fabric Long-Running Operation (LRO) URL until complete or timeout.
    Returns True on success, False on timeout.
    """
    for _ in range(_LRO_MAX_POLLS):
        time.sleep(_LRO_POLL_INTERVAL)
        try:
            resp = requests.get(location, headers=headers, timeout=15)
            if resp.status_code == 200:
                status = resp.json().get("status", "").lower()
                if status in ("succeeded", "completed", ""):
                    return True
                if status in ("failed", "canceled"):
                    print(f"[LRO] Operation failed: {resp.text[:200]}")
                    return False
            elif resp.status_code == 202:
                continue  # Still in progress
        except Exception as e:
            print(f"[LRO] Poll error: {e}")
    print("[LRO] Timed out waiting for operation to complete.")
    return False


# ── Workspace Operations ──────────────────────────────────────────────────────

def list_workspaces() -> list[dict]:
    """
    Returns all Fabric workspaces the authenticated user has access to.
    Used for dynamic workspace selection in the UI.
    """
    try:
        headers = get_auth_headers()
        resp = requests.get(f"{_BASE}/workspaces", headers=headers, timeout=10)
        if resp.status_code == 200:
            return resp.json().get("value", [])
        print(f"[FABRIC] list_workspaces failed: {resp.status_code} {resp.text[:200]}")
    except Exception as e:
        print(f"[FABRIC] list_workspaces error: {e}")
    return []


def list_workspace_items(workspace_id: str = ALLOWED_WORKSPACE_ID) -> dict:
    """Lists all items in a workspace. Returns {success, items}."""
    headers = get_auth_headers()
    resp = requests.get(
        f"{_BASE}/workspaces/{workspace_id}/items",
        headers=headers,
        timeout=15,
    )
    if resp.status_code == 200:
        return {"success": True, "items": resp.json().get("value", [])}
    return {"success": False, "error": resp.text, "items": []}


# ── Folder Operations ─────────────────────────────────────────────────────────

def list_folders(workspace_id: str = ALLOWED_WORKSPACE_ID) -> list[dict]:
    headers = get_auth_headers()
    resp = requests.get(f"{_BASE}/workspaces/{workspace_id}/folders", headers=headers, timeout=15)
    if resp.status_code == 200:
        return resp.json().get("value", [])
    return []


def get_workspace_tree(workspace_id: str = ALLOWED_WORKSPACE_ID) -> dict:
    """
    Fetches workspace folders and items from the Fabric REST API and returns a
    nested hierarchical tree structure including subfolders under parent folders.

    Returns:
        {
          "workspace_id": str,
          "folders": [{"id", "name", "items": [...], "subfolders": [...]}],
          "all_folders": [{"id", "name", "items": [...]}],
          "root_items": [{"id", "name", "type", "description"}],
          "error": str | None
        }
    """
    try:
        folders = list_folders(workspace_id)
        items_result = list_workspace_items(workspace_id)
        items = items_result.get("items", [])

        # Build folder lookup
        folder_map: dict[str, dict] = {}
        for folder in folders:
            fid = folder.get("id", "")
            folder_map[fid] = {
                "id": fid,
                "name": folder.get("displayName", "Unnamed Folder"),
                "parentFolderId": folder.get("parentFolderId"),
                "items": [],
                "subfolders": [],
            }

        root_items = []
        for item in items:
            item_entry = {
                "id":          item.get("id"),
                "name":        item.get("displayName", "Unnamed"),
                "type":        item.get("type", "Unknown"),
                "description": item.get("description", ""),
                "folderId":    item.get("parentFolderId") or item.get("folderId"),
            }
            parent_id = item_entry["folderId"]
            if parent_id and parent_id in folder_map:
                folder_map[parent_id]["items"].append(item_entry)
            else:
                root_items.append(item_entry)

        # Assemble nested folder hierarchy
        top_level_folders = []
        for fid, f_data in folder_map.items():
            pid = f_data.get("parentFolderId")
            if pid and pid in folder_map:
                folder_map[pid]["subfolders"].append(f_data)
            else:
                top_level_folders.append(f_data)

        return {
            "workspace_id": workspace_id,
            "folders": top_level_folders,
            "all_folders": list(folder_map.values()),
            "root_items": root_items,
            "error": None,
        }
    except Exception as e:
        print(f"[FABRIC] get_workspace_tree error: {e}")
        return {
            "workspace_id": workspace_id,
            "folders": [],
            "all_folders": [],
            "root_items": [],
            "error": str(e),
        }


def _get_or_create_single_folder(
    folder_name: str,
    workspace_id: str,
    parent_folder_id: str | None,
    headers: dict,
) -> str | None:
    """Helper to find or create a single folder."""
    # Check if folder already exists in workspace
    for folder in list_folders(workspace_id):
        if folder.get("displayName") == folder_name:
            if parent_folder_id is None or folder.get("parentFolderId") == parent_folder_id:
                return folder.get("id")

    # Create new folder
    payload: dict = {"displayName": folder_name}
    if parent_folder_id:
        payload["parentFolderId"] = parent_folder_id

    resp = requests.post(
        f"{_BASE}/workspaces/{workspace_id}/folders",
        headers=headers,
        json=payload,
        timeout=15,
    )
    if resp.status_code in (200, 201):
        return resp.json().get("id")

    # If failed with parentFolderId, try fallback creation without it
    if parent_folder_id:
        fallback_resp = requests.post(
            f"{_BASE}/workspaces/{workspace_id}/folders",
            headers=headers,
            json={"displayName": folder_name},
            timeout=15,
        )
        if fallback_resp.status_code in (200, 201):
            return fallback_resp.json().get("id")

    print(f"[FABRIC] Failed to create folder '{folder_name}': {resp.status_code} {resp.text[:200]}")
    return None


def get_or_create_folder(
    folder_name: str,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
    parent_folder_id: str | None = None,
) -> str | None:
    """
    Returns the folder ID for the given name, creating it if it doesn't exist.
    Supports nested paths (e.g. 'AI_Test_Folder/SalesPipeline').
    Enforces containment inside AI_Test_Folder if a single custom folder name is given.
    Idempotent — safe to call multiple times.
    """
    _assert_workspace(workspace_id)
    headers = get_auth_headers()

    if not folder_name or not folder_name.strip():
        return None

    clean_name = folder_name.strip().strip("/")
    # Handle multi-level paths e.g. "AI_Test_Folder/SalesPipeline"
    if "/" in clean_name:
        parts = [p.strip() for p in clean_name.split("/") if p.strip()]
        current_parent = parent_folder_id
        for part in parts:
            current_parent = _get_or_create_single_folder(part, workspace_id, current_parent, headers)
            if not current_parent:
                break
        return current_parent

    # If it's a single custom folder and parent_folder_id is None, ensure AI_Test_Folder root first
    if clean_name != "AI_Test_Folder" and parent_folder_id is None:
        root_id = _get_or_create_single_folder("AI_Test_Folder", workspace_id, None, headers)
        return _get_or_create_single_folder(clean_name, workspace_id, root_id, headers)

    return _get_or_create_single_folder(clean_name, workspace_id, parent_folder_id, headers)


def delete_folder(folder_id: str, workspace_id: str = ALLOWED_WORKSPACE_ID) -> bool:
    """Deletes a folder from the workspace."""
    _assert_workspace(workspace_id)
    headers = get_auth_headers()
    resp = requests.delete(
        f"{_BASE}/workspaces/{workspace_id}/folders/{folder_id}",
        headers=headers,
        timeout=15,
    )
    success = resp.status_code in (200, 204)
    if success:
        print(f"[FABRIC] Deleted folder {folder_id} from workspace {workspace_id}.")
    else:
        print(f"[FABRIC] Delete folder failed for {folder_id}: {resp.status_code} {resp.text[:200]}")
    return success


# ── Item Operations ───────────────────────────────────────────────────────────

def create_item(
    display_name: str,
    item_type: str,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
    folder_id: str | None = None,
    description: str = "",
) -> dict:
    """
    Creates a Fabric item (Lakehouse, Notebook, DataPipeline, Environment).
    Returns {success, item_id, data} or {success: False, error}.
    """
    _assert_workspace(workspace_id)
    headers = get_auth_headers()

    payload = {
        "displayName": display_name,
        "type": item_type,
        "description": description or f"Provisioned by Fabric AI Studio — {ALLOWED_WORKSPACE_NAME}",
    }

    resp = requests.post(
        f"{_BASE}/workspaces/{workspace_id}/items",
        headers=headers,
        json=payload,
        timeout=20,
    )

    if resp.status_code in (200, 201, 202):
        data = resp.json() if resp.text else {}
        item_id = data.get("id")

        # Move to folder if requested
        if folder_id and item_id:
            move_item(item_id, folder_id, workspace_id)

        print(f"[FABRIC] Created {item_type} '{display_name}' (ID: {item_id})")
        return {"success": True, "item_id": item_id, "data": data}

    # Handle 409 Conflict / Item Name Already Exists / Renaming
    if resp.status_code in (400, 409) and ("already in use" in resp.text.lower() or "alreadyexists" in resp.text.lower() or "conflict" in resp.text.lower()):
        print(f"[FABRIC] Item '{display_name}' already exists in workspace. Finding existing item...")
        ws_items = list_workspace_items(workspace_id).get("items", [])
        for item in ws_items:
            if item.get("type", "").lower() == item_type.lower() and item.get("displayName", "").lower() == display_name.lower():
                item_id = item.get("id")
                # Rename to exact requested case if needed
                if item.get("displayName") != display_name:
                    try:
                        patch_resp = requests.patch(
                            f"{_BASE}/workspaces/{workspace_id}/items/{item_id}",
                            headers=headers,
                            json={"displayName": display_name},
                            timeout=15,
                        )
                        if patch_resp.status_code in (200, 201):
                            print(f"[FABRIC] Renamed existing {item_type} to '{display_name}' (ID: {item_id})")
                    except Exception as e:
                        print(f"[FABRIC] Rename warning: {e}")

                if folder_id and item.get("folderId") != folder_id:
                    move_item(item_id, folder_id, workspace_id)

                return {"success": True, "item_id": item_id, "data": item, "already_existed": True}

    print(f"[FABRIC] Failed to create {item_type} '{display_name}': {resp.status_code} {resp.text[:300]}")
    return {"success": False, "error": resp.text, "status_code": resp.status_code}


def move_item(
    item_id: str,
    folder_id: str,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> bool:
    """Moves an item into a folder within the workspace."""
    _assert_workspace(workspace_id)
    headers = get_auth_headers()
    resp = requests.post(
        f"{_BASE}/workspaces/{workspace_id}/items/{item_id}/move",
        headers=headers,
        json={"targetFolderId": folder_id},
        timeout=15,
    )
    return resp.status_code in (200, 201, 202)


def update_definition(
    item_id: str,
    parts: list[dict],
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> bool:
    """
    Uploads item definition parts (Base64 encoded).
    Polls the LRO Location header if response is 202 Accepted.

    parts format: [{"path": "notebook-content.py", "payload": "<b64>", "payloadType": "InlineBase64"}]
    """
    _assert_workspace(workspace_id)
    headers = get_auth_headers()
    payload = {"definition": {"parts": parts}}

    resp = requests.post(
        f"{_BASE}/workspaces/{workspace_id}/items/{item_id}/updateDefinition",
        headers=headers,
        json=payload,
        timeout=30,
    )

    if resp.status_code in (200, 201):
        return True
    if resp.status_code == 202:
        location = resp.headers.get("Location")
        if location:
            return _poll_lro(location, headers)
        return True  # No LRO location — assume success

    print(f"[FABRIC] updateDefinition failed for {item_id}: {resp.status_code} {resp.text[:300]}")
    return False


def get_item_definition(item_id: str, workspace_id: str = ALLOWED_WORKSPACE_ID) -> dict | None:
    """
    Fetches the current Base64 definition of an item.
    Used for Soft-Delete snapshots and self-healing code patching.
    Returns the raw parts list or None on failure.
    """
    _assert_workspace(workspace_id)
    headers = get_auth_headers()
    resp = requests.post(
        f"{_BASE}/workspaces/{workspace_id}/items/{item_id}/getDefinition",
        headers=headers,
        timeout=20,
    )
    if resp.status_code == 200:
        return resp.json().get("definition", {}).get("parts", [])
    if resp.status_code == 202:
        location = resp.headers.get("Location")
        if location:
            for _ in range(10):
                time.sleep(2)
                poll = requests.get(location, headers=headers, timeout=15)
                if poll.status_code == 200:
                    return poll.json().get("definition", {}).get("parts", [])
    print(f"[FABRIC] getDefinition failed for {item_id}: {resp.status_code}")
    return None


def delete_item(item_id: str, workspace_id: str = ALLOWED_WORKSPACE_ID) -> bool:
    """
    HARD DELETES a Fabric item.
    This must only be called AFTER the SafeDeletion protocol in impact_analyzer.py
    has taken a definition snapshot and obtained explicit user confirmation.
    """
    _assert_workspace(workspace_id)
    headers = get_auth_headers()
    resp = requests.delete(
        f"{_BASE}/workspaces/{workspace_id}/items/{item_id}",
        headers=headers,
        timeout=15,
    )
    success = resp.status_code in (200, 204)
    if success:
        print(f"[FABRIC] Deleted item {item_id} from workspace {workspace_id}.")
    else:
        print(f"[FABRIC] Delete failed for {item_id}: {resp.status_code} {resp.text[:200]}")
    return success


# ── Pipeline Execution & Monitoring ──────────────────────────────────────────

def trigger_pipeline_run(
    pipeline_id: str,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> dict:
    """
    Triggers a Data Factory pipeline run via the Fabric Jobs API.
    Returns {success, job_id, location} or {success: False, error}.
    """
    _assert_workspace(workspace_id)
    headers = get_auth_headers()
    resp = requests.post(
        f"{_BASE}/workspaces/{workspace_id}/items/{pipeline_id}/jobs/instances?jobType=Pipeline",
        headers=headers,
        timeout=20,
    )

    if resp.status_code in (200, 201, 202):
        location = resp.headers.get("Location", "")
        # Extract job ID from Location header
        job_id = location.split("/")[-1] if "/" in location else None
        print(f"[FABRIC] Pipeline {pipeline_id} triggered. Job ID: {job_id}")
        return {"success": True, "job_id": job_id, "location": location}

    print(f"[FABRIC] Pipeline trigger failed: {resp.status_code} {resp.text[:300]}")
    return {"success": False, "error": resp.text, "status_code": resp.status_code}


def create_pipeline_schedule(
    pipeline_id: str,
    time_str: str = "10:30",
    schedule_type: str = "Daily",
    time_zone: str = "UTC",
    days_valid: int = 365,
    enabled: bool = True,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> dict:
    """
    Creates/activates an automated schedule for a Data Factory pipeline in Microsoft Fabric.
    Official Spec: POST /v1/workspaces/{workspaceId}/items/{pipelineId}/jobs/Execute/schedules
    """
    import datetime
    _assert_workspace(workspace_id)
    headers = get_auth_headers()

    now = datetime.datetime.now(datetime.UTC)
    start_dt = now.strftime("%Y-%m-%dT%H:%M:%S")
    end_dt = (now + datetime.timedelta(days=days_valid)).strftime("%Y-%m-%dT%H:%M:%S")

    # Format time string cleanly (e.g. "10.30" -> "10:30", "5:00" -> "05:00")
    clean_time = time_str.replace(".", ":").strip()
    if ":" in clean_time:
        parts = clean_time.split(":")
        hh = parts[0].zfill(2)
        mm = parts[1].zfill(2)
        clean_time = f"{hh}:{mm}"
    else:
        clean_time = "10:30"

    payload = {
        "enabled": enabled,
        "configuration": {
            "type": schedule_type if schedule_type in ("Daily", "Weekly", "Cron") else "Daily",
            "startDateTime": start_dt,
            "endDateTime": end_dt,
            "localTimeZoneId": time_zone,
            "times": [clean_time],
        }
    }
    resp = requests.post(
        f"{_BASE}/workspaces/{workspace_id}/items/{pipeline_id}/jobs/Execute/schedules",
        headers=headers,
        json=payload,
        timeout=20,
    )
    if resp.status_code in (200, 201):
        print(f"[FABRIC] Pipeline schedule created for {pipeline_id} at {clean_time} {time_zone} (Valid until {end_dt[:10]}).")
        return {"success": True, "schedule": resp.json()}
    print(f"[FABRIC] Pipeline schedule create failed for {pipeline_id}: {resp.status_code} {resp.text}")
    return {"success": False, "error": resp.text, "status_code": resp.status_code}


def get_job_status(
    pipeline_id: str,
    job_id: str,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> dict:
    """
    Fetches the current status of a pipeline job instance.
    Returns {status, start_time, end_time, failure_reason} or error dict.

    status values: "NotStarted" | "InProgress" | "Completed" | "Failed" | "Cancelled"
    """
    _assert_workspace(workspace_id)
    headers = get_auth_headers()
    resp = requests.get(
        f"{_BASE}/workspaces/{workspace_id}/items/{pipeline_id}/jobs/instances/{job_id}",
        headers=headers,
        timeout=15,
    )

    if resp.status_code == 200:
        data = resp.json()
        return {
            "success": True,
            "status": data.get("status", "Unknown"),
            "start_time": data.get("startTimeUtc"),
            "end_time": data.get("endTimeUtc"),
            "failure_reason": data.get("failureReason"),
            "raw": data,
        }

    return {"success": False, "error": resp.text, "status_code": resp.status_code}


# ── Git Integration (CI/CD) ───────────────────────────────────────────────────

def get_git_status(workspace_id: str = ALLOWED_WORKSPACE_ID) -> dict:
    """
    Fetches the Git status of the connected workspace repository.
    Official Spec: POST /v1/workspaces/{workspaceId}/git/getGitStatus
    """
    _assert_workspace(workspace_id)
    headers = get_auth_headers()
    resp = requests.post(
        f"{_BASE}/workspaces/{workspace_id}/git/getGitStatus",
        headers=headers,
        timeout=20,
    )
    if resp.status_code == 200:
        return {"success": True, "git_status": resp.json()}
    return {"success": False, "error": resp.text, "status_code": resp.status_code}


def commit_to_git(
    comment: str,
    workspace_head: str | None = None,
    mode: str = "All",
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> dict:
    """
    Commits workspace changes to the connected Git branch.
    Official Spec: POST /v1/workspaces/{workspaceId}/git/commitToGit
    """
    _assert_workspace(workspace_id)
    headers = get_auth_headers()

    # If workspace_head is not passed, fetch it via get_git_status
    if not workspace_head:
        status_res = get_git_status(workspace_id)
        if status_res.get("success"):
            workspace_head = status_res.get("git_status", {}).get("workspaceHead", "")

    payload = {
        "mode": mode,
        "comment": comment[:300],
    }
    if workspace_head:
        payload["workspaceHead"] = workspace_head

    resp = requests.post(
        f"{_BASE}/workspaces/{workspace_id}/git/commitToGit",
        headers=headers,
        json=payload,
        timeout=30,
    )

    if resp.status_code in (200, 202):
        location = resp.headers.get("Location")
        if location and resp.status_code == 202:
            success = _poll_lro(location, headers)
            return {"success": success, "message": "Committed to Git"}
        return {"success": True, "message": "Committed to Git"}

    return {"success": False, "error": resp.text, "status_code": resp.status_code}


# ── Universal Item Provisioning Flow ───────────────────────────────────────────

def provision_item_with_definition(
    display_name: str,
    item_type: str,
    parts: list[dict] | None = None,
    folder_id: str | None = None,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
    description: str = "",
) -> dict:
    """
    Universal 2-phase provisioner for any Fabric item:
    1. Creates item in target workspace/folder.
    2. If definition parts provided, uploads Base64 definition.
    """
    _assert_workspace(workspace_id)
    create_res = create_item(
        display_name=display_name,
        item_type=item_type,
        workspace_id=workspace_id,
        folder_id=folder_id,
        description=description,
    )
    if not create_res.get("success"):
        return create_res

    item_id = create_res.get("item_id")
    if parts and item_id:
        update_ok = update_definition(item_id, parts, workspace_id)
        if not update_ok:
            return {
                "success": False,
                "item_id": item_id,
                "error": f"Failed to upload definition for {item_type} '{display_name}'",
            }

    return {
        "success": True,
        "item_id": item_id,
        "item_type": item_type,
        "display_name": display_name,
        "already_existed": create_res.get("already_existed", False),
    }


# ── OneLake Shortcuts (Priority 1) ────────────────────────────────────────────

def create_onelake_shortcut(
    item_id: str,
    shortcut_payload: dict,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
    conflict_policy: str = "GenerateUniqueName",
) -> dict:
    """
    Creates a OneLake shortcut on an item (Lakehouse, etc.).
    Official Spec: POST /v1/workspaces/{workspaceId}/items/{itemId}/shortcuts?shortcutConflictPolicy=...
    """
    _assert_workspace(workspace_id)
    headers = get_auth_headers()
    url = f"{_BASE}/workspaces/{workspace_id}/items/{item_id}/shortcuts"
    params = {}
    if conflict_policy:
        params["shortcutConflictPolicy"] = conflict_policy

    resp = requests.post(url, headers=headers, json=shortcut_payload, params=params, timeout=20)
    if resp.status_code in (200, 201):
        data = resp.json() if resp.text else {}
        print(f"[FABRIC] Created shortcut '{shortcut_payload.get('name')}' on item {item_id}")
        return {"success": True, "data": data, "shortcut": data}
    if resp.status_code == 202:
        location = resp.headers.get("Location")
        if location:
            success = _poll_lro(location, headers)
            return {"success": success, "data": {"location": location}}
        return {"success": True, "data": {}}

    print(f"[FABRIC] create_onelake_shortcut failed: {resp.status_code} {resp.text[:250]}")
    return {"success": False, "error": resp.text, "status_code": resp.status_code}


def list_onelake_shortcuts(
    item_id: str,
    parent_path: str = "",
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> dict:
    """
    Lists OneLake shortcuts under an item.
    Official Spec: GET /v1/workspaces/{workspaceId}/items/{itemId}/shortcuts
    """
    _assert_workspace(workspace_id)
    headers = get_auth_headers()
    url = f"{_BASE}/workspaces/{workspace_id}/items/{item_id}/shortcuts"
    params = {}
    if parent_path:
        params["parentPath"] = parent_path

    resp = requests.get(url, headers=headers, params=params, timeout=15)
    if resp.status_code == 200:
        return {"success": True, "shortcuts": resp.json().get("value", [])}
    return {"success": False, "error": resp.text, "shortcuts": []}


def get_onelake_shortcut(
    item_id: str,
    shortcut_path: str,
    shortcut_name: str,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> dict:
    """
    Gets shortcut details for a specific path and name.
    Official Spec: GET /v1/workspaces/{workspaceId}/items/{itemId}/shortcuts/{shortcutPath}/{shortcutName}
    """
    _assert_workspace(workspace_id)
    headers = get_auth_headers()
    clean_path = shortcut_path.strip("/")
    url = f"{_BASE}/workspaces/{workspace_id}/items/{item_id}/shortcuts/{clean_path}/{shortcut_name}"
    resp = requests.get(url, headers=headers, timeout=15)
    if resp.status_code == 200:
        return {"success": True, "shortcut": resp.json()}
    return {"success": False, "error": resp.text, "status_code": resp.status_code}


def delete_onelake_shortcut(
    item_id: str,
    shortcut_path: str,
    shortcut_name: str,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> bool:
    """
    Deletes a OneLake shortcut.
    Official Spec: DELETE /v1/workspaces/{workspaceId}/items/{itemId}/shortcuts/{shortcutPath}/{shortcutName}
    """
    _assert_workspace(workspace_id)
    headers = get_auth_headers()
    clean_path = shortcut_path.strip("/")
    url = f"{_BASE}/workspaces/{workspace_id}/items/{item_id}/shortcuts/{clean_path}/{shortcut_name}"
    resp = requests.delete(url, headers=headers, timeout=15)
    success = resp.status_code in (200, 204)
    if success:
        print(f"[FABRIC] Deleted shortcut {shortcut_name} from {clean_path} on item {item_id}")
    else:
        print(f"[FABRIC] delete_onelake_shortcut failed: {resp.status_code} {resp.text[:200]}")
    return success


# ── Item Execution & Refresh APIs ─────────────────────────────────────────────

def run_notebook(
    notebook_id: str,
    parameters: dict | None = None,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> dict:
    """
    Triggers execution of a PySpark Notebook via Jobs API (jobType=RunNotebook).
    Official Spec: POST /v1/workspaces/{workspaceId}/items/{itemId}/jobs/instances?jobType=RunNotebook
    """
    _assert_workspace(workspace_id)
    headers = get_auth_headers()
    payload = {}
    if parameters:
        payload["executionData"] = {"parameters": parameters}

    resp = requests.post(
        f"{_BASE}/workspaces/{workspace_id}/items/{notebook_id}/jobs/instances?jobType=RunNotebook",
        headers=headers,
        json=payload if parameters else None,
        timeout=20,
    )
    if resp.status_code in (200, 201, 202):
        location = resp.headers.get("Location", "")
        job_id = location.split("/")[-1] if "/" in location else None
        print(f"[FABRIC] Notebook {notebook_id} execution triggered. Job ID: {job_id}")
        return {"success": True, "job_id": job_id, "location": location}
    print(f"[FABRIC] Notebook run trigger failed: {resp.status_code} {resp.text[:250]}")
    return {"success": False, "error": resp.text, "status_code": resp.status_code}


def refresh_semantic_model(
    semantic_model_id: str,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> dict:
    """
    Triggers refresh on a Power BI Semantic Model via Jobs API (jobType=Execute).
    """
    _assert_workspace(workspace_id)
    headers = get_auth_headers()
    resp = requests.post(
        f"{_BASE}/workspaces/{workspace_id}/items/{semantic_model_id}/jobs/instances?jobType=Execute",
        headers=headers,
        timeout=20,
    )
    if resp.status_code in (200, 201, 202):
        location = resp.headers.get("Location", "")
        job_id = location.split("/")[-1] if "/" in location else None
        print(f"[FABRIC] Semantic Model {semantic_model_id} refresh triggered. Job ID: {job_id}")
        return {"success": True, "job_id": job_id, "location": location}
    print(f"[FABRIC] Semantic Model refresh trigger failed: {resp.status_code} {resp.text[:250]}")
    return {"success": False, "error": resp.text, "status_code": resp.status_code}


__all__ = [
    "_BASE",
    "_LRO_MAX_POLLS",
    "_LRO_POLL_INTERVAL",
    "ALLOWED_WORKSPACE_ID",
    "ALLOWED_WORKSPACE_NAME",
    "WorkspaceSecurityError",
    "_assert_workspace",
    "_poll_lro",
    "requests",
    "get_auth_headers",
    "list_workspaces",
    "list_workspace_items",
    "list_folders",
    "get_workspace_tree",
    "_get_or_create_single_folder",
    "get_or_create_folder",
    "delete_folder",
    "create_item",
    "move_item",
    "update_definition",
    "get_item_definition",
    "delete_item",
    "provision_item_with_definition",
    "create_onelake_shortcut",
    "list_onelake_shortcuts",
    "get_onelake_shortcut",
    "delete_onelake_shortcut",
    "trigger_pipeline_run",
    "create_pipeline_schedule",
    "get_job_status",
    "get_git_status",
    "commit_to_git",
    "run_notebook",
    "refresh_semantic_model",
]
