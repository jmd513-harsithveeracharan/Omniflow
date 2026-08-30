# Product Roadmap: Standalone Fabric AI Studio
**Autonomous Medallion Architecture Engine, Self-Healing Workbench & Agentic Data Engineering Platform**  
*Document Version: 3.2.0 | Release Horizon: 2026 – 2028 | Classification: Strategic Architecture Blueprint*

---

## 1. Executive Summary & Strategic Vision

### 1.1 Mission Statement
Fabric AI Studio is an autonomous, agentic data engineering platform engineered specifically for Microsoft Fabric. It transforms natural-language architectural intent into production-grade Medallion (Bronze/Silver/Gold) lakehouses, optimized PySpark Delta Lake notebooks, AST-transpiled SQL logic, and sequenced Data Factory pipelines with **Self-Healing runtime error recovery, Self-Skilling knowledge evolution, and strict blast-radius governance.**

### 1.2 Core Architectural Pillars
* **Zero Hardcoding & Strict Folder Containment:** Dynamic resolution of all Workspace GUIDs, Lakehouse paths (`abfss://`), and connectors. All newly provisioned items and subfolders deploy strictly inside `AI_Test_Folder` to keep the workspace root 100% clean.
* **Dual-Model Resilient Waterfall:** Combines Google **Gemini 3.6 Flash & 2.5 Pro (2,000,000 token context window)** for deep multi-table schema reasoning with **Groq (350+ tokens/sec)** as an ultra-fast resilient failover tier.
* **Self-Healing Closed-Loop Engine:** Intercepts Spark runtime exceptions (`AnalysisException`, `SchemaMismatch`), diagnoses AST lineage, hot-patches notebook definitions via Base64 payload updates, and reruns jobs automatically without human intervention.
* **2-Tier Skill Architecture (Atomic + Solution Patterns):** A modular library of **12 Atomic Artifact Skills** (granular CRUD for every Fabric item) and **18 Solution Patterns** (high-level Medallion, CDC, and ERP architectures).
* **Self-Skilling & Automated OpenAPI Re-Skilling:** Automated OpenAPI/Swagger drift probing against Microsoft Fabric monthly release trains, dynamically synthesizing and updating `.agents/skills/` runbooks when Microsoft updates API specs.
* **Curated In-Context Grounding (<1ms Latency):** Replaces slow/noisy live web searching with instant local Fabric API specifications and live schema reflection, with web search as an on-demand fallback for unreleased previews.
* **Blast-Radius Safety & Immutable Archiving:** High-risk operations (overwrites, deletions) trigger automated Base64 item definition snapshots in `_deleted_archive/{timestamp}/` with strict confirmation gates.

---

## 2. Multi-Horizon Architecture Roadmap

```
2026 Q1 - Q2               2026 Q3 - Q4               2027 Q1 - Q2               2027 Q3 - Q4               2028+
┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐     ┌────────────────────┐
│ PHASE 1:           │     │ PHASE 2:           │     │ PHASE 3:           │     │ PHASE 4:           │     │ PHASE 5:           │
│ Hybrid Brain,      │────>│ Visual Studio, DAG │────>│ Self-Healing Spark │────>│ Automated Re-Skill │────>│ GitOps CI/CD &     │
│ Skills & Containment│    │ & Live Operations  │     │ & AST Transpiler   │     │ & Enterprise Sec   │     │ Multi-Tenant Fleet │
└────────────────────┘     └────────────────────┘     └────────────────────┘     └────────────────────┘     └────────────────────┘
```

---

## Phase 1: Hybrid Intelligence, 2-Tier Skill Architecture & Memory (v2.0 – v2.5)
*Target: Q1 2026 | Focus: Gemini 2M Context + Groq Waterfall, 2-Tier Skill Engine, Strict Folder Containment*

