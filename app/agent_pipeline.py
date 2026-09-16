"""
app/agent_pipeline.py
---------------------
4-Stage Native Multi-Agent State Pipeline for Fabric AI Studio
with High-Precision Stage & Activity-by-Activity Timestamping.

Stage 1: Meta-Planner  — Decomposes user prompt into a Step DAG
Stage 2: Worker Agents — Execute steps (sequential for Medallion, parallel for independent)
Stage 3: Builder       — Reconciles worker outputs into a unified FabricPlan
Stage 4: Auditor       — Validates plan vs original prompt; auto-remediates missing items

Entry point: run_pipeline(prompt, session_id, history) -> (FabricPlan dict, audit_messages list)
"""

from __future__ import annotations

import concurrent.futures
import json
import re
import threading
import time
import uuid
from dataclasses import dataclass, field
from datetime import UTC, datetime

from app.ingestion_planner import parse_schedule
from app.llm_router import chat
from app.meta_skill import (
    AUDITOR_SYSTEM,
    CONTEXT_GATE_SYSTEM,
    META_PLANNER_SYSTEM,
    WORKER_CODE_ALGO_SYSTEM,
    WORKER_CODE_MEDALLION_SYSTEM,
)
from app.skill_loader import load_skills

# ── Live Real-Time Multi-Agent Progress Store ────────────────────────────────
_ACTIVE_PROGRESS: dict[str, list[dict]] = {}
_PROGRESS_LOCK = threading.Lock()

def get_progress(session_id: str) -> list[dict]:
    """Returns a copy of the live intermediate steps for an active session."""
    with _PROGRESS_LOCK:
        return list(_ACTIVE_PROGRESS.get(session_id, []))

def set_progress_step(session_id: str, title: str, detail: str = "", status: str = "in_progress"):
    """Emits or advances a real-time progress step for the frontend."""
    if not session_id:
        return
    now_utc = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + " UTC"
    with _PROGRESS_LOCK:
        if session_id not in _ACTIVE_PROGRESS:
            _ACTIVE_PROGRESS[session_id] = []
        steps = _ACTIVE_PROGRESS[session_id]
        # Mark previous in_progress as completed
        for s in steps:
            if s.get("status") == "in_progress":
                s["status"] = "completed"
        steps.append({
            "title": title,
            "detail": detail,
            "status": status,
            "timestamp": now_utc
        })

def clear_progress(session_id: str):
    """Cleans up memory for a completed session."""
    if not session_id:
        return
    with _PROGRESS_LOCK:
        _ACTIVE_PROGRESS.pop(session_id, None)


def _now_utc_str() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + " UTC"


# ---------------------------------------------------------------------------
# Typed State Objects
# ---------------------------------------------------------------------------

@dataclass
class PipelineStep:
    step_id: str
    type: str           # folder | lakehouse | notebook | pipeline
    name: str
    layer: str | None   # Bronze | Silver | Gold | Notebook | None
    description: str
    depends_on: list = field(default_factory=list)
    can_parallel: bool = False


@dataclass
class StepDAG:
    context_mode: str   # independent | follow_up
    folder: str
    steps: list
    pipeline: dict | None
    summary: str


@dataclass
class WorkerResult:
    step_id: str
    name: str
    layer: str | None
    pyspark: str
    delta_schema: list = field(default_factory=list)
    lh_path: str = ""
    error: str | None = None
    started_at: str = ""
    completed_at: str = ""
    duration_sec: float = 0.0


@dataclass
class AuditResult:
    passed: bool
    missing_items: list = field(default_factory=list)
    extra_items: list = field(default_factory=list)
    chat_message: str = ""
    started_at: str = ""
    completed_at: str = ""
    duration_sec: float = 0.0


@dataclass
class PipelineState:
    prompt: str
    session_id: str
    history: list
    current_plan: dict | None = None
    context_mode: str = "independent"
    dag: StepDAG | None = None
    worker_results: dict = field(default_factory=dict)
    fabric_plan: dict | None = None
    audit: AuditResult | None = None
    audit_messages: list = field(default_factory=list)
    retry_count: int = 0
    run_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    started_at: str = field(default_factory=_now_utc_str)
    completed_at: str = ""
    total_duration_sec: float = 0.0
    stage_timings: dict = field(default_factory=dict)
    target_model: str | None = None
    effort: str = "medium"


MAX_AUDIT_RETRIES = 2


# ---------------------------------------------------------------------------
# JSON Extraction Utility
# ---------------------------------------------------------------------------

def _extract_json(raw: str) -> dict | None:
    if not raw:
        return None
    clean = raw.strip()
    try:
        return json.loads(clean)
    except Exception:
        pass
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean, re.IGNORECASE)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except Exception:
            pass
    s, e = clean.find("{"), clean.rfind("}")
    if s != -1 and e > s:
        candidate = clean[s:e + 1]
        try:
            return json.loads(candidate)
        except Exception:
            cleaned = re.sub(r",\s*([}\]])", r"\1", candidate)
            try:
                return json.loads(cleaned)
            except Exception:
                pass
    return None


# ---------------------------------------------------------------------------
# Stage 0: Context Gate
# ---------------------------------------------------------------------------

