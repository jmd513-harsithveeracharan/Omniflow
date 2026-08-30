---
name: pattern_scd2_history_tracking
description: Enterprise pattern for Slowly Changing Dimensions Type 2 (SCD2) history tracking with start_date, end_date, and is_current flags.
tier: pattern
---

# Pattern: Slowly Changing Dimensions Type 2 (SCD2)

## 1. When to Use
Use SCD2 when business users need to preserve historical attribute changes over time (e.g. customer address changes, sales rep territory reassignments, product price changes).

## 2. Standard Schema Contract
Every SCD2 Delta table must include these 4 system tracking columns:
1. `_surrogate_key` (String / UUID / Hash)
2. `_valid_from` (Timestamp): Date when the record became active.
3. `_valid_to` (Timestamp): Date when superseded (`9999-12-31 23:59:59` if currently active).
4. `_is_current` (Boolean): `True` for active row, `False` for historical version.

## 3. PySpark SCD2 Merge Implementation
```python
from pyspark.sql.functions import col, lit, current_timestamp, sha2, concat_ws

# 1. Flag records that have changed attribute values
# 2. Close out active record (_valid_to = current_timestamp(), _is_current = False)
# 3. Insert new record version (_valid_from = current_timestamp(), _valid_to = '9999-12-31', _is_current = True)
```