### 1.1 Multi-Provider Resilient Waterfall Routing Engine (`app/llm_router.py`)
- **Primary Flagship Reasoning Tier:** Google **Gemini 3.6 Flash & Gemini 2.5 Pro** utilizing massive **2,000,000 token context window** to ingest enterprise warehouse schemas (500+ tables) in a single turn without truncation.
- **Ultra-Fast Fallback Tier:** **Groq `openai/gpt-oss-120b` (350+ tokens/sec)** for sub-second parsing, intent routing, and resilient failover during cloud rate-limit bursts.
- **Extended Flagship Tier:** Anthropic `claude-3-7-sonnet` and OpenAI `gpt-4o` configurable adapters.
- **JSON Schema Strict Mode & Code Fence Stripper:** Multi-line markdown fence normalization ensuring valid JSON parsing across all model providers.
- **Windows UTF-8 Console Hardening:** System stream re-configuration eliminating `cp1252` encoding crashes on special lineage symbols (`→`, `•`, `✓`, `[OK]`).

### 1.2 The 2-Tier Skill Architecture (`.agents/skills/`)
- **Tier 1: 12 Atomic Artifact Skills (Granular Item Lifecycle):**
  1. `fabric_pipeline_ops`: Provisioning, Activity DAG JSON, Triggers, Parameters, Monitoring, Deletion.
  2. `fabric_notebook_ops`: Provisioning, IPYNB Base64 definition, Spark compute sizing, Dependencies.
  3. `fabric_lakehouse_ops`: Provisioning, Delta tables, SQL Endpoints, Shortcuts, Maintenance.
  4. `fabric_warehouse_ops`: T-SQL DDL, Views, Stored Procedures, Cross-DB Querying, Permissions.
  5. `fabric_semantic_model_ops`: TMSL definitions, Direct Lake tables, Measures, Row-Level Security.
  6. `fabric_environment_ops`: Spark compute pools, PyPI packages, Custom wheels, Core sizing.
  7. `fabric_kql_eventhouse_ops`: Streaming tables, KQL queries, Real-Time ingestion policies.
  8. `fabric_data_agent_ops`: Fabric Copilot Agent definitions, tool bindings, instruction grounding.
  9. `fabric_folder_governance_ops`: Folders, `AI_Test_Folder` containment, Item moves, Access ACLs.
  10. `fabric_git_and_cicd_ops`: Fabric Git sync, commit status, Deployment pipeline stages.
  11. `fabric_user_data_functions_ops`: UDF registration, Spark scalar/vector functions.
  12. `fabric_rest_api_client_ops`: Bearer auth, LRO polling, Workspace discovery, Swagger specs.

- **Tier 2: 18 Solution Pattern Skills (High-Level Architecture Assembly):**
  1. `pattern_medallion_architecture`: Bronze ➔ Silver ➔ Gold multi-lakehouse assembly.
  2. `pattern_incremental_cdc_watermark`: High-watermark extraction, Delta MERGE, deduplication.
  3. `pattern_scd2_history_tracking`: Slowly Changing Dimensions Type 2 (start/end date validity).
  4. `pattern_sap_and_erp_ingestion`: SAP BAPI / RFC hierarchical struct extraction & explode.
  5. `pattern_sqlglot_ast_transpilation`: T-SQL / Oracle / Postgres ➔ Spark SQL AST conversion.
  6. `pattern_data_quality_testing`: Great Expectations assertions, Delta check constraints.
  7. `pattern_spark_performance_tuning`: Z-Ordering, Liquid Clustering, broadcast joins.
  8. `pattern_error_handling_self_healing`: Spark runtime exception interception & hot-patching.
  9. `pattern_blast_radius_safe_delete`: Snapshot backups in `_deleted_archive/`, deletion confirmation.
  10. `pattern_directlake_powerbi_bi`: Star-Schema DAX measures, Direct Lake performance.
  11. `pattern_streaming_eventhouse_kql`: Real-time event streams, KQL ingestion & alerting.
  12. `pattern_audit_and_lineage_tracking`: Column-level data lineage, audit columns (`_ingested_at`).
  13. `pattern_cross_workspace_shortcuts`: OneLake shortcut federation across Fabric workspaces.
  14. `pattern_rest_api_drift_re_skilling`: Automated OpenAPI Swagger diff checking & self-updating.
  15. `pattern_api_pagination_batching`: Chunked REST API pagination for large dataset ingestion.
  16. `pattern_schema_drift_evolution`: mergeSchema / overwriteSchema dynamic adaptation.
  17. `pattern_security_and_rls`: Row-Level Security, Column-Level masking in Delta/Warehouse.
  18. `pattern_scheduled_orchestration`: Multi-pipeline dependencies, CRON triggers, Webhooks.

