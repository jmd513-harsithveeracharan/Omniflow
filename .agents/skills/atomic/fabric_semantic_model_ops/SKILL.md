---
name: fabric_semantic_model_ops
description: Operations for Power BI Direct Lake Semantic Models, TMSL scripts, DAX KPI measure definitions, and star-schema relationships.
tier: atomic
---

# Fabric Direct Lake Semantic Model Operations

## 1. REST API Endpoints
* **Create Semantic Model:** `POST /v1/workspaces/{workspaceId}/items` with `{"type": "SemanticModel", "displayName": "<name>"}`
* **Update Definition (TMSL):** `POST /v1/workspaces/{workspaceId}/items/{modelId}/updateDefinition`

## 2. TMSL Model Definition Structure
Direct Lake models connect directly to Gold Delta tables without import mode caching:
```json
{
  "model": {
    "culture": "en-US",
    "tables": [
      {
        "name": "FactOrders",
        "columns": [
          {"name": "OrderID", "dataType": "int64", "sourceColumn": "order_id"},
          {"name": "OrderAmount", "dataType": "double", "sourceColumn": "amount"}
        ],
        "measures": [
          {
            "name": "Total Sales",
            "expression": "SUM(FactOrders[OrderAmount])"
          }
        ]
      }
    ]
  }
}
```
