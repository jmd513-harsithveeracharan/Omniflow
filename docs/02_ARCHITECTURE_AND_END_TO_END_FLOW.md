# 02. Architecture & End-to-End Execution Flow

---

## 1. High-Level System Architecture

Fabric AI follows a strict **Separation of Concerns** architecture:
* **The Control Plane (Agent & Studio):** Operates entirely on **metadata** (table names, schemas, primary keys, timestamps) and handles prompt parsing, visual flow DAG rendering, item definition compilation, and REST API orchestration.
* **The Data Plane (Customer Cloud Tenant):** All actual data movement, storage, transformation, and query processing occur **100% inside the customer's own cloud environment** (Microsoft Fabric OneLake, Databricks Unity Catalog, or Snowflake).

```
                                    ┌────────────────────────────────────────┐
                                    │          USER / DEVELOPER              │
                                    └───────────────────┬────────────────────┘
                                                        │ Natural Language Request / Source Select
                                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                             FABRIC AI CONTROL PLANE (AGENT)                                          │
│                                                                                                                      │
│  ┌───────────────────────┐   ┌───────────────────────────┐   ┌───────────────────────────┐   ┌────────────────────┐  │
│  │ 1. Skill Discovery    │──►│ 2. Metadata Discovery     │──►│ 3. Strategy Classifier    │──►│ 4. Item Compiler   │  │
│  │    & Generation       │   │    (Zero Data Access)     │   │    (Full vs. Incremental) │   │    (Base64 Specs)  │  │
│  │    (skills/*.md)      │   │    (connectors/*.py)      │   │    (ingestion_planner.py) │   │    (engine.py)     │  │
│  └───────────────────────┘   └───────────────────────────┘   └─────────────┬─────────────┘   └─────────┬──────────┘  │
│             ▲                                                              │                           │             │
│             │ HITL Checkpoint 1 (Skill Approval)                           │ HITL Checkpoint 2         │             │
│             └──────────────────────────────────────────────────────────────┴─── (Strategy Matrix)       │             │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┼─────────────┘
                                                                                                         │ REST API
                                                                                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    CUSTOMER DATA PLANE (MICROSOFT FABRIC / CLOUD)                                    │
│                                                                                                                      │
│  ┌─────────────────┐       ┌──────────────────────┐       ┌────────────────────────┐       ┌──────────────────────┐  │
│  │ Workspace Folder│──────►│ Lakehouse (lh_bronze)│──────►│ PySpark Notebooks      │──────►│ DataPipeline         │  │
│  │ (Target Source) │       │ (Delta Lake Tables)  │       │ (Delta Merge Logic)    │       │ (Scheduled Trigger)  │  │
│  └─────────────────┘       └──────────────────────┘       └────────────────────────┘       └──────────┬───────────┘  │
└───────────────────────────────────────────────────────────────────────────────────────────────────────┼──────────────┘
                                                                                                        │ Job Execution
                                                                                                        ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         MONITORING & CLOSED-LOOP SELF-HEALING                                        │
│                                                                                                                      │
│  ┌─────────────────────────┐       ┌────────────────────────┐       ┌────────────────────────┐       ┌────────────┐  │
│  │ Job Telemetry Poller    │──────►│ Error Traceback Parser │──────►│ LLM Remediation Agent  │──────►│ Patch &    │  │
│  │ (GET /jobs/instances)   │       │ (Exception Analyzer)   │       │ (Targeted Code Fixer)  │       │ Redeploy   │  │
│  └─────────────────────────┘       └────────────────────────┘       └───────────┬────────────┘       └────────────┘  │
│                                                                                 │                                    │
│                                                                                 ▼ Low Confidence / Max Retry         │
│                                                                     ┌────────────────────────┐                       │
│                                                                     │ HITL Checkpoint 3      │                       │
│                                                                     │ (Human Escalation)     │                       │
│                                                                     └────────────────────────┘                       │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The 10-Step End-to-End Execution Flow

When a user initiates an ingestion request (e.g., *"Ingest my sales and customer data from Salesforce into a Bronze Medallion Lakehouse"*), the system executes through the following 10 sequential phases:

```
[ Step 1: User Request ] 
          │
          ▼
[ Step 2: Source Identification ] 
          │
          ▼
[ Step 3: Skill Discovery / Generation ] ──► (HITL Checkpoint 1: Skill Review if new)
          │
          ▼
[ Step 4: Credential Scaffolding ] ───────► (HITL Checkpoint 2: Key Vault Secret Name Input)
          │
          ▼
[ Step 5: Metadata Scan & Analysis ] ─────► (Zero data rows read; INFORMATION_SCHEMA only)
          │
          ▼
[ Step 6: Ingestion Strategy Matrix ] ────► (HITL Checkpoint 3: Full vs. Incremental Approval)
          │
          ▼
[ Step 7: Fabric Item Compilation ] ──────► (Base64 JSON / PySpark / .platform generation)
          │
          ▼
