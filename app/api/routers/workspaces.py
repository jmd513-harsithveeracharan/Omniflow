"""
app/api/routers/workspaces.py
-----------------------------
FastAPI router for Microsoft Fabric workspace operations, items caching, and folder tree.
"""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME
from app.fabric_client import (
    get_or_create_folder,
    get_workspace_tree,
    list_workspaces,
)
from app.workspace_cache import get_cached, invalidate, refresh_cache

router = APIRouter(prefix="/api/workspace", tags=["Workspace Operations"])


class FolderCreateRequest(BaseModel):
    name: str = Field(..., description="Folder name to create or ensure exists")
    workspace_id: str | None = Field(None, description="Target Fabric workspace ID")


class CacheRefreshRequest(BaseModel):
    workspace_id: str | None = Field(None, description="Workspace ID to refresh")


@router.get("/list", summary="List Available Fabric Workspaces")
async def get_workspaces():
    """Lists all accessible Microsoft Fabric workspaces."""
    try:
        workspaces = list_workspaces()
        return {
            "status": "success",
            "active_workspace_id": ALLOWED_WORKSPACE_ID,
            "active_workspace_name": ALLOWED_WORKSPACE_NAME,
            "workspaces": workspaces,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch workspaces: {str(e)}") from e


@router.get("/items", summary="List Items in Workspace (Cached)")
async def get_workspace_items(workspace_id: str | None = None) -> dict[str, Any]:
    """Returns cached items and folders from the Fabric workspace snapshot."""
    wid = workspace_id or ALLOWED_WORKSPACE_ID
    cached = get_cached(wid)
    return {
        "status": "success",
        "workspace_id": wid,
        "items": cached.get("items", []),
        "folders": cached.get("folders", []),
        "synced_at": cached.get("synced_at"),
    }


@router.get("/tree", summary="Get Workspace Folder Hierarchy Tree")
async def get_tree(workspace_id: str | None = None):
    """Returns the visual folder and lakehouse hierarchy tree."""
    wid = workspace_id or ALLOWED_WORKSPACE_ID
    try:
        tree = get_workspace_tree(wid)
        return {"status": "success", "workspace_id": wid, "tree": tree}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to get workspace tree: {str(e)}") from e


@router.post("/folder", summary="Create or Ensure Workspace Folder")
async def create_folder(req: FolderCreateRequest):
    """Creates a new folder in the Fabric workspace if it does not already exist."""
    wid = req.workspace_id or ALLOWED_WORKSPACE_ID
    try:
        folder_id = get_or_create_folder(req.name, wid)
        invalidate(wid)
        return {
            "status": "success",
            "folder_name": req.name,
            "folder_id": folder_id,
            "workspace_id": wid,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Folder creation failed: {str(e)}") from e


@router.post("/refresh", summary="Force Refresh Workspace Cache")
async def refresh_workspace_cache(req: CacheRefreshRequest | None = None):
    """Forces an API sync to update local workspace cache and snapshot."""
    wid = req.workspace_id if req and req.workspace_id else ALLOWED_WORKSPACE_ID
    try:
        fresh_data = refresh_cache(wid)
        return {
            "status": "success",
            "workspace_id": wid,
            "synced_at": fresh_data.get("synced_at"),
            "item_count": len(fresh_data.get("items", [])),
            "folder_count": len(fresh_data.get("folders", [])),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cache refresh failed: {str(e)}") from e