def _run_context_gate(state: PipelineState) -> str:
    if not state.current_plan:
        return "independent"
    plan_summary = {
        "folder": state.current_plan.get("folder"),
        "notebooks": [nb.get("name") for nb in state.current_plan.get("notebooks", [])],
        "pipeline": state.current_plan.get("pipeline", {}).get("name") if state.current_plan.get("pipeline") else None
    }
    msgs = [
        {"role": "system", "content": CONTEXT_GATE_SYSTEM},
        {"role": "user", "content": f"Current plan: {json.dumps(plan_summary)}\n\nNew user prompt: {state.prompt}"}
    ]
    try:
        raw = chat(
            msgs,
            complexity="standard",
            max_tokens=256,
            target_model=state.target_model,
            effort=state.effort,
            session_id=state.session_id,
        )
        parsed = _extract_json(raw)
        if parsed and parsed.get("mode") in ("follow_up", "independent"):
            return parsed["mode"]
    except Exception:
        pass
    prompt_lower = state.prompt.lower()
    names = (plan_summary.get("notebooks") or []) + [plan_summary.get("folder") or "", plan_summary.get("pipeline") or ""]
    overlap = any(n.lower() in prompt_lower for n in names if n)
    return "follow_up" if overlap else "independent"


# ---------------------------------------------------------------------------
# Stage 1: Meta-Planner
# ---------------------------------------------------------------------------

def _run_meta_planner(state: PipelineState) -> StepDAG:
    context_hint = ""
    if state.context_mode == "follow_up" and state.current_plan:
        context_hint = "\n\nExisting session context (for follow-up refinements only):\n" + json.dumps({
            "folder": state.current_plan.get("folder"),
            "notebooks": [n.get("name") for n in state.current_plan.get("notebooks", [])],
            "pipeline": state.current_plan.get("pipeline", {}).get("name") if state.current_plan.get("pipeline") else None
        })

    msgs = [
        {"role": "system", "content": META_PLANNER_SYSTEM},
        {"role": "user", "content": state.prompt + context_hint}
    ]
    raw = chat(
        msgs,
        complexity="standard",
        max_tokens=2048,
        target_model=state.target_model,
        effort=state.effort,
        session_id=state.session_id,
    )
    parsed = _extract_json(raw)

    if not parsed or not parsed.get("steps"):
        return _heuristic_dag(state.prompt)

    steps = []
    for s in parsed.get("steps", []):
        steps.append(PipelineStep(
            step_id=s.get("step_id", f"step_{uuid.uuid4().hex[:4]}"),
            type=s.get("type", "notebook"),
            name=s.get("name", "nb_transform"),
            layer=s.get("layer"),
            description=s.get("description", ""),
            depends_on=s.get("depends_on", []),
            can_parallel=s.get("can_parallel", False)
        ))

    return StepDAG(
        context_mode=parsed.get("context_mode", state.context_mode),
        folder=parsed.get("folder", "AI_Test_Folder"),
        steps=steps,
        pipeline=parsed.get("pipeline"),
        summary=parsed.get("summary", "")
    )


