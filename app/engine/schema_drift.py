"""
app/engine/schema_drift.py
--------------------------
Schema Drift Detection & Delta Lake Evolution Engine for Fabric AI Studio.
Inspired by TobikoData/sqlmesh (core/schema_diff.py).
Computes structural column diffs between source feeds and target Delta tables,
providing automated schema evolution instructions.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any


@dataclass
class SchemaDiffResult:
    has_drift: bool
    is_backward_compatible: bool
    added_columns: list[dict[str, str]] = field(default_factory=list)
    removed_columns: list[dict[str, str]] = field(default_factory=list)
    type_mismatches: list[dict[str, Any]] = field(default_factory=list)
    evolution_strategy: str = "none"  # none | merge_schema | alter_table | manual_intervention
    pyspark_remediation_snippet: str = ""


def compute_schema_diff(
    source_schema: list[dict[str, str]],
    target_schema: list[dict[str, str]],
    target_table_name: str = "delta_table",
) -> SchemaDiffResult:
    """
    Compares source_schema vs target_schema where each schema is a list of
    {"name": str, "type": str}.
    """
    src_map = {col["name"].lower(): col.get("type", "string").lower() for col in source_schema}
    tgt_map = {col["name"].lower(): col.get("type", "string").lower() for col in target_schema}

    added = [{"name": name, "type": dtype} for name, dtype in src_map.items() if name not in tgt_map]
    removed = [{"name": name, "type": dtype} for name, dtype in tgt_map.items() if name not in src_map]
    mismatches = []

    for name, src_type in src_map.items():
        if name in tgt_map:
            tgt_type = tgt_map[name]
            if src_type != tgt_type:
                mismatches.append({"column": name, "source_type": src_type, "target_type": tgt_type})

    has_drift = len(added) > 0 or len(removed) > 0 or len(mismatches) > 0
    # Type mismatches and removed columns might not be backward compatible
    is_compatible = len(mismatches) == 0

    strategy = "none"
    remediation = ""

    if has_drift:
        if is_compatible and len(added) > 0:
            strategy = "merge_schema"
            remediation = (
                f"# Automated Schema Evolution for {target_table_name}\n"
                "df.write.format('delta') \\\n"
                "  .mode('append') \\\n"
                "  .option('mergeSchema', 'true') \\\n"
                f"  .saveAsTable('{target_table_name}')"
            )
        elif len(mismatches) > 0:
            strategy = "manual_intervention"
            remediation = (
                f"# Type mismatch detected for {target_table_name}. Cast columns explicitly:\n" +
                "\n".join([f"df = df.withColumn('{m['column']}', F.col('{m['column']}').cast('{m['target_type']}'))" for m in mismatches])
            )
        else:
            strategy = "alter_table"
            remediation = f"# Target {target_table_name} has removed upstream columns. Preserve existing schema or use overwrite."

    return SchemaDiffResult(
        has_drift=has_drift,
        is_backward_compatible=is_compatible,
        added_columns=added,
        removed_columns=removed,
        type_mismatches=mismatches,
        evolution_strategy=strategy,
        pyspark_remediation_snippet=remediation,
    )

