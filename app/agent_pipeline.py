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

import json
import re
import uuid
import time
from datetime import datetime, timezone
import concurrent.futures
from dataclasses import dataclass, field

from app.llm_router import chat
from app.meta_skill import (
    META_PLANNER_SYSTEM, CONTEXT_GATE_SYSTEM, AUDITOR_SYSTEM,
    WORKER_CODE_ALGO_SYSTEM, WORKER_CODE_MEDALLION_SYSTEM
)
from app.skill_loader import load_skills
from app.ingestion_planner import parse_schedule


def _now_utc_str() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + " UTC"


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
        raw = chat(msgs, complexity="standard", max_tokens=256)
        parsed = _extract_json(raw)
        if parsed and parsed.get("mode") in ("follow_up", "independent"):
            return parsed["mode"]
    except Exception:
        pass
    plan_str = json.dumps(plan_summary).lower()
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
    raw = chat(msgs, complexity="standard", max_tokens=2048)
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
    fm = re.search(r"\b(?:project\s+folder|folder|project)\s+(?:named\s+|called\s+)?['\"]?([A-Za-z0-9_\-]+)", prompt, re.IGNORECASE)
    if fm and fm.group(1).lower() not in ("named", "called", "folder"):
        folder = fm.group(1).strip()
    else:
        nm = re.search(r"\bnamed\s+['\"]?([A-Za-z0-9_\-]+)", prompt, re.IGNORECASE)
        if nm:
            folder = nm.group(1).strip()

    nb_lines = re.findall(r"[-*\u2022]?\s*(nb_[a-zA-Z0-9_\-]+)\s*[:\-]\s*([^\n\r]+)", prompt, re.IGNORECASE)
    nb_tokens = list(dict.fromkeys(re.findall(r"\b(nb_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))

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
    for lh in lh_tokens:
        steps.append(PipelineStep(step_id=f"step_{lh}", type="lakehouse", name=lh, layer=None,
                                  description=f"Create lakehouse {lh}", depends_on=["step_folder"], can_parallel=True))

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

def _execute_notebook_worker(step: PipelineStep, folder: str, upstream: WorkerResult | None = None) -> WorkerResult:
    start_t = time.perf_counter()
    start_utc = _now_utc_str()

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
        raw_code = chat(msgs, complexity="high", max_tokens=3000)
        code = raw_code.strip()
        if code.startswith("```"):
            lines = code.split("\n")
            lines = lines[1:] if lines[0].startswith("```") else lines
            lines = lines[:-1] if lines and lines[-1].startswith("```") else lines
            code = "\n".join(lines).strip()
        lh_guess = f"abfss://{folder.lower()}@onelake.dfs.fabric.microsoft.com/{step.name.replace('nb_', 'lh_')}"
        end_t = time.perf_counter()
        return WorkerResult(
            step_id=step.step_id,
            name=step.name,
            layer=step.layer,
            pyspark=code,
            lh_path=lh_guess,
            started_at=start_utc,
            completed_at=_now_utc_str(),
            duration_sec=round(end_t - start_t, 2)
        )
    except Exception as e:
        end_t = time.perf_counter()
        return WorkerResult(
            step_id=step.step_id,
            name=step.name,
            layer=step.layer,
            pyspark=f"# Error generating code: {e}\nprint('Error')",
            error=str(e),
            started_at=start_utc,
            completed_at=_now_utc_str(),
            duration_sec=round(end_t - start_t, 2)
        )


def _run_workers(dag: StepDAG, only_steps: list | None = None) -> dict:
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
        res = _execute_notebook_worker(step, dag.folder, upstream=last_result)
        results[step.step_id] = res
        last_result = res

    if parallel_steps:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(parallel_steps), 6)) as pool:
            future_map = {pool.submit(_execute_notebook_worker, s, dag.folder, None): s.step_id
                          for s in parallel_steps}
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

    return {
        "type": "plan",
        "run_id": run_id,
        "folder": dag.folder,
        "lakehouses": lakehouses,
        "environment": None,
        "notebooks": notebooks,
        "notebooks_preview": [{"name": nb["name"], "pyspark_code": nb["pyspark_code"]} for nb in notebooks],
        "pipeline": pipeline,
        "pyspark_code": notebooks[0]["pyspark_code"] if notebooks else "",
        "summary": dag.summary or f"Fabric architecture plan for {dag.folder}",
        "status": "planned",
        "_pipeline_type": "multi_agent"
    }


# ---------------------------------------------------------------------------
# Stage 4: Auditor
# ---------------------------------------------------------------------------

def _run_auditor(prompt: str, plan: dict) -> AuditResult:
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
        raw = chat(msgs, complexity="standard", max_tokens=512)
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

def run_pipeline(prompt: str, session_id: str, history: list | None = None,
                 current_plan: dict | None = None) -> tuple:
    """
    Main entry point for the 4-stage multi-agent pipeline.
    Returns: (FabricPlan dict, list of audit chat messages)
    """
    total_start_t = time.perf_counter()
    state = PipelineState(
        prompt=prompt,
        session_id=session_id,
        history=history or [],
        current_plan=current_plan
    )

    # Stage 0: Context Gate
    t0_start = time.perf_counter()
    t0_utc = _now_utc_str()
    try:
        state.context_mode = _run_context_gate(state)
    except Exception:
        state.context_mode = "independent"
    t0_end = time.perf_counter()
    state.stage_timings["Stage 0 (Context Gate)"] = {
        "started_at": t0_utc,
        "completed_at": _now_utc_str(),
        "duration_sec": round(t0_end - t0_start, 2)
    }

    # Stage 1: Meta-Planner
    t1_start = time.perf_counter()
    t1_utc = _now_utc_str()
    try:
        state.dag = _run_meta_planner(state)
    except Exception as e:
        state.dag = _heuristic_dag(prompt)
        state.audit_messages.append(f"Planner note: Used heuristic extraction ({e})")
    t1_end = time.perf_counter()
    state.stage_timings["Stage 1 (Meta-Planner)"] = {
        "started_at": t1_utc,
        "completed_at": _now_utc_str(),
        "duration_sec": round(t1_end - t1_start, 2)
    }

    # Stages 2-3-4 loop with auto-remediation
    while state.retry_count <= MAX_AUDIT_RETRIES:
        # Stage 2: Workers
        t2_start = time.perf_counter()
        t2_utc = _now_utc_str()
        try:
            new_results = _run_workers(state.dag)
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
        t3_start = time.perf_counter()
        t3_utc = _now_utc_str()
        state.fabric_plan = _run_builder(state.dag, state.worker_results, state.run_id)
        t3_end = time.perf_counter()
        state.stage_timings[f"Stage 3 (Builder / Reconciler - Attempt {state.retry_count + 1})"] = {
            "started_at": t3_utc,
            "completed_at": _now_utc_str(),
            "duration_sec": round(t3_end - t3_start, 2)
        }

        # Stage 4: Auditor
        t4_start = time.perf_counter()
        t4_utc = _now_utc_str()
        state.audit = _run_auditor(prompt, state.fabric_plan)
        t4_end = time.perf_counter()
        state.stage_timings[f"Stage 4 (Auditor - Attempt {state.retry_count + 1})"] = {
            "started_at": t4_utc,
            "completed_at": _now_utc_str(),
            "duration_sec": round(t4_end - t4_start, 2)
        }

        if state.audit.passed:
            if state.retry_count > 0:
                state.audit_messages.append(f"Audit passed after {state.retry_count} auto-remediation(s).")
            break

        # Show audit message, then remediate
        state.audit_messages.append(state.audit.chat_message)

        if state.retry_count >= MAX_AUDIT_RETRIES:
            state.audit_messages.append(
                f"Could not generate all requested items after {MAX_AUDIT_RETRIES} attempts. "
                f"Missing: {state.audit.missing_items}. "
                "The plan below contains everything that was successfully generated."
            )
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
