"""
app/llm_router.py
-----------------
Dynamic multi-provider LLM client with automatic fallback waterfall.

Active model roster (two Groq models only — llama-3.3-70b-versatile is deprecated):
  HIGH complexity   → Claude Sonnet → GPT-4o → Groq gpt-oss-120B → Gemini Flash
  STANDARD tasks    → Groq gpt-oss-20B → Groq gpt-oss-120B → Gemini Flash
  COMPRESS tasks    → Groq gpt-oss-20B only (Squeeze Straw summarizer)

Complexity is passed by the caller:
  "high"     — PySpark code gen, self-healing, complex schema analysis
  "standard" — Cron parsing, slug generation, intent classification
  "compress" — Squeeze Straw tier compression (always fast model)
Single source of truth facade for dynamic multi-provider LLM routing.
Decomposed into modular subpackages under app/providers/ as per AGENTS.md.
"""

import json
import os
import shutil
import subprocess
import time

import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

from app.config import (
    ANTHROPIC_KEY,
    CLAUDE_COOKIE,
    CLAUDE_DEVICE_ID,
    CLAUDE_ORG_UUID,
    GEMINI_KEY,
    GROQ_KEYS,
    LLM_MODELS,
    OPENAI_KEY,
from app.providers import (
    _SESSION,
    _call_anthropic,
    _call_claude_cli,
    _call_claude_session,
    _call_gemini,
    _call_groq,
    _call_lmstudio,
    _call_ollama,
    _call_openai,
    _compress_complexity_providers,
    _get_claude_cli_binary,
    _high_complexity_providers,
    _model_to_provider_call,
    _parse_provider_and_model,
    _resolve_claude_mix_model,
    _standard_complexity_providers,
    chat,
    chat_json,
)

# ── HTTP Session Pool ────────────────────────────────────────────────────────
_SESSION = requests.Session()
_retries = Retry(
    total=2,
    backoff_factor=0.5,
    status_forcelist=[500, 502, 503, 504],
    raise_on_status=False
)
_adapter = HTTPAdapter(pool_connections=20, pool_maxsize=20, max_retries=_retries)
_SESSION.mount("https://", _adapter)
_SESSION.mount("http://", _adapter)


# ── Internal provider implementations ────────────────────────────────────────

def _call_anthropic(messages: list, model: str, max_tokens: int = 4096) -> str:
    if not ANTHROPIC_KEY:
        raise RuntimeError("ANTHROPIC_API_KEY not set.")
    system_parts = [m["content"] for m in messages if m.get("role") == "system"]
    user_assistant_msgs = [m for m in messages if m.get("role") in ("user", "assistant")]

    payload = {
        "model": model,
        "max_tokens": max_tokens,
        "messages": user_assistant_msgs,
    }
    if system_parts:
        payload["system"] = "\n\n".join(system_parts)

    resp = _SESSION.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": ANTHROPIC_KEY,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["content"][0]["text"]


def _call_openai(messages: list, model: str, max_tokens: int = 4096) -> str:
    if not OPENAI_KEY:
        raise RuntimeError("OPENAI_API_KEY not set.")
    resp = _SESSION.post(
        "https://api.openai.com/v1/chat/completions",
        headers={
            "Authorization": f"Bearer {OPENAI_KEY}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "messages": messages,
            "max_tokens": max_tokens,
        },
        timeout=60,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _call_gemini(messages: list, model: str, max_tokens: int = 4096) -> str:
    if not GEMINI_KEY:
        raise RuntimeError("GEMINI_API_KEY not set.")
    # Convert OpenAI-style messages to Gemini contents format
    contents = [
        {"role": "user" if m["role"] == "user" else "model", "parts": [{"text": m["content"]}]}
        for m in messages if m["role"] != "system"
    ]
    system_parts = [m["content"] for m in messages if m["role"] == "system"]
    payload = {
        "contents": contents,
        "generationConfig": {"maxOutputTokens": max_tokens},
    }
    if system_parts:
        payload["systemInstruction"] = {"parts": [{"text": "\n\n".join(system_parts)}]}

    resp = _SESSION.post(
        f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_KEY}",
        json=payload,
        timeout=60,
    )
    resp.raise_for_status()
    candidates = resp.json().get("candidates", [])
    if not candidates:
        raise RuntimeError("Gemini returned no candidates.")
    return candidates[0]["content"]["parts"][0]["text"]


def _call_groq(messages: list, model: str, max_tokens: int = 4096) -> str:
    if not GROQ_KEYS:
        raise RuntimeError("No GROQ_API_KEY set.")
    last_err = None
    for key in GROQ_KEYS:
        try:
            resp = _SESSION.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": model,
                    "messages": messages,
                    "temperature": 0.2,
                    "max_tokens": max_tokens,
                },
                timeout=30,
            )
            if resp.status_code == 429:
                last_err = "Rate limited"
                time.sleep(1)
                continue
            resp.raise_for_status()
            return resp.json()["choices"][0]["message"]["content"]
        except Exception as e:
            last_err = str(e)
            continue
    raise RuntimeError(f"All Groq keys failed. Last error: {last_err}")


