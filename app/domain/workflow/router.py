"""
app/domain/workflow/router.py
-----------------------------
FastAPI router for LangGraph cyclic workflow execution, human-in-the-loop approvals,
and NetworkX DAG lineage queries for the modern React frontend.
"""

from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import ALLOWED_WORKSPACE_ID
from app.domain.lineage.graph_store import LineageGraphEngine
from app.domain.workflow.graph import create_compiled_workflow
from app.domain.workflow.state import AgentWorkflowState

router = APIRouter(prefix="/api/workflow", tags=["LangGraph Workflow"])

# Global shared lineage engine instance
lineage_engine = LineageGraphEngine()
compiled_app = create_compiled_workflow()


class WorkflowExecuteRequest(BaseModel):
    message: str = Field(..., description="User prompt or data engineering instruction")
    session_id: str | None = Field(None, description="Thread / session ID for durable checkpointing")
    workspace_id: str | None = Field(None, description="Fabric Workspace ID")
    target_assets: list[str] = Field(default_factory=list, description="Target assets for JIT context hydration")
    human_approval: Literal["pending", "approved", "rejected"] = Field("pending", description="Approval gate state")
    max_retries: int = Field(3, description="Maximum automated self-healing retries")


class WorkflowApproveRequest(BaseModel):
    session_id: str = Field(..., description="Active session thread ID")
    approval: Literal["approved", "rejected"] = Field(..., description="Human decision")
    workspace_id: str | None = None


@router.post("/execute", summary="Execute LangGraph Workflow")
async def execute_workflow(req: WorkflowExecuteRequest):
    """Executes the cyclic self-healing LangGraph workflow with durable state checkpointing."""
    sid = req.session_id or "default-thread"
    wid = req.workspace_id or ALLOWED_WORKSPACE_ID

    initial_state: AgentWorkflowState = {
        "session_id": sid,
        "workspace_id": wid,
        "user_message": req.message,
        "target_assets": req.target_assets,
        "human_approval": req.human_approval,
        "max_retries": req.max_retries,
    }

    config = {"configurable": {"thread_id": sid}}

    try:
        final_state = compiled_app.invoke(initial_state, config=config)
        return {
            "status": "success",
            "session_id": sid,
            "intent": final_state.get("intent"),
            "is_destructive": final_state.get("is_destructive", False),
            "requires_human_approval": final_state.get("requires_human_approval", False),
            "human_approval": final_state.get("human_approval", "pending"),
            "retry_count": final_state.get("retry_count", 0),
            "final_response": final_state.get("final_response"),
            "generated_code": final_state.get("generated_code", {}),
            "execution_results": final_state.get("execution_results", []),
            "blast_zone": final_state.get("blast_zone", []),
            "audit_trail": final_state.get("audit_trail", []),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Workflow execution error: {str(e)}") from e


@router.post("/approve", summary="Human-in-the-Loop Safety Gate Approval")
async def approve_workflow_gate(req: WorkflowApproveRequest):
    """Resumes a paused destructive workflow with human approval or rejection."""
    config = {"configurable": {"thread_id": req.session_id}}

    current_state = compiled_app.get_state(config)
    if not current_state or not current_state.values:
        raise HTTPException(status_code=404, detail="No active checkpoint found for session.")

    state_values: AgentWorkflowState = dict(current_state.values)
    state_values["human_approval"] = req.approval
    state_values["requires_human_approval"] = False if req.approval == "approved" else True

    try:
        updated_state = compiled_app.invoke(state_values, config=config)
        return {
            "status": "success",
            "session_id": req.session_id,
            "human_approval": req.approval,
            "final_response": updated_state.get("final_response"),
            "execution_results": updated_state.get("execution_results", []),
            "audit_trail": updated_state.get("audit_trail", []),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Approval resolution error: {str(e)}") from e


@router.get("/lineage", summary="Export Lineage DAG for React Canvas")
async def get_lineage_dag():
    """Returns ReactFlow-compatible nodes and edges for the Medallion visualization canvas."""
    return lineage_engine.export_to_reactflow()
