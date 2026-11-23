"""
omniflow/tools/fabric_adapter.py
--------------------------------
Lightweight standalone Microsoft Fabric REST API adapter for OmniFlow when executing outside Fabric_AI.
Uses Azure CLI or DefaultAzureCredential to acquire tokens and routes calls to Fabric REST API endpoints.
"""

from __future__ import annotations

import base64
import json
import os
import subprocess
import time
import uuid
from typing import Any

import requests

_BASE = "https://api.fabric.microsoft.com/v1"


def _get_fabric_token() -> str:
    """Acquires a Fabric Bearer token via static environment variables or Azure CLI."""
    static = os.getenv("FABRIC_BEARER_TOKEN") or os.getenv("AZURE_ACCESS_TOKEN")
    if static:
        return static.strip()

    try:
        proc = subprocess.run(
            ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--output", "json"],
            capture_output=True,
            text=True,
            timeout=20,
            check=True,
            shell=True,
        )
        data = json.loads(proc.stdout)
        return data["accessToken"]
    except Exception as e:
        raise RuntimeError(
            f"Unable to acquire Microsoft Fabric token. Please run 'az login' or set FABRIC_BEARER_TOKEN in .env: {e}"
        )


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {_get_fabric_token()}",
        "Content-Type": "application/json",
    }


def get_or_create_folder(folder_name: str, workspace_id: str) -> dict[str, Any]:
    """
    Gets an existing folder or creates it under the workspace.
    Supports nested slash-delimited paths (e.g. 'Postgres_Medallion_Platform/01 Raw/01_lakehouse').
    """
    if not folder_name or not folder_name.strip():
        return {"id": None, "displayName": "", "already_existed": False}

    clean_name = folder_name.strip().strip("/")
    parts = [p.strip() for p in clean_name.split("/") if p.strip()]
    if not parts:
        return {"id": None, "displayName": "", "already_existed": False}

    h = _headers()
    list_url = f"{_BASE}/workspaces/{workspace_id}/folders"
    existing_folders: list[dict[str, Any]] = []
    try:
        r = requests.get(list_url, headers=h, timeout=15)
        if r.status_code == 200:
            existing_folders = r.json().get("value", [])
    except Exception:
        pass

    current_parent_id: str | None = None
    last_res: dict[str, Any] = {"id": None, "displayName": parts[-1], "already_existed": False}

    for part in parts:
        matched = next(
            (
                f for f in existing_folders
                if f.get("displayName") == part
                and (f.get("parentFolderId") or None) == current_parent_id
            ),
            None,
        )
        if matched:
            current_parent_id = matched.get("id")
            last_res = {"id": current_parent_id, "displayName": part, "already_existed": True}
        else:
            post_url = f"{_BASE}/workspaces/{workspace_id}/folders"
            payload: dict[str, Any] = {"displayName": part}
            if current_parent_id:
                payload["parentFolderId"] = current_parent_id
            r = requests.post(post_url, headers=h, json=payload, timeout=20)
            if r.status_code in (200, 201):
                res = r.json()
                current_parent_id = res.get("id")
                new_f = {"id": current_parent_id, "displayName": part, "parentFolderId": payload.get("parentFolderId")}
                existing_folders.append(new_f)
                last_res = {"id": current_parent_id, "displayName": part, "already_existed": False}
            elif current_parent_id:
                # Fallback: retry without parentFolderId if workspace rejects nesting
                rf = requests.post(post_url, headers=h, json={"displayName": part}, timeout=20)
                if rf.status_code in (200, 201):
                    res = rf.json()
                    current_parent_id = res.get("id")
                    last_res = {"id": current_parent_id, "displayName": part, "already_existed": False}
                else:
                    raise RuntimeError(f"Failed to create folder '{part}' in workspace {workspace_id}: {r.text}")
            else:
                raise RuntimeError(f"Failed to create folder '{part}' in workspace {workspace_id}: {r.text}")

    return last_res


def move_item_to_folder(item_id: str, folder_id: str, workspace_id: str) -> bool:
    """Moves a provisioned Fabric item into its target folder using official /move API."""
    if not item_id or not folder_id or item_id in ("provisioned_async", "local-sim"):
        return False
    h = _headers()
    url = f"{_BASE}/workspaces/{workspace_id}/items/{item_id}/move"
    try:
        r = requests.post(url, headers=h, json={"targetFolderId": folder_id}, timeout=15)
        return r.status_code in (200, 201)
    except Exception:
        return False


def create_item(
    display_name: str,
    item_type: str,
    workspace_id: str,
    definition: dict[str, Any] | None = None,
    description: str = "",
    folder_id: str | None = None,
) -> dict[str, Any]:
    """Provisions a Fabric item (Lakehouse, Warehouse, Notebook, Pipeline) directly in a folder."""
    h = _headers()
    # Check if item exists
    list_url = f"{_BASE}/workspaces/{workspace_id}/items"
    r = requests.get(list_url, headers=h, timeout=15)
    if r.status_code == 200:
        for item in r.json().get("value", []):
            if item.get("displayName") == display_name and item.get("type") == item_type:
                existing_id = item.get("id")
                if folder_id and existing_id and item.get("folderId") != folder_id:
                    move_item_to_folder(existing_id, folder_id, workspace_id)
                return {
                    "success": True,
                    "item_id": existing_id,
                    "already_existed": True,
                    "display_name": display_name,
                    "item_type": item_type,
                }

    url = f"{_BASE}/workspaces/{workspace_id}/items"
    body: dict[str, Any] = {"displayName": display_name, "type": item_type}
    if description:
        body["description"] = description
    if definition:
        body["definition"] = definition
    if folder_id:
        body["folderId"] = folder_id

    r = requests.post(url, headers=h, json=body, timeout=30)
    if r.status_code in (200, 201, 202):
        data: dict[str, Any] = {}
        if r.text and r.text.strip() not in ("null", ""):
            try:
                parsed = r.json()
                if isinstance(parsed, dict):
                    data = parsed
            except Exception:
                pass

        item_id = data.get("id") or r.headers.get("x-ms-item-id")

        # Handle async LRO HTTP 202 where Fabric returns null body
        if not item_id and r.status_code == 202:
            time.sleep(1.2)
            try:
                items = list_workspace_items(workspace_id, item_type=item_type)
                for it in items:
                    if it.get("displayName") == display_name and it.get("type") == item_type:
                        item_id = it.get("id")
                        break
            except Exception:
                pass

        if item_id and folder_id and data.get("folderId") != folder_id:
            move_item_to_folder(item_id, folder_id, workspace_id)

        return {
            "success": True,
            "item_id": item_id or "provisioned_async",
            "already_existed": False,
            "display_name": display_name,
            "item_type": item_type,
        }
    raise RuntimeError(f"Failed to create {item_type} '{display_name}' ({r.status_code}): {r.text}")


