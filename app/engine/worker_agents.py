"""
app/engine/worker_agents.py
---------------------------
Stage 2: Parallel and Sequential PySpark / T-SQL Worker Agents execution.
Each Medallion/Warehouse worker gets a strictly layer-scoped prompt and populates
WorkerResult.delta_schema so downstream workers receive real upstream schema.
"""

from __future__ import annotations

import concurrent.futures
import re
import time
from typing import Any

from app.engine.models import PipelineStep, StepDAG, WorkerResult
from app.engine.progress import _now_utc_str, set_progress_step
from app.engine.schema_resolver import resolve_upstream_schema
from app.llm_router import chat
from app.meta_skill import (
    WORKER_CODE_ALGO_SYSTEM,
    WORKER_CODE_MEDALLION_SYSTEM,
    WORKER_CODE_WAREHOUSE_SYSTEM,
)
from app.skill_loader import load_skills

_LAYER_SCOPE: dict[str, str] = {
    "Bronze": (
        "## YOUR LAYER: BRONZE\nWrite Bronze ingestion notebook.\n"
        "- Read staging source tables via OneLake ABFSS delta path: 'abfss://PBT_DATA_AGENT@onelake.dfs.fabric.microsoft.com/lh_stage_ai.Lakehouse/Tables/dbo/<table_name>'\n"
        "- Add _ingested_at and _source_system ('stage_ai'). Write raw copies using .write.format('delta').mode('overwrite').saveAsTable('<table_name>').\n"
        "- CRITICAL: Use ONLY single-part table name in saveAsTable (e.g. saveAsTable('orders')). Never prefix lakehouse name.\n"
        "- DO NOT clean or transform data. Preserve schema. DO NOT read from Silver/Gold.\n"
    ),
    "Silver": (
        "## YOUR LAYER: SILVER\nWrite Silver transformation notebook.\n"
        "- Read ONLY from Bronze lakehouse tables using spark.read.table('<bronze_lakehouse_name>.<table_name>'). DO NOT re-read staging.\n"
        "- Deduplicate with window on _ingested_at, trim whitespace, cast types, filter invalid rows.\n"
        "- Write cleaned tables using .write.format('delta').mode('overwrite').saveAsTable('<table_name>').\n"
        "- CRITICAL: Use ONLY single-part table name in saveAsTable (e.g. saveAsTable('orders')). Never prefix lakehouse name.\n"
    ),
    "Gold": (
        "## YOUR LAYER: GOLD\nWrite Gold dimensional modeling notebook.\n"
        "- Read ONLY from Silver lakehouse tables. Join Silver tables to construct Kimball Fact and Dimension tables.\n"
        "- Always project year/month before .partitionBy(). Write using .write.format('delta').mode('overwrite').saveAsTable('<table_name>').\n"
        "- CRITICAL: Use ONLY single-part table name in saveAsTable. Never prefix lakehouse name.\n"
    ),
}


