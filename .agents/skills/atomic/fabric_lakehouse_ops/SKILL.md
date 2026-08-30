---
name: fabric_lakehouse_ops
description: Complete lifecycle operations for Microsoft Fabric Lakehouses (Delta Lake storage, SQL Endpoints, OneLake shortcuts, Maintenance).
tier: atomic
---

# Fabric Lakehouse Operations (OneLake Storage)

## 1. REST API Endpoints
* **Create Lakehouse:** `POST /v1/workspaces/{workspaceId}/items` with `{"type": "Lakehouse", "displayName": "<name>"}`
* **Get Lakehouse Tables:** `GET /v1/workspaces/{workspaceId}/lakehouses/{lakehouseId}/tables`
* **Create OneLake Shortcut:** `POST /v1/workspaces/{workspaceId}/lakehouses/{lakehouseId}/shortcuts`

## 2. Medallion Table Organization Standards
* **Tables Directory:** `abfss://<workspaceId>@onelake.dfs.fabric.microsoft.com/<lakehouseId>/Tables/<tableName>`
* **Files Directory:** `abfss://<workspaceId>@onelake.dfs.fabric.microsoft.com/<lakehouseId>/Files/<subPath>`
* **Delta Format:** All tables must be saved in native `delta` format with Parquet snappy compression.

## 3. Critical Lakehouse Rules
1. **Never delete companion SQLEndpoints directly:** Fabric creates companion SQLEndpoint items automatically. Deleting a Lakehouse deletes its endpoint; calling `DELETE /items/{id}` on SQLEndpoint returns `400 BadRequest`.
2. **Delta Table Compaction:** Regularly execute `OPTIMIZE table_name` to eliminate small file fragmentation.
