"""
app/domain/workflow/graph.py
----------------------------
Compiles the LangGraph StateGraph for the Fabric AI Agent.
Features cyclic self-healing and human-in-the-loop checkpoint gates.
"""

from typing import Literal

from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph

from app.domain.workflow.nodes import (
    code_generator_node,
    executor_node,
    guardrail_node,
    hydrate_context_node,
    intent_planner_node,
    response_formatter_node,
    self_healer_node,
)
from app.domain.workflow.state import AgentWorkflowState


def _route_guardrail(state: AgentWorkflowState) -> Literal["response_formatter", "code_generator"]:
    """Routes execution based on human approval requirement."""
    if state.get("requires_human_approval", False):
        return "response_formatter"
    return "code_generator"


def _route_executor(state: AgentWorkflowState) -> Literal["self_healer", "response_formatter"]:
    """Routes execution into cyclic self-healing loop on error."""
    error = state.get("error_trace")
    retries = state.get("retry_count", 0)
    max_retries = state.get("max_retries", 3)

    if error and retries < max_retries:
        return "self_healer"
    return "response_formatter"


def build_fabric_workflow_graph(checkpointer: MemorySaver | None = None) -> StateGraph:
    """
    Constructs and compiles the durable LangGraph StateGraph.
    """
    workflow = StateGraph(AgentWorkflowState)

    # 1. Register Nodes
    workflow.add_node("hydrate_context", hydrate_context_node)
    workflow.add_node("intent_planner", intent_planner_node)
    workflow.add_node("guardrail", guardrail_node)
    workflow.add_node("code_generator", code_generator_node)
    workflow.add_node("executor", executor_node)
    workflow.add_node("self_healer", self_healer_node)
    workflow.add_node("response_formatter", response_formatter_node)

    # 2. Add Edges
    workflow.set_entry_point("hydrate_context")
    workflow.add_edge("hydrate_context", "intent_planner")
    workflow.add_edge("intent_planner", "guardrail")

    # Conditional Branch 1: Destructive Safety Gate
    workflow.add_conditional_edges(
        "guardrail",
        _route_guardrail,
        {
            "response_formatter": "response_formatter",
            "code_generator": "code_generator",
        },
    )

    workflow.add_edge("code_generator", "executor")

    # Conditional Branch 2: Cyclic Self-Healing Loop
    workflow.add_conditional_edges(
        "executor",
        _route_executor,
        {
            "self_healer": "self_healer",
            "response_formatter": "response_formatter",
        },
    )

    # Self-healer loops back to executor
    workflow.add_edge("self_healer", "executor")
    workflow.add_edge("response_formatter", END)

    return workflow


def create_compiled_workflow(checkpointer: MemorySaver | None = None):
    """Factory creating compiled runnable graph with durable checkpointing."""
    if checkpointer is None:
        checkpointer = MemorySaver()
    graph = build_fabric_workflow_graph(checkpointer)
    return graph.compile(checkpointer=checkpointer)