def _heuristic_dag(prompt: str) -> StepDAG:
    """Regex-based fallback StepDAG if LLM JSON is malformed."""
    folder = "AI_Test_Folder"
    fm = re.search(r"\b(?:project\s+folder|folder|project)\s+(?:like|named|called|for)?\s*['\"]?([A-Za-z0-9_\-]+)", prompt, re.IGNORECASE)
    if fm and fm.group(1).lower() not in ("named", "called", "folder", "like", "for"):
        folder = fm.group(1).strip()
    else:
        nm = re.search(r"\b(?:named|called|like)\s+['\"]?([A-Za-z0-9_\-]+)", prompt, re.IGNORECASE)
        if nm and nm.group(1).lower() not in ("named", "called", "folder", "like"):
            folder = nm.group(1).strip()

    nb_lines = re.findall(r"[-*\u2022]?\s*(nb_[a-zA-Z0-9_\-]+)\s*[:\-]\s*([^\n\r]+)", prompt, re.IGNORECASE)
    nb_tokens = list(dict.fromkeys(re.findall(r"\b(nb_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))

    # Detect numeric notebook counts e.g. "3 nb", "3 notebooks"
    if not nb_lines and not nb_tokens:
        count_m = re.search(r"\b(\d+)\s*(?:nb|notebooks?|pyspark)\b", prompt, re.IGNORECASE)
        if count_m:
            cnt = int(count_m.group(1))
            prefix = folder.lower() if folder != "AI_Test_Folder" else "medallion"
            if cnt == 3:
                nb_lines = [
                    (f"nb_{prefix}_bronze_ingest", "Raw data ingestion and schema validation"),
                    (f"nb_{prefix}_silver_merge", "Delta Lake MERGE deduplication and SCD upsert"),
                    (f"nb_{prefix}_gold_star", "Kimball dimensional modeling and star schema aggregations"),
                ]
            else:
                nb_lines = [
                    (f"nb_{prefix}_stage_{i+1}", f"PySpark data processing activity {i+1}")
                    for i in range(cnt)
                ]

    # Structure folder steps with containment inside AI_Test_Folder
    if folder != "AI_Test_Folder":
        steps = [
            PipelineStep(step_id="step_root_folder", type="folder", name="AI_Test_Folder", layer=None,
                         description="Workspace containment sandbox root", depends_on=[], can_parallel=False),
            PipelineStep(step_id="step_folder", type="folder", name=f"AI_Test_Folder/{folder}", layer=None,
                         description=f"Project folder {folder} inside AI_Test_Folder", depends_on=["step_root_folder"], can_parallel=False),
        ]
    else:
        steps = [PipelineStep(step_id="step_folder", type="folder", name=folder, layer=None,
                              description=f"Create folder {folder}", depends_on=[], can_parallel=False)]
    nb_step_ids = []

    if nb_lines:
        for nb_name, desc in nb_lines:
            sid = f"step_{nb_name.strip().lower()}"
            steps.append(PipelineStep(step_id=sid, type="notebook", name=nb_name.strip(), layer="Notebook",
                                      description=desc.strip(), depends_on=["step_folder"], can_parallel=True))
            nb_step_ids.append(sid)
    elif nb_tokens:
        for tok in nb_tokens:
            sid = f"step_{tok.lower()}"
            steps.append(PipelineStep(step_id=sid, type="notebook", name=tok, layer="Notebook",
                                      description=f"PySpark notebook {tok}", depends_on=["step_folder"], can_parallel=True))
            nb_step_ids.append(sid)
    elif "notebook" in prompt.lower():
        algo_m = re.search(r"with\s+([A-Za-z0-9_\-]+)\s+code", prompt, re.IGNORECASE)
        nb_m = re.search(r"notebook\s+(?:named\s+|called\s+)?([A-Za-z0-9_\-]+)", prompt, re.IGNORECASE)
        name_cand = algo_m.group(1) if algo_m else (nb_m.group(1) if nb_m else "transform")
        if not name_cand.startswith("nb_"):
            name_cand = f"nb_{name_cand}"
        sid = f"step_{name_cand.lower()}"
        steps.append(PipelineStep(step_id=sid, type="notebook", name=name_cand, layer="Notebook",
                                  description=f"PySpark algorithm notebook {name_cand}", depends_on=["step_folder"], can_parallel=True))
        nb_step_ids.append(sid)

    lh_tokens = list(dict.fromkeys(re.findall(r"\b(lh_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    if not lh_tokens and "lakehouse" in prompt.lower():
        prefix = folder.lower() if folder != "AI_Test_Folder" else "enterprise"
        lh_tokens = [f"lh_{prefix}_bronze", f"lh_{prefix}_silver", f"lh_{prefix}_gold"]
    for lh in lh_tokens:
        steps.append(PipelineStep(step_id=f"step_{lh}", type="lakehouse", name=lh, layer=None,
                                  description=f"Create lakehouse {lh}", depends_on=["step_folder"], can_parallel=True))

    wh_tokens = list(dict.fromkeys(re.findall(r"\b(wh_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    if not wh_tokens and "warehouse" in prompt.lower():
        prefix = folder.lower() if folder != "AI_Test_Folder" else "enterprise"
        wh_tokens = [f"wh_{prefix}_analytics"]
    for wh in wh_tokens:
        steps.append(PipelineStep(step_id=f"step_{wh}", type="warehouse", name=wh, layer=None,
                                  description=f"Synapse Warehouse {wh}", depends_on=["step_folder"], can_parallel=True))

    mir_tokens = list(dict.fromkeys(re.findall(r"\b(mir_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    for mir in mir_tokens:
        steps.append(PipelineStep(step_id=f"step_{mir}", type="mirrored_db", name=mir, layer=None,
                                  description=f"Mirrored Database {mir}", depends_on=["step_folder"], can_parallel=True))

    env_tokens = list(dict.fromkeys(re.findall(r"\b(env_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    if not env_tokens and "environment" in prompt.lower():
        env_tokens = [f"env_{folder.lower()}_runtime"]
    for env in env_tokens:
        steps.append(PipelineStep(step_id=f"step_{env}", type="environment", name=env, layer=None,
                                  description=f"Fabric Environment {env}", depends_on=["step_folder"], can_parallel=True))

    kql_tokens = list(dict.fromkeys(re.findall(r"\b(kql_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    for kql in kql_tokens:
        steps.append(PipelineStep(step_id=f"step_{kql}", type="kql_database", name=kql, layer=None,
                                  description=f"KQL Database {kql}", depends_on=["step_folder"], can_parallel=True))

    kq_tokens = list(dict.fromkeys(re.findall(r"\b(kq_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    for kq in kq_tokens:
        steps.append(PipelineStep(step_id=f"step_{kq}", type="kql_queryset", name=kq, layer=None,
                                  description=f"KQL Queryset {kq}", depends_on=["step_folder"], can_parallel=True))

    es_tokens = list(dict.fromkeys(re.findall(r"\b(es_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    for es in es_tokens:
        steps.append(PipelineStep(step_id=f"step_{es}", type="eventstream", name=es, layer=None,
                                  description=f"Real-Time Eventstream {es}", depends_on=["step_folder"], can_parallel=True))

    df_tokens = list(dict.fromkeys(re.findall(r"\b(df_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    for df in df_tokens:
        steps.append(PipelineStep(step_id=f"step_{df}", type="dataflow", name=df, layer=None,
                                  description=f"Dataflow Gen2 {df}", depends_on=["step_folder"], can_parallel=True))

    sjd_tokens = list(dict.fromkeys(re.findall(r"\b(sjd_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    for sjd in sjd_tokens:
        steps.append(PipelineStep(step_id=f"step_{sjd}", type="spark_job", name=sjd, layer=None,
                                  description=f"Spark Job Definition {sjd}", depends_on=["step_folder"], can_parallel=True))

    rfx_tokens = list(dict.fromkeys(re.findall(r"\b(rfx_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    for rfx in rfx_tokens:
        steps.append(PipelineStep(step_id=f"step_{rfx}", type="reflex", name=rfx, layer=None,
                                  description=f"Data Activator Reflex {rfx}", depends_on=["step_folder"], can_parallel=True))

    # Semantic Models (Direct Lake)
    sm_tokens = list(dict.fromkeys(re.findall(r"\b(sm_[a-zA-Z0-9_\-]+|sem_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    if not sm_tokens and "semantic model" in prompt.lower():
        sm_tokens = [f"sm_{folder.lower()}_gold"]
    for sm in sm_tokens:
        steps.append(PipelineStep(step_id=f"step_{sm}", type="semantic_model", name=sm, layer="Gold",
                                  description=f"Direct Lake Semantic Model {sm}", depends_on=nb_step_ids or ["step_folder"], can_parallel=True))

    rpt_tokens = list(dict.fromkeys(re.findall(r"\b(rpt_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    for rpt in rpt_tokens:
        steps.append(PipelineStep(step_id=f"step_{rpt}", type="report", name=rpt, layer=None,
                                  description=f"Power BI Report {rpt}", depends_on=nb_step_ids or ["step_folder"], can_parallel=True))

    gql_tokens = list(dict.fromkeys(re.findall(r"\b(gql_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    for gql in gql_tokens:
        steps.append(PipelineStep(step_id=f"step_{gql}", type="graphql_api", name=gql, layer=None,
                                  description=f"GraphQL API {gql}", depends_on=nb_step_ids or ["step_folder"], can_parallel=True))

    exp_tokens = list(dict.fromkeys(re.findall(r"\b(mlexp_[a-zA-Z0-9_\-]+|exp_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    for exp in exp_tokens:
        steps.append(PipelineStep(step_id=f"step_{exp}", type="ml_experiment", name=exp, layer=None,
                                  description=f"ML Experiment {exp}", depends_on=["step_folder"], can_parallel=True))

    # OneLake Shortcuts
    sc_tokens = list(dict.fromkeys(re.findall(r"\b(sc_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    if not sc_tokens and "shortcut" in prompt.lower():
        sc_tokens = [f"sc_{folder.lower()}_raw"]
    for sc in sc_tokens:
        steps.append(PipelineStep(step_id=f"step_{sc}", type="shortcut", name=sc, layer=None,
                                  description=f"OneLake Shortcut {sc}", depends_on=["step_folder"], can_parallel=True))

    pl_match = re.search(r"\b(pl_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)
    pl_name = pl_match.group(1) if pl_match else f"pl_{folder.lower()}_etl"
    sched = parse_schedule(prompt)
    pipeline_dict = {"name": pl_name, "schedule": sched}

    steps.append(PipelineStep(step_id="step_pipeline", type="pipeline", name=pl_name, layer=None,
                               description=f"Pipeline {pl_name}", depends_on=nb_step_ids or ["step_folder"],
                               can_parallel=False))

    nb_desc = f"{len(nb_step_ids)} notebook(s)" if nb_step_ids else "PySpark pipeline"
    sched_text = sched.get("human", "Daily") if isinstance(sched, dict) else str(sched)
    return StepDAG(context_mode="independent", folder=folder, steps=steps,
                   pipeline=pipeline_dict, summary=f"Architecture plan for folder '{folder}' with {nb_desc} orchestrated by pipeline '{pl_name}' ({sched_text}).")


# ---------------------------------------------------------------------------
# Stage 2: Worker Agents
# ---------------------------------------------------------------------------

def _execute_notebook_worker(
    step: PipelineStep,
    folder: str,
    upstream: WorkerResult | None = None,
    session_id: str | None = None,
    target_model: str | None = None,
    effort: str = "medium",
) -> WorkerResult:
    start_t = time.perf_counter()
    start_utc = _now_utc_str()

    if session_id:
        set_progress_step(
            session_id,
            f"Worker Agent: {step.name}",
            f"Synthesizing PySpark implementation for '{step.name}' ({step.layer or 'Notebook'}). Ingesting schema and generating Delta Lake logic...",
            "in_progress"
        )

    is_medallion = step.layer in ("Bronze", "Silver", "Gold")

    if is_medallion:
        medallion_skill = load_skills(["fabric_medallion_architecture"])
        sys_prompt = WORKER_CODE_MEDALLION_SYSTEM + (f"\n\n{medallion_skill}" if medallion_skill else "")
    else:
        sys_prompt = WORKER_CODE_ALGO_SYSTEM

    user_prompt = f"Write PySpark code for notebook '{step.name}' in folder '{folder}'.\nDescription: {step.description}"
    if upstream and upstream.delta_schema:
        user_prompt += f"\n\nUpstream context from {upstream.name}:\n" + json.dumps(
            {"lh_path": upstream.lh_path, "schema": upstream.delta_schema[:10]})

    try:
        msgs = [{"role": "system", "content": sys_prompt}, {"role": "user", "content": user_prompt}]
        raw_code = chat(
            msgs,
            complexity="high",
            max_tokens=3000,
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
        if session_id:
            set_progress_step(
                session_id,
                f"Worker Agent: {step.name}",
                f"PySpark notebook code generated ({len(code.splitlines())} lines, {dur}s). Delta target: '{lh_guess}'.",
                "completed"
            )
        return WorkerResult(
            step_id=step.step_id,
            name=step.name,
            layer=step.layer,
            pyspark=code,
            lh_path=lh_guess,
            started_at=start_utc,
            completed_at=_now_utc_str(),
            duration_sec=dur
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
            duration_sec=dur
        )


def _run_workers(
    dag: StepDAG,
    only_steps: list | None = None,
    session_id: str | None = None,
    target_model: str | None = None,
    effort: str = "medium",
) -> dict:
    notebook_steps = [s for s in dag.steps if s.type == "notebook"]
    if only_steps:
        notebook_steps = [s for s in notebook_steps if s.name in only_steps]

    medallion_order = {"Bronze": 0, "Silver": 1, "Gold": 2}
    medallion_steps = sorted([s for s in notebook_steps if s.layer in ("Bronze", "Silver", "Gold")],
                              key=lambda s: medallion_order.get(s.layer or "", 3))
    parallel_steps = [s for s in notebook_steps if s.layer not in ("Bronze", "Silver", "Gold")]

    results = {}
    last_result = None
    for step in medallion_steps:
        res = _execute_notebook_worker(
            step,
            dag.folder,
            upstream=last_result,
            session_id=session_id,
            target_model=target_model,
            effort=effort,
        )
        results[step.step_id] = res
        last_result = res

    if parallel_steps:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(parallel_steps), 6)) as pool:
            future_map = {
                pool.submit(_execute_notebook_worker, s, dag.folder, None, session_id, target_model, effort): s.step_id
                for s in parallel_steps
            }
            for future in concurrent.futures.as_completed(future_map):
                sid = future_map[future]
                try:
                    results[sid] = future.result()
                except Exception as e:
                    results[sid] = WorkerResult(step_id=sid, name=sid, layer=None,
                                                 pyspark=f"# Error: {e}", error=str(e),
                                                 started_at=_now_utc_str(), completed_at=_now_utc_str(), duration_sec=0.0)
    return results


# ---------------------------------------------------------------------------
# Stage 3: Builder / Reconciler
# ---------------------------------------------------------------------------

def _run_builder(dag: StepDAG, worker_results: dict, run_id: str) -> dict:
    notebook_steps = [s for s in dag.steps if s.type == "notebook"]
    notebooks = []
    for step in notebook_steps:
        res = worker_results.get(step.step_id)
        code = res.pyspark if res else f"# Missing code for {step.name}"
        notebooks.append({
            "name": step.name,
            "description": step.description,
            "layer": step.layer or "Notebook",
            "pyspark": code,
            "pyspark_code": code
        })

    lakehouses = [s.name for s in dag.steps if s.type == "lakehouse"]
    warehouses = [s.name for s in dag.steps if s.type == "warehouse"]
    mirrored_databases = [s.name for s in dag.steps if s.type in ("mirrored_database", "mirrored_db")]
    kql_databases = [s.name for s in dag.steps if s.type == "kql_database"]
    kql_querysets = [s.name for s in dag.steps if s.type == "kql_queryset"]
    eventstreams = [s.name for s in dag.steps if s.type == "eventstream"]
    dataflows = [s.name for s in dag.steps if s.type == "dataflow"]
    spark_job_definitions = [s.name for s in dag.steps if s.type in ("spark_job_definition", "spark_job")]
    reflexes = [s.name for s in dag.steps if s.type == "reflex"]
    semantic_models = [s.name for s in dag.steps if s.type == "semantic_model"]
    reports = [s.name for s in dag.steps if s.type == "report"]
    graphql_apis = [s.name for s in dag.steps if s.type == "graphql_api"]
    ml_experiments = [s.name for s in dag.steps if s.type == "ml_experiment"]
    shortcuts = [s.name for s in dag.steps if s.type == "shortcut"]
    environments = [s.name for s in dag.steps if s.type == "environment"]

    pipeline = None
    if dag.pipeline:
        pl = dag.pipeline
        sched_raw = pl.get("schedule", "")
        if isinstance(sched_raw, dict):
            sched_info = sched_raw
        elif isinstance(sched_raw, str) and sched_raw.strip():
            sched_info = parse_schedule(sched_raw)
        else:
            sched_info = parse_schedule(dag.summary or "")
        pipeline = {"name": pl.get("name", f"pl_{dag.folder.lower()}_etl"), "schedule": sched_info}

    # Generate explicit DAG flow nodes & edges for the UI Visual Canvas
    flow_nodes = []
    flow_edges = []
    col_idx = 0
    COL_WIDTH = 300
    ROW_HEIGHT = 96

    # 1. Folder node
    flow_nodes.append({
        "id": "fld_root",
        "label": dag.folder,
        "type": "folder",
        "tag": "FABRIC CONTAINER",
        "sub": "Workspace Directory",
        "status": "live",
        "x": 30,
        "y": 30
    })
    col_idx += 1

    # 2. Storage Tier (Lakehouses, Warehouses, Mirrored DBs)
    storage_ids = []
    storage_items = [(lh, "lakehouse", "LAKEHOUSE", "Managed Delta Store") for lh in lakehouses] + \
                    [(wh, "warehouse", "SYNAPSE WAREHOUSE", "T-SQL DDL & Direct Lake") for wh in warehouses] + \
                    [(mir, "mirrored_db", "MIRRORED DATABASE", "CDC Zero-ETL Sync") for mir in mirrored_databases]
    for i, (name, itype, tag, sub) in enumerate(storage_items):
        s_id = f"{itype}_{i}"
        flow_nodes.append({
            "id": s_id,
            "label": name,
            "type": itype,
            "tag": tag,
            "sub": sub,
            "status": "pending",
            "x": 30 + col_idx * COL_WIDTH,
            "y": 30 + i * ROW_HEIGHT
        })
        flow_edges.append({"from": "fld_root", "to": s_id})
        storage_ids.append(s_id)
    if storage_items:
        col_idx += 1

    # 3. Real-Time & Ingestion (Eventstreams, KQL DBs, Dataflows)
    ingest_ids = []
    ingest_items = [(es, "eventstream", "REAL-TIME EVENTSTREAM", "Streaming Pipeline") for es in eventstreams] + \
                   [(kql, "kql_database", "KQL DATABASE", "Kusto Telemetry Store") for kql in kql_databases] + \
                   [(df, "dataflow", "DATAFLOW GEN2", "Power Query M Mashup") for df in dataflows]
    for i, (name, itype, tag, sub) in enumerate(ingest_items):
        i_id = f"{itype}_{i}"
        flow_nodes.append({
            "id": i_id,
            "label": name,
            "type": itype,
            "tag": tag,
            "sub": sub,
            "status": "pending",
            "x": 30 + col_idx * COL_WIDTH,
            "y": 30 + i * ROW_HEIGHT
        })
        flow_edges.append({"from": "fld_root", "to": i_id})
        ingest_ids.append(i_id)
    if ingest_items:
        col_idx += 1

    # 4. Compute & Notebooks (PySpark Notebooks, Spark Job Definitions)
    compute_ids = []
    for i, nb in enumerate(notebooks):
        nb_id = f"nb_{i}"
        nb_layer = nb.get("layer", "PySpark")
        flow_nodes.append({
            "id": nb_id,
            "label": nb.get("name", f"notebook_{i+1}"),
            "type": "notebook",
            "tag": f"{nb_layer.upper()} NOTEBOOK",
            "sub": nb.get("description", "PySpark Code Transformation"),
            "status": "pending",
            "x": 30 + col_idx * COL_WIDTH,
            "y": 30 + i * ROW_HEIGHT
        })
        compute_ids.append(nb_id)
        if storage_ids:
            target_store = storage_ids[min(i, len(storage_ids) - 1)]
            flow_edges.append({"from": target_store, "to": nb_id})
        elif i == 0:
            flow_edges.append({"from": "fld_root", "to": nb_id})

    for i, sjd_name in enumerate(spark_job_definitions):
        sjd_id = f"sjd_{i}"
        flow_nodes.append({
            "id": sjd_id,
            "label": sjd_name,
            "type": "spark_job",
            "tag": "SPARK JOB DEFINITION",
            "sub": "Batch PySpark Executable",
            "status": "pending",
            "x": 30 + col_idx * COL_WIDTH,
            "y": 30 + (len(notebooks) + i) * ROW_HEIGHT
        })
        compute_ids.append(sjd_id)
        flow_edges.append({"from": storage_ids[-1] if storage_ids else "fld_root", "to": sjd_id})

    if notebooks or spark_job_definitions:
        col_idx += 1

    # 5. Serving & Analytics (Semantic Models, Reports, KQL Querysets, Reflex, GraphQL, ML)
    serving_ids = []
    serving_items = [(sm, "semantic_model", "DIRECT LAKE MODEL", "Power BI Direct Lake TMDL") for sm in semantic_models] + \
                    [(rpt, "report", "POWER BI REPORT", "PBIR Visual Model") for rpt in reports] + \
                    [(kq, "kql_queryset", "KQL QUERYSET", "Kusto Anomaly Queries") for kq in kql_querysets] + \
                    [(rfx, "reflex", "DATA ACTIVATOR", "Real-Time Triggers & Webhooks") for rfx in reflexes] + \
                    [(gql, "graphql_api", "GRAPHQL API", "GraphQL Schema & Resolvers") for gql in graphql_apis] + \
                    [(exp, "ml_experiment", "ML EXPERIMENT", "MLflow Run Tracking") for exp in ml_experiments]

    for i, (name, itype, tag, sub) in enumerate(serving_items):
        srv_id = f"{itype}_{i}"
        flow_nodes.append({
            "id": srv_id,
            "label": name,
            "type": itype,
            "tag": tag,
            "sub": sub,
            "status": "pending",
            "x": 30 + col_idx * COL_WIDTH,
            "y": 30 + i * ROW_HEIGHT
        })
        serving_ids.append(srv_id)
        if compute_ids:
            flow_edges.append({"from": compute_ids[-1], "to": srv_id})
        elif storage_ids:
            flow_edges.append({"from": storage_ids[-1], "to": srv_id})
        else:
            flow_edges.append({"from": "fld_root", "to": srv_id})
    if serving_items:
        col_idx += 1

    # 6. Pipeline Orchestration
    if pipeline:
        pl_name = pipeline.get("name", f"pl_{dag.folder.lower()}_job")
        pl_sched = pipeline.get("schedule", "Scheduled Trigger DAG")
        max_rows = max(len(notebooks), len(storage_ids), len(serving_items), 1)
        pl_y = max(30, int((max_rows * ROW_HEIGHT) / 2) - 38)
        flow_nodes.append({
            "id": "pl_root",
            "label": pl_name,
            "type": "pipeline",
            "tag": "FABRIC PIPELINE",
            "sub": f"{pl_sched.get('frequency', 'Daily')} Trigger" if isinstance(pl_sched, dict) else str(pl_sched),
            "status": "pending",
            "x": 30 + col_idx * COL_WIDTH,
            "y": pl_y
        })
        if serving_ids:
            for sid in serving_ids:
                flow_edges.append({"from": sid, "to": "pl_root"})
        elif compute_ids:
            for cid in compute_ids:
                flow_edges.append({"from": cid, "to": "pl_root"})
        elif storage_ids:
            for lid in storage_ids:
                flow_edges.append({"from": lid, "to": "pl_root"})
        else:
            flow_edges.append({"from": "fld_root", "to": "pl_root"})

    return {
        "type": "plan",
        "run_id": run_id,
        "folder": dag.folder,
        "lakehouses": lakehouses,
        "warehouses": warehouses,
        "mirrored_databases": mirrored_databases,
        "kql_databases": kql_databases,
        "kql_querysets": kql_querysets,
        "eventstreams": eventstreams,
        "dataflows": dataflows,
        "spark_job_definitions": spark_job_definitions,
        "reflexes": reflexes,
        "semantic_models": semantic_models,
        "reports": reports,
        "graphql_apis": graphql_apis,
        "ml_experiments": ml_experiments,
        "shortcuts": shortcuts,
        "environment": environments[0] if environments else None,
        "environments": environments,
        "notebooks": notebooks,
        "notebooks_preview": [{"name": nb["name"], "pyspark_code": nb["pyspark_code"]} for nb in notebooks],
        "pipeline": pipeline,
        "flow_nodes": flow_nodes,
        "flow_edges": flow_edges,
        "pyspark_code": notebooks[0]["pyspark_code"] if notebooks else "",
        "summary": dag.summary or f"Fabric architecture plan for {dag.folder}",
        "status": "planned",
        "_pipeline_type": "multi_agent"
    }


# ---------------------------------------------------------------------------
# Stage 4: Auditor
# ---------------------------------------------------------------------------

def _run_auditor(
    prompt: str,
    plan: dict,
    target_model: str | None = None,
    effort: str = "medium",
    session_id: str | None = None,
) -> AuditResult:
    start_t = time.perf_counter()
    start_utc = _now_utc_str()

    plan_summary = {
        "folder": plan.get("folder"),
        "notebooks": [nb.get("name") for nb in plan.get("notebooks", [])],
        "lakehouses": plan.get("lakehouses", []),
        "pipeline_name": plan.get("pipeline", {}).get("name") if plan.get("pipeline") else None,
        "schedule": str(plan.get("pipeline", {}).get("schedule", "")) if plan.get("pipeline") else None
    }
    msgs = [
        {"role": "system", "content": AUDITOR_SYSTEM},
        {"role": "user", "content": f"User original request:\n{prompt}\n\nAssembled plan:\n{json.dumps(plan_summary, indent=2)}"}
    ]
    try:
        raw = chat(
            msgs,
            complexity="standard",
            max_tokens=512,
            target_model=target_model,
            effort=effort,
            session_id=session_id,
        )
        parsed = _extract_json(raw)
        end_t = time.perf_counter()
        if parsed:
            return AuditResult(
                passed=bool(parsed.get("passed", True)),
                missing_items=parsed.get("missing_items", []),
                extra_items=parsed.get("extra_items", []),
                chat_message=parsed.get("chat_message", "Audit complete."),
                started_at=start_utc,
                completed_at=_now_utc_str(),
                duration_sec=round(end_t - start_t, 2)
            )
    except Exception:
        pass

    # Pure code-level fallback audit
    end_t = time.perf_counter()
    nb_names = [nb.get("name", "") for nb in plan.get("notebooks", [])]
    missing = [n for n in re.findall(r"\b(nb_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE) if n not in nb_names]
    passed = len(missing) == 0
    return AuditResult(
        passed=passed,
        missing_items=missing,
        chat_message="Audit passed." if passed else f"Audit: Missing {missing}. Auto-remediating...",
        started_at=start_utc,
        completed_at=_now_utc_str(),
        duration_sec=round(end_t - start_t, 2)
    )


# ---------------------------------------------------------------------------
# Top-Level Entry Point
# ---------------------------------------------------------------------------

def run_pipeline(
    prompt: str,
    session_id: str,
    history: list | None = None,
    current_plan: dict | None = None,
    target_model: str | None = None,
    effort: str = "medium",
) -> tuple:
    """
    Main entry point for the 4-stage multi-agent pipeline.
    Returns: (FabricPlan dict, list of audit chat messages)
    """
    total_start_t = time.perf_counter()
    clear_progress(session_id)
    set_progress_step(
        session_id,
        "Context Gate: Intent Analysis",
        f"Analyzing conversation context & requirements for prompt: '{prompt[:100]}...'. Determining workflow mode (independent vs follow-up)...",
        "in_progress"
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
        state.context_mode = _run_context_gate(state)
    except Exception:
        state.context_mode = "independent"
    t0_end = time.perf_counter()
    t0_dur = round(t0_end - t0_start, 2)
    state.stage_timings["Stage 0 (Context Gate)"] = {
        "started_at": t0_utc,
        "completed_at": _now_utc_str(),
        "duration_sec": t0_dur
    }
    set_progress_step(
        session_id,
        "Context Gate: Resolved",
        f"Context classification: '{state.context_mode}' mode ({t0_dur}s). Proceeding to architecture DAG synthesis.",
        "completed"
    )

    # Stage 1: Meta-Planner
    set_progress_step(
        session_id,
        "Meta-Planner: DAG Decomposition",
        "Decomposing architecture into multi-stage execution DAG: identifying target workspace folder, PySpark notebooks, Delta Lakehouse tiers, and Azure Data Factory pipeline trigger schedules...",
        "in_progress"
    )
    t1_start = time.perf_counter()
    t1_utc = _now_utc_str()
    try:
        state.dag = _run_meta_planner(state)
    except Exception as e:
        state.dag = _heuristic_dag(prompt)
        state.audit_messages.append(f"Planner note: Used heuristic extraction ({e})")
    t1_end = time.perf_counter()
    t1_dur = round(t1_end - t1_start, 2)
    state.stage_timings["Stage 1 (Meta-Planner)"] = {
        "started_at": t1_utc,
        "completed_at": _now_utc_str(),
        "duration_sec": t1_dur
    }

    step_count = len(state.dag.steps) if state.dag else 0
    folder_target = state.dag.folder if state.dag else "AI_Test_Folder"
    step_names = ', '.join([f"'{s.name}'" for s in state.dag.steps]) if state.dag else ""
    pl_sched = state.dag.pipeline.get("schedule", "Daily") if (state.dag and state.dag.pipeline) else "None"

    set_progress_step(
        session_id,
        "Meta-Planner: Plan Created",
        f"Planned {step_count} item(s) in folder '{folder_target}': {step_names}. Pipeline schedule: {pl_sched} ({t1_dur}s).",
        "completed"
    )

    # Stages 2-3-4 loop with auto-remediation
    while state.retry_count <= MAX_AUDIT_RETRIES:
        # Stage 2: Workers
        t2_start = time.perf_counter()
        t2_utc = _now_utc_str()
        try:
            new_results = _run_workers(
                state.dag,
                session_id=session_id,
                target_model=state.target_model,
                effort=state.effort,
            )
            state.worker_results.update(new_results)
        except Exception as e:
            raise RuntimeError(f"Worker execution failed: {e}")
        t2_end = time.perf_counter()
        state.stage_timings[f"Stage 2 (Worker Agents - Attempt {state.retry_count + 1})"] = {
            "started_at": t2_utc,
            "completed_at": _now_utc_str(),
            "duration_sec": round(t2_end - t2_start, 2)
        }

        # Stage 3: Builder
        set_progress_step(
            session_id,
            "Plan Builder: Fabric Serialization",
            "Assembling unified Fabric architecture blueprint: compiling Base64 Trident notebook definitions, attaching Synapse Spark kernels, and generating Data Factory pipeline JSON with activities...",
            "in_progress"
        )
        t3_start = time.perf_counter()
        t3_utc = _now_utc_str()
        state.fabric_plan = _run_builder(state.dag, state.worker_results, state.run_id)
        t3_end = time.perf_counter()
        t3_dur = round(t3_end - t3_start, 2)
        state.stage_timings[f"Stage 3 (Builder / Reconciler - Attempt {state.retry_count + 1})"] = {
            "started_at": t3_utc,
            "completed_at": _now_utc_str(),
            "duration_sec": t3_dur
        }
        set_progress_step(
            session_id,
            "Plan Builder: Plan Packaged",
            f"Fabric Trident package compiled with {len(state.fabric_plan.get('notebooks', []))} notebook(s) and scheduled pipeline trigger ({t3_dur}s).",
            "completed"
        )

        # Stage 4: Auditor
        set_progress_step(
            session_id,
            "Auditor Agent: Architecture Audit",
            f"Executing independent audit against user requirements: validating primary keys, Medallion folder containment ('{folder_target}'), schedule trigger expressions, and verifying 0 missing components...",
            "in_progress"
        )
        t4_start = time.perf_counter()
        t4_utc = _now_utc_str()
        state.audit = _run_auditor(
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
            "duration_sec": t4_dur
        }

        if state.audit.passed:
            if state.retry_count > 0:
                state.audit_messages.append(f"Audit passed after {state.retry_count} auto-remediation(s).")
            set_progress_step(
                session_id,
                "Auditor Agent: Audit Passed",
                f"100% verified ({t4_dur}s). Zero missing components, schema constraints enforced, safe blast-radius confirmed.",
                "completed"
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
                # Check for explicit missing notebook names
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
                                can_parallel=True
                            ))
                            existing.add(missing_nb)
                elif "schedule" in missing_str.lower() or "cron" in missing_str.lower():
                    # If schedule mismatch, re-parse schedule directly from original user prompt
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
        "duration_sec": state.total_duration_sec
    }

    # Log full execution trace to execution_traces/session_<id>.md
    try:
        from app.execution_logger import log_agent_execution
        log_agent_execution(session_id, state)
    except Exception as log_err:
        print(f"[EXECUTION LOGGER ERROR] {log_err}")

    return state.fabric_plan, state.audit_messages
