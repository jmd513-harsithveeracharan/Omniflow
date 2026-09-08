"""
app/generators/shortcut_gen.py
------------------------------
Generates payload structures for OneLake shortcuts across internal Lakehouses,
Azure ADLS Gen2, AWS S3, and Google Cloud Storage.
"""

from typing import Any


def generate_internal_lakehouse_shortcut_payload(
    shortcut_path: str,
    shortcut_name: str,
    source_workspace_id: str,
    source_lakehouse_id: str,
    source_path: str,
) -> dict[str, Any]:
    """
    Constructs a OneLake internal Lakehouse table/folder shortcut payload.
    Official Spec: POST /v1/workspaces/{workspaceId}/items/{itemId}/shortcuts
    """
    return {
        "path": shortcut_path.rstrip("/"),
        "name": shortcut_name,
        "target": {
            "oneLake": {
                "workspaceId": source_workspace_id,
                "itemId": source_lakehouse_id,
                "path": source_path,
            }
        },
    }


def generate_adls_shortcut_payload(
    shortcut_path: str,
    shortcut_name: str,
    storage_account: str,
    container: str,
    sub_path: str = "",
    connection_id: str | None = None,
) -> dict[str, Any]:
    """Constructs an Azure Data Lake Storage Gen2 shortcut payload."""
    adls_target: dict[str, Any] = {
        "location": f"https://{storage_account}.dfs.core.windows.net",
        "subpath": f"/{container}/{sub_path.lstrip('/')}".rstrip("/"),
    }
    if connection_id:
        adls_target["connectionId"] = connection_id

    return {
        "path": shortcut_path.rstrip("/"),
        "name": shortcut_name,
        "target": {"adlsGen2": adls_target},
    }


def generate_s3_shortcut_payload(
    shortcut_path: str,
    shortcut_name: str,
    bucket_name: str,
    sub_path: str = "",
    connection_id: str | None = None,
) -> dict[str, Any]:
    """Constructs an Amazon S3 shortcut payload."""
    s3_target: dict[str, Any] = {
        "location": f"https://{bucket_name}.s3.amazonaws.com",
        "subpath": f"/{sub_path.lstrip('/')}".rstrip("/"),
    }
    if connection_id:
        s3_target["connectionId"] = connection_id

    return {
        "path": shortcut_path.rstrip("/"),
        "name": shortcut_name,
        "target": {"amazonS3": s3_target},
    }
