"""
app/providers/waterfall.py
--------------------------
Model routing resolution and tiered fallback waterfalls.
"""

from app.config import (
    ANTHROPIC_KEY,
    CLAUDE_COOKIE,
    GEMINI_KEY,
    GROQ_KEYS,
    LLM_MODELS,
    OPENAI_KEY,
)
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


def _model_to_provider_call(
    model_id: str,
    messages: list,
    max_tokens: int,
    session_id: str = None,
    resume: bool = False,
):
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

    # 2. Cloud Providers
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
        if _get_claude_cli_binary():
            cli_model = None
            if "opus" in m:
                cli_model = "claude-3-opus-20240229"
            elif "haiku" in m:
                cli_model = "claude-3-5-haiku-20241022"
            elif "sonnet" in m:
                cli_model = "claude-3-7-sonnet-20250219"
            return (lambda: _call_claude_cli(messages, cli_model, max_tokens, session_id=session_id, resume=resume), f"Claude Code CLI ({cli_model or 'Default'})")

        if ANTHROPIC_KEY:
            actual_model = LLM_MODELS.get("anthropic_high", "claude-3-7-sonnet-20250219") if "sonnet" in m else LLM_MODELS.get("anthropic_fast", "claude-3-5-haiku-20241022")
            return (lambda: _call_anthropic(messages, actual_model, max_tokens), f"Claude API ({actual_model})")

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


def _high_complexity_providers(messages: list, max_tokens: int, session_id: str = None, resume: bool = False):
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


def _standard_complexity_providers(messages: list, max_tokens: int, session_id: str = None, resume: bool = False):
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


def _compress_complexity_providers(messages: list, max_tokens: int, session_id: str = None, resume: bool = False):
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
