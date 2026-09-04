"""
app/domain/models/session.py
----------------------------
Pydantic v2 schemas for Sessions, Messages, Learned Facts, Deployment Runs,
and 5-Star Semantic Architecture Recipes.
"""

from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field


def _now_utc() -> str:
    return datetime.now(UTC).isoformat()


class SessionRecord(BaseModel):
    session_id: str = Field(..., description="Unique browser or user session UUID")
    workspace_id: str = Field(..., description="Active Microsoft Fabric Workspace ID")
    created_at: str = Field(default_factory=_now_utc)
    last_active: str = Field(default_factory=_now_utc)
    metadata: dict[str, Any] = Field(default_factory=dict)


class MessageRecord(BaseModel):
    id: int | None = None
    session_id: str
    turn_index: int
    role: str = Field(..., description="user | assistant | system | tool")
    content: str
    token_est: int = 0
    created_at: str = Field(default_factory=_now_utc)


class LearnedFact(BaseModel):
    id: int | None = None
    session_id: str
    fact_key: str
    fact_value: str
    confidence: float = 1.0
    created_at: str = Field(default_factory=_now_utc)


class RunRecord(BaseModel):
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
    created_at: str = Field(default_factory=_now_utc)
    updated_at: str = Field(default_factory=_now_utc)


class ArchitectureRecipe(BaseModel):
    id: str = Field(..., description="Unique recipe slug or UUID")
    title: str = Field(..., description="Recipe title (e.g. Telecom Bronze-to-Silver CDC)")
    description: str
    source_dialect: str = "tsql"
    target_fabric_type: str = "lakehouse_delta_merge"
    code_template: str
    tags: list[str] = Field(default_factory=list)
    rating: int = Field(5, ge=1, le=5)
    embedding: list[float] = Field(default_factory=list, description="Vector embedding for pgvector cosine search")
