"""
omniflow/graph_service.py
-------------------------
Graph RAG & Network Lineage Service.
Constructs deep column-level and asset-level NetworkX directed multigraphs,
computing blast-zone impact, degree centrality, and cross-layer lineage.
"""

from __future__ import annotations

import uuid
from typing import Any, Literal
import networkx as nx
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


def _create_node(
    g: nx.DiGraph,
    node_id: str,
    label: str,
    ntype: Literal["source", "lakehouse", "warehouse", "table", "column", "notebook", "pipeline", "metric"],
    layer: Literal["source", "bronze", "silver", "gold", "warehouse", "bi", "shared"],
    parent_id: str | None = None,
    data_type: str | None = None,
    is_pk: bool = False,
    is_fk: bool = False,
    radius: float = 8.0,
    desc: str | None = None,
) -> None:
    g.add_node(
        node_id,
        label=label,
        type=ntype,
        layer=layer,
        parent_id=parent_id,
        data_type=data_type,
        is_primary_key=is_pk,
        is_foreign_key=is_fk,
        radius=radius,
        description=desc,
    )


def _create_edge(
    g: nx.DiGraph,
    source: str,
    target: str,
    rel: Literal["FEEDS", "CONTAINS", "TRANSFORMS_TO", "JOINS_WITH", "AGGREGATES", "DEPENDS_ON"],
    desc: str | None = None,
    cross_layer: bool = False,
) -> None:
    edge_id = f"e_{source}_{target}_{rel}"
    g.add_edge(source, target, id=edge_id, relationship=rel, description=desc, is_cross_layer=cross_layer)


