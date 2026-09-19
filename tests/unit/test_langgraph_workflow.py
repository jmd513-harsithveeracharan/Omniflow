"""
tests/test_langgraph_workflow.py
--------------------------------
Unit and integration tests for LangGraph state machine workflow.
Tests cyclic self-healing loops, JIT context hydration, and human-in-the-loop safety gates.
"""

from unittest.mock import patch

import pytest

from app.domain.lineage.graph_store import LineageGraphEngine
from app.domain.models.lineage import (
    AssetLayer,
    AssetType,
    DependencyType,
    LineageEdge,
    LineageNode,
)
from app.domain.workflow.graph import create_compiled_workflow
from app.domain.workflow.nodes import hydrate_context_node
from app.domain.workflow.state import AgentWorkflowState


@pytest.fixture
def sample_graph_engine():
    engine = LineageGraphEngine()
    engine.add_asset(LineageNode(
        id="lh_raw", name="lh_raw", layer=AssetLayer.BRONZE, asset_type=AssetType.LAKEHOUSE
    ))
    engine.add_asset(LineageNode(
        id="tbl_events", name="tbl_events", layer=AssetLayer.BRONZE, asset_type=AssetType.TABLE,
        schema_definition=[{"name": "event_id", "type": "string"}, {"name": "amount", "type": "double"}]
    ))
    engine.add_asset(LineageNode(
        id="nb_transform", name="nb_transform", layer=AssetLayer.SILVER, asset_type=AssetType.NOTEBOOK
    ))
    engine.add_asset(LineageNode(
        id="tbl_clean", name="tbl_clean", layer=AssetLayer.SILVER, asset_type=AssetType.TABLE
    ))
    engine.add_dependency(LineageEdge(
        source_id="lh_raw", target_id="tbl_events", relation_type=DependencyType.INGESTS
    ))
    engine.add_dependency(LineageEdge(
        source_id="tbl_events", target_id="nb_transform", relation_type=DependencyType.TRANSFORMS
    ))
    engine.add_dependency(LineageEdge(
        source_id="nb_transform", target_id="tbl_clean", relation_type=DependencyType.TRANSFORMS
    ))
    return engine


def test_jit_context_hydration_in_workflow(sample_graph_engine):
    """Verifies that hydrate_context_node extracts active context capsules and blast zone."""
    state: AgentWorkflowState = {
        "session_id": "test-session-0",
        "workspace_id": "ws-100",
        "user_message": "Modify schema of tbl_events",
        "target_assets": ["tbl_events"],
        "is_destructive": True,
    }

    result = hydrate_context_node(state, graph_engine=sample_graph_engine)
    assert len(result["active_subgraph"]) == 1
    assert result["active_subgraph"][0]["target_name"] == "tbl_events"
    assert "nb_transform" in result["blast_zone"]
    assert "tbl_clean" in result["blast_zone"]


def test_standard_workflow_execution():
    """Verifies standard pipeline flow from intent to generation and execution."""
    app = create_compiled_workflow()
    initial_state: AgentWorkflowState = {
        "session_id": "test-session-1",
        "workspace_id": "ws-100",
        "user_message": "Build a clean Silver table from raw events",
        "max_retries": 3,
    }

    config = {"configurable": {"thread_id": "test-session-1"}}
    final_state = app.invoke(initial_state, config=config)

    assert final_state["intent"] == "provision"
    assert not final_state.get("requires_human_approval", False)
    assert "main_notebook" in final_state["generated_code"]
    assert len(final_state["execution_results"]) > 0
    assert final_state["execution_results"][0]["status"] == "success"
    assert "Successfully executed" in final_state["final_response"]


def test_destructive_gate_requires_approval():
    """Verifies that destructive operations are caught by the safety gate."""
    app = create_compiled_workflow()
    initial_state: AgentWorkflowState = {
        "session_id": "test-session-2",
        "workspace_id": "ws-100",
        "user_message": "Delete folder and drop lakehouse tables",
        "human_approval": "pending",
        "max_retries": 3,
    }

    config = {"configurable": {"thread_id": "test-session-2"}}
    final_state = app.invoke(initial_state, config=config)

    assert final_state["intent"] == "delete"
    assert final_state["is_destructive"] is True
    assert final_state["requires_human_approval"] is True
    assert "awaiting Human-in-the-Loop approval" in final_state["final_response"]
    assert "main_notebook" not in final_state.get("generated_code", {})


def test_destructive_gate_proceeds_when_approved():
    """Verifies that destructive operations proceed once approved by human."""
    app = create_compiled_workflow()
    initial_state: AgentWorkflowState = {
        "session_id": "test-session-3",
        "workspace_id": "ws-100",
        "user_message": "Delete old test folder",
        "human_approval": "approved",
        "max_retries": 3,
    }

    config = {"configurable": {"thread_id": "test-session-3"}}
    final_state = app.invoke(initial_state, config=config)

    assert final_state["intent"] == "delete"
    assert final_state["is_destructive"] is True
    assert final_state["requires_human_approval"] is False
    assert "main_notebook" in final_state["generated_code"]
    assert "Successfully executed" in final_state["final_response"]


def test_cyclic_self_healing_recovery():
    """Verifies that runtime execution failures trigger closed-loop self-healing."""
    app = create_compiled_workflow()

    with patch("app.domain.workflow.nodes.diagnose_and_patch_code") as mock_heal:
        mock_heal.return_value = {
            "success": True,
            "patched_code": "# Patched Spark Code with Schema Fix\nspark.read.table('silver')",
            "diagnosis": {"root_cause": "Schema mismatch in column types", "fix_strategy": "Cast to string"},
        }

        initial_state: AgentWorkflowState = {
            "session_id": "test-session-4",
            "workspace_id": "ws-100",
            "user_message": "Run medallion aggregation job",
            "error_trace": "AnalysisException: Column `event_id` does not exist in schema",
            "retry_count": 0,
            "max_retries": 3,
        }

        config = {"configurable": {"thread_id": "test-session-4"}}
        final_state = app.invoke(initial_state, config=config)

        # Should have gone through self-healer node and retried
        assert final_state["retry_count"] == 1
        assert "Patched Spark Code" in final_state["generated_code"]["main_notebook"]
        assert len(final_state["execution_results"]) == 2
        assert final_state["execution_results"][0]["status"] == "failed"
        assert final_state["execution_results"][1]["status"] == "success"
        assert "with 1 automated self-healing remediation cycle(s)" in final_state["final_response"]
