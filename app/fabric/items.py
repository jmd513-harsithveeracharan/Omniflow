"""
app/fabric/items.py
-------------------
Item lifecycle and Base64 definition management in Microsoft Fabric.
"""

import time
from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME
from app.fabric.core import (
    _BASE,
    _assert_workspace,
    _poll_lro,
    get_auth_headers,
    get_client_attr,
    get_requests,
)
from app.fabric.workspaces import list_workspace_items


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
    req = get_requests()
    headers = get_auth_headers()

    payload = {
        "displayName": display_name,
        "type": item_type,
        "description": description or f"Provisioned by Fabric AI Studio — {ALLOWED_WORKSPACE_NAME}",
    }

    resp = req.post(
        f"{_BASE}/workspaces/{workspace_id}/items",
        headers=headers,
        json=payload,
        timeout=20,
    )

    if resp.status_code in (200, 201, 202):
        data = resp.json() if resp.text else {}
        item_id = data.get("id")

        if folder_id and item_id:
            move_fn = get_client_attr("move_item", move_item)
            move_fn(item_id, folder_id, workspace_id)

        print(f"[FABRIC] Created {item_type} '{display_name}' (ID: {item_id})")
        return {"success": True, "item_id": item_id, "data": data}

    # Handle 409 Conflict / Item Name Already Exists / Renaming
    if resp.status_code in (400, 409) and (
        "already in use" in resp.text.lower()
        or "alreadyexists" in resp.text.lower()
        or "conflict" in resp.text.lower()
    ):
        print(f"[FABRIC] Item '{display_name}' already exists in workspace. Finding existing item...")
        ws_items = list_workspace_items(workspace_id).get("items", [])
        for item in ws_items:
            if item.get("type", "").lower() == item_type.lower() and item.get("displayName", "").lower() == display_name.lower():
                item_id = item.get("id")
                if item.get("displayName") != display_name:
                    try:
                        patch_resp = req.patch(
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
                    move_fn = get_client_attr("move_item", move_item)
                    move_fn(item_id, folder_id, workspace_id)

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
    req = get_requests()
    headers = get_auth_headers()
    resp = req.post(
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
    """
    _assert_workspace(workspace_id)
    req = get_requests()
    headers = get_auth_headers()
    payload = {"definition": {"parts": parts}}

    resp = req.post(
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
        return True

    print(f"[FABRIC] updateDefinition failed for {item_id}: {resp.status_code} {resp.text[:300]}")
    return False


def get_item_definition(item_id: str, workspace_id: str = ALLOWED_WORKSPACE_ID) -> dict | None:
    """
    Fetches the current Base64 definition of an item.
    Used for Soft-Delete snapshots and self-healing code patching.
    """
    _assert_workspace(workspace_id)
    req = get_requests()
    headers = get_auth_headers()
    resp = req.post(
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
                poll = req.get(location, headers=headers, timeout=15)
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
    req = get_requests()
    headers = get_auth_headers()
    resp = req.delete(
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
    create_fn = get_client_attr("create_item", create_item)
    create_res = create_fn(
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
        update_fn = get_client_attr("update_definition", update_definition)
        update_ok = update_fn(item_id, parts, workspace_id)
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
