"""
app/domain/workflow/state.py
----------------------------
State schema definitions for the LangGraph Fabric AI Agent workflow.
Enforces strict typing, audit logging, and human-in-the-loop checkpoint metadata.
"""

from typing import Any, Literal

from pydantic import BaseModel
from typing_extensions import TypedDict


class PlanItem(BaseModel):
    """Represents a planned Fabric artifact."""
    name: str
    item_type: Literal["lakehouse", "notebook", "pipeline", "folder", "table"]
    layer: Literal["Bronze", "Silver", "Gold", "Notebook", "None"] = "None"
    description: str = ""
    code_or_query: str | None = None
    target_lakehouse: str | None = None


class ExecutionResult(BaseModel):
    """Result of an artifact deployment or cell execution."""
    item_name: str
    status: Literal["success", "failed", "skipped", "pending_approval"]
    details: str = ""
    error_trace: str | None = None
    retry_count: int = 0


class WorkflowAuditEntry(BaseModel):
    """Audit log entry capturing state transitions."""
    timestamp: str
    node_name: str
    action: str
    details: str = ""


class AgentWorkflowState(TypedDict, total=False):
    """
    Durable state schema for the LangGraph Orchestrator.
    Tracks lineage graph hydration, intent planning, blast-zone analysis,
    destructive gates, code generation, execution, and cyclic self-healing.
    """
    # Session & Environment
    session_id: str
    workspace_id: str
    user_message: str

    # JIT Context Hydration & Blast Zone
    target_assets: list[str]
    active_subgraph: list[dict[str, Any]]
    blast_zone: list[str]

    # Intent & Planning
    intent: str | None
    plan: dict[str, Any] | None
    plan_items: list[dict[str, Any]]

    # Human-in-the-loop Safety Gate
    is_destructive: bool
    requires_human_approval: bool
    human_approval: Literal["pending", "approved", "rejected"]

    # Code Generation & Execution
    generated_code: dict[str, str]
    execution_results: list[dict[str, Any]]

    # Cyclic Self-Healing Loop
    error_trace: str | None
    failing_item: str | None
    retry_count: int
    max_retries: int
    diagnosis: dict[str, Any] | None

    # Final Output & Audit
    final_response: str | None
    audit_trail: list[dict[str, Any]]
