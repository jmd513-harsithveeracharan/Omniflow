"""
app/engine/worker_agents.py
---------------------------
Stage 2: Parallel and Sequential PySpark Worker Agents execution.
"""

from __future__ import annotations

import concurrent.futures
import json
import time

from app.engine.models import PipelineStep, StepDAG, WorkerResult
from app.engine.progress import _now_utc_str, set_progress_step
from app.llm_router import chat
from app.meta_skill import WORKER_CODE_ALGO_SYSTEM, WORKER_CODE_MEDALLION_SYSTEM
from app.skill_loader import load_skills


def execute_notebook_worker(
    step: PipelineStep,
    folder: str,
    upstream: WorkerResult | None = None,
    session_id: str | None = None,
    target_model: str | None = None,
    effort: str = "medium",
    prompt_context: str | None = None,
) -> WorkerResult:
    start_t = time.perf_counter()
    start_utc = _now_utc_str()

    if session_id:
        set_progress_step(
            session_id,
            title=f"Synthesized PY {step.name}.py",
            detail=f"Synthesizing PySpark implementation for '{step.name}' ({step.layer or 'Notebook'}). Ingesting schema and generating Delta Lake logic...",
            status="in_progress",
            action="Synthesizing",
            badge="PY",
            target=f"{step.name}.py",
        )

    is_medallion = step.layer in ("Bronze", "Silver", "Gold")

    if is_medallion:
        medallion_skill = load_skills(["fabric_medallion_architecture"])
        sys_prompt = WORKER_CODE_MEDALLION_SYSTEM + (f"\n\n{medallion_skill}" if medallion_skill else "")
    else:
        sys_prompt = WORKER_CODE_ALGO_SYSTEM

    user_prompt = f"Write PySpark code for notebook '{step.name}' in folder '{folder}'.\nDescription: {step.description}"
    user_prompt = f"Write PySpark code for notebook '{step.name}' (layer: {step.layer or 'Notebook'}) in folder '{folder}'.\nTask Description: {step.description}"
    if prompt_context:
        user_prompt += f"\n\nBusiness Scenario & System Requirements Context:\n{prompt_context}"
    if upstream and upstream.delta_schema:
        user_prompt += f"\n\nUpstream context from {upstream.name}:\n" + json.dumps(
            {"lh_path": upstream.lh_path, "schema": upstream.delta_schema[:10]}
        )

    try:
        msgs = [{"role": "system", "content": sys_prompt}, {"role": "user", "content": user_prompt}]
        raw_code = chat(
            msgs,
            complexity="high",
            max_tokens=8192,
            target_model=target_model,
            effort=effort,
            session_id=session_id,
        )
        code = raw_code.strip()
        if code.startswith("```"):
            lines = code.split("\n")
            lines = lines[1:] if lines[0].startswith("```") else lines
            lines = lines[:-1] if lines and lines[-1].startswith("```") else lines
            code = "\n".join(lines).strip()
        lh_guess = f"abfss://{folder.lower()}@onelake.dfs.fabric.microsoft.com/{step.name.replace('nb_', 'lh_')}"
        end_t = time.perf_counter()
        dur = round(end_t - start_t, 2)
        code_lines = len(code.splitlines())
        if session_id:
            set_progress_step(
                session_id,
                title=f"Synthesized PY {step.name}.py",
                detail=f"PySpark Delta Lake code generated ({code_lines} lines, {dur}s). Delta target: '{lh_guess}'.",
                status="completed",
                action="Synthesized",
                badge="PY",
                target=f"{step.name}.py",
                diff=f"+{code_lines} -0",
                output=code[:400] + ("\n..." if len(code) > 400 else ""),
            )
        return WorkerResult(
            step_id=step.step_id,
            name=step.name,
            layer=step.layer,
            pyspark=code,
            lh_path=lh_guess,
            started_at=start_utc,
            completed_at=_now_utc_str(),
            duration_sec=dur,
        )
    except Exception as e:
        end_t = time.perf_counter()
        dur = round(end_t - start_t, 2)
        return WorkerResult(
            step_id=step.step_id,
            name=step.name,
            layer=step.layer,
            pyspark=f"# Error generating code: {e}\nprint('Error')",
            error=str(e),
            started_at=start_utc,
            completed_at=_now_utc_str(),
            duration_sec=dur,
        )


def run_workers(
    dag: StepDAG,
    only_steps: list | None = None,
    session_id: str | None = None,
    target_model: str | None = None,
    effort: str = "medium",
    prompt_context: str | None = None,
) -> dict[str, WorkerResult]:
    """Executes worker agents: sequentially for Medallion dependencies, in parallel for others."""
    notebook_steps = [s for s in dag.steps if s.type == "notebook"]
    if only_steps:
        notebook_steps = [s for s in notebook_steps if s.name in only_steps]

    medallion_order = {"Bronze": 0, "Silver": 1, "Gold": 2}
    medallion_steps = sorted([s for s in notebook_steps if s.layer in ("Bronze", "Silver", "Gold")],
                              key=lambda s: medallion_order.get(s.layer or "", 3))
    parallel_steps = [s for s in notebook_steps if s.layer not in ("Bronze", "Silver", "Gold")]

    results: dict[str, WorkerResult] = {}
    last_result = None
    for step in medallion_steps:
        res = execute_notebook_worker(
            step,
            dag.folder,
            upstream=last_result,
            session_id=session_id,
            target_model=target_model,
            effort=effort,
            prompt_context=prompt_context,
        )
        results[step.step_id] = res
        last_result = res

    if parallel_steps:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(parallel_steps), 6)) as pool:
            future_map = {
                pool.submit(execute_notebook_worker, s, dag.folder, None, session_id, target_model, effort, prompt_context): s.step_id
                for s in parallel_steps
            }
            for future in concurrent.futures.as_completed(future_map):
                sid = future_map[future]
                try:
                    results[sid] = future.result()
                except Exception as e:
                    results[sid] = WorkerResult(
                        step_id=sid,
                        name=sid,
                        layer=None,
                        pyspark=f"# Error: {e}",
                        error=str(e),
                        started_at=_now_utc_str(),
                        completed_at=_now_utc_str(),
                        duration_sec=0.0,
                    )
    return results

