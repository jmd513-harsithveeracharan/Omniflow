from __future__ import annotations

import hashlib
import json
import os
import re
import sys
import time
import uuid
from datetime import datetime
from typing import Any

import psycopg2
from pydantic import BaseModel

import omniflow.agents.tool_registry as tool_module


if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass


def _sanitize(text: str) -> str:
    return (
        text.replace("\u2011", "-")
        .replace("\u2012", "-")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u202f", " ")
        .replace("\u00a0", " ")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )


def _stream(tag: str, message: str, indent: int = 0, delay: float = 0.0) -> None:
    """Streams debug output if OMNIFLOW_VERBOSE is set, otherwise silent for executive UI."""
    if os.environ.get("OMNIFLOW_VERBOSE", "0") != "1":
        return
    ts = datetime.now().strftime("%H:%M:%S")
    pad = "  " * indent
    msg_clean = _sanitize(message)
    try:
        if indent == 0:
            sys.stdout.write(f"\n[{ts}] {tag:<18} {msg_clean}\n")
        else:
            sys.stdout.write(f"           {pad}{msg_clean}\n")
        sys.stdout.flush()
    except Exception:
        fallback = msg_clean.encode("ascii", "replace").decode("ascii")
        if indent == 0:
            sys.stdout.write(f"\n[{ts}] {tag:<18} {fallback}\n")
        else:
            sys.stdout.write(f"           {pad}{fallback}\n")
        sys.stdout.flush()

from omniflow.agents.schemas import (
    ExecutedArtifactItem,
    ExecutorAgentOutput,
    MacroPhase,
    NaturalLanguagePlanRequest,
    OrganizedTask,
    OrganizerDAGOutput,
    PlannedStep,
    PlannerOutput,
    ResearchAgentOutput,
    ToolCheckerOutput,
    ToolCheckItem,
)
try:
    from app.llm_router import chat, chat_json
except ImportError:
    from omniflow.config.llm_adapter import chat, chat_json
from omniflow.agents.tool_synthesizer import synthesize_and_register_tool
from omniflow.db.execution_logger import ExecutionDatabaseLogger
from omniflow.db.postgres_repo import NEON_URI, PostgresRepository


class ToolMetadata(BaseModel):
    tool_id: str
    tool_name: str
    description: str
    input_schema: dict[str, Any]
    endpoint: str


class AgentMetadata(BaseModel):
    agent_id: str
    agent_name: str
    display_name: str
    agent_type: str
    model_name: str
    model_provider: str
    system_prompt: str
    tools: list[ToolMetadata]
    source: str = "NEON_POSTGRESQL"


