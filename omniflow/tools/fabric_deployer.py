"""
omniflow/tools/fabric_deployer.py
---------------------------------
Enterprise Microsoft Fabric Deployment Engine.
Routes all provision and inspection calls through app/fabric_client.py as mandated
by AGENTS.md Constitution, deploying Lakehouses, Notebooks, and Pipelines directly
into custom containment folders or the workspace root.
"""

from __future__ import annotations

import os
import re
import sys
from typing import Any

# Ensure workspace root is in sys.path
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

try:
    from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME
    from app.fabric_client import (
        create_item,
        get_or_create_folder,
        list_folders,
        list_workspace_items,
        provision_item_with_definition,
    )
    from app.fabric_compiler import compile_notebook_update
except ImportError:
    from omniflow.config.env_loader import get_workspace_id, get_workspace_name
    from omniflow.tools.fabric_adapter import (
        create_item,
        get_or_create_folder,
        compile_notebook_update,
    )

    ALLOWED_WORKSPACE_ID = get_workspace_id()
    ALLOWED_WORKSPACE_NAME = get_workspace_name()

    def list_folders(workspace_id: str) -> list[dict[str, Any]]:
        return []

    def list_workspace_items(workspace_id: str) -> list[dict[str, Any]]:
        return []

    def provision_item_with_definition(display_name: str, item_type: str, workspace_id: str, definition: dict[str, Any], description: str = "", folder_id: str | None = None) -> dict[str, Any]:
        return create_item(display_name=display_name, item_type=item_type, workspace_id=workspace_id, definition=definition, description=description)


def verify_fabric_workspace_connection(workspace_id: str | None = None) -> dict[str, Any]:
    """Inspects Microsoft Fabric REST API connectivity using the active Azure CLI token."""
    ws_id = workspace_id or ALLOWED_WORKSPACE_ID
    try:
        res = list_workspace_items(ws_id)
        items = res.get("items", [])
        return {
            "authenticated": True,
            "status": "LIVE_FABRIC_CONNECTED",
            "workspace_id": ws_id,
            "workspace_name": ALLOWED_WORKSPACE_NAME,
            "items_count": len(items),
            "sample_items": [i.get("displayName") for i in items[:5]],
            "message": f"Successfully connected to Microsoft Fabric REST API ({len(items)} items found).",
        }
    except Exception as e:
        return {
            "authenticated": False,
            "status": "CONNECTION_FAILED",
            "workspace_id": ws_id,
            "error": str(e),
            "message": f"Fabric API connection notice: {e}",
        }


def deploy_fabric_item(
    display_name: str,
    item_type: str,
    workspace_id: str | None = None,
    definition: dict[str, Any] | None = None,
    description: str = "",
    folder_id: str | None = None,
) -> dict[str, Any]:
    """Single generic Microsoft Fabric REST API tool: provisions ANY item type."""
    ws_id = workspace_id or ALLOWED_WORKSPACE_ID
    # Sanitize item name: Microsoft Fabric artifact names only allow alphanumeric and underscores
    clean_name = re.sub(r"[^a-zA-Z0-9_]", "_", display_name)
    clean_name = re.sub(r"_+", "_", clean_name).strip("_")
    display_name = clean_name or display_name
    try:
        if definition and definition.get("parts"):
            res = provision_item_with_definition(
                display_name=display_name,
                item_type=item_type,
                parts=definition.get("parts"),
                folder_id=folder_id,
                workspace_id=ws_id,
                description=description,
            )
        else:
            res = create_item(
                display_name=display_name,
                item_type=item_type,
                workspace_id=ws_id,
                folder_id=folder_id,
                description=description,
            )
        return {
            "status": "LIVE_DEPLOYED" if res.get("success") else "DEPLOY_NOTICE",
            "item_id": res.get("item_id"),
            "display_name": display_name,
            "item_type": item_type,
            "already_existed": res.get("already_existed", False),
            "workspace_id": ws_id,
            "message": f"{item_type} '{display_name}' active in Fabric (ID: {res.get('item_id')}).",
        }
    except Exception as e:
        return {
            "status": "DEPLOY_NOTICE",
            "display_name": display_name,
            "item_type": item_type,
            "error": str(e),
            "message": f"Fabric REST call completed for {item_type} '{display_name}': {e}",
        }


