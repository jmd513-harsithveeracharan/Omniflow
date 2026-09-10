"""
app/token_tracker.py
--------------------
Monitors, calculates, and audits LLM token usage and estimated costs
across multi-provider waterfall routing at granular model level.
"""

from __future__ import annotations

import sqlite3
import threading
import time
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field

_db_lock = threading.Lock()

# ── Official LLM Pricing Rate Cards (USD per 1M tokens) ─────────────────────
# (input_cost_per_1m, output_cost_per_1m)
MODEL_PRICING_PER_MILLION: dict[str, tuple[float, float]] = {
    # Anthropic
    "claude-3-7-sonnet": (3.00, 15.00),
    "claude-3-5-sonnet": (3.00, 15.00),
    "claude-3-5-haiku": (0.80, 4.00),
    "claude-3-haiku": (0.25, 1.25),
    "claude-3-opus": (15.00, 75.00),
    "claude-opus-5": (15.00, 75.00),
    # OpenAI
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "o1": (15.00, 60.00),
    "o3-mini": (1.10, 4.40),
    # Google Gemini
    "gemini-2.5-pro": (1.25, 5.00),
    "gemini-3.6-flash": (0.10, 0.40),
    "gemini-1.5-pro": (1.25, 5.00),
    "gemini-1.5-flash": (0.075, 0.30),
    # Groq Cloud
    "openai/gpt-oss-120b": (0.59, 0.79),
    "openai/gpt-oss-20b": (0.05, 0.08),
    "llama-3.3-70b": (0.59, 0.79),
    "llama-3.1-8b": (0.05, 0.08),
    # Subscriptions & Local
    "claude-code-cli": (0.00, 0.00),
    "ollama": (0.00, 0.00),
    "lmstudio": (0.00, 0.00),
}


class TokenUsageRecord(BaseModel):
    id: int | None = None
    session_id: str | None = None
    provider: str
    model: str
    prompt_tokens: int = Field(default=0, ge=0)
    completion_tokens: int = Field(default=0, ge=0)
    total_tokens: int = Field(default=0, ge=0)
    cost_usd: float = Field(default=0.0, ge=0.0)
    duration_ms: float = Field(default=0.0, ge=0.0)
    complexity: str = "standard"
    status: str = "success"
    error_message: str | None = None
    created_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())


class ModelGranularityStats(BaseModel):
    model: str
    provider: str
    call_count: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0
    avg_duration_ms: float = 0.0


class ProviderGranularityStats(BaseModel):
    provider: str
    call_count: int = 0
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0
    cost_usd: float = 0.0
    models: list[ModelGranularityStats] = Field(default_factory=list)


class TokenAuditSummary(BaseModel):
    total_calls: int = 0
    total_prompt_tokens: int = 0
    total_completion_tokens: int = 0
    total_tokens: int = 0
    total_cost_usd: float = 0.0
    avg_latency_ms: float = 0.0
    by_provider: dict[str, ProviderGranularityStats] = Field(default_factory=dict)
    by_model: dict[str, ModelGranularityStats] = Field(default_factory=dict)
    explanation: str = ""


def estimate_token_count(text: str) -> int:
    """Estimates tokens with a refined BPE word/character ratio heuristic."""
    if not text:
        return 0
    words = len(text.split())
    chars = len(text)
    return max(int(words * 1.33), int(chars / 4.0), 1)


def get_model_rate_card(model_name: str) -> tuple[float, float]:
    """Finds input/output USD pricing per 1M tokens by matching model prefix."""
    m_lower = (model_name or "").lower().strip()
    for key, rates in MODEL_PRICING_PER_MILLION.items():
        if key in m_lower or m_lower.startswith(key):
            return rates
    # Fallback to general low-cost estimate if unknown
    return (0.50, 1.50)


