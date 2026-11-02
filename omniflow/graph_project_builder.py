"""
omniflow/graph_project_builder.py
---------------------------------
Compiles project-scoped Relationship Graphs from generated artifacts,
lineage DAG manifests, and enterprise Medallion architectures.
Extracts both Table-level and Column-level entities.
"""

from __future__ import annotations

import glob
import json
import os
import re
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
        return "source", "source", 8.0
    if "col_" in nid:
        return "column", "shared", 3.0
    if "bronze" in nid or ".raw" in nid:
        return "table", "bronze", 5.5
    if "silver" in nid or ".curated" in nid:
        return "table", "silver", 5.5
    if "gold" in nid or "wh_" in nid or "warehouse" in nid or "fact_" in nid or "dim_" in nid:
        return "warehouse", "gold", 6.5
    if "sm_" in nid or "direct_lake" in nid or "semantic" in nid or "metric" in nid:
        return "metric", "bi", 7.5
    if "nb_" in nid or "notebook" in nid or "curate" in nid:
        return "notebook", "silver", 5.0
    if "pl_" in nid or "pipeline" in nid or "ingest" in nid:
        return "pipeline", "shared", 5.5
    return "table", "shared", 5.0


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


def _extract_project_table_columns(proj_folder: str) -> dict[str, list[dict[str, Any]]]:
    """Extracts column schemas from Python curation notebooks or DDL files."""
    cols_by_table: dict[str, list[dict[str, Any]]] = {}
    py_files = glob.glob(os.path.join(proj_folder, "*.py"))

    for py_file in py_files:
        try:
            with open(py_file, "r", encoding="utf-8") as pf:
                code = pf.read()
            if "TABLE_CONFIGS" in code:
                # Extract table_name, primary_key, and pii_columns
                matches = re.finditer(r'\{[^{}]*"table_name"\s*:\s*"([^"]+)"[^{}]*\}', code, re.DOTALL)
                for m in matches:
                    block = m.group(0)
                    tname_match = re.search(r'"table_name"\s*:\s*"([^"]+)"', block)
                    pk_match = re.search(r'"primary_key"\s*:\s*"([^"]+)"', block)
                    if tname_match:
                        tname = tname_match.group(1)
                        col_list: list[dict[str, Any]] = []
                        if pk_match:
                            col_list.append({"name": pk_match.group(1), "is_pk": True, "type": "bigint"})
                        pii_match = re.search(r'"pii_columns"\s*:\s*\[(.*?)\]', block, re.DOTALL)
                        if pii_match:
                            for raw_col in re.findall(r'"([^"]+)"', pii_match.group(1))[:4]:
                                col_list.append({"name": raw_col, "is_pk": False, "type": "string"})
                        cols_by_table[tname.lower()] = col_list
        except Exception:
            pass
    return cols_by_table


def build_mesh_from_project(project_id: str | None) -> nx.DiGraph:
    """Compiles a scoped NetworkX Relationship Graph for a specific project."""
    if not project_id or project_id in ("all", "galaxy", "default"):
        return build_rich_medallion_galaxy()

    clean_pid = project_id.strip()
    proj_folder = os.path.join(BASE_DIR, "generated_artifacts", clean_pid)

    lineage_files = []
    if os.path.isdir(proj_folder):
        lineage_files = (
            glob.glob(os.path.join(proj_folder, "*lineage*.json"))
            + glob.glob(os.path.join(proj_folder, "dag_*.json"))
        )

    if lineage_files:
        try:
            with open(lineage_files[0], "r", encoding="utf-8") as f:
                data = json.load(f)

            g = nx.DiGraph()
            raw_nodes = data.get("nodes", [])
            raw_edges = data.get("edges", [])

            for n in raw_nodes:
                nid = str(n)
                ntype, nlayer, radius = _classify_node_layer(nid)
                clean_label = nid.split(".")[-1] if "." in nid else nid
                clean_label = clean_label.replace("source_", "Source: ").replace("lh_", "").replace("wh_", "").replace("sm_", "DirectLake: ")
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

            # Enrich with table columns
            cols_by_table = _extract_project_table_columns(proj_folder)
            for nid in list(g.nodes):
                tname = nid.split(".")[-1].lower()
                if tname in cols_by_table:
                    for col in cols_by_table[tname]:
                        cid = f"col_{nid}_{col['name']}"
                        is_pk = bool(col.get("is_pk", False))
                        add_node(
                            g,
                            node_id=cid,
                            label=col["name"],
                            ntype="column",
                            layer=g.nodes[nid].get("layer", "shared"),
                            parent_id=nid,
                            is_pk=is_pk,
                            radius=3.0,
                            desc=f"Column of {tname} ({'Primary Key' if is_pk else 'Attribute'})",
                        )
                        add_edge(g, nid, cid, "CONTAINS", desc="Table schema column")

            if len(g.nodes) > 0:
                return g
        except Exception:
            pass

    return _build_synthetic_project_dag(clean_pid)