def _build_medallion_prompt(
    step: PipelineStep,
    folder: str,
    upstream: list[WorkerResult] | WorkerResult | None,
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

    if layer != "Bronze":
        upstream_list = upstream if isinstance(upstream, list) else ([upstream] if upstream else [])
        for up in upstream_list:
            if up and up.delta_schema:
                upstream_schema_str = ", ".join(up.delta_schema[:20])
                parts.append(
                    f"\n\nUpstream {up.layer or 'Notebook'} (`{up.name}`) "
                    f"produces these output columns:\n{upstream_schema_str}\n"
                    f"Target lakehouse path / table: `{up.lh_path}`\n"
                    "Read from THAT lakehouse/table -- do NOT re-query the original source."
                )
            elif up and up.lh_path:
                parts.append(
                    f"\n\nUpstream {up.layer or 'Notebook'} (`{up.name}`) "
                    f"writes to: `{up.lh_path}`\n"
                    "Read from THAT lakehouse/table -- do NOT re-query the original source."
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


def _clean_code(raw: str) -> str:
    """Extracts pristine python/sql code, stripping markdown fences and conversational narratives."""
    m = re.search(r"```(?:python|pyspark|sql)?\s*\n(.*?)```", raw, re.DOTALL | re.IGNORECASE)
    code = m.group(1).strip() if m else raw.strip()
    if code.startswith("```"):
        lines = code.splitlines()
        lines = lines[1:] if lines[0].startswith("```") else lines
        lines = lines[:-1] if lines and lines[-1].startswith("```") else lines
        code = "\n".join(lines).strip()
    lines = code.splitlines()
    for i, line in enumerate(lines):
        l_str = line.strip()
        if l_str.startswith(("#", "from ", "import ", "spark.", "df", "source_", "--", "CREATE", "SELECT")):
            return "\n".join(lines[i:]).strip()
    return code


def _infer_lh_path(step: PipelineStep, folder: str, lakehouses: list[str] | None = None) -> str:
    """Infers the managed lakehouse name for a Medallion step matching planned lakehouses."""
    name_lower = step.name.lower()
    for layer in ("bronze", "silver", "gold"):
        if layer in name_lower:
            if lakehouses:
                matched = next((lh for lh in lakehouses if layer in lh.lower()), None)
                if matched:
                    return matched
            return f"lh_{folder.lower()}_{layer}"
    return step.name.replace("nb_", "lh_", 1)


def execute_notebook_worker(
    step: PipelineStep,
    folder: str,
    upstream: list[WorkerResult] | WorkerResult | None = None,
    session_id: str | None = None,
    target_model: str | None = None,
    effort: str = "medium",
    prompt_context: str | None = None,
    schema_context: str = "",
    lakehouses: list[str] | None = None,
) -> WorkerResult:
    start_t = time.perf_counter()
    start_utc = _now_utc_str()

    if session_id:
        set_progress_step(
            session_id,
            title=f"Synthesized PY {step.name}.py",
            detail=f"Synthesizing code for '{step.name}' ({step.layer or 'Notebook'}). Applying schema contracts...",
            status="in_progress",
            action="Synthesizing",
            badge="PY",
            target=f"{step.name}.py",
        )

    is_medallion = step.layer in ("Bronze", "Silver", "Gold")
    is_warehouse = step.layer == "Warehouse" or step.type == "warehouse"

    if is_warehouse:
        warehouse_skill = load_skills(["fabric_warehouse_and_tsql"])
        sys_prompt = WORKER_CODE_WAREHOUSE_SYSTEM + (f"\n\n{warehouse_skill}" if warehouse_skill else "")
        user_prompt = (
            f"Write T-SQL DDL and ELT stored procedure for Warehouse asset '{step.name}' in folder '{folder}'.\n"
            f"Task Description: {step.description}\n"
        )
        if schema_context:
            user_prompt += f"\nSchema Context:\n{schema_context}\n"
        if prompt_context:
            user_prompt += f"\nBusiness Context:\n{prompt_context[:1200]}\n"
    elif is_medallion:
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
        code = _clean_code(raw_code)

        lh_path = _infer_lh_path(step, folder, lakehouses=lakehouses)
        output_cols = resolve_upstream_schema(code)

        end_t = time.perf_counter()
        dur = round(end_t - start_t, 2)
        code_lines = len(code.splitlines())

        if session_id:
            set_progress_step(
                session_id,
                title=f"Synthesized PY {step.name}.py",
                detail=f"Code generated ({code_lines} lines, {dur}s). Output schema: {len(output_cols)} cols.",
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
        dur = round(time.perf_counter() - start_t, 2)
        if session_id:
            set_progress_step(
                session_id,
                title=f"Synthesized PY {step.name}.py",
                detail=f"Worker error: {e}",
                status="failed",
                action="Failed",
                badge="PY",
                target=f"{step.name}.py",
            )
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
    """Executes worker agents: topological resolution for Medallion/Warehouse, parallel for independent steps."""
    notebook_steps = [s for s in dag.steps if s.type in ("notebook", "warehouse_script")]
    if only_steps:
        notebook_steps = [s for s in notebook_steps if s.name in only_steps]

    medallion_order = {"Bronze": 0, "Silver": 1, "Gold": 2, "Warehouse": 3}
    ordered_steps = sorted(
        [s for s in notebook_steps if s.layer in ("Bronze", "Silver", "Gold", "Warehouse")],
        key=lambda s: medallion_order.get(s.layer or "", 4),
    )
    parallel_steps = [s for s in notebook_steps if s.layer not in ("Bronze", "Silver", "Gold", "Warehouse")]

    lh_list = getattr(dag, "lakehouses", None) or [s.name for s in dag.steps if s.type == "lakehouse"]
    results: dict[str, WorkerResult] = {}
    last_result: WorkerResult | None = None

    for step in ordered_steps:
        dep_ids = set(step.depends_on or [])
        matching_upstreams = [
            res for sid, res in results.items()
            if sid in dep_ids or any(res.name == d for d in dep_ids)
        ]
        chosen_upstream = matching_upstreams if matching_upstreams else ([last_result] if last_result else None)

        res = execute_notebook_worker(
            step,
            dag.folder,
            upstream=chosen_upstream,
            session_id=session_id,
            target_model=target_model,
            effort=effort,
            prompt_context=prompt_context,
            schema_context=schema_context,
            lakehouses=lh_list,
        )
        results[step.step_id] = res
        last_result = res

    if parallel_steps:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(parallel_steps), 6)) as pool:
            future_map = {
                pool.submit(
                    execute_notebook_worker,
                    s, dag.folder, None, session_id, target_model, effort, prompt_context, schema_context,
                    lakehouses=lh_list,
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
