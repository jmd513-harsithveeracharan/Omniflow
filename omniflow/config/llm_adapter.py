"""
omniflow/config/llm_adapter.py
------------------------------
Lightweight standalone LLM adapter for OmniFlow when executing outside Fabric_AI.
Uses persistent Azure OpenAI or OpenAI client with keep-alive connection pooling.
Supports both synchronous completion and real-time non-blocking token streaming.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, AsyncGenerator, Generator
import httpx

_SYNC_CLIENT: Any = None
_ASYNC_CLIENT: Any = None
_ASYNC_HTTP_CLIENT: httpx.AsyncClient | None = None


def _get_client():
    global _SYNC_CLIENT
    if _SYNC_CLIENT is not None:
        return _SYNC_CLIENT

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
        _SYNC_CLIENT = AzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
            timeout=60.0,
        )
        return _SYNC_CLIENT
    elif api_key:
        _SYNC_CLIENT = OpenAI(api_key=api_key)
        return _SYNC_CLIENT

    raise ValueError(
        "No LLM credentials configured. Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in .env."
    )


def _get_async_client():
    global _ASYNC_CLIENT, _ASYNC_HTTP_CLIENT
    if _ASYNC_CLIENT is not None:
        return _ASYNC_CLIENT

    from openai import AsyncAzureOpenAI, AsyncOpenAI

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

    _ASYNC_HTTP_CLIENT = httpx.AsyncClient(
        limits=httpx.Limits(max_keepalive_connections=15, max_connections=30, keepalive_expiry=180.0),
        timeout=httpx.Timeout(90.0, connect=10.0),
    )

    if endpoint and api_key:
        _ASYNC_CLIENT = AsyncAzureOpenAI(
            azure_endpoint=endpoint,
            api_key=api_key,
            api_version=api_version,
            timeout=60.0,
            http_client=_ASYNC_HTTP_CLIENT,
        )
        return _ASYNC_CLIENT
    elif api_key:
        _ASYNC_CLIENT = AsyncOpenAI(api_key=api_key, http_client=_ASYNC_HTTP_CLIENT)
        return _ASYNC_CLIENT

    raise ValueError(
        "No LLM credentials configured. Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY in .env."
    )


def chat(
    messages: list[dict[str, str]],
    target_model: str | None = None,
    complexity: str = "standard",
    session_id: str | None = None,
    effort: str | None = None,
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
    call_kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,  # type: ignore
    }

    # Dynamically inject Azure OpenAI reasoning_effort (low / medium / high)
    eff = (effort or kwargs.get("reasoning_effort") or "").lower()
    if eff in ["low", "medium", "high"]:
        call_kwargs["reasoning_effort"] = eff

    if "luna" not in model.lower() and "o1" not in model.lower() and "o3" not in model.lower():
        if "temperature" in kwargs:
            call_kwargs["temperature"] = kwargs["temperature"]

    try:
        resp = client.chat.completions.create(**call_kwargs)
    except Exception as e:
        err_msg = str(e).lower()
        retry = False
        if "reasoning_effort" in err_msg and "reasoning_effort" in call_kwargs:
            del call_kwargs["reasoning_effort"]
            retry = True
        if "temperature" in err_msg and "temperature" in call_kwargs:
            del call_kwargs["temperature"]
            retry = True
        if retry:
            resp = client.chat.completions.create(**call_kwargs)
        else:
            raise

    return resp.choices[0].message.content or ""


def chat_stream(
    messages: list[dict[str, str]],
    target_model: str | None = None,
    complexity: str = "standard",
    session_id: str | None = None,
    effort: str | None = None,
    **kwargs: Any,
) -> Generator[str, None, None]:
    """Streams real-time text token chunks synchronously via Azure OpenAI or OpenAI."""
    client = _get_client()
    model = (
        target_model
        or os.getenv("AZURE_OPENAI_DEPLOYMENT")
        or os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT_NAME")
        or "omni-flow-gpt-6-luna"
    )
    call_kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,  # type: ignore
        "stream": True,
    }

    eff = (effort or kwargs.get("reasoning_effort") or "").lower()
    if eff in ["low", "medium", "high"]:
        call_kwargs["reasoning_effort"] = eff

    if "luna" not in model.lower() and "o1" not in model.lower() and "o3" not in model.lower():
        if "temperature" in kwargs:
            call_kwargs["temperature"] = kwargs["temperature"]

    try:
        response = client.chat.completions.create(**call_kwargs)
        for chunk in response:
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as e:
        err_msg = str(e).lower()
        if "reasoning_effort" in err_msg and "reasoning_effort" in call_kwargs:
            del call_kwargs["reasoning_effort"]
            response = client.chat.completions.create(**call_kwargs)
            for chunk in response:
                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        else:
            raise


async def chat_stream_async(
    messages: list[dict[str, str]],
    target_model: str | None = None,
    complexity: str = "standard",
    session_id: str | None = None,
    effort: str | None = None,
    **kwargs: Any,
) -> AsyncGenerator[str, None]:
    """Streams real-time text token chunks via non-blocking AsyncAzureOpenAI with keep-alive socket reuse."""
    client = _get_async_client()
    model = (
        target_model
        or os.getenv("AZURE_OPENAI_DEPLOYMENT")
        or os.getenv("AZURE_OPENAI_CHAT_DEPLOYMENT_NAME")
        or "omni-flow-gpt-6-luna"
    )
    call_kwargs: dict[str, Any] = {
        "model": model,
        "messages": messages,  # type: ignore
        "stream": True,
    }

    eff = (effort or kwargs.get("reasoning_effort") or "").lower()
    if eff in ["low", "medium", "high"]:
        call_kwargs["reasoning_effort"] = eff

    if "luna" not in model.lower() and "o1" not in model.lower() and "o3" not in model.lower():
        if "temperature" in kwargs:
            call_kwargs["temperature"] = kwargs["temperature"]

    try:
        response = await client.chat.completions.create(**call_kwargs)
        async for chunk in response:
            if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content
    except Exception as e:
        err_msg = str(e).lower()
        if "reasoning_effort" in err_msg and "reasoning_effort" in call_kwargs:
            del call_kwargs["reasoning_effort"]
            response = await client.chat.completions.create(**call_kwargs)
            async for chunk in response:
                if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
                    yield chunk.choices[0].delta.content
        else:
            raise


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