### 1.3 Multi-Stage Dynamic Skill Router (`app/skill_loader.py`)
- **Stage 1 (Triage Router):** Lightweight 0.1s classification reading only skill names and descriptions to output `required_skills`.
- **Stage 2 (Skill Loader):** Reads only selected markdown files into context (0.001s), reducing token usage by 90%.
- **Stage 3 (Specialized Worker):** Passes loaded skill context to Gemini 3.6 Flash / 2.5 Pro for surgical code generation.

### 1.4 Strict Folder Containment Policy (`AGENTS.md`)
- **Zero Root Pollution:** All newly provisioned Lakehouses, PySpark Notebooks, Data Pipelines, and subfolders must deploy strictly inside `AI_Test_Folder` (or its subdirectories).
- **Workspace Locking:** Bound dynamically to `ALLOWED_WORKSPACE_ID` (`PBT_DATA_AGENT`).

---

## Phase 2: Visual Workbench & Live Operations (v2.6 – v2.9)
*Target: Q2 2026 | Focus: Interactive Visual DAGs, Multi-Notebook Code Selector, Live Stream Monitoring*

### 2.1 Visual Canvas DAG Engine (`flow_renderer.js`)
- **Interactive SVG/Canvas Renderer:** Dynamic multi-tier graph rendering:
  - Root Folder Node (`AI_Test_Folder`)
  - Lakehouse Nodes (`lh_bronze`, `lh_silver`, `lh_gold`) with Medallion color coding
  - PySpark Notebook Nodes (`nb_ingest`, `nb_transform`, `nb_gold`) with dependency links
  - Data Factory Pipeline Activity Nodes (`pl_root`)
- **Live Node State Machine:** Interactive status transitions: `pending` (gray outline) ➔ `running` (glowing cyan pulse) ➔ `live` (solid emerald) ➔ `failed` (crimson warning).
- **Activity Inspector Drawer:** Click-to-inspect side panel displaying runtime properties, input/output paths, attached storage accounts, and notebook parameters.

### 2.2 Multi-Notebook Code Studio & Schema View
- **Multi-Notebook Selector:** Dynamic dropdown (`#wbNotebookSelect`) allowing seamless switching between all generated notebooks in a multi-tier deployment (`nb_ingest_bronze`, `nb_clean_silver`, `nb_build_gold`, `nb_orchestrator`).
- **Grounded Schema View:** Replaces placeholder matrix tables with real structured table definitions (`orders`, `customers`, `fact_sales`) dynamically matching the selected Lakehouse layer.
- **One-Click Code Export:** High-speed syntax-highlighted editor with instant clipboard copying and `.ipynb` / `.py` bundle downloads.

### 2.3 Operations Live Execution Stream
- **Dedicated Operations Section:** Eliminates popup modals by routing deployment execution directly into **OPERATIONS ➔ Live Execution** (`#viewMonitoring`).
- **Real-Time Step Progression:** Live visual cards showing step-by-step progress:
  1. Workspace Folder Verification & Containment Check
  2. Lakehouse Provisioning & Default Schema Binding
  3. PySpark Notebook Base64 Compilation & Upload
  4. Data Factory Pipeline DAG Linking & Schedule Binding

---

## Phase 3: Self-Healing Spark Engine & AST Transpiler (v3.0 – v3.2)
*Target: Q3 2026 | Focus: Spark Runtime Exception Interception, Definition Hot-Patching, SQLGlot AST Engine*

### 3.1 Closed-Loop Self-Healing Engine
- **Runtime Telemetry Interception:** Captures live execution failures from `get_job_status()` and Spark Livy logs (e.g. `AnalysisException: Cannot resolve column 'order_date' due to data type mismatch`).
- **AST Stack Trace Diagnosis:** Analyzes source-to-target column lineage to identify root cause (e.g., missing typecast, null constraint violation, partitioning syntax error).
- **Definition Hot-Patching:** Rewrites the failing PySpark cell, compiles a fresh Base64 payload, pushes `update_definition()` to Microsoft Fabric, and automatically reruns the pipeline from the failed node.
- **Remediation Audit Log:** Records all automated fixes into SQLite memory (`fabric_ai_memory.db`) and displays a remediation card in the Web UI.

