# OmniFlow Enterprise Multi-Agent Architecture, Dynamic Context Engine & Execution Walkthrough

---

## 1. Executive Summary & Architecture Philosophy

### 1.1 The Problem with Legacy AI Agent Swarms
Most legacy "AI agent" systems suffer from three fatal design flaws:
1. **Hardcoded Agent Classes & Prompt Clutter**: Each agent is an inflexible, static Python class with hundreds of lines of hardcoded prompts and rigid if-else logic.
2. **Context Exhaustion & Hallucination**: The system blindly dumps the entire enterprise catalog (schemas of 40–50+ tables, hundreds of columns, and full database dumps) into the initial LLM prompt. This wastes tens of thousands of tokens, blows rate limits, causes the LLM to lose focus, and triggers hallucinations.
3. **Black-Box Disconnection from Platform Realities**: The AI executes outside the actual data platform, generating theoretical code without validating whether required tools exist, whether AST syntax passes security guardrails, or whether the cloud environment has available capacity.

### 1.2 The OmniFlow Architecture Solution
OmniFlow solves these flaws with a clean, decoupled, enterprise-grade architecture:
- **Dynamic Database Registry**: Agents, tools, and bindings are **first-class records in PostgreSQL**. There are no static, copy-pasted agent classes. Every agent is dynamically loaded at runtime with its prompt, LLM provider, and assigned tools.
- **Two-Tier Context Hierarchy (JIT Subgraph Hydration)**:
  - *Tier 1 (Macro Planning)*: The Planner queries only high-level **Standards, Policies, Architectural Decision Records (ADRs), and Constraints**. It does *not* load detailed table schemas because lakehouses and delta tables do not exist yet in greenfield planning.
  - *Tier 2 (Granular Step Execution)*: Once candidate tables are discovered, the system queries only the **1-hop active subgraph** (~85 tokens) containing exact primary keys, column data types, PII flags, and active foreign key relationships.
- **Autonomous Tool Synthesis & Self-Healing**: When a plan requires a capability not yet present in the platform, a dedicated Research Agent synthesizes the Python tool code, runs AST security checks, writes it to disk, and registers it in PostgreSQL—all in milliseconds without human downtime.
- **Durable Audit & Observability**: Every single agent run, plan phase, task dependency, tool invocation latency, generated artifact hash, and quality compliance check is committed to live PostgreSQL tables (`runs`, `agent_runs`, `tasks`, `tool_runs`, `artifacts`, `audit_findings`).

```
+----------------------------------------------------------------------------------------------------+
|                                    OMNIFLOW ORCHESTRATION PIPELINE                                 |
+----------------------------------------------------------------------------------------------------+
                                                  │
                                                  ▼
                               +──────────────────────────────────────+
                               |     1. Enterprise Intake Seeder      |
                               |  (catalog_seeder.py -> PostgreSQL)   |
                               +──────────────────────────────────────+
                                                  │
                                                  ▼
                               +──────────────────────────────────────+
                               |        2. Planner Agent (2-Pass)     |
                               |     Pass 1: Macro Roadmap (PH-1..4)  |
                               |     Pass 2: Granular Steps (STEP-1..6|
                               |  - search_database_catalog_tool      |
                               |  - get_table_schema_and_lineage_tool |
                               |  - query_governance_policies_tool    |
                               |  - query_project_memory_tool         |
                               |  - query_standards_tool              |
                               +──────────────────────────────────────+
                                                  │
                                                  ▼
                               +──────────────────────────────────────+
                               |       3. Task Organizer Agent        |
                               |    NetworkX DAG -> Topo Sort -> Wave |
                               |    Critical Path -> 'tasks' table    |
                               +──────────────────────────────────────+
                                                  │
                                                  ▼
                               +──────────────────────────────────────+
                               |       4. Tool Checker Agent          |
                               |     Pass 1: Audit 'tools' table      |
                               +──────────────────────────────────────+
                                                  │
                                         [Missing Tools?]
                                        /                \
                                     YES                  NO
                                     /                      \
                                    ▼                        │
         +──────────────────────────────────────+            │
         |      5. Research & Creator Agent     |            │
         |   AST Security Check -> Code Gen ->  |            │
         |   Write File -> Register in DB       |            │
         +──────────────────────────────────────+            │
                                    │                        │
                                    ▼                        │
         +──────────────────────────────────────+            │
         |       Tool Checker Agent (Pass 2)    |            │
         |      Verify 100% Tools Ready         |            │
         +──────────────────────────────────────+            │
                                    │                        │
                                    └────────────┬───────────┘
                                                 │
                                                 ▼
                               +──────────────────────────────────────+
                               |       6. Worker / Executor Agent     |
                               |   Traverse DAG in topological order  |
                               |   Execute bound tools -> Artifacts   |
                               |   Commit SHA256 hashes to PostgreSQL |
                               +──────────────────────────────────────+
                                                 │
                                                 ▼
                               +──────────────────────────────────────+
                               |      7. Quality Auditor Agent        |
                               |   AST Check + SHA-256 PII Audit      |
                               |   Write to 'audit_findings' table    |
                               +──────────────────────────────────────+
                                                 │
                                                 ▼
                               +──────────────────────────────────────+
                               |   8. Fabric Cloud Deployment Gate    |
                               |   Live Azure CLI REST verification   |
                               +──────────────────────────────────────+
```

