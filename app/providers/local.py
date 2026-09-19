"""
app/providers/local.py
----------------------
Local model callers for Ollama and LM Studio instances.
"""

from app.providers.session import _SESSION


def _call_ollama(messages: list, model: str, max_tokens: int = 4096) -> str:
    """Call locally running Ollama instance at http://localhost:11434"""
    payload = {
        "model": model,
        "messages": messages,
        "stream": False,
        "options": {"num_predict": max_tokens},
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
