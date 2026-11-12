"""
omniflow/graph_project_builder.py
---------------------------------
Compiles project-scoped Relationship Graphs from generated artifacts,
lineage DAG manifests, SQL DDLs, and live bound Fabric workspaces.
Extracts Schema (container), Table (square), and Column (dot) hierarchy.
"""

from __future__ import annotations

import glob
import json
import os
import re
from typing import Any, Literal
import networkx as nx

from omniflow.graph.generator import add_edge, add_node, build_rich_medallion_galaxy
from omniflow.graph.models import infer_layer_name
from omniflow.graph.workspace_builder import build_workspace_project_graph

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def _classify_artifact_node(node_id: str) -> tuple[
    Literal["source", "schema", "lakehouse", "warehouse", "table", "column", "notebook", "pipeline", "metric"],
    str,
    float,
]:
    nid = node_id.lower()
    if nid.startswith("source") or nid.startswith("src_") or "landing" in nid:
        return "source", "source", 12.5
    if nid.startswith("col_"):
        return "column", infer_layer_name(nid), 3.0
    if "." in nid:
        schema_part, _ = nid.split(".", 1)
        return "table", infer_layer_name(schema_part), 6.8
    if nid.startswith("sm_") or "direct_lake" in nid or "semantic" in nid or "metric" in nid:
        return "metric", "bi", 8.5
    if nid.startswith("nb_") or "notebook" in nid or "curate" in nid:
        return "notebook", infer_layer_name(nid), 7.5
    if nid.startswith("pl_") or "pipeline" in nid or "ingest" in nid:
        return "pipeline", "orchestration", 8.0
    if nid.startswith("lh_"):
        return "lakehouse", infer_layer_name(nid), 12.5
    if nid.startswith("wh_"):
        return "warehouse", infer_layer_name(nid), 12.5
    return "table", infer_layer_name(nid), 6.8


def _clean_artifact_label(raw: str, ntype: str) -> str:
    if "." in raw:
        return raw.split(".", 1)[-1]
    if ntype == "source":
        stripped = re.sub(r"^(source_|src_)", "", raw, flags=re.IGNORECASE)
        return stripped.replace("_", " ").title() + " Source"
    if ntype == "metric" and raw.lower().startswith("sm_"):
        return "DirectLake: " + raw[3:].replace("_", " ").title()
    return raw


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
    """Extracts column schemas from Python TABLE_CONFIGS and T-SQL CREATE TABLE DDLs."""
    cols_by_table: dict[str, list[dict[str, Any]]] = {}

    for py_file in glob.glob(os.path.join(proj_folder, "*.py")):
        try:
            with open(py_file, "r", encoding="utf-8") as pf:
                code = pf.read()
            if "TABLE_CONFIGS" in code:
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
                            for raw_col in re.findall(r'"([^"]+)"', pii_match.group(1))[:5]:
                                col_list.append({"name": raw_col, "is_pk": False, "type": "string"})
                        cols_by_table[tname.lower()] = col_list
        except Exception:
            pass

    for sql_file in glob.glob(os.path.join(proj_folder, "*.sql")):
        try:
            with open(sql_file, "r", encoding="utf-8", errors="ignore") as sf:
                sql_text = sf.read()
            ddl_blocks = re.finditer(
                r"CREATE\s+TABLE\s+(?:\[?\w+\]?\.)?\[?(\w+)\]?\s*\((.*?)\);",
                sql_text,
                re.IGNORECASE | re.DOTALL,
            )
            for block in ddl_blocks:
                tname = block.group(1).lower()
                body = block.group(2)
                parsed_cols: list[dict[str, Any]] = []
                for idx, line in enumerate(body.splitlines()):
                    col_m = re.match(r"\s*\[?([a-zA-Z0-9_]+)\]?\s+([a-zA-Z0-9_(),]+)", line.strip())
                    if not col_m:
                        continue
                    cname = col_m.group(1)
                    if cname.upper() in ("CONSTRAINT", "PRIMARY", "FOREIGN", "INDEX", "KEY") or cname.startswith("_"):
                        continue
                    parsed_cols.append({
                        "name": cname,
                        "is_pk": idx == 0 or cname.endswith("_sk") or cname.endswith("_id"),
                        "type": col_m.group(2).lower(),
                    })
                    if len(parsed_cols) >= 7:
                        break
                if parsed_cols:
                    cols_by_table[tname] = parsed_cols
        except Exception:
            pass

    return cols_by_table