---

## 2. The 6 Production Agents in the System

Every agent is defined in the PostgreSQL database in the `agents` table and dynamically loaded via the generic class wrapper `DynamicAgentRuntime`.

| # | Agent Name | DB `agent_name` | Model / Provider | Primary Responsibility | Bound Tools |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **1** | **Architectural Planner Agent** | `planner_agent` | `gpt-4o` / Azure OpenAI | Ingests project brief, queries catalog, lineage, policies, ADRs, constraints, and engineering standards. Generates Pass 1 Macro Roadmap and Pass 2 Granular Steps. | `search_database_catalog_tool`, `get_table_schema_and_lineage_tool`, `query_governance_and_compliance_policies_tool`, `query_project_memory_and_decisions_tool`, `query_standards_tool` |
| **2** | **DAG Task Organizer Agent** | `task_organizer_agent` | `gpt-4o` / Azure OpenAI | Parses planned steps into a `NetworkX` Directed Acyclic Graph (`nx.DiGraph`). Verifies acyclicity, calculates parallel execution waves, extracts critical path, and assigns database UUIDs. | `validate_dag_tool` |
| **3** | **Tool Checker Agent** | `tool_checker_agent` | `gpt-4o-mini` / Azure OpenAI | Audits every step in the DAG against the PostgreSQL `tools` table and Python runtime. Emits an availability scorecard and flags missing tools. | `check_capacity_status_tool`, `ping_gateway_tool` |
| **4** | **Research & Tool Creator Agent** | `research_agent` | `gpt-4o` / Azure OpenAI | Autonomous tool synthesizer. Triggered when tools are missing. Performs AST code validation, writes executable Python code to disk, and binds the new tool to PostgreSQL. | *(Self-reflective tool synthesizer)* |
| **5** | **Worker & Artifact Executor Agent** | `executor_agent` | `gpt-4o` / Azure OpenAI | Executes tasks in topological order. Intercepts tool calls, captures execution latency, writes formatted artifacts to disk, and commits SHA-256 hashes to `artifacts` table. | `build_workspace_manifest_tool`, `build_adf_pipeline_json_tool`, `build_pyspark_notebook_tool`, `build_warehouse_ddl_tool`, plus all dynamically synthesized tools |
| **6** | **Quality & Standards Auditor Agent** | `auditor_agent` | `gpt-4o` / Azure OpenAI | Independent quality gate. Parses generated code via Python AST, audits PII masking rules against compliance policies, verifies Z-Order clustering, and commits scorecards to `audit_findings`. | *(Code & AST compliance engine)* |

---

## 3. The General Class Wrapper: `DynamicAgentRuntime`

### 3.1 Why a Generic Wrapper?
Instead of creating rigid, subclassed agent implementations (`class PlannerAgent(BaseAgent)`, `class ExecutorAgent(BaseAgent)`, etc.) that duplicate database connections and execution loops, OmniFlow uses a single, robust runtime wrapper: **`DynamicAgentRuntime`** located in `omniflow/agents/runtime.py`.

### 3.2 Dynamic Hydration from PostgreSQL
When `DynamicAgentRuntime(agent_name="planner_agent")` is initialized, it executes a single parameterized SQL query against Neon PostgreSQL:

```sql
SELECT a.agent_id, a.agent_name, a.display_name, a.agent_type,
       a.model_name, a.model_provider, a.system_prompt
FROM agents a
WHERE a.agent_name = %s AND a.is_active = true;
```

