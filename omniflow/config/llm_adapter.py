"""
omniflow/config/llm_adapter.py
------------------------------
Lightweight standalone LLM adapter for OmniFlow when executing outside Fabric_AI.
Uses standard Azure OpenAI or OpenAI client configured via environment variables.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any


def _get_client():
    from openai import AzureOpenAI, OpenAI

    endpoint = (
        os.getenv("AZURE_OPENAI_ENDPOINT")
        or os.getenv("AZURE_AI_ENDPOINT")
    )
    api_key = (
        os.getenv("AZURE_OPENAI_API_KEY")
        or os.getenv("AZURE_AI_KEY")
        or os.getenv("OPENAI_API_KEY")
    )
    api_version = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")

    if endpoint and api_key:
        return AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
        )
    elif api_key:
        return OpenAI(api_key=api_key)
    raise ValueError(
        "No LLM credentials configured. Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in .env."
    )


def chat(
    messages: list[dict[str, str]],
    target_model: str | None = None,
    complexity: str = "standard",
    session_id: str | None = None,
    **kwargs: Any,
) -> str:
    """Invokes chat completions via Azure OpenAI or OpenAI."""
    client = _get_client()
    model = (
        target_model
        or os.getenv("AZURE_OPENAI_DEPLOYMENT")
        or os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT_NAME")
        or "omni-flow-gpt-6-luna"
    )
    resp = client.chat.completions.create(
        model=model,
        messages=messages,  # type: ignore
        temperature=kwargs.get("temperature", 0.1),
    )
    return resp.choices[0].message.content or ""


def chat_json(
    messages: list[dict[str, str]],
    target_model: str | None = None,
    complexity: str = "high",
    session_id: str | None = None,
    **kwargs: Any,
) -> dict[str, Any]:
    """Invokes chat completions and parses the JSON response payload."""
    raw = chat(messages, target_model=target_model, complexity=complexity, session_id=session_id, **kwargs)
    match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", raw)
    clean = match.group(1).strip() if match else raw.strip()
    try:
        return json.loads(clean)
    except Exception:
        s = clean.find("{")
        e = clean.rfind("}")
        if s != -1 and e != -1 and e > s:
            return json.loads(clean[s : e + 1])
        raise
