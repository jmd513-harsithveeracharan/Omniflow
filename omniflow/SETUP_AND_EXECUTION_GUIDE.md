# OmniFlow — Microsoft Fabric Autonomous Multi-Agent Data Platform
## Complete Developer Setup, Configuration & Execution Guide

---

## 1. Overview & Architecture

**OmniFlow** is an enterprise multi-agent autonomous engineering platform designed for Microsoft Fabric. It accepts natural language architectural prompts or structured project intake specifications and coordinates a roster of specialized dynamic AI agents backed by a Neon PostgreSQL catalog to design, validate, synthesize, and deploy end-to-end Medallion architectures directly into Microsoft Fabric:

- **Bronze Layer (`lh_<domain>_raw` / `lh_<domain>_bronze`)**: Raw immutable delta ingestion with ADF Data Factory Copy Pipelines.
- **Silver Layer (`lh_<domain>_curated` / `lh_<domain>_silver`)**: Automated PySpark notebooks with primary key deduplication, SHA-256 PII masking, and Delta Lake `MERGE` upsert.
- **Gold Layer (`wh_<domain>_analytics` / `wh_<domain>_gold`)**: Analytical star schema DDL with Kimball dimensional modeling (`dim_*`, `fact_*`) and Power BI Direct Lake Tabular Object Models (`.bim`).
- **Dynamic Governance & Blast-Radius Lineage**: Automated data quality suites and NetworkX lineage tracking.

---

## 2. Prerequisites

Before running OmniFlow, verify that your workstation has the following installed:

1. **Python 3.10, 3.11, or 3.12**:
   ```bash
   python --version
   ```
2. **Azure CLI (`az`)**: Required to authenticate securely against your organization's Microsoft Fabric tenant without requiring hardcoded client secrets.
   ```bash
   az --version
   ```
3. **Git & SSH Key**: Configured for repository cloning and commit synchronization.

---

## 3. Quickstart & Installation

### Step 1: Clone the Repository
```bash
git clone git@github.com-office:jmd513-harsithveeracharan/Omniflow.git
cd Omniflow
```

### Step 2: Create and Activate Virtual Environment
On Windows (PowerShell):
```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```
On macOS / Linux:
```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Step 3: Install Required Dependencies
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

---

## 4. Microsoft Fabric & Environment Configuration

OmniFlow features **Dynamic Workspace Resolution**. Any team member or senior developer can run OmniFlow against their own dedicated Fabric workspace simply by logging in with Azure CLI and setting their Workspace ID in `.env`.

### Step 1: Authenticate with Azure CLI
Log in with your corporate Microsoft Fabric account:
```bash
az login
```
*(If your account belongs to multiple Azure Entra ID tenants, specify `--tenant <tenant-id>`)*

### Step 2: Configure Environment Variables
Copy the provided template to create your local `.env`:
```bash
cp omniflow/.env.example omniflow/.env
```
*(Or create `.env` in the project root if running from the root repository)*

Edit the `.env` file with your credentials:

```ini
# ==============================================================================
# OmniFlow Configuration File (.env)
# ==============================================================================

# 1. PostgreSQL Metadata & Execution Catalog
# Central metadata registry for agent definitions, tool bindings, and run traces
NEON_DATABASE_URL=postgresql://neondb_owner:npg_o2FUwbtRgqA8@ep-summer-field-b50f50p0-pooler.c-7.us-east-2.aws.neon.tech/neondb?sslmode=require

# 2. Microsoft Fabric Target Workspace (Dynamic Multi-User Support)
# Paste your target Fabric Workspace ID and Display Name:
ALLOWED_WORKSPACE_ID=db7344c1-ecd9-44d6-849f-f2de49484f9f
ALLOWED_WORKSPACE_NAME=PBT_DATA_AGENT

# 3. Dynamic Containment Folder (Optional)
# - Leave BLANK to deploy items directly into the Workspace Root.
# - Or specify a folder name (e.g. PRJ-HEALTHCARE-CLAIMS) to group items inside a folder.
FABRIC_CONTAINMENT_FOLDER=

