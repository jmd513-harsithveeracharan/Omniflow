from __future__ import annotations

from typing import Any

CORE_STANDARDS: list[dict[str, Any]] = [
    {
        "standard_type": "NAMING_CONVENTION",
        "standard_name": "Medallion Asset Naming Standard",
        "target_layer": "ALL",
        "rule_markdown": "Bronze lakehouses use lh_<domain>_bronze, Silver use lh_<domain>_silver, Gold Warehouses use wh_<domain>_gold inside AI_Test_Folder.",
        "regex_pattern": "^(lh|wh)_[a-z0-9_]+_(bronze|silver|gold)$",
        "is_mandatory": True,
    },
    {
        "standard_type": "DATA_ENGINEERING",
        "standard_name": "Silver SCD2 & SHA-256 PII Governance",
        "target_layer": "SILVER",
        "rule_markdown": "All Silver PySpark notebooks must deduplicate on primary keys, apply SHA-256 masking to PII columns, and execute Delta Lake MERGE upserts.",
        "regex_pattern": "MERGE INTO",
        "is_mandatory": True,
    },
    {
        "standard_type": "DIMENSIONAL_MODELING",
        "standard_name": "Gold Kimball Star Schema & Direct Lake",
        "target_layer": "GOLD",
        "rule_markdown": "Gold layer must enforce surrogate keys on Dimension tables (dim_*) and Fact tables (fact_*) with Direct Lake Power BI semantic models.",
        "regex_pattern": "^(dim|fact)_[a-z0-9_]+$",
        "is_mandatory": True,
    },
]

CORE_AGENTS: list[dict[str, Any]] = [
    {
        "agent_name": "planner_agent",
        "display_name": "OmniFlow Architectural Planner Agent",
        "description": "Reads 50-100+ word natural language project plans and performs two-pass planning (Macro Phases -> Granular Steps).",
        "agent_type": "PLANNER",
        "model_provider": "azure_openai",
        "model_name": "omni-flow-gpt-6-luna",
        "system_prompt": (
            "You are the OmniFlow Planner Agent. Parse the natural-language project plan, query engineering standards "
            "from PostgreSQL, formulate Pass 1 Macro Architecture Phases, and refine them into Pass 2 Granular Engineering Steps."
        ),
    },
    {
        "agent_name": "task_organizer_agent",
        "display_name": "OmniFlow DAG Task Organizer Agent",
        "description": "Constructs the NetworkX dependency DAG, topological execution waves, and maps each task to its required tool.",
        "agent_type": "ORGANIZER",
        "model_provider": "azure_openai",
        "model_name": "omni-flow-gpt-6-luna",
        "system_prompt": (
            "You are the OmniFlow Task Organizer Agent. Convert planned engineering steps into a validated NetworkX "
            "Directed Acyclic Graph (DAG), assign topological sequence numbers, and map each task to its required execution tool."
        ),
    },
    {
        "agent_name": "tool_checker_agent",
        "display_name": "OmniFlow Tool Checker Agent",
        "description": "Audits the PostgreSQL tools registry and runtime for every task in the DAG and flags missing tools.",
        "agent_type": "TOOL_CHECKER",
        "model_provider": "azure_openai",
        "model_name": "omni-flow-gpt-6-luna",
        "system_prompt": (
            "You are the OmniFlow Tool Checker Agent. Inspect every task in the organized DAG, verify whether its "
            "required tool is registered in PostgreSQL and loaded in Python runtime, and report missing tools."
        ),
    },
    {
        "agent_name": "research_agent",
        "display_name": "OmniFlow Research & Tool Creator Agent",
        "description": "Researches missing capabilities, dynamically synthesizes Python tool implementations, and registers them in PostgreSQL.",
        "agent_type": "RESEARCHER",
        "model_provider": "azure_openai",
        "model_name": "omni-flow-gpt-6-luna",
        "system_prompt": (
            "You are the OmniFlow Research & Tool Creator Agent. When the Tool Checker flags missing tools, research "
            "the target Fabric API/schema, synthesize executable Python tool code, and register the new tool in PostgreSQL."
        ),
    },
    {
        "agent_name": "executor_agent",
        "display_name": "OmniFlow Worker & Artifact Executor Agent",
        "description": "Executes the DAG tasks in dependency order using registered tools to create JSON pipelines, PySpark notebooks, and SQL DDL.",
        "agent_type": "EXECUTOR",
        "model_provider": "azure_openai",
        "model_name": "omni-flow-gpt-6-luna",
        "system_prompt": (
            "You are the OmniFlow Executor Agent. Traverse the validated DAG in topological dependency order, invoke "
            "each task's bound tool to generate Fabric JSON definitions, PySpark code, and SQL scripts, and persist artifacts to PostgreSQL."
        ),
    },
    {
        "agent_name": "auditor_agent",
        "display_name": "OmniFlow Quality & Standards Auditor Agent",
        "description": "Audits generated artifacts for syntax correctness, PII masking compliance, and records defect findings to PostgreSQL.",
        "agent_type": "AUDITOR",
        "model_provider": "azure_openai",
        "model_name": "omni-flow-gpt-6-luna",
        "system_prompt": (
            "You are the OmniFlow Quality Auditor Agent. Inspect every generated artifact on disk, compile PySpark code "
            "with ast.parse to detect syntax errors, verify SHA-256 PII masking, and record findings to audit_findings."
        ),
    },
]

