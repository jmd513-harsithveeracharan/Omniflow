"""
app/engine/dependency_graph.py
------------------------------
Kahn's Algorithm Topological Dependency & Safe Unpublish Engine for Microsoft Fabric.
Directly implements the graph dependency resolution and safe deletion ordering from
microsoft/fabric-cicd (_manage_dependencies.py).
"""

from __future__ import annotations

from collections import defaultdict, deque
from typing import Any

from app.engine.models import PipelineStep


class CyclicDependencyError(Exception):
    """Raised when a circular dependency is detected in the pipeline steps."""
    pass


def topological_sort_steps(steps: list[PipelineStep]) -> list[PipelineStep]:
    """
    Performs a deterministic topological sort on pipeline steps using Kahn's algorithm.
    Guarantees parent steps (Folders, Bronze Lakehouses) are deployed before dependent children.
    """
    if not steps:
        return []

    step_map = {s.step_id: s for s in steps}
    graph = defaultdict(list)
    in_degree = defaultdict(int)

    # Initialize all step in-degrees to 0
    for sid in step_map:
        in_degree[sid] = 0

    # Populate graph edges & in-degrees
    for step in steps:
        for dep in step.depends_on:
            if dep in step_map:
                graph[dep].append(step.step_id)
                in_degree[step.step_id] += 1

    # Queue all nodes with 0 incoming dependencies
    queue = deque([sid for sid, deg in in_degree.items() if deg == 0])
    sorted_steps: list[PipelineStep] = []

    while queue:
        curr_id = queue.popleft()
        sorted_steps.append(step_map[curr_id])

        for neighbor in graph[curr_id]:
            in_degree[neighbor] -= 1
            if in_degree[neighbor] == 0:
                queue.append(neighbor)

    if len(sorted_steps) != len(steps):
        unresolved = [sid for sid, deg in in_degree.items() if deg > 0]
        raise CyclicDependencyError(f"Cyclic dependency detected among steps: {unresolved}")

    return sorted_steps


def get_safe_unpublish_order(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """
    Computes the inverted topological order for safe cascading deletion.
    Ensures downstream consumers (Pipelines, Gold Lakehouses) are deleted
    BEFORE upstream dependencies (Silver, Bronze, Folders) to avoid orphan locks.
    """
    if not items:
        return []

    # Priority type hierarchy for unpublishing (highest priority = delete first)
    unpublish_priority = {
        "pipeline": 0,
        "notebook": 1,
        "warehouse_script": 1,
        "lakehouse": 2,
        "warehouse": 2,
        "environment": 3,
        "folder": 4,
    }

    # Sort descending by dependency depth (or type priority)
    return sorted(
        items,
        key=lambda item: unpublish_priority.get(item.get("item_type", "").lower(), 1),
    )
