"""
app/engine/models.py
--------------------
Typed state dataclasses and serialization helpers for the 4-Stage State Pipeline.
"""

from __future__ import annotations

import json
import re
import uuid
from dataclasses import dataclass, field
from app.engine.progress import _now_utc_str

MAX_AUDIT_RETRIES = 2


@dataclass
class PipelineStep:
    step_id: str
    type: str           # folder | lakehouse | notebook | pipeline | warehouse | ...
    name: str
    layer: str | None   # Bronze | Silver | Gold | Notebook | None
    description: str
    depends_on: list = field(default_factory=list)
    can_parallel: bool = False


@dataclass
class StepDAG:
    context_mode: str   # independent | follow_up
    folder: str
    steps: list[PipelineStep]
    pipeline: dict | None
    summary: str


@dataclass
class WorkerResult:
    step_id: str
    name: str
    layer: str | None
    pyspark: str
    delta_schema: list = field(default_factory=list)
    lh_path: str = ""
    error: str | None = None
    started_at: str = ""
    completed_at: str = ""
    duration_sec: float = 0.0


@dataclass
class AuditResult:
    passed: bool
    missing_items: list = field(default_factory=list)
    extra_items: list = field(default_factory=list)
    chat_message: str = ""
    started_at: str = ""
    completed_at: str = ""
    duration_sec: float = 0.0


@dataclass
class PipelineState:
    prompt: str
    session_id: str
    history: list = field(default_factory=list)
    current_plan: dict | None = None
    context_mode: str = "independent"
    dag: StepDAG | None = None
    worker_results: dict[str, WorkerResult] = field(default_factory=dict)
    fabric_plan: dict | None = None
    audit: AuditResult | None = None
    audit_messages: list[str] = field(default_factory=list)
    retry_count: int = 0
    run_id: str = field(default_factory=lambda: uuid.uuid4().hex[:8])
    started_at: str = field(default_factory=_now_utc_str)
    completed_at: str = ""
    total_duration_sec: float = 0.0
    stage_timings: dict = field(default_factory=dict)
    target_model: str | None = None
    effort: str = "medium"


def extract_json(raw: str) -> dict | None:
    """Robust JSON extraction from raw model response."""
    if not raw:
        return None
    clean = raw.strip()
    try:
        return json.loads(clean)
    except Exception:
        pass
    m = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean, re.IGNORECASE)
    if m:
        try:
            return json.loads(m.group(1).strip())
        except Exception:
            pass
    s, e = clean.find("{"), clean.rfind("}")
    if s != -1 and e > s:
        candidate = clean[s:e + 1]
        try:
            return json.loads(candidate)
        except Exception:
            cleaned = re.sub(r",\s*([}\]])", r"\1", candidate)
            try:
                return json.loads(cleaned)
            except Exception:
                pass
    return None

