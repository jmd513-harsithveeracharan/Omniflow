"""
app/engine/data_quality.py
--------------------------
Delta Lake Data Quality & Contract Generator for Fabric AI Studio.
Inspired by TobikoData/sqlmesh (core/audit), Great Expectations, and Soda Core.
Generates automated primary key uniqueness checks, null-value guards,
range assertions, and evaluates Spark execution logs against quality gates.
"""

from __future__ import annotations

import re
from typing import Any
from pydantic import BaseModel, Field


class QualityGateResult(BaseModel):
    """Structured result of a Great Expectations style data quality audit."""
    passed: bool = True
    duplicate_pk_count: int = 0
    null_violations: dict[str, int] = Field(default_factory=dict)
    range_violations: dict[str, int] = Field(default_factory=dict)
    category_violations: dict[str, int] = Field(default_factory=dict)
    total_violations: int = 0
    details: str = ""


def build_quality_check_block(
    table_name: str,
    primary_keys: list[str],
    non_null_cols: list[str] | None = None,
    value_ranges: dict[str, tuple[float | int, float | int]] | None = None,
    allowed_categories: dict[str, list[str]] | None = None,
) -> str:
    """
    Generates an automated, production-grade PySpark data quality auditing block.
    Checks:
    1. Primary key uniqueness (duplicate count).
    2. Non-null column integrity.
    3. Value range assertions (e.g. amount >= 0).
    4. Categorical set membership assertions.
    5. Projections of _quality_verified_at audit timestamps.
    """
    pk_str = ", ".join(f"'{k}'" for k in primary_keys)
    non_null_cols = non_null_cols or []
    value_ranges = value_ranges or {}
    allowed_categories = allowed_categories or {}

    lines = [
        f"# --- CELL: Automated Data Quality Contract ({table_name}) ---",
        "from pyspark.sql import functions as F",
        "",
        "# 1. Primary Key Uniqueness Check",
        f"pk_columns = [{pk_str}]",
        "if pk_columns:",
        "    dup_count = df.groupBy(pk_columns).count().filter('count > 1').count()",
        f"    print(f'[{table_name}] Duplicate PK count: {{dup_count}}')",
        "    if dup_count > 0:",
        f"        print(f'⚠️ Warning: {{dup_count}} duplicate records detected in {table_name}. Deduplicating on primary keys...')",
        "        df = df.dropDuplicates(subset=pk_columns)",
        "",
        "# 2. Non-Null Integrity Validation",
    ]

    for col in non_null_cols:
        lines.extend([
            f"null_count_{col} = df.filter(F.col('{col}').isNull()).count()",
            f"if null_count_{col} > 0:",
            f"    print(f'⚠️ Warning: {{null_count_{col}}} null values in required column {col}')",
        ])

    if value_ranges:
        lines.append("\n# 3. Domain Range & Sanity Rules")
        for col, (min_v, max_v) in value_ranges.items():
            lines.extend([
                f"invalid_range_{col} = df.filter((F.col('{col}') < {min_v}) | (F.col('{col}') > {max_v})).count()",
                f"if invalid_range_{col} > 0:",
                f"    print(f'⚠️ Warning: {{invalid_range_{col}}} out-of-range rows in {col} (expected [{min_v}, {max_v}])')",
            ])

    if allowed_categories:
        lines.append("\n# 4. Categorical Set Membership Rules")
        for col, allowed in allowed_categories.items():
            allowed_repr = repr(allowed)
            lines.extend([
                f"invalid_cat_{col} = df.filter(~F.col('{col}').isin({allowed_repr})).count()",
                f"if invalid_cat_{col} > 0:",
                f"    print(f'⚠️ Warning: {{invalid_cat_{col}}} rows with invalid category in {col}')",
            ])

    lines.extend([
        "",
        "# 5. Audit Metadata Tagging",
        "df = df.withColumn('_quality_verified_at', F.current_timestamp())",
        f"print(f'✅ Data quality validation complete for {table_name}. Final row count: {{df.count()}}')",
    ])

    return "\n".join(lines)


def evaluate_quality_gate(
    log_text: str,
    max_allowed_duplicates: int = 0,
    max_allowed_nulls: int = 0,
) -> QualityGateResult:
    """
    Parses PySpark execution logs to extract Data Quality assertion metrics.
    Enforces quality thresholds before promoting datasets from Silver to Gold.
    """
    if not log_text:
        return QualityGateResult(passed=True, details="No execution logs provided; quality gate skipped.")

    # 1. Parse Duplicate PKs
    pk_matches = re.findall(r'(?:\[.*?\]\s*)?Duplicate PK count:\s*(\d+)', log_text)
    if not pk_matches:
        pk_matches = re.findall(r'Warning:\s*(\d+)\s*duplicate records detected', log_text)
    duplicate_count = sum(int(m) for m in pk_matches)

    # 2. Parse Null Values
    null_matches = re.findall(r'Warning:\s*(\d+)\s*null values in required column\s+([a-zA-Z0-9_]+)', log_text)
    null_violations: dict[str, int] = {}
    for count_str, col in null_matches:
        null_violations[col] = null_violations.get(col, 0) + int(count_str)

    # 3. Parse Out-of-Range Rows
    range_matches = re.findall(r'Warning:\s*(\d+)\s*out-of-range rows in\s+([a-zA-Z0-9_]+)', log_text)
    range_violations: dict[str, int] = {}
    for count_str, col in range_matches:
        range_violations[col] = range_violations.get(col, 0) + int(count_str)

    # 4. Parse Invalid Categorical Rows
    cat_matches = re.findall(r'Warning:\s*(\d+)\s*rows with invalid category in\s+([a-zA-Z0-9_]+)', log_text)
    category_violations: dict[str, int] = {}
    for count_str, col in cat_matches:
        category_violations[col] = category_violations.get(col, 0) + int(count_str)

    total_violations = (
        duplicate_count
        + sum(null_violations.values())
        + sum(range_violations.values())
        + sum(category_violations.values())
    )

    reasons: list[str] = []
    if duplicate_count > max_allowed_duplicates:
        reasons.append(f"{duplicate_count} duplicate primary key records (max allowed: {max_allowed_duplicates})")
    for col, cnt in null_violations.items():
        if cnt > max_allowed_nulls:
            reasons.append(f"{cnt} null values in required column '{col}' (max allowed: {max_allowed_nulls})")
    for col, cnt in range_violations.items():
        if cnt > 0:
            reasons.append(f"{cnt} out-of-range values in column '{col}'")
    for col, cnt in category_violations.items():
        if cnt > 0:
            reasons.append(f"{cnt} invalid category values in column '{col}'")

    passed = len(reasons) == 0

    if passed:
        details = (
            f"✅ Quality Gate Passed: All assertions satisfied (total warnings handled: {total_violations})."
            if total_violations > 0
            else "✅ Quality Gate Passed: Zero violations detected across all checks."
        )
    else:
        details = f"❌ Quality Gate Breached: {'; '.join(reasons)}"

    return QualityGateResult(
        passed=passed,
        duplicate_pk_count=duplicate_count,
        null_violations=null_violations,
        range_violations=range_violations,
        category_violations=category_violations,
        total_violations=total_violations,
        details=details,
    )
