"""
app/engine/worker_agents.py
---------------------------
Stage 2: Parallel and Sequential PySpark Worker Agents execution.
Each Medallion worker gets a strictly layer-scoped prompt and populates
WorkerResult.delta_schema so downstream workers receive real upstream schema.
"""

from __future__ import annotations

import concurrent.futures
import time

from app.engine.models import PipelineStep, StepDAG, WorkerResult
from app.engine.progress import _now_utc_str, set_progress_step
from app.engine.schema_resolver import resolve_upstream_schema
from app.llm_router import chat
from app.meta_skill import WORKER_CODE_ALGO_SYSTEM, WORKER_CODE_MEDALLION_SYSTEM
from app.skill_loader import load_skills

# --- Layer-scoped isolation instruction blocks injected per worker ---
_LAYER_SCOPE: dict[str, str] = {
    "Bronze": (
        "## YOUR LAYER: BRONZE\n"
        "You are ONLY writing the Bronze ingestion notebook.\n"
        "- Read from the staging source tables listed in the schema context below.\n"
        "- Write immutable raw copies to lh_*_bronze using .saveAsTable().\n"
        "- Add _ingested_at (current_timestamp) and _source_system (literal string) columns.\n"
        "- DO NOT clean, filter, or transform data. Preserve original schema exactly.\n"
        "- DO NOT read from any Silver or Gold lakehouse.\n"
    ),
    "Silver": (
        "## YOUR LAYER: SILVER\n"
        "You are ONLY writing the Silver transformation notebook.\n"
        "- Read ONLY from the Bronze lakehouses (lh_*_bronze tables).\n"
        "- DO NOT re-read from original staging source tables.\n"
        "- The Bronze ingestion timestamp column is _ingested_at -- use EXACTLY that name in window dedup.\n"
        "- Perform: trim whitespace, cast types, filter invalid rows (e.g. negative amounts).\n"
        "- Use Delta MERGE or overwrite saveAsTable to lh_*_silver.\n"
        "- DO NOT implement star-schema or aggregations -- that is Gold's responsibility.\n"
    ),
    "Gold": (
        "## YOUR LAYER: GOLD\n"
        "You are ONLY writing the Gold dimensional modeling notebook.\n"
        "- Read ONLY from Silver lakehouses (lh_*_silver tables).\n"
        "- DO NOT re-read from Bronze or staging source tables.\n"
        "- DO NOT re-implement deduplication, cleansing, or ingestion logic.\n"
        "- Build Kimball star-schema: fact + dimension tables with business aggregations.\n"
        "- Always project year/month columns via F.year()/F.month() before .partitionBy().\n"
        "- Write to lh_*_gold using .saveAsTable().\n"
    ),
}


def _build_medallion_prompt(
    step: PipelineStep,
    folder: str,
    upstream: WorkerResult | None,
    prompt_context: str | None,
    schema_context: str,
) -> str:
    """Constructs a precise, layer-isolated prompt for a Medallion worker."""
    layer = step.layer or "Notebook"
    scope = _LAYER_SCOPE.get(layer, "")

    parts = [
        f"{scope}\n",
        f"Write PySpark code for notebook `{step.name}` (layer: {layer}) in project folder `{folder}`.",
        f"\nTask Description: {step.description}",
    ]

    if schema_context:
        parts.append(f"\n\n{schema_context}")

    if upstream and upstream.delta_schema:
        upstream_schema_str = ", ".join(upstream.delta_schema[:20])
        parts.append(
            f"\n\nUpstream {upstream.layer} notebook (`{upstream.name}`) "
            f"produces these output columns:\n{upstream_schema_str}\n"
            f"Target lakehouse path: `{upstream.lh_path}`\n"
            "Read from THAT lakehouse -- do NOT re-query the original source."
        )
    elif upstream and upstream.lh_path:
        parts.append(
            f"\n\nUpstream {upstream.layer} notebook (`{upstream.name}`) "
            f"writes to: `{upstream.lh_path}`\n"
            "Read from THAT lakehouse -- do NOT re-query the original source."
        )

    if prompt_context:
        ctx = prompt_context
        if layer in ("Silver", "Gold"):
            parts.append(
                f"\n\nBusiness Context (for understanding requirements only -- "
                f"do NOT read from staging/source tables directly in this layer):\n{ctx[:1200]}"
            )
        else:
            parts.append(f"\n\nBusiness Context:\n{ctx[:1200]}")

    return "\n".join(parts)


