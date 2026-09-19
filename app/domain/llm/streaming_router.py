"""
app/domain/llm/streaming_router.py
----------------------------------
Real-time token streaming router with multi-provider fallback.
Streams tokens directly from Claude CLI (Popen stdout), Claude Web SSE,
Anthropic Messages API, Google Gemini, Groq Cloud, and OpenAI.
"""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import time
import uuid
from collections.abc import Generator
from typing import Any

import requests

from app.config import (
    ANTHROPIC_KEY,
    CLAUDE_COOKIE,
    CLAUDE_DEVICE_ID,
    CLAUDE_ORG_UUID,
    GEMINI_KEY,
    GROQ_KEYS,
    LLM_MODELS,
    OPENAI_KEY,
)
from app.llm_router import _SESSION, _get_claude_cli_binary, _resolve_claude_mix_model
from app.token_tracker import record_token_usage


def stream_claude_cli(
    messages: list[dict[str, str]],
    model: str | None = None,
    max_tokens: int = 4096,
    session_id: str | None = None,
    resume: bool = False,
) -> Generator[str, None, None]:
    """Streams real-time token chunks from the Claude Code CLI subprocess via stdout pipe."""
    claude_bin = _get_claude_cli_binary()
    if not claude_bin:
        raise RuntimeError("Claude Code CLI is not installed or not found in PATH.")

    valid_uuid: str | None = None
    if session_id:
        try:
            valid_uuid = str(uuid.UUID(session_id))
        except Exception:
            valid_uuid = str(uuid.uuid5(uuid.NAMESPACE_DNS, session_id))

    # Sanitize model parameter for Claude Code CLI
    effective_model = model
    if effective_model:
        em_lower = effective_model.lower().strip()
        if em_lower in ("claude-mix", "claude_mix", "mix", "default", "auto") or "haiku" in em_lower:
            effective_model = None
        elif "sonnet" in em_lower:
            effective_model = "claude-3-7-sonnet"
        elif "opus" in em_lower:
            effective_model = "claude-3-opus-20240229"

    if valid_uuid and resume:
        latest_msgs = [m.get("content", "") for m in messages if m.get("role") == "user"]
        latest_turn = latest_msgs[-1] if latest_msgs else "Continue"
        cmd = [claude_bin, "-p", latest_turn, "--resume", valid_uuid, "--tools", ""]
        if model:
            cmd.extend(["--model", model])
        if effective_model:
            cmd.extend(["--model", effective_model])
    else:
        sys_prompts = [m["content"] for m in messages if m.get("role") == "system"]
        turns = [m for m in messages if m.get("role") != "system"]
        parts: list[str] = []
        if sys_prompts:
            parts.append("\n\n".join(sys_prompts).strip())
        if turns:
            if len(turns) == 1 and turns[0].get("role") == "user":
                parts.append(f"USER REQUEST:\n{turns[0].get('content', '')}")
            else:
                for m in turns:
                    r = m.get("role", "user").upper()
                    parts.append(f"[{r}]:\n{m.get('content', '')}")
        full_prompt = "\n\n---\n\n".join(parts) if parts else "Hello"
        cmd = [claude_bin, "-p", full_prompt, "--tools", ""]
        if valid_uuid:
            cmd.extend(["--session-id", valid_uuid])
        if model:
            cmd.extend(["--model", model])
        if effective_model:
            cmd.extend(["--model", effective_model])

    proc = subprocess.Popen(
        cmd,
        stdin=subprocess.DEVNULL,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        bufsize=1,
        universal_newlines=True,
        encoding="utf-8",
        cwd=tempfile.gettempdir(),
    )

    accumulated: list[str] = []
    if proc.stdout:
        for line in iter(proc.stdout.readline, ""):
            if line.startswith("Warning:"):
                continue
            accumulated.append(line)
            yield line

    proc.wait()
    if proc.returncode != 0 and not accumulated:
        err = proc.stderr.read() if proc.stderr else f"Exit code {proc.returncode}"
        raise RuntimeError(f"Claude CLI stream failed: {err}")


