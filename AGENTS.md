# Fabric AI Studio — Agent Architecture Rules & Behavioral Standards

## 1. Zero Hardcoding & Folder Containment Policy
- **Never hardcode IDs or Names**: All workspace IDs (`ALLOWED_WORKSPACE_ID`), lakehouse names, database names, and tenant configurations must be resolved dynamically from `.env`, `config.json`, or the Microsoft Fabric REST API (`/v1/workspaces`).
- **Default Item Containment**: All newly provisioned Lakehouses, PySpark Notebooks, Data Pipelines, and subfolders must be deployed inside the designated `AI_Test_Folder` (or its subdirectories) to keep the workspace root clean.
- **Dynamic Connector Discovery**: Never use hardcoded `if source == 'sql'` branches. Connectors must be discovered dynamically via `connectors.connector_registry.get_connector()`.
- **Dynamic Schema Inspection**: Always inspect source metadata (`sys.tables`, `information_schema`, or connector `discover_tables()`) instead of assuming column names.

## 2. Medallion Architecture Standards
- **Bronze Layer (`lh_<name>_bronze`)**: Raw, immutable, schema-preserved ingestion from source databases.
- **Silver Layer (`lh_<name>_silver`)**: Cleaned, deduplicated, standardized Delta Lake tables with PySpark `MERGE` upserts on primary keys.
- **Gold Layer (`lh_<name>_gold`)**: Business-level star schema aggregations and semantic models for Power BI.

## 3. SQL & Transpilation Standards
- All SQL transformations from external dialects (T-SQL, Oracle, SAP) must pass through `app/sql_transpiler.py` for AST validation and conversion to native Spark SQL.
- Always generate standard PySpark `DeltaTable.forPath(...).merge(...)` code for incremental tables.

## 4. Blast-Radius Safety & Governance
- Any `DELETE` or `OVERWRITE` operation must pass through `app/impact_analyzer.py`.
- **High-Risk Operations**: Must create an automated Base64 definition snapshot backup in `_deleted_archive/` and require explicit `DELETE <NAME>` confirmation.

## 5. Token Efficiency & Memory
- Adhere to the **10-turn rolling conversation window** and **2,200 token budget cap** in `app/memory.py`.
- Auto-extract user preferences (`preferred_schedule`, `source_database`, `target_lakehouse`) into the SQLite memory store (`fabric_ai_memory.db`).
