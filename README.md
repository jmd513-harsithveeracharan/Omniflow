# OmniFlow â€” Microsoft Fabric Autonomous Multi-Agent Data Platform

OmniFlow is an enterprise-grade multi-agent autonomous framework that translates natural language project specifications and enterprise data catalogs into production-ready Microsoft Fabric Medallion Lakehouses, PySpark notebooks, Kimball star schemas, and Power BI Direct Lake models.

## Multi-Agent Architecture

OmniFlow coordinates a specialized roster of dynamic agents persisted in Neon PostgreSQL:

1. **Planner Agent (`planner_agent`)**: 2-pass architectural formulation (macro phases to granular engineering tasks).
2. **Task Organizer Agent (`task_organizer_agent`)**: NetworkX Directed Acyclic Graph (DAG) construction, topological wave calculation, and critical path analysis.
3. **Tool Checker Agent (`tool_checker_agent`)**: Two-pass schema verification against PostgreSQL tool registry and runtime bindings.
4. **Research Agent (`research_agent`)**: Autonomous on-demand tool synthesis with AST security guardrails when missing tools are detected in the DAG.
5. **Executor Agent (`executor_agent`)**: Topological wave execution generating verified PySpark notebooks, T-SQL DDL, Data Pipelines, and Tabular Object Models.
6. **Auditor Agent (`auditor_agent`)**: AST syntax verification, SHA-256 PII masking compliance, and Delta Lake ACID merge auditing.
7. **Fabric Deployer**: Direct Microsoft Fabric REST API integration deploying items into workspace containment folders.

## Project Structure

```
Omniflow/
â”œâ”€â”€ omniflow/
â”‚   â”œâ”€â”€ agents/          # Agent implementations & runtime schemas
â”‚   â”œâ”€â”€ config/          # PostgreSQL registry bootstrap seeders
â”‚   â”œâ”€â”€ db/              # Neon PostgreSQL repository & execution logger
â”‚   â”œâ”€â”€ intake/          # Project intake JSON specifications & models
â”‚   â”œâ”€â”€ tools/           # Fabric deployer, guardrails, & catalog introspection
â”‚   â”œâ”€â”€ ui/              # Rich terminal execution dashboard
â”‚   â””â”€â”€ test_trio.py     # Master entry point CLI
â”œâ”€â”€ docs/                # Architecture specifications & walkthrough guides
â”œâ”€â”€ .gitignore
â”œâ”€â”€ requirements.txt
â””â”€â”€ README.md
```

## Quickstart

```bash
# Run with a project intake specification
python omniflow/test_trio.py --intake omniflow/intake/project_intake_healthcare.json
```
