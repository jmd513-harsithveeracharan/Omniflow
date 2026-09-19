"""
app/engine/__init__.py
----------------------
Multi-Agent State Machine & Orchestration Engine for Fabric AI Studio.
"""

from app.engine.auditor import run_auditor
from app.engine.builder import run_builder
from app.engine.meta_planner import heuristic_dag, run_context_gate, run_meta_planner
from app.engine.models import (
    MAX_AUDIT_RETRIES,
    AuditResult,
    PipelineState,
    PipelineStep,
    StepDAG,
    WorkerResult,
    extract_json,
)
from app.engine.pipeline import run_pipeline
from app.engine.progress import (
    add_step_listener,
    clear_progress,
    get_progress,
    remove_step_listener,
    set_progress_step,
)
from app.engine.worker_agents import execute_notebook_worker, run_workers

__all__ = [
    "run_pipeline",
    "run_meta_planner",
    "run_context_gate",
    "heuristic_dag",
    "run_workers",
    "execute_notebook_worker",
    "run_builder",
    "run_auditor",
    "add_step_listener",
    "remove_step_listener",
    "get_progress",
    "set_progress_step",
    "clear_progress",
    "PipelineStep",
    "StepDAG",
    "WorkerResult",
    "AuditResult",
    "PipelineState",
    "MAX_AUDIT_RETRIES",
    "extract_json",
]

