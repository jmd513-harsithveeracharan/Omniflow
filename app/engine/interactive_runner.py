"""
app/engine/interactive_runner.py
--------------------------------
Fast interactive execution engine for single Microsoft Fabric PySpark notebooks and cells.
Bypasses full multi-stage pipeline orchestration for rapid developer feedback,
evaluates live Data Quality gates, and supports automated self-healing.
"""

from __future__ import annotations

import time
from typing import Any
from pydantic import BaseModel, Field

from app.config import ALLOWED_WORKSPACE_ID
from app.fabric_client import get_job_status, run_notebook, update_definition
from app.fabric_compiler import compile_notebook
from app.engine.data_quality import QualityGateResult, evaluate_quality_gate
from app.engine.polling import poll_fabric_job_adaptive
from app.self_healer import diagnose_and_patch_code


class InteractiveRunResult(BaseModel):
    """Structured result of an interactive single-notebook execution."""
    success: bool
    status: str
    notebook: str
    job_id: str | None = None
    duration_sec: float = 0.0
    error: str | None = None
    quality_gate: QualityGateResult | None = None
    healing_events: list[dict[str, Any]] = Field(default_factory=list)


def _poll_job_completion(
    item_id: str,
    job_id: str,
    workspace_id: str,
    session_id: str | None = None,
    timeout_sec: int = 60,
    task_type: str = "interactive",
    target_name: str = "",
    skip_initial_delay: bool = True,
) -> dict[str, Any]:
    """Helper to poll single notebook interactive execution."""
    return poll_fabric_job_adaptive(
        item_id=item_id,
        job_id=job_id,
        workspace_id=workspace_id,
        task_type=task_type,
        session_id=session_id,
        is_first_run=False,
        target_name=target_name,
        custom_timeout_sec=timeout_sec,
        skip_initial_delay=skip_initial_delay,
        get_status_fn=get_job_status,
    )


def run_single_notebook_interactive(
    notebook_id: str,
    notebook_name: str = "notebook",
    workspace_id: str = ALLOWED_WORKSPACE_ID,
    session_id: str | None = None,
    timeout_sec: int = 60,
    current_code: str | None = None,
    max_heal_retries: int = 1,
    max_allowed_duplicates: int = 0,
    max_allowed_nulls: int = 0,
) -> dict[str, Any]:
    """Fast interactive execution for a single notebook bypassing pipeline compilation."""
    t0 = time.perf_counter()
    retry = 0
    code_to_run = current_code or ""
    healing_events: list[dict[str, Any]] = []

    while retry <= max_heal_retries:
        trig = run_notebook(notebook_id, workspace_id=workspace_id)
        if not trig.get("success") or not trig.get("job_id"):
            return {
                "success": False,
                "status": "TriggerFailed",
                "notebook": notebook_name,
                "error": trig.get("error"),
                "duration_sec": round(time.perf_counter() - t0, 2),
                "healing_events": healing_events,
            }

        job_id = trig["job_id"]
        poll_res = _poll_job_completion(
            notebook_id,
            job_id,
            workspace_id,
            session_id=session_id,
            timeout_sec=timeout_sec,
            task_type="interactive",
            target_name=notebook_name,
            skip_initial_delay=True,
        )

        if poll_res.get("success"):
            log_output = (
                poll_res.get("log")
                or poll_res.get("output")
                or poll_res.get("stdout")
                or ""
            )
            q_result = evaluate_quality_gate(
                log_output,
                max_allowed_duplicates=max_allowed_duplicates,
                max_allowed_nulls=max_allowed_nulls,
            )
            return {
                "success": True,
                "status": "Completed" if q_result.passed else "QualityGateBreached",
                "notebook": notebook_name,
                "job_id": job_id,
                "duration_sec": poll_res.get("duration_sec", round(time.perf_counter() - t0, 2)),
                "quality_gate": q_result.model_dump(),
                "healing_events": healing_events,
            }

        err_msg = poll_res.get("failure_reason") or "Interactive cell execution failed"
        if retry < max_heal_retries and code_to_run:
            heal = diagnose_and_patch_code(code_to_run, err_msg, notebook_name=notebook_name)
            if heal.get("success") and heal.get("patched_code"):
                code_to_run = heal["patched_code"]
                compiled = compile_notebook(notebook_name, code_to_run, workspace_id=workspace_id)
                update_definition(
                    notebook_id,
                    parts=compiled.get("definition", {}).get("parts", []),
                    workspace_id=workspace_id,
                )
                healing_events.append({"retry": retry + 1, "diagnosis": heal.get("diagnosis")})
        retry += 1

    return {
        "success": False,
        "status": poll_res.get("status", "Failed"),
        "notebook": notebook_name,
        "error": poll_res.get("failure_reason"),
        "duration_sec": round(time.perf_counter() - t0, 2),
        "healing_events": healing_events,
    }