def build_default_mesh_graph() -> nx.DiGraph:
    """Builds a rich, multi-tier Medallion column-level graph with star schema."""
    g = nx.DiGraph()

    # Source Layer
    _create_node(g, "src_erp", "SAP & Salesforce Gateway", "source", "source", radius=22.0, desc="Cloud & on-prem operational ingestion feed")

    # Bronze Layer
    _create_node(g, "lh_bronze", "lh_retail_bronze", "lakehouse", "bronze", radius=20.0, desc="Raw Delta lakehouse")
    _create_node(g, "tbl_brz_orders", "bronze_orders", "table", "bronze", parent_id="lh_bronze", radius=14.0, desc="Raw orders append-only")
    _create_node(g, "tbl_brz_customers", "bronze_customers", "table", "bronze", parent_id="lh_bronze", radius=14.0, desc="Raw customer snapshots")
    
    _create_edge(g, "src_erp", "tbl_brz_orders", "FEEDS", "Hourly CDC stream", True)
    _create_edge(g, "src_erp", "tbl_brz_customers", "FEEDS", "Nightly bulk snapshot", True)
    _create_edge(g, "lh_bronze", "tbl_brz_orders", "CONTAINS")
    _create_edge(g, "lh_bronze", "tbl_brz_customers", "CONTAINS")

    # Bronze Columns
    brz_order_cols = [
        ("col_bo_id", "order_id", "bigint", True, False),
        ("col_bo_cust", "customer_id", "string", False, False),
        ("col_bo_amt", "amount", "decimal(12,2)", False, False),
        ("col_bo_dt", "order_timestamp", "timestamp", False, False),
        ("col_bo_status", "status_code", "string", False, False),
    ]
    for cid, name, dtype, pk, fk in brz_order_cols:
        _create_node(g, cid, name, "column", "bronze", parent_id="tbl_brz_orders", data_type=dtype, is_pk=pk, is_fk=fk, radius=6.0)
        _create_edge(g, "tbl_brz_orders", cid, "CONTAINS")

    brz_cust_cols = [
        ("col_bc_id", "id", "string", True, False),
        ("col_bc_email", "email", "string", False, False),
        ("col_bc_tier", "tier", "string", False, False),
        ("col_bc_updated", "updated_at", "timestamp", False, False),
    ]
    for cid, name, dtype, pk, fk in brz_cust_cols:
        _create_node(g, cid, name, "column", "bronze", parent_id="tbl_brz_customers", data_type=dtype, is_pk=pk, is_fk=fk, radius=6.0)
        _create_edge(g, "tbl_brz_customers", cid, "CONTAINS")

    # Silver Processing Notebooks & Tables
    _create_node(g, "nb_clean_orders", "nb_01_clean_orders", "notebook", "silver", radius=15.0, desc="PySpark deduplication and Delta MERGE")
    _create_node(g, "lh_silver", "lh_retail_silver", "lakehouse", "silver", radius=20.0, desc="Curated Delta lakehouse")
    _create_node(g, "tbl_slv_orders", "silver_orders", "table", "silver", parent_id="lh_silver", radius=15.0, desc="Curated orders with standardized schema")
    _create_node(g, "tbl_slv_customers", "silver_customers", "table", "silver", parent_id="lh_silver", radius=15.0, desc="SCD Type 1 Clean Customer Master")

    _create_edge(g, "tbl_brz_orders", "nb_clean_orders", "DEPENDS_ON", "Delta microbatch read")
    _create_edge(g, "nb_clean_orders", "tbl_slv_orders", "TRANSFORMS_TO", "MERGE upsert on order_id", True)
    _create_edge(g, "tbl_brz_customers", "tbl_slv_customers", "TRANSFORMS_TO", "Deduplicate & clean", True)
    _create_edge(g, "lh_silver", "tbl_slv_orders", "CONTAINS")
    _create_edge(g, "lh_silver", "tbl_slv_customers", "CONTAINS")

    # Silver Columns & Inter-Table Join Relationship
    slv_order_cols = [
        ("col_so_id", "order_id", "bigint", True, False),
        ("col_so_cust", "customer_id", "string", False, True),
        ("col_so_amt", "net_amount", "decimal(12,2)", False, False),
        ("col_so_dt", "order_date", "date", False, False),
        ("col_so_valid", "is_valid", "boolean", False, False),
    ]
    for cid, name, dtype, pk, fk in slv_order_cols:
        _create_node(g, cid, name, "column", "silver", parent_id="tbl_slv_orders", data_type=dtype, is_pk=pk, is_fk=fk, radius=6.5)
        _create_edge(g, "tbl_slv_orders", cid, "CONTAINS")

    slv_cust_cols = [
        ("col_sc_id", "customer_id", "string", True, False),
        ("col_sc_email", "clean_email", "string", False, False),
        ("col_sc_tier", "loyalty_tier", "string", False, False),
        ("col_sc_active", "is_active", "boolean", False, False),
    ]
    for cid, name, dtype, pk, fk in slv_cust_cols:
        _create_node(g, cid, name, "column", "silver", parent_id="tbl_slv_customers", data_type=dtype, is_pk=pk, is_fk=fk, radius=6.5)
        _create_edge(g, "tbl_slv_customers", cid, "CONTAINS")

    # Deep Column Lineage & Foreign Key Join
    _create_edge(g, "col_bo_id", "col_so_id", "TRANSFORMS_TO", "Direct map", True)
    _create_edge(g, "col_bo_cust", "col_so_cust", "TRANSFORMS_TO", "Standardized trim", True)
    _create_edge(g, "col_so_cust", "col_sc_id", "JOINS_WITH", "FK relation: orders -> customer", False)

    # Gold Layer Star Schema & Power BI Semantic Metrics
    _create_node(g, "lh_gold", "lh_retail_gold", "lakehouse", "gold", radius=22.0, desc="Kimball dimensional star schema")
    _create_node(g, "tbl_gold_fact", "fact_sales", "table", "gold", parent_id="lh_gold", radius=16.0, desc="Aggregated daily sales transactions")
    _create_node(g, "tbl_gold_dim_cust", "dim_customer", "table", "gold", parent_id="lh_gold", radius=14.0, desc="Customer dimensional profile")
    _create_node(g, "tbl_gold_dim_date", "dim_date", "table", "gold", parent_id="lh_gold", radius=12.0, desc="Calendar dimension")

    _create_edge(g, "lh_gold", "tbl_gold_fact", "CONTAINS")
    _create_edge(g, "lh_gold", "tbl_gold_dim_cust", "CONTAINS")
    _create_edge(g, "lh_gold", "tbl_gold_dim_date", "CONTAINS")
    _create_edge(g, "tbl_slv_orders", "tbl_gold_fact", "TRANSFORMS_TO", "Rollup & enrich", True)
    _create_edge(g, "tbl_slv_customers", "tbl_gold_dim_cust", "TRANSFORMS_TO", "Dimension enrichment", True)

    gold_fact_cols = [
        ("col_gf_key", "sales_key", "bigint", True, False),
        ("col_gf_custkey", "customer_key", "bigint", False, True),
        ("col_gf_datekey", "date_key", "integer", False, True),
        ("col_gf_revenue", "gross_revenue", "decimal(14,2)", False, False),
        ("col_gf_qty", "units_sold", "integer", False, False),
    ]
    for cid, name, dtype, pk, fk in gold_fact_cols:
        _create_node(g, cid, name, "column", "gold", parent_id="tbl_gold_fact", data_type=dtype, is_pk=pk, is_fk=fk, radius=6.0)
        _create_edge(g, "tbl_gold_fact", cid, "CONTAINS")

    # Column-level lineage into Gold Fact
    _create_edge(g, "col_so_amt", "col_gf_revenue", "TRANSFORMS_TO", "Sum aggregation", True)
    _create_edge(g, "col_so_cust", "col_gf_custkey", "TRANSFORMS_TO", "Surrogate key lookup", True)

    # Power BI Semantic Metrics
    _create_node(g, "met_rev", "Total Revenue ($)", "metric", "bi", radius=11.0, desc="SUM(fact_sales[gross_revenue])")
    _create_node(g, "met_aov", "Average Order Value", "metric", "bi", radius=11.0, desc="DIVIDE([Total Revenue], COUNTROWS(fact_sales))")
    _create_node(g, "pipe_daily", "pl_daily_retail_orchestrator", "pipeline", "shared", radius=17.0, desc="Fabric Data Factory Pipeline")

    _create_edge(g, "col_gf_revenue", "met_rev", "AGGREGATES", "DAX SUM", True)
    _create_edge(g, "met_rev", "met_aov", "AGGREGATES", "Derived DAX", False)
    _create_edge(g, "pipe_daily", "nb_clean_orders", "DEPENDS_ON", "Schedules notebook cell 1")

    return g


