"""
app/llm_router.py
-----------------
Single source of truth facade for dynamic multi-provider LLM routing.
Decomposed into modular subpackages under app/providers/ as per AGENTS.md.
"""

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