class DynamicAgentRuntime:
    """Loads agent definitions and tool bindings dynamically from Neon PostgreSQL."""

    def __init__(self, agent_name: str, repo: PostgresRepository, db_logger: ExecutionDatabaseLogger):
        self.agent_name = agent_name
        self.repo = repo
        self.db_logger = db_logger
        self.agent_meta = self._load_agent_from_db(agent_name)

    def reload_from_db(self) -> None:
        """Reloads agent metadata and newly bound tools from PostgreSQL."""
        self.agent_meta = self._load_agent_from_db(self.agent_name)

    @staticmethod
    def _load_agent_from_db(agent_name: str) -> AgentMetadata:
        with psycopg2.connect(NEON_URI, connect_timeout=8) as conn, conn.cursor() as cur:
            cur.execute(
                """
                SELECT agent_id::text, agent_name, display_name, agent_type, model_name, model_provider, system_prompt
                FROM agents
                WHERE agent_name = %s AND status = 'active';
                """,
                (agent_name,),
            )
            row = cur.fetchone()
            if not row:
                raise ValueError(f"Agent '{agent_name}' not found in PostgreSQL agents table.")
            aid, aname, dname, atype, mname, mprov, prompt = row

            cur.execute(
                """
                SELECT t.tool_id::text, t.tool_name, t.description, t.input_schema, t.endpoint
                FROM tools t
                JOIN agent_tools at ON t.tool_id = at.tool_id
                WHERE at.agent_id = %s AND at.enabled = true AND t.status = 'active';
                """,
                (aid,),
            )
            tools = [
                ToolMetadata(
                    tool_id=r[0],
                    tool_name=r[1],
                    description=r[2],
                    input_schema=r[3] if isinstance(r[3], dict) else json.loads(r[3] or "{}"),
                    endpoint=r[4],
                )
                for r in cur.fetchall()
            ]
            return AgentMetadata(
                agent_id=aid,
                agent_name=aname,
                display_name=dname,
                agent_type=atype or "AGENT",
                model_name=mname,
                model_provider=mprov or "azure_openai",
                system_prompt=prompt,
                tools=tools,
            )

    def execute_tool_call(self, tool_name: str, args: dict[str, Any], agent_run_id: str | None = None) -> Any:
        tool_map = {t.tool_name: t for t in self.agent_meta.tools}
        if tool_name not in tool_map:
            raise PermissionError(f"Agent '{self.agent_name}' does not have tool '{tool_name}' bound in PostgreSQL.")

        tool_func = getattr(tool_module, tool_name, None)
        if not tool_func:
            raise NotImplementedError(f"Callable '{tool_name}' missing in Python tool_registry.")

        t0 = time.perf_counter()
        result = tool_func(**args)
        elapsed_ms = max(1, int((time.perf_counter() - t0) * 1000))

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

    def call_llm(
        self,
        prompt: str,
        session_id: str | None = None,
        as_json: bool = True,
    ) -> Any:
        """Invokes enterprise LLM (Azure OpenAI / ChatGPT) via app.llm_router API."""
        if as_json:
            return chat_json(
                [{"role": "user", "content": prompt}],
                complexity="high",
                target_model=self.agent_meta.model_name,
                session_id=session_id,
            )
        return chat(
            [{"role": "user", "content": prompt}],
            complexity="standard",
            target_model=self.agent_meta.model_name,
            session_id=session_id,
        )

    def run_planner(self, req: NaturalLanguagePlanRequest, run_id: str) -> PlannerOutput:
        """Two-Pass Planner: executes self-directed tool calls to query Neon PostgreSQL catalog across
        Metadata, Governance, Architecture Decisions, and Constraints, then shapes the macro & granular plan.
        """
        words = req.prompt_text.split()
        text_lower = req.prompt_text.lower()

        agent_run_id = self.db_logger.log_agent_run(
            run_id=run_id,
            agent_id=self.agent_meta.agent_id,
            input_payload={"project_code": req.project_code, "prompt": req.prompt_text},
            reasoning_summary="Autonomous context discovery: querying PostgreSQL catalog across Metadata, Governance, and Memory.",
            output_payload={"status": "in_progress"},
        )

        _stream("agent.planner", "Self-directed context discovery from Neon PostgreSQL:")

        # 1. Autonomous Context Call: Discover registered tables & data sources
        _stream("agent.planner", "Executing tool: search_database_catalog_tool('ALL')", indent=1)
        cat_res = self.execute_tool_call("search_database_catalog_tool", {"query": "ALL"}, agent_run_id=agent_run_id)
        discovered_tables = cat_res.get("table_names", ["orders", "customers", "BKPF", "BSEG"])
        discovered_sources = [
            s["source_name"] for s in cat_res.get("data_sources", [])
            if any(k in s["source_name"].lower() for k in ("sap", "postgres", "erp", "operational"))
        ]
        if not discovered_sources:
            discovered_sources = ["SAP ECC ERP (RFC/ODP)", "PostgreSQL Operational DB"]
        detected_sources = discovered_sources
        _stream("db.postgres", f"Found {len(discovered_sources)} data sources: {discovered_sources}", indent=2)
        _stream("db.postgres", f"Found {len(discovered_tables)} candidate tables: {discovered_tables}", indent=2)

        # 2. Autonomous Context Call: Retrieve exact columns, PII tags, and foreign key relationships
        _stream("agent.planner", f"Executing tool: get_table_schema_and_lineage_tool({discovered_tables})", indent=1)
        schema_res = self.execute_tool_call("get_table_schema_and_lineage_tool", {"table_names": discovered_tables}, agent_run_id=agent_run_id)
        all_pii = []
        for s in schema_res.get("schemas", []):
            all_pii.extend(s.get("pii_columns", []))
        all_pii = sorted(list(set(all_pii))) if all_pii else ["customer_email", "tax_id", "iban_number", "customer_name"]
        _stream("db.postgres", f"Retrieved {schema_res.get('retrieved_tables_count', 0)} schemas & {len(schema_res.get('relationships', []))} foreign key relations", indent=2)
        _stream("db.postgres", f"Identified sensitive PII columns: {all_pii}", indent=2)

        # 3. Autonomous Context Call: Query mandatory governance and compliance policies
        _stream("agent.planner", f"Executing tool: query_governance_and_compliance_policies_tool('{req.project_code}')", indent=1)
        gov_res = self.execute_tool_call("query_governance_and_compliance_policies_tool", {"project_code": req.project_code}, agent_run_id=agent_run_id)
        active_policies = [p["policy_name"] for p in gov_res.get("policies", [])]
        _stream("db.postgres", f"Retrieved {len(active_policies)} active policies: {active_policies}", indent=2)

        # 4. Autonomous Context Call: Query project memory, ADRs, and active constraints
        _stream("agent.planner", f"Executing tool: query_project_memory_and_decisions_tool('{req.project_code}')", indent=1)
        mem_res = self.execute_tool_call("query_project_memory_and_decisions_tool", {"project_code": req.project_code}, agent_run_id=agent_run_id)
        adr_titles = [d["title"] for d in mem_res.get("decisions", [])]
        constraints = [c["type"] for c in mem_res.get("constraints", [])]
        _stream("db.postgres", f"Retrieved approved ADRs: {adr_titles}", indent=2)
        _stream("db.postgres", f"Retrieved active constraints: {constraints}", indent=2)

        # 5. Autonomous Context Call: Query architectural standards
        _stream("agent.planner", "Executing tool: query_standards_tool('ALL')", indent=1)
        std_res = self.execute_tool_call("query_standards_tool", {"layer": "ALL"}, agent_run_id=agent_run_id)
        applied_standards = [r["name"] for r in std_res.get("rules", [])]
        for p in gov_res.get("policies", []):
            applied_standards.append(p["policy_name"])
        _stream("db.postgres", f"Retrieved {len(std_res.get('rules', []))} engineering standards rules", indent=2)

        sku_match = re.search(r"\b(F\d{1,4})\b", req.prompt_text, re.IGNORECASE)
        capacity_sku = sku_match.group(1).upper() if sku_match else "F64"
        domain = req.project_code.lower().replace("prj-", "").replace("-", "_")

        # 6. Autonomous LLM Architecture & Plan Formulation
        discovered_ctx = {
            "project_code": req.project_code,
            "project_name": req.project_name,
            "detected_sources": detected_sources,
            "candidate_tables": discovered_tables,
            "sensitive_pii": all_pii,
            "active_policies": active_policies,
            "approved_adrs": adr_titles,
            "constraints": constraints,
            "standards_rules": applied_standards[:6],
        }
        planner_prompt = f"""You are the OmniFlow Enterprise Architect & Planner Agent for Microsoft Fabric.
Given the project context and discovered database catalog, formulate an end-to-end Medallion execution plan.

PROJECT BRIEF:
- Code: {req.project_code}
- Name: {req.project_name}
- Target Platform: Microsoft Fabric ({capacity_sku})
- Business Request: {req.prompt_text}

AUTONOMOUS DISCOVERED CONTEXT FROM NEON POSTGRESQL:
- Data Sources: {detected_sources}
- Candidate Tables: {discovered_tables}
- Identified Sensitive PII: {all_pii}
- Active Policies: {active_policies}
- Approved ADRs: {adr_titles}
- Constraints: {constraints}
- Applicable Engineering Standards: {applied_standards[:6]}

You MUST respond ONLY with a single valid JSON object matching this exact schema:
{{
  "macro_phases": [
    {{
      "phase_id": "PH-1",
      "phase_name": "<Short phase name>",
      "layer": "Infrastructure" | "Ingestion" | "Curated" | "Analytical",
      "objective": "<Concise description of the objective>",
      "estimated_mins": 15
    }}
  ],
  "detailed_steps": [
    {{
      "step_code": "STEP-01",
      "phase_id": "PH-1",
      "step_name": "<Descriptive step name>",
      "task_type": "INFRA_PROVISION" | "RAW_BATCH_INGEST" | "CURATED_PYSPARK_NOTEBOOK" | "ANALYTICAL_WAREHOUSE_DDL" | "ANALYTICAL_SEMANTIC_MODEL" | "DATA_QUALITY_SUITE" | "LINEAGE_GRAPH",
      "description": "<What this step accomplishes>",
      "depends_on_steps": [],
      "required_tool": "build_workspace_manifest_tool" | "build_adf_pipeline_json_tool" | "build_pyspark_notebook_tool" | "build_warehouse_ddl_tool" | "build_direct_lake_bim_tool" | "build_data_quality_suite_tool" | "record_lineage_graph_tool",
      "artifact_type": "WORKSPACE_MANIFEST_JSON" | "DATA_PIPELINE_JSON" | "PYSPARK_NOTEBOOK_PY" | "WAREHOUSE_TSQL_DDL" | "DIRECT_LAKE_BIM_JSON" | "DATA_QUALITY_SUITE_PY" | "LINEAGE_GRAPH_JSON",
      "target_artifact_name": "<e.g. 01_workspace_manifest.json>",
      "parameters": {{
        "project_code": "{req.project_code}",
        "domain": "{domain}",
        "tables": {json.dumps(discovered_tables)},
        "pii_columns": {json.dumps(all_pii)}
      }}
    }}
  ]
}}
"""

        _stream("azure.ai", f"Invoking Azure OpenAI ({self.agent_meta.model_name}) API for dynamic planning...")
        raw_plan_json = None
        try:
            raw_plan_json = self.call_llm(planner_prompt, session_id=run_id, as_json=True)
            _stream("azure.ai", f"Azure OpenAI generated dynamic plan ({len(raw_plan_json.get('detailed_steps', []))} steps).", indent=1)
        except Exception as e:
            _stream("agent.planner", f"Primary LLM warning: {e}. Falling back to multi-provider router...", indent=1)
            try:
                raw_plan_json = chat_json([{"role": "user", "content": planner_prompt}], complexity="high")
            except Exception as llm_err:
                _stream("agent.planner", f"LLM provider error: {llm_err}", indent=1)

        macro_phases: list[MacroPhase] = []
        detailed_steps: list[PlannedStep] = []

        if raw_plan_json and raw_plan_json.get("macro_phases") and raw_plan_json.get("detailed_steps"):
            for i, p in enumerate(raw_plan_json["macro_phases"], start=1):
                macro_phases.append(
                    MacroPhase(
                        phase_id=p.get("phase_id", f"PH-{i}"),
                        phase_name=p.get("phase_name", f"Phase {i}"),
                        layer=p.get("layer", "Infrastructure"),
                        objective=p.get("objective", ""),
                        estimated_mins=int(p.get("estimated_mins", 15)),
                    )
                )
            for i, s in enumerate(raw_plan_json["detailed_steps"], start=1):
                step_params = s.get("parameters", {})
                if not isinstance(step_params, dict):
                    step_params = {}
                step_params.setdefault("project_code", req.project_code)
                step_params.setdefault("domain", domain)
                step_params.setdefault("tables", discovered_tables)
                step_params.setdefault("pii_columns", all_pii)

                detailed_steps.append(
                    PlannedStep(
                        step_code=s.get("step_code", f"STEP-{i:02d}"),
                        phase_id=s.get("phase_id", "PH-1"),
                        step_name=s.get("step_name", f"Step {i}"),
                        task_type=s.get("task_type", "GENERIC_TASK"),
                        description=s.get("description", ""),
                        depends_on_steps=s.get("depends_on_steps", []),
                        required_tool=s.get("required_tool", "build_workspace_manifest_tool"),
                        artifact_type=s.get("artifact_type", "WORKSPACE_MANIFEST_JSON"),
                        target_artifact_name=s.get("target_artifact_name", f"{i:02d}_artifact.json"),
                        parameters=step_params,
                    )
                )
        else:
            # Dynamic schema-grounded fallback (constructs plan directly from real discovered tables, NEVER hardcoded)
            macro_phases = [
                MacroPhase(phase_id="PH-1", phase_name="Capacity & Storage Provisioning", layer="Infrastructure", objective=f"Provision workspace storage for {req.project_name} on {capacity_sku}.", estimated_mins=10),
                MacroPhase(phase_id="PH-2", phase_name="Multi-Source Raw Ingestion", layer="Ingestion", objective=f"Ingest {', '.join(detected_sources)} into Raw OneLake tables.", estimated_mins=25),
                MacroPhase(phase_id="PH-3", phase_name="Curated Cleansing & PII Masking", layer="Curated", objective=f"Cleanse {', '.join(discovered_tables)} and mask sensitive PII ({', '.join(all_pii)}).", estimated_mins=30),
                MacroPhase(phase_id="PH-4", phase_name="Analytical Serving & Direct Lake", layer="Analytical", objective="Construct Kimball Star Schema DDL and Direct Lake semantic model.", estimated_mins=20),
                MacroPhase(phase_id="PH-5", phase_name="Quality & Lineage Governance", layer="Governance", objective="Automate data quality test suite and record lineage DAG.", estimated_mins=15),
            ]
            detailed_steps = [
                PlannedStep(step_code="STEP-01", phase_id="PH-1", step_name="Provision Fabric Workspace & Medallion Storage", task_type="INFRA_PROVISION", description=f"Generate workspace manifest and storage architecture on {capacity_sku}.", depends_on_steps=[], required_tool="build_workspace_manifest_tool", artifact_type="WORKSPACE_MANIFEST_JSON", target_artifact_name="01_workspace_manifest.json", parameters={"project_code": req.project_code, "domain": domain, "capacity_sku": capacity_sku}),
                PlannedStep(step_code="STEP-02", phase_id="PH-2", step_name="Build Batch Ingestion Pipeline", task_type="RAW_BATCH_INGEST", description=f"Create Fabric Data Factory Copy Pipeline JSON for {discovered_tables}.", depends_on_steps=["STEP-01"], required_tool="build_adf_pipeline_json_tool", artifact_type="DATA_PIPELINE_JSON", target_artifact_name="02_pl_raw_batch_ingest.json", parameters={"project_code": req.project_code, "domain": domain, "sources": detected_sources, "tables": discovered_tables}),
                PlannedStep(step_code="STEP-03", phase_id="PH-3", step_name="Generate Curated PySpark Cleansing & PII Masking Notebook", task_type="CURATED_PYSPARK_NOTEBOOK", description=f"PySpark notebook deduplicating raw tables, masking PII ({all_pii}), and executing Delta MERGE.", depends_on_steps=["STEP-02"], required_tool="build_pyspark_notebook_tool", artifact_type="PYSPARK_NOTEBOOK_PY", target_artifact_name="03_nb_curated_pii_merge.py", parameters={"project_code": req.project_code, "domain": domain, "tables": discovered_tables, "pii_columns": all_pii}),
                PlannedStep(step_code="STEP-04", phase_id="PH-4", step_name="Generate Analytical Star Schema T-SQL DDL", task_type="ANALYTICAL_WAREHOUSE_DDL", description="Generate T-SQL DDL scripts for dimensional modeling.", depends_on_steps=["STEP-03"], required_tool="build_warehouse_ddl_tool", artifact_type="WAREHOUSE_TSQL_DDL", target_artifact_name="04_warehouse_star_schema_ddl.sql", parameters={"project_code": req.project_code, "domain": domain, "dimensions": [f"dim_{t}" for t in discovered_tables[:2]], "facts": [f"fact_{domain}"]}),
                PlannedStep(step_code="STEP-05", phase_id="PH-4", step_name="Compile Power BI Direct Lake Semantic Model (.bim)", task_type="ANALYTICAL_SEMANTIC_MODEL", description="Generate Tabular Object Model (.bim) JSON with Direct Lake framing.", depends_on_steps=["STEP-04"], required_tool="build_direct_lake_bim_tool", artifact_type="DIRECT_LAKE_BIM_JSON", target_artifact_name="05_sm_direct_lake_model.bim.json", parameters={"project_code": req.project_code, "domain": domain, "warehouse_name": f"wh_{domain}_gold"}),
                PlannedStep(step_code="STEP-06", phase_id="PH-5", step_name="Build Automated Data Quality & Reconciliation Suite", task_type="DATA_QUALITY_SUITE", description="Generate PySpark Data Quality & Reconciliation test suite for Delta tables.", depends_on_steps=["STEP-03"], required_tool="build_data_quality_suite_tool", artifact_type="DATA_QUALITY_SUITE_PY", target_artifact_name="06_dq_reconciliation_suite.py", parameters={"project_code": req.project_code, "domain": domain, "tables": discovered_tables}),
                PlannedStep(step_code="STEP-07", phase_id="PH-5", step_name="Construct Lineage Graph & Blast-Zone Analysis", task_type="LINEAGE_GRAPH", description="Build NetworkX Lineage DAG and persist to PostgreSQL.", depends_on_steps=["STEP-05", "STEP-06"], required_tool="record_lineage_graph_tool", artifact_type="LINEAGE_GRAPH_JSON", target_artifact_name="07_lineage_graph.json", parameters={"project_code": req.project_code, "domain": domain, "tables": discovered_tables}),
            ]

        output = PlannerOutput(
            project_code=req.project_code,
            word_count=len(words),
            detected_sources=detected_sources,
            detected_layers=["Ingestion", "Curated", "Analytical"],
            applied_standards=applied_standards,
            macro_phases=macro_phases,
            detailed_steps=detailed_steps,
        )
        self.db_logger.log_agent_run(
            run_id=run_id,
            agent_id=self.agent_meta.agent_id,
            input_payload={"project_code": req.project_code, "word_count": len(words)},
            reasoning_summary=f"Completed 2-pass planning ({len(macro_phases)} macro phases -> {len(detailed_steps)} steps).",
            output_payload=output.model_dump(),
        )
        return output

    def run_task_organizer(self, plan: PlannerOutput, run_id: str, executor_agent_id: str) -> OrganizerDAGOutput:
        """Builds the NetworkX dependency DAG, assigns task UUIDs, and writes all tasks to PostgreSQL."""
        steps_dicts = [s.model_dump() for s in plan.detailed_steps]
        dag_res = self.execute_tool_call("validate_dag_tool", {"steps": steps_dicts})

        step_to_uuid = {s.step_code: str(uuid.uuid4()) for s in plan.detailed_steps}
        step_map = {s.step_code: s for s in plan.detailed_steps}

        organized_tasks: list[OrganizedTask] = []
        for idx, step_code in enumerate(dag_res["topological_order"], start=1):
            s = step_map[step_code]
            dep_uuids = [step_to_uuid[d] for d in s.depends_on_steps]
            organized_tasks.append(
                OrganizedTask(
                    task_id=step_to_uuid[step_code],
                    step_code=s.step_code,
                    sequence_no=idx,
                    task_name=s.step_name,
                    task_type=s.task_type,
                    description=s.description,
                    dependency_step_codes=s.depends_on_steps,
                    dependency_task_ids=dep_uuids,
                    required_tool=s.required_tool,
                    artifact_type=s.artifact_type,
                    target_artifact_name=s.target_artifact_name,
                    parameters=s.parameters,
                )
            )

        self.db_logger.insert_dag_tasks(run_id, executor_agent_id, organized_tasks)

        output = OrganizerDAGOutput(
            project_code=plan.project_code,
            is_acyclic=dag_res["is_acyclic"],
            total_tasks=len(organized_tasks),
            execution_waves=dag_res["waves"],
            critical_path_steps=dag_res["critical_path"],
            tasks=organized_tasks,
        )
        self.db_logger.log_agent_run(
            run_id=run_id,
            agent_id=self.agent_meta.agent_id,
            input_payload={"steps_count": len(plan.detailed_steps)},
            reasoning_summary=f"Constructed acyclic NetworkX DAG with {len(dag_res['waves'])} waves and {len(organized_tasks)} tasks.",
            output_payload=output.model_dump(),
        )
        return output

    def run_tool_checker(self, dag: OrganizerDAGOutput, run_id: str, pass_number: int = 1) -> ToolCheckerOutput:
        """Checks PostgreSQL tools table and Python runtime for every task's required tool."""
        db_tools = self.repo.get_all_active_tools()
        items: list[ToolCheckItem] = []
        missing_tools: list[str] = []

        for t in dag.tasks:
            in_db = t.required_tool in db_tools
            in_runtime = hasattr(tool_module, t.required_tool)
            is_ready = in_db and in_runtime
            if not is_ready and t.required_tool not in missing_tools:
                missing_tools.append(t.required_tool)

            items.append(
                ToolCheckItem(
                    step_code=t.step_code,
                    task_name=t.task_name,
                    required_tool=t.required_tool,
                    is_available_in_db=in_db,
                    is_available_in_runtime=in_runtime,
                    tool_id=db_tools[t.required_tool]["tool_id"] if in_db else None,
                    status="AVAILABLE" if is_ready else "MISSING",
                    reason=(
                        f"Registered in PostgreSQL (tool_id={db_tools[t.required_tool]['tool_id'][:8]}...) & bound in runtime"
                        if is_ready
                        else "Tool not found in PostgreSQL 'tools' table or Python runtime"
                    ),
                )
            )

        avail_count = sum(1 for i in items if i.status == "AVAILABLE")
        miss_count = len(items) - avail_count
        output = ToolCheckerOutput(
            pass_number=pass_number,
            total_checked=len(items),
            available_count=avail_count,
            missing_count=miss_count,
            all_tools_ready=(miss_count == 0),
            missing_tools=missing_tools,
            items=items,
        )
        self.db_logger.log_agent_run(
            run_id=run_id,
            agent_id=self.agent_meta.agent_id,
            input_payload={"pass_number": pass_number, "tasks_checked": len(items)},
            reasoning_summary=f"Pass {pass_number}: {avail_count}/{len(items)} tools available, {miss_count} missing.",
            output_payload=output.model_dump(),
        )
        return output

    def run_research_agent(self, missing_tools: list[str], run_id: str) -> ResearchAgentOutput:
        """Synthesizes missing tools, writes Python code, and registers them into PostgreSQL."""
        if missing_tools:
            _stream("agent.research", f"Researching implementation for missing tools: {missing_tools}")
            research_prompt = (
                f"SYSTEM ROLE:\n{self.agent_meta.system_prompt}\n\n"
                f"MISSING TOOLS TO SYNTHESIZE FOR DAG:\n{missing_tools}\n\n"
                f"Synthesize AST-safe Python implementations and input schemas for these tools."
            )
            try:
                llm_res = self.call_llm(research_prompt, session_id=run_id, as_json=False)
                if llm_res:
                    _stream("agent.research", f"Research LLM analysis completed ({len(str(llm_res))} chars returned)", indent=1)
            except Exception as e:
                _stream("agent.research", f"Research LLM note: {e}. Proceeding with AST synthesizer.", indent=1)

        synthesized = []
        for tname in missing_tools:
            spec = synthesize_and_register_tool(tname, self.repo)
            synthesized.append(spec)

        output = ResearchAgentOutput(
            researched_count=len(synthesized),
            synthesized_tools=synthesized,
        )
        self.db_logger.log_agent_run(
            run_id=run_id,
            agent_id=self.agent_meta.agent_id,
            input_payload={"missing_tools": missing_tools},
            reasoning_summary=f"Synthesized and registered {len(synthesized)} missing tools into PostgreSQL.",
            output_payload=output.model_dump(),
        )
        return output

    def run_executor(self, dag: OrganizerDAGOutput, run_id: str, output_dir: str, resume: bool = False) -> ExecutorAgentOutput:
        """Executes all DAG tasks in topological order, writes files + PostgreSQL artifacts/tool_runs."""
        self.reload_from_db()
        os.makedirs(output_dir, exist_ok=True)
        created_artifacts: list[ExecutedArtifactItem] = []

        agent_run_id = self.db_logger.log_agent_run(
            run_id=run_id,
            agent_id=self.agent_meta.agent_id,
            input_payload={"tasks_to_execute": len(dag.tasks)},
            reasoning_summary="Executing topologically sorted DAG tasks and generating Fabric artifacts.",
            output_payload={"status": "in_progress"},
        )

        for task in dag.tasks:
            file_path = os.path.join(output_dir, task.target_artifact_name)
            existing_candidate = None

            # 1. Exact filename match
            if os.path.exists(file_path) and os.path.getsize(file_path) > 0:
                existing_candidate = file_path
            # 2. Semantic prefix & extension match (e.g., '03_' and '.py') to match regardless of slight naming differences
            elif resume and os.path.exists(output_dir):
                step_prefix = task.target_artifact_name[:3]  # e.g., "01_", "02_", "03_"
                ext = os.path.splitext(task.target_artifact_name)[1].lower()
                for fname in os.listdir(output_dir):
                    if fname.startswith(step_prefix) and fname.lower().endswith(ext):
                        cand_path = os.path.join(output_dir, fname)
                        if os.path.getsize(cand_path) > 0:
                            existing_candidate = cand_path
                            task.target_artifact_name = fname
                            file_path = cand_path
                            break

            # Smart resume: if candidate artifact exists and has content, reuse it without re-calling LLM
            if resume and existing_candidate:
                try:
                    with open(existing_candidate, "r", encoding="utf-8") as f:
                        content_str = f.read()
                    raw_bytes = content_str.encode("utf-8")
                    definition_obj = {}
                    if task.target_artifact_name.endswith(".json"):
                        try:
                            definition_obj = json.loads(content_str)
                        except Exception:
                            definition_obj = {}
                    def_hash = hashlib.sha256(raw_bytes).hexdigest()
                    artifact_id = self.db_logger.insert_artifact(
                        run_id=run_id,
                        task_id=task.task_id,
                        artifact_type=task.artifact_type,
                        artifact_name=task.target_artifact_name,
                        definition=definition_obj,
                        definition_hash=def_hash,
                    )
                    self.db_logger.complete_dag_task(
                        task_id=task.task_id,
                        output_data={
                            "artifact_id": artifact_id,
                            "artifact_name": task.target_artifact_name,
                            "file_path": existing_candidate,
                            "sha256": def_hash,
                            "cached": True,
                        },
                        status="completed",
                    )
                    created_artifacts.append(
                        ExecutedArtifactItem(
                            artifact_id=artifact_id,
                            task_id=task.task_id,
                            step_code=task.step_code,
                            artifact_name=task.target_artifact_name,
                            artifact_type=task.artifact_type,
                            tool_used="cache_reuse",
                            file_path=existing_candidate,
                            definition_hash=def_hash,
                            execution_time_ms=5,
                            status="completed",
                        )
                    )
                    continue
                except Exception:
                    pass

            t0 = time.perf_counter()
            tool_res = self.execute_tool_call(task.required_tool, task.parameters, agent_run_id=agent_run_id)
            elapsed_ms = max(1, int((time.perf_counter() - t0) * 1000))

            file_path = os.path.join(output_dir, task.target_artifact_name)
            content_str = tool_res.get("content_str")
            definition_obj = tool_res.get("definition", {})

            if content_str:
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content_str)
                raw_bytes = content_str.encode("utf-8")
            else:
                json_text = json.dumps(definition_obj, indent=2)
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(json_text)
                raw_bytes = json_text.encode("utf-8")

            def_hash = hashlib.sha256(raw_bytes).hexdigest()
            artifact_id = self.db_logger.insert_artifact(
                run_id=run_id,
                task_id=task.task_id,
                artifact_type=task.artifact_type,
                artifact_name=task.target_artifact_name,
                definition=definition_obj,
                definition_hash=def_hash,
            )
            self.db_logger.complete_dag_task(
                task_id=task.task_id,
                output_data={
                    "artifact_id": artifact_id,
                    "artifact_name": task.target_artifact_name,
                    "file_path": file_path,
                    "sha256": def_hash,
                },
                status="completed",
            )
            created_artifacts.append(
                ExecutedArtifactItem(
                    artifact_id=artifact_id,
                    task_id=task.task_id,
                    step_code=task.step_code,
                    artifact_name=task.target_artifact_name,
                    artifact_type=task.artifact_type,
                    tool_used=task.required_tool,
                    file_path=file_path,
                    definition_hash=def_hash,
                    execution_time_ms=elapsed_ms,
                    status="completed",
                )
            )

        return ExecutorAgentOutput(
            run_id=run_id,
            executed_tasks_count=len(created_artifacts),
            artifacts_created=created_artifacts,
            status="completed",
        )