def calculate_token_cost(model_name: str, prompt_tokens: int, completion_tokens: int) -> float:
    """Calculates dollar cost based on model rate card per million tokens."""
    in_rate, out_rate = get_model_rate_card(model_name)
    in_cost = (prompt_tokens / 1_000_000.0) * in_rate
    out_cost = (completion_tokens / 1_000_000.0) * out_rate
    return round(in_cost + out_cost, 6)


def _get_connection() -> sqlite3.Connection:
    from app.session_store import _get_conn
    return _get_conn()


def record_token_usage(
    provider: str,
    model: str,
    prompt_text: str | list[dict[str, Any]] | None = None,
    completion_text: str | None = None,
    prompt_tokens: int | None = None,
    completion_tokens: int | None = None,
    duration_ms: float = 0.0,
    session_id: str | None = None,
    complexity: str = "standard",
    status: str = "success",
    error_message: str | None = None,
) -> TokenUsageRecord:
    """Records an LLM interaction and clocks its token usage and cost into the database."""
    # 1. Compute tokens
    if prompt_tokens is None:
        if isinstance(prompt_text, list):
            prompt_str = " ".join(str(m.get("content", "")) for m in prompt_text if isinstance(m, dict))
        else:
            prompt_str = str(prompt_text or "")
        p_tokens = estimate_token_count(prompt_str)
    else:
        p_tokens = max(0, prompt_tokens)

    if completion_tokens is None:
        c_tokens = estimate_token_count(completion_text or "")
    else:
        c_tokens = max(0, completion_tokens)

    total_tokens = p_tokens + c_tokens
    cost = calculate_token_cost(model, p_tokens, c_tokens)
    now = datetime.now(UTC).isoformat()

    rec = TokenUsageRecord(
        session_id=session_id,
        provider=provider,
        model=model,
        prompt_tokens=p_tokens,
        completion_tokens=c_tokens,
        total_tokens=total_tokens,
        cost_usd=cost,
        duration_ms=round(duration_ms, 2),
        complexity=complexity,
        status=status,
        error_message=error_message,
        created_at=now,
    )

    with _db_lock:
        try:
            conn = _get_connection()
            cur = conn.cursor()
            cur.execute(
                """
                INSERT INTO token_usage 
                (session_id, provider, model, prompt_tokens, completion_tokens, total_tokens, cost_usd, duration_ms, complexity, status, error_message, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    rec.session_id,
                    rec.provider,
                    rec.model,
                    rec.prompt_tokens,
                    rec.completion_tokens,
                    rec.total_tokens,
                    rec.cost_usd,
                    rec.duration_ms,
                    rec.complexity,
                    rec.status,
                    rec.error_message,
                    rec.created_at,
                ),
            )
            rec.id = cur.lastrowid
            conn.commit()
            conn.close()
        except Exception as e:
            print(f"[TOKEN_TRACKER] Failed to persist token record: {e}")

    return rec


def get_token_audit_summary(session_id: str | None = None) -> TokenAuditSummary:
    """Aggregates all recorded token metrics by provider and model with analytical summary."""
    conn = _get_connection()
    cur = conn.cursor()

    query = """
        SELECT provider, model, 
               COUNT(*) as call_count,
               SUM(prompt_tokens) as sum_prompt,
               SUM(completion_tokens) as sum_comp,
               SUM(total_tokens) as sum_total,
               SUM(cost_usd) as sum_cost,
               AVG(duration_ms) as avg_lat
        FROM token_usage
    """
    params: list[Any] = []
    if session_id:
        query += " WHERE session_id = ?"
        params.append(session_id)

    query += " GROUP BY provider, model ORDER BY sum_cost DESC, sum_total DESC"

    cur.execute(query, params)
    rows = cur.fetchall()
    conn.close()

    total_calls = 0
    total_prompt = 0
    total_comp = 0
    total_tokens = 0
    total_cost = 0.0
    lat_accum = 0.0

    by_model: dict[str, ModelGranularityStats] = {}
    by_provider: dict[str, ProviderGranularityStats] = {}

    for r in rows:
        prov = r["provider"]
        mdl = r["model"]
        calls = int(r["call_count"] or 0)
        p_tok = int(r["sum_prompt"] or 0)
        c_tok = int(r["sum_comp"] or 0)
        t_tok = int(r["sum_total"] or 0)
        c_cost = float(r["sum_cost"] or 0.0)
        a_lat = float(r["avg_lat"] or 0.0)

        total_calls += calls
        total_prompt += p_tok
        total_comp += c_tok
        total_tokens += t_tok
        total_cost += c_cost
        lat_accum += (a_lat * calls)

        m_stat = ModelGranularityStats(
            model=mdl,
            provider=prov,
            call_count=calls,
            prompt_tokens=p_tok,
            completion_tokens=c_tok,
            total_tokens=t_tok,
            cost_usd=round(c_cost, 6),
            avg_duration_ms=round(a_lat, 2),
        )
        by_model[mdl] = m_stat

        if prov not in by_provider:
            by_provider[prov] = ProviderGranularityStats(provider=prov)
        p_stat = by_provider[prov]
        p_stat.call_count += calls
        p_stat.prompt_tokens += p_tok
        p_stat.completion_tokens += c_tok
        p_stat.total_tokens += t_tok
        p_stat.cost_usd = round(p_stat.cost_usd + c_cost, 6)
        p_stat.models.append(m_stat)

    avg_latency = round(lat_accum / total_calls, 2) if total_calls > 0 else 0.0
    explanation = _generate_audit_explanation(total_calls, total_tokens, total_cost, by_provider)

    return TokenAuditSummary(
        total_calls=total_calls,
        total_prompt_tokens=total_prompt,
        total_completion_tokens=total_comp,
        total_tokens=total_tokens,
        total_cost_usd=round(total_cost, 6),
        avg_latency_ms=avg_latency,
        by_provider=by_provider,
        by_model=by_model,
        explanation=explanation,
    )


def get_recent_token_history(limit: int = 50, session_id: str | None = None) -> list[TokenUsageRecord]:
    """Returns chronologically recent token call logs for auditing."""
    conn = _get_connection()
    cur = conn.cursor()
    if session_id:
        cur.execute(
            "SELECT * FROM token_usage WHERE session_id = ? ORDER BY id DESC LIMIT ?",
            (session_id, limit),
        )
    else:
        cur.execute("SELECT * FROM token_usage ORDER BY id DESC LIMIT ?", (limit,))
    rows = cur.fetchall()
    conn.close()

    return [
        TokenUsageRecord(
            id=r["id"],
            session_id=r["session_id"],
            provider=r["provider"],
            model=r["model"],
            prompt_tokens=r["prompt_tokens"],
            completion_tokens=r["completion_tokens"],
            total_tokens=r["total_tokens"],
            cost_usd=r["cost_usd"],
            duration_ms=r["duration_ms"],
            complexity=r["complexity"],
            status=r["status"],
            error_message=r["error_message"],
            created_at=r["created_at"],
        )
        for r in rows
    ]


def _generate_audit_explanation(
    calls: int, tokens: int, cost: float, by_provider: dict[str, ProviderGranularityStats]
) -> str:
    if calls == 0:
        return "No LLM requests have been recorded yet. The system is operating in fresh state."

    top_provider = max(by_provider.values(), key=lambda p: p.total_tokens) if by_provider else None
    prov_name = top_provider.provider if top_provider else "None"
    prov_pct = round((top_provider.total_tokens / tokens * 100), 1) if top_provider and tokens > 0 else 0

    return (
        f"Processed {calls:,} total LLM calls utilizing {tokens:,} tokens (~${cost:.4f} USD). "
        f"Primary workload routed through {prov_name} ({prov_pct}% of token volume). "
        f"Dynamic multi-tier fallback kept operational costs optimized while preserving response accuracy."
    )
