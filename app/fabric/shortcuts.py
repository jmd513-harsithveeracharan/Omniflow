"""
app/fabric/shortcuts.py
-----------------------
OneLake Shortcut management for Microsoft Fabric items (Lakehouse, etc.).
"""

from app.config import ALLOWED_WORKSPACE_ID
from app.fabric.core import (
    _BASE,
    _assert_workspace,
    _poll_lro,
    get_auth_headers,
    get_requests,
)


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
    req = get_requests()
    headers = get_auth_headers()
    url = f"{_BASE}/workspaces/{workspace_id}/items/{item_id}/shortcuts"
    params = {}
    if conflict_policy:
        params["shortcutConflictPolicy"] = conflict_policy

    resp = req.post(url, headers=headers, json=shortcut_payload, params=params, timeout=20)
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
    req = get_requests()
    headers = get_auth_headers()
    url = f"{_BASE}/workspaces/{workspace_id}/items/{item_id}/shortcuts"
    params = {}
    if parent_path:
        params["parentPath"] = parent_path

    resp = req.get(url, headers=headers, params=params, timeout=15)
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
    req = get_requests()
    headers = get_auth_headers()
    clean_path = shortcut_path.strip("/")
    url = f"{_BASE}/workspaces/{workspace_id}/items/{item_id}/shortcuts/{clean_path}/{shortcut_name}"
    resp = req.get(url, headers=headers, timeout=15)
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
    req = get_requests()
    headers = get_auth_headers()
    clean_path = shortcut_path.strip("/")
    url = f"{_BASE}/workspaces/{workspace_id}/items/{item_id}/shortcuts/{clean_path}/{shortcut_name}"
    resp = req.delete(url, headers=headers, timeout=15)
    success = resp.status_code in (200, 204)
    if success:
        print(f"[FABRIC] Deleted shortcut {shortcut_name} from {clean_path} on item {item_id}")
    else:
        print(f"[FABRIC] delete_onelake_shortcut failed: {resp.status_code} {resp.text[:200]}")
    return success

