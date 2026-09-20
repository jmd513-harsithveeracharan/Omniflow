---
name: fabric_medallion_architecture
description: Playbook for designing and provisioning multi-tier Medallion (Bronze/Silver/Gold) Lakehouse architectures in Microsoft Fabric. Use when the user asks to build lakehouses, medallion pipelines, or multi-layer data platforms.
---

# Fabric Medallion Architecture Playbook (Enterprise Standard)

## 1. Architectural Principles & Isolation

- **Bronze Layer (`lh_<domain>_bronze`)**:
  - Raw, immutable landing copy of source tables.
  - Store as Delta format with metadata columns: `_ingested_at` (timestamp) and `_source_system` (string).
  - Enable schema evolution: `.option("mergeSchema", "true")`.
  - Zero transformations, zero type casting, zero filtering.
  - Output write: Single-part managed table via `saveAsTable("<table_name>")`.

- **Silver Layer (`lh_<domain>_silver`)**:
  - Cleaned, typed, and deduplicated conformed tables (e.g. `dim_customers`, `dim_products`, `orders`).
  - Read ONLY from Bronze lakehouse: `spark.read.table("lh_<domain>_bronze.<table_name>")`.
  - Deduplicate on Primary Keys using `Window.partitionBy("<pk>").orderBy(F.col("_ingested_at").desc())`.
  - Prefer Delta Lake `MERGE` upsert for idempotent re-runs.
  - Output write: Single-part managed table via `saveAsTable("<table_name>")`.

- **Gold Layer (`lh_<domain>_gold`)**:
  - Kimball Star Schema: Business aggregate Fact tables joining multiple Silver dimension tables.
  - Read ONLY from Silver lakehouse: `spark.read.table("lh_<domain>_silver.<table_name>")`.
  - Surrogate key generation via `F.sha2(F.concat_ws("||", ...), 256)`.
  - Partitioning: Explicitly project `year` and `month` columns before `.partitionBy("year", "month")`.
  - Output write: Single-part managed table via `saveAsTable("<table_name>")`.

---

## 2. Canonical PySpark Code Templates (Few-Shot Anchors)

### Canonical Bronze Ingestion (Raw)
```python
# CELL ********************
from pyspark.sql import functions as F

# 1. Read source data (e.g. from staging Lakehouse ABFSS or connector)
df_raw = spark.read.format("delta").load(source_abfss_path)

# 2. Add audit columns (Mandatory standard)
df_bronze = (
    df_raw
    .withColumn("_ingested_at", F.current_timestamp())
    .withColumn("_source_system", F.lit("ERP_SAP"))
)

# 3. Write to Bronze Lakehouse (Single-part table name ONLY)
(
    df_bronze.write
    .format("delta")
    .mode("overwrite")
    .option("mergeSchema", "true")
    .saveAsTable("orders")
)
```

### Canonical Silver Cleansing & Delta Upsert
```python
# CELL ********************
from pyspark.sql import functions as F
from pyspark.sql.window import Window
from delta.tables import DeltaTable

# 1. Read from Bronze layer
df_bronze = spark.read.table("lh_sales_bronze.orders")

# 2. Deduplicate on Primary Key using _ingested_at
window_spec = Window.partitionBy("order_id").orderBy(F.col("_ingested_at").desc())
df_dedup = (
    df_bronze
    .withColumn("_rn", F.row_number().over(window_spec))
    .filter(F.col("_rn") == 1)
    .drop("_rn")
)

# 3. Type casting & cleansing
df_clean = (
    df_dedup
    .withColumn("order_id", F.col("order_id").cast("string"))
    .withColumn("customer_id", F.col("customer_id").cast("string"))
    .withColumn("total_amount", F.col("total_amount").cast("double"))
    .withColumn("order_date", F.to_date("order_date"))
    .filter(F.col("total_amount") >= 0)
)

# 4. Idempotent Delta Table Write (Single-part table name ONLY)
df_clean.write.format("delta").mode("overwrite").saveAsTable("orders")
```

### Canonical Gold Kimball Star Schema (Fact Joining Multi-Silver Dimensions)
```python
# CELL ********************
from pyspark.sql import functions as F

# 1. Read conformed Silver tables
df_orders = spark.read.table("lh_sales_silver.orders")
df_customers = spark.read.table("lh_sales_silver.customers")
df_products = spark.read.table("lh_sales_silver.products")

# 2. Multi-table Join & Dimension surrogate keys
df_fact = (
    df_orders.alias("o")
    .join(df_customers.alias("c"), F.col("o.customer_id") == F.col("c.customer_id"), "inner")
    .join(df_products.alias("p"), F.col("o.product_id") == F.col("p.product_id"), "inner")
    .select(
        F.sha2(F.concat_ws("||", F.col("o.order_id"), F.col("o.product_id")), 256).alias("sales_fact_sk"),
        F.col("o.order_id"),
        F.col("c.customer_id"),
        F.col("p.product_id"),
        F.col("o.order_date"),
        F.year("o.order_date").alias("year"),
        F.month("o.order_date").alias("month"),
        F.col("o.quantity"),
        F.col("o.total_amount").alias("revenue"),
        (F.col("o.total_amount") - F.col("p.cost")).alias("profit_margin"),
    )
)

# 3. Partitioned Fact Write (Single-part table name ONLY)
(
    df_fact.write
    .format("delta")
    .mode("overwrite")
    .partitionBy("year", "month")
    .saveAsTable("fact_sales")
)
```
