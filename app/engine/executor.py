"""
app/engine/executor.py
----------------------
Stage 5: Autonomous Closed-Loop Execution, Cyclic Self-Healing & Data Verification.
Deploys plans safely into AI_Test_Folder sandbox, triggers execution via Fabric Jobs API,
monitors progress, patches code upon cell failure, enforces Data Quality Gates, and validates live Delta tables.
"""

from __future__ import annotations

import re
import time
import uuid
from typing import Any
from pydantic import BaseModel, Field

from app.config import ALLOWED_WORKSPACE_ID
from app.deployment_executor import deploy_fabric_plan, DeploymentReport
from app.fabric_client import (
    trigger_pipeline_run,
    get_job_status,
    run_notebook,
    update_definition,
)
from app.fabric_compiler import compile_notebook
from app.engine.data_quality import evaluate_quality_gate
from app.engine.interactive_runner import run_single_notebook_interactive
from app.engine.polling import poll_fabric_job_adaptive
from app.engine.progress import set_progress_step
from app.engine.schema_resolver import resolve_table_schema
from app.self_healer import diagnose_and_patch_code


class ExecutionReport(BaseModel):
    run_id: str
    workspace_id: str
    folder: str
    status: str = "success"  # success | partial | failed | quality_gate_failed
    duration_sec: float = 0.0
    deployed_items: list[dict[str, Any]] = Field(default_factory=list)
    job_results: list[dict[str, Any]] = Field(default_factory=list)
    validation_results: list[dict[str, Any]] = Field(default_factory=list)
    healing_events: list[dict[str, Any]] = Field(default_factory=list)
    summary_markdown: str = ""


def _poll_job_completion(
    item_id: str,
    job_id: str,
    workspace_id: str,
    session_id: str | None = None,
    timeout_sec: int = 180,
    poll_interval_sec: int = 5,
    task_type: str = "notebook",
    target_name: str = "",
    is_first_run: bool = True,
    skip_initial_delay: bool = False,
) -> dict[str, Any]:
    """Polls a triggered Fabric job instance using the adaptive polling engine."""
    return poll_fabric_job_adaptive(
        item_id=item_id,
        job_id=job_id,
        workspace_id=workspace_id,
        task_type=task_type,
        session_id=session_id,
        is_first_run=is_first_run,
        target_name=target_name,
        custom_timeout_sec=timeout_sec,
        skip_initial_delay=skip_initial_delay or (poll_interval_sec < 1.0),
        get_status_fn=get_job_status,
    )


