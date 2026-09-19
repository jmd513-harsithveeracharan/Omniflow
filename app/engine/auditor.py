"""
app/engine/auditor.py
---------------------
Stage 4: Pre-flight validator and auditor checking assembled plan against user constraints.
"""

from __future__ import annotations

import json
import re
import time

from app.engine.models import AuditResult, extract_json
from app.engine.progress import _now_utc_str
from app.llm_router import chat
from app.meta_skill import AUDITOR_SYSTEM


def run_auditor(
    prompt: str,
    plan: dict,
    target_model: str | None = None,
    effort: str = "medium",
    session_id: str | None = None,
) -> AuditResult:
    """Executes pre-flight compliance audit to ensure all requested items and constraints are met."""
    start_t = time.perf_counter()
    start_utc = _now_utc_str()

    plan_summary = {
        "folder": plan.get("folder"),
        "notebooks": [nb.get("name") for nb in plan.get("notebooks", [])],
        "lakehouses": plan.get("lakehouses", []),
        "pipeline_name": plan.get("pipeline", {}).get("name") if plan.get("pipeline") else None,
        "schedule": str(plan.get("pipeline", {}).get("schedule", "")) if plan.get("pipeline") else None,
    }
    msgs = [
        {"role": "system", "content": AUDITOR_SYSTEM},
        {"role": "user", "content": f"User original request:\n{prompt}\n\nAssembled plan:\n{json.dumps(plan_summary, indent=2)}"},
    ]
    try:
        raw = chat(
            msgs,
            complexity="standard",
            max_tokens=512,
            target_model=target_model,
            effort=effort,
            session_id=session_id,
        )
        parsed = extract_json(raw)
        end_t = time.perf_counter()
        if parsed:
            return AuditResult(
                passed=bool(parsed.get("passed", True)),
                missing_items=parsed.get("missing_items", []),
                extra_items=parsed.get("extra_items", []),
                chat_message=parsed.get("chat_message", "Audit complete."),
                started_at=start_utc,
                completed_at=_now_utc_str(),
                duration_sec=round(end_t - start_t, 2),
            )
    except Exception:
        pass

    # Pure code-level fallback audit
    end_t = time.perf_counter()
    nb_names = [nb.get("name", "") for nb in plan.get("notebooks", [])]
    missing = [n for n in re.findall(r"\b(nb_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE) if n not in nb_names]
    passed = len(missing) == 0
    return AuditResult(
        passed=passed,
        missing_items=missing,
        chat_message="Audit passed." if passed else f"Audit: Missing {missing}. Auto-remediating...",
        started_at=start_utc,
        completed_at=_now_utc_str(),
        duration_sec=round(end_t - start_t, 2),
    )

