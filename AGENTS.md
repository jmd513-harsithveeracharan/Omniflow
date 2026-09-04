# Fabric AI Studio — Enterprise Architecture & Agent Quality Constitution

This document defines the non-negotiable architectural standards, code quality rules, and behavioral guidelines for all AI agents and developers working on this codebase.

---

## 1. Zero "AI Slop" & Clean Architecture Standards

### A. Modular File Limits & Single Responsibility
- **Max File Length**: No Python or TypeScript file should exceed **250–300 lines**. If a file grows beyond this, decompose it into focused sub-modules.
- **Single Responsibility Principle (SRP)**: Each module must do one thing well (e.g. `routes/` handles HTTP, `domain/` holds business models, `services/` executes workflows).

### B. Strict Type Contracts (Zero `Any` / Zero Untyped Dicts)
- **Python**: All function arguments, return values, API payloads, and internal state MUST use **Pydantic v2 Models** or explicit type annotations.
- **TypeScript**: All API responses and component props MUST have defined interfaces. Never use `any`.

### C. DRY & Single Source of Truth
- Never copy-paste boilerplate across files.
- All Fabric REST API calls MUST route through `app/fabric_client.py`.
- All SQL parsing and dialect conversion MUST route through `app/sql_transpiler.py`.
- All database queries MUST route through `app/session_store.py` (or the unified Postgres adapter).

---

## 2. Zero Hardcoding & Sandbox Containment Policy

- **Dynamic Workspace Resolution**: All workspace IDs (`ALLOWED_WORKSPACE_ID`), lakehouse names, and tenant parameters must be dynamically resolved from `.env`, `config.json`, or the Fabric REST API (`/v1/workspaces`).
- **Default Folder Containment**: All newly provisioned Lakehouses, PySpark Notebooks, and Data Pipelines must be deployed inside `AI_Test_Folder` (or its subdirectories) to keep the workspace root clean.
- **Zero Plain-Text Secrets**: Never hardcode API keys, client secrets, or connection strings. Use Azure Identity / Azure Key Vault (`mssparkutils.credentials`).

---

## 3. Orchestration, Memory & Dependency Graph

### A. LangGraph Agent Workflows
- Multi-step reasoning must use **LangGraph `StateGraph`** with durable state checkpointing.
- Implement cyclic self-healing loops for execution errors and cell failures.
- Implement **Human-in-the-Loop Checkpoint Gates** before any destructive `DELETE` or `OVERWRITE` operations.

### B. Graph Memory & JIT Context Hydration
- Asset lineage (Source $\to$ Bronze $\to$ Silver $\to$ Gold $\to$ Power BI) must be modeled in a **NetworkX DAG**.
- **JIT Context Hydration**: Query only the 1-hop or 2-hop active subgraph (~85 tokens) instead of dumping full database catalogs into LLM prompts.
- **Blast-Zone Analysis**: Traverse downstream graph descendants before altering schemas to identify and warn about all impacted assets.

---

## 4. Medallion Data Engineering & SQL Transpilation

- **Bronze Layer (`lh_<name>_bronze`)**: Raw, immutable ingestion with original source schema preserved.
- **Silver Layer (`lh_<name>_silver`)**: Cleaned, deduplicated Delta Lake tables with PySpark `MERGE` upsert on primary keys.
- **Gold Layer (`lh_<name>_gold`)**: Business aggregations, Kimball star schemas, and Power BI semantic models.
- **SQL Transpilation**: All incoming SQL dialects (T-SQL, Oracle, Snowflake, Postgres) must pass through SQLGlot AST transpilation to generate native Spark SQL.

---

## 5. Git Branching & Commit Guidelines

### A. Branch Hierarchy
- `main`: Production/stable release branch.
- `dev`: Active integration and feature development branch.
- `feat/<name>`: Dedicated feature branches for major milestones.

### B. Natural, Human-Written Commit Messages
- Follow conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`.
- Keep messages simple, natural, and human-written (avoid stiff AI punctuation and over-complicated wording).
  - *Good*: `feat: add claude cli session resume and fastapi server`
  - *Good*: `fix: handle missing db session in chat router`
  - *Good*: `refactor: extract sql transpiler to domain model`
- Commit atomically after every verified milestone or feature completion.
- Never commit `.env`, local `.db` files, credentials, or Obsidian notes (`.gitignore` enforced).