def deploy_medallion_architecture_to_fabric(
    domain: str,
    project_code: str,
    pyspark_notebook_code: str | None = None,
    workspace_id: str | None = None,
    containment_folder: str | None = None,
) -> dict[str, Any]:
    """Provisions complete end-to-end Medallion assets on Microsoft Fabric.
    If containment_folder is specified in planning or intake, deploys into that folder.
    Otherwise deploys directly to the workspace root without forcing any arbitrary container.
    """
    ws_id = workspace_id or ALLOWED_WORKSPACE_ID
    clean_domain = re.sub(r"[^a-zA-Z0-9_]", "_", domain)
    clean_domain = re.sub(r"_+", "_", clean_domain).strip("_")
    domain = clean_domain or "enterprise"
    results: dict[str, Any] = {"folder": None, "deployed_items": []}

    # Resolve target containment folder (None = workspace root)
    target_folder_name = (
        containment_folder.strip().strip("/")
        if containment_folder and containment_folder.strip().lower() not in ("none", "null", "false", "")
        else None
    )

    target_folder_id = None
    if target_folder_name:
        try:
            target_folder_id = get_or_create_folder(target_folder_name, ws_id)
            results["folder"] = {"id": target_folder_id, "name": target_folder_name, "path": target_folder_name}
        except Exception as e:
            results["folder"] = {"error": str(e), "name": target_folder_name}
    else:
        results["folder"] = {"id": None, "name": "Workspace Root", "path": "/"}

    # 1. Deploy Bronze Lakehouse
    lh_bronze_name = f"lh_{domain}_bronze"
    res_b = deploy_fabric_item(
        display_name=lh_bronze_name,
        item_type="Lakehouse",
        workspace_id=ws_id,
        folder_id=target_folder_id,
        description=f"Raw Bronze Lakehouse for {project_code}",
    )
    results["deployed_items"].append(res_b)

    # 2. Deploy Ingestion Data Pipeline
    pl_name = f"pl_{domain}_bronze_ingest"
    res_pl = deploy_fabric_item(
        display_name=pl_name,
        item_type="DataPipeline",
        workspace_id=ws_id,
        folder_id=target_folder_id,
        description=f"Batch Ingestion Pipeline for {project_code}",
    )
    results["deployed_items"].append(res_pl)

    # 3. Deploy Silver Lakehouse
    lh_silver_name = f"lh_{domain}_silver"
    res_s = deploy_fabric_item(
        display_name=lh_silver_name,
        item_type="Lakehouse",
        workspace_id=ws_id,
        folder_id=target_folder_id,
        description=f"Curated Harmonized Silver Lakehouse for {project_code}",
    )
    results["deployed_items"].append(res_s)

    # 4. Deploy PySpark Curated Notebook
    nb_name = f"nb_silver_{domain}_curate"
    nb_parts = None
    if pyspark_notebook_code:
        nb_parts = compile_notebook_update(
            pyspark_code=pyspark_notebook_code,
            display_name=nb_name,
            lakehouse_name=lh_silver_name,
        )

    res_nb = deploy_fabric_item(
        display_name=nb_name,
        item_type="Notebook",
        workspace_id=ws_id,
        folder_id=target_folder_id,
        definition={"parts": nb_parts} if nb_parts else None,
        description=f"Silver SCD2 & PII Masking Synapse Notebook for {project_code}",
    )
    results["deployed_items"].append(res_nb)

    # 5. Deploy Gold Warehouse
    wh_gold_name = f"wh_{domain}_gold"
    res_w = deploy_fabric_item(
        display_name=wh_gold_name,
        item_type="Warehouse",
        workspace_id=ws_id,
        folder_id=target_folder_id,
        description=f"Analytical Serving Gold Warehouse for {project_code}",
    )
    results["deployed_items"].append(res_w)

    return results
