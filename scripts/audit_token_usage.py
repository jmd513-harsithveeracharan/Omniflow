#!/usr/bin/env python3
"""
scripts/audit_token_usage.py
----------------------------
CLI Token & Cost Auditor for Fabric AI Studio.
Provides granular breakdown across providers and individual models.
"""

import argparse
import os
import sys

# Add project root to sys.path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.token_tracker import get_recent_token_history, get_token_audit_summary


def print_audit_report(session_id: str | None = None, history_limit: int = 10):
    summary = get_token_audit_summary(session_id=session_id)
    history = get_recent_token_history(limit=history_limit, session_id=session_id)

    print("\n" + "=" * 80)
    print(" [METRICS] FABRIC AI STUDIO - TOKEN USAGE & COST AUDIT REPORT")
    print("=" * 80)

    if session_id:
        print(f" Filtered by Session: {session_id}")
    else:
        print(" Scope: Global Workspace History (All Sessions)")
    print("-" * 80)

    print(f" * Total LLM Requests:         {summary.total_calls:,}")
    print(f" * Prompt (Input) Tokens:      {summary.total_prompt_tokens:,}")
    print(f" * Completion (Output) Tokens: {summary.total_completion_tokens:,}")
    print(f" * Total Tokens Consumed:      {summary.total_tokens:,}")
    print(f" * Total Estimated Cost:       ${summary.total_cost_usd:.4f} USD")
    print(f" * Average Latency:            {summary.avg_latency_ms:.1f} ms")
    print("-" * 80)

    # Provider Breakdown
    print("\n [PROVIDER BREAKDOWN]")
    print(f" {'Provider':<24} {'Calls':<8} {'Prompt Tok':<12} {'Comp Tok':<12} {'Total Tok':<12} {'Cost ($)':<10}")
    print(" " + "-" * 78)
    for p_name, p_stat in summary.by_provider.items():
        print(
            f" {p_name:<24} {p_stat.call_count:<8} {p_stat.prompt_tokens:<12,} "
            f"{p_stat.completion_tokens:<12,} {p_stat.total_tokens:<12,} ${p_stat.cost_usd:<9.4f}"
        )

    # Model Granularity Breakdown
    print("\n [MODEL GRANULARITY BREAKDOWN]")
    print(f" {'Model Name':<28} {'Provider':<16} {'Calls':<8} {'Total Tokens':<14} {'Cost ($)':<10} {'Avg Lat (ms)':<12}")
    print(" " + "-" * 88)
    for m_name, m_stat in summary.by_model.items():
        print(
            f" {m_name:<28} {m_stat.provider:<16} {m_stat.call_count:<8} "
            f"{m_stat.total_tokens:<14,} ${m_stat.cost_usd:<9.4f} {m_stat.avg_duration_ms:<12.1f}"
        )

    # Human-Readable Explanation
    print("\n [AUDIT SUMMARY & EXPLANATION]")
    print(f" {summary.explanation}")

    # Recent Calls Table
    if history:
        print(f"\n [RECENT CALL STREAM (Last {len(history)})]")
        print(f" {'Timestamp':<20} {'Provider':<16} {'Model':<22} {'Tokens':<10} {'Cost ($)':<10} {'Status':<10}")
        print(" " + "-" * 88)
        for h in history:
            ts = h.created_at[:19].replace("T", " ")
            print(
                f" {ts:<20} {h.provider:<16} {h.model:<22} {h.total_tokens:<10,} "
                f"${h.cost_usd:<9.4f} {h.status:<10}"
            )

    print("=" * 80 + "\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Audit Fabric AI Studio Token Usage & Costs.")
    parser.add_argument("--session", "-s", type=str, default=None, help="Filter by session ID")
    parser.add_argument("--limit", "-n", type=int, default=10, help="Number of recent calls to list")
    args = parser.parse_args()

    print_audit_report(session_id=args.session, history_limit=args.limit)
