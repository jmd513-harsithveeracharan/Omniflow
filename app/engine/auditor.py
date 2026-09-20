"""
app/engine/auditor.py
---------------------
Stage 4: Code-level pre-flight validator for Medallion layer isolation,
column projection correctness, managed table writes, and Fabric runtime safety.
"""

from __future__ import annotations

import json
import re
import time
from typing import Any

from app.engine.models import AuditResult, extract_json
from app.engine.progress import _now_utc_str
from app.llm_router import chat
from app.meta_skill import AUDITOR_SYSTEM


def _static_code_audit(plan: dict[str, Any]) -> list[dict[str, str]]:
    """
    Fast, regex-based static code audit that catches the most common
    Fabric runtime bugs without requiring an LLM call.
    Returns a list of violation dicts {notebook, rule, description, severity}.
    """
    violations: list[dict[str, str]] = []
    notebooks = plan.get("notebooks", [])

    for nb in notebooks:
        name = nb.get("name", "unknown")
        layer = nb.get("layer", "Notebook")
        code = nb.get("pyspark_code") or nb.get("pyspark") or ""
        if not code:
            continue

        # Rule E: spark.stop() -- fatal
        if re.search(r"\bspark\.stop\(\)", code):
            violations.append({
                "notebook": name,
                "rule": "E",
                "description": "spark.stop() found -- terminates kernel and breaks pipeline orchestration.",
                "severity": "error",
            })

        # Rule C: Writing table directly to ABFSS path instead of managed saveAsTable
        if (
            re.search(r'\.write[^\n]*\.(?:save|csv|parquet|delta)\(\s*["\']abfss://', code)
            or re.search(r'CREATE\s+TABLE[^\n]+LOCATION\s+["\']abfss://', code, re.IGNORECASE)
        ):
            violations.append({
                "notebook": name,
                "rule": "C",
                "description": "Table written via ABFSS path -- must use .saveAsTable() for Fabric managed tables.",
                "severity": "error",
            })

        # Rule G: Multi-part or lakehouse-prefixed saveAsTable write target (Fabric requirement)
        bad_writes = re.findall(r'\.saveAsTable\(\s*["\']([^"\']+\.[^"\']+)["\']\s*\)', code)
        if bad_writes:
            for bad_target in bad_writes:
                violations.append({
                    "notebook": name,
                    "rule": "G",
                    "description": (
                        f"Multi-part write target '{bad_target}' in .saveAsTable() -- standard Fabric "
                        "lakehouses require a single-part table name (e.g. saveAsTable('orders')). "
                        "The notebook default lakehouse binding handles routing automatically."
                    ),
                    "severity": "error",
                })

        # Rule D: _ingest_ts mismatch -- Silver/Gold referencing wrong column name
        if layer in ("Silver", "Gold"):
            if re.search(r'["\']_ingest_ts["\']', code):
                violations.append({
                    "notebook": name,
                    "rule": "D",
                    "description": "Column '_ingest_ts' referenced but Bronze writes '_ingested_at'. Use '_ingested_at' for dedup window.",
                    "severity": "error",
                })

        # Rule A: Bronze cross-layer contamination (reading from silver/gold)
        if layer == "Bronze":
            if re.search(r'lh_\w+_silver|lh_\w+_gold', code, re.IGNORECASE):
                violations.append({
                    "notebook": name,
                    "rule": "A",
                    "description": "Bronze notebook reads from Silver or Gold lakehouse -- cross-layer contamination.",
                    "severity": "error",
                })

        # Rule A: Silver should NOT re-read staging source
        if layer == "Silver":
            if re.search(r'lh_\w+_stg|_stage_ai', code, re.IGNORECASE):
                violations.append({
                    "notebook": name,
                    "rule": "A",
                    "description": "Silver notebook reads from staging/source tables directly -- should read only from Bronze.",
                    "severity": "warning",
                })

        # Rule A: Gold should NOT re-read Bronze or staging
        if layer == "Gold":
            if re.search(r'lh_\w+_bronze|lh_\w+_stg|_stage_ai', code, re.IGNORECASE):
                violations.append({
                    "notebook": name,
                    "rule": "A",
                    "description": "Gold notebook reads from Bronze or staging tables -- should read only from Silver.",
                    "severity": "error",
                })

        # Rule F: F.window used as analytic (common mistake)
        if re.search(r"F\.window\.partitionBy|F\.window\(", code):
            violations.append({
                "notebook": name,
                "rule": "F",
                "description": "F.window used for analytics -- F.window is streaming-only. Use 'from pyspark.sql.window import Window' instead.",
                "severity": "error",
            })

    return violations