def stream_anthropic(messages: list[dict[str, str]], model: str, max_tokens: int = 4096) -> Generator[str, None, None]:
    """Streams real-time tokens from Anthropic Messages API."""
    if not ANTHROPIC_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY is not set.")
    sys_parts = [m["content"] for m in messages if m.get("role") == "system"]
    user_turns = [m for m in messages if m.get("role") in ("user", "assistant")]

    payload: dict[str, Any] = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": user_turns,
        "stream": True,
    }
    if sys_parts:
        payload["system"] = "\n\n".join(sys_parts)

    resp = _SESSION.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json=payload,
        stream=True,
        timeout=60,
    )
    resp.raise_for_status()

    for line in resp.iter_lines():
        if line:
            decoded = line.decode("utf-8")
            if decoded.startswith("data: "):
                try:
                    data = json.loads(decoded[6:])
                    if data.get("type") == "content_block_delta":
                        delta_txt = data.get("delta", {}).get("text", "")
                        if delta_txt:
                            yield delta_txt
                except Exception:
                    pass


def stream_claude_session(messages: list[dict[str, str]], model: str = "claude-opus-5") -> Generator[str, None, None]:
    """Streams tokens directly from active Claude Web session cookie."""
    if not CLAUDE_COOKIE:
        raise RuntimeError("CLAUDE_COOKIE is not configured.")
    full_prompt = "\n\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages])
    chat_uuid = str(uuid.uuid4())
    headers = {
        "Cookie": CLAUDE_COOKIE,
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        "Content-Type": "application/json",
        "Accept": "text/event-stream, text/plain, */*",
        "Origin": "https://claude.ai",
        "Referer": "https://claude.ai/new",
        "anthropic-client-platform": "web_claude_ai",
        "anthropic-device-id": CLAUDE_DEVICE_ID,
    }
    _SESSION.post(
        f"https://claude.ai/api/organizations/{CLAUDE_ORG_UUID}/chat_conversations",
        headers=headers,
        json={"uuid": chat_uuid, "name": "Fabric AI Stream Request"},
        timeout=15,
    )
    resp = _SESSION.post(
        f"https://claude.ai/api/organizations/{CLAUDE_ORG_UUID}/chat_conversations/{chat_uuid}/completion",
        headers=headers,
        json={"prompt": full_prompt, "timezone": "Asia/Calcutta", "locale": "en-US", "model": model},
        stream=True,
        timeout=90,
    )
    for line in resp.iter_lines():
        if line:
            decoded = line.decode("utf-8")
            if decoded.startswith("data: "):
                try:
                    payload = json.loads(decoded[6:])
                    comp = payload.get("completion")
                    if comp:
                        yield comp
                except Exception:
                    pass


def stream_groq(messages: list[dict[str, str]], model: str, max_tokens: int = 4096) -> Generator[str, None, None]:
    """Streams tokens from Groq Cloud endpoints."""
    if not GROQ_KEYS:
        raise RuntimeError("GROQ_API_KEY is not configured.")
    for key in GROQ_KEYS:
        try:
            resp = _SESSION.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": model, "messages": messages, "temperature": 0.2, "max_tokens": max_tokens, "stream": True},
                stream=True,
                timeout=30,
            )
            if resp.status_code == 429:
                time.sleep(0.5)
                continue
            resp.raise_for_status()
            for line in resp.iter_lines():
                if line:
                    decoded = line.decode("utf-8")
                    if decoded.startswith("data: ") and decoded != "data: [DONE]":
                        try:
                            payload = json.loads(decoded[6:])
                            choices = payload.get("choices", [])
                            if choices and "delta" in choices[0]:
                                chunk = choices[0]["delta"].get("content", "")
                                if chunk:
                                    yield chunk
                        except Exception:
                            pass
            return
        except Exception:
            continue
    raise RuntimeError("All Groq keys failed for streaming.")


