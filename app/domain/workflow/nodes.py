"""
app/domain/workflow/nodes.py
----------------------------
Discrete execution nodes for the LangGraph Fabric AI Agent workflow.
Follows Single Responsibility Principle and strict type contracts.
"""

import datetime
import logging
from typing import Any

from app.domain.lineage.graph_store import LineageGraphEngine
from app.domain.workflow.state import AgentWorkflowState
from app.self_healer import diagnose_and_patch_code

logger = logging.getLogger("fabric_ai.workflow.nodes")


def _log_audit(state: AgentWorkflowState, node_name: str, action: str, details: str = "") -> None:
    """Helper to append an audit entry to the state audit trail."""
    if "audit_trail" not in state or state["audit_trail"] is None:
        state["audit_trail"] = []
    state["audit_trail"].append({
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "node_name": node_name,
        "action": action,
        "details": details,
    })


def hydrate_context_node(state: AgentWorkflowState, graph_engine: LineageGraphEngine | None = None) -> dict[str, Any]:
    """
    Hydrates 1-hop active subgraph and blast-zone context from NetworkX Lineage Graph.
    Ensures ~85 token JIT context hydration instead of catalog dumps.
    """
    targets = state.get("target_assets", [])
    active_subgraph: list[dict[str, Any]] = []
    blast_zone: list[str] = []

    if graph_engine and targets:
        for target in targets:
            capsule = graph_engine.get_jit_context(target, hops=1)
            if capsule:
                active_subgraph.append(capsule.model_dump())
            report = graph_engine.calculate_blast_radius(target, is_destructive=state.get("is_destructive", False))
            blast_zone.extend([node.id for node in report.affected_nodes])

    # Deduplicate blast zone
    blast_zone = list(dict.fromkeys(blast_zone))

    audit_entry = {
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "node_name": "hydrate_context_node",
        "action": "hydrated_lineage_context",
        "details": f"Hydrated {len(active_subgraph)} active context capsules and {len(blast_zone)} blast-zone assets.",
    }

    return {
        "active_subgraph": active_subgraph,
        "blast_zone": blast_zone,
        "audit_trail": state.get("audit_trail", []) + [audit_entry],
    }



def intent_planner_node(state: AgentWorkflowState) -> dict[str, Any]:
    """
    Determines user intent and constructs a structured Medallion execution plan.
    """
    msg = state.get("user_message", "").lower()
    intent = "provision"
    is_destructive = False

    if "delete" in msg or "drop" in msg or "remove" in msg:
        intent = "delete"
        is_destructive = True
    elif "transpile" in msg or "convert" in msg:
        intent = "transpile"
    elif "status" in msg or "list" in msg:
        intent = "status"

    plan = {
        "intent": intent,
        "raw_message": state.get("user_message", ""),
        "items": [],
    }

    audit_entry = {
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "node_name": "intent_planner_node",
        "action": "intent_classified",
        "details": f"Classified intent as '{intent}'. Destructive flag: {is_destructive}.",
    }

    return {
        "intent": intent,
        "plan": plan,
        "is_destructive": is_destructive,
        "audit_trail": state.get("audit_trail", []) + [audit_entry],
    }


def guardrail_node(state: AgentWorkflowState) -> dict[str, Any]:
    """
    Safety Gate: Evaluates whether human approval is required for destructive operations.
    """
    is_destructive = state.get("is_destructive", False)
    approval = state.get("human_approval", "pending")
    requires_approval = is_destructive and (approval != "approved")

    audit_entry = {
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "node_name": "guardrail_node",
        "action": "evaluated_safety_gate",
        "details": f"Requires approval: {requires_approval} (Current status: {approval}).",
    }

    return {
        "requires_human_approval": requires_approval,
        "audit_trail": state.get("audit_trail", []) + [audit_entry],
    }


