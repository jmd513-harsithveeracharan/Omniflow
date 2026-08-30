---
name: fabric_data_quality_and_testing
description: Standards for Delta Lake data quality checks, schema constraint enforcement, anomaly detection, and Great Expectations profiling before promoting data across Medallion layers.
---

# Fabric Data Quality & Testing Playbook

## 1. Multi-Tier Data Quality Rules

1. **Bronze -> Silver Gate**:
   - **Primary Key Uniqueness**: `SELECT count(1) - count(DISTINCT pk_col) FROM table` must equal 0.
   - **Completeness**: Critical business columns (e.g. `order_id`, `customer_id`, `amount`) cannot contain `NULL`.
   - **Timestamps**: All dates must be parseable and within valid temporal boundaries (`1970-01-01` to `current_timestamp() + 1 day`).

2. **Silver -> Gold Gate**:
   - **Referential Integrity**: Foreign keys in Fact tables must exist in corresponding Dimension tables.
   - **Business Rules**: `quantity >= 0`, `unit_price >= 0`.
   - **Drift Detection**: Alert if row volume deviates by > 30% from the 7-day rolling average.

## 2. PySpark Delta Lake Constraints
Apply native Delta Lake constraints directly to Silver tables:
```python
# Add NOT NULL constraint
spark.sql(f"ALTER TABLE {silver_table} CHANGE COLUMN {pk_col} SET NOT NULL")

# Add CHECK constraint
spark.sql(f"ALTER TABLE {silver_table} ADD CONSTRAINT chk_positive_price CHECK (unit_price >= 0)")
```

## 3. Automated Anomaly Logging
Log any quarantined or invalid records into a dedicated `_quarantine` table with rejection reason and ingestion timestamp for governance audits.
