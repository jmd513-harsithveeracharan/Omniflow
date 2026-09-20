"""
tests/unit/test_multi_table_dag.py
----------------------------------
Unit tests for multi-entity / multi-table DAG planning and upstream schema propagation.
"""

from unittest.mock import MagicMock, patch
import pytest

from app.engine.meta_planner import heuristic_dag, run_meta_planner
from app.engine.models import PipelineState, PipelineStep, StepDAG, WorkerResult
from app.engine.worker_agents import _build_medallion_prompt, run_workers


def test_heuristic_dag_multi_entity_decomposition():
    prompt = "Create a Medallion Lakehouse architecture for customers, orders, and products."
    dag = heuristic_dag(prompt)

    step_names = [s.name for s in dag.steps]
    # Check that Bronze steps exist for all entities
    assert any("cust" in s and "bronze" in s for s in step_names)
    assert any("order" in s and "bronze" in s for s in step_names)
    assert any("product" in s and "bronze" in s for s in step_names)

    # Check that Silver steps exist for all entities
    assert any("cust" in s and "silver" in s for s in step_names)
    assert any("order" in s and "silver" in s for s in step_names)
    assert any("product" in s and "silver" in s for s in step_names)

    # Check that Gold Fact step exists
    gold_steps = [s for s in dag.steps if s.layer == "Gold" or "gold" in s.name]
    assert len(gold_steps) >= 1
    gold_step = gold_steps[0]
    # Gold step should depend on the silver notebook steps
    silver_step_ids = [s.step_id for s in dag.steps if s.type == "notebook" and s.layer == "Silver"]
    for s_id in silver_step_ids:
        assert s_id in gold_step.depends_on


def test_build_medallion_prompt_multi_upstream():
    step = PipelineStep(
        step_id="step_gold",
        name="nb_fact_orders_gold",
        type="notebook",
        layer="Gold",
        description="Join customers and orders into star schema fact table",
        depends_on=["step_silver_cust", "step_silver_orders"],
    )

    upstream_cust = WorkerResult(
        step_id="step_silver_cust",
        name="nb_cust_silver",
        layer="Silver",
        pyspark="cust_df.write.saveAsTable('customers')",
        lh_path="lh_sales_silver",
        delta_schema=["customer_id", "customer_name", "tier", "country"],
    )
    upstream_orders = WorkerResult(
        step_id="step_silver_orders",
        name="nb_orders_silver",
        layer="Silver",
        pyspark="orders_df.write.saveAsTable('orders')",
        lh_path="lh_sales_silver",
        delta_schema=["order_id", "customer_id", "order_date", "total_amount"],
    )

    prompt = _build_medallion_prompt(
        step=step,
        folder="Sales_Project",
        upstream=[upstream_cust, upstream_orders],
        prompt_context=None,
        schema_context="",
    )

    # Prompt must contain column information from BOTH upstream tables
    assert "customer_id" in prompt
    assert "customer_name" in prompt
    assert "order_id" in prompt
    assert "total_amount" in prompt
    assert "nb_cust_silver" in prompt
    assert "nb_orders_silver" in prompt


@patch("app.engine.worker_agents.chat")
def test_run_workers_multi_upstream_propagation(mock_chat):
    mock_chat.return_value = "bronze_df.write.format('delta').mode('overwrite').saveAsTable('orders')"

    step_cust_bronze = PipelineStep(
        step_id="step_cust_b",
        name="nb_cust_bronze",
        type="notebook",
        layer="Bronze",
        description="Ingest customers",
    )
    step_orders_bronze = PipelineStep(
        step_id="step_ord_b",
        name="nb_orders_bronze",
        type="notebook",
        layer="Bronze",
        description="Ingest orders",
    )
    step_gold = PipelineStep(
        step_id="step_gold",
        name="nb_fact_gold",
        type="notebook",
        layer="Gold",
        description="Build fact orders joining customers",
        depends_on=["step_cust_b", "step_ord_b"],
    )

    dag = StepDAG(
        context_mode="fast",
        folder="Test_Multi",
        steps=[step_cust_bronze, step_orders_bronze, step_gold],
        pipeline=None,
        summary="Test multi DAG",
        lakehouses=["lh_test_bronze", "lh_test_silver", "lh_test_gold"],
    )

    results = run_workers(dag)

    assert "step_cust_b" in results
    assert "step_ord_b" in results
    assert "step_gold" in results
    assert mock_chat.call_count == 3
