# OmniFlow — Complete Setup & Architecture Guide

Welcome to **OmniFlow**, the autonomous AI data engineering workspace for **Microsoft Fabric**.

This document outlines the codebase organization, what each file does, prerequisites, and how to get the platform up and running in under 5 minutes.

---

## 1. Directory & File Organization

The `omniflow/` package contains everything needed to run both the FastAPI backend and the interactive React studio:

```
omniflow/
├── server.py                   # Main FastAPI application entrypoint (REST API, SSE Chat, Static Web)
│
├── auth/                       # Authentication & Microsoft Fabric Entra SSO
│   ├── auth.py                 # Token cache, session auth, and RBAC user store
│   └── fabric.py               # Azure CLI SSO, Device Code, and Account Switcher
│
├── connectors/                 # Source System Connectors & Live Schema Inspection
│   ├── catalog.py              # Catalog of Fabric Native vs Custom PySpark connectors
│   ├── interceptor.py          # Secure credential interception gate & connection vault
│   └── live_inspector.py       # Dynamic driver-dispatched live database schema inspector
│
├── graph/                      # NetworkX Relationship Graph & Lineage Engine
│   ├── service.py              # GraphEngine for interactive Graph Mesh & Blast-Zone analysis
│   ├── generator.py            # NetworkX DAG generator & Medallion constellation builder
│   ├── project_builder.py      # Dynamic project mesh generator from artifacts & workspaces
│   ├── workspace_builder.py    # Live Fabric workspace graph builder
│   └── models.py               # Pydantic data models for graph nodes, links, and layers
│
├── services/                   # Core Application Services
│   ├── git_service.py          # Git repository manager (branches, commit history, retrieval)
│   └── intent_router.py        # Chat prompt classifier (General Chat, Project Q&A, DAG)
│
├── agents/                     # Multi-agent autonomous workflow system
│   ├── orchestrator.py         # MultiAgentOrchestrator coordinating all 6 specialized agents
│   ├── schemas.py              # Pydantic contracts for architectural plans and steps
│   ├── runtime.py              # Cognitive execution harness and pipeline stages
│   └── tool_registry.py        # Dynamic tool registry and PostgreSQL function bindings
│
├── config/                     # Environment configuration & LLM adapters
│   ├── env_loader.py           # Dynamic workspace and tenant parameter loader
│   └── llm_adapter.py          # Azure OpenAI / Anthropic streaming and chat callers
│
├── db/                         # Database persistence layers
│   ├── postgres_repo.py        # Neon PostgreSQL repository for tools, runs, and project context
│   ├── execution_logger.py     # Persistent agent/tool run and lineage edge logging
│   └── catalog_seeder.py       # Source table schema metadata resolver
│
├── docs/                       # Setup & Execution Guides
│   ├── SETUP.md                # Platform directory guide & quickstart
│   └── SETUP_AND_EXECUTION_GUIDE.md # Step-by-step setup & execution walkthrough
│
├── tools/                      # Core engineering & deployment tools
│   ├── fabric_deployer.py      # Deploys items (Lakehouse, Warehouse, Notebook, Pipeline) via Fabric REST
│   ├── dag_runner.py           # GenericDAGProvisioner with NetworkX parallel topological waves
│   ├── fabric_adapter.py       # Folder creation and item listing wrappers
│   ├── asset_indexer.py        # Workspace asset cataloger and cache indexer
│   ├── guardrails.py           # AST & security validation guardrails for synthesized code
│   ├── introspect_source.py    # Schema discovery & metadata inspection helpers
│   └── skill_loader.py         # Dynamic skill discovery and loader
│
├── ui/                         # Terminal execution UI output helpers
│   └── terminal.py             # Console progress formatting and banners
│
├── intake/                     # Enterprise Project Intake Specifications & Helpers
│   ├── helpers.py              # Intake JSON extraction, connection hydration & plan builders
│   ├── project_intake_postgres_test.json # PostgreSQL end-to-end test intake spec
│   ├── project_intake.json               # General Medallion intake specification
│   ├── project_intake_delivery.json      # Courier & fleet delivery platform intake
│   ├── project_intake_fintech.json       # Cross-border payments & AML fraud intake
│   ├── project_intake_healthcare.json    # Clinical claims & HIPAA PII intake
│   └── project_intake_supplychain.json   # Cold-chain inventory fulfillment intake
│
├── frontend/                   # Modern React 18 + Vite + Tailwind CSS User Interface
│   ├── src/                    # Components, views, graph canvas, and API clients
│   ├── package.json            # Node.js dependencies
│   ├── vite.config.ts          # Vite build & development proxy configuration
│   └── dist/                   # Compiled production web bundle served by FastAPI
│
├── requirements.txt            # Python backend dependencies
├── .env.example                # Template configuration file
└── test_trio.py                # Standalone CLI runner for headless agent pipeline tests
```