def execute_closed_loop(
    plan: dict[str, Any],
    workspace_id: str = ALLOWED_WORKSPACE_ID,
    session_id: str | None = None,
    max_heal_retries: int = 2,
    timeout_sec: int = 180,
) -> ExecutionReport:
    """
    Executes full closed loop: Deploy -> Trigger Run -> Poll & Heal -> Validate Quality & Data -> Report.
    Strictly isolated inside sandbox AI_Test_Folder/ to guarantee zero workspace pollution.
    """
    t_start = time.perf_counter()
    run_id = plan.get("run_id") or f"exec_{uuid.uuid4().hex[:8]}"
    folder = plan.get("folder") or "AI_Test_Folder"

    report = ExecutionReport(run_id=run_id, workspace_id=workspace_id, folder=folder)

    # 0. Pre-Flight Code Safety Guardrail (auto-remediate multi-part table targets)
    for nb in plan.get("notebooks", []):
        raw_code = nb.get("pyspark_code") or nb.get("pyspark") or ""
        if raw_code:
            fixed_code = re.sub(
                r'\.saveAsTable\(\s*["\'][a-zA-Z0-9_]+\.(?:dbo\.)?([a-zA-Z0-9_]+)["\']\s*\)',
                r".saveAsTable('\1')",
                raw_code,
            )
            if fixed_code != raw_code:
                nb["pyspark_code"] = fixed_code
                if "pyspark" in nb:
                    nb["pyspark"] = fixed_code

    # 1. Non-Destructive Deployment
    if session_id:
        set_progress_step(
            session_id,
            title="Deployed Sandbox Assets",
            detail=f"Provisioning Lakehouses, PySpark Notebooks, and Pipeline inside 'AI_Test_Folder/{folder}'...",
            status="in_progress",
            action="Deployed",
            badge="FAB",
            target=f"AI_Test_Folder/{folder}",
        )

    dep_report: DeploymentReport = deploy_fabric_plan(plan, workspace_id=workspace_id, session_id=session_id)
    report.deployed_items = [item.model_dump() for item in dep_report.deployed_items]

    pipeline_item = next((i for i in dep_report.deployed_items if i.item_type == "pipeline" and i.item_id), None)
    notebook_items = [i for i in dep_report.deployed_items if i.item_type == "notebook" and i.item_id]

    quality_gate_failed = False

    # 2. Trigger Execution & Self-Healing Loop
    if pipeline_item and pipeline_item.item_id:
        trigger_res = trigger_pipeline_run(pipeline_item.item_id, workspace_id=workspace_id)
        if trigger_res.get("success") and trigger_res.get("job_id"):
            job_id = trigger_res["job_id"]
            job_res = _poll_job_completion(
                pipeline_item.item_id,
                job_id,
                workspace_id,
                session_id=session_id,
                timeout_sec=timeout_sec if timeout_sec != 180 else 480,
                task_type="pipeline",
                target_name=pipeline_item.name,
            )
            report.job_results.append({
                "target": pipeline_item.name,
                "type": "pipeline",
                "job_id": job_id,
                **job_res,
            })
        else:
            report.job_results.append({
                "target": pipeline_item.name,
                "type": "pipeline",
                "success": False,
                "status": "TriggerFailed",
                "error": trigger_res.get("error"),
            })
    elif notebook_items:
        for idx, nb_item in enumerate(notebook_items):
            is_cold = (idx == 0)
            nb_name, nb_id = nb_item.name, nb_item.item_id
            nb_plan = next((n for n in plan.get("notebooks", []) if n.get("name") == nb_name), {})
            current_code = nb_plan.get("pyspark_code") or nb_plan.get("pyspark") or ""

            retry = 0
            while retry <= max_heal_retries:
                trig = run_notebook(nb_id, workspace_id=workspace_id)
                if not trig.get("success") or not trig.get("job_id"):
                    report.job_results.append({
                        "target": nb_name,
                        "type": "notebook",
                        "success": False,
                        "status": "TriggerFailed",
                        "error": trig.get("error"),
                    })
                    break

                job_id = trig["job_id"]
                poll_res = _poll_job_completion(
                    nb_id,
                    job_id,
                    workspace_id,
                    session_id=session_id,
                    timeout_sec=timeout_sec,
                    task_type="notebook_cold" if is_cold else "notebook_warm",
                    target_name=nb_name,
                    is_first_run=is_cold,
                )

                if poll_res.get("success"):
                    logs = poll_res.get("log") or poll_res.get("output") or poll_res.get("stdout") or ""
                    if logs:
                        q_res = evaluate_quality_gate(logs)
                        if not q_res.passed:
                            quality_gate_failed = True
                        report.validation_results.append({"target": nb_name, "quality_gate": q_res.model_dump()})
                    report.job_results.append({"target": nb_name, "type": "notebook", "job_id": job_id, **poll_res})
                    break

                # Self-Healing branch
                err_msg = poll_res.get("failure_reason") or "Cell execution error"
                if retry < max_heal_retries and current_code:
                    heal = diagnose_and_patch_code(current_code, err_msg, notebook_name=nb_name)
                    if heal.get("success") and heal.get("patched_code"):
                        current_code = heal["patched_code"]
                        matched_lh = next(
                            (item for item in dep_report.deployed_items if item.item_type == "lakehouse" and any(k in nb_name.lower() and k in item.name.lower() for k in ("bronze", "silver", "gold"))),
                            None
                        )
                        all_lh_ids = [item.item_id for item in dep_report.deployed_items if item.item_type == "lakehouse" and item.item_id]
                        compiled = compile_notebook(
                            nb_name,
                            current_code,
                            lakehouse_id=matched_lh.item_id if matched_lh else None,
                            lakehouse_name=matched_lh.name if matched_lh else None,
                            workspace_id=workspace_id,
                            known_lakehouses=all_lh_ids,
                        )
                        update_definition(nb_id, parts=compiled.get("definition", {}).get("parts", []), workspace_id=workspace_id, update_metadata=True)
                        report.healing_events.append({"notebook": nb_name, "retry": retry + 1, "diagnosis": heal.get("diagnosis")})
                retry += 1

    # 3. Output Table Validation — parse .saveAsTable() calls
    target_tables: list[str] = []
    for nb in plan.get("notebooks", []):
        code = nb.get("pyspark_code") or nb.get("pyspark") or ""
        written = re.findall(r'\.saveAsTable\(\s*["\']([a-zA-Z0-9_]+)["\']\s*\)', code)
        nb_name = nb.get("name", "").lower()
        matched_lh = next((lh for lh in plan.get("lakehouses", []) if any(k in nb_name and k in lh.lower() for k in ("gold", "silver", "bronze"))), None)
        if matched_lh and written:
            for tbl in written:
                ref = f"{matched_lh}.{tbl}"
                if ref not in target_tables:
                    target_tables.append(ref)

    if not target_tables:
        target_tables = [f"{lh}.orders" for lh in plan.get("lakehouses", []) if "gold" in lh.lower() or "silver" in lh.lower()]

    for tbl_ref in target_tables[:6]:
        cols = resolve_table_schema(tbl_ref, workspace="PBT_DATA_AGENT")
        report.validation_results.append({
            "table": tbl_ref,
            "exists": len(cols) > 0,
            "column_count": len(cols),
            "columns": [c["name"] for c in cols[:6]],
        })

    # 4. Final Telemetry & Summary
    t_end = time.perf_counter()
    report.duration_sec = round(t_end - t_start, 2)
    successful_jobs = sum(1 for j in report.job_results if j.get("success"))
    total_jobs = len(report.job_results)

    if quality_gate_failed:
        report.status = "quality_gate_failed"
    else:
        report.status = "success" if total_jobs > 0 and successful_jobs == total_jobs else (
            "partial" if successful_jobs > 0 else "completed"
        )

    report.summary_markdown = _format_report_markdown(report)
    return report


