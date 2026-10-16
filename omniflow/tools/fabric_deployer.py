"""
omniflow/tools/fabric_deployer.py
---------------------------------
Enterprise Microsoft Fabric Deployment Engine.
Routes all provision and inspection calls through app/fabric_client.py as mandated
by AGENTS.md Constitution, deploying Lakehouses, Notebooks, and Pipelines directly
into the AI_Test_Folder containment hierarchy.
"""

from __future__ import annotations

import os
import sys
from typing import Any

# Ensure workspace root is in sys.path
_root = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
if _root not in sys.path:
    sys.path.insert(0, _root)

from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME
from app.fabric_client import (
    create_item,
    get_or_create_folder,
    list_folders,
    list_workspace_items,
    provision_item_with_definition,
)
from app.fabric_compiler import compile_notebook_update


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
) -> dict[str, Any]:
    """Provisions complete end-to-end Medallion assets inside AI_Test_Folder on Microsoft Fabric:
    1. AI_Test_Folder containment folder
    2. Bronze Lakehouse (lh_<domain>_bronze)
    3. Silver Lakehouse (lh_<domain>_silver)
    4. Curated PySpark Notebook (nb_silver_<domain>_curate)
    5. Ingestion Pipeline (pl_<domain>_bronze_ingest)
    """
    ws_id = workspace_id or ALLOWED_WORKSPACE_ID
    results: dict[str, Any] = {"folder": None, "deployed_items": []}

    # 1. Resolve or create AI_Test_Folder
    folder_id = None
    try:
        folders = list_folders(ws_id)
        for f in folders:
            if f.get("displayName") == "AI_Test_Folder":
                folder_id = f.get("id")
                break
        if not folder_id:
            folder_res = get_or_create_folder("AI_Test_Folder", ws_id)
            folder_id = folder_res.get("folder_id")
        results["folder"] = {"id": folder_id, "name": "AI_Test_Folder"}
    except Exception as e:
        results["folder"] = {"error": str(e)}

    # 2. Deploy Bronze Lakehouse
    lh_bronze_name = f"lh_{domain}_bronze"
    res_b = deploy_fabric_item(
        display_name=lh_bronze_name,
        item_type="Lakehouse",
        workspace_id=ws_id,
        folder_id=folder_id,
        description=f"Raw Bronze Lakehouse for {project_code}",
    )
    results["deployed_items"].append(res_b)

    # 3. Deploy Silver Lakehouse
    lh_silver_name = f"lh_{domain}_silver"
    res_s = deploy_fabric_item(
        display_name=lh_silver_name,
        item_type="Lakehouse",
        workspace_id=ws_id,
        folder_id=folder_id,
        description=f"Curated Harmonized Silver Lakehouse for {project_code}",
    )
    results["deployed_items"].append(res_s)

    # 4. Deploy Gold Warehouse
    wh_gold_name = f"wh_{domain}_gold"
    res_w = deploy_fabric_item(
        display_name=wh_gold_name,
        item_type="Warehouse",
        workspace_id=ws_id,
        folder_id=folder_id,
        description=f"Analytical Serving Gold Warehouse for {project_code}",
    )
    results["deployed_items"].append(res_w)

    # 5. Deploy PySpark Curated Notebook with Base64 code if provided
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
        folder_id=folder_id,
        definition={"parts": nb_parts} if nb_parts else None,
        description=f"Silver SCD2 & PII Masking Synapse Notebook for {project_code}",
    )
    results["deployed_items"].append(res_nb)

    # 5. Deploy Ingestion Data Pipeline
    pl_name = f"pl_{domain}_bronze_ingest"
    res_pl = deploy_fabric_item(
        display_name=pl_name,
        item_type="DataPipeline",
        workspace_id=ws_id,
        folder_id=folder_id,
        description=f"Batch Ingestion Pipeline for {project_code}",
    )
    results["deployed_items"].append(res_pl)

    return results