def run_auditor(
    prompt: str,
    plan: dict,
    target_model: str | None = None,
    effort: str = "medium",
    session_id: str | None = None,
) -> AuditResult:
    """Executes pre-flight compliance audit: static code check + LLM semantic validation."""
    start_t = time.perf_counter()
    start_utc = _now_utc_str()

    # Phase 1: Fast static audit (always runs -- no LLM cost)
    static_violations = _static_code_audit(plan)
    static_errors = [v for v in static_violations if v["severity"] == "error"]

    # Build the plan summary with code excerpts for LLM semantic audit
    plan_summary = {
        "folder": plan.get("folder"),
        "lakehouses": plan.get("lakehouses", []),
        "pipeline_name": plan.get("pipeline", {}).get("name") if plan.get("pipeline") else None,
        "schedule": str(plan.get("pipeline", {}).get("schedule", "")) if plan.get("pipeline") else None,
        "notebooks": [
            {
                "name": nb.get("name"),
                "layer": nb.get("layer"),
                "description": nb.get("description", ""),
                "code_excerpt": (nb.get("pyspark_code") or nb.get("pyspark") or "")[:600],
                "code_excerpt": (nb.get("pyspark_code") or nb.get("pyspark") or "")[:3500],
            }
            for nb in plan.get("notebooks", [])
        ],
    }

    msgs = [
        {"role": "system", "content": AUDITOR_SYSTEM},
        {
            "role": "user",
            "content": (
                f"User original request:\n{prompt}\n\n"
                f"Assembled plan:\n{json.dumps(plan_summary, indent=2)}\n\n"
                f"Static violations already detected:\n{json.dumps(static_violations, indent=2)}"
            ),
        },
    ]
    try:
        raw = chat(
            msgs,
            complexity="standard",
            max_tokens=2048,
            target_model=target_model,
            effort=effort,
            session_id=session_id,
        )
        parsed = extract_json(raw)
        end_t = time.perf_counter()
        if parsed:
            llm_violations = parsed.get("violations", [])
            all_violations = static_violations + [
                v for v in llm_violations
                if not any(
                    sv["notebook"] == v.get("notebook") and sv["rule"] == v.get("rule")
                    for sv in static_violations
                )
            ]
            all_errors = [v for v in all_violations if v.get("severity") == "error"]
            passed = len(all_errors) == 0 and bool(parsed.get("passed", True))

            chat_msg = parsed.get("chat_message", "Audit complete.")
            if all_errors:
                error_summary = "; ".join(
                    f"[{v['rule']}] {v['notebook']}: {v['description'][:80]}" for v in all_errors
                )
                chat_msg = f"Audit found {len(all_errors)} error(s): {error_summary}"

            return AuditResult(
                passed=passed,
                missing_items=parsed.get("missing_items", []),
                extra_items=parsed.get("extra_items", []),
                chat_message=chat_msg,
                started_at=start_utc,
                completed_at=_now_utc_str(),
                duration_sec=round(end_t - start_t, 2),
            )
    except Exception:
        pass

    # Fallback: static audit only
    end_t = time.perf_counter()
    nb_names = [nb.get("name", "") for nb in plan.get("notebooks", [])]
    missing = [n for n in re.findall(r"\b(nb_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE) if n not in nb_names]
    passed = len(missing) == 0 and len(static_errors) == 0
    chat_msg = "Audit passed." if passed else (
        f"Audit: {len(static_errors)} static error(s), {len(missing)} missing item(s). Auto-remediating..."
    )
    return AuditResult(
        passed=passed,
        missing_items=missing,
        chat_message=chat_msg,
        started_at=start_utc,
        completed_at=_now_utc_str(),
        duration_sec=round(end_t - start_t, 2),
    )
