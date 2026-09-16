"""
app/domain/models/session.py
----------------------------
Pydantic v2 schemas for Sessions, Messages, Learned Facts, Deployment Runs,
Architecture Recipes, and the Master Completed Project Ledger.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field


def _now_utc() -> str:
    return datetime.now(UTC).isoformat()


class SessionRecord(BaseModel):
    model_config = {"populate_by_name": True, "extra": "ignore"}

    session_id: str = Field(..., description="Unique browser or user session UUID")
    workspace_id: str = Field(..., description="Active Microsoft Fabric Workspace ID")
    created_at: str | datetime = Field(default_factory=_now_utc)
    last_active: str | datetime = Field(default_factory=_now_utc)
    metadata: dict[str, Any] = Field(default_factory=dict)


class MessageRecord(BaseModel):
    model_config = {"populate_by_name": True, "extra": "ignore"}

    id: int | None = None
    session_id: str
    turn_index: int
    role: str = Field(..., description="user | assistant | system | tool")
    content: str
    token_est: int = 0
    created_at: str | datetime = Field(default_factory=_now_utc)


class LearnedFact(BaseModel):
    model_config = {"populate_by_name": True, "extra": "ignore"}

    id: int | None = None
    session_id: str
    fact_key: str
    fact_value: str
    confidence: float = 1.0
    created_at: str | datetime = Field(default_factory=_now_utc)


class RunRecord(BaseModel):
    model_config = {"populate_by_name": True, "extra": "ignore"}

    run_id: str
    session_id: str | None = None
    status: str = "planned"
    source_name: str | None = None
    database_name: str | None = None
    plan_json: dict[str, Any] = Field(default_factory=dict)
    steps_json: list[dict[str, Any]] = Field(default_factory=list)
    pipeline_item_id: str | None = None
    pipeline_status: str | None = None
    failure_reason: str | None = None
    created_at: str | datetime = Field(default_factory=_now_utc)
    updated_at: str | datetime = Field(default_factory=_now_utc)


class ArchitectureRecipe(BaseModel):
    model_config = {"populate_by_name": True, "extra": "ignore"}

    id: str = Field(..., description="Unique recipe slug or UUID")
    title: str = Field(..., description="Recipe title (e.g. Telecom Bronze-to-Silver CDC)")
    description: str
    source_dialect: str = "tsql"
    target_fabric_type: str = "lakehouse_delta_merge"
    code_template: str
    tags: list[str] = Field(default_factory=list)
    rating: int = Field(5, ge=1, le=5)
    embedding: list[float] = Field(default_factory=list, description="Vector embedding for pgvector cosine search")


class ProjectLedgerRecord(BaseModel):
    """
    Atomic Master DB record for 100% completed projects/workstreams.
    Guarantees that intermediate conversation turns and retries do not pollute permanent memory.
    """
    model_config = {"populate_by_name": True, "extra": "ignore"}

    project_id: str = Field(..., description="Unique project slug or UUID")
    project_name: str
    workspace_id: str
    status: str = Field("COMPLETED", description="Enforces atomic commit only upon 100% completion")
    summary: str = Field(..., description="High-level architecture summary (~150 tokens)")
    workstreams: list[dict[str, Any] | str] = Field(default_factory=list, description="Completed sub-workstreams")
    lineage_dag: dict[str, Any] = Field(default_factory=dict, description="Final NetworkX lineage graph")
    table_catalog: list[dict[str, Any] | str] = Field(default_factory=list, description="Final schema dictionary")
    architecture_decisions: list[dict[str, Any] | str] = Field(default_factory=list, alias="adrs", description="Key ADRs")
    embedding: list[float] = Field(default_factory=list, description="pgvector embedding for JIT retrieval")
    committed_at: str | datetime = Field(default_factory=_now_utc)

    @property
    def adrs(self) -> list[dict[str, Any] | str]:
        return self.architecture_decisions
