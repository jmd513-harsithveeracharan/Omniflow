---
name: sql_transpilation_and_lineage
description: Guidelines for transpiling source SQL dialects (T-SQL, Oracle, SAP) into Spark SQL using SQLGlot AST engine, extracting column-level lineage, and validating queries before PySpark notebook generation.
---

# SQL Transpilation & Lineage Extraction Playbook

## 1. Dialect Conversion Rules (T-SQL -> Spark SQL)
- `ISNULL(x, y)` -> `COALESCE(x, y)`
- `TOP 10 ...` -> `... LIMIT 10`
- `GETDATE()` -> `CURRENT_TIMESTAMP()`
- `DATEADD(day, -7, col)` -> `DATE_SUB(col, 7)`
- `DATEDIFF(day, start, end)` -> `DATEDIFF(end, start)`

## 2. AST Validation Procedure
Before writing SQL queries into Fabric PySpark notebooks:
1. Run `sqlglot.parse(sql, read=source_dialect)`.
2. Verify there are no unparseable tokens or missing parentheses.
3. Check that no dangerous DDL statements (`DROP TABLE`, `TRUNCATE`) exist unless explicitly authorized.

## 3. Column-Level Lineage Extraction
Extract table dependencies and column mappings to construct the DAG edges:
- Source Table -> Notebook Transform -> Target Delta Table.
- Display column transformations in the Ingestion Studio visual viewer.
