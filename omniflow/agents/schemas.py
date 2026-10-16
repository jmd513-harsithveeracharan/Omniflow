from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class NaturalLanguagePlanRequest(BaseModel):
    """Input payload containing a 50-100+ word natural language project plan."""

    project_code: str = Field(..., description="Unique project code, e.g. PRJ-FIN-HUB-01")
    project_name: str = Field(..., description="Human-readable project name")
    prompt_text: str = Field(
        ...,
        description="50 to 100+ word natural language architectural plan submitted via CLI or code",
    )
    requested_by: str = Field(default="harsith.bheesetti@omniflow.ai")
    reset_synthesized_tools: bool = Field(
        default=True,
        description="If true, removes previously synthesized tools before the run so Research Agent tool creation is demonstrated live.",
    )


class MacroPhase(BaseModel):
    """Pass 1 output from Planner Agent: high-level architectural phase."""

    phase_id: str
    phase_name: str
    layer: str
    objective: str
    estimated_mins: int


class PlannedStep(BaseModel):
    """Pass 2 output from Planner Agent: granular step refined from a macro phase."""

    step_code: str
    phase_id: str
    step_name: str
    task_type: str
    description: str
    depends_on_steps: list[str] = Field(default_factory=list)
    required_tool: str
    artifact_type: str
    target_artifact_name: str
    parameters: dict[str, Any] = Field(default_factory=dict)


class PlannerOutput(BaseModel):
    """Combined two-pass planning output from the Planner Agent."""

    project_code: str
    word_count: int
    detected_sources: list[str]
    detected_layers: list[str]
    applied_standards: list[str]
    macro_phases: list[MacroPhase]
    detailed_steps: list[PlannedStep]


class OrganizedTask(BaseModel):
    """A single topologically ordered task in the NetworkX DAG."""

    task_id: str = Field(..., description="PostgreSQL UUID for the task row")
    step_code: str
    sequence_no: int
    task_name: str
    task_type: str
    description: str
    dependency_step_codes: list[str] = Field(default_factory=list)
    dependency_task_ids: list[str] = Field(default_factory=list)
    required_tool: str
    artifact_type: str
    target_artifact_name: str
    parameters: dict[str, Any] = Field(default_factory=dict)


class OrganizerDAGOutput(BaseModel):
    """Output from the Task Organizer Agent after NetworkX DAG validation."""

    project_code: str
    is_acyclic: bool
    total_tasks: int
    execution_waves: list[list[str]]
    critical_path_steps: list[str]
    tasks: list[OrganizedTask]


class ToolCheckItem(BaseModel):
    """Status of a required tool for a specific DAG task."""

    step_code: str
    task_name: str
    required_tool: str
    is_available_in_db: bool
    is_available_in_runtime: bool
    tool_id: str | None = None
    status: str = Field(..., description="AVAILABLE | MISSING")
    reason: str


class ToolCheckerOutput(BaseModel):
    """Output from the Tool Checker Agent."""

    pass_number: int
    total_checked: int
    available_count: int
    missing_count: int
    all_tools_ready: bool
    missing_tools: list[str]
    items: list[ToolCheckItem]

class SynthesizedToolSpec(BaseModel):
    """Specification of a new tool dynamically created by the Research Agent."""

    tool_id: str
    tool_name: str
    display_name: str
    description: str
    endpoint: str
    input_schema: dict[str, Any]
    output_schema: dict[str, Any]
    python_file_path: str
    persisted_to_postgres: bool


class ResearchAgentOutput(BaseModel):
    """Output from the Research Agent after synthesizing missing tools."""

    researched_count: int
    synthesized_tools: list[SynthesizedToolSpec]


class ExecutedArtifactItem(BaseModel):
    """Record of an engineering artifact created by the Executor Agent."""

    artifact_id: str
    task_id: str
    step_code: str
    artifact_name: str
    artifact_type: str
    tool_used: str
    file_path: str
    definition_hash: str
    execution_time_ms: int
    status: str


class ExecutorAgentOutput(BaseModel):
    """Output from the Executor Agent after running all DAG tasks."""

    run_id: str
    executed_tasks_count: int
    artifacts_created: list[ExecutedArtifactItem]
    status: str
