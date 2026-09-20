"""
app/engine/polling.py
---------------------
Adaptive, task-aware polling engine for Microsoft Fabric execution.
Differentiates polling cadences based on compute archetype:
  - Data Factory Pipeline (long orchestration DAGs, 2-5m duration)
  - Spark Notebook Cold Start (cluster spin-up, 30-90s initial allocation)
  - Spark Notebook Warm Session (fast cell execution, 5-20s duration)
Includes HTTP 429 throttling backoff and real-time SSE progress streaming.
"""

from __future__ import annotations

import random
import time
from typing import Any
from pydantic import BaseModel, Field

from app.config import ALLOWED_WORKSPACE_ID
from app.fabric_client import get_job_status
from app.engine.progress import set_progress_step


class TaskPollingProfile(BaseModel):
    task_type: str
    initial_delay_sec: float
    min_interval_sec: float
    max_interval_sec: float
    timeout_sec: int
    status_interval_map: dict[str, float] = Field(default_factory=dict)
    description: str = ""


_PROFILES: dict[str, TaskPollingProfile] = {
    "pipeline": TaskPollingProfile(
        task_type="pipeline",
        initial_delay_sec=15.0,
        min_interval_sec=10.0,
        max_interval_sec=16.0,
        timeout_sec=480,
        status_interval_map={"NotStarted": 15.0, "InProgress": 10.0},
        description="Fabric Data Factory Pipeline Orchestration",
    ),
    "notebook_cold": TaskPollingProfile(
        task_type="notebook_cold",
        initial_delay_sec=12.0,
        min_interval_sec=5.0,
        max_interval_sec=12.0,
        timeout_sec=300,
        status_interval_map={"NotStarted": 12.0, "InProgress": 6.0},
        description="PySpark Notebook (Spark Pool Cold Start)",
    ),
    "notebook_warm": TaskPollingProfile(
        task_type="notebook_warm",
        initial_delay_sec=3.0,
        min_interval_sec=4.0,
        max_interval_sec=8.0,
        timeout_sec=180,
        status_interval_map={"NotStarted": 6.0, "InProgress": 4.0},
        description="PySpark Notebook (Warm Session)",
    ),
    "interactive": TaskPollingProfile(
        task_type="interactive",
        initial_delay_sec=2.0,
        min_interval_sec=2.0,
        max_interval_sec=5.0,
        timeout_sec=60,
        status_interval_map={"NotStarted": 3.0, "InProgress": 2.0},
        description="Quick Interactive Query",
    ),
}


def get_polling_profile(task_type: str, is_first_run: bool = True) -> TaskPollingProfile:
    """Returns an adaptive polling profile matching the task archetype."""
    normalized = task_type.lower()
    if normalized in _PROFILES:
        return _PROFILES[normalized]
    if "pipe" in normalized:
        return _PROFILES["pipeline"]
    if "interact" in normalized:
        return _PROFILES["interactive"]
    if "note" in normalized:
        return _PROFILES["notebook_cold"] if is_first_run else _PROFILES["notebook_warm"]
    return _PROFILES["notebook_cold"]


def _format_phase_detail(
    status: str,
    elapsed_sec: float,
    task_type: str,
    target_name: str,
) -> str:
    """Generates human-friendly execution phase progress detail."""
    name_ref = f"`{target_name}`" if target_name else "Job"
    elapsed_str = f"{int(elapsed_sec)}s elapsed"

    if status in ("NotStarted", "Queued"):
        if "pipeline" in task_type:
            return f"{name_ref}: Scheduling pipeline activities ({elapsed_str})..."
        return f"{name_ref}: Provisioning Spark cluster & acquiring nodes ({elapsed_str})..."

    if status == "InProgress":
        if "pipeline" in task_type:
            return f"{name_ref}: Executing pipeline activities & Delta transitions ({elapsed_str})..."
        if elapsed_sec < 45 and "cold" in task_type:
            return f"{name_ref}: Spark session active -- initializing PySpark kernel ({elapsed_str})..."
        return f"{name_ref}: Executing PySpark cells & writing Delta tables ({elapsed_str})..."

    return f"{name_ref}: Status `{status}` ({elapsed_str})"