class GraphEngine:
    """Manages NetworkX DiGraph creation, serialization, and blast-zone analysis."""

    def __init__(self, g: nx.DiGraph | None = None) -> None:
        self.g = g or build_default_mesh_graph()

    def get_mesh(self) -> GraphMeshResponse:
        nodes: list[GraphNode] = []
        edges: list[GraphEdge] = []

        for node_id, data in self.g.nodes(data=True):
            deg = int(self.g.degree(node_id))
            base_r = float(data.get("radius", 8.0))
            # Slightly scale radius by node degree to make active hubs stand out
            adjusted_r = min(30.0, base_r + (deg * 0.4))
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
                )
            )

        for u, v, data in self.g.edges(data=True):
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

    def analyze_blast_zone(self, node_id: str) -> BlastZoneResponse:
        """Computes upstream lineage (ancestors) and downstream impact (descendants)."""
        if node_id not in self.g:
            return BlastZoneResponse(
                target_node_id=node_id,
                impact_level="LOW",
                upstream_nodes=[],
                downstream_nodes=[],
                affected_tables=[],
                affected_notebooks=[],
                explanation=f"Node '{node_id}' not found in graph.",
            )

        upstream = list(nx.ancestors(self.g, node_id))
        downstream = list(nx.descendants(self.g, node_id))

        affected_tables = [n for n in downstream if self.g.nodes[n].get("type") == "table"]
        affected_notebooks = [n for n in downstream if self.g.nodes[n].get("type") == "notebook"]
        affected_metrics = [n for n in downstream if self.g.nodes[n].get("type") == "metric"]

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
