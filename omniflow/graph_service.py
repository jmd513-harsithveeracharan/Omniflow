"""
omniflow/graph_service.py
-------------------------
Graph RAG & Network Lineage Service.
Facade managing NetworkX directed graph operations, blast-zone impact calculations,
and dynamic schema-to-graph transformations.
"""

from __future__ import annotations

from typing import Any
import networkx as nx

from omniflow.graph_models import (
    BlastZoneResponse,
    GraphEdge,
    GraphMeshResponse,
    GraphNode,
)
from omniflow.graph_generator import (
    build_mesh_from_plan,
    build_rich_medallion_galaxy,
)
from omniflow.graph_project_builder import build_mesh_from_project


class GraphEngine:
    """High-performance NetworkX lineage and graph analysis engine."""

    def __init__(self, default_graph: nx.DiGraph | None = None) -> None:
        self._default_g = default_graph or build_mesh_from_project("PRJ-PELI-BIOTHERMAL")

    def get_mesh(
        self,
        plan: dict[str, Any] | None = None,
        project_id: str | None = None,
    ) -> GraphMeshResponse:
        """Serializes the NetworkX DiGraph into a client-ready GraphMeshResponse."""
        target_pid = project_id.strip() if (project_id and project_id not in ("all", "galaxy", "default")) else "PRJ-PELI-BIOTHERMAL"
        if plan:
            g = build_mesh_from_plan(plan)
        else:
            g = build_mesh_from_project(target_pid)
        nodes: list[GraphNode] = []
        edges: list[GraphEdge] = []

        for node_id, data in g.nodes(data=True):
            deg = int(g.degree(node_id))
            base_r = float(data.get("radius", 8.0))
            adjusted_r = min(30.0, base_r + (deg * 0.45))
            nodes.append(
                GraphNode(
                    id=node_id,
                    label=data.get("label", node_id),
                    type=data.get("type", "table"),
                    layer=data.get("layer", "shared"),
                    parent_id=data.get("parent_id"),
                    data_type=data.get("data_type"),
                    is_primary_key=bool(data.get("is_primary_key", False)),
                    is_foreign_key=bool(data.get("is_foreign_key", False)),
                    radius=round(adjusted_r, 1),
                    degree=deg,
                    description=data.get("description"),
                    cluster_group=data.get("cluster_group"),
                )
            )

        for u, v, data in g.edges(data=True):
            edges.append(
                GraphEdge(
                    id=data.get("id", f"e_{u}_{v}"),
                    source=u,
                    target=v,
                    relationship=data.get("relationship", "DEPENDS_ON"),
                    description=data.get("description"),
                    is_cross_layer=bool(data.get("is_cross_layer", False)),
                )
            )

        stats = {
            "total_nodes": len(nodes),
            "total_edges": len(edges),
            "tables_count": sum(1 for n in nodes if n.type == "table"),
            "columns_count": sum(1 for n in nodes if n.type == "column"),
            "notebooks_count": sum(1 for n in nodes if n.type == "notebook"),
            "metrics_count": sum(1 for n in nodes if n.type == "metric"),
        }
        layers = sorted(list({n.layer for n in nodes}))

        return GraphMeshResponse(nodes=nodes, edges=edges, stats=stats, layers=layers)

    def analyze_blast_zone(self, node_id: str, plan: dict[str, Any] | None = None) -> BlastZoneResponse:
        """Calculates upstream ancestors and downstream blast-zone impact for a node."""
        g = build_mesh_from_plan(plan) if plan else self._default_g
        if node_id not in g:
            return BlastZoneResponse(
                target_node_id=node_id,
                impact_level="LOW",
                upstream_nodes=[],
                downstream_nodes=[],
                affected_tables=[],
                affected_notebooks=[],
                explanation=f"Node '{node_id}' not found in active graph topology.",
            )

        upstream = list(nx.ancestors(g, node_id))
        downstream = list(nx.descendants(g, node_id))

        affected_tables = [n for n in downstream if g.nodes[n].get("type") == "table"]
        affected_notebooks = [n for n in downstream if g.nodes[n].get("type") == "notebook"]
        affected_metrics = [n for n in downstream if g.nodes[n].get("type") == "metric"]

        downstream_count = len(downstream)
        if downstream_count == 0:
            level = "LOW"
            msg = f"Zero downstream dependencies will be impacted by modifying '{node_id}'."
        elif downstream_count <= 2:
            level = "MEDIUM"
            msg = f"Low blast radius: {downstream_count} downstream asset(s) impacted."
        elif downstream_count <= 6:
            level = "HIGH"
            msg = f"High blast radius: modifying this node affects {len(affected_tables)} table(s) and {len(affected_metrics)} metric(s)."
        else:
            level = "CRITICAL"
            msg = f"CRITICAL BLAST RADIUS: {downstream_count} assets across the Medallion cascade depend on this node!"

        return BlastZoneResponse(
            target_node_id=node_id,
            impact_level=level,
            upstream_nodes=upstream,
            downstream_nodes=downstream,
            affected_tables=affected_tables,
            affected_notebooks=affected_notebooks,
            explanation=msg,
        )