It then queries `agent_tools` joined with `tools` to retrieve all bound tools and their JSON schemas:

```sql
SELECT t.tool_id, t.tool_name, t.description, t.input_schema, t.endpoint
FROM agent_tools at
JOIN tools t ON at.tool_id = t.tool_id
WHERE at.agent_id = %s;
```

This constructs a strongly-typed Pydantic v2 `AgentMetadata` object in memory:
- `agent_id`: UUID
- `agent_name`: Unique string identifier (e.g. `planner_agent`)
- `model_name`: LLM deployment (e.g. `gpt-4o`)
- `model_provider`: `azure_openai`, `anthropic`, or `fabric`
- `system_prompt`: Enterprise system prompt stored in the database
- `tools`: List of `ToolMetadata` objects containing name, description, schema, and endpoint

### 3.3 The Tool Execution Interceptor (`execute_tool_call`)
When an agent invokes a tool, execution flows through the central interceptor method `execute_tool_call(tool_name, args, agent_run_id)`:

```python
def execute_tool_call(self, tool_name: str, args: dict[str, Any], agent_run_id: str | None = None) -> Any:
    # 1. Authorization Guard: Check if tool is legally bound to this agent in PostgreSQL
    tool_map = {t.tool_name: t for t in self.agent_meta.tools}
    if tool_name not in tool_map:
        raise PermissionError(f"Agent '{self.agent_name}' does not have tool '{tool_name}' bound in PostgreSQL.")

    # 2. Dynamic Dispatch: Look up callable in tool_registry or synthesized_tools
    tool_func = getattr(tool_module, tool_name, None)
    if not tool_func:
        raise NotImplementedError(f"Callable '{tool_name}' missing in Python tool_registry.")

    # 3. Latency & Execution Tracking
    t0 = time.perf_counter()
    result = tool_func(**args)
    elapsed_ms = max(1, int((time.perf_counter() - t0) * 1000))

    # 4. Durable PostgreSQL Audit Logging
    if agent_run_id:
        self.db_logger.log_tool_run(
            agent_run_id=agent_run_id,
            tool_id=tool_map[tool_name].tool_id,
            input_payload=args,
            output_payload={"status": "ok", "keys": list(result.keys()) if isinstance(result, dict) else []},
            execution_time_ms=elapsed_ms,
            status="completed",
        )
    return result
```

This guarantees:
1. **Security Containment**: An agent cannot call arbitrary functions that are not explicitly bound to it in the database.
2. **Observability**: Every single tool run is recorded in the PostgreSQL `tool_runs` table with exact millisecond timings, status, input payload, and output structure.

---

## 4. PostgreSQL Database Schema: Complete Table Mapping

OmniFlow uses Neon PostgreSQL as its single source of truth. Below is the mapping of all 20+ tables touched across the lifecycle:

```
+-----------------------------------------------------------------------------------------------------+
|                                    NEON POSTGRESQL TABLE TOPOLOGY                                   |
+-----------------------------------------------------------------------------------------------------+

  [1. PLATFORM REGISTRY]            [2. RUNTIME ORCHESTRATION]           [3. ENTERPRISE CATALOG]
  ├── agents                        ├── projects                         ├── data_sources
  ├── tools                         ├── runs                             ├── tables
  ├── agent_tools                   ├── agent_runs                       ├── columns
  └── system_config                 ├── tasks                            └── relationships
                                    ├── tool_runs
                                    ├── artifacts
                                    └── audit_findings

  [4. GOVERNANCE & STANDARDS]       [5. ARCHITECTURE & MEMORY]
  ├── policies                      ├── project_decisions (ADRs)
  └── engineering_standards         ├── project_constraints
                                    ├── project_memory
                                    └── fabric_patterns
```

### Table Details & Agent Interaction Matrix

