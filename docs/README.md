# Fabric AI: Enterprise Architecture & Platform Documentation

Welcome to the comprehensive technical documentation for **Fabric AI (Forge Studio)**—the autonomous, agentic Data Engineering and Infrastructure Provisioning Platform for Microsoft Fabric, Databricks, and Snowflake.

---

## 📚 Master Table of Contents

| Document | Title & Core Subject | Description |
| :--- | :--- | :--- |
| [01. Project Vision & Evolution](file:///c:/Harsith_Work/Fabric_AI/docs/01_PROJECT_VISION_AND_EVOLUTION.md) | **Vision, Origins & Evolutionary Journey** | The journey from the senior's 1,200-line static JSON starter kit to direct Fabric REST APIs, Bolt.new-style visual studio, closed-loop self-healing, and multi-cloud expansion. |
| [02. Architecture & End-to-End Flow](file:///c:/Harsith_Work/Fabric_AI/docs/02_ARCHITECTURE_AND_END_TO_END_FLOW.md) | **System Architecture & 10-Step Execution Flow** | Complete control plane vs. data plane architecture, subsystem breakdown, and security guardrail isolation. |
| [03. Skill System & MCP Connectors](file:///c:/Harsith_Work/Fabric_AI/docs/03_SKILL_SYSTEM_AND_MCP_CONNECTORS.md) | **Dynamic `skill.md` & MCP Connector Bundles** | Modular connector bundles (`SKILL.md`, `config_schema.json`, `connector_tools.py`) and autonomous self-skilling for new sources. |
| [04. Strategy Classifier & Code Generation](file:///c:/Harsith_Work/Fabric_AI/docs/04_STRATEGY_CLASSIFIER_AND_CODE_GENERATION.md) | **Ingestion Strategy Classifier & Compiler** | Zero-data metadata discovery, Full vs. Incremental heuristic classification, PySpark Delta Lake `MERGE` generation, and Data Factory JSON compilation. |
| [05. Monitoring & Self-Healing](file:///c:/Harsith_Work/Fabric_AI/docs/05_MONITORING_TELEMETRY_AND_SELF_HEALING.md) | **Telemetry, Monitoring & Closed-Loop Healing** | Fabric Jobs REST API polling, in-Lakehouse audit tables (`_fabric_ai_audit_log`), and the Deterministic Circuit Breaker self-healing engine. |
| [06. Governance & Simulation Sandbox](file:///c:/Harsith_Work/Fabric_AI/docs/06_GOVERNANCE_SECURITY_AND_SANDBOX.md) | **Enterprise Governance, Security & Local Sandbox** | Zero-secret scaffolding pattern (`notebookutils.getSecret()`), 4 HITL checkpoints, and the "Zero-Cloud" local DuckDB/Parquet table diff sandbox. |
| [07. Multi-Cloud Target Compilers](file:///c:/Harsith_Work/Fabric_AI/docs/07_MULTI_CLOUD_EXPANSION_AND_TARGET_COMPILERS.md) | **Universal Multi-Cloud Architecture** | One Brain, Multiple Compilers: 1-to-1 mapping for Microsoft Fabric, Databricks (DLT/DABs), and Snowflake (Dynamic Tables/Tasks). |
| [08. Packaging, Pricing & GTM](file:///c:/Harsith_Work/Fabric_AI/docs/08_ENTERPRISE_PACKAGING_PRICING_AND_GO_TO_MARKET.md) | **Capacity-Based Pricing & Go-to-Market Plan** | Generalized team capacity packaging (no seat penalties), Mid-Market ICP analysis, CFO headcount ROI math, and the 30-Day Founder Playbook. |
| [09. RAG Docs & Multi-Agent Kitchen](file:///c:/Harsith_Work/Fabric_AI/docs/09_RAG_ENGINE_AND_MULTI_AGENT_KITCHEN.md) | **RAG Documentation Engine & Agent Kitchen** | Local vector store for Fabric/PySpark specs and the 6 specialized micro-agents (Maître D', Prep, Executive Chef, Line Cook, Health Inspector, Doctor). |
| [10. Safety, Deletion & Liability](file:///c:/Harsith_Work/Fabric_AI/docs/10_SAFETY_BLAST_RADIUS_AND_LIABILITY.md) | **Blast-Radius Control, Deletion & Legal Protection** | Safe Deletion Protocol for stale items, Dependency audits, Soft-Delete definition snapshots, Delta Time-Travel recovery, and the Enterprise Shared Responsibility Model. |
| [11. Paradigm Benchmarks & Automation %](file:///c:/Harsith_Work/Fabric_AI/docs/11_PARADIGM_BENCHMARKS_AND_FABRIC_AUTOMATION_PERCENTAGE.md) | **Industry Paradigm Benchmarks & Fabric %** | Global landscape of "Metadata + API + Visual Canvas" tools (Terraform, Argo, n8n, dbt, Airflow, Figma) and the 95%–100% Microsoft Fabric automation scorecard. |

---

## 🚀 Quick Links to Workspace Code

- **Backend REST Server:** [server.py](file:///c:/Harsith_Work/Fabric_AI/server.py)
- **Fabric API Engine & Security Lock:** [fabric_ai_engine.py](file:///c:/Harsith_Work/Fabric_AI/fabric_ai_engine.py)
- **Ingestion Planner & DAG Builder:** [ingestion_planner.py](file:///c:/Harsith_Work/Fabric_AI/ingestion_planner.py)
- **Groq & LLM Orchestrator:** [groq_llm.py](file:///c:/Harsith_Work/Fabric_AI/groq_llm.py)
- **Base Connector Abstraction:** [connectors/base_connector.py](file:///c:/Harsith_Work/Fabric_AI/connectors/base_connector.py)
- **Azure SQL Connector:** [connectors/azure_sql_connector.py](file:///c:/Harsith_Work/Fabric_AI/connectors/azure_sql_connector.py)
- **Visual Flow SVG Canvas:** [flow_renderer.js](file:///c:/Harsith_Work/Fabric_AI/flow_renderer.js)
- **Web Studio Frontend:** [index.html](file:///c:/Harsith_Work/Fabric_AI/index.html) & [app.js](file:///c:/Harsith_Work/Fabric_AI/app.js)
- **Security Lock Configuration:** [config.json](file:///c:/Harsith_Work/Fabric_AI/config.json)