[ Step 8: Direct REST API Deployment ] ───► (Folders, Lakehouses, Notebooks, Pipelines)
          │
          ▼
[ Step 9: Pipeline Execution & Monitor ] ──► (Job Status Polling via REST API)
          │
          ▼
[ Step 10: Closed-Loop Self-Healing ] ────► (Auto-patches minor errors; escalates major issues)
```

---

## 3. Subsystem Breakdown & Component Architecture

### 1. The Intent & Orchestration Hub
* **Files:** [server.py](file:///c:/Harsith_Work/Fabric_AI/server.py), [groq_llm.py](file:///c:/Harsith_Work/Fabric_AI/groq_llm.py)
* **Function:** Receives user prompts, interacts with LLM reasoning engines (Claude Sonnet / GPT Flagship / Groq Llama), extracts entity targets, and coordinates background deployment threads.
* **Endpoints:**
  - `POST /api/architect/plan`: Generates full architecture plans without deploying.
  - `POST /api/ingestion/plan`: Generates connector-specific ingestion plans and visual DAG nodes.
  - `POST /api/ingestion/deploy`: Triggers asynchronous cloud provisioning in background threads.
  - `GET /api/ingestion/status/<run_id>`: Returns live execution state and progress logs.

### 2. The Connector & Metadata Engine
* **Files:** [connectors/base_connector.py](file:///c:/Harsith_Work/Fabric_AI/connectors/base_connector.py), [connectors/connector_registry.py](file:///c:/Harsith_Work/Fabric_AI/connectors/connector_registry.py)
* **Function:** Implements stateless metadata discovery drivers for source systems.
* **Enforced Contract:**
  - `test_connection(params)`: Validates endpoint accessibility.
  - `discover_tables(params)`: Lists available database tables and views.
  - `get_schema(table, params)`: Extracts column names, data types, and nullability.
  - `generate_pyspark_ingest_code()`: Emits target-specific Delta Lake read/merge logic.

### 3. The Ingestion Planner & Strategy Classifier
* **File:** [ingestion_planner.py](file:///c:/Harsith_Work/Fabric_AI/ingestion_planner.py)
* **Function:** 
  - Natural language schedule parsing (`"run nightly at 2am"` ➔ `cron: "0 2 * * *"`).
  - Classifies tables into **Full Load** vs. **Incremental Load** based on watermark timestamps and primary keys.
  - Generates SVG DAG nodes (`flow_nodes`) and edge connections (`flow_edges`) for visual rendering.

### 4. The Fabric Item Compiler & Deployment Engine
* **File:** [fabric_ai_engine.py](file:///c:/Harsith_Work/Fabric_AI/fabric_ai_engine.py)
* **Function:**
  - Retrieves live Azure OAuth Bearer tokens via Azure CLI (`az account get-access-token --resource https://api.fabric.microsoft.com`).
  - Enforces workspace isolation locks (`ALLOWED_WORKSPACE_ID`).
  - Serializes item definitions into Fabric's standard Base64 multi-part format (`item.metadata.json`, `notebook-content.py`, `pipeline-content.json`, `environment.yml`, `.platform`).
  - Calls Microsoft Fabric REST API v1.0 (`POST /v1/workspaces/{id}/items` and `/updateDefinition`).

### 5. The Visual Flow Studio Frontend
* **Files:** [index.html](file:///c:/Harsith_Work/Fabric_AI/index.html), [app.js](file:///c:/Harsith_Work/Fabric_AI/app.js), [flow_renderer.js](file:///c:/Harsith_Work/Fabric_AI/flow_renderer.js), [style.css](file:///c:/Harsith_Work/Fabric_AI/style.css)
* **Function:** Interactive web UI featuring:
  - Bolt.new-inspired prompt studio.
  - Real-time SVG visual DAG canvas with animated status pulses.
  - Live workspace audit view fetching actual items from Microsoft Fabric.
  - Interactive Strategy Matrix review modal.

---

## 4. Security Guardrails & Workspace Isolation

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ WORKSPACE ISOLATION LOCK                                                              │
│ Config File: config.json                                                              │
│ Allowed Workspace: PBT_DATA_AGENT (ID: db7344c1-ecd9-44d6-849f-f2de49484f9f)          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

1. **Hard Security Guardrail:** In [fabric_ai_engine.py](file:///c:/Harsith_Work/Fabric_AI/fabric_ai_engine.py), the `assert_workspace_security(target_ws_id)` function immediately raises a `SecurityError` if any API call attempts to operate on a workspace outside the whitelisted target.
2. **Zero Plaintext Secrets in Code:** PySpark notebooks retrieve secrets at runtime via `notebookutils.credentials.getSecret()`. Secrets are never stored in code, git commits, or LLM context.
3. **Metadata-Only Ingestion:** Database queries executed by the Agent's connectors only query system catalogs (`INFORMATION_SCHEMA.COLUMNS`, `sys.tables`, Salesforce `describeObjects`), ensuring zero exposure of underlying business data.
