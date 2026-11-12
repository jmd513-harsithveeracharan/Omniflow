"""
omniflow/graph_workspace_builder.py
-----------------------------------
Resolves real bound Microsoft Fabric workspaces and Postgres catalog metadata
to build project relationship graphs without synthetic placeholders.
"""

from __future__ import annotations

import os
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Any
import networkx as nx

from omniflow.graph.generator import add_edge, add_node
from omniflow.graph.models import infer_layer_name

_WS_GRAPH_CACHE: dict[str, tuple[float, nx.DiGraph]] = {}
_WS_CACHE_TTL_SEC = 180.0

_STAGE_ORDER: dict[str, int] = {
    "source": 0,
    "raw": 1,
    "staging": 2,
    "bronze": 3,
    "silver": 4,
    "warehouse": 5,
    "lakehouse": 5,
    "gold": 6,
    "reporting": 7,
    "bi": 8,
    "orchestration": 9,
    "workspace": 10,
    "shared": 11,
}


def _map_fabric_item_node_type(item_type: str) -> str:
    t = item_type.lower()
    if t == "lakehouse":
        return "lakehouse"
    if t in ("warehouse", "mirroredwarehouse"):
        return "warehouse"
    if t in ("semanticmodel", "report", "dashboard", "paginatedreport"):
        return "metric"
    if t == "datapipeline":
        return "pipeline"
    if t in ("notebook", "sparkjobdefinition"):
        return "notebook"
    return "table"


