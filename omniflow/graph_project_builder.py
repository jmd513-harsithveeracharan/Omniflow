"""
omniflow/graph_project_builder.py
---------------------------------
Compiles project-scoped Relationship Graphs from generated artifacts,
lineage DAG manifests, and enterprise Medallion architectures.
"""

from __future__ import annotations

import glob
import json
import os
from typing import Any, Literal
import networkx as nx

from omniflow.graph_generator import add_node, add_edge, build_rich_medallion_galaxy

BASE_DIR = os.path.dirname(os.path.abspath(__file__))


def _classify_node_layer(node_id: str) -> tuple[
    Literal["source", "lakehouse", "warehouse", "table", "column", "notebook", "pipeline", "metric"],
    Literal["source", "bronze", "silver", "gold", "warehouse", "bi", "shared"],
    float,
]:
    nid = node_id.lower()
    if nid.startswith("source") or "landing" in nid:
        return "source", "source", 22.0
    if "bronze" in nid or ".raw" in nid:
        return "table", "bronze", 16.0
    if "silver" in nid or ".curated" in nid:
        return "table", "silver", 16.0
    if "gold" in nid or "wh_" in nid or "warehouse" in nid or "fact_" in nid or "dim_" in nid:
        return "warehouse", "gold", 18.0
    if "sm_" in nid or "direct_lake" in nid or "semantic" in nid or "metric" in nid:
        return "metric", "bi", 20.0
    if "nb_" in nid or "notebook" in nid or "curate" in nid:
        return "notebook", "silver", 15.0
    if "pl_" in nid or "pipeline" in nid or "ingest" in nid:
        return "pipeline", "shared", 17.0
    return "table", "shared", 14.0


def _map_edge_relationship(rel_str: str) -> Literal["FEEDS", "CONTAINS", "TRANSFORMS_TO", "JOINS_WITH", "AGGREGATES", "DEPENDS_ON"]:
    r = (rel_str or "").upper()
    if "INGEST" in r or "FEED" in r:
        return "FEEDS"
    if "TRANSFORM" in r or "MERGE" in r or "UPSERT" in r:
        return "TRANSFORMS_TO"
    if "AGGREGATE" in r or "ROLLUP" in r:
        return "AGGREGATES"
    if "CONTAIN" in r or "CHILD" in r:
        return "CONTAINS"
    if "JOIN" in r:
        return "JOINS_WITH"
    return "DEPENDS_ON"


def build_mesh_from_project(project_id: str | None) -> nx.DiGraph:
    """Compiles a scoped NetworkX Relationship Graph for a specific project."""
    if not project_id or project_id in ("all", "galaxy", "default"):
        return build_rich_medallion_galaxy()

    clean_pid = project_id.strip()
    proj_folder = os.path.join(BASE_DIR, "generated_artifacts", clean_pid)

    # Search for project lineage JSON
    lineage_files = []
    if os.path.isdir(proj_folder):
        lineage_files = (
            glob.glob(os.path.join(proj_folder, "*lineage*.json"))
            + glob.glob(os.path.join(proj_folder, "dag_*.json"))
        )

    if lineage_files:
        lineage_path = lineage_files[0]
        try:
            with open(lineage_path, "r", encoding="utf-8") as f:
                data = json.load(f)

            g = nx.DiGraph()
            raw_nodes = data.get("nodes", [])
            raw_edges = data.get("edges", [])

            for n in raw_nodes:
                nid = str(n)
                ntype, nlayer, radius = _classify_node_layer(nid)
                clean_label = nid.split(".")[-1] if "." in nid else nid
                clean_label = clean_label.replace("source_", "Source: ").replace("lh_", "").replace("wh_", "").replace("sm_", "Semantic: ")
                add_node(
                    g,
                    node_id=nid,
                    label=clean_label,
                    ntype=ntype,
                    layer=nlayer,
                    radius=radius,
                    desc=f"Asset in {clean_pid}: {nid}",
                    cluster=nlayer,
                )

            for e in raw_edges:
                src = e.get("from") or e.get("source")
                tgt = e.get("to") or e.get("target")
                rel = _map_edge_relationship(e.get("rel") or e.get("relationship", "DEPENDS_ON"))
                if src and tgt and src in g.nodes and tgt in g.nodes:
                    add_edge(g, src, tgt, rel, desc=f"{rel} flow in {clean_pid}")

            if len(g.nodes) > 0:
                return g
        except Exception:
            pass

    # Dynamic fallback: build a tailored Medallion DAG for this project
    return _build_synthetic_project_dag(clean_pid)


def _build_synthetic_project_dag(project_code: str) -> nx.DiGraph:
    """Builds a rich, domain-tailored Medallion architecture DAG when no JSON artifact exists."""
    g = nx.DiGraph()
    domain = project_code.replace("PRJ-", "").lower().replace("-", "_")

    src_id = f"src_{domain}"
    add_node(g, src_id, f"Source: {domain.upper()}", "source", "source", radius=22.0, desc=f"Enterprise Ingestion Gateway")

    entities = ["customers", "orders", "transactions", "audit_log", "products"]
    for ent in entities:
        # Bronze
        b_id = f"lh_{domain}_bronze.{ent}"
        add_node(g, b_id, f"bronze.{ent}", "table", "bronze", radius=15.0, desc=f"Raw Delta Table")
        add_edge(g, src_id, b_id, "FEEDS", "CDC Batch Ingestion")

        # Silver
        s_id = f"lh_{domain}_silver.{ent}"
        add_node(g, s_id, f"silver.{ent}", "table", "silver", radius=16.0, desc=f"Deduplicated Conformed Table")
        add_edge(g, b_id, s_id, "TRANSFORMS_TO", "PySpark Delta MERGE")

    # Gold
    fact_id = f"wh_{domain}_gold.fact_{domain}"
    dim_id = f"wh_{domain}_gold.dim_customer"
    add_node(g, fact_id, f"fact_{domain}", "warehouse", "gold", radius=19.0, desc=f"Kimball Star Schema Fact")
    add_node(g, dim_id, f"dim_customer", "warehouse", "gold", radius=17.0, desc=f"Conformed Dimension")

    add_edge(g, f"lh_{domain}_silver.transactions", fact_id, "AGGREGATES", "Star Schema Load")
    add_edge(g, f"lh_{domain}_silver.orders", fact_id, "AGGREGATES", "Star Schema Load")
    add_edge(g, f"lh_{domain}_silver.customers", dim_id, "TRANSFORMS_TO", "SCD-2 Dimension Load")

    # Power BI Semantic Model
    sm_id = f"sm_{domain}_direct_lake"
    add_node(g, sm_id, f"DirectLake: {domain.upper()}", "metric", "bi", radius=21.0, desc="Power BI Direct Lake Semantic Model")
    add_edge(g, fact_id, sm_id, "AGGREGATES", "DAX Direct Lake Query")
    add_edge(g, dim_id, sm_id, "AGGREGATES", "DAX Relationship")

    return g