def poll_fabric_job_adaptive(
    item_id: str,
    job_id: str,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
    task_type: str = "notebook",
    session_id: str | None = None,
    is_first_run: bool = True,
    target_name: str = "",
    custom_timeout_sec: int | None = None,
    skip_initial_delay: bool = False,
    get_status_fn: Any = None,
) -> dict[str, Any]:
    """
    Polls a Microsoft Fabric job instance using task-aware dynamic intervals.
    Adapts pacing to prevent 429 rate-limiting while minimizing idle wait time.
    Emits real-time progress steps via SSE to the user interface.
    """
    status_fn = get_status_fn or get_job_status
    profile = get_polling_profile(task_type, is_first_run=is_first_run)
    timeout_sec = custom_timeout_sec or profile.timeout_sec

    badge = "JOB" if "pipe" in profile.task_type else "FAB"
    short_id = job_id[:8] if len(job_id) >= 8 else job_id

    # 1. Task-aware initial delay
    if session_id:
        set_progress_step(
            session_id,
            title=f"Triggered {profile.task_type.capitalize()}",
            detail=_format_phase_detail("NotStarted", 0, profile.task_type, target_name),
            status="in_progress",
            action="Triggered",
            badge=badge,
            target=target_name or f"Job {short_id}",
        )

    initial_delay = 0.0 if skip_initial_delay else min(profile.initial_delay_sec, max(0.0, timeout_sec * 0.2))
    if initial_delay > 0:
        time.sleep(initial_delay)

    t0 = time.perf_counter()
    poll_count = 0
    backoff_multiplier = 1.0

    # 2. Adaptive polling loop
    while time.perf_counter() - t0 < timeout_sec:
        poll_count += 1
        elapsed = time.perf_counter() - t0

        res = status_fn(item_id, job_id, workspace_id=workspace_id)
        status = res.get("status", "Unknown") if res.get("success") else "Unknown"

        # Throttling / HTTP 429 protection
        if not res.get("success") and res.get("status_code") in (429, 503):
            backoff_multiplier = min(backoff_multiplier * 1.5, 4.0)
            sleep_wait = (profile.max_interval_sec * backoff_multiplier) + random.uniform(1.0, 3.0)
            if session_id:
                set_progress_step(
                    session_id,
                    title="Rate-Limit Backoff",
                    detail=f"Fabric API throttling detected -- pacing next check in {int(sleep_wait)}s...",
                    status="in_progress",
                    action="Pacing",
                    badge="JOB",
                    target=target_name or f"Job {short_id}",
                )
            time.sleep(sleep_wait)
            continue
        else:
            backoff_multiplier = max(1.0, backoff_multiplier * 0.8)

        # Emit real-time progress to UI
        if session_id:
            is_terminal = status in ("Completed", "Failed", "Cancelled", "Succeeded")
            set_progress_step(
                session_id,
                title=f"Monitored {target_name or 'Job'}",
                detail=_format_phase_detail(status, elapsed, profile.task_type, target_name),
                status="completed" if is_terminal else "in_progress",
                action="Monitored",
                badge=badge,
                target=target_name or f"Job {short_id}",
            )

        # Terminal state reached
        if status in ("Completed", "Failed", "Cancelled", "Succeeded"):
            return {
                "success": status in ("Completed", "Succeeded"),
                "status": status,
                "duration_sec": round(time.perf_counter() - t0, 2),
                "poll_count": poll_count,
                "profile_used": profile.task_type,
                "failure_reason": res.get("failure_reason"),
                "raw": res.get("raw", {}),
            }

        # Dynamic interval based on status phase
        base_interval = profile.status_interval_map.get(status, profile.min_interval_sec)
        # Jitter +-0.5s to prevent synchronized request spikes
        next_interval = max(profile.min_interval_sec, base_interval * backoff_multiplier) + random.uniform(-0.5, 0.5)
        time.sleep(max(1.0, next_interval))

    # Timeout
    total_dur = round(time.perf_counter() - t0, 2)
    return {
        "success": False,
        "status": "TimedOut",
        "duration_sec": total_dur,
        "poll_count": poll_count,
        "profile_used": profile.task_type,
        "failure_reason": f"Execution timed out after {total_dur}s (limit: {timeout_sec}s for {profile.task_type}).",
    }
