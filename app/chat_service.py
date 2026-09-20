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
from typing import Any

from collections.abc import Generator
from app.agent_pipeline import run_pipeline
from app.domain.llm.streaming_router import chat_stream
from app.llm_router import chat
from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME

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


from app.intent_classifier import classify_prompt_intent
from app.tools.web_search import format_search_context, search_web


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
    return intent == "BUILD_ARCHITECTURE"


from app.engine.formatter import build_thought_meta, format_architecture_response


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

    if intent == "BUILD_ARCHITECTURE":
        plan, audit_messages = run_pipeline(
            prompt,
            session_id=session_id,
            target_model=target_model,
            effort=effort,
        )
        thought_tag = build_thought_meta(plan)
        response_text = thought_tag + format_architecture_response(plan, audit_messages)
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

    if intent == "BUILD_ARCHITECTURE":
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
                p, a = run_pipeline(
                    prompt,
                    session_id=session_id,
                    target_model=target_model,
                    effort=effort,
                )
                pipeline_res[0] = p
                pipeline_res[1] = a
            except Exception as ex:
                pipeline_res[2] = ex
            finally:
                step_q.put(None)

        worker_th = threading.Thread(target=run_worker, daemon=True)
        worker_th.start()

        # Stream thought steps in real time as each agent node fires
        while True:
            try:
                step_item = step_q.get(timeout=0.05)
                if step_item is None:
                    break
                yield ("thought_step", json.dumps(step_item), None)
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

        remove_step_listener(session_id, on_step_event)

        if pipeline_res[2] is not None:
            raise pipeline_res[2]

        plan = pipeline_res[0] or {}
        audit_messages = pipeline_res[1] or []
        thought_tag = build_thought_meta(plan)
        full_resp = thought_tag + format_architecture_response(plan, audit_messages)

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

