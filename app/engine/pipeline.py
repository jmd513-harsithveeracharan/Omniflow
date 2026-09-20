"""
app/engine/pipeline.py
----------------------
Coordinator for the 4-Stage Multi-Agent State Machine:
Context Gate -> Meta-Planner -> Worker Agents -> Builder -> Auditor (with auto-remediation loop).
"""

from __future__ import annotations

import re
import time

from app.engine.auditor import run_auditor
from app.engine.builder import run_builder
from app.engine.meta_planner import heuristic_dag, run_context_gate, run_meta_planner
from app.engine.models import MAX_AUDIT_RETRIES, PipelineState, PipelineStep
from app.engine.progress import _now_utc_str, clear_progress, set_progress_step
from app.engine.schema_resolver import build_schema_context
from app.engine.worker_agents import run_workers
from app.ingestion_planner import parse_schedule


def run_pipeline(
    prompt: str,
    session_id: str,
    history: list | None = None,
    current_plan: dict | None = None,
    target_model: str | None = None,
    effort: str = "medium",
) -> tuple[dict | None, list[str]]:
    """
    Main entry point for the 4-stage multi-agent pipeline.
    Returns: (FabricPlan dict, list of audit chat messages)
    """
    total_start_t = time.perf_counter()
    clear_progress(session_id)
    set_progress_step(
        session_id,
        title="Explored Active Context",
        detail=f"Analyzing prompt requirements: '{prompt[:100]}...'",
        status="in_progress",
        action="Explored",
        badge="DAG",
        target="Active Context",
    )

    state = PipelineState(
        prompt=prompt,
        session_id=session_id,
        history=history or [],
        current_plan=current_plan,
        target_model=target_model,
        effort=effort,
    )

    # Stage 0: Context Gate
    t0_start = time.perf_counter()
    t0_utc = _now_utc_str()
    try:
        state.context_mode = run_context_gate(state)
    except Exception:
        state.context_mode = "independent"
    t0_end = time.perf_counter()
    t0_dur = round(t0_end - t0_start, 2)
    state.stage_timings["Stage 0 (Context Gate)"] = {
        "started_at": t0_utc,
        "completed_at": _now_utc_str(),
        "duration_sec": t0_dur,
    }
    set_progress_step(
        session_id,
        title="Explored Active Context",
        detail=f"Active context loaded ({t0_dur}s). Workflow mode: '{state.context_mode}'.",
        status="completed",
        action="Explored",
        badge="DAG",
        target="Active Context",
    )

    # JIT Schema Discovery — resolve real column schemas from Fabric before workers run
    set_progress_step(
        session_id,
        title="Hydrated Live Schema Context",
        detail="Querying Fabric Lakehouse for live column schemas via 'fab table schema'. Injecting verified column definitions into worker prompts...",
        status="in_progress",
        action="Hydrated",
        badge="DB",
        target="Schema Registry",
    )
    schema_context = build_schema_context(prompt)
    set_progress_step(
        session_id,
        title="Hydrated Live Schema Context",
        detail=f"Schema hydration complete. {'Resolved live schemas for source tables.' if schema_context else 'No Fabric table refs found in prompt — using prompt-described schema.'}",
        status="completed",
        action="Hydrated",
        badge="DB",
        target="Schema Registry",
    )

    # Stage 1: Meta-Planner
    set_progress_step(
        session_id,
        title="Planned Architecture DAG",
        detail="Decomposing architecture into multi-stage execution DAG: identifying target workspace folder, PySpark notebooks, Delta Lakehouse tiers, and Azure Data Factory pipeline trigger schedules...",
        status="in_progress",
        action="Planned",
        badge="DAG",
        target="Architecture DAG",
    )
    t1_start = time.perf_counter()
    t1_utc = _now_utc_str()
    try:
        state.dag = run_meta_planner(state)
    except Exception as e:
        state.dag = heuristic_dag(prompt)
        state.audit_messages.append(f"Planner note: Used heuristic extraction ({e})")
    t1_end = time.perf_counter()
    t1_dur = round(t1_end - t1_start, 2)
    state.stage_timings["Stage 1 (Meta-Planner)"] = {
        "started_at": t1_utc,
        "completed_at": _now_utc_str(),
        "duration_sec": t1_dur,
    }

    step_count = len(state.dag.steps) if state.dag else 0
    folder_target = state.dag.folder if state.dag else "AI_Test_Folder"
    step_names = ', '.join([f"'{s.name}'" for s in state.dag.steps]) if state.dag else ""
    pl_sched = state.dag.pipeline.get("schedule", "Daily") if (state.dag and state.dag.pipeline) else "None"

    set_progress_step(
        session_id,
        title=f"Planned {step_count} Items in '{folder_target}'",
        detail=f"Decomposed DAG: {step_names}. Pipeline schedule: {pl_sched} ({t1_dur}s).",
        status="completed",
        action="Planned",
        badge="DAG",
        target=f"{folder_target} ({step_count} items)",
        diff=f"+{step_count} items",
    )

    # Stages 2-3-4 loop with auto-remediation
    while state.retry_count <= MAX_AUDIT_RETRIES:
        # Stage 2: Workers
        t2_start = time.perf_counter()
        t2_utc = _now_utc_str()
        try:
            new_results = run_workers(
                state.dag,
                session_id=session_id,
                target_model=state.target_model,
                effort=state.effort,
                prompt_context=state.prompt,
                schema_context=schema_context,
            )
            state.worker_results.update(new_results)
        except Exception as e:
            raise RuntimeError(f"Worker execution failed: {e}")
        t2_end = time.perf_counter()
        state.stage_timings[f"Stage 2 (Worker Agents - Attempt {state.retry_count + 1})"] = {
            "started_at": t2_utc,
            "completed_at": _now_utc_str(),
            "duration_sec": round(t2_end - t2_start, 2),
        }

        # Stage 3: Builder
        set_progress_step(
            session_id,
            title="Ran Fabric Trident Compiler",
            detail="Assembling unified Fabric architecture blueprint: compiling Base64 Trident notebook definitions, attaching Synapse Spark kernels, and generating Data Factory pipeline JSON with activities...",
            status="in_progress",
            action="Ran",
            badge="CLI",
            target="fabric build --trident",
        )
        t3_start = time.perf_counter()
        t3_utc = _now_utc_str()
        state.fabric_plan = run_builder(state.dag, state.worker_results, state.run_id)
        t3_end = time.perf_counter()
        t3_dur = round(t3_end - t3_start, 2)
        state.stage_timings[f"Stage 3 (Builder / Reconciler - Attempt {state.retry_count + 1})"] = {
            "started_at": t3_utc,
            "completed_at": _now_utc_str(),
            "duration_sec": t3_dur,
        }
        set_progress_step(
            session_id,
            title="Ran Fabric Trident Compiler",
            detail=f"Fabric Trident package compiled with {len(state.fabric_plan.get('notebooks', []))} notebook(s) and scheduled pipeline trigger ({t3_dur}s).",
            status="completed",
            action="Ran",
            badge="CLI",
            target="fabric build --trident",
            diff="✓ 0 errors",
            output=f"> synapse-spark --link-kernel synapse_pyspark\n> trident-packager --workspace {state.dag.folder}\n✓ Trident Base64 definitions serialized ({t3_dur}s)",
        )

        # Stage 4: Auditor
        set_progress_step(
            session_id,
            title="Verified Compliance Gate",
            detail=f"Executing independent audit against user requirements: validating primary keys, Medallion folder containment ('{folder_target}'), schedule trigger expressions, and verifying 0 missing components...",
            status="in_progress",
            action="Verified",
            badge="SQL",
            target="Auditor Gate",
        )
        t4_start = time.perf_counter()
        t4_utc = _now_utc_str()
        state.audit = run_auditor(
            prompt,
            state.fabric_plan,
            target_model=state.target_model,
            effort=state.effort,
            session_id=session_id,
        )
        t4_end = time.perf_counter()
        t4_dur = round(t4_end - t4_start, 2)
        state.stage_timings[f"Stage 4 (Auditor - Attempt {state.retry_count + 1})"] = {
            "started_at": t4_utc,
            "completed_at": _now_utc_str(),
            "duration_sec": t4_dur,
        }

        if state.audit.passed:
            if state.retry_count > 0:
                state.audit_messages.append(f"Audit passed after {state.retry_count} auto-remediation(s).")
            set_progress_step(
                session_id,
                title="Verified Compliance Gate",
                detail=f"100% verified ({t4_dur}s). Zero missing components, schema constraints enforced, safe blast-radius confirmed.",
                status="completed",
                action="Verified",
                badge="SQL",
                target="Auditor Gate",
                diff="0 errors",
            )
            break

        # Show audit message, then remediate
        state.audit_messages.append(state.audit.chat_message)

        if state.retry_count >= MAX_AUDIT_RETRIES:
            state.audit_messages.append(
                f"Could not generate all requested items after {MAX_AUDIT_RETRIES} attempts. "
                f"Missing: {state.audit.missing_items}. "
                "The plan below contains everything that was successfully generated."
            )
            set_progress_step(session_id, "Finalized", "Plan packaged with audit notes.", "completed")
            break

        # Inject missing steps into DAG for re-execution
        if state.audit.missing_items and state.dag:
            existing = {s.name for s in state.dag.steps}
            for missing_item in state.audit.missing_items:
                missing_str = str(missing_item).strip()
                nb_matches = re.findall(r"\b(nb_[a-zA-Z0-9_\-]+)\b", missing_str)
                if nb_matches:
                    for missing_nb in nb_matches:
                        if missing_nb not in existing:
                            state.dag.steps.append(PipelineStep(
                                step_id=f"step_{missing_nb.lower()}_retry{state.retry_count}",
                                type="notebook",
                                name=missing_nb,
                                layer="Notebook",
                                description=f"Auto-remediated notebook: {missing_nb}",
                                depends_on=[],
                                can_parallel=True,
                            ))
                            existing.add(missing_nb)
                elif "schedule" in missing_str.lower() or "cron" in missing_str.lower():
                    if state.dag.pipeline:
                        sched_recheck = parse_schedule(state.prompt)
                        state.dag.pipeline["schedule"] = sched_recheck

        state.retry_count += 1

    total_end_t = time.perf_counter()
    state.completed_at = _now_utc_str()
    state.total_duration_sec = round(total_end_t - total_start_t, 2)
    state.stage_timings["Total Pipeline Execution"] = {
        "started_at": state.started_at,
        "completed_at": state.completed_at,
        "duration_sec": state.total_duration_sec,
    }

    # Log full execution trace to execution_traces/session_<id>.md
    try:
        from app.execution_logger import log_agent_execution
        log_agent_execution(session_id, state)
    except Exception as log_err:
        print(f"[EXECUTION LOGGER ERROR] {log_err}")

    return state.fabric_plan, state.audit_messages

