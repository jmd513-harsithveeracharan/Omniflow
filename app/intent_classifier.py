"""
app/intent_classifier.py
-------------------------
Fast LLM-Powered Zero-Shot Intent Classifier for Fabric AI Studio.
Classifies user prompts into BUILD_ARCHITECTURE, PROJECT_CONSULT, or GENERAL_CHAT
using lightweight Gemini Flash / Groq calls (p95 latency ~100ms) with deterministic fallback.
"""

from __future__ import annotations

import json
import re
from typing import Any, Literal

from app.config import GEMINI_KEY, GROQ_KEYS, LLM_MODELS
from app.llm_router import _SESSION

IntentType = Literal["BUILD_ARCHITECTURE", "PROJECT_CONSULT", "GENERAL_CHAT"]

INTENT_SYSTEM_PROMPT = """You are the precise intent classification engine for Microsoft Fabric AI Studio.
Analyze the user's prompt and categorize it into EXACTLY ONE of three intents:

1. "BUILD_ARCHITECTURE": The user is explicitly ordering to create, provision, build, deploy, or generate new Microsoft Fabric assets (e.g., "Create project Sales_5 with lh_bronze, lh_silver, 3 notebooks, and pipeline pl_daily", "provision medallion lakehouse for SAP", "build delta pipeline").
2. "PROJECT_CONSULT": The user is asking an architectural consultation question, comparison, optimization advice, or query about their Fabric data engineering setup/project (e.g., "We ingested using batch load, do you think incremental is better?", "how should I partition silver tables?", "what is the difference between Lakehouse and Warehouse?").
3. "GENERAL_CHAT": The user is asking general coding/programming, algorithms, concepts (e.g., "what are skill.md files?", "how does neural net backprop work?", "reverse a linked list in python"), casual conversation ("hi, how are you?"), or non-Fabric questions.

Respond ONLY with valid JSON in this exact structure:
{"intent": "BUILD_ARCHITECTURE" | "PROJECT_CONSULT" | "GENERAL_CHAT", "reason": "short explanation"}"""


def _fast_llm_classify(prompt: str) -> tuple[IntentType, str] | None:
    """Calls Gemini Flash or Groq with a strict 1.5s timeout for zero-shot classification."""
    messages = [
        {"role": "system", "content": INTENT_SYSTEM_PROMPT},
        {"role": "user", "content": f"Classify this prompt:\n\n{prompt}"},
    ]

    # 1. Try Google Gemini Flash
    if GEMINI_KEY:
        try:
            model = LLM_MODELS.get("gemini_standard", "gemini-3.6-flash")
            contents = [{"role": "user", "parts": [{"text": f"Classify this prompt:\n\n{prompt}"}]}]
            payload = {
                "contents": contents,
                "systemInstruction": {"parts": [{"text": INTENT_SYSTEM_PROMPT}]},
                "generationConfig": {
                    "responseMimeType": "application/json",
                    "maxOutputTokens": 100,
                    "temperature": 0.0,
                },
            }
            resp = _SESSION.post(
                f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={GEMINI_KEY}",
                json=payload,
                timeout=1.5,
            )
            if resp.status_code == 200:
                data = resp.json()
                raw_text = data["candidates"][0]["content"]["parts"][0]["text"]
                parsed = json.loads(raw_text)
                intent = parsed.get("intent", "").upper().strip()
                if intent in ("BUILD_ARCHITECTURE", "PROJECT_CONSULT", "GENERAL_CHAT"):
                    return intent, parsed.get("reason", "classified_by_gemini")
        except Exception:
            pass

    # 2. Try Groq fast model
    if GROQ_KEYS:
        for key in GROQ_KEYS:
            try:
                resp = _SESSION.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {key}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": LLM_MODELS.get("groq_fast", "openai/gpt-oss-20b"),
                        "messages": messages,
                        "temperature": 0.0,
                        "max_tokens": 100,
                        "response_format": {"type": "json_object"},
                    },
                    timeout=1.5,
                )
                if resp.status_code == 200:
                    raw_text = resp.json()["choices"][0]["message"]["content"]
                    parsed = json.loads(raw_text)
                    intent = parsed.get("intent", "").upper().strip()
                    if intent in ("BUILD_ARCHITECTURE", "PROJECT_CONSULT", "GENERAL_CHAT"):
                        return intent, parsed.get("reason", "classified_by_groq")
            except Exception:
                continue

    return None