def _format_report_markdown(report: ExecutionReport) -> str:
    """Formats a rich Markdown summary of the closed-loop execution."""
    status_label = "✅ Succeeded" if report.status == "success" else (
        "❌ Quality Gate Breached" if report.status == "quality_gate_failed" else "⚠️ Completed"
    )
    lines = [
        f"### 🚀 Autonomous Execution Complete: `{report.folder}`",
        f"**Status**: `{status_label}` · **Duration**: `{report.duration_sec}s`",
        f"**Sandbox Isolation**: `AI_Test_Folder/{report.folder}` (Zero production modifications)\n",
        f"#### 📦 Provisioned Assets ({len(report.deployed_items)})",
    ]
    for item in report.deployed_items:
        lines.append(f"- `{item.get('name')}` [{item.get('item_type')}] → ID: `{item.get('item_id', 'N/A')}`")

    if report.job_results:
        lines.append(f"\n#### ⚡ Orchestration & Job Runs ({len(report.job_results)})")
        for j in report.job_results:
            lines.append(f"- **{j.get('target')}**: `{j.get('status')}` ({j.get('duration_sec', 0)}s)")

    if report.healing_events:
        lines.append(f"\n#### 🩺 Self-Healing Events ({len(report.healing_events)})")
        for h in report.healing_events:
            lines.append(f"- **{h.get('notebook')}** (Retry {h.get('retry')}): {h.get('diagnosis')}")

    # Data Quality Gate section
    qg_results = [v.get("quality_gate") for v in report.validation_results if v.get("quality_gate")]
    if qg_results:
        lines.append(f"\n#### 🛡️ Data Quality Contracts ({len(qg_results)})")
        for qg in qg_results:
            badge = "✅ PASS" if qg.get("passed") else "❌ BREACH"
            lines.append(f"- **Gate {badge}**: {qg.get('details', '')}")

    table_validations = [v for v in report.validation_results if "table" in v]
    if table_validations:
        lines.append(f"\n#### 📊 Delta Tables Validated ({len(table_validations)})")
        for v in table_validations:
            status_emoji = "✅" if v.get("exists") else "⚠️"
            lines.append(f"- {status_emoji} `{v.get('table')}`: {v.get('column_count', 0)} columns verified in OneLake")

    return "\n".join(lines).strip()