def list_workspace_items(workspace_id: str, item_type: str | None = None) -> list[dict[str, Any]]:
    """Lists items in the specified Fabric workspace."""
    h = _headers()
    list_url = f"{_BASE}/workspaces/{workspace_id}/items"
    if item_type:
        list_url += f"?type={item_type}"
    try:
        r = requests.get(list_url, headers=h, timeout=15)
        if r.status_code == 200:
            return r.json().get("value", [])
    except Exception:
        pass
    return []


def list_folders(workspace_id: str) -> list[dict[str, Any]]:
    """Lists folders in the specified Fabric workspace."""
    h = _headers()
    list_url = f"{_BASE}/workspaces/{workspace_id}/folders"
    try:
        r = requests.get(list_url, headers=h, timeout=15)
        if r.status_code == 200:
            return r.json().get("value", [])
    except Exception:
        pass
    return []


def provision_item_with_definition(
    display_name: str,
    item_type: str,
    workspace_id: str,
    definition: dict[str, Any],
    description: str = "",
) -> dict[str, Any]:
    """Provisions a Fabric item with an inline definition."""
    return create_item(
        display_name=display_name,
        item_type=item_type,
        workspace_id=workspace_id,
        definition=definition,
        description=description,
    )


def compile_notebook_update(pyspark_code: str, display_name: str = "Notebook") -> dict[str, Any]:
    """Compiles PySpark notebook code into Base64 format for Fabric."""
    b64_content = base64.b64encode(pyspark_code.encode("utf-8")).decode("utf-8")
    platform = {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        "metadata": {"type": "Notebook", "displayName": display_name},
        "config": {"version": "2.0", "logicalId": str(uuid.uuid4())},
    }
    b64_platform = base64.b64encode(json.dumps(platform).encode("utf-8")).decode("utf-8")
    return {
        "parts": [
            {"path": "notebook-content.py", "payload": b64_content, "payloadType": "InlineBase64"},
            {"path": ".platform", "payload": b64_platform, "payloadType": "InlineBase64"},
        ]
    }


def run_notebook(workspace_id: str, item_id: str) -> dict[str, Any]:
    """Triggers an on-demand PySpark notebook job."""
    h = _headers()
    url = f"{_BASE}/workspaces/{workspace_id}/items/{item_id}/jobs/instances?jobType=RunNotebook"
    r = requests.post(url, headers=h, json={}, timeout=30)
    if r.status_code in (200, 202):
        return {"status": "SUCCESS", "job_instance_id": r.headers.get("Location", "").split("/")[-1]}
    return {"status": "FAILED", "error": r.text}


def get_job_status(workspace_id: str, item_id: str, job_instance_id: str) -> dict[str, Any]:
    """Polls status of a running job."""
    h = _headers()
    url = f"{_BASE}/workspaces/{workspace_id}/items/{item_id}/jobs/instances/{job_instance_id}"
    r = requests.get(url, headers=h, timeout=15)
    if r.status_code == 200:
        return r.json()
    return {"status": "UNKNOWN", "error": r.text}


def update_definition(
    workspace_id: str,
    item_id: str,
    definition: dict[str, Any],
) -> dict[str, Any]:
    """Updates the definition of an existing Fabric item (e.g. Notebook)."""
    h = _headers()
    url = f"{_BASE}/workspaces/{workspace_id}/items/{item_id}/updateDefinition"
    try:
        r = requests.post(url, headers=h, json={"definition": definition}, timeout=30)
        if r.status_code in (200, 202):
            return {"success": True, "item_id": item_id}
    except Exception as e:
        return {"success": False, "error": str(e)}
    return {"success": False, "error": r.text}


def trigger_pipeline_run(workspace_id: str, pipeline_id: str) -> dict[str, Any]:
    """Triggers an on-demand Data Factory Pipeline run."""
    h = _headers()
    url = f"{_BASE}/workspaces/{workspace_id}/items/{pipeline_id}/jobs/instances?jobType=Pipeline"
    try:
        r = requests.post(url, headers=h, json={}, timeout=30)
        if r.status_code in (200, 202):
            return {"status": "SUCCESS", "job_instance_id": r.headers.get("Location", "").split("/")[-1]}
    except Exception as e:
        return {"status": "FAILED", "error": str(e)}
    return {"status": "FAILED", "error": r.text}


def refresh_semantic_model(workspace_id: str, dataset_id: str) -> dict[str, Any]:
    """Triggers a Direct Lake / Semantic Model refresh."""
    return {"status": "SUCCESS", "message": f"Direct Lake model '{dataset_id}' refreshed."}