| Table Name | Primary Key | Key Columns | Touched By | Purpose |
| :--- | :--- | :--- | :--- | :--- |
| `agents` | `agent_id` (UUID) | `agent_name`, `system_prompt`, `model_name`, `is_active` | All agents | Master registry defining each agent's identity, prompt, and LLM configuration. |
| `tools` | `tool_id` (UUID) | `tool_name`, `description`, `input_schema`, `is_synthesized` | Checker, Research, Executor | Catalog of all available native and dynamically synthesized tools. |
| `agent_tools` | `(agent_id, tool_id)` | `permission_level`, `is_active` | All agents | Many-to-many relationship mapping which tools each agent is authorized to call. |
| `projects` | `project_id` (UUID) | `project_code`, `project_name`, `objective`, `status` | Orchestrator, Planner | Tracks high-level customer enterprise data projects. |
| `runs` | `run_id` (UUID) | `project_id`, `input_prompt`, `current_step`, `status` | Orchestrator | Represents an end-to-end execution lifecycle run. |
| `agent_runs` | `agent_run_id` (UUID) | `run_id`, `agent_id`, `input`, `output`, `reasoning_summary` | All agents | Step-by-step execution log of each agent during a run. |
| `tasks` | `task_id` (UUID) | `run_id`, `step_code`, `task_type`, `status`, `dependency_ids` | Task Organizer, Executor | Topologically sorted tasks generated from the NetworkX DAG. |
| `tool_runs` | `tool_run_id` (UUID) | `agent_run_id`, `tool_id`, `input`, `output`, `execution_time_ms` | Planner, Executor | Audit trail of every single tool call executed by any agent. |
| `artifacts` | `artifact_id` (UUID) | `run_id`, `task_id`, `artifact_name`, `artifact_type`, `sha256` | Executor, Auditor | Generated code and manifest files stored with cryptographic hashes. |
| `audit_findings`| `finding_id` (UUID) | `run_id`, `artifact_id`, `rule_code`, `status`, `message` | Auditor | Quality scorecard, security checks, and defect logs. |
| `data_sources` | `source_id` (UUID) | `source_name`, `source_type`, `system_name`, `status` | Planner | Discovered enterprise source systems (SAP ECC, Postgres ERP, etc.). |
| `tables` | `table_id` (UUID) | `source_id`, `table_name`, `layer`, `primary_key`, `watermark` | Planner, Executor | Registered source, curated, and analytical table entities. |
| `columns` | `column_id` (UUID) | `table_id`, `column_name`, `data_type`, `is_pii`, `is_nullable` | Planner, Executor | Column-level metadata, data types, and sensitive PII classifications. |
| `relationships` | `relationship_id` (UUID)| `from_table_id`, `from_column_id`, `to_table_id`, `cardinality` | Planner | Foreign key relationships and join lineage between entities. |
| `policies` | `policy_id` (UUID) | `policy_name`, `policy_type`, `rules_json`, `is_enforced` | Planner, Auditor | Mandatory compliance rules (SHA-256 PII masking, folder containment). |
| `engineering_standards`| `standard_id` (UUID)| `standard_name`, `target_layer`, `rule_markdown` | Planner, Auditor | Best practice rules for Delta Lake upserts, Kimball schemas, and naming. |
| `project_decisions`| `decision_id` (UUID)| `project_id`, `decision_title`, `decision`, `status` | Planner | Architectural Decision Records (ADRs) approved for the project. |
| `project_constraints`| `constraint_id` (UUID)| `project_id`, `constraint_type`, `value`, `severity` | Planner | Active platform constraints (e.g. Fabric Capacity SKU = F64). |
| `project_memory`| `memory_id` (UUID) | `project_id`, `memory_type`, `title`, `content` | Planner | Persistent project memory (naming conventions, past patterns). |

---

## 5. Context Necessity Analysis: What Context is Needed at What Stage?

A critical design requirement is understanding **what information the AI needs at each phase** to prevent hallucinations without blowing prompt limits:

### 5.1 Phase 1: Macro Architecture Roadmap (Discovery Stage)
At the very beginning of a project, the Lakehouses, delta tables, and pipelines **do not exist yet**. Passing detailed column lists for non-existent target tables is impossible and counterproductive.

**Context Actively Needed by the Macro Planner**:
1. **Engineering Standards (`engineering_standards`)**:
   - What storage tiers are mandated? (Raw $\to$ Curated $\to$ Analytical Warehouse).
   - What are the naming conventions? (`lh_<domain>_raw`, `lh_<domain>_curated`, `wh_<domain>_analytics`).
   - What upsert pattern is required? (PySpark Delta `MERGE` on primary key with SCD Type 2).
2. **Governance Policies (`policies`)**:
   - Regulatory requirements: Does GDPR/CCPA require SHA-256 PII hashing before analytical storage?
   - Environment containment: Must all test artifacts deploy strictly inside `AI_Test_Folder`?