def _fallback_rule_classify(prompt: str) -> tuple[IntentType, str]:
    """Deterministic, strict regex classifier used only if LLM call is unavailable or times out."""
    p = prompt.strip().lower()

    # Explicit imperative action triggers for building Fabric infrastructure
    build_imperatives = [
        r"^(?:please\s+)?(?:create|build|provision|deploy|generate|architect|scaffold)\s+(?:a\s+|an\s+|the\s+|project\s+|folder\s+|new\s+)?(?:folder|project|lakehouse|warehouse|pipeline|medallion|architecture|star\s+schema)",
        r"\b(?:create|build|provision|deploy)\s+(?:project|folder)\s+[a-z0-9_\-]+",
    ]
    for pat in build_imperatives:
        if re.search(pat, p, re.IGNORECASE):
            return "BUILD_ARCHITECTURE", "rule_imperative_build_command"

    # Multi-item Fabric token signatures (e.g., user supplies multiple lh_, nb_, pl_ names)
    fabric_tokens = len(re.findall(r"\b(?:lh_|nb_|wh_|pl_|sm_)[a-z0-9_\-]+", p, re.IGNORECASE))
    if fabric_tokens >= 2 and any(k in p for k in ["create", "build", "provision", "deploy", "folder", "with"]):
        return "BUILD_ARCHITECTURE", "rule_multi_fabric_tokens"

    # Fabric Data Engineering consultative / advisory keywords
    de_consult_keywords = [
        "incremental", "batch load", "medallion", "delta lake", "delta table", "delta",
        "lakehouse", "warehouse", "partition", "partitioning", "pyspark", "spark sql",
        "synapse", "onelake", "fabric", "scd type", "scd", "star schema", "dimension table",
        "fact table", "silver table", "bronze table", "gold table", "power bi semantic",
        "data pipeline schedule", "optimize table", "vacuum", "z-order", "v-order",
    ]
    if any(k in p for k in de_consult_keywords):
        return "PROJECT_CONSULT", "rule_de_consultation_keywords"

    # Default to general chat for all other questions / prompts
    return "GENERAL_CHAT", "rule_default_general"


def classify_prompt_intent(
    prompt: str,
    session_history: list[dict[str, Any]] | None = None,
    forced_mode: str | None = None,
) -> tuple[IntentType, dict[str, Any]]:
    """
    Main intent classification entry point.
    Returns (IntentType, metadata_dict).
    """
    clean_p = (prompt or "").strip()
    if not clean_p:
        return "GENERAL_CHAT", {"reason": "empty_prompt", "method": "heuristic"}

    # 1. Forced UI mode overrides
    f_mode = (forced_mode or "auto").lower().strip()
    if f_mode == "general":
        return "GENERAL_CHAT", {"reason": "forced_general_mode", "method": "ui_override"}

    # 2. Fast LLM Classification (~100ms)
    llm_res = _fast_llm_classify(clean_p)
    if llm_res:
        intent, reason = llm_res
        if f_mode == "project" and intent == "GENERAL_CHAT":
            # If user explicitly locked Project mode, treat general questions as Project consults
            intent = "PROJECT_CONSULT"
        return intent, {"reason": reason, "method": "fast_llm"}

    # 3. Deterministic Fallback
    fallback_intent, fallback_reason = _fallback_rule_classify(clean_p)
    if f_mode == "project" and fallback_intent == "GENERAL_CHAT":
        fallback_intent = "PROJECT_CONSULT"
    return fallback_intent, {"reason": fallback_reason, "method": "fallback_rules"}