def _get_claude_cli_binary() -> str | None:
    """Finds the Claude Code CLI executable path on the system, preferring native executable binary to avoid cmd batch truncation."""
    direct_exe = r"C:\Users\BheesettiHarsithVeer\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe"
    if os.path.exists(direct_exe):
        return direct_exe
    found = shutil.which("claude")
    if found:
        return found
    fallback_win = r"C:\Users\BheesettiHarsithVeer\AppData\Roaming\npm\claude.cmd"
    if os.path.exists(fallback_win):
        return fallback_win
    return None


def _call_claude_cli(
    messages: list,
    model: str = None,
    max_tokens: int = 4096,
    session_id: str = None,
    resume: bool = False
) -> str:
    """
    Call official Claude Code CLI subprocess (claude -p) using user's active terminal authentication.
    Supports native session resumption via --resume <session_id> and --session-id <session_id>.
    """
    claude_bin = _get_claude_cli_binary()
    if not claude_bin:
        raise RuntimeError("Claude Code CLI is not installed or not found in PATH.")

    valid_uuid_session = None
    if session_id:
        try:
            import uuid
            valid_uuid_session = str(uuid.UUID(session_id))
        except Exception:
            import uuid
            valid_uuid_session = str(uuid.uuid5(uuid.NAMESPACE_DNS, session_id))

    # 1. If resuming an existing session, we only need to pass the latest turn
    if valid_uuid_session and resume:
        latest_user_msgs = [m.get("content", "") for m in messages if m.get("role") == "user"]
        latest_turn = latest_user_msgs[-1] if latest_user_msgs else "Continue"
        cmd = [claude_bin, "-p", latest_turn, "--resume", valid_uuid_session, "--tools", ""]
        if model:
            cmd.extend(["--model", model])
    else:
        # 2. Starting a new session or stateless run
        system_prompts = [m["content"] for m in messages if m.get("role") == "system"]
        conversation_turns = [m for m in messages if m.get("role") != "system"]

        sys_text = "\n\n".join(system_prompts).strip() if system_prompts else ""

        formatted_parts = []
        if sys_text:
            formatted_parts.append(sys_text)

        if conversation_turns:
            if len(conversation_turns) == 1 and conversation_turns[0].get("role") == "user":
                formatted_parts.append(f"USER REQUEST:\n{conversation_turns[0].get('content', '')}")
            else:
                for m in conversation_turns:
                    role = m.get("role", "user").upper()
                    formatted_parts.append(f"[{role}]:\n{m.get('content', '')}")

        full_prompt = "\n\n---\n\n".join(formatted_parts) if formatted_parts else "Hello"
        cmd = [claude_bin, "-p", full_prompt, "--tools", ""]
        if valid_uuid_session:
            cmd.extend(["--session-id", valid_uuid_session])
        if model:
            cmd.extend(["--model", model])

    try:
        import tempfile
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            input="",
            encoding="utf-8",
            cwd=tempfile.gettempdir(),
            timeout=120
        )
        if res.returncode == 0:
            out = res.stdout.strip()
            if "Warning:" in out:
                lines = out.split("\n")
                out = "\n".join([l for l in lines if not l.startswith("Warning:")]).strip()
            if out:
                return out
            raise RuntimeError("Claude Code CLI returned an empty response.")
        else:
            err_msg = res.stderr.strip() or res.stdout.strip() or f"Exited with code {res.returncode}"
            raise RuntimeError(f"Claude Code CLI error: {err_msg}")
    except subprocess.TimeoutExpired:
        raise RuntimeError("Claude Code CLI timed out after 120 seconds.")
    except Exception as e:
        raise RuntimeError(f"Claude Code CLI invocation failed: {e}")


