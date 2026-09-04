"""
app/fabric_client.py
--------------------
Single source of truth for ALL Microsoft Fabric REST API calls.

No other module should call requests.get/post directly to the Fabric API.
All raw HTTP interactions go through this module.

Workspace security is enforced here — every write/delete operation asserts
that the target workspace matches the allowed workspace in config.
"""

import time

import requests

from app.auth import get_auth_headers
from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME

_BASE = "https://api.fabric.microsoft.com/v1"
_LRO_MAX_POLLS = 20
_LRO_POLL_INTERVAL = 2.0  # seconds


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
    nested hierarchical tree structure.

    Returns:
        {
          "workspace_id": str,
          "folders": [{"id", "name", "items": [...]}],
          "root_items": [{"id", "name", "type", "description"}],  # items not in any folder
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
            folder_map[folder.get("id", "")] = {
                "id": folder.get("id"),
                "name": folder.get("displayName", "Unnamed Folder"),
                "items": [],
            }

        root_items = []
        for item in items:
            item_entry = {
                "id":          item.get("id"),
                "name":        item.get("displayName", "Unnamed"),
                "type":        item.get("type", "Unknown"),
                "description": item.get("description", ""),
            }
            parent_id = item.get("parentFolderId") or item.get("folderId")
            if parent_id and parent_id in folder_map:
                folder_map[parent_id]["items"].append(item_entry)
            else:
                root_items.append(item_entry)

        return {
            "workspace_id": workspace_id,
            "folders": list(folder_map.values()),
            "root_items": root_items,
            "error": None,
        }
    except Exception as e:
        print(f"[FABRIC] get_workspace_tree error: {e}")
        return {
            "workspace_id": workspace_id,
            "folders": [],
            "root_items": [],
            "error": str(e),
        }



def get_or_create_folder(folder_name: str, workspace_id: str = ALLOWED_WORKSPACE_ID) -> str | None:
    """
    Returns the folder ID for the given name, creating it if it doesn't exist.
    Idempotent — safe to call multiple times.
    """
    _assert_workspace(workspace_id)
    headers = get_auth_headers()

    # Check if folder already exists
    for folder in list_folders(workspace_id):
        if folder.get("displayName") == folder_name:
            return folder.get("id")

    # Create new folder
    resp = requests.post(
        f"{_BASE}/workspaces/{workspace_id}/folders",
        headers=headers,
        json={"displayName": folder_name},
        timeout=15,
    )
    if resp.status_code in (200, 201):
        return resp.json().get("id")
    print(f"[FABRIC] Failed to create folder '{folder_name}': {resp.status_code} {resp.text[:200]}")
    return None


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