def _infer_lh_path(step: PipelineStep, folder: str) -> str:
    """Infers the managed lakehouse name for a Medallion step using naming conventions."""
    name_lower = step.name.lower()
    if "bronze" in name_lower:
        suffix = "bronze"
    elif "silver" in name_lower:
        suffix = "silver"
    elif "gold" in name_lower:
        suffix = "gold"
    else:
        return step.name.replace("nb_", "lh_", 1)

    parts = name_lower.replace("nb_", "").split("_")
    noise = {suffix, "ingestion", "transformation", "starschema", "ingest", "merge", "star"}
    meaningful = [p for p in parts if p not in noise]
    project = "_".join(meaningful) if meaningful else folder.lower()
    return f"lh_{project}_{suffix}"


def execute_notebook_worker(
    step: PipelineStep,
    folder: str,
    upstream: WorkerResult | None = None,
    session_id: str | None = None,
    target_model: str | None = None,
    effort: str = "medium",
    prompt_context: str | None = None,
    schema_context: str = "",
) -> WorkerResult:
    start_t = time.perf_counter()
    start_utc = _now_utc_str()

    if session_id:
        set_progress_step(
            session_id,
            title=f"Synthesized PY {step.name}.py",
            detail=f"Synthesizing PySpark for '{step.name}' ({step.layer or 'Notebook'}). Applying layer isolation and schema contracts...",
            status="in_progress",
            action="Synthesizing",
            badge="PY",
            target=f"{step.name}.py",
        )

    is_medallion = step.layer in ("Bronze", "Silver", "Gold")

    if is_medallion:
        medallion_skill = load_skills(["fabric_medallion_architecture"])
        sys_prompt = WORKER_CODE_MEDALLION_SYSTEM + (f"\n\n{medallion_skill}" if medallion_skill else "")
        user_prompt = _build_medallion_prompt(step, folder, upstream, prompt_context, schema_context)
    else:
        sys_prompt = WORKER_CODE_ALGO_SYSTEM
        user_prompt = (
            f"Write PySpark code for notebook '{step.name}' (layer: Notebook) in folder '{folder}'.\n"
            f"Task Description: {step.description}"
        )
        if prompt_context:
            user_prompt += f"\n\nContext:\n{prompt_context[:1200]}"

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

        lh_path = _infer_lh_path(step, folder)
        output_cols = resolve_upstream_schema(code)

        end_t = time.perf_counter()
        dur = round(end_t - start_t, 2)
        code_lines = len(code.splitlines())

        if session_id:
            set_progress_step(
                session_id,
                title=f"Synthesized PY {step.name}.py",
                detail=f"PySpark generated ({code_lines} lines, {dur}s). Layer: {step.layer}. Output schema: {len(output_cols)} columns extracted.",
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
            lh_path=lh_path,
            delta_schema=output_cols,
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
    schema_context: str = "",
) -> dict[str, WorkerResult]:
    """Executes worker agents: sequentially for Medallion dependencies, in parallel for others."""
    notebook_steps = [s for s in dag.steps if s.type == "notebook"]
    if only_steps:
        notebook_steps = [s for s in notebook_steps if s.name in only_steps]

    medallion_order = {"Bronze": 0, "Silver": 1, "Gold": 2}
    medallion_steps = sorted(
        [s for s in notebook_steps if s.layer in ("Bronze", "Silver", "Gold")],
        key=lambda s: medallion_order.get(s.layer or "", 3),
    )
    parallel_steps = [s for s in notebook_steps if s.layer not in ("Bronze", "Silver", "Gold")]

    results: dict[str, WorkerResult] = {}
    last_result: WorkerResult | None = None
    for step in medallion_steps:
        res = execute_notebook_worker(
            step,
            dag.folder,
            upstream=last_result,
            session_id=session_id,
            target_model=target_model,
            effort=effort,
            prompt_context=prompt_context,
            schema_context=schema_context,
        )
        results[step.step_id] = res
        last_result = res

    if parallel_steps:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(parallel_steps), 6)) as pool:
            future_map = {
                pool.submit(
                    execute_notebook_worker,
                    s, dag.folder, None, session_id, target_model, effort, prompt_context, schema_context,
                ): s.step_id
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