BASE_TOOLS: list[dict[str, Any]] = [
    {
        "tool_name": "execute_metadata_query_tool",
        "display_name": "PostgreSQL Dynamic SQL Metadata Explorer",
        "description": "Executes dynamic, read-only SQL SELECT queries against Neon PostgreSQL metadata catalog, standards, and memory.",
        "endpoint": "omniflow.agents.tool_registry.execute_metadata_query_tool",
        "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}, "required": ["query"]},
        "output_schema": {"type": "object", "properties": {"columns": {"type": "array"}, "rows": {"type": "array"}}},
        "agents": ["planner_agent", "executor_agent", "auditor_agent"],
    },
    {
        "tool_name": "query_standards_tool",
        "display_name": "PostgreSQL Engineering Standards Query Tool",
        "description": "Fetches active architecture and governance rules from the engineering_standards table.",
        "endpoint": "omniflow.agents.tool_registry.query_standards_tool",
        "input_schema": {"type": "object", "properties": {"layer": {"type": "string"}}},
        "output_schema": {"type": "object", "properties": {"rules": {"type": "array"}}},
        "agents": ["planner_agent", "auditor_agent"],
    },
    {
        "tool_name": "search_database_catalog_tool",
        "display_name": "PostgreSQL Multi-Source Catalog Search Tool",
        "description": "Searches data_sources and tables to discover matching candidate tables without overloading context.",
        "endpoint": "omniflow.agents.tool_registry.search_database_catalog_tool",
        "input_schema": {"type": "object", "properties": {"query": {"type": "string"}}},
        "output_schema": {"type": "object", "properties": {"tables": {"type": "array"}}},
        "agents": ["planner_agent", "executor_agent"],
    },
    {
        "tool_name": "get_table_schema_and_lineage_tool",
        "display_name": "PostgreSQL Schema, PII & Lineage Retriever",
        "description": "Retrieves exact column types, primary keys, PII sensitivity flags, and foreign key relationships.",
        "endpoint": "omniflow.agents.tool_registry.get_table_schema_and_lineage_tool",
        "input_schema": {"type": "object", "properties": {"table_names": {"type": "array"}}},
        "output_schema": {"type": "object", "properties": {"schemas": {"type": "array"}}},
        "agents": ["planner_agent", "executor_agent", "auditor_agent"],
    },
    {
        "tool_name": "query_governance_and_compliance_policies_tool",
        "display_name": "PostgreSQL Mandatory Governance Policies Retriever",
        "description": "Fetches active data governance policies, PII encryption rules, and architectural standards.",
        "endpoint": "omniflow.agents.tool_registry.query_governance_and_compliance_policies_tool",
        "input_schema": {"type": "object", "properties": {"project_code": {"type": "string"}}},
        "output_schema": {"type": "object", "properties": {"policies": {"type": "array"}}},
        "agents": ["planner_agent", "auditor_agent"],
    },
    {
        "tool_name": "query_project_memory_and_decisions_tool",
        "display_name": "PostgreSQL Project Memory & ADR Retriever",
        "description": "Queries approved Architecture Decision Records (ADRs), constraints, and historical memory.",
        "endpoint": "omniflow.agents.tool_registry.query_project_memory_and_decisions_tool",
        "input_schema": {"type": "object", "properties": {"project_code": {"type": "string"}}},
        "output_schema": {"type": "object", "properties": {"decisions": {"type": "array"}}},
        "agents": ["planner_agent", "executor_agent"],
    },
    {
        "tool_name": "validate_dag_tool",
        "display_name": "NetworkX DAG Topological Validator",
        "description": "Builds a NetworkX DiGraph from steps, checks is_directed_acyclic_graph, and computes execution waves.",
        "endpoint": "omniflow.agents.tool_registry.validate_dag_tool",
        "input_schema": {"type": "object", "properties": {"steps": {"type": "array"}}},
        "output_schema": {"type": "object", "properties": {"is_acyclic": {"type": "boolean"}}},
        "agents": ["task_organizer_agent"],
    },
    {
        "tool_name": "get_table_schema_context_tool",
        "display_name": "PostgreSQL Catalog Table Schema Retriever",
        "description": "Queries Neon PostgreSQL catalog (tables + columns) for real column data types, primary keys, and PII flags.",
        "endpoint": "omniflow.agents.tool_registry.get_table_schema_context_tool",
        "input_schema": {"type": "object", "properties": {"table_names": {"type": "array"}}},
        "output_schema": {"type": "array"},
        "agents": ["executor_agent", "auditor_agent"],
    },
    {
        "tool_name": "inspect_workspace_folders_tool",
        "display_name": "Workspace Local Folders Inspector",
        "description": "Inspects local workspace folders to verify .platform files and directory structures.",
        "endpoint": "omniflow.agents.tool_registry.inspect_workspace_folders_tool",
        "input_schema": {"type": "object", "properties": {"folder_path": {"type": "string"}}},
        "output_schema": {"type": "object"},
        "agents": ["executor_agent", "auditor_agent"],
    },
    {
        "tool_name": "verify_fabric_workspace_connection_tool",
        "display_name": "Microsoft Fabric REST API Cloud Verifier",
        "description": "Validates live Microsoft Fabric REST API connectivity using the active Azure CLI token.",
        "endpoint": "omniflow.agents.tool_registry.verify_fabric_workspace_connection_tool",
        "input_schema": {"type": "object", "properties": {"workspace_id": {"type": "string"}}},
        "output_schema": {"type": "object"},
        "agents": ["executor_agent", "auditor_agent"],
    },
    {
        "tool_name": "build_workspace_manifest_tool",
        "display_name": "Fabric Workspace & Medallion Lakehouse Manifest Builder",
        "description": "Generates the Fabric workspace containment folder and Bronze/Silver/Gold capacity provisioning JSON.",
        "endpoint": "omniflow.agents.tool_registry.build_workspace_manifest_tool",
        "input_schema": {"type": "object", "properties": {"project_code": {"type": "string"}}},
        "output_schema": {"type": "object", "properties": {"manifest": {"type": "object"}}},
        "agents": ["executor_agent"],
    },
    {
        "tool_name": "build_adf_pipeline_json_tool",
        "display_name": "Fabric Data Factory Copy Pipeline JSON Generator",
        "description": "Generates native Fabric Data Pipeline JSON definition for relational and CRM batch ingestion into Bronze.",
        "endpoint": "omniflow.agents.tool_registry.build_adf_pipeline_json_tool",
        "input_schema": {"type": "object", "properties": {"sources": {"type": "array"}}},
        "output_schema": {"type": "object", "properties": {"activities": {"type": "array"}}},
        "agents": ["executor_agent"],
    },
    {
        "tool_name": "build_pyspark_notebook_tool",
        "display_name": "Silver PySpark SCD2 & PII Masking Notebook Generator",
        "description": "Generates executable Fabric PySpark notebook code with SHA-256 PII masking and Delta Lake MERGE.",
        "endpoint": "omniflow.agents.tool_registry.build_pyspark_notebook_tool",
        "input_schema": {"type": "object", "properties": {"sources": {"type": "array"}}},
        "output_schema": {"type": "object", "properties": {"notebook_code": {"type": "string"}}},
        "agents": ["executor_agent"],
    },
    {
        "tool_name": "build_warehouse_ddl_tool",
        "display_name": "Gold Warehouse Kimball Star Schema T-SQL DDL Generator",
        "description": "Generates T-SQL DDL scripts for Dimension and Fact tables in the Gold Fabric Data Warehouse.",
        "endpoint": "omniflow.agents.tool_registry.build_warehouse_ddl_tool",
        "input_schema": {"type": "object", "properties": {"project_code": {"type": "string"}}},
        "output_schema": {"type": "object", "properties": {"sql_ddl": {"type": "string"}}},
        "agents": ["executor_agent"],
    },
    {
        "tool_name": "deploy_fabric_item_tool",
        "display_name": "Generic Microsoft Fabric REST API Item Provisioner",
        "description": "Unified single REST tool to create ANY Fabric item (Lakehouse, Notebook, Warehouse, Pipeline, SemanticModel) via POST /v1/workspaces/{id}/items.",
        "endpoint": "omniflow.agents.tool_registry.deploy_fabric_item_tool",
        "input_schema": {
            "type": "object",
            "properties": {
                "display_name": {"type": "string"},
                "item_type": {"type": "string"},
                "workspace_id": {"type": "string"},
                "definition": {"type": "object"},
            },
            "required": ["display_name", "item_type"],
        },
        "output_schema": {"type": "object", "properties": {"status": {"type": "string"}, "item_id": {"type": "string"}}},
        "agents": ["executor_agent"],
    },
    {
        "tool_name": "build_direct_lake_bim_tool",
        "display_name": "Power BI Direct Lake Tabular Model Generator",
        "description": "Generates Power BI Direct Lake Tabular Model (.bim) JSON definition with relationships and business measures.",
        "endpoint": "omniflow.agents.tool_registry.build_direct_lake_bim_tool",
        "input_schema": {"type": "object", "properties": {"project_code": {"type": "string"}, "domain": {"type": "string"}}},
        "output_schema": {"type": "object", "properties": {"definition": {"type": "object"}}},
        "agents": ["executor_agent"],
    },
    {
        "tool_name": "build_data_quality_suite_tool",
        "display_name": "Automated Data Quality & Reconciliation Suite Generator",
        "description": "Generates executable PySpark test suites for row count reconciliation (<0.5%), primary key uniqueness, and null rejection.",
        "endpoint": "omniflow.agents.tool_registry.build_data_quality_suite_tool",
        "input_schema": {"type": "object", "properties": {"project_code": {"type": "string"}, "tables": {"type": "array"}}},
        "output_schema": {"type": "object", "properties": {"code": {"type": "string"}}},
        "agents": ["executor_agent", "auditor_agent"],
    },
    {
        "tool_name": "record_lineage_graph_tool",
        "display_name": "End-to-End Asset Lineage & Blast-Zone Recorder",
        "description": "Builds NetworkX DAG from Source -> Bronze -> Silver -> Gold -> Power BI and records edges in PostgreSQL.",
        "endpoint": "omniflow.agents.tool_registry.record_lineage_graph_tool",
        "input_schema": {"type": "object", "properties": {"project_code": {"type": "string"}, "tables": {"type": "array"}}},
        "output_schema": {"type": "object", "properties": {"total_nodes": {"type": "integer"}, "total_edges": {"type": "integer"}}},
        "agents": ["executor_agent", "auditor_agent"],
    },
    {
        "tool_name": "trigger_fabric_job_tool",
        "display_name": "Fabric Job Instance Execution Trigger",
        "description": "Triggers an asynchronous cloud job execution for a Notebook, DataPipeline, or SemanticModel in Microsoft Fabric.",
        "endpoint": "omniflow.agents.tool_registry.trigger_fabric_job_tool",
        "input_schema": {
            "type": "object",
            "properties": {
                "item_id": {"type": "string"},
                "item_type": {"type": "string"},
                "parameters": {"type": "object"},
            },
            "required": ["item_id"],
        },
        "output_schema": {"type": "object", "properties": {"success": {"type": "boolean"}, "job_id": {"type": "string"}}},
        "agents": ["executor_agent"],
    },
    {
        "tool_name": "poll_fabric_job_status_tool",
        "display_name": "Fabric Job Status Poller",
        "description": "Polls the live execution status, start/end timestamps, and failure reasons of an active Fabric job instance.",
        "endpoint": "omniflow.agents.tool_registry.poll_fabric_job_status_tool",
        "input_schema": {
            "type": "object",
            "properties": {"item_id": {"type": "string"}, "job_id": {"type": "string"}},
            "required": ["item_id", "job_id"],
        },
        "output_schema": {"type": "object", "properties": {"status": {"type": "string"}, "failure_reason": {"type": "object"}}},
        "agents": ["executor_agent"],
    },
    {
        "tool_name": "execute_fabric_job_and_poll_tool",
        "display_name": "Fabric Job Run & Active Poller",
        "description": "Executes a Fabric item (Notebook, Pipeline) and actively polls its status until completion or failure with timeout handling.",
        "endpoint": "omniflow.agents.tool_registry.execute_fabric_job_and_poll_tool",
        "input_schema": {
            "type": "object",
            "properties": {
                "item_id": {"type": "string"},
                "item_type": {"type": "string"},
                "timeout_seconds": {"type": "integer"},
                "poll_interval_seconds": {"type": "integer"},
            },
            "required": ["item_id"],
        },
        "output_schema": {"type": "object", "properties": {"success": {"type": "boolean"}, "status": {"type": "string"}}},
        "agents": ["executor_agent"],
    },
    {
        "tool_name": "debug_failed_notebook_tool",
        "display_name": "Autonomous Self-Healing Notebook Debugger",
        "description": "Diagnoses Fabric PySpark job failure trace using LLM, synthesizes corrected code, compiles, and updates Fabric notebook definition in-place.",
        "endpoint": "omniflow.agents.tool_registry.debug_failed_notebook_tool",
        "input_schema": {
            "type": "object",
            "properties": {
                "item_id": {"type": "string"},
                "notebook_name": {"type": "string"},
                "original_code": {"type": "string"},
                "error_message": {"type": "string"},
                "lakehouse_name": {"type": "string"},
            },
            "required": ["item_id", "notebook_name", "original_code", "error_message"],
        },
        "output_schema": {"type": "object", "properties": {"success": {"type": "boolean"}, "diagnosis": {"type": "string"}, "corrected_code": {"type": "string"}}},
        "agents": ["executor_agent"],
    },
]

