"""
app/chat_service.py
-------------------
Unified Chat and Multi-Agent Orchestration Service for Fabric AI Studio.
Routes architecture & engineering prompts to the 4-stage LangGraph pipeline
and answers conversational queries using grounded Fabric AI Studio context.
"""

from __future__ import annotations

import json
import re
from collections.abc import Generator
from typing import Any

from collections.abc import Generator
from app.agent_pipeline import run_pipeline
from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME
from app.domain.llm.streaming_router import chat_stream
from app.engine.formatter import build_thought_meta, format_architecture_response
from app.intent_classifier import classify_prompt_intent
from app.llm_router import chat
from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME
from app.tools.web_search import format_search_context, search_web

def _build_fabric_system_prompt() -> str:
    ws_ref = f"workspace {ALLOWED_WORKSPACE_ID}" if ALLOWED_WORKSPACE_ID else "the active Microsoft Fabric workspace"
    return (
        "You are Microsoft Fabric AI Studio — an autonomous enterprise data platform engineer.\n"
        f"You are directly integrated with Microsoft Fabric REST API {ws_ref} and OneLake.\n"
        "All Lakehouses, Warehouses, PySpark Notebooks, and Data Pipelines are provisioned directly to Microsoft Fabric.\n\n"
        "CRITICAL RULES:\n"
        "1. NEVER output local bash scripts, mkdir commands, or tell the user to manually create files on their local machine.\n"
        "2. When answering architecture queries, provide the PySpark / T-SQL / Delta Lake logic and explain how assets link in Microsoft Fabric.\n"
        "3. Keep answers concise, professional, and directly actionable."
    )

FABRIC_STUDIO_SYSTEM = _build_fabric_system_prompt()


def _detect_web_search_need(prompt: str) -> bool:
    """Detects if prompt is querying for live news, real-time events, current date, or live web info."""
    p = prompt.lower()
    keywords = [
        "today", "news", "latest", "recent", "current", "release notes",
        "what happened", "announcement", "live", "date today", "weather",
        "who won", "breaking", "price of", "sep 19", "september 19"
    ]
    return any(re.search(rf"\b{re.escape(k)}\b", p) for k in keywords)


def is_architecture_request(prompt: str, mode: str = "auto") -> bool:
    """Determines whether a user prompt is requesting Fabric asset creation or Medallion planning."""
    intent, _ = classify_prompt_intent(prompt, forced_mode=mode)
    return intent in ("BUILD_ARCHITECTURE", "DEPLOY_AND_RUN")


def _get_active_session_plan(session_id: str) -> dict[str, Any] | None:
    """Retrieves the latest synthesized architecture plan from the active session."""
    try:
        from app.session_store import get_session_runs
        for r in get_session_runs(session_id):
            p = r.get("plan_json")
            if p and isinstance(p, dict) and p.get("notebooks"):
                return p
    except Exception:
        pass
    return None


def _drain_step_queue(step_q: Any, worker_th: Any) -> Generator[tuple[str, str, dict[str, Any] | None], None, None]:
    """Yields progress thought steps in real time from worker thread queue."""
    import queue
    while True:
        try:
            item = step_q.get(timeout=0.05)
            if item is None:
                break
            yield ("thought_step", json.dumps(item), None)
        except queue.Empty:
            if not worker_th.is_alive():
                while not step_q.empty():
                    try:
                        rem = step_q.get_nowait()
                        if rem is not None:
                            yield ("thought_step", json.dumps(rem), None)
                    except Exception:
                        break
                break


def process_chat_turn(
    prompt: str,
    session_id: str,
    is_resuming: bool = False,
    target_model: str | None = None,
    complexity: str = "standard",
    effort: str = "medium",
    mode: str = "auto",
) -> tuple[str, dict[str, Any] | None]:
    """Executes a chat turn synchronously using LLM intent classification."""
    intent, meta = classify_prompt_intent(prompt, forced_mode=mode)
    print(f"[CHAT_TURN] Intent: {intent} (method: {meta.get('method')}, mode: {mode})")

    if intent in ("BUILD_ARCHITECTURE", "DEPLOY_AND_RUN"):
        plan = _get_active_session_plan(session_id) if intent == "DEPLOY_AND_RUN" else None
        audit_messages: list[str] = []
        if not plan:
            plan, audit_messages = run_pipeline(
                prompt,
                session_id=session_id,
                target_model=target_model,
                effort=effort,
            )
            try:
                from app.session_store import upsert_run
                upsert_run(run_id=plan.get("run_id", f"run_{session_id}"), session_id=session_id, plan_json=plan)
            except Exception:
                pass

        thought_tag = build_thought_meta(plan)
        response_text = thought_tag + format_architecture_response(plan, audit_messages)

        if intent == "DEPLOY_AND_RUN":
            from app.engine.executor import execute_closed_loop
            exec_rep = execute_closed_loop(plan, workspace_id=ALLOWED_WORKSPACE_ID, session_id=session_id)
            response_text += f"\n\n---\n\n{exec_rep.summary_markdown}"

        return response_text, plan

    search_context = ""
    if _detect_web_search_need(prompt):
        hits = search_web(prompt, max_results=4)
        if hits:
            search_context = format_search_context(hits)

    sys_prompt = (
        FABRIC_STUDIO_SYSTEM
        if intent == "PROJECT_CONSULT"
        else "You are a helpful, expert AI programming and knowledge assistant. Provide clear, concise, accurate responses."
    )
    if search_context:
        sys_prompt += f"\n\n{search_context}"

    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": prompt},
    ]

    use_complexity = "complex" if intent == "PROJECT_CONSULT" else complexity

    response_text = chat(
        messages=messages,
        complexity=use_complexity,
        target_model=target_model,
        effort=effort,
        session_id=session_id,
        resume=is_resuming,
    )
    return response_text, None


