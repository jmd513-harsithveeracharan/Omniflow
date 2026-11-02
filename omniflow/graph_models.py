"""
omniflow/graph_models.py
------------------------
Strict Pydantic v2 domain models for Graph RAG & Column-Level Lineage.
"""

from __future__ import annotations

from typing import Any, Literal
from pydantic import BaseModel, Field


class GraphNode(BaseModel):
    id: str
    label: str
    type: Literal["source", "lakehouse", "warehouse", "table", "column", "notebook", "pipeline", "metric"]
    layer: Literal["source", "bronze", "silver", "gold", "warehouse", "bi", "shared"]
    parent_id: str | None = None
    data_type: str | None = None
    is_primary_key: bool = False
    is_foreign_key: bool = False
    radius: float = 8.0
    degree: int = 0
    description: str | None = None
    cluster_group: str | None = None


class GraphEdge(BaseModel):
    id: str
    source: str
    target: str
    relationship: Literal["FEEDS", "CONTAINS", "TRANSFORMS_TO", "JOINS_WITH", "AGGREGATES", "DEPENDS_ON"]
    description: str | None = None
    is_cross_layer: bool = False


class GraphMeshResponse(BaseModel):
    nodes: list[GraphNode]
    edges: list[GraphEdge]
    stats: dict[str, int]
    layers: list[str]


class BlastZoneResponse(BaseModel):
    target_node_id: str
    impact_level: Literal["LOW", "MEDIUM", "HIGH", "CRITICAL"]
    upstream_nodes: list[str]
    downstream_nodes: list[str]
    affected_tables: list[str]
    affected_notebooks: list[str]
    explanation: str
