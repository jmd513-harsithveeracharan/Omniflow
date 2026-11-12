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

from omniflow.graph.models import (
    BlastZoneResponse,
    GraphEdge,
    GraphMeshResponse,
    GraphNode,
)
from omniflow.graph.generator import (
    build_mesh_from_plan,
    build_rich_medallion_galaxy,
)
from omniflow.graph.project_builder import build_mesh_from_project


class GraphEngine:
    """High-performance NetworkX lineage and graph analysis engine."""

    def __init__(self, default_graph: nx.DiGraph | None = None) -> None:
        self._default_g = default_graph or build_rich_medallion_galaxy()

    def get_mesh(
        self,
        plan: dict[str, Any] | None = None,
        project_id: str | None = None,
    ) -> GraphMeshResponse:
        """Serializes the NetworkX DiGraph into a client-ready GraphMeshResponse."""
        target_pid = project_id.strip() if (project_id and project_id not in ("all", "galaxy", "default")) else "default"
        if plan:
            g = build_mesh_from_plan(plan)
        else:
            g = build_mesh_from_project(target_pid)
        nodes: list[GraphNode] = []
        edges: list[GraphEdge] = []

        for node_id, data in g.nodes(data=True):
            deg = int(g.degree(node_id))
            ntype = str(data.get("type", "table"))
            base_r = float(data.get("radius", 8.0))
            if ntype in ("schema", "source", "lakehouse", "warehouse"):
                adjusted_r = max(11.5, min(20.0, base_r + (deg * 0.2)))
            elif ntype == "column":
                adjusted_r = 3.0
            else:
                adjusted_r = max(6.0, min(11.0, base_r + (deg * 0.12)))
            nodes.append(
                GraphNode(
                    id=node_id,
                    label=data.get("label", node_id),
                    type=ntype,
                    layer=str(data.get("layer", "shared")),
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
            "schemas_count": sum(1 for n in nodes if n.type in ("schema", "lakehouse", "warehouse", "source")),
            "tables_count": sum(1 for n in nodes if n.type == "table"),
            "columns_count": sum(1 for n in nodes if n.type == "column"),
            "notebooks_count": sum(1 for n in nodes if n.type == "notebook"),
            "metrics_count": sum(1 for n in nodes if n.type == "metric"),
        }
        layers = self._order_layers_topologically(g, nodes)

        return GraphMeshResponse(nodes=nodes, edges=edges, stats=stats, layers=layers)

    def _order_layers_topologically(self, g: nx.DiGraph, nodes: list[GraphNode]) -> list[str]:
        """Orders active layers upstream -> downstream from the DAG topology."""
        present = list({n.layer for n in nodes if n.layer})
        if len(present) <= 1:
            return present

        layer_dag = nx.DiGraph()
        for lyr in present:
            layer_dag.add_node(lyr)
        for u, v, data in g.edges(data=True):
            if data.get("relationship") == "CONTAINS":
                continue
            ul = str(g.nodes[u].get("layer", ""))
            vl = str(g.nodes[v].get("layer", ""))
            if ul and vl and ul != vl:
                layer_dag.add_edge(ul, vl)

        condensed = nx.condensation(layer_dag)
        topo_rank: dict[str, int] = {}
        for scc_id in nx.topological_sort(condensed):
            preds = list(condensed.predecessors(scc_id))
            depth = (max(topo_rank.get(p, 0) for p in preds) + 1) if preds else 0
            topo_rank[scc_id] = depth

        canonical_bias = {
            "source": 0, "raw": 1, "landing": 1, "staging": 2, "stg": 2,
            "bronze": 3, "silver": 4, "curated": 4, "warehouse": 5, "lakehouse": 5,
            "gold": 6, "reporting": 7, "bi": 8, "orchestration": 9, "workspace": 10, "shared": 11,
        }
        scc_mapping = condensed.graph.get("mapping", {})
        return sorted(
            present,
            key=lambda lyr: (
                0 if (layer_dag.in_degree(lyr) + layer_dag.out_degree(lyr)) > 0 else 1,
                topo_rank.get(scc_mapping.get(lyr), 0),
                canonical_bias.get(lyr.lower(), 5),
                lyr.lower(),
            ),
        )

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
