"""
tests/test_token_tracker.py
---------------------------
Unit and integration tests for LLM token tracking, rate card pricing,
model granularity breakdown, and audit report generation.
"""

import pytest
from app.token_tracker import (
    MODEL_PRICING_PER_MILLION,
    calculate_token_cost,
    estimate_token_count,
    get_model_rate_card,
    get_recent_token_history,
    get_token_audit_summary,
    record_token_usage,
)


def test_estimate_token_count():
    assert estimate_token_count("") == 0
    text = "Hello world this is a test prompt for Lakehouse ingestion."
    est = estimate_token_count(text)
    assert est >= 10
    assert est <= 25


def test_model_rate_card_resolution():
    sonnet_rates = get_model_rate_card("claude-3-7-sonnet-20250219")
    assert sonnet_rates == (3.00, 15.00)

    haiku_rates = get_model_rate_card("claude-3-5-haiku-20241022")
    assert haiku_rates == (0.80, 4.00)

    gpt4o_rates = get_model_rate_card("gpt-4o")
    assert gpt4o_rates == (2.50, 10.00)

    groq_rates = get_model_rate_card("openai/gpt-oss-120b")
    assert groq_rates == (0.59, 0.79)


def test_calculate_token_cost():
    # 1M prompt + 1M completion on GPT-4o = $2.50 + $10.00 = $12.50
    cost = calculate_token_cost("gpt-4o", 1_000_000, 1_000_000)
    assert cost == 12.50

    # 1000 prompt + 500 completion on GPT-4o-mini = (1k/1m)*0.15 + (500/1m)*0.60
    cost_mini = calculate_token_cost("gpt-4o-mini", 1000, 500)
    assert cost_mini > 0.0


def test_record_and_audit_token_usage():
    session_id = "test_audit_session_123"

    # Record Sonnet call
    rec1 = record_token_usage(
        provider="Anthropic",
        model="claude-3-7-sonnet-20250219",
        prompt_tokens=1500,
        completion_tokens=400,
        duration_ms=1250.5,
        session_id=session_id,
        complexity="high",
        status="success",
    )
    assert rec1.total_tokens == 1900
    assert rec1.cost_usd > 0

    # Record OpenAI call
    rec2 = record_token_usage(
        provider="OpenAI",
        model="gpt-4o-mini",
        prompt_tokens=800,
        completion_tokens=200,
        duration_ms=450.0,
        session_id=session_id,
        complexity="standard",
        status="success",
    )
    assert rec2.total_tokens == 1000

    # Audit summary
    summary = get_token_audit_summary(session_id=session_id)
    assert summary.total_calls >= 2
    assert summary.total_tokens >= 2900
    assert "Anthropic" in summary.by_provider
    assert "OpenAI" in summary.by_provider
    assert "claude-3-7-sonnet-20250219" in summary.by_model
    assert "gpt-4o-mini" in summary.by_model
    assert len(summary.explanation) > 0

    # Recent history
    history = get_recent_token_history(limit=5, session_id=session_id)
    assert len(history) >= 2
    assert history[0].session_id == session_id
