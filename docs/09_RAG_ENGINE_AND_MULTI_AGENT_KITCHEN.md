# 09. RAG Documentation Engine & Multi-Agent "Kitchen" Architecture

---

## 1. Overview & Architectural Motivation

To achieve **99.9% enterprise reliability** and eliminate hallucinations across evolving cloud APIs (Microsoft Fabric, Databricks, Snowflake), Fabric AI combines two advanced architectural patterns:
1. **The RAG Documentation Engine:** An embedded, local vector knowledge base containing official API specifications, PySpark/Delta Lake syntax manuals, and source connector protocols.
2. **The "Restaurant Kitchen" Multi-Agent Swarm:** A coordinated team of specialized micro-agents working in parallel, where each agent has a single, well-defined responsibility (Concierge, Prep, Executive Planner, Line Cook, Health Inspector, and Doctor).

---

## 2. The RAG Documentation Engine (Authoritative Source of Truth)

Instead of relying on frozen LLM training weights or slow manual web searches, the platform maintains a fast, local vector database (e.g. ChromaDB / LanceDB / SQLite-vec):

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ RAG KNOWLEDGE BASE (Local Vector Store)                                                │
├────────────────────────────────────────────────────────────────────────────────────────┤
│ 📚 Embedded Knowledge Slices:                                                          │
│ 1. Microsoft Fabric REST API Specifications (`pipeline-content.json`, `.platform`)      │
│ 2. PySpark 3.4/3.5 & Delta Lake 3.0 API Reference & Optimization Guides                │
│ 3. Source Connector Protocols (Salesforce SOQL, SAP OData, Redshift JDBC, ADLS ABFSS)  │
│ 4. Enterprise Compliance, Key Vault, and RBAC Security Playbooks                       │
└───────────────────────────────────────────┬────────────────────────────────────────────┘
                                            │ Sub-50ms Exact Semantic Retrieval
                                            ▼
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ BENEFIT: ZERO HALLUCINATION ON CLOUD INFRASTRUCTURE JSON & SYNTAX                      │
│ • When generating a Data Factory pipeline, the agent retrieves the exact activity schema│
│ • When writing a complex Delta Lake merge, it retrieves the optimized partition syntax. │
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. The "Restaurant Kitchen" Multi-Agent Swarm

```
                                    USER REQUEST (Front of House)
                                                │
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 1. THE MAÎTRE D' AGENT (The Concierge & HITL Coordinator)                                              │
│ • Greets user in UI, gathers intent, renders Strategy Matrix, and handles approvals.                   │
└───────────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                                │ Dispatches work to kitchen
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 2. THE PREP CHEF AGENT (Source & RAG Explorer)                                                         │
│ • Connects to source DB, extracts table metadata (columns, PKs), and fetches doc chunks from RAG.      │
└───────────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                                │ Passes clean metadata & doc recipes
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 3. THE EXECUTIVE CHEF AGENT (Architecture & Medallion Planner)                                         │
│ • Designs the Medallion layout (Bronze/Silver/Gold), schedules, and builds the visual DAG topology.   │
└───────────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                                │ Passes architecture plan
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 4. THE LINE COOK AGENT (PySpark & Item Compiler)                                                       │
│ • Writes high-performance Delta Lake PySpark code and compiles Base64 Fabric REST definitions.         │
└───────────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                                │ Sends compiled code for inspection
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 5. THE HEALTH INSPECTOR AGENT (Security & Linter Guardrail)                                            │
│ • Scans generated code for hardcoded secrets, syntax bugs, and workspace isolation compliance.         │
└───────────────────────────────────────────────┬────────────────────────────────────────────────────────┘
                                                │ Deploys to live cloud
                                                ▼
┌────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 6. THE EXPEDITER / DOCTOR AGENT (Telemetry & Self-Healing Monitor)                                     │
│ • Triggers the Fabric pipeline, polls status, intercepts tracebacks, and auto-patches runtime errors.  │
└────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Role Specifications of the 6 Micro-Agents

| Agent Role | Primary Responsibility | Input Context | Output Artifact |
| :--- | :--- | :--- | :--- |
| **1. The Maître D'** | Conversational UI & HITL approval handling | User chat prompt & approval button clicks | Structured Ingestion Request |
| **2. The Prep Chef** | Metadata scanning & RAG doc retrieval | Connection parameters & Source ID | Table Metadata Dict + RAG Doc Snippets |
| **3. The Executive Chef** | Medallion architecture & DAG topology planning | Table list, row counts, and primary keys | Ingestion Strategy Plan + Visual DAG JSON |
| **4. The Line Cook** | PySpark & Fabric definition compilation | Strategy Plan + SKILL.md templates | `notebook-content.py`, `pipeline-content.json` |
| **5. The Health Inspector**| Linter, secret scanner & compliance check | Generated code & target workspace ID | Passed Audit Flag or Linter Errors |
| **6. The Doctor / Expediter**| Pipeline execution & traceback self-healing | Job Status API logs & Spark driver tracebacks | Patch Diffs & Retry Commands |

---

## 5. Why This Eliminates Monolithic Prompt Failures

1. **Micro-Context Windows:** Each agent receives only the exact tokens needed for its specific task (~800 to 1,500 tokens), preventing context drift and hallucination.
2. **Modular Upgrades:** If Microsoft Fabric updates its pipeline JSON format, you only update the **RAG doc index** and the **Line Cook Agent's** prompt. The rest of the kitchen remains untouched.
3. **Surgical Self-Healing:** When a Spark job fails, the Doctor Agent isolates the single broken cell and asks the Line Cook to regenerate only that specific cell, rather than re-running the entire end-to-end pipeline.