3. **Architectural Decisions (`project_decisions` - ADRs)**:
   - Has the enterprise already decided between Direct Lake vs DirectQuery for Power BI? (e.g. ADR-001 approved Direct Lake).
   - What ingestion mechanism was approved for SAP ECC? (e.g. ADR-002 approved RFC/ODP CDC over batch file dumps).
4. **Capacity & Infrastructure Constraints (`project_constraints`)**:
   - What is the provisioned Fabric capacity SKU? (e.g. `F64`). High SKU capacities allow high parallel compute; lower SKUs require aggressive Delta Z-Ordering to prevent compute throttling.
5. **Source Systems Catalog (`data_sources`)**:
   - What operational systems exist to ingest from? (SAP ECC ERP, PostgreSQL ERP).

**Context NOT Needed at Phase 1**:
- Full 50-table schemas, column nullable flags, or exact database index trees. The macro roadmap only needs to establish *phases*, *technologies*, and *governance boundaries*.

### 5.2 Phase 2: Granular Step Decomposition & Code Generation (Execution Stage)
Once the Macro Plan establishes the ingestion and curation phases, the Worker / Executor Agent needs precise technical contracts.

**Context Actively Needed by the Granular Executor**:
1. **Candidate Table Schemas (`tables`)**:
   - Exact table names: `BKPF`, `BSEG`, `customers`, `orders`.
   - Primary key fields: `orders.order_id`, `customers.customer_id`, `BKPF.BELNR`.
   - Watermark tracking columns: `updated_at`, `AEDAT`.
2. **Sensitive PII Field Tags (`columns`)**:
   - Exact column names flagged with `is_pii = true`: `customer_email`, `customer_name`, `tax_id`, `iban_number`.
   - This ensures the generated PySpark notebook hashes *only* the sensitive columns using `sha2(col, 256)` while leaving non-sensitive operational fields intact.
3. **Foreign Key Relationships (`relationships`)**:
   - Join paths: `orders.customer_id -> customers.customer_id`, `BSEG.BELNR -> BKPF.BELNR`.
   - This ensures the generated Analytical Warehouse T-SQL DDL correctly builds Kimball Star Schema dimensions (`dim_customer`) and fact tables (`fact_financial_settlements`) with valid surrogate key joins.

---

## 6. How the AI Actually Calls Tools: The Underlying Mechanics

A common point of skepticism is whether the AI is actually deciding to call tools or if a backend script is merely executing hardcoded functions. Here is the exact technical mechanism:

```
+-------------------------------------------------------------------------------------------+
|                              AUTONOMOUS TOOL CALLING MECHANISM                            |
+-------------------------------------------------------------------------------------------+

   1. PostgreSQL Tools Table
      Stores tool definition + JSON Schema (e.g. input_schema={"type": "object", ...})
                                     │
                                     ▼
   2. Dynamic Hydration
      Planner queries 'agent_tools' and builds tool descriptors into LLM context
                                     │
                                     ▼
   3. LLM Reasoning Call (Azure OpenAI / GPT-4o)
      LLM emits tool_call object:
      {
        "id": "call_abc123",
        "type": "function",
        "function": {
          "name": "search_database_catalog_tool",
          "arguments": "{\"query\": \"ALL\"}"
        }
      }
                                     │
                                     ▼
   4. Runtime Dispatcher (`execute_tool_call`)
      - Validates permission in 'agent_tools'
      - Finds Python function in tool_registry.py
      - Executes: result = tool_registry.search_database_catalog_tool(query="ALL")
                                     │
                                     ▼
   5. PostgreSQL Audit Commitment
      Inserts row into 'tool_runs' table:
      - agent_run_id, tool_id, input_payload, output_payload, execution_time_ms, status='completed'
                                     │
                                     ▼
   6. Context Injection
      Result payload injected into conversation memory for next reasoning pass
```

### 6.1 Tool Registration Schema
Every tool in PostgreSQL is registered with an explicit JSON Schema defining its parameters:

```json
{
  "tool_name": "get_table_schema_and_lineage_tool",
  "description": "Queries exact columns, data types, primary keys, PII sensitivity, and foreign keys from PostgreSQL catalog.",
  "input_schema": {
    "type": "object",
    "properties": {
      "table_names": {
        "type": "array",
        "items": {"type": "string"},
        "description": "List of candidate table names to retrieve schemas and relationships for."
      }
    },
    "required": ["table_names"]
  }
}
```

