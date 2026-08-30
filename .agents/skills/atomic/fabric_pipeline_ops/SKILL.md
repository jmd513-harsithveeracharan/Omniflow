---
name: fabric_pipeline_ops
description: Complete lifecycle operations for Microsoft Fabric Data Factory Pipelines (Creation, Activity DAG JSON, Triggers, Parameters, Monitoring, Patching).
tier: atomic
---

# Fabric Pipeline Operations (Data Factory)

## 1. REST API Endpoints
* **Create Item:** `POST /v1/workspaces/{workspaceId}/items` with `{"type": "DataPipeline", "displayName": "<name>"}`
* **Get Definition:** `POST /v1/workspaces/{workspaceId}/items/{pipelineId}/getDefinition`
* **Update Definition:** `POST /v1/workspaces/{workspaceId}/items/{pipelineId}/updateDefinition`
* **Trigger Run:** `POST /v1/workspaces/{workspaceId}/items/{pipelineId}/jobs/instances?jobType=Pipeline`
* **Get Job Status:** `GET /v1/workspaces/{workspaceId}/items/{pipelineId}/jobs/instances/{jobInstanceId}`

## 2. Activity DAG Definition JSON Schema
Fabric pipeline definition must be base64-encoded in `pipeline-content.json`:
```json
{
  "properties": {
    "activities": [
      {
        "name": "Run_Bronze_Ingestion",
        "type": "TridentNotebook",
        "dependsOn": [],
        "policy": {
          "timeout": "0.12:00:00",
          "retry": 2,
          "retryIntervalInSeconds": 30,
          "secureOutput": false,
          "secureInput": false
        },
        "typeProperties": {
          "notebookId": "<notebook_guid>",
          "workspaceId": "<workspace_guid>",
          "parameters": {
            "batch_id": {"value": "@pipeline().RunId", "type": "string"}
          }
        }
      },
      {
        "name": "Run_Silver_Transformation",
        "type": "TridentNotebook",
        "dependsOn": [
          {
            "activity": "Run_Bronze_Ingestion",
            "dependencyConditions": ["Succeeded"]
          }
        ],
        "typeProperties": {
          "notebookId": "<notebook_guid>",
          "workspaceId": "<workspace_guid>"
        }
      }
    ]
  }
}
```

## 3. Best Practices & Rules
1. **Always chain dependencies** with `"dependencyConditions": ["Succeeded"]` to avoid race conditions.
2. **Add standard retry policies** (`retry: 2`, `retryIntervalInSeconds: 30`) on all compute-intensive notebook activities.
3. **Pass `@pipeline().RunId`** into notebook parameters for end-to-end audit tracing in Delta Lake.
