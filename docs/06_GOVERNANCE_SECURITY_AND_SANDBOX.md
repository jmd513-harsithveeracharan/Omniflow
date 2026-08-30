# 06. Enterprise Governance, Security Architecture & Local Simulation Sandbox

---

## 1. Enterprise Security & Governance Framework

Enterprise data leaders (CISOs, VPs of Data, Compliance Officers) require absolute certainty that AI agents will not leak sensitive credentials or corrupt production data. 

Fabric AI enforces **5 Core Governance Pillars** that guarantee enterprise-grade security and compliance:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        THE 5 PILLARS OF ENTERPRISE GOVERNANCE                          │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. 🛡️ ZERO-DATA BOUNDARY (Metadata-Only Control Plane)                                 │
│    • The AI agent NEVER reads, ingests, or stores actual customer business rows.       │
│    • Only table schemas (column names, data types, primary keys) are processed.        │
│    • All data movement stays 100% inside the customer's own cloud tenant / OneLake.    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 2. 🔑 ZERO-SECRET SCAFFOLDING (Key Vault Isolation)                                    │
│    • The agent never handles plaintext passwords, client secrets, or private keys.     │
│    • The agent sets secret values to `null` and injects Key Vault pointers in code.    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 3. 🚦 4-POINT HUMAN-IN-THE-LOOP (HITL) APPROVAL GATES                                  │
│    • Explicit human checkpoints prevent unauthorized or black-box deployments.         │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 4. 📜 100% CODE TRANSPARENCY & ZERO VENDOR LOCK-IN                                     │
│    • The agent generates open-source PySpark, Delta Lake, and Data Factory JSON.       │
│    • If the customer stops using the tool, all deployed pipelines continue running.    │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 5. 🔒 WORKSPACE ISOLATION & RBAC ENFORCEMENT                                           │
│    • Agent operations are locked to whitelisted target workspaces (`config.json`).     │
│    • Operates strictly under the user's existing Azure Active Directory (Entra ID) RBAC│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. The Zero-Secret Scaffolding Pattern

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: AI AGENT (Zero-Secret Scaffolding)                                            │
│ • Generates code with placeholder variables:                                           │
│   `KEY_VAULT_NAME = "Enterprise-KeyVault"`                                             │
│   `SECRET_NAME = "Salesforce-ClientSecret"`                                            │
│ • Sets secret values to NULL in configuration files.                                   │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: USER / CLIENT (HITL Credential Input Checkpoint)                               │
│ • User configures the secret directly in Azure Key Vault / Fabric Connections UI.      │
│ • The plaintext secret NEVER enters the LLM prompt or agent logs.                      │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: RUNTIME EXECUTION (Secure Cloud Handshake)                                     │
│ • PySpark retrieves the secret in-memory only: `notebookutils.getSecret(...)`          │
│ • Zero credentials exposed in git repos, item definitions, or audit logs.              │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The 4 Human-in-the-Loop (HITL) Checkpoints

To balance autonomous speed with enterprise oversight, human approval is required at four critical junctures:

```
               USER REQUEST
                    │
                    ▼
       ┌─────────────────────────┐
       │ 1. SKILL APPROVAL       │ ──► User reviews and confirms newly generated `SKILL.md`
       └────────────┬────────────┘
                    │
                    ▼
       ┌─────────────────────────┐
       │ 2. CREDENTIAL SETUP     │ ──► User provides Key Vault Secret Name (Zero plaintext keys)
       └────────────┬────────────┘
                    │
                    ▼
       ┌─────────────────────────┐
       │ 3. STRATEGY MATRIX      │ ──► User validates Full vs. Incremental strategy per table
       └────────────┬────────────┘
                    │
                    ▼
         [ Auto Fabric Provisioning & Execution ]
                    │
                    ▼
       ┌─────────────────────────┐
       │ 4. EXCEPTION HANDLING   │ ──► Escalation triggered only when self-healing confidence is low
       └─────────────────────────┘
```

---

## 4. The "Zero-Cloud" Local Simulation Sandbox

To allow prospects, data engineers, and investors to test the full end-to-end ingestion experience **without needing an Azure subscription, Fabric capacity, or cloud login**, Fabric AI includes a **Local Simulation Sandbox**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ LOCAL SIMULATION SANDBOX ARCHITECTURE                                                  │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. Local DuckDB / Parquet Engine:                                                      │
│    • Simulates Lakehouses locally: `.sandbox/lh_bronze/`, `.sandbox/lh_silver/`.        │
│    • Executes Delta Lake transformations on local synthetic data.                      │
│                                                                                        │
│ 2. Interactive "Before & After" Table Diff Inspector:                                  │
│    • Displays raw source data (with nulls, messy formatting, and duplicate records).   │
│    • Animates the transformation flow across the visual DAG.                           │
│    • Displays the cleaned Silver/Gold Delta table with row count verification.         │
│                                                                                        │
│ 3. One-Click Cloud Migration:                                                          │
│    • Once satisfied with the local simulation, the user clicks "🚀 Deploy to Fabric"   │
│      to provision real cloud items instantly.                                          │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

### Table Diff Visualization Example:
```
┌───────────────────────────────────────┬───────────────────────────────────────┐
│ BEFORE (Raw Source Table)             │ AFTER (Silver Cleaned Delta Table)    │
├───────────────────────────────────────┼───────────────────────────────────────┤
│ • 10,000 raw rows                     │ • 8,420 unique rows (1,580 duplicates │
│ • `CREATED_DATE`: "08/19/26 12:00 AM" │   removed)                            │
│ • `STATUS`: null, "pending", "PEND"   │ • `created_at`: 2026-08-19 00:00:00   │
│ • `TAX_RATE`: "N/A", "0.08"           │ • `status`: Standardized "PENDING"    │
│                                       │ • `tax_rate`: 0.08 (Float, null safe) │
└───────────────────────────────────────┴───────────────────────────────────────┘
```

---

## 5. The Security One-Pager for Enterprise CISOs

When presenting to enterprise security review boards, use this exact 4-point compliance summary:

1. **Control Plane vs. Data Plane Isolation:** The AI operates exclusively on metadata. Customer data never passes through LLM servers.
2. **Key Vault Integration:** Secrets are never hardcoded or passed to the LLM. The AI only writes Key Vault reference code.
3. **Immutable Audit Trails:** Every generated artifact, approval step, and self-healing action is logged with user timestamps.
4. **Zero Vendor Lock-In:** Generated artifacts are standard PySpark and Data Factory items that remain 100% operational even without Fabric AI.