### 6.2 Autonomous Tool Synthesis When Missing
If a planned task requires a tool that does not exist in the database (e.g., `build_sap_rfc_cdc_connector_tool`), the workflow does not crash. Instead:
1. `tool_checker_agent` flags the tool as `MISSING`.
2. `research_agent` generates the Python source code using code synthesis templates.
3. **AST Guardrail Validation**: The code is parsed with `ast.parse()`. If unsafe imports (`subprocess`, `os.system`, `eval`) are detected, it is rejected.
4. The verified function is written to `omniflow/agents/synthesized_tools.py` and dynamically imported into `tool_registry`.
5. The tool is inserted into the PostgreSQL `tools` table and bound to `executor_agent` in `agent_tools`.
6. `tool_checker_agent` runs Pass 2, verifying `6/6` tools are now ready.

---

## 7. End-to-End Walkthrough of an Execution Flow

Below is the complete step-by-step trace of a live run (`run_id: ebf20c41-23d3-4c6c-b596-46505f917af9`).

### Step 0: User Input & Intake Processing
- **File**: `omniflow/test_trio.py` $\to$ `omniflow/agents/orchestrator.py`
- **Action**: User passes a project brief:
  > *"Architect, provision, and deploy an enterprise financial and operations data platform on Microsoft Fabric capacity F64 inside AI_Test_Folder. Ingest SAP ECC (BKPF, BSEG) and PostgreSQL ERP (orders, customers) into Raw storage, cleanse and deduplicate in Curated storage with SHA-256 PII masking, and build an Analytical Kimball Star Schema with Direct Lake Power BI."*
- **Database Write**:
  - `projects`: Upserts `project_code="PRJ-GLOBAL-FIN-HUB"`.
  - `runs`: Inserts `run_id="ebf20c41-23d3-4c6c-b596-46505f917af9"`, `status="in_progress"`.

### Step 1: Catalog Seeding
- **File**: `omniflow/db/catalog_seeder.py`
- **Action**: Reads `project_intake.json`, extracts sources (`SAP ECC Finance`, `PostgreSQL Operational ERP`), tables (`BKPF`, `BSEG`, `customers`, `orders`), columns (with PII flags), and hydrates `data_sources`, `tables`, and `columns` in Neon PostgreSQL.

### Step 2: Planner Agent Execution (Pass 1 & Pass 2)
- **File**: `omniflow/agents/runtime.py` (`DynamicAgentRuntime.run_planner()`)
- **Tool Calls Executed & Logged to `tool_runs`**:
  1. `search_database_catalog_tool('ALL')` $\to$ Discovered 2 sources, 4 candidate tables.
  2. `get_table_schema_and_lineage_tool(['BKPF', 'BSEG', 'customers', 'orders'])` $\to$ Retrieved schemas, relationships, identified PII fields: `customer_email`, `customer_name`, `iban_number`, `tax_id`.
  3. `query_governance_and_compliance_policies_tool('PRJ-GLOBAL-FIN-HUB')` $\to$ Retrieved active policies (SHA-256 mandatory, Folder containment).
  4. `query_project_memory_and_decisions_tool('PRJ-GLOBAL-FIN-HUB')` $\to$ Retrieved ADR-001 (Direct Lake), ADR-002 (SAP RFC CDC), F64 SKU constraint.
  5. `query_standards_tool('ALL')` $\to$ Retrieved 3 engineering standards rules.
- **Output Formed**:
  - **Macro Roadmap (Pass 1)**:
    - `PH-1`: Infrastructure Provisioning (`AI_Test_Folder`, F64)
    - `PH-2`: Multi-Source Raw Ingestion (SAP ECC, PostgreSQL ERP)
    - `PH-3`: Curated PySpark Deduplication & SHA-256 PII Masking
    - `PH-4`: Analytical Warehouse Kimball Star Schema & Direct Lake
  - **Granular Steps (Pass 2)**:
    - `STEP-01`: Provision Lakehouses & Warehouse (Tool: `build_workspace_manifest_tool`)
    - `STEP-02`: Batch Ingest Pipeline (Tool: `build_adf_pipeline_json_tool`, Depends: `STEP-01`)
    - `STEP-03`: SAP RFC CDC Connector (Tool: `build_sap_rfc_cdc_connector_tool`, Depends: `STEP-01`)
    - `STEP-04`: Curated PySpark SCD2 MERGE Notebook (Tool: `build_pyspark_notebook_tool`, Depends: `STEP-02`, `STEP-03`)
    - `STEP-05`: Analytical Warehouse Star Schema DDL (Tool: `build_warehouse_ddl_tool`, Depends: `STEP-04`)
    - `STEP-06`: Power BI Direct Lake Semantic Model (Tool: `build_direct_lake_bim_tool`, Depends: `STEP-05`)
