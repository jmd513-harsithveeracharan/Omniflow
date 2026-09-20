"""
tests/unit/test_warehouse_tsql.py
---------------------------------
Unit tests for Fabric Data Warehouse T-SQL generation and worker execution.
"""

from unittest.mock import MagicMock, patch
import pytest

from app.engine.models import PipelineStep, StepDAG, WorkerResult
from app.engine.worker_agents import execute_notebook_worker, run_workers


@patch("app.engine.worker_agents.chat")
def test_execute_warehouse_worker(mock_chat):
    mock_chat.return_value = """
-- CELL 1: DDL Table Creation
CREATE TABLE fact_sales (
    order_id INT NOT NULL,
    customer_id INT NOT NULL,
    order_date DATE NOT NULL,
    total_amount DECIMAL(18, 2) NOT NULL,
    CONSTRAINT PK_fact_sales PRIMARY KEY NONCLUSTERED (order_id) NOT ENFORCED
);
"""

    step = PipelineStep(
        step_id="step_wh_ddl",
        name="wh_sales_ddl",
        type="warehouse_script",
        layer="Warehouse",
        description="Create Fact and Dimension tables in Fabric Data Warehouse",
    )

    res = execute_notebook_worker(
        step=step,
        folder="Warehouse_Project",
        upstream=None,
        prompt_context="Enterprise sales warehouse with fact_sales",
        schema_context="Source columns: order_id, customer_id, total_amount",
    )

    assert res.step_id == "step_wh_ddl"
    assert "CREATE TABLE fact_sales" in res.pyspark  # Code field stores generated script
    assert res.error is None
    # Verify chat was called with warehouse system instructions
    called_msgs = mock_chat.call_args[0][0]
    assert any("T-SQL Data Warehouse" in m["content"] for m in called_msgs if m["role"] == "system")
