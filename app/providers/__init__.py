"""
app/providers/__init__.py
-------------------------
Multi-provider LLM client suite conforming to AGENTS.md single responsibility.
"""

from app.providers.claude import (
    _call_claude_cli,
    _call_claude_session,
    _get_claude_cli_binary,
    _resolve_claude_mix_model,
)
from app.providers.cloud import (
    _call_anthropic,
    _call_gemini,
    _call_groq,
    _call_openai,
)
from app.providers.local import (
    _call_lmstudio,
    _call_ollama,
)
from app.providers.router import (
    chat,
    chat_json,
)
from app.providers.session import _SESSION
from app.providers.waterfall import (
    _compress_complexity_providers,
    _high_complexity_providers,
    _model_to_provider_call,
    _parse_provider_and_model,
    _standard_complexity_providers,
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