- **Database Write**: `agent_runs` row for `planner_agent`.

### Step 3: Task Organizer Agent Execution
- **File**: `omniflow/agents/runtime.py` (`DynamicAgentRuntime.run_task_organizer()`)
- **Action**: Instantiates `networkx.DiGraph`. Adds nodes `STEP-01` through `STEP-06` and dependency edges. Runs `nx.is_directed_acyclic_graph(dag)`. Calculates topological generations:
  - Wave 1: `['STEP-01']`
  - Wave 2: `['STEP-02', 'STEP-03']` (can run in parallel!)
  - Wave 3: `['STEP-04']`
  - Wave 4: `['STEP-05']`
  - Wave 5: `['STEP-06']`
  - Critical Path: `STEP-01 -> STEP-02 -> STEP-04 -> STEP-05 -> STEP-06`.
- **Database Write**: Inserts 6 task rows into `tasks` table with generated UUIDs and `dependency_ids` array.

### Step 4 & 5: Tool Checker & Research Agents
- **File**: `omniflow/agents/runtime.py` $\to$ `omniflow/agents/tool_synthesizer.py`
- **Pass 1 Check**: 4 tools available in DB; 2 tools missing (`build_sap_rfc_cdc_connector_tool`, `build_direct_lake_bim_tool`).
- **Synthesis**: `research_agent` synthesizes the 2 missing tools, verifies AST syntax, writes code to `synthesized_tools.py`, registers them into PostgreSQL `tools`, and binds them to `executor_agent` in `agent_tools`.
- **Pass 2 Check**: Confirms 6/6 tools ready (100% available).

### Step 6: Worker / Executor Agent Execution
- **File**: `omniflow/agents/runtime.py` (`DynamicAgentRuntime.run_executor()`)
- **Action**: Iterates over DAG tasks in topological order. For each task:
  1. Invokes tool with dynamically resolved parameters (e.g. `pii_columns` passed from Step 2 schema discovery).
  2. Measures execution latency.
  3. Writes generated file to `omniflow/generated_artifacts/PRJ-GLOBAL-FIN-HUB/`.
  4. Calculates SHA-256 hash of the generated content.
  5. Commits metadata to PostgreSQL `artifacts` table.
  6. Updates task status to `completed` in `tasks` table.

Generated Artifacts on Disk:
- `01_workspace_manifest.json` (Capacity & Lakehouse manifest)
- `02_pl_raw_batch_ingest.json` (Fabric Data Pipeline definition)
- `03_sap_rfc_cdc_connector.json` (SAP RFC CDC stream configuration)
- `04_nb_curated_scd2_pii_merge.py` (PySpark Delta MERGE + SHA-256 masking)
- `05_warehouse_star_schema_ddl.sql` (T-SQL Kimball Star Schema DDL)
- `06_sm_direct_lake_model.bim.json` (Power BI Direct Lake Tabular Model)

### Step 7: Quality Auditor Agent Execution
- **File**: `omniflow/agents/auditor.py` (`audit_generated_artifacts()`)
- **Action**: Performs independent static code and compliance analysis:
  - Parses `04_nb_curated_scd2_pii_merge.py` via Python AST (`ast.parse`) $\to$ Valid syntax.
  - Checks PII masking: Confirms `sha2(col, 256)` is applied to `customer_email`, `customer_name`, `iban_number`, `tax_id`.
  - Checks Delta Lake optimization: Confirms `OPTIMIZE ... ZORDER BY` is present.
  - Checks T-SQL DDL: Confirms surrogate keys (`_sk`) and ISO-8601 date dimensions.
- **Scorecard**: 100% Compliance (8/8 checks passed, 0 defects).
- **Database Write**: Inserts audit scorecard into `audit_findings` table with status `APPROVED_FOR_DEPLOYMENT`.

### Step 8: Cloud Deployment Gate
- **File**: `omniflow/tools/fabric_deployer.py` (`verify_fabric_workspace_connection()`)
- **Action**: Executes live Microsoft Fabric REST API connectivity check using the active Azure CLI token (`az account get-access-token --resource https://api.fabric.microsoft.com`).
- **Result**: `LIVE_FABRIC_CONNECTED` (14 workspaces discovered, target `PBT_DATA_AGENT` confirmed).
- **Database Write**: Updates `runs` table row to `status="completed"`.

