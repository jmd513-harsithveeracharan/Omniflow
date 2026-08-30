"""
app/execution_monitor.py
------------------------
Handles pipeline execution triggering and live job status monitoring.

This is the missing operational lifecycle that was absent from the original server.py.
After Fabric items are deployed, this module:
  1. Triggers the pipeline run via POST /jobs/instances
  2. Polls job status every 5 seconds (up to a configurable max)
  3. Updates the _RUNS in-memory tracker with real-time execution state
  4. Returns error details for future self-healing analysis
"""

import time
import threading
from app.fabric_client import trigger_pipeline_run, get_job_status

_POLL_INTERVAL_SECONDS = 5
_MAX_POLLS = 120  # 10 minutes max monitoring window

# Terminal job states
_TERMINAL_STATES = {"Completed", "Failed", "Cancelled", "TimedOut"}
_SUCCESS_STATES  = {"Completed"}
_FAILURE_STATES  = {"Failed", "Cancelled", "TimedOut"}


def trigger_and_monitor(
    workspace_id: str,
    pipeline_id: str,
    pipeline_name: str,
    run_id: str,
    _RUNS: dict,
    _RUNS_LOCK: threading.Lock,
) -> None:
    """
    Background thread worker: triggers a pipeline and polls until completion.

    Updates _RUNS[run_id] with:
      - pipeline_job_id
      - pipeline_status ("triggered" | "running" | "completed" | "failed")
      - pipeline_start_time, pipeline_end_time
      - failure_reason (if failed)

    Args:
        workspace_id:   Target Fabric workspace ID.
        pipeline_id:    The DataPipeline item ID to trigger.
        pipeline_name:  Human-readable name for logging.
        run_id:         The ingestion run ID used to update _RUNS.
        _RUNS:          Shared in-memory run tracker dict.
        _RUNS_LOCK:     Threading lock for _RUNS access.
    """

    def _update_run(updates: dict):
        with _RUNS_LOCK:
            if run_id in _RUNS:
                _RUNS[run_id].update(updates)

    print(f"[MONITOR] Triggering pipeline '{pipeline_name}' (ID: {pipeline_id})...")
    _update_run({"pipeline_status": "triggering"})

    # Step 1: Trigger the pipeline run
    trigger_result = trigger_pipeline_run(pipeline_id, workspace_id)

    if not trigger_result.get("success"):
        error = trigger_result.get("error", "Unknown trigger error")
        print(f"[MONITOR] Pipeline trigger failed: {error}")
        _update_run({
            "pipeline_status": "trigger_failed",
            "failure_reason": error,
        })
        return

    job_id = trigger_result.get("job_id")
    print(f"[MONITOR] Pipeline triggered successfully. Job ID: {job_id}")
    _update_run({"pipeline_status": "running", "pipeline_job_id": job_id})

    if not job_id:
        # No job ID returned — can't poll status
        _update_run({"pipeline_status": "triggered_no_id"})
        return

    # Step 2: Poll job status until terminal state or timeout
    for poll_num in range(_MAX_POLLS):
        time.sleep(_POLL_INTERVAL_SECONDS)

        status_result = get_job_status(pipeline_id, job_id, workspace_id)

        if not status_result.get("success"):
            print(f"[MONITOR] Status poll #{poll_num + 1} failed: {status_result.get('error')}")
            continue

        status = status_result.get("status", "Unknown")
        print(f"[MONITOR] Poll #{poll_num + 1}: Pipeline '{pipeline_name}' status = {status}")

        _update_run({
            "pipeline_status": status.lower(),
            "pipeline_start_time": status_result.get("start_time"),
            "pipeline_end_time": status_result.get("end_time"),
        })

        if status in _TERMINAL_STATES:
            if status in _SUCCESS_STATES:
                print(f"[MONITOR] Pipeline '{pipeline_name}' completed successfully!")
                _update_run({
                    "pipeline_status": "completed",
                    "status": "completed",
                })
            else:
                failure_reason = status_result.get("failure_reason", "Unknown error")
                print(f"[MONITOR] Pipeline '{pipeline_name}' failed: {failure_reason}")
                _update_run({
                    "pipeline_status": "failed",
                    "status": "failed",
                    "failure_reason": failure_reason,
                    # Store error for future self-healing agent
                    "self_healing_needed": True,
                    "error_context": {
                        "pipeline_id": pipeline_id,
                        "job_id": job_id,
                        "failure_reason": failure_reason,
                    },
                })
            return

    # Timeout
    print(f"[MONITOR] Pipeline '{pipeline_name}' monitoring timed out after {_MAX_POLLS * _POLL_INTERVAL_SECONDS}s.")
    _update_run({
        "pipeline_status": "monitor_timeout",
        "failure_reason": f"Status monitoring timed out after {_MAX_POLLS * _POLL_INTERVAL_SECONDS} seconds. Pipeline may still be running in Fabric.",
    })


def start_monitoring_thread(
    workspace_id: str,
    pipeline_id: str,
    pipeline_name: str,
    run_id: str,
    _RUNS: dict,
    _RUNS_LOCK: threading.Lock,
) -> threading.Thread:
    """
    Launches trigger_and_monitor in a background daemon thread.
    Returns the thread object.
    """
    t = threading.Thread(
        target=trigger_and_monitor,
        args=(workspace_id, pipeline_id, pipeline_name, run_id, _RUNS, _RUNS_LOCK),
        daemon=True,
        name=f"monitor-{run_id}",
    )
    t.start()
    print(f"[MONITOR] Background monitoring thread started for run '{run_id}'.")
    return t
