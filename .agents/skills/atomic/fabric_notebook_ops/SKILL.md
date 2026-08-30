---
name: fabric_notebook_ops
description: Complete lifecycle operations for Microsoft Fabric PySpark Notebooks (Provisioning, IPYNB Base64 serialization, Cell formatting, Environment binding).
tier: atomic
---

# Fabric Notebook Operations (Synapse Spark)

## 1. REST API Endpoints
* **Create Notebook:** `POST /v1/workspaces/{workspaceId}/items` with `{"type": "Notebook", "displayName": "<name>"}`
* **Update IPYNB Definition:** `POST /v1/workspaces/{workspaceId}/items/{notebookId}/updateDefinition`
* **Run Notebook on Demand:** `POST /v1/workspaces/{workspaceId}/items/{notebookId}/jobs/instances?jobType=RunNotebook`

## 2. Standard IPYNB Base64 Payload Format
The payload must contain a valid Jupyter Notebook JSON serialized to Base64 in `notebook-content.ipynb`:
```json
{
  "nbformat": 4,
  "nbformat_minor": 2,
  "metadata": {
    "language_info": {"name": "python"},
    "dependencies": {
      "lakehouse": {
        "default_lakehouse": "<lakehouse_guid>",
        "default_lakehouse_name": "<lakehouse_name>",
        "default_lakehouse_workspace_id": "<workspace_guid>"
      }
    }
  },
  "cells": [
    {
      "cell_type": "code",
      "source": [
        "# Fabric PySpark Code\n",
        "from pyspark.sql import SparkSession\n",
        "spark = SparkSession.builder.getOrCreate()\n"
      ],
      "execution_count": null,
      "outputs": []
    }
  ]
}
```

## 3. Mandatory PySpark Coding Standards
1. **Always wrap cell execution in try/except** with informative console logging.
2. **Never hardcode absolute file paths:** Always read from default Lakehouse tables using `spark.table("<table_name>")` or `abfss://` coordinates.
3. **Include audit timestamp column:** Every ingested row must append `_ingested_at = current_timestamp()`.