def _call_claude_session(messages: list, model: str = "claude-opus-5", max_tokens: int = 4096) -> str:
    """Call Claude Web Session using user's active browser subscription cookies with real-time SSE parsing."""
    if not CLAUDE_COOKIE:
        raise RuntimeError("CLAUDE_COOKIE is not configured in .env.")

    import uuid
    full_prompt = "\n\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages])
    chat_uuid = str(uuid.uuid4())

    headers = {
        'Cookie': CLAUDE_COOKIE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0',
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream, text/plain, */*',
        'Origin': 'https://claude.ai',
        'Referer': 'https://claude.ai/new',
        'anthropic-client-platform': 'web_claude_ai',
        'anthropic-device-id': CLAUDE_DEVICE_ID,
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty'
    }

    # 1. Create chat thread
    try:
        _SESSION.post(
            f"https://claude.ai/api/organizations/{CLAUDE_ORG_UUID}/chat_conversations",
            headers=headers,
            json={"uuid": chat_uuid, "name": "Fabric AI Studio Request"},
            timeout=15
        )
    except Exception as e:
        raise RuntimeError(f"Claude Web Session initialization error: {e}")

    # 2. Stream completion from model
    resp = _SESSION.post(
        f"https://claude.ai/api/organizations/{CLAUDE_ORG_UUID}/chat_conversations/{chat_uuid}/completion",
        headers=headers,
        json={
            "prompt": full_prompt,
            "timezone": "Asia/Calcutta",
            "locale": "en-US",
            "model": model,
            "attachments": [],
            "files": []
        },
        stream=True,
        timeout=90
    )

    full_text = []
    for line in resp.iter_lines():
        if line:
            decoded = line.decode('utf-8')
            if decoded.startswith('data: '):
                try:
                    payload = json.loads(decoded[6:])
                    if 'completion' in payload:
                        full_text.append(payload['completion'])
                except Exception:
                    pass

    output = "".join(full_text)
    if not output:
        raise RuntimeError("Claude Web Session returned empty response.")
    return output


def _resolve_claude_mix_model(prompt_text: str) -> str:
    """Dynamically select Claude model based on complexity and prompt analysis."""
    is_heavy = len(prompt_text) > 450 or any(k in prompt_text.lower() for k in ["pyspark", "transpile", "stored procedure", "merge sort", "self-healing", "lakehouse", "lineage", "refactor"])
    is_light = len(prompt_text) < 90 or any(k in prompt_text.lower() for k in ["summarize", "in 1 sentence", "what is", "classify", "intent"])

    if is_heavy:
        return "claude-opus-5"
    elif is_light:
        return "claude-3-5-haiku-20241022"
    else:
        return "claude-3-5-sonnet-20241022"


def _call_ollama(messages: list, model: str, max_tokens: int = 4096) -> str:
    """Call locally running Ollama instance at http://localhost:11434"""
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"num_predict": max_tokens}
    }
    resp = _SESSION.post("http://localhost:11434/api/chat", json=payload, timeout=90)
    resp.raise_for_status()
    return resp.json().get("message", {}).get("content", "")


def _call_lmstudio(messages: list, model: str, max_tokens: int = 4096) -> str:
    """Call locally running LM Studio / OpenAI-compatible local server at http://localhost:1234"""
    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": max_tokens,
    }
    resp = _SESSION.post("http://localhost:1234/v1/chat/completions", json=payload, timeout=90)
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def _model_to_provider_call(model_id: str, messages: list, max_tokens: int, session_id: str = None, resume: bool = False):
    """Maps any requested model ID to its native provider attempt (Cloud, CLI, or Local)."""
    if not model_id:
        return None
    m = model_id.lower().strip()

    # 1. Local Models (Ollama or LM Studio)
    if "ollama:" in m or "ollama/" in m or ":" in model_id:
        clean_model = model_id.replace("ollama:", "").replace("ollama/", "").strip()
        return (lambda: _call_ollama(messages, clean_model, max_tokens), f"Ollama Local ({clean_model})")
    elif "lmstudio:" in m or "lmstudio/" in m:
        clean_model = model_id.replace("lmstudio:", "").replace("lmstudio/", "").strip()
        return (lambda: _call_lmstudio(messages, clean_model, max_tokens), f"LM Studio Local ({clean_model})")

    # 2. Cloud Providers (dynamically resolve model from LLM_MODELS)
    if "gemini" in m:
        if not GEMINI_KEY:
            raise RuntimeError("GEMINI_API_KEY is not configured in .env.")
        actual_model = LLM_MODELS.get("gemini_high", "gemini-2.5-pro") if "pro" in m else LLM_MODELS.get("gemini_standard", "gemini-3.6-flash")
        return (lambda: _call_gemini(messages, actual_model, max_tokens), f"Gemini ({actual_model})")
    elif "llama" in m or "groq" in m or "qwen" in m or "gpt-oss" in m or "oss" in m:
        if not GROQ_KEYS:
            raise RuntimeError("GROQ_API_KEY is not configured in .env.")
        actual_model = LLM_MODELS.get("groq_high", "openai/gpt-oss-120b") if ("120b" in m or "70b" in m or "reasoning" in m) else LLM_MODELS.get("groq_fast", "openai/gpt-oss-20b")
        return (lambda: _call_groq(messages, actual_model, max_tokens), f"Groq ({actual_model})")
    elif "claude" in m or "sonnet" in m or "haiku" in m or "opus" in m or "mix" in m:
        # 1. Check if official Claude Code CLI is available (Primary Subprocess with active login)
        if _get_claude_cli_binary():
            cli_model = None
            if "opus" in m:
                cli_model = "claude-3-opus-20240229"
            elif "haiku" in m:
                cli_model = "claude-3-5-haiku-20241022"
            elif "sonnet" in m:
                cli_model = "claude-3-7-sonnet-20250219"
            return (lambda: _call_claude_cli(messages, cli_model, max_tokens, session_id=session_id, resume=resume), f"Claude Code CLI ({cli_model or 'Default'})")

        # 2. Check if native ANTHROPIC_API_KEY is present
        if ANTHROPIC_KEY:
            actual_model = LLM_MODELS.get("anthropic_high", "claude-3-7-sonnet-20250219") if "sonnet" in m else LLM_MODELS.get("anthropic_fast", "claude-3-5-haiku-20241022")
            return (lambda: _call_anthropic(messages, actual_model, max_tokens), f"Claude API ({actual_model})")

        # 3. Fallback to Claude Web Session Cookie if configured
        if CLAUDE_COOKIE:
            full_prompt = " ".join([m.get("content", "") for m in messages])
            chosen_model = _resolve_claude_mix_model(full_prompt)
            return (lambda: _call_claude_session(messages, chosen_model, max_tokens), f"Claude Native Mix ({chosen_model})")

        raise RuntimeError("No Claude provider found: Claude Code CLI, ANTHROPIC_API_KEY, or CLAUDE_COOKIE required.")
    elif "gpt" in m or "openai" in m or "o3" in m:
        if not OPENAI_KEY:
            raise RuntimeError("OPENAI_API_KEY is not configured in .env.")
        actual_model = LLM_MODELS.get("openai_fast", "gpt-4o-mini") if "mini" in m else LLM_MODELS.get("openai_high", "gpt-4o")
        return (lambda: _call_openai(messages, actual_model, max_tokens), f"OpenAI ({actual_model})")
    return None



# ── Provider waterfall definitions ────────────────────────────────────────────

def _high_complexity_providers(messages, max_tokens, session_id: str = None, resume: bool = False):
    """Claude Code CLI → Claude Sonnet → Gemini 3.6 Flash → GPT-4o → Groq 120B"""
    attempts = []
    if _get_claude_cli_binary():
        attempts.append((lambda: _call_claude_cli(messages, None, max_tokens, session_id=session_id, resume=resume), "Claude Code CLI (Subprocess)"))
    elif ANTHROPIC_KEY:
        attempts.append((lambda: _call_anthropic(messages, LLM_MODELS.get("anthropic_high", "claude-3-7-sonnet-20250219"), max_tokens), "Claude Sonnet"))
    elif CLAUDE_COOKIE:
        attempts.append((lambda: _call_claude_session(messages, "claude-opus-5", max_tokens), "Claude Opus (Session)"))

    if GEMINI_KEY:
        attempts.append((lambda: _call_gemini(messages, LLM_MODELS.get("gemini_standard", "gemini-3.6-flash"), max_tokens), "Gemini 3.6 Flash"))
    if OPENAI_KEY:
        attempts.append((lambda: _call_openai(messages, LLM_MODELS.get("openai_high", "gpt-4o"), max_tokens), "GPT-4o"))
    if GROQ_KEYS:
        attempts.append((lambda: _call_groq(messages, LLM_MODELS.get("groq_high", "openai/gpt-oss-120b"), max_tokens), "Groq gpt-oss-120B"))
    return attempts


def _standard_complexity_providers(messages, max_tokens, session_id: str = None, resume: bool = False):
    """Gemini 3.6 Flash → Claude Code CLI → Groq 20B → Groq 120B → Claude Haiku"""
    attempts = []
    if GEMINI_KEY:
        attempts.append((lambda: _call_gemini(messages, LLM_MODELS.get("gemini_standard", "gemini-3.6-flash"), max_tokens), "Gemini 3.6 Flash"))
    if _get_claude_cli_binary():
        attempts.append((lambda: _call_claude_cli(messages, None, max_tokens, session_id=session_id, resume=resume), "Claude Code CLI (Subprocess)"))
    if GROQ_KEYS:
        attempts.append((lambda: _call_groq(messages, LLM_MODELS.get("groq_fast", "openai/gpt-oss-20b"), max_tokens), "Groq gpt-oss-20B"))
        attempts.append((lambda: _call_groq(messages, LLM_MODELS.get("groq_high", "openai/gpt-oss-120b"), max_tokens), "Groq gpt-oss-120B"))
    if ANTHROPIC_KEY:
        attempts.append((lambda: _call_anthropic(messages, LLM_MODELS.get("anthropic_fast", "claude-3-5-haiku-20241022"), max_tokens), "Claude Haiku"))
    return attempts


def _compress_complexity_providers(messages, max_tokens, session_id: str = None, resume: bool = False):
    """Squeeze Straw compressor: Groq 20B / 120B — fast, cheap, targeted."""
    attempts = []
    if GROQ_KEYS:
        attempts.append((lambda: _call_groq(messages, LLM_MODELS.get("groq_fast", "openai/gpt-oss-20b"), max_tokens), "Groq gpt-oss-20B"))
        attempts.append((lambda: _call_groq(messages, LLM_MODELS.get("groq_high", "openai/gpt-oss-120b"), max_tokens), "Groq gpt-oss-120B"))
    elif GEMINI_KEY:
        attempts.append((lambda: _call_gemini(messages, LLM_MODELS.get("gemini_standard", "gemini-3.6-flash"), max_tokens), "Gemini 3.6 Flash"))
    return attempts


def _parse_provider_and_model(name: str, target_model: str | None = None) -> tuple[str, str]:
    """Extracts clean provider name and model identifier from display string."""
    n_lower = name.lower()
    if "claude code cli" in n_lower or "cli" in n_lower:
        prov = "Anthropic (CLI)"
        mdl = target_model or "claude-code-cli"
    elif "claude" in n_lower or "anthropic" in n_lower or "sonnet" in n_lower or "haiku" in n_lower or "opus" in n_lower:
        prov = "Anthropic"
        mdl = target_model or ("claude-3-7-sonnet" if "sonnet" in n_lower else ("claude-3-opus" if "opus" in n_lower else "claude-3-5-haiku"))
    elif "gemini" in n_lower or "google" in n_lower:
        prov = "Google Gemini"
        mdl = target_model or ("gemini-2.5-pro" if "pro" in n_lower else "gemini-3.6-flash")
    elif "openai" in n_lower or "gpt-4" in n_lower or "gpt-3" in n_lower:
        prov = "OpenAI"
        mdl = target_model or ("gpt-4o-mini" if "mini" in n_lower else "gpt-4o")
    elif "groq" in n_lower or "oss" in n_lower:
        prov = "Groq Cloud"
        mdl = target_model or ("openai/gpt-oss-120b" if "120b" in n_lower else "openai/gpt-oss-20b")
    elif "ollama" in n_lower:
        prov = "Ollama (Local)"
        mdl = target_model or "ollama"
    elif "lmstudio" in n_lower:
        prov = "LM Studio (Local)"
        mdl = target_model or "lmstudio"
    else:
        prov = "LLM Engine"
        mdl = target_model or name
    return prov, mdl


# ── Public interface ──────────────────────────────────────────────────────────

def chat(
    messages: list,
    complexity: str = "standard",
    max_tokens: int = 4096,
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
    # Scale token budget by effort
    if effort == "low":
        max_tokens = min(max_tokens, 2048)
    elif effort == "high":
        max_tokens = max(max_tokens, 8192)

    if complexity == "high":
        attempts = _high_complexity_providers(messages, max_tokens, session_id=session_id, resume=resume)
    elif complexity == "compress":
        attempts = _compress_complexity_providers(messages, max_tokens, session_id=session_id, resume=resume)
    else:
        attempts = _standard_complexity_providers(messages, max_tokens, session_id=session_id, resume=resume)

    # If user selected a specific model, prioritize it
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
    max_tokens: int = 4096,
    target_model: str = None,
    effort: str = "medium",
    session_id: str = None,
    resume: bool = False,
) -> dict:
    """
    Like chat(), but parses the response as JSON.
    Strips markdown code fences and handles embedded JSON substrings robustly.
    """
    import re

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

    # Regex fence extraction
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw, re.IGNORECASE)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except Exception:
            pass

    # Outer curly bracket slice
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

__all__ = [
    "_SESSION",
    "_call_anthropic",
    "_call_openai",
    "_call_gemini",
    "_call_groq",
    "_get_claude_cli_binary",
    "_call_claude_cli",
    "_call_claude_session",
    "_resolve_claude_mix_model",
    "_call_ollama",
    "_call_lmstudio",
    "_model_to_provider_call",
    "_high_complexity_providers",
    "_standard_complexity_providers",
    "_compress_complexity_providers",
    "_parse_provider_and_model",
    "chat",
    "chat_json",
]