---

## 2. Prerequisites

Verify that your system has the following installed:
1. **Python 3.10, 3.11, or 3.12**
   ```bash
   python --version
   ```
2. **Node.js 18+ & npm** (Required only if editing/rebuilding the frontend)
   ```bash
   node --version
   npm --version
   ```
3. **Azure CLI (`az`)** (Required for single sign-on Fabric API calls)
   ```bash
   az --version
   ```

---

## 3. Quickstart: Running OmniFlow

### Step 1: Set Up Python Environment
From the repository root:
```powershell
# Create virtual environment
python -m venv .venv

# Activate on Windows PowerShell:
.\.venv\Scripts\Activate.ps1

# Activate on macOS/Linux:
source .venv/bin/activate

# Install Python requirements
pip install -r omniflow/requirements.txt
```

### Step 2: Configure `.env`
Copy the example file:
```bash
cp omniflow/.env.example omniflow/.env
```
Fill in your credentials in `omniflow/.env`:
```ini
# Neon PostgreSQL Metadata & Tool Registry
NEON_DATABASE_URL=postgresql://<user>:<password>@<neon-host>/<database>?sslmode=require

# Azure OpenAI / LLM Credentials
AZURE_OPENAI_ENDPOINT=https://your-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-azure-openai-key
AZURE_OPENAI_DEPLOYMENT=omni-flow-gpt-6-luna
AZURE_OPENAI_API_VERSION=2024-08-01-preview

# Optional Default Workspace (Workspace is also resolved dynamically per-project)
ALLOWED_WORKSPACE_ID=your-workspace-guid
```

### Step 3: Sign In with Azure CLI
```bash
az login
```

### Step 4: Launch the Studio
Run the backend server (which automatically serves the compiled frontend at the root):
```powershell
python -m uvicorn omniflow.server:app --host 127.0.0.1 --port 8090 --reload
```
Open your browser and navigate to:
👉 **`http://127.0.0.1:8090`**

---

## 4. Optional: Developing the Frontend

If you want to modify the React frontend:
```bash
cd omniflow/frontend
npm install
npm run dev     # Starts Vite dev server with proxy to backend on :8090
npm run build   # Compiles production assets into omniflow/frontend/dist
```

---

## 5. Key Architecture Features

- **Dynamic Workspace Resolution**: Every project can target a different Fabric workspace (e.g. `PBT_DATA_AGENT`). Omniflow dynamically queries the Fabric API to resolve the exact workspace GUID at runtime.
- **Human-in-the-Loop**: The AI drafts plans, code diffs, and item specs; actions require user confirmation before cloud deployment.
- **60 FPS Relationship Graph**: High-frequency canvas rendering with frustum culling, LOD typography, and decoupled D3 force simulation.
- **Zero Plain-Text Secrets**: Azure CLI SSO Bearer tokens and Azure Key Vault (`mssparkutils.credentials.getSecret`) handle all authentication.
