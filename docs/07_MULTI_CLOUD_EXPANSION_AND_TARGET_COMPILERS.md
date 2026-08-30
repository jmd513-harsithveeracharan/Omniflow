# 07. Universal Multi-Cloud Architecture & Target Compilers

---

## 1. The Multi-Cloud Vision: One Brain, Multiple Compilers

The core innovation of Fabric AI is that **data ingestion logic is cloud-agnostic**.

Under the hood, every modern cloud data platform represents its infrastructure as **JSON or YAML metadata** and exposes **REST APIs** to provision, update, and run them.

By separating the **Universal Ingestion Planner** from the **Target Platform Compilers**, the same user request can be compiled and deployed into **Microsoft Fabric, Databricks, or Snowflake** with zero changes to the core agent logic:

```
                                  USER INTENT & SOURCE SCAN
                    "Ingest Salesforce with Medallion Architecture"
                                              │
                                              ▼
                        ┌───────────────────────────────────────────┐
                        │        UNIVERSAL INGESTION PLANNER        │
                        │    • Discovered Table Metadata            │
                        │    • Full vs. Incremental Strategy Matrix │
                        │    • Schedules & Watermarks               │
                        └─────────────────────┬─────────────────────┘
                                              │
                                  TARGET PLATFORM SELECTOR
                                              │
         ┌────────────────────────────────────┼────────────────────────────────────┐
         ▼                                    ▼                                    ▼
┌──────────────────────────────┐ ┌──────────────────────────────┐ ┌──────────────────────────────┐
│    MICROSOFT FABRIC TARGET   │ │      DATABRICKS TARGET       │ │       SNOWFLAKE TARGET       │
├──────────────────────────────┤ ├──────────────────────────────┤ ├──────────────────────────────┤
│ 1. API: Fabric REST API v1.0 │ │ 1. API: Databricks 2.1 API   │ │ 1. API: Snowflake SQL REST   │
│ 2. Emits JSON:               │ │ 2. Emits JSON/YAML:          │ │ 2. Emits DDL / JSON:         │
│    • `pipeline-content.json` │ │    • `databricks.yml` (DABs) │ │    • `CREATE DYNAMIC TABLE`  │
│    • `notebook-content.py`   │ │    • `jobs/create` payload   │ │    • `CREATE TASK ... CRON`  │
│    • `Lakehouse` items       │ │    • Delta Live Tables (DLT) │ │    • Snowpark Python Scripts │
│ 3. Deploys to: OneLake       │ │ 3. Deploys to: Unity Catalog │ │ 3. Deploys to: Snowpipe/Stage│
└──────────────────────────────┘ └──────────────────────────────┘ └──────────────────────────────┘
```

---

## 2. 1-to-1 Conceptual Mapping Across Platforms

| Conceptual Layer | Microsoft Fabric | Databricks | Snowflake |
| :--- | :--- | :--- | :--- |
| **Storage Container** | Lakehouse (`lh_bronze`) | Unity Catalog Schema (`bronze_catalog.bronze_schema`) | Database / Schema (`BRONZE_DB.RAW_SCHEMA`) |
| **Incremental Engine** | PySpark Delta `MERGE` | Delta Live Tables (`@dlt.table`) | Dynamic Tables / Streams & Tasks |
| **Transformation Code** | PySpark Notebooks (`notebook-content.py`) | Databricks Notebooks / Python Wheels | Snowpark Python / Stored Procedures |
| **Pipeline Orchestrator**| Data Factory Pipeline JSON | Databricks Workflows Multi-Task Job JSON | Snowflake Task Dependency DAG |
| **Provisioning API** | `POST /v1/workspaces/{id}/items` | `POST /api/2.1/jobs/create` | `POST /api/v2/statements` |
| **Scheduling** | Cron schedule in pipeline JSON | Quartz Cron in Databricks Job JSON | `SCHEDULE = 'USING CRON ...'` |
| **Secret Management** | `notebookutils.credentials.getSecret()` | `dbutils.secrets.get()` | Snowflake External Secrets / Key Vault |

---

## 3. Modular Target Compiler Code Architecture

The backend supports multiple cloud targets through a pluggable `targets/` compiler directory:

```
targets/
├── __init__.py
├── base_compiler.py          <-- Abstract Target Compiler Interface
├── fabric_compiler.py        <-- Fabric Item Definition & REST API Engine
├── databricks_compiler.py    <-- Databricks Asset Bundle (DAB) & Workflow Engine
└── snowflake_compiler.py     <-- Snowflake Dynamic Table & Task Engine
```

### Abstract Compiler Interface (`base_compiler.py`):
```python
from abc import ABC, abstractmethod

class BaseTargetCompiler(ABC):
    @abstractmethod
    def compile_storage_container(self, name: str, layer: str) -> dict:
        """Emits Lakehouse, Unity Catalog Schema, or Snowflake Database."""
        pass

    @abstractmethod
    def compile_transformation_notebook(self, table_meta: dict, strategy: dict) -> dict:
        """Emits PySpark, DLT, or Snowpark code."""
        pass

    @abstractmethod
    def compile_orchestration_pipeline(self, pipeline_name: str, tasks: list, schedule: dict) -> dict:
        """Emits Data Factory JSON, Databricks Workflow JSON, or Snowflake Task DAG."""
        pass

    @abstractmethod
    def deploy_to_cloud(self, compiled_bundle: dict, auth_token: str) -> dict:
        """Calls the target cloud's REST API to provision items."""
        pass
```

---

## 4. Instant Cross-Platform Migration (Zero Lock-In)

Because the architecture definitions are stored in an abstract metadata format, Fabric AI enables **Instant Cross-Platform Migration**:

1. **Import from Fabric:** Call `POST /getDefinition` on an existing Microsoft Fabric Data Pipeline.
2. **Abstract:** Extract the table mappings, watermark columns, and schedules.
3. **Re-compile for Databricks:** The `databricks_compiler.py` converts the Fabric pipeline into a **Databricks Delta Live Tables (DLT) pipeline** and **Multi-Task Workflow** in under 10 seconds.
4. **Deploy:** Pushes the new pipeline directly to the customer's Databricks workspace via the Databricks REST API.

This capability solves one of the largest enterprise challenges in modern data engineering: **migrating between cloud data warehouses without rewriting months of code.**