def _fetch_project_record(project_code: str) -> dict[str, Any] | None:
    try:
        from omniflow.db.postgres_repo import PostgresRepository

        repo = PostgresRepository()
        with repo._connect() as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT project_id::text, project_code, project_name, metadata
                FROM projects
                WHERE UPPER(project_code) = UPPER(%s) OR project_id::text = %s
                LIMIT 1;
                """,
                (project_code, project_code),
            )
            row = cur.fetchone()
            if not row:
                return None
            return {
                "project_id": row[0],
                "project_code": row[1],
                "project_name": row[2],
                "metadata": row[3] if isinstance(row[3], dict) else {},
            }
    except Exception as exc:
        print(f"[GraphWorkspaceBuilder] Postgres project lookup skipped: {exc}")
        return None


def _resolve_workspace_ids(bound_refs: list[str]) -> list[tuple[str, str]]:
    """Resolves workspace names or GUIDs to [(ws_id, ws_name)] via read-only Fabric API."""
    resolved: list[tuple[str, str]] = []
    cached_ws: list[dict[str, Any]] = []
    try:
        from omniflow import server as _srv
        ws_data = (_srv._workspaces_list_cache or {}).get("data") or {}
        if isinstance(ws_data.get("workspaces"), list):
            cached_ws = ws_data["workspaces"]
    except Exception:
        pass

    try:
        from app.fabric.workspaces import list_workspaces

        live = cached_ws or list_workspaces()
        by_id = {str(w.get("id", "")).lower(): w for w in live if w.get("id")}
        by_name = {
            str(w.get("displayName") or w.get("name") or "").strip().lower(): w
            for w in live
            if (w.get("displayName") or w.get("name"))
        }
        for ref in bound_refs:
            key = ref.strip().lower()
            w = by_id.get(key) or by_name.get(key)
            if w:
                resolved.append((str(w["id"]), str(w.get("displayName") or w.get("name") or ref)))
            elif "-" in ref and len(ref) >= 32:
                resolved.append((ref, ref))
    except Exception as exc:
        print(f"[GraphWorkspaceBuilder] Fabric workspace list fallback: {exc}")
        resolved.extend((ref, ref) for ref in bound_refs)
    return resolved


def _load_workspace_items_and_folders(ws_id: str) -> tuple[list[dict[str, Any]], dict[str, str]]:
    """Loads real items & folders from Fabric REST API (read-only), falling back to Postgres."""
    folder_names: dict[str, str] = {}
    items: list[dict[str, Any]] = []
    try:
        from app.fabric.core import get_auth_headers
        from app.fabric.workspaces import list_folders, list_workspace_items

        get_auth_headers()
        with ThreadPoolExecutor(max_workers=2) as pool:
            f_folders = pool.submit(list_folders, ws_id)
            f_items = pool.submit(list_workspace_items, ws_id)
            for f in f_folders.result():
                fid = str(f.get("id", ""))
                if fid:
                    folder_names[fid] = str(f.get("displayName", ""))
            res = f_items.result()
            if res.get("success") and isinstance(res.get("items"), list):
                items = list(res["items"])
    except Exception as exc:
        print(f"[GraphWorkspaceBuilder] Live items fetch warning ({ws_id}): {exc}")

    if not items:
        try:
            from omniflow.db.postgres_repo import PostgresRepository

            repo = PostgresRepository()
            with repo._connect() as conn, conn.cursor() as cur:
                cur.execute(
                    """
                    SELECT item_id::text, item_name, item_type, layer, status
                    FROM fabric_items WHERE workspace_id = %s
                    ORDER BY created_at DESC LIMIT 60;
                    """,
                    (ws_id,),
                )
                for r in cur.fetchall():
                    items.append({"id": r[0], "displayName": r[1], "type": r[2], "layer": r[3], "status": r[4]})
        except Exception as exc:
            print(f"[GraphWorkspaceBuilder] DB fabric_items fallback skipped: {exc}")
    return items, folder_names


def _fetch_lakehouse_tables_readonly(ws_id: str, lh_id: str) -> list[str]:
    """Best-effort read-only table listing for non-schema-enabled Lakehouses."""
    try:
        from app.fabric.core import _BASE, get_auth_headers, get_requests

        resp = get_requests().get(f"{_BASE}/workspaces/{ws_id}/lakehouses/{lh_id}/tables", headers=get_auth_headers(), timeout=3)
        if resp.status_code == 200:
            vals = resp.json().get("data") or resp.json().get("value") or []
            return [str(t.get("name")) for t in vals if isinstance(t, dict) and t.get("name")]
    except Exception:
        pass
    return []


def build_workspace_project_graph(project_code: str) -> nx.DiGraph:
    """Builds a real Relationship Graph for a project from its bound Fabric workspaces."""
    cache_key = project_code.strip().upper()
    cached = _WS_GRAPH_CACHE.get(cache_key)
    if cached and (time.time() - cached[0]) < _WS_CACHE_TTL_SEC:
        return cached[1]

    g = nx.DiGraph()
    proj = _fetch_project_record(project_code)
    meta = proj.get("metadata", {}) if proj else {}
    proj_title = (proj or {}).get("project_name") or project_code

    bound_refs: list[str] = []
    if isinstance(meta.get("workspaces"), list):
        bound_refs.extend(str(w) for w in meta["workspaces"] if w)
    if meta.get("targetWorkspace") and str(meta["targetWorkspace"]) not in bound_refs:
        bound_refs.append(str(meta["targetWorkspace"]))
    if not bound_refs:
        env_ws = os.getenv("ALLOWED_WORKSPACE_ID", "").strip()
        if env_ws:
            bound_refs.append(env_ws)

    resolved_ws = _resolve_workspace_ids(bound_refs)
    if not resolved_ws:
        add_node(g, f"ws_{project_code.lower()}", proj_title, "schema", "workspace", radius=13.5, desc=f"Project '{proj_title}' — No Fabric workspace bound yet")
        return g

    for ws_id, ws_name in resolved_ws:
        items, folder_names = _load_workspace_items_and_folders(ws_id)
        if not items:
            add_node(g, f"ws_{ws_id}", ws_name, "schema", "workspace", radius=13.5, desc=f"Bound Fabric Workspace '{ws_name}' (0 items deployed yet)")
            continue

        container_names = {
            str(it.get("displayName", "")).strip().lower()
            for it in items
            if str(it.get("type", "")).lower() in ("lakehouse", "warehouse", "mirroredwarehouse")
        }
        layer_buckets: dict[str, list[str]] = {}
        seen_folders: set[str] = set()
        lh_candidates: list[tuple[str, str, str, str]] = []

        for it in items:
            iname = str(it.get("displayName") or it.get("item_name") or "").strip()
            itype = str(it.get("type") or it.get("item_type") or "Unknown").strip()
            iid = str(it.get("id") or f"{ws_id}_{iname}_{itype}")
            if not iname or (itype.lower() == "sqlendpoint" and iname.lower() in container_names):
                continue

            fid = str(it.get("folderId") or it.get("parentFolderId") or "")
            fname = folder_names.get(fid, "")
            layer = str(it.get("layer") or "").strip().lower() or infer_layer_name(iname, fname, itype)
            ntype = _map_fabric_item_node_type(itype)
            is_container = ntype in ("lakehouse", "warehouse", "schema")

            parent_hub: str | None = None
            if fname and fname.lower() != "root":
                fnode_id = f"schema_folder_{ws_id}_{fid}"
                if fnode_id not in seen_folders:
                    seen_folders.add(fnode_id)
                    f_layer = infer_layer_name(fname, fname, "Folder")
                    add_node(g, fnode_id, fname, "schema", layer if f_layer == "workspace" else f_layer, radius=13.0, desc=f"Workspace Folder [{fname}] in {ws_name}")
                parent_hub = fnode_id

            nid = f"fab_{iid}"
            add_node(g, nid, iname, ntype, layer, parent_id=parent_hub, radius=12.5 if is_container else 7.5, desc=f"{itype} in workspace '{ws_name}'" + (f" ({fname})" if fname else ""))  # type: ignore[arg-type]
            if parent_hub:
                add_edge(g, parent_hub, nid, "CONTAINS", desc=f"Folder [{fname}] contains {iname}")
            layer_buckets.setdefault(layer, []).append(nid)
            if is_container and itype.lower() == "lakehouse" and len(iid) >= 32 and len(lh_candidates) < 2:
                lh_candidates.append((nid, iid, iname, layer))

        if lh_candidates:
            with ThreadPoolExecutor(max_workers=len(lh_candidates)) as pool:
                tbl_results = {nid: pool.submit(_fetch_lakehouse_tables_readonly, ws_id, iid) for nid, iid, _, _ in lh_candidates}
                for nid, _, iname, layer in lh_candidates:
                    for tbl_name in tbl_results[nid].result()[:20]:
                        tid = f"tbl_{nid}_{tbl_name}"
                        add_node(g, tid, tbl_name, "table", layer, parent_id=nid, radius=6.8, desc=f"Delta Table [{iname}].[{tbl_name}]")
                        add_edge(g, nid, tid, "CONTAINS", desc=f"Lakehouse {iname} table")

        ordered_layers = sorted(layer_buckets.keys(), key=lambda lyr: _STAGE_ORDER.get(lyr.lower(), 5))
        data_layers = [lyr for lyr in ordered_layers if lyr not in ("orchestration", "workspace", "shared")]
        for idx in range(len(data_layers) - 1):
            for s_nid in layer_buckets[data_layers[idx]][:3]:
                for t_nid in layer_buckets[data_layers[idx + 1]][:3]:
                    add_edge(g, s_nid, t_nid, "FEEDS", desc=f"Workspace tier flow: {data_layers[idx]} -> {data_layers[idx + 1]}", cross_layer=True)
    _WS_GRAPH_CACHE[cache_key] = (time.time(), g)
    return g
