---
name: pattern_error_handling_self_healing
description: Protocols for intercepting Fabric Synapse Spark runtime errors, diagnosing AST schema drift, hot-patching Base64 notebook definitions, and automated pipeline reruns.
tier: pattern
---

# Pattern: Closed-Loop Self-Healing & Error Remediation

## 1. The Closed-Loop Flow
```
1. Pipeline Fails ➔ 2. Intercept Stack Trace ➔ 3. Diagnose Root Cause ➔ 4. Hot-Patch Definition ➔ 5. Rerun
```

## 2. Common Spark Runtime Exceptions & Automated Fixes

| Exception | Root Cause | Automated Remediation |
| :--- | :--- | :--- |
| `AnalysisException: Column not found` | Source column renamed or missing. | Check source schema with connector and apply `col("old").alias("new")` or add `.withColumn("col", lit(None))`. |
| `DeltaAnalysisException: multiple source rows match` | Duplicate primary keys in input batch. | Inject window deduplication: `row_number().over(Window.partitionBy(pk).orderBy(col(ts).desc()))`. |
| `ClassCastException / DataTypeMismatch` | String sent into Integer/Decimal column. | Apply explicit safe-casting: `to_timestamp(col("date"))` or `col("val").cast(DoubleType())`. |
| `FolderNotEmpty: 400 BadRequest` | Deleting folder before deleting items. | Delete internal items first, sleep 2 seconds for Fabric sync, then delete folder. |

## 3. Hot-Patching Execution
```python
# 1. Generate patched PySpark code
# 2. Re-compile to Base64 notebook-content.ipynb
# 3. Call update_definition(item_id, payload)
# 4. Trigger rerun
```