# 4. Azure OpenAI / LLM Credentials (For multi-agent planning & code generation)
AZURE_OPENAI_ENDPOINT=https://your-openai-resource.openai.azure.com/
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_DEPLOYMENT=omni-flow-gpt-6-luna
AZURE_OPENAI_API_VERSION=2024-08-01-preview
```

> [!NOTE]
> **Dynamic Multi-User Isolation**: OmniFlow dynamically inspects `ALLOWED_WORKSPACE_ID` (and aliases `FABRIC_ALLOWED_WORKSPACE_ID`, `FABRIC_WORKSPACE_ID`). When another developer or senior logs into Azure CLI and provides their own workspace ID, OmniFlow will automatically provision items into their workspace without any hardcoded restrictions.

---

## 5. Execution Modes & CLI Commands

OmniFlow provides three flexible execution modes depending on your workflow:

### Mode A: Full End-to-End Run with Project Intake Specification
Executes live PostgreSQL source schema introspection, 2-pass architectural planning, NetworkX DAG scheduling, dynamic tool verification/synthesis, fluid PySpark/SQL generation, compliance auditing, and Fabric cloud provisioning.

```bash
# Healthcare Clinical & Claims Domain
python omniflow/test_trio.py --intake omniflow/intake/project_intake_healthcare.json

# Supply Chain & Cold Chain Telemetry Domain
python omniflow/test_trio.py --intake omniflow/intake/project_intake_supplychain.json

# Global Finance ERP Hub Domain
python omniflow/test_trio.py --intake omniflow/intake/project_intake.json
```

### Mode B: Fast Resume / Verification Mode (`--resume`)
Re-executes orchestration using pre-synthesized dynamic tools and cached planning models, accelerating execution for rapid testing and continuous integration:

```bash
python omniflow/test_trio.py --intake omniflow/intake/project_intake_healthcare.json --resume
```

### Mode C: Free-Form Natural Language Prompt Execution
Provide an architectural vision directly as a CLI argument. The Planner and Research Agents will dynamically decompose requirements, synthesize any missing custom tools, and deploy to Fabric:

```bash
python omniflow/test_trio.py "Architect and provision a real-time IoT Cold Chain telemetry platform in Microsoft Fabric. Ingest high-frequency temperature sensor streams into Bronze, cleanse and detect temperature threshold breaches in Silver using Delta MERGE, and build a Gold Kimball star schema warehouse for logistics SLA compliance reporting."
```

---

## 6. Output Artifacts & Verification

After every run, OmniFlow outputs comprehensive deliverables:

1. **Terminal Executive Banner**: Displays active project code, source entities, target workspace, target folder, and agent steps.
2. **Generated Code Artifacts**: Saved to `omniflow/generated_artifacts/<PROJECT_CODE>/`:
   - `01_workspace_manifest.json`: Capacity and storage manifest.
   - `02_pl_raw_batch_ingest.json`: Fabric Data Factory Copy Pipeline JSON definition.
   - `03_nb_curated_pii_merge.py`: PySpark Delta notebook with SHA-256 PII hashing.
   - `04_warehouse_star_schema_ddl.sql`: T-SQL Kimball dimensional star schema DDL.
   - `05_data_quality_suite.json`: Great Expectations data quality test assertions.
   - `06_direct_lake_model.bim`: Power BI Direct Lake Tabular Object Model.
3. **Execution Summary & Audit Ledger**: Saved to `omniflow/test_run_result.json`:
   - AST syntax validation status.
   - PII masking compliance score (target: 100%).
   - Fabric REST deployment status for all lakehouses and warehouses.
4. **PostgreSQL Persistent Traces**:
   - Agent execution timings, token consumption, and dynamic tool registrations logged to `runs`, `agent_runs`, and `tool_runs`.

---

## 7. Troubleshooting & FAQ

- **Error: `psycopg2.OperationalError: connection to server failed`**
  - Verify that `NEON_DATABASE_URL` is set in your `.env` or `omniflow/.env` file.
- **Error: `WorkspaceSecurityError` or `Fabric REST API 401/403`**
  - Run `az login` to refresh your Azure token.
  - Verify that your user account has *Contributor* or *Admin* permissions on the Fabric workspace defined in `ALLOWED_WORKSPACE_ID`.
- **Targeting Workspace Root vs Custom Folders**:
  - To deploy into a specific folder, set `containment_folder` in the intake JSON or `FABRIC_CONTAINMENT_FOLDER=My_Folder` in `.env`.
  - To deploy directly to workspace root, set `"containment_folder": null` in intake JSON and leave `FABRIC_CONTAINMENT_FOLDER=` blank in `.env`.
