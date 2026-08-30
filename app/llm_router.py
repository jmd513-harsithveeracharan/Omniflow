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
"""

import json
import time
import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

from app.config import (
    ANTHROPIC_KEY, OPENAI_KEY, GEMINI_KEY, GROQ_KEYS, LLM_MODELS,
    CLAUDE_ORG_UUID, CLAUDE_DEVICE_ID, CLAUDE_COOKIE, CLAUDE_MIX_MODE
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
    raise RuntimeError(f"All Groq keys exhausted. Last error: {last_err}")




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


def _model_to_provider_call(model_id: str, messages: list, max_tokens: int):
    """Maps any requested model ID to its native provider attempt (Cloud or Local)."""
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
        # 1. Check if native ANTHROPIC_API_KEY is present
        if ANTHROPIC_KEY:
            actual_model = LLM_MODELS.get("anthropic_high", "claude-3-7-sonnet-20250219") if "sonnet" in m else LLM_MODELS.get("anthropic_fast", "claude-3-5-haiku-20241022")
            return (lambda: _call_anthropic(messages, actual_model, max_tokens), f"Claude API ({actual_model})")
        
        # 2. Use Claude Web Subscription Session with Native Mix
        if CLAUDE_COOKIE:
            full_prompt = " ".join([m.get("content", "") for m in messages])
            if "opus" in m:
                chosen_model = "claude-opus-5"
            elif "haiku" in m:
                chosen_model = "claude-3-5-haiku-20241022"
            elif "sonnet" in m:
                chosen_model = "claude-3-5-sonnet-20241022"
            else:
                # Dynamic Claude Mix Router
                chosen_model = _resolve_claude_mix_model(full_prompt)
            return (lambda: _call_claude_session(messages, chosen_model, max_tokens), f"Claude Native Mix ({chosen_model})")
            
        raise RuntimeError("Neither ANTHROPIC_API_KEY nor CLAUDE_COOKIE is configured in .env.")
    elif "gpt" in m or "openai" in m or "o3" in m:
        if not OPENAI_KEY:
            raise RuntimeError("OPENAI_API_KEY is not configured in .env.")
        actual_model = LLM_MODELS.get("openai_fast", "gpt-4o-mini") if "mini" in m else LLM_MODELS.get("openai_high", "gpt-4o")
        return (lambda: _call_openai(messages, actual_model, max_tokens), f"OpenAI ({actual_model})")
    return None



# ── Provider waterfall definitions ────────────────────────────────────────────

def _high_complexity_providers(messages, max_tokens):
    """Gemini 3.6 Flash → Claude Sonnet → GPT-4o → Groq 120B"""
    attempts = []
    if GEMINI_KEY:
        attempts.append((lambda: _call_gemini(messages, LLM_MODELS.get("gemini_standard", "gemini-3.6-flash"), max_tokens), "Gemini 3.6 Flash"))
    if ANTHROPIC_KEY:
        attempts.append((lambda: _call_anthropic(messages, LLM_MODELS.get("anthropic_high", "claude-3-7-sonnet-20250219"), max_tokens), "Claude Sonnet"))
    elif CLAUDE_COOKIE:
        attempts.append((lambda: _call_claude_session(messages, "claude-opus-5", max_tokens), "Claude Opus (Session)"))
    if OPENAI_KEY:
        attempts.append((lambda: _call_openai(messages, LLM_MODELS.get("openai_high", "gpt-4o"), max_tokens), "GPT-4o"))
    if GROQ_KEYS:
        attempts.append((lambda: _call_groq(messages, LLM_MODELS.get("groq_high", "openai/gpt-oss-120b"), max_tokens), "Groq gpt-oss-120B"))
    return attempts


def _standard_complexity_providers(messages, max_tokens):
    """Gemini 3.6 Flash → Groq 20B → Groq 120B → Claude Haiku"""
    attempts = []
    if GEMINI_KEY:
        attempts.append((lambda: _call_gemini(messages, LLM_MODELS.get("gemini_standard", "gemini-3.6-flash"), max_tokens), "Gemini 3.6 Flash"))
    if GROQ_KEYS:
        attempts.append((lambda: _call_groq(messages, LLM_MODELS.get("groq_fast", "openai/gpt-oss-20b"), max_tokens), "Groq gpt-oss-20B"))
        attempts.append((lambda: _call_groq(messages, LLM_MODELS.get("groq_high", "openai/gpt-oss-120b"), max_tokens), "Groq gpt-oss-120B"))
    if ANTHROPIC_KEY:
        attempts.append((lambda: _call_anthropic(messages, LLM_MODELS.get("anthropic_fast", "claude-3-5-haiku-20241022"), max_tokens), "Claude Haiku"))
    return attempts


def _compress_complexity_providers(messages, max_tokens):
    """Squeeze Straw compressor: Groq 20B / 120B — fast, cheap, targeted."""
    attempts = []
    if GROQ_KEYS:
        attempts.append((lambda: _call_groq(messages, LLM_MODELS.get("groq_fast", "openai/gpt-oss-20b"), max_tokens), "Groq gpt-oss-20B"))
        attempts.append((lambda: _call_groq(messages, LLM_MODELS.get("groq_high", "openai/gpt-oss-120b"), max_tokens), "Groq gpt-oss-120B"))
    elif GEMINI_KEY:
        attempts.append((lambda: _call_gemini(messages, LLM_MODELS.get("gemini_standard", "gemini-3.6-flash"), max_tokens), "Gemini 3.6 Flash"))
    return attempts


# ── Public interface ──────────────────────────────────────────────────────────

def chat(
    messages: list,
    complexity: str = "standard",
    max_tokens: int = 4096,
    target_model: str = None,
    effort: str = "medium",
) -> str:
    """
    Send a chat completion request using the user-selected or best available LLM provider.
    Supports thinking effort scaling (low, medium, high).
    """
    # Scale token budget by effort
    if effort == "low":
        max_tokens = min(max_tokens, 2048)
    elif effort == "high":
        max_tokens = max(max_tokens, 8192)

    if complexity == "high":
        attempts = _high_complexity_providers(messages, max_tokens)
    elif complexity == "compress":
        attempts = _compress_complexity_providers(messages, max_tokens)
    else:
        attempts = _standard_complexity_providers(messages, max_tokens)

    # If user selected a specific model, prioritize it
    if target_model:
        explicit_attempt = _model_to_provider_call(target_model, messages, max_tokens)
        if explicit_attempt:
            attempts = [explicit_attempt] + [a for a in attempts if a[1] != explicit_attempt[1]]

    last_err = None
    for fn, name in attempts:
        try:
            result = fn()
            print(f"[LLM] Response from {name} ({complexity} complexity, {effort} effort).")
            return result
        except Exception as e:
            print(f"[LLM FALLBACK] {name} failed: {e}")
            last_err = str(e)

    raise RuntimeError(f"All LLM providers failed. Last error: {last_err}")


def chat_json(
    messages: list,
    complexity: str = "standard",
    max_tokens: int = 4096,
    target_model: str = None,
    effort: str = "medium",
) -> dict:
    """
    Like chat(), but parses the response as JSON.
    Strips markdown code fences if present before parsing.
    """
    raw = chat(messages, complexity, max_tokens, target_model=target_model, effort=effort)
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
    except json.JSONDecodeError as e:
        raise ValueError(f"LLM returned invalid JSON: {e}\nRaw response:\n{raw[:500]}")