### 3.2 SQLGlot AST Transpilation Engine (`app/sql_transpiler.py`)
- **18 Source Dialect Transpilation:** Automated AST parsing and conversion from T-SQL, Oracle PL/SQL, Snowflake, PostgreSQL, and SAP OpenSQL into optimized Apache Spark SQL.
- **Dialect Idiom Mapping:**
  - T-SQL `TOP (N)` ➔ Spark SQL `LIMIT N`
  - T-SQL `ISNULL(a, b)` ➔ Spark SQL `COALESCE(a, b)`
  - Oracle `NVL2(a, b, c)` ➔ Spark SQL `CASE WHEN a IS NOT NULL THEN b ELSE c END`
  - T-SQL `DATEDIFF(day, a, b)` ➔ Spark SQL `DATEDIFF(DAY, CAST(a AS TIMESTAMP), CAST(b AS TIMESTAMP))`
- **Column-Level Lineage Extractor:** AST traversal extracting source tables, target tables, and mapped column mutations for automated documentation.

### 3.3 Automated PySpark Delta MERGE & SCD2 Synthesizer
- **Idempotent Incremental Upserts:** Standardized PySpark code generator producing production-ready Delta MERGE statements:
  ```python
  from delta.tables import DeltaTable
  target_table = DeltaTable.forPath(spark, target_lakehouse_path)
  (
      target_table.alias("tgt")
      .merge(source_df.alias("src"), "tgt.primary_key = src.primary_key")
      .whenMatchedUpdateAll(condition="src.updated_at > tgt.updated_at")
      .whenNotMatchedInsertAll()
      .execute()
  )
  ```
- **SCD Type 2 History Tracking:** Automated generation of `is_current`, `valid_from`, and `valid_to` date-tracking partitions.

---

## Phase 4: Self-Skilling & Automated OpenAPI Re-Skilling (v3.3 – v3.6)
*Target: Q4 2026 | Focus: Swagger Drift Detection, Autonomous Skill Synthesis, Blast-Radius Governance*

### 4.1 Automated OpenAPI / Swagger Re-Skilling Engine (`scripts/fabric_api_drift_probe.py`)
- **Monthly Release Train Probe:** Background probe comparing local `app/fabric_compiler.py` and `.agents/skills/` against Microsoft's official Fabric OpenAPI spec (`https://api.fabric.microsoft.com/v1/openapi.json`).
- **Autonomous Skill Re-Synthesizer:** Automatically generates or updates `.agents/skills/atomic/<skill>/SKILL.md` when Microsoft updates item payload definitions or REST query parameters.
- **Zero-Day Sandbox Testing:** Deploys a test item into `AI_Test_Folder` to verify `200 OK` before committing the updated skill into the repository.

### 4.2 Blast-Radius Impact Analyzer (`app/impact_analyzer.py`)
- **Operation Risk Classification:**
  - **LOW RISK:** Creating items in `AI_Test_Folder`, adding nullable columns, updating notebook descriptions.
  - **MEDIUM RISK:** Modifying existing data types, altering primary keys, modifying pipeline schedules.
  - **HIGH RISK:** Overwriting Delta tables, dropping Lakehouses, deleting folders, truncating partitions.
- **Automated Base64 Definition Snapshots:** Prior to any high-risk modification or deletion, the system takes an automated snapshot of the item's complete Fabric definition and archives it to `_deleted_archive/{item_id}_{timestamp}.json`.
- **Confirmation Phrase Enforcement:** High-risk actions enforce exact user phrase typing (e.g., `DELETE LH_RETAIL_BRONZE`) before executing against Fabric REST endpoints.

---

## Phase 5: GitOps, Direct Lake Semantic Models & Multi-Tenant Fleet (v4.0+)
*Target: 2027 – 2028 | Focus: Power BI Direct Lake TMSL, Fabric Git Integration (.pbip), Capacity Optimization*

