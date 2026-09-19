"""
app/providers/router.py
-----------------------
Primary chat and chat_json interface with fallback execution and token telemetry.
"""

import json
import re
import time
from app.providers.waterfall import (
    _compress_complexity_providers,
    _high_complexity_providers,
    _model_to_provider_call,
    _parse_provider_and_model,
    _standard_complexity_providers,
)


def chat(
    messages: list,
    complexity: str = "standard",
    max_tokens: int = 8192,
    target_model: str = None,
    effort: str = "medium",
    session_id: str = None,
    resume: bool = False,
) -> str:
    """
    Send a chat completion request using the user-selected or best available LLM provider.
    Supports thinking effort scaling (low, medium, high) and native session resumption.
    Clocks and audits token consumption per provider and model.
    """
    if effort == "high":
        max_tokens = max(max_tokens, 8192)

    if complexity == "high":
        attempts = _high_complexity_providers(messages, max_tokens, session_id=session_id, resume=resume)
    elif complexity == "compress":
        attempts = _compress_complexity_providers(messages, max_tokens, session_id=session_id, resume=resume)
    else:
        attempts = _standard_complexity_providers(messages, max_tokens, session_id=session_id, resume=resume)

    if target_model:
        explicit_attempt = _model_to_provider_call(target_model, messages, max_tokens, session_id=session_id, resume=resume)
        if explicit_attempt:
            attempts = [explicit_attempt] + [a for a in attempts if a[1] != explicit_attempt[1]]

    last_err = None
    for fn, name in attempts:
        t0 = time.perf_counter()
        try:
            result = fn()
            dur_ms = (time.perf_counter() - t0) * 1000.0
            print(f"[LLM] Response from {name} ({complexity} complexity, {effort} effort, session={session_id or 'none'}).")
            prov, mdl = _parse_provider_and_model(name, target_model)
            try:
                from app.token_tracker import record_token_usage
                record_token_usage(
                    provider=prov,
                    model=mdl,
                    prompt_text=messages,
                    completion_text=result,
                    duration_ms=dur_ms,
                    session_id=session_id,
                    complexity=complexity,
                    status="success",
                )
            except Exception as tr_err:
                print(f"[TOKEN_TRACKER] Log warning: {tr_err}")
            return result
        except Exception as e:
            dur_ms = (time.perf_counter() - t0) * 1000.0
            print(f"[LLM FALLBACK] {name} failed: {e}")
            prov, mdl = _parse_provider_and_model(name, target_model)
            try:
                from app.token_tracker import record_token_usage
                record_token_usage(
                    provider=prov,
                    model=mdl,
                    prompt_text=messages,
                    completion_text="",
                    duration_ms=dur_ms,
                    session_id=session_id,
                    complexity=complexity,
                    status="failed",
                    error_message=str(e),
                )
            except Exception:
                pass
            last_err = str(e)

    raise RuntimeError(f"All LLM providers failed. Last error: {last_err}")


def chat_json(
    messages: list,
    complexity: str = "standard",
    max_tokens: int = 8192,
    target_model: str = None,
    effort: str = "medium",
    session_id: str = None,
    resume: bool = False,
) -> dict:
    """
    Like chat(), but parses the response as JSON.
    Strips markdown code fences and handles embedded JSON substrings robustly.
    """
    raw = chat(
        messages,
        complexity,
        max_tokens,
        target_model=target_model,
        effort=effort,
        session_id=session_id,
        resume=resume,
    )
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        lines = cleaned.splitlines()
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        cleaned = "\n".join(lines).strip()
    try:
        return json.loads(cleaned)
    except Exception:
        pass

    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw, re.IGNORECASE)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except Exception:
            pass

    s, e = raw.find("{"), raw.rfind("}")
    if s != -1 and e > s:
        candidate = raw[s : e + 1]
        try:
            return json.loads(candidate)
        except Exception:
            cleaned_sub = re.sub(r",\s*([}\]])", r"\1", candidate)
            try:
                return json.loads(cleaned_sub)
            except Exception:
                pass

    raise ValueError(f"LLM returned invalid JSON. Raw response:\n{raw[:500]}")

