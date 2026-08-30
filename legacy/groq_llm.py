"""
groq_llm.py — Legacy Groq LLM shim for Fabric AI Studio

Kept for backward compatibility with existing server.py call sites.
New code should use app/llm_router.py which supports Claude, GPT,
Gemini, and Groq with automatic fallback waterfall.

API keys are loaded from app/config.py -> .env file.
DO NOT hardcode keys here.
"""

import json
import urllib.request
import urllib.error

# Load keys from environment — never hardcode here
try:
    from app.config import GROQ_KEYS as _GROQ_KEYS, LLM_MODELS as _LLM_MODELS
except ImportError:
    import os
    _GROQ_KEYS = [k for k in [os.getenv("GROQ_API_KEY_1"), os.getenv("GROQ_API_KEY_2")] if k]
    _LLM_MODELS = {}

if not _GROQ_KEYS:
    import warnings
    warnings.warn(
        "No GROQ_API_KEY set. Add GROQ_API_KEY_1 to your .env file.",
        RuntimeWarning, stacklevel=1
    )

_GROQ_URL   = "https://api.groq.com/openai/v1/chat/completions"
_MODEL      = _LLM_MODELS.get("groq_high", "openai/gpt-oss-120b")
_MODEL_FAST = _LLM_MODELS.get("groq_fast", "openai/gpt-oss-20b")


def chat(messages: list, model: str = None, temperature: float = 0.3, max_tokens: int = 2048) -> str:
    """
    Send a chat completion request to Groq.
    Tries KEY2 first, falls back to KEY3.
    Returns the assistant message content as a string.
    Raises RuntimeError if both keys fail.
    """
    model = model or _MODEL
    body = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens,
    }

    last_err = None
    for key in _GROQ_KEYS:
        try:
            # Use requests if available (handles TLS + headers better)
            import requests as _req
            resp = _req.post(
                _GROQ_URL,
                json=body,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                    "User-Agent": "FabricAI/1.0 Python",
                },
                timeout=30,
            )
            if resp.status_code == 200:
                return resp.json()["choices"][0]["message"]["content"]
            if resp.status_code in (401, 403, 429):
                last_err = f"HTTP {resp.status_code}"
                continue
            raise RuntimeError(f"Groq API error: HTTP {resp.status_code} {resp.text[:200]}")
        except ImportError:
            # Fallback: urllib with proper headers
            import urllib.request, urllib.error
            payload = json.dumps(body).encode("utf-8")
            req = urllib.request.Request(
                _GROQ_URL,
                data=payload,
                headers={
                    "Authorization": f"Bearer {key}",
                    "Content-Type": "application/json",
                    "User-Agent": "FabricAI/1.0 Python/3.12",
                    "Accept": "application/json",
                },
                method="POST",
            )
            try:
                with urllib.request.urlopen(req, timeout=30) as resp:
                    data = json.loads(resp.read().decode("utf-8"))
                    return data["choices"][0]["message"]["content"]
            except urllib.error.HTTPError as e:
                body_err = e.read().decode("utf-8", errors="ignore")
                last_err = f"HTTP {e.code}: {body_err[:200]}"
                if e.code in (401, 403, 429):
                    continue
                raise RuntimeError(f"Groq API error: {last_err}")
        except Exception as e:
            last_err = str(e)
            continue

    raise RuntimeError(f"All Groq keys exhausted. Last error: {last_err}")


def plan_fabric_architecture(prompt: str, folder_name: str, workspace: str) -> dict:
    """
    Ask the LLM to produce a structured Fabric architecture plan as JSON.
    Returns a dict with: layers, lakehouses, notebooks (name+layer+description),
    pipeline_name, schedule_cron, schedule_human.
    """
    system = f"""You are a Microsoft Fabric architecture expert. 
Your job is to analyse a user's description and output a structured JSON plan for provisioning items in a Fabric workspace called "{workspace}".

Rules:
- Only output valid JSON, no markdown, no explanation outside the JSON.
- Folder name is always: {folder_name}
- Infer medallion layers (bronze/silver/gold) from context. If unclear, use bronze+silver.
- Generate a notebook name and a one-line description for each layer.
- Notebook names must use underscores, lowercase, start with nb_.
- Pipeline name must start with pl_, use underscores.
- Schedule: default to nightly at 02:00 UTC unless user says otherwise.

Output this exact JSON structure:
{{
  "layers": ["bronze", "silver"],
  "lakehouses": ["lh_<folder>_bronze", "lh_<folder>_silver"],
  "notebooks": [
    {{"name": "nb_...", "layer": "Bronze", "description": "one line describing what this notebook does"}},
    {{"name": "nb_...", "layer": "Silver", "description": "..."}}
  ],
  "environment_name": "env_<folder>_spark",
  "pipeline_name": "pl_<folder>_etl",
  "schedule_cron": "0 2 * * *",
  "schedule_human": "Nightly at 02:00 UTC",
  "summary": "One sentence describing the overall architecture"
}}"""

    fln = folder_name.lower().replace(" ", "_")
    user_msg = f"Folder: {folder_name} (use {fln} in names)\nUser request: {prompt}"

    response = chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user_msg}],
        model=_MODEL,
        temperature=0.2,
        max_tokens=800,
    )

    # Strip any accidental markdown fences
    text = response.strip()
    if text.startswith("```"):
        text = text.split("```")[1]
        if text.startswith("json"):
            text = text[4:]
    text = text.strip()

    return json.loads(text)


def generate_pyspark_code(notebook_name: str, layer: str, description: str,
                           folder_name: str, lakehouse_name: str) -> str:
    """
    Ask the LLM to generate real PySpark notebook code for a given layer.
    """
    system = """You are a PySpark expert for Microsoft Fabric Delta Lake.
Write complete, runnable PySpark notebook code. 
- Use spark.read / spark.write with Delta format
- Add proper column transformations appropriate for the layer
- Add print() statements for progress logging
- Output ONLY the Python code, no markdown fences, no explanation"""

    user_msg = f"""Write PySpark code for:
Notebook: {notebook_name}
Layer: {layer}
Purpose: {description}
Reads from lakehouse: {lakehouse_name}
Folder/workspace context: {folder_name}

The code should be production-quality with error handling and logging."""

    return chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user_msg}],
        model=_MODEL,
        temperature=0.25,
        max_tokens=600,
    )


def interpret_user_prompt(prompt: str) -> dict:
    """
    Quick LLM classification of a free-form prompt.
    Returns: {intent: 'architect'|'ingest'|'provision'|'question', folder: str|null, summary: str}
    """
    system = """Classify the user's Fabric/data engineering request. Output only JSON:
{
  "intent": "architect|ingest|provision|question",
  "folder": "folder name if mentioned, else null",
  "summary": "one sentence restatement of what they want"
}"""

    response = chat(
        [{"role": "system", "content": system}, {"role": "user", "content": prompt}],
        model=_MODEL_FAST,
        temperature=0.1,
        max_tokens=120,
    )
    text = response.strip().lstrip("```json").rstrip("```").strip()
    return json.loads(text)
