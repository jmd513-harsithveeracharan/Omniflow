"""
app/api/routers/governance.py
-----------------------------
FastAPI router for blast-radius impact analysis, item snapshots, and safe deletion protocols.
"""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import ALLOWED_WORKSPACE_ID
from app.impact_analyzer import analyze_impact, safe_delete

router = APIRouter(prefix="/api/governance", tags=["Governance & Safety"])


class ImpactAnalyzeRequest(BaseModel):
    operation_type: str = Field(..., description="Operation: delete_item | delete_folder | overwrite_table | modify_schema")
    target_name: str = Field(..., description="Name of the target Fabric item or folder")
    target_id: str | None = Field(None, description="Fabric item GUID")
    workspace_id: str | None = None


class SafeDeleteRequest(BaseModel):
    item_id: str = Field(..., description="Fabric item GUID to delete")
    item_name: str = Field(..., description="Item display name for audit log")
    confirmation: bool = Field(False, description="Explicit user confirmation flag")
    workspace_id: str | None = None


@router.post("/analyze", summary="Blast-Radius Impact Analysis")
async def analyze_operation_impact(req: ImpactAnalyzeRequest) -> dict[str, Any]:
    """Evaluates risk level and downstream dependencies before any destructive operation."""
    wid = req.workspace_id or ALLOWED_WORKSPACE_ID
    try:
        report = analyze_impact(
            operation=req.operation_type,
            context={"item_name": req.target_name, "item_id": req.target_id, "workspace_id": wid},
        )
        return {"status": "success", "report": report}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Impact analysis failed: {str(e)}") from e



@router.post("/delete", summary="Safe Item Delete with Snapshot Backup")
async def execute_safe_delete(req: SafeDeleteRequest):
    """Executes safe deletion with automated definition snapshot archiving."""
    if not req.confirmation:
        raise HTTPException(
            status_code=400,
            detail=f"Confirmation required before deleting '{req.item_name}'. Pass confirmation=True."
        )

    wid = req.workspace_id or ALLOWED_WORKSPACE_ID
    try:
        res = safe_delete(item_id=req.item_id, item_name=req.item_name, workspace_id=wid)
        return {"status": "success", "result": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Safe deletion failed: {str(e)}") from e
