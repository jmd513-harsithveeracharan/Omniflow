"""
tests/unit/test_dependency_graph.py
-----------------------------------
Unit tests for Kahn's Algorithm topological dependency graph and safe unpublishing.
"""

import pytest
from app.engine.dependency_graph import (
    CyclicDependencyError,
    get_safe_unpublish_order,
    topological_sort_steps,
)
from app.engine.models import PipelineStep


def test_topological_sort_medallion_sequence():
    step_folder = PipelineStep(step_id="step_folder", type="folder", name="Sales", layer=None, description="Folder")
    step_b = PipelineStep(step_id="step_b", type="notebook", name="nb_bronze", layer="Bronze", description="Bronze", depends_on=["step_folder"])
    step_s = PipelineStep(step_id="step_s", type="notebook", name="nb_silver", layer="Silver", description="Silver", depends_on=["step_b"])
    step_g = PipelineStep(step_id="step_g", type="notebook", name="nb_gold", layer="Gold", description="Gold", depends_on=["step_s"])
    step_pl = PipelineStep(step_id="step_pl", type="pipeline", name="pl_daily", layer=None, description="Pipeline", depends_on=["step_b", "step_s", "step_g"])

    # Provide steps in scrambled order
    scrambled = [step_pl, step_g, step_folder, step_s, step_b]
    sorted_steps = topological_sort_steps(scrambled)

    sorted_ids = [s.step_id for s in sorted_steps]
    # step_folder must precede all
    assert sorted_ids.index("step_folder") < sorted_ids.index("step_b")
    assert sorted_ids.index("step_b") < sorted_ids.index("step_s")
    assert sorted_ids.index("step_s") < sorted_ids.index("step_g")
    assert sorted_ids.index("step_g") < sorted_ids.index("step_pl")


def test_topological_sort_cycle_detection():
    step_a = PipelineStep(step_id="step_a", type="notebook", name="nb_a", layer=None, description="A", depends_on=["step_b"])
    step_b = PipelineStep(step_id="step_b", type="notebook", name="nb_b", layer=None, description="B", depends_on=["step_a"])

    with pytest.raises(CyclicDependencyError):
        topological_sort_steps([step_a, step_b])


def test_get_safe_unpublish_order():
    items = [
        {"name": "AI_Test_Folder/Sales", "item_type": "folder"},
        {"name": "lh_sales_bronze", "item_type": "lakehouse"},
        {"name": "nb_orders_silver", "item_type": "notebook"},
        {"name": "pl_sales_etl", "item_type": "pipeline"},
    ]

    safe_order = get_safe_unpublish_order(items)
    order_types = [item["item_type"] for item in safe_order]

    # Pipeline must be deleted before notebooks, notebooks before lakehouses, lakehouses before folders
    assert order_types.index("pipeline") < order_types.index("notebook")
    assert order_types.index("notebook") < order_types.index("lakehouse")
    assert order_types.index("lakehouse") < order_types.index("folder")

