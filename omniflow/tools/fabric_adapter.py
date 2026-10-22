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
            timeout=15,
            check=True,
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
    """Gets an existing folder or creates it under the workspace."""
    h = _headers()
    list_url = f"{_BASE}/workspaces/{workspace_id}/folders"
    r = requests.get(list_url, headers=h, timeout=15)
    if r.status_code == 200:
        for f in r.json().get("value", []):
            if f.get("displayName") == folder_name:
                return {"id": f.get("id"), "displayName": folder_name, "already_existed": True}

    post_url = f"{_BASE}/workspaces/{workspace_id}/folders"
    payload = {"displayName": folder_name}
    r = requests.post(post_url, headers=h, json=payload, timeout=20)
    if r.status_code in (200, 201):
        res = r.json()
        return {"id": res.get("id"), "displayName": folder_name, "already_existed": False}
    raise RuntimeError(f"Failed to create folder '{folder_name}' in workspace {workspace_id}: {r.text}")


def create_item(
    display_name: str,
    item_type: str,
    workspace_id: str,
    definition: dict[str, Any] | None = None,
    description: str = "",
) -> dict[str, Any]:
    """Provisions a Fabric item (Lakehouse, Warehouse, Notebook, Pipeline)."""
    h = _headers()
    # Check if item exists
    list_url = f"{_BASE}/workspaces/{workspace_id}/items"
    r = requests.get(list_url, headers=h, timeout=15)
    if r.status_code == 200:
        for item in r.json().get("value", []):
            if item.get("displayName") == display_name and item.get("type") == item_type:
                return {
                    "success": True,
                    "item_id": item.get("id"),
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

    r = requests.post(url, headers=h, json=body, timeout=30)
    if r.status_code in (200, 201, 202):
        data = r.json() if r.text else {}
        item_id = data.get("id") or r.headers.get("x-ms-item-id")
        return {
            "success": True,
            "item_id": item_id,
            "already_existed": False,
            "display_name": display_name,
            "item_type": item_type,
        }
    raise RuntimeError(f"Failed to create {item_type} '{display_name}' ({r.status_code}): {r.text}")


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
