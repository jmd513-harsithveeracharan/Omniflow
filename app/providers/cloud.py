"""
app/providers/cloud.py
----------------------
Direct cloud REST API callers for Anthropic, OpenAI, Gemini, and Groq.
"""

import time
from app.config import (
    ANTHROPIC_KEY,
    GEMINI_KEY,
    GROQ_KEYS,
    OPENAI_KEY,
)
from app.providers.session import _SESSION


def _call_anthropic(messages: list, model: str, max_tokens: int = 4096) -> str:
    """Invokes Anthropic Messages API."""
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
    """Invokes OpenAI Chat Completions API."""
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
    """Invokes Google Gemini REST API."""
    if not GEMINI_KEY:
        raise RuntimeError("GEMINI_API_KEY not set.")
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
    """Invokes Groq Cloud completions with round-robin key fallback."""
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