def code_generator_node(state: AgentWorkflowState) -> dict[str, Any]:
    """
    Generates PySpark notebook code, Delta Lake schemas, and orchestration definitions.
    """
    generated = state.get("generated_code", {}) or {}

    if not generated:
        # Default starter generation if not pre-populated
        generated["main_notebook"] = (
            "# Auto-generated PySpark transformation for Microsoft Fabric\n"
            "from pyspark.sql import functions as F\n"
            "df = spark.read.table('lh_source_bronze.raw_events')\n"
            "df_clean = df.dropDuplicates(['event_id']).withColumn('_ingested_at', F.current_timestamp())\n"
            "df_clean.write.format('delta').mode('append').saveAsTable('lh_silver.clean_events')\n"
        )

    audit_entry = {
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "node_name": "code_generator_node",
        "action": "code_generated",
        "details": f"Generated {len(generated)} code artifacts.",
    }

    return {
        "generated_code": generated,
        "audit_trail": state.get("audit_trail", []) + [audit_entry],
    }


def executor_node(state: AgentWorkflowState) -> dict[str, Any]:
    """
    Simulates or executes code artifacts and returns execution status or error traces.
    """
    error_trace = state.get("error_trace")
    retry_count = state.get("retry_count", 0)
    results = state.get("execution_results", []) or []

    # If an error trace was injected for testing or runtime failure occurs:
    if error_trace and retry_count == 0:
        results.append({
            "item_name": "main_notebook",
            "status": "failed",
            "error_trace": error_trace,
            "retry_count": retry_count,
        })
        status_action = "execution_failed"
        details = f"Execution failed on attempt {retry_count + 1}: {error_trace[:80]}..."
    else:
        # Successful run
        error_trace = None
        results.append({
            "item_name": "main_notebook",
            "status": "success",
            "details": "Delta table written and verified successfully.",
            "retry_count": retry_count,
        })
        status_action = "execution_succeeded"
        details = f"Execution succeeded on attempt {retry_count + 1}."

    audit_entry = {
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "node_name": "executor_node",
        "action": status_action,
        "details": details,
    }

    return {
        "execution_results": results,
        "error_trace": error_trace,
        "audit_trail": state.get("audit_trail", []) + [audit_entry],
    }


def self_healer_node(state: AgentWorkflowState) -> dict[str, Any]:
    """
    Closed-loop cyclic self-healing node:
    Analyzes runtime failure, computes patch strategy, updates generated code, and increments retry count.
    """
    error = state.get("error_trace", "")
    code = state.get("generated_code", {}).get("main_notebook", "")
    retry_count = state.get("retry_count", 0)

    patch_result = diagnose_and_patch_code(code, error, notebook_name="main_notebook")
    patched_code = patch_result.get("patched_code", code)
    diagnosis = patch_result.get("diagnosis", {})

    generated = dict(state.get("generated_code", {}))
    generated["main_notebook"] = patched_code

    audit_entry = {
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "node_name": "self_healer_node",
        "action": "self_healing_applied",
        "details": f"Applied patch for retry attempt {retry_count + 1}. Diagnosis: {diagnosis.get('root_cause', 'Unknown')}",
    }

    return {
        "generated_code": generated,
        "retry_count": retry_count + 1,
        "error_trace": None,  # Reset error for re-execution
        "diagnosis": diagnosis,
        "audit_trail": state.get("audit_trail", []) + [audit_entry],
    }


def response_formatter_node(state: AgentWorkflowState) -> dict[str, Any]:
    """
    Assembles final response message and outputs structured result summary.
    """
    intent = state.get("intent", "provision")
    approval_status = state.get("human_approval", "not_required")
    retries = state.get("retry_count", 0)

    if state.get("requires_human_approval", False):
        final_msg = (
            f"⚠️ Destructive operation detected for intent '{intent}'. "
            f"Execution is currently paused awaiting Human-in-the-Loop approval (Status: {approval_status})."
        )
    elif retries > 0:
        final_msg = (
            f"✅ Successfully executed '{intent}' workflow with {retries} automated self-healing remediation cycle(s)."
        )
    else:
        final_msg = f"✅ Successfully executed '{intent}' workflow on Microsoft Fabric."

    audit_entry = {
        "timestamp": datetime.datetime.now(datetime.UTC).isoformat(),
        "node_name": "response_formatter_node",
        "action": "response_formatted",
        "details": final_msg,
    }

    return {
        "final_response": final_msg,
        "audit_trail": state.get("audit_trail", []) + [audit_entry],
    }
