"""
app/domain/models/lineage.py
----------------------------
Strict Pydantic v2 domain models for Microsoft Fabric asset lineage,
JIT context hydration capsules, and blast-radius impact analysis reports.
"""

from __future__ import annotations

from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class AssetLayer(StrEnum):
    SOURCE = "source"
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    SEMANTIC = "semantic"
    REPORT = "report"


class AssetType(StrEnum):
    TABLE = "table"
    LAKEHOUSE = "lakehouse"
    NOTEBOOK = "notebook"
    DATA_PIPELINE = "pipeline"
    SEMANTIC_MODEL = "semantic_model"
    POWER_BI_REPORT = "power_bi_report"


class DependencyType(StrEnum):
    INGESTS = "ingests"
    TRANSFORMS = "transforms"
    FEEDS = "feeds"
    RENDERS = "renders"
    REFERENCES = "references"


class LineageNode(BaseModel):
    id: str = Field(..., description="Unique asset GUID or qualified name")
    name: str = Field(..., description="Human-readable asset name")
    asset_type: AssetType = Field(..., description="Type of Fabric asset")
    layer: AssetLayer = Field(..., description="Medallion layer")
    schema_definition: list[dict[str, Any]] = Field(
        default_factory=list,
        description="Column schema: [{'name': 'id', 'type': 'int', 'is_pk': True}]",
    )
    workspace_id: str | None = None
    metadata: dict[str, Any] = Field(default_factory=dict)


class LineageEdge(BaseModel):
    source_id: str = Field(..., description="Upstream asset ID")
    target_id: str = Field(..., description="Downstream asset ID")
    relation_type: DependencyType = Field(default=DependencyType.TRANSFORMS)
    metadata: dict[str, Any] = Field(default_factory=dict)


class JITContextCapsule(BaseModel):
    target_asset_id: str
    target_name: str
    layer: AssetLayer
    upstream_dependencies: list[LineageNode] = Field(default_factory=list)
    downstream_consumers: list[LineageNode] = Field(default_factory=list)
    estimated_tokens: int = Field(default=0, description="Estimated prompt token weight (~85t)")
    condensed_prompt_snippet: str = Field(..., description="Lean schema string injected into LLM prompt")


class BlastRadiusReport(BaseModel):
    target_asset_id: str
    target_name: str
    is_destructive: bool = Field(..., description="True if operation is DROP, OVERWRITE, or breaking schema change")
    affected_nodes: list[LineageNode] = Field(default_factory=list)
    affected_pipelines: list[str] = Field(default_factory=list)
    affected_reports: list[str] = Field(default_factory=list)
    risk_level: str = Field("low", description="low | medium | high | critical")
    warning_message: str = Field(..., description="Human-readable risk summary")
