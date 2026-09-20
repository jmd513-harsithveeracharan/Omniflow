"""
tests/unit/test_schema_drift.py
-------------------------------
Unit tests for schema drift detection and Delta Lake evolution strategy selection.
"""

from app.engine.schema_drift import compute_schema_diff


def test_compute_schema_diff_no_drift():
    src = [{"name": "id", "type": "int"}, {"name": "name", "type": "string"}]
    tgt = [{"name": "id", "type": "int"}, {"name": "name", "type": "string"}]

    res = compute_schema_diff(src, tgt, "orders")
    assert res.has_drift is False
    assert res.is_backward_compatible is True
    assert res.evolution_strategy == "none"


def test_compute_schema_diff_added_column_merge_schema():
    src = [
        {"name": "id", "type": "int"},
        {"name": "name", "type": "string"},
        {"name": "loyalty_tier", "type": "string"},
    ]
    tgt = [{"name": "id", "type": "int"}, {"name": "name", "type": "string"}]

    res = compute_schema_diff(src, tgt, "customers")
    assert res.has_drift is True
    assert res.is_backward_compatible is True
    assert res.evolution_strategy == "merge_schema"
    assert len(res.added_columns) == 1
    assert res.added_columns[0]["name"] == "loyalty_tier"
    assert "mergeSchema" in res.pyspark_remediation_snippet


def test_compute_schema_diff_type_mismatch():
    src = [{"name": "id", "type": "string"}, {"name": "amount", "type": "double"}]
    tgt = [{"name": "id", "type": "int"}, {"name": "amount", "type": "double"}]

    res = compute_schema_diff(src, tgt, "transactions")
    assert res.has_drift is True
    assert res.is_backward_compatible is False
    assert res.evolution_strategy == "manual_intervention"
    assert len(res.type_mismatches) == 1
    assert "cast('int')" in res.pyspark_remediation_snippet
