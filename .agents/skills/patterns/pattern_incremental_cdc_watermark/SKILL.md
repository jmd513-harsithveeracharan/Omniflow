---
name: pattern_incremental_cdc_watermark
description: Enterprise patterns for high-watermark incremental ingestion, primary key deduplication, and Delta MERGE upserts in Silver layers.
tier: pattern
---

# Pattern: Incremental CDC Watermarking & Delta MERGE

## 1. The Core Architecture Pattern
To prevent full table scans and eliminate duplicate rows in Delta Lake, use high-watermark tracking combined with `DeltaTable.merge()`:

```python
from delta.tables import DeltaTable
from pyspark.sql import SparkSession
from pyspark.sql.functions import col, max, current_timestamp, row_number
from pyspark.sql.window import Window

spark = SparkSession.builder.getOrCreate()

# 1. Step A: Deduplicate Incoming Source Batch (CRITICAL to avoid Delta MERGE runtime failure)
window_spec = Window.partitionBy("order_id").orderBy(col("updated_at").desc())
deduped_source_df = (
    incoming_df
    .withColumn("_rn", row_number().over(window_spec))
    .filter(col("_rn") == 1)
    .drop("_rn")
    .withColumn("_ingested_at", current_timestamp())
)

# 2. Step B: Delta MERGE Upsert into Target Silver Table
target_table = DeltaTable.forPath(spark, target_path)

(
    target_table.alias("tgt")
    .merge(
        deduped_source_df.alias("src"),
        "tgt.order_id = src.order_id"
    )
    .whenMatchedUpdateAll(
        condition="src.updated_at > tgt.updated_at"
    )
    .whenNotMatchedInsertAll()
    .execute()
)
```

## 2. Guardrails
* **Always deduplicate source data on primary key before calling `.merge()`**: If the source DataFrame contains duplicates of the same PK within the batch, Delta Lake will throw a `DeltaAnalysisException: Cannot perform MERGE on a target table when multiple source rows match`.