def _build_synthetic_project_dag(project_code: str) -> nx.DiGraph:
    """Builds a rich, domain-tailored Medallion architecture DAG with Tables & Columns."""
    g = nx.DiGraph()
    domain = project_code.replace("PRJ-", "").lower().replace("-", "_")

    src_id = f"src_{domain}"
    add_node(g, src_id, f"Source: {domain.upper()}", "source", "source", radius=8.0, desc="Enterprise Ingestion Gateway")

    entities = [
        ("customers", ["customer_id", "email", "full_name"]),
        ("orders", ["order_id", "order_date", "total_amount"]),
        ("transactions", ["txn_id", "account_id", "amount"]),
        ("products", ["product_id", "sku", "unit_price"]),
    ]

    for ent, cols in entities:
        b_id = f"lh_{domain}_bronze.{ent}"
        add_node(g, b_id, f"bronze.{ent}", "table", "bronze", radius=5.5, desc="Raw Delta Table")
        add_edge(g, src_id, b_id, "FEEDS", "CDC Batch Ingestion")

        s_id = f"lh_{domain}_silver.{ent}"
        add_node(g, s_id, f"silver.{ent}", "table", "silver", radius=5.5, desc="Deduplicated Conformed Table")
        add_edge(g, b_id, s_id, "TRANSFORMS_TO", "PySpark Delta MERGE")

        # Columns
        for idx, cname in enumerate(cols):
            is_pk = idx == 0
            cid = f"col_{s_id}_{cname}"
            add_node(g, cid, cname, "column", "silver", parent_id=s_id, is_pk=is_pk, radius=3.0)
            add_edge(g, s_id, cid, "CONTAINS", "Column attribute")

    fact_id = f"wh_{domain}_gold.fact_{domain}"
    dim_id = f"wh_{domain}_gold.dim_customer"
    add_node(g, fact_id, f"fact_{domain}", "warehouse", "gold", radius=6.5, desc="Kimball Star Schema Fact")
    add_node(g, dim_id, f"dim_customer", "warehouse", "gold", radius=6.0, desc="Conformed Dimension")

    add_edge(g, f"lh_{domain}_silver.transactions", fact_id, "AGGREGATES", "Star Schema Aggregation")
    add_edge(g, f"lh_{domain}_silver.orders", fact_id, "AGGREGATES", "Star Schema Aggregation")
    add_edge(g, f"lh_{domain}_silver.customers", dim_id, "TRANSFORMS_TO", "SCD-2 Dimension Upsert")

    sm_id = f"sm_{domain}_direct_lake"
    add_node(g, sm_id, f"DirectLake: {domain.upper()}", "metric", "bi", radius=7.5, desc="Power BI Direct Lake Semantic Model")
    add_edge(g, fact_id, sm_id, "AGGREGATES", "DAX Direct Lake Query")
    add_edge(g, dim_id, sm_id, "AGGREGATES", "DAX Relationship")

    return g
