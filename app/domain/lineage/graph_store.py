"""
app/domain/lineage/graph_store.py
---------------------------------
NetworkX-powered Dependency Graph Engine for Microsoft Fabric.
Provides:
  - 1-hop and 2-hop JIT Context Hydration (~85 tokens for LLM prompts)
  - Downstream Blast-Zone Impact Analysis (descendant graph traversal)
  - ReactFlow / SVG DAG export for frontend visualization
"""

from __future__ import annotations

from typing import Any

import networkx as nx

from app.domain.models.lineage import (
    AssetType,
    BlastRadiusReport,
    DependencyType,
    JITContextCapsule,
    LineageEdge,
    LineageNode,
)


class LineageGraphEngine:
    """Directed Acyclic Graph (DAG) manager for Fabric data platform assets."""

    def __init__(self) -> None:
        self._graph: nx.DiGraph = nx.DiGraph()

    def add_asset(self, node: LineageNode) -> None:
        """Adds or updates an asset node in the lineage DAG."""
        self._graph.add_node(node.id, data=node)

    def add_dependency(self, edge: LineageEdge) -> None:
        """Adds a directed dependency edge (source -> target)."""
        if edge.source_id not in self._graph or edge.target_id not in self._graph:
            # Add placeholders if nodes do not exist yet
            if edge.source_id not in self._graph:
                self._graph.add_node(edge.source_id, data=None)
            if edge.target_id not in self._graph:
                self._graph.add_node(edge.target_id, data=None)
        self._graph.add_edge(edge.source_id, edge.target_id, relation=edge.relation_type, metadata=edge.metadata)

    def get_asset(self, asset_id: str) -> LineageNode | None:
        """Fetches an asset node by ID."""
        if asset_id in self._graph:
            return self._graph.nodes[asset_id].get("data")
        return None

    def get_jit_context(self, asset_id: str, hops: int = 1) -> JITContextCapsule | None:
        """
        Extracts a lean 1-hop or 2-hop active subgraph around the target asset (~85 tokens).
        Used by the LLM router to hydrate prompt context on-demand without full schema dumps.
        """
        if asset_id not in self._graph:
            return None

        target_node = self._graph.nodes[asset_id].get("data")
        if not target_node:
            return None

        # Gather upstream (predecessors) and downstream (successors)
        upstream_nodes: list[LineageNode] = []
        for pred_id in self._graph.predecessors(asset_id):
            pred_data = self._graph.nodes[pred_id].get("data")
            if pred_data:
                upstream_nodes.append(pred_data)

        downstream_nodes: list[LineageNode] = []
        for succ_id in self._graph.successors(asset_id):
            succ_data = self._graph.nodes[succ_id].get("data")
            if succ_data:
                downstream_nodes.append(succ_data)

        # Build dense prompt string
        cols_summary = ", ".join([f"{c.get('name')}:{c.get('type')}" for c in target_node.schema_definition[:8]])
        snippet_lines = [
            f"[CONTEXT CAPSULE for {target_node.name} ({target_node.layer.value.upper()})]",
            f"Columns: {cols_summary or 'Dynamic / Unspecified'}",
        ]
        if upstream_nodes:
            snippet_lines.append(f"Ingests From: {', '.join([u.name for u in upstream_nodes])}")
        if downstream_nodes:
            snippet_lines.append(f"Feeds Into: {', '.join([d.name for d in downstream_nodes])}")

        snippet_text = "\n".join(snippet_lines)
        est_tokens = len(snippet_text.split()) * 2

        return JITContextCapsule(
            target_asset_id=asset_id,
            target_name=target_node.name,
            layer=target_node.layer,
            upstream_dependencies=upstream_nodes,
            downstream_consumers=downstream_nodes,
            estimated_tokens=est_tokens,
            condensed_prompt_snippet=snippet_text,
        )

    def calculate_blast_radius(self, asset_id: str, is_destructive: bool = True) -> BlastRadiusReport:
        """
        Traverses downstream descendants in the DAG to identify every impacted asset.
        Classifies risk level based on impacted downstream consumer types.
        """
        if asset_id not in self._graph:
            return BlastRadiusReport(
                target_asset_id=asset_id,
                target_name="Unknown",
                is_destructive=is_destructive,
                risk_level="low",
                warning_message="Asset not found in dependency graph.",
            )

        target_node = self._graph.nodes[asset_id].get("data")
        target_name = target_node.name if target_node else asset_id

        # Traverse all downstream descendants using NetworkX
        descendants = nx.descendants(self._graph, asset_id)
        affected_nodes: list[LineageNode] = []
        affected_pipelines: list[str] = []
        affected_reports: list[str] = []

        for desc_id in descendants:
            desc_node = self._graph.nodes[desc_id].get("data")
            if desc_node:
                affected_nodes.append(desc_node)
                if desc_node.asset_type == AssetType.DATA_PIPELINE:
                    affected_pipelines.append(desc_node.name)
                elif desc_node.asset_type in (AssetType.POWER_BI_REPORT, AssetType.SEMANTIC_MODEL):
                    affected_reports.append(desc_node.name)

        # Compute risk level
        if not is_destructive:
            risk_level = "low"
        elif affected_reports:
            risk_level = "critical"
        elif affected_pipelines or len(affected_nodes) > 2:
            risk_level = "high"
        elif affected_nodes:
            risk_level = "medium"
        else:
            risk_level = "low"

        msg = (
            f"Modifying '{target_name}' affects {len(affected_nodes)} downstream assets "
            f"({len(affected_pipelines)} pipelines, {len(affected_reports)} Power BI reports). "
            f"Risk Level: {risk_level.upper()}."
        )

        return BlastRadiusReport(
            target_asset_id=asset_id,
            target_name=target_name,
            is_destructive=is_destructive,
            affected_nodes=affected_nodes,
            affected_pipelines=affected_pipelines,
            affected_reports=affected_reports,
            risk_level=risk_level,
            warning_message=msg,
        )

    def export_to_reactflow(self) -> dict[str, Any]:
        """Exports DAG into ReactFlow / @xyflow/react format for the UI canvas."""
        nodes = []
        edges = []

        for node_id, attrs in self._graph.nodes(data=True):
            node_data: LineageNode | None = attrs.get("data")
            label = node_data.name if node_data else node_id
            layer = node_data.layer.value if node_data else "bronze"
            nodes.append(
                {
                    "id": node_id,
                    "data": {
                        "label": label,
                        "layer": layer,
                        "asset_type": node_data.asset_type.value if node_data else "table",
                    },
                    "position": {"x": 0, "y": 0},
                }
            )

        for u, v, attrs in self._graph.edges(data=True):
            relation = attrs.get("relation", DependencyType.TRANSFORMS)
            rel_str = relation.value if isinstance(relation, DependencyType) else str(relation)
            edges.append(
                {
                    "id": f"e_{u}_{v}",
                    "source": u,
                    "target": v,
                    "label": rel_str,
                    "animated": True,
                }
            )

        return {"nodes": nodes, "edges": edges}