def stream_gemini(messages: list[dict[str, str]], model: str, max_tokens: int = 4096) -> Generator[str, None, None]:
    """Streams tokens from Google Gemini API via SSE with Google Search grounding."""
    if not GEMINI_KEY:
        raise RuntimeError("GEMINI_API_KEY is not configured.")
    contents = [
        {"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]}
        for m in messages if m["role"] != "system"
    ]
    sys_parts = [m["content"] for m in messages if m["role"] == "system"]

    # Prefer stable flash-latest endpoint for high reliability
    active_model = "gemini-flash-latest" if ("3.6" in model or "flash" in model.lower()) else model

    payload: dict[str, Any] = {
        "contents": contents,
        "generationConfig": {"maxOutputTokens": max_tokens},
        "tools": [{"googleSearch": {}}],
    }
    if sys_parts:
        payload["systemInstruction"] = {"parts": [{"text": "\n\n".join(sys_parts)}]}

    resp = _SESSION.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{active_model}:streamGenerateContent?alt=sse&key={GEMINI_KEY}",
        json=payload,
        stream=True,
        timeout=(5.0, 30.0),
    )
    status = getattr(resp, "status_code", None)
    if isinstance(status, int) and (status == 429 or status >= 400):
        # Fallback without search tool to conserve quota
        payload.pop("tools", None)
        resp = _SESSION.post(
            f"https://generativelanguage.googleapis.com/v1beta/models/{active_model}:streamGenerateContent?alt=sse&key={GEMINI_KEY}",
            json=payload,
            stream=True,
            timeout=(5.0, 30.0),
        )
        status = getattr(resp, "status_code", None)

    if isinstance(status, int) and status in (429, 500, 502, 503, 504):
        raise RuntimeError(f"Gemini {active_model} returned HTTP {status}: {getattr(resp, 'text', '')[:120]}")
    if hasattr(resp, "raise_for_status"):
        resp.raise_for_status()
    for line in resp.iter_lines():
        if line:
            decoded = line.decode("utf-8")
            if decoded.startswith("data: "):
                try:
                    payload_json = json.loads(decoded[6:])
                    candidates = payload_json.get("candidates", [])
                    if candidates:
                        parts = candidates[0].get("content", {}).get("parts", [])
                        for part in parts:
                            txt = part.get("text", "")
                            if txt:
                                yield txt
                except Exception:
                    pass