---

## 8. API Key, Authentication & Cloud Security Architecture

### 8.1 Zero Plaintext Secrets Policy
In accordance with enterprise security standards, OmniFlow strictly prohibits hardcoded API keys or plaintext credentials.

```
                           +─────────────────────────────────────────+
                           |           Azure CLI / Key Vault         |
                           +─────────────────────────────────────────+
                                                │
                          az account get-access-token --resource
                               https://api.fabric.microsoft.com
                                                │
                                                ▼
+──────────────────────+       +─────────────────────────────────+       +──────────────────────+
|   Local Developer    | ----> | OmniFlow Fabric Deployer Client | ----> | Microsoft Fabric REST|
|   Environment / CI   |       |  Bearer Authorization Header    |       | API (POST /items)    |
+──────────────────────+       +─────────────────────────────────+       +──────────────────────+
```

### 8.2 Supported Authentication Mechanisms
1. **Microsoft Fabric REST API**:
   - Uses native Azure Identity tokens resolved via Azure CLI (`az account get-access-token`).
   - In cloud/Fabric notebook environments, seamlessly switches to `mssparkutils.credentials.getToken("pbi")`.
2. **Azure OpenAI / OpenAI LLM Calls**:
   - Configured via environment variables:
     - `AZURE_OPENAI_API_KEY`: API key for Azure OpenAI resource.
     - `AZURE_OPENAI_ENDPOINT`: Endpoint URL (e.g. `https://<resource>.openai.azure.com/`).
     - `AZURE_OPENAI_API_VERSION`: API version (e.g. `2024-02-15-preview`).
   - Managed Identity support: Can authenticate directly via `DefaultAzureCredential()` without API keys.
3. **Neon PostgreSQL Database**:
   - Uses TLS/SSL connection string: `NEON_URI="postgresql://user:pass@ep-hostname.neon.tech/neondb?sslmode=require"`.
   - All connection pools enforce `connect_timeout=8` to prevent process hanging during network drops.

---

## 9. Project Folder Structure & UI Deployment Staging (`workspace_out`)

OmniFlow clearly separates the **Agent Engine Codebase** from the **User-Selected Deployment Directory**:

```
Fabric_AI/                                     # Master Repository
│
├── omniflow/                                  # OmniFlow Agent Engine (Internal)
│   ├── agents/                                # Master agent runtimes & tools
│   ├── db/                                    # Neon PostgreSQL repositories & seeders
│   ├── intake/                                # Enterprise project intake schemas
│   ├── tools/                                 # Fabric REST deployment client
│   └── docs/                                  # Architecture specifications
│
└── <user_selected_folder>/                    # External Deployment Target (e.g. workspace_out/ or external Git repo)
    │
    ├── .platform                              # Microsoft Fabric Git Integration Root Config
    │
    ├── 01_workspace_manifest.json             # Capacity provisioning manifest (AI_Test_Folder)
    │
    ├── pl_raw_batch_ingest.DataPipeline/      # Fabric Data Pipeline item
    │   ├── .platform
    │   └── pipeline-content.json
    │
    ├── sap_rfc_cdc_connector.json             # SAP RFC CDC Connector definition
    │
    ├── nb_curated_scd2_pii_merge.Notebook/    # Fabric PySpark Notebook item
    │   ├── .platform
    │   ├── item.metadata.json
    │   └── notebook-content.py                # PySpark Delta MERGE + SHA-256 masking
    │
    ├── wh_star_schema_ddl.Warehouse/          # Analytical Warehouse item
    │   ├── .platform
    │   └── ddl.sql                            # Kimball Star Schema T-SQL DDL
    │
    └── sm_direct_lake_model.SemanticModel/    # Power BI Direct Lake Semantic Model item
        ├── .platform
        └── model.bim                          # Tabular Object Model (.bim)
```

When a user in a Web UI or CLI selects a custom directory (e.g. `D:\Client_Deployments\Finance_Hub`), the engine merely passes `output_dir="D:\Client_Deployments\Finance_Hub"` to `executor.run_executor()`. The files are generated directly into the user's directory in Fabric Git format, ready for immediate `git push` to Azure DevOps or direct deployment via the Fabric REST API.