def process_chat_turn_stream(
    prompt: str,
    session_id: str,
    is_resuming: bool = False,
    target_model: str | None = None,
    complexity: str = "standard",
    effort: str = "medium",
    mode: str = "auto",
) -> Generator[tuple[str, str, dict[str, Any] | None], None, None]:
    """
    Real-time streaming chat generator with zero-shot LLM intent routing.
    Yields (event_type, payload_str, optional_plan).
    Event types: 'thought_step', 'chunk', 'stage', 'done'
    """
    intent, meta = classify_prompt_intent(prompt, forced_mode=mode)
    print(f"[STREAM_TURN] Intent: {intent} (method: {meta.get('method')}, mode: {mode})")

    if intent in ("BUILD_ARCHITECTURE", "DEPLOY_AND_RUN"):
        import queue
        import threading
        from app.agent_pipeline import add_step_listener, remove_step_listener

        step_q: queue.Queue[dict | None] = queue.Queue()

        def on_step_event(step_dict: dict) -> None:
            step_q.put(step_dict)

        add_step_listener(session_id, on_step_event)
        pipeline_res: list[Any] = [None, None, None]

        def run_worker() -> None:
            try:
                p = _get_active_session_plan(session_id) if intent == "DEPLOY_AND_RUN" else None
                a = []
                if not p:
                    p, a = run_pipeline(
                        prompt,
                        session_id=session_id,
                        target_model=target_model,
                        effort=effort,
                    )
                    try:
                        from app.session_store import upsert_run
                        upsert_run(run_id=p.get("run_id", f"run_{session_id}"), session_id=session_id, plan_json=p)
                    except Exception:
                        pass
                pipeline_res[0] = p
                pipeline_res[1] = a
            except Exception as ex:
                pipeline_res[2] = ex
            finally:
                step_q.put(None)

        worker_th = threading.Thread(target=run_worker, daemon=True)
        worker_th.start()

        yield from _drain_step_queue(step_q, worker_th)

        if pipeline_res[2] is not None:
            remove_step_listener(session_id, on_step_event)
            raise pipeline_res[2]

        plan = pipeline_res[0] or {}
        audit_messages = pipeline_res[1] or []
        thought_tag = build_thought_meta(plan)
        full_resp = thought_tag + format_architecture_response(plan, audit_messages)

        if intent == "DEPLOY_AND_RUN":
            exec_res: list[Any] = [None, None]

            def run_exec() -> None:
                try:
                    from app.engine.executor import execute_closed_loop
                    exec_res[0] = execute_closed_loop(plan, workspace_id=ALLOWED_WORKSPACE_ID, session_id=session_id)
                except Exception as ex:
                    exec_res[1] = ex
                finally:
                    step_q.put(None)

            exec_th = threading.Thread(target=run_exec, daemon=True)
            exec_th.start()
            yield from _drain_step_queue(step_q, exec_th)

            if exec_res[1] is not None:
                remove_step_listener(session_id, on_step_event)
                raise exec_res[1]
            if exec_res[0]:
                full_resp += f"\n\n---\n\n{exec_res[0].summary_markdown}"

        remove_step_listener(session_id, on_step_event)

        # Stream synthesized architecture summary in smooth chunks
        chunk_sz = 32
        for i in range(0, len(full_resp), chunk_sz):
            yield ("chunk", full_resp[i : i + chunk_sz], None)

        yield ("done", full_resp, plan)
        return

    # Direct conversational / consultative streaming via multi-provider waterfall
    search_context = ""
    if _detect_web_search_need(prompt):
        hits = search_web(prompt, max_results=4)
        if hits:
            search_context = format_search_context(hits)

    sys_prompt = (
        FABRIC_STUDIO_SYSTEM
        if intent == "PROJECT_CONSULT"
        else "You are a helpful, expert AI programming and knowledge assistant. Provide clear, concise, accurate responses."
    )
    if search_context:
        sys_prompt += f"\n\n{search_context}"

    messages = [
        {"role": "system", "content": sys_prompt},
        {"role": "user", "content": prompt},
    ]

    use_complexity = "complex" if intent == "PROJECT_CONSULT" else complexity

    accumulated: list[str] = []
    for token in chat_stream(
        messages=messages,
        complexity=use_complexity,
        target_model=target_model,
        effort=effort,
        session_id=session_id,
        resume=is_resuming,
    ):
        accumulated.append(token)
        yield ("chunk", token, None)

    yield ("done", "".join(accumulated), None)