def chat_stream(
    messages: list[dict[str, str]],
    complexity: str = "standard",
    max_tokens: int = 4096,
    target_model: str | None = None,
    effort: str = "medium",
    session_id: str | None = None,
    resume: bool = False,
) -> Generator[str, None, None]:
    """
    Unified multi-provider token streaming generator with auto-fallback waterfall.
    Yields words/tokens in real time and logs token audit metrics at completion.
    """
    if effort == "low":
        max_tokens = min(max_tokens, 2048)
    elif effort == "high":
        max_tokens = max(max_tokens, 8192)

    # 1. Target model overrides
    stream_fn = None
    provider_name = "LLM Engine"
    model_name = target_model or "auto"

    if target_model:
        tm = target_model.lower()
        if "gemini" in tm:
            act_mdl = LLM_MODELS.get("gemini_high", "gemini-2.5-pro") if "pro" in tm else LLM_MODELS.get("gemini_standard", "gemini-3.6-flash")
            stream_fn = lambda: stream_gemini(messages, act_mdl, max_tokens)
            provider_name = "Google Gemini"
            model_name = act_mdl
        elif "groq" in tm or "llama" in tm or "oss" in tm:
            act_mdl = LLM_MODELS.get("groq_high", "openai/gpt-oss-120b") if ("120b" in tm or "70b" in tm) else LLM_MODELS.get("groq_fast", "openai/gpt-oss-20b")
            stream_fn = lambda: stream_groq(messages, act_mdl, max_tokens)
            provider_name = "Groq Cloud"
            model_name = act_mdl
        elif "claude" in tm or "sonnet" in tm or "haiku" in tm or "opus" in tm:
            if _get_claude_cli_binary():
                stream_fn = lambda: stream_claude_cli(messages, target_model, max_tokens, session_id=session_id, resume=resume)
                provider_name = "Anthropic (CLI)"
                model_name = target_model
            elif ANTHROPIC_KEY:
                act_mdl = LLM_MODELS.get("anthropic_high", "claude-3-7-sonnet-20250219") if "sonnet" in tm else LLM_MODELS.get("anthropic_fast", "claude-3-5-haiku-20241022")
                stream_fn = lambda: stream_anthropic(messages, act_mdl, max_tokens)
                provider_name = "Anthropic"
                model_name = act_mdl

    # 2. Waterfall candidates with strict deduplication
    seen_keys: set[str] = set()
    candidates: list[tuple[Any, str, str]] = []

    def _add_candidate(fn: Any, prov: str, mdl: str) -> None:
        key = f"{prov}::{mdl}"
        if key not in seen_keys:
            seen_keys.add(key)
            candidates.append((fn, prov, mdl))

    if stream_fn:
        _add_candidate(stream_fn, provider_name, model_name)

    if complexity == "complex" or (target_model and "claude" in target_model.lower()):
        # Complex DE architecture & code generation: Prioritize Claude CLI / Sonnet -> Gemini Pro -> Groq 120B
        if _get_claude_cli_binary():
            _add_candidate(lambda: stream_claude_cli(messages, None, max_tokens, session_id=session_id, resume=resume), "Anthropic (CLI)", "claude-code-cli")
        elif ANTHROPIC_KEY:
            _add_candidate(lambda: stream_anthropic(messages, LLM_MODELS.get("anthropic_high", "claude-3-7-sonnet-20250219"), max_tokens), "Anthropic", "claude-3-7-sonnet")
        if GEMINI_KEY:
            _add_candidate(lambda: stream_gemini(messages, LLM_MODELS.get("gemini_high", "gemini-2.5-pro"), max_tokens), "Google Gemini", "gemini-2.5-pro")
        if GROQ_KEYS:
            _add_candidate(lambda: stream_groq(messages, LLM_MODELS.get("groq_high", "openai/gpt-oss-120b"), max_tokens), "Groq Cloud", "openai/gpt-oss-120b")
    else:
        # Standard / general conversation: Fast Gemini Flash -> Groq Fast -> Groq 120B -> Claude CLI (guaranteed fallback)
        if GEMINI_KEY:
            _add_candidate(lambda: stream_gemini(messages, LLM_MODELS.get("gemini_standard", "gemini-3.6-flash"), max_tokens), "Google Gemini", "gemini-3.6-flash")
        if GROQ_KEYS:
            _add_candidate(lambda: stream_groq(messages, LLM_MODELS.get("groq_fast", "openai/gpt-oss-20b"), max_tokens), "Groq Cloud", "openai/gpt-oss-20b")
            _add_candidate(lambda: stream_groq(messages, LLM_MODELS.get("groq_high", "openai/gpt-oss-120b"), max_tokens), "Groq Cloud", "openai/gpt-oss-120b")
        if _get_claude_cli_binary():
            _add_candidate(lambda: stream_claude_cli(messages, None, max_tokens, session_id=session_id, resume=resume), "Anthropic (CLI)", "claude-code-cli")
        elif ANTHROPIC_KEY:
            _add_candidate(lambda: stream_anthropic(messages, LLM_MODELS.get("anthropic_fast", "claude-3-5-haiku-20241022"), max_tokens), "Anthropic", "claude-3-5-haiku")

    last_err: Exception | None = None
    for gen_fn, prov, mdl in candidates:
        t0 = time.time()
        tokens_out: list[str] = []
        try:
            for chunk in gen_fn():
                tokens_out.append(chunk)
                yield chunk
            # If we successfully yielded output, record audit and return
            if tokens_out:
                full_text = "".join(tokens_out)
                prompt_text = " ".join([m.get("content", "") for m in messages])
                dur_ms = round((time.time() - t0) * 1000.0, 2)
                try:
                    record_token_usage(
                        provider=prov,
                        model=mdl,
                        prompt_text=prompt_text,
                        completion_text=full_text,
                        duration_ms=dur_ms,
                        session_id=session_id,
                        status="success",
                    )
                except Exception as tr_err:
                    print(f"[STREAM_TOKEN_TRACKER] Audit log warning: {tr_err}")
                return
        except Exception as e:
            last_err = e
            print(f"[STREAM_WATERFALL] Provider '{prov}' ({mdl}) failed: {e}. Cascading...")
            continue

    if last_err:
        raise RuntimeError(f"All streaming LLM providers failed. Last error: {last_err}") from last_err
