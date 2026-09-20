"""
tests/unit/test_data_quality.py
-------------------------------
Unit tests for automated Delta Lake data quality contract generation.
"""

from app.engine.data_quality import build_quality_check_block


def test_build_quality_check_block():
    block = build_quality_check_block(
        table_name="orders",
        primary_keys=["order_id"],
        non_null_cols=["customer_id", "order_date"],
        value_ranges={"total_amount": (0, 1000000)},
    )

    assert "pk_columns = ['order_id']" in block
    assert "dropDuplicates(subset=pk_columns)" in block
    assert "null_count_customer_id" in block
    assert "invalid_range_total_amount" in block
    assert "_quality_verified_at" in block
