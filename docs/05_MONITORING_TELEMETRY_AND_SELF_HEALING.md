# 05. Pipeline Execution Monitoring, Telemetry, and Closed-Loop Self-Healing

---

## 1. Overview of Execution & Monitoring Architecture

Once Microsoft Fabric artifacts are provisioned, Fabric AI enters the **Operational Lifecycle**:
1. **Triggering Ingestion Runs** via Microsoft Fabric Jobs REST API.
2. **Monitoring Pipeline Progress** with activity-level telemetry.
3. **Recording Execution Metrics** in an in-Lakehouse audit table (`_fabric_ai_audit_log`).
4. **Intercepting Runtime Failures & Self-Healing** through an automated remediation loop.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                               OPERATIONAL EXECUTION LOOP                               │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Trigger Job ➔ POST /v1/workspaces/{ws_id}/items/{pl_id}/jobs/instances?jobType=Pipe │
│ 2. Poll Status ➔ GET /v1/workspaces/{ws_id}/items/{pl_id}/jobs/instances/{job_id}     │
│ 3. Evaluate State:                                                                     │
│    ├── SUCCESS ➔ Log metrics to Lakehouse `_fabric_ai_audit_log` ➔ Complete           │
│    └── FAILED  ➔ Extract Traceback ➔ Trigger Closed-Loop Self-Healing Engine           │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Triggering & Polling via Microsoft Fabric REST API

### Step 1: Trigger Pipeline Run
```http
POST https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/items/{pipelineId}/jobs/instances?jobType=Pipeline
Authorization: Bearer <azure_token>
```
* **Response Status:** `202 Accepted`
* **Response Header:** `Location: https://api.fabric.microsoft.com/v1/workspaces/{ws_id}/items/{pl_id}/jobs/instances/{jobInstanceId}`

### Step 2: Poll Execution State
```http
GET https://api.fabric.microsoft.com/v1/workspaces/{workspaceId}/items/{pipelineId}/jobs/instances/{jobInstanceId}
Authorization: Bearer <azure_token>
```
* **Response Payload:**
```json
{
  "id": "job-instance-guid",
  "itemId": "pipeline-guid",
  "jobType": "Pipeline",
  "status": "Failed", // "NotStarted" | "InProgress" | "Completed" | "Failed"
  "startTimeUtc": "2026-08-20T00:00:00Z",
  "endTimeUtc": "2026-08-20T00:01:24Z",
  "failureReason": "Activity 'Ingest_Sales_Orders' failed with PySpark AnalysisException: Column 'modified_date' does not exist."
}
```

---

## 3. The In-Lakehouse Operational Telemetry Sink

To provide rich business visibility (exact rows ingested, throughput, and duration) without parsing messy log files, every generated PySpark notebook includes an **Audit Logging Footer**:

```python
# Injected at the bottom of every generated PySpark notebook
import time
from datetime import datetime

audit_record = {
    "pipeline_id": "pl_sales_ingestion",
    "table_name": "bronze_sales_orders",
    "rows_read": source_df.count(),
    "rows_inserted": merge_metrics.numTargetRowsInserted,
    "rows_updated": merge_metrics.numTargetRowsUpdated,
    "duration_seconds": round(time.time() - start_time, 2),
    "status": "SUCCESS",
    "timestamp": datetime.utcnow()
}

spark.createDataFrame([audit_record]) \
    .write.format("delta") \
    .mode("append") \
    .saveAsTable("lh_bronze._fabric_ai_audit_log")
```

The Web Studio can query this Delta table directly via SQL to render real-time ingestion dashboards.

---

## 4. Closed-Loop Self-Healing Architecture

When a pipeline failure is intercepted, the Self-Healing Engine executes a structured 5-stage remediation cycle:

```
                          PIPELINE RUNTIME FAILURE
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │ 1. Extract Failure Traceback    │
                    │    (Job API & Spark Driver Logs)│
                    └────────────────┬────────────────┘
                                     │
                                     ▼
                    ┌─────────────────────────────────┐
                    │ 2. Error Categorization & Parse │
                    └────────────────┬────────────────┘
                                     │
              ┌──────────────────────┴──────────────────────┐
              ▼                                             ▼
    [ AUTO-HEALABLE ERROR ]                       [ NON-HEALABLE ERROR ]
    • Schema Evolution / New Column               • Bad Credentials / Auth Dropped
    • Data Type Mismatch (String ➔ Int)           • Missing Key Vault Permission
    • Watermark Timestamp Parse Error             • Cloud Capacity Outage
              │                                             │
              ▼                                             ▼
┌───────────────────────────┐                 ┌───────────────────────────┐
│ 3. LLM Root-Cause Fix     │                 │ Escalation to Human       │
│    (Claude Sonnet / GPT)  │                 │ (HITL Checkpoint 4)       │
└─────────────┬─────────────┘                 └───────────────────────────┘
              │
              ▼
┌───────────────────────────┐
│ 4. Patch Notebook via API │
│    (POST /updateDefinition│
└─────────────┬─────────────┘
              │
              ▼
┌───────────────────────────┐
│ 5. Trigger Retry (Max 2)  │
└───────────────────────────┘
```

---

## 5. The Deterministic Circuit Breaker (Safety Guardrail)

To prevent runaway LLM hallucinations, infinite retry loops, and cloud capacity depletion, the Self-Healing Engine enforces strict **Circuit Breaker Rules**:

| Guardrail Rule | Specification | Action on Breach |
| :--- | :--- | :--- |
| **Max Retry Limit** | Maximum **2 automatic retries** per activity. | If error persists on Attempt 3, immediately halt and alert human. |
| **Whitelisted Errors Only** | Only deterministic code errors (`AnalysisException`, `ParseException`, `TypeMismatchException`, `RateLimit429`) are eligible for auto-healing. | Network, Auth, and Cluster Outages skip auto-healing and notify admin immediately. |
| **Code Rollback Snapshot** | Before applying an LLM patch, the original `notebook-content.py` definition is snapshotted to `_backup_definitions/`. | If the patch causes a worse failure, the agent reverts to the original code. |
| **Audit Logging** | Every self-healing attempt records the error, the prompt, the generated diff, and the outcome in `self_healing_audit.json`. | Full traceability for enterprise compliance. |

---

## 6. Self-Healing Code Example

### Scenario: Source column `tax_rate` changed from `FLOAT` to `STRING` containing `N/A`.
1. **Raw Error:** `PySpark ValueError: could not convert string to float: 'N/A'`
2. **LLM Remediation Prompt:**
   ```json
   {
     "error": "ValueError: could not convert string to float: 'N/A'",
     "source_column": "tax_rate",
     "table": "bronze_sales_orders"
   }
   ```
3. **Generated Code Patch:**
   ```python
   # Original:
   # df = df.withColumn("tax_rate", F.col("tax_rate").cast("float"))

   # Self-Healed Patch:
   df = df.withColumn(
       "tax_rate",
       F.when(F.col("tax_rate") == "N/A", None).otherwise(F.col("tax_rate")).cast("float")
   )
   ```
4. **Outcome:** Patch uploaded via `/updateDefinition` ➔ Pipeline retried ➔ Succeeded!