def build_mesh_from_project(project_id: str | None) -> nx.DiGraph:
    """Compiles a scoped NetworkX Relationship Graph for a specific project."""
    clean_pid = project_id.strip() if project_id else ""

    proj_folder = os.path.join(BASE_DIR, "generated_artifacts", clean_pid) if clean_pid else ""
    lineage_files: list[str] = []
    if proj_folder and os.path.isdir(proj_folder):
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
            created_schemas: dict[str, str] = {}
            node_schema: dict[str, str] = {}

            for n in raw_nodes:
                nid = str(n)
                ntype, nlayer, radius = _classify_artifact_node(nid)
                schema_id: str | None = None

                if "." in nid:
                    schema_name, _ = nid.split(".", 1)
                    schema_id = f"schema_{schema_name}"
                    if schema_id not in created_schemas:
                        created_schemas[schema_id] = schema_name
                        add_node(
                            g,
                            node_id=schema_id,
                            label=schema_name,
                            ntype="schema",
                            layer=nlayer,
                            radius=12.5,
                            desc=f"Schema container [{schema_name}]",
                            cluster=nlayer,
                        )
                    node_schema[nid] = schema_id

                clean_label = _clean_artifact_label(nid, ntype)
                add_node(
                    g,
                    node_id=nid,
                    label=clean_label,
                    ntype=ntype,
                    layer=nlayer,
                    parent_id=schema_id,
                    radius=radius,
                    desc=f"Asset in {clean_pid}: {nid}",
                    cluster=nlayer,
                )
                if schema_id:
                    add_edge(g, schema_id, nid, "CONTAINS", desc=f"Schema [{created_schemas[schema_id]}] contains {clean_label}")

            seen_src_to_schema: set[tuple[str, str]] = set()
            for e in raw_edges:
                src = e.get("from") or e.get("source")
                tgt = e.get("to") or e.get("target")
                rel = _map_edge_relationship(e.get("rel") or e.get("relationship", "DEPENDS_ON"))
                if not (src and tgt and src in g.nodes and tgt in g.nodes):
                    continue
                if g.nodes[src].get("type") == "source" and tgt in node_schema:
                    tgt_schema = node_schema[tgt]
                    if (src, tgt_schema) not in seen_src_to_schema:
                        seen_src_to_schema.add((src, tgt_schema))
                        add_edge(g, src, tgt_schema, "FEEDS", desc=f"Ingests into schema {created_schemas.get(tgt_schema, tgt_schema)}", cross_layer=True)
                else:
                    is_cross = g.nodes[src].get("layer") != g.nodes[tgt].get("layer")
                    add_edge(g, src, tgt, rel, desc=f"{rel} flow in {clean_pid}", cross_layer=is_cross)

            cols_by_table = _extract_project_table_columns(proj_folder)
            for nid in list(g.nodes):
                if g.nodes[nid].get("type") != "table":
                    continue
                tname = nid.split(".")[-1].lower()
                matched_cols = cols_by_table.get(tname) or next(
                    (cols for k, cols in cols_by_table.items() if tname.startswith("fact_") and k.startswith("fact_")),
                    [],
                )
                for col in matched_cols:
                    cid = f"col_{nid}_{col['name']}"
                    is_pk = bool(col.get("is_pk", False))
                    add_node(
                        g,
                        node_id=cid,
                        label=col["name"],
                        ntype="column",
                        layer=str(g.nodes[nid].get("layer", "shared")),
                        parent_id=nid,
                        data_type=str(col.get("type", "string")),
                        is_pk=is_pk,
                        radius=3.0,
                        desc=f"Column of {tname} ({'Primary Key' if is_pk else col.get('type', 'Attribute')})",
                    )
                    add_edge(g, nid, cid, "CONTAINS", desc=str(col.get("type", "string")))

            if len(g.nodes) > 0:
                return g
        except Exception as exc:
            print(f"[GraphProjectBuilder] Artifact parse fallback for {clean_pid}: {exc}")

    if clean_pid and clean_pid.lower() not in ("all", "galaxy", "default", "prj-default"):
        return build_workspace_project_graph(clean_pid)

    return build_rich_medallion_galaxy()