### 5.1 Power BI Direct Lake Semantic Model Generator
- **TMSL & Tabular Model Definition Language:** Automatic generation of Fabric Semantic Models pointing directly to Gold Lakehouse Delta tables without data movement or import mode latency.
- **DAX Measure Synthesis:** Generates standardized DAX KPI measures (YoY Growth, MTD, Customer Lifetime Value).

### 5.2 Native Microsoft Fabric Git Integration
- **Git Sync Provider:** Bidirectional synchronization between Fabric AI Studio and corporate Git repositories (Azure DevOps / GitHub).
- **Item Serializers:**
  - Fabric Notebooks serialized to native `.ipynb` / `.py` format in `notebook/` repository folders.
  - Data Pipelines serialized to `pipeline-content.json`.
  - Lakehouse schemas serialized to declarative DDL scripts.

---

## 3. Comprehensive Feature Matrix & Milestone Deliverables

| Module | Feature | Target Phase | Status | Primary Tech Stack |
| :--- | :--- | :--- | :--- | :--- |
| **Hybrid Brain** | Gemini 3.6 Flash / 2.5 Pro (2M Context) + Groq Waterfall | Phase 1 | ✅ **Live** | Python, Gemini API, Groq API |
| **Skill Engine** | 2-Tier Skill Architecture (12 Atomic + 18 Solution Patterns) | Phase 1 | ✅ **Live** | Markdown, YAML, Skill Loader |
| **Governance** | Strict `AI_Test_Folder` Containment & Snapshot Archives | Phase 1 | ✅ **Live** | Python, Base64, Fabric REST API |
| **Memory Engine** | Squeeze Straw 3-Tier Progressive Compression | Phase 1 | ✅ **Live** | SQLite, Python re, Token Budget |
| **Visual Canvas** | Interactive Live DAG with State Machine | Phase 2 | ✅ **Live** | Vanilla JS, HTML5 SVG Canvas |
| **PySpark Studio** | Multi-Notebook Selector & Editor | Phase 2 | ✅ **Live** | JavaScript, Prism.js / CodeMirror |
| **Operations** | Dedicated Live Execution Timeline Stream | Phase 2 | ✅ **Live** | Server-Sent Events, REST Polling |
| **SQL Engine** | SQLGlot 18-Dialect AST Transpiler & Lineage | Phase 3 | ✅ **Live** | SQLGlot, Python AST |
| **Self-Healing** | Spark Runtime Interception & Definition Hot-Patching | Phase 3 | 🔄 **Active** | PySpark, Fabric Job API, AST |
| **Delta Engine** | Idempotent PySpark MERGE & SCD2 Synthesizer | Phase 3 | ✅ **Live** | Delta Lake, PySpark |
| **Re-Skilling** | Automated OpenAPI Swagger Drift Detection Probe | Phase 4 | 🔄 **Active** | Requests, OpenAPI Schema, Diff |
| **Direct Lake** | Power BI Direct Lake TMSL Semantic Models | Phase 5 | 📅 Planned | TMSL, DAX, Fabric API |
| **GitOps** | Fabric Git Integration (.pbip / GitHub / ADO) | Phase 5 | 📅 Planned | GitPython, Azure DevOps API |

---

## 4. Key Performance Indicators (KPIs) & Quality Metrics

1. **Synthesis Speed:** End-to-end Medallion plan generation (3 Lakehouses, 3 PySpark notebooks, 1 Data Pipeline) under **2.5 seconds** on Groq 120B / Gemini 3.6 Flash.
2. **Context Budget Compliance:** Conversational prompt context strictly contained under **2,200 tokens** regardless of 50+ conversation turns.
3. **Deployment Containment:** **100% of generated items and subfolders** deployed strictly within `AI_Test_Folder` with zero root workspace pollution.
4. **Self-Healing Resilience:** Automated stack trace diagnosis and definition hot-patching resolving **90%+ of runtime compilation errors** without human intervention.
5. **Zero Data Egress:** All heavy data transformations run directly inside Microsoft Fabric Synapse Spark clusters on OneLake; zero customer payload rows transmitted through AI inference streams.
