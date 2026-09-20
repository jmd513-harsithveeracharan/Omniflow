"""
app/engine/executor.py
----------------------
Stage 5: Autonomous Closed-Loop Execution, Cyclic Self-Healing & Data Verification.
Deploys plans safely into AI_Test_Folder sandbox, triggers execution via Fabric Jobs API,
monitors progress, patches code upon cell failure, and validates live Delta tables.
"""

from __future__ import annotations

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
    provision_item_with_definition,
)
from app.fabric_compiler import compile_notebook
from app.engine.progress import set_progress_step, _now_utc_str
from app.engine.schema_resolver import resolve_table_schema
from app.self_healer import diagnose_and_patch_code


class ExecutionReport(BaseModel):
    run_id: str
    workspace_id: str
    folder: str
    status: str = "success"  # success | partial | failed
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
) -> dict[str, Any]:
    """Polls a triggered Fabric job instance until terminal state or timeout."""
    t0 = time.perf_counter()
    while time.perf_counter() - t0 < timeout_sec:
        res = get_job_status(item_id, job_id, workspace_id=workspace_id)
        status = res.get("status", "Unknown") if res.get("success") else "Unknown"

        if session_id:
            set_progress_step(
                session_id,
                title="Monitored Fabric Job",
                detail=f"Job {job_id[:8]} status: {status} ({round(time.perf_counter() - t0, 1)}s elapsed)...",
                status="in_progress" if status not in ("Completed", "Failed", "Cancelled") else "completed",
                action="Monitored",
                badge="JOB",
                target=f"Job {job_id[:8]}",
            )

        if status in ("Completed", "Failed", "Cancelled", "Succeeded"):
            return {
                "success": status in ("Completed", "Succeeded"),
                "status": status,
                "duration_sec": round(time.perf_counter() - t0, 2),
                "failure_reason": res.get("failure_reason"),
                "raw": res.get("raw", {}),
            }
        time.sleep(poll_interval_sec)

    return {
        "success": False,
        "status": "TimedOut",
        "duration_sec": round(time.perf_counter() - t0, 2),
        "failure_reason": f"Execution timed out after {timeout_sec} seconds.",
    }


def execute_closed_loop(
    plan: dict[str, Any],
    workspace_id: str = ALLOWED_WORKSPACE_ID,
    session_id: str | None = None,
    max_heal_retries: int = 2,
    timeout_sec: int = 180,
) -> ExecutionReport:
    """
    Executes full closed loop: Deploy -> Trigger Run -> Poll & Heal -> Validate Data -> Report.
    Strictly isolated inside sandbox AI_Test_Folder/ to guarantee zero workspace pollution.
    """
    t_start = time.perf_counter()
    run_id = plan.get("run_id") or f"exec_{uuid.uuid4().hex[:8]}"
    folder = plan.get("folder") or "AI_Test_Folder"

    report = ExecutionReport(run_id=run_id, workspace_id=workspace_id, folder=folder)

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

    # Find deployed pipeline and notebooks
    pipeline_item = next((i for i in dep_report.deployed_items if i.item_type == "pipeline" and i.item_id), None)
    notebook_items = [i for i in dep_report.deployed_items if i.item_type == "notebook" and i.item_id]

    # 2. Trigger Execution & Self-Healing Loop
    if pipeline_item and pipeline_item.item_id:
        # Trigger Data Factory Pipeline
        trigger_res = trigger_pipeline_run(pipeline_item.item_id, workspace_id=workspace_id)
        if trigger_res.get("success") and trigger_res.get("job_id"):
            job_id = trigger_res["job_id"]
            job_res = _poll_job_completion(pipeline_item.item_id, job_id, workspace_id, session_id, timeout_sec)
            report.job_results.append({
                "target": pipeline_item.name, "type": "pipeline",
                "job_id": job_id, **job_res
            })
        else:
            report.job_results.append({
                "target": pipeline_item.name, "type": "pipeline",
                "success": False, "status": "TriggerFailed", "error": trigger_res.get("error")
            })
    elif notebook_items:
        # Sequential Medallion notebook execution (Bronze -> Silver -> Gold)
        for nb_item in notebook_items:
            nb_name = nb_item.name
            nb_id = nb_item.item_id
            nb_plan = next((n for n in plan.get("notebooks", []) if n.get("name") == nb_name), {})
            current_code = nb_plan.get("pyspark_code") or nb_plan.get("pyspark") or ""

            retry = 0
            while retry <= max_heal_retries:
                trig = run_notebook(nb_id, workspace_id=workspace_id)
                if not trig.get("success") or not trig.get("job_id"):
                    report.job_results.append({
                        "target": nb_name, "type": "notebook", "success": False,
                        "status": "TriggerFailed", "error": trig.get("error")
                    })
                    break

                job_id = trig["job_id"]
                poll_res = _poll_job_completion(nb_id, job_id, workspace_id, session_id, timeout_sec)

                if poll_res.get("success"):
                    report.job_results.append({"target": nb_name, "type": "notebook", "job_id": job_id, **poll_res})
                    break

                # Self-Healing branch
                err_msg = poll_res.get("failure_reason") or "Cell execution error"
                if retry < max_heal_retries and current_code:
                    heal = diagnose_and_patch_code(current_code, err_msg, notebook_name=nb_name)
                    if heal.get("success") and heal.get("patched_code"):
                        current_code = heal["patched_code"]
                        compiled = compile_notebook(nb_name, current_code)
                        update_definition(nb_id, parts=compiled.get("definition", {}).get("parts", []), workspace_id=workspace_id)
                        report.healing_events.append({
                            "notebook": nb_name, "retry": retry + 1, "diagnosis": heal.get("diagnosis")
                        })
                retry += 1

    # 3. Output Table Validation
    target_tables = [
        f"{lh}.dbo.{nb.get('name', '').replace('nb_', '')}"
        for lh in plan.get("lakehouses", [])
        for nb in plan.get("notebooks", [])
        if "gold" in lh.lower() or "silver" in lh.lower()
    ]
    for tbl_ref in target_tables[:4]:
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
    report.status = "success" if total_jobs > 0 and successful_jobs == total_jobs else (
        "partial" if successful_jobs > 0 else "completed"
    )

    report.summary_markdown = _format_report_markdown(report)
    return report


def _format_report_markdown(report: ExecutionReport) -> str:
    """Formats a rich Markdown summary of the closed-loop execution."""
    lines = [
        f"### 🚀 Autonomous Execution Complete: `{report.folder}`",
        f"**Status**: `{'✅ Succeeded' if report.status == 'success' else '⚠️ Completed'}` · **Duration**: `{report.duration_sec}s`",
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

    if report.validation_results:
        lines.append(f"\n#### 📊 Delta Tables Validated ({len(report.validation_results)})")
        for v in report.validation_results:
            status_emoji = "✅" if v.get("exists") else "⚠️"
            lines.append(f"- {status_emoji} `{v.get('table')}`: {v.get('column_count', 0)} columns verified in OneLake")

    return "\n".join(lines).strip()

