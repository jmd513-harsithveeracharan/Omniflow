"""
app/fabric/workspaces.py
------------------------
Workspace and Folder management operations for Microsoft Fabric.
"""

from app.config import ALLOWED_WORKSPACE_ID
from app.fabric.core import (
    _BASE,
    _assert_workspace,
    get_auth_headers,
    get_client_attr,
    get_requests,
)


def list_workspaces() -> list[dict]:
    """
    Returns all Fabric workspaces the authenticated user has access to.
    Used for dynamic workspace selection in the UI.
    """
    try:
        req = get_requests()
        headers = get_auth_headers()
        resp = req.get(f"{_BASE}/workspaces", headers=headers, timeout=10)
        if resp.status_code == 200:
            return resp.json().get("value", [])
        print(f"[FABRIC] list_workspaces failed: {resp.status_code} {resp.text[:200]}")
    except Exception as e:
        print(f"[FABRIC] list_workspaces error: {e}")
    return []


def list_workspace_items(workspace_id: str = ALLOWED_WORKSPACE_ID) -> dict:
    """Lists all items in a workspace. Returns {success, items}."""
    fn = get_client_attr("list_workspace_items")
    if fn and fn is not list_workspace_items:
        return fn(workspace_id)

    req = get_requests()
    headers = get_auth_headers()
    resp = req.get(
        f"{_BASE}/workspaces/{workspace_id}/items",
        headers=headers,
        timeout=15,
    )
    if resp.status_code == 200:
        return {"success": True, "items": resp.json().get("value", [])}
    return {"success": False, "error": resp.text, "items": []}


def list_folders(workspace_id: str = ALLOWED_WORKSPACE_ID) -> list[dict]:
    """Lists all folders inside a workspace."""
    fn = get_client_attr("list_folders")
    if fn and fn is not list_folders:
        return fn(workspace_id)

    req = get_requests()
    headers = get_auth_headers()
    resp = req.get(f"{_BASE}/workspaces/{workspace_id}/folders", headers=headers, timeout=15)
    if resp.status_code == 200:
        return resp.json().get("value", [])
    return []


def get_workspace_tree(workspace_id: str = ALLOWED_WORKSPACE_ID) -> dict:
    """
    Fetches workspace folders and items from the Fabric REST API and returns a
    nested hierarchical tree structure including subfolders under parent folders.
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
                "id": item.get("id"),
                "name": item.get("displayName", "Unnamed"),
                "type": item.get("type", "Unknown"),
                "description": item.get("description", ""),
                "folderId": item.get("parentFolderId") or item.get("folderId"),
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
    req = get_requests()
    folders = list_folders(workspace_id)
    for folder in folders:
        if folder.get("displayName") == folder_name:
            if parent_folder_id is None or folder.get("parentFolderId") == parent_folder_id:
                return folder.get("id")

    payload: dict = {"displayName": folder_name}
    if parent_folder_id:
        payload["parentFolderId"] = parent_folder_id

    resp = req.post(
        f"{_BASE}/workspaces/{workspace_id}/folders",
        headers=headers,
        json=payload,
        timeout=15,
    )
    if resp.status_code in (200, 201):
        return resp.json().get("id")

    if parent_folder_id:
        fallback_resp = req.post(
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
    if "/" in clean_name:
        parts = [p.strip() for p in clean_name.split("/") if p.strip()]
        current_parent = parent_folder_id
        for part in parts:
            current_parent = _get_or_create_single_folder(part, workspace_id, current_parent, headers)
            if not current_parent:
                break
        return current_parent

    if clean_name != "AI_Test_Folder" and parent_folder_id is None:
        root_id = _get_or_create_single_folder("AI_Test_Folder", workspace_id, None, headers)
        return _get_or_create_single_folder(clean_name, workspace_id, root_id, headers)

    return _get_or_create_single_folder(clean_name, workspace_id, parent_folder_id, headers)


def delete_folder(folder_id: str, workspace_id: str = ALLOWED_WORKSPACE_ID) -> bool:
    """Deletes a folder from the workspace."""
    _assert_workspace(workspace_id)
    req = get_requests()
    headers = get_auth_headers()
    resp = req.delete(
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

