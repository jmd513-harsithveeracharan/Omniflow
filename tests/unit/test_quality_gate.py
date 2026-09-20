"""
tests/unit/test_quality_gate.py
--------------------------------
Unit tests for Great Expectations style Data Quality Gate evaluation in Fabric AI Studio.
"""

from app.engine.data_quality import (
    build_quality_check_block,
    evaluate_quality_gate,
)


def test_build_quality_check_block_full():
    block = build_quality_check_block(
        table_name="orders",
        primary_keys=["order_id"],
        non_null_cols=["customer_id", "order_date"],
        value_ranges={"total_amount": (0, 1000000)},
        allowed_categories={"order_status": ["PLACED", "SHIPPED", "DELIVERED"]},
    )

    assert "pk_columns = ['order_id']" in block
    assert "dropDuplicates(subset=pk_columns)" in block
    assert "null_count_customer_id" in block
    assert "invalid_range_total_amount" in block
    assert "invalid_cat_order_status" in block
    assert "_quality_verified_at" in block


def test_evaluate_quality_gate_clean():
    clean_log = """
    # Running notebook Bronze to Silver
    [orders] Duplicate PK count: 0
    ✅ Data quality validation complete for orders. Final row count: 5420
    """
    res = evaluate_quality_gate(clean_log)
    assert res.passed is True
    assert res.duplicate_pk_count == 0
    assert res.total_violations == 0
    assert "Zero violations" in res.details


def test_evaluate_quality_gate_duplicate_pks_breach():
    log_text = """
    [orders] Duplicate PK count: 14
    ⚠️ Warning: 14 duplicate records detected in orders. Deduplicating on primary keys...
    ✅ Data quality validation complete for orders. Final row count: 5000
    """
    res = evaluate_quality_gate(log_text, max_allowed_duplicates=0)
    assert res.passed is False
    assert res.duplicate_pk_count == 14
    assert "14 duplicate primary key records" in res.details


def test_evaluate_quality_gate_allowed_threshold():
    log_text = """
    [orders] Duplicate PK count: 3
    ⚠️ Warning: 3 duplicate records detected in orders. Deduplicating on primary keys...
    ✅ Data quality validation complete for orders. Final row count: 5000
    """
    res = evaluate_quality_gate(log_text, max_allowed_duplicates=5)
    assert res.passed is True
    assert res.duplicate_pk_count == 3
    assert "satisfied" in res.details


def test_evaluate_quality_gate_nulls_and_range():
    log_text = """
    [customers] Duplicate PK count: 0
    ⚠️ Warning: 8 null values in required column customer_email
    ⚠️ Warning: 2 out-of-range rows in age (expected [18, 120])
    """
    res = evaluate_quality_gate(log_text, max_allowed_nulls=0)
    assert res.passed is False
    assert res.null_violations == {"customer_email": 8}
    assert res.range_violations == {"age": 2}
    assert res.total_violations == 10
    assert "customer_email" in res.details
    assert "age" in res.details


def test_evaluate_quality_gate_category_violations():
    log_text = """
    [transactions] Duplicate PK count: 0
    ⚠️ Warning: 5 rows with invalid category in currency
    """
    res = evaluate_quality_gate(log_text)
    assert res.passed is False
    assert res.category_violations == {"currency": 5}
    assert "currency" in res.details


def test_evaluate_quality_gate_empty_log():
    res = evaluate_quality_gate("")
    assert res.passed is True
    assert res.total_violations == 0


def test_execute_closed_loop_quality_gate_breach():
    from unittest.mock import patch
    from app.deployment_executor import DeploymentStepResult, DeploymentReport
    from app.engine.executor import execute_closed_loop

    plan = {
        "run_id": "exec_qg_001",
        "folder": "QualityTest",
        "lakehouses": ["lh_silver"],
        "notebooks": [{"name": "nb_silver", "pyspark": "df.saveAsTable('orders')"}],
    }

    dep_report = DeploymentReport(
        run_id="exec_qg_001",
        status="completed",
        folder_name="QualityTest",
        workspace_id="ws_qg",
        deployed_items=[
            DeploymentStepResult(step_id="s1", name="nb_silver", item_type="notebook", item_id="nb_123"),
        ],
    )

    with patch("app.engine.executor.deploy_fabric_plan", return_value=dep_report), \
         patch("app.engine.executor.run_notebook", return_value={"success": True, "job_id": "job_1"}), \
         patch("app.engine.executor._poll_job_completion", return_value={
             "success": True,
             "status": "Completed",
             "duration_sec": 3.0,
             "log": "[orders] Duplicate PK count: 25\n⚠️ Warning: 25 duplicate records detected",
         }), \
         patch("app.engine.executor.resolve_table_schema", return_value=[{"name": "order_id"}]):

        report = execute_closed_loop(plan, workspace_id="ws_qg")
        assert report.status == "quality_gate_failed"
        assert len(report.validation_results) > 0
        qg = next(v["quality_gate"] for v in report.validation_results if "quality_gate" in v)
        assert qg["passed"] is False
        assert qg["duplicate_pk_count"] == 25
        assert "Quality Gate Breached" in report.summary_markdown

