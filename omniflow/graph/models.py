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
    type: Literal["source", "schema", "lakehouse", "warehouse", "table", "column", "notebook", "pipeline", "metric"]
    layer: str
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


def infer_layer_name(raw_name: str, folder_name: str = "", item_type: str = "") -> str:
    """Dynamically infers architecture tier from folder, item name, or item type."""
    combined = f"{folder_name} {raw_name}".lower()
    tier_keywords: tuple[tuple[tuple[str, ...], str], ...] = (
        (("source", "landing", "ingest", "raw"), "raw"),
        (("stg", "stage", "staging"), "staging"),
        (("bronze",), "bronze"),
        (("transform", "curat", "clean", "silver"), "silver"),
        (("gold", "mart", "star", "kimball"), "gold"),
        (("report",), "reporting"),
    )
    for tokens, layer_name in tier_keywords:
        if any(tok in combined for tok in tokens):
            return layer_name

    # Recognize numbered architecture layer folders (e.g. "01_prep", "03_publish")
    fl = folder_name.strip().lower()
    if fl and len(fl) > 2 and fl[0:2].isdigit() and (fl[2] in ("_", "-", " ")):
        cleaned = "".join(c if c.isalnum() else "_" for c in fl[2:]).strip("_")
        if cleaned and not any(w in cleaned for w in ("test", "sort", "demo", "ai", "agent", "udf", "func", "notebook")):
            return cleaned

    itype = item_type.lower()
    if itype in ("semanticmodel", "report", "paginatedreport", "dashboard"):
        return "bi"
    if itype in ("datapipeline", "notebook", "sparkjobdefinition"):
        return "orchestration"
    if "warehouse" in itype:
        return "warehouse"
    if "lakehouse" in itype:
        return "lakehouse"
    return "workspace"
