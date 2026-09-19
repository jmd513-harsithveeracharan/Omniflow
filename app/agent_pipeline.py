"""
app/agent_pipeline.py
---------------------
Backward-compatible facade for Fabric AI Studio's 4-Stage Multi-Agent State Machine.
Decomposed into modular submodules under `app.engine`:
  - app.engine.progress       (real-time events & listeners)
  - app.engine.models         (typed state dataclasses)
  - app.engine.meta_planner   (Stage 0 & 1: Context Gate & Step DAG)
  - app.engine.worker_agents  (Stage 2: Parallel PySpark workers)
  - app.engine.builder        (Stage 3: Unified plan & visual flow layout)
  - app.engine.auditor        (Stage 4: Compliance validator)
  - app.engine.pipeline       (Top-level 4-stage coordinator)
"""

from __future__ import annotations

import app.engine.meta_planner as _mp
import app.engine.worker_agents as _wa
import app.engine.auditor as _au
from app.llm_router import chat

# Forward chat binding into submodules so mocks on app.agent_pipeline.chat work seamlessly
def _chat_wrapper(*args, **kwargs):
    return chat(*args, **kwargs)

_mp.chat = _chat_wrapper
_wa.chat = _chat_wrapper
_au.chat = _chat_wrapper

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
    _ACTIVE_PROGRESS,
    _LISTENERS_LOCK,
    _PROGRESS_LOCK,
    _STEP_LISTENERS,
    _now_utc_str,
    add_step_listener,
    clear_progress,
    get_progress,
    remove_step_listener,
    set_progress_step,
)
from app.engine.worker_agents import execute_notebook_worker, run_workers

# Backward-compatibility aliases for private symbols
_extract_json = extract_json
_run_context_gate = run_context_gate
_run_meta_planner = run_meta_planner
_heuristic_dag = heuristic_dag
_execute_notebook_worker = execute_notebook_worker
_run_workers = run_workers
_run_builder = run_builder
_run_auditor = run_auditor

__all__ = [
    "chat",
    "run_pipeline",
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
    "_ACTIVE_PROGRESS",
    "_PROGRESS_LOCK",
    "_STEP_LISTENERS",
    "_LISTENERS_LOCK",
    "_now_utc_str",
    "_extract_json",
    "_run_context_gate",
    "_run_meta_planner",
    "_heuristic_dag",
    "_execute_notebook_worker",
    "_run_workers",
    "_run_builder",
    "_run_auditor",
]
