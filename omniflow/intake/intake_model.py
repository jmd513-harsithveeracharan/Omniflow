from __future__ import annotations

from typing import Any
from pydantic import BaseModel, Field


class RequestContext(BaseModel):
    run_id: str | None = None
    project_id: str | None = None
    user_id: str | None = "harsith.bheesetti@pelibiothermal.com"
    request_type: str = "new_project_plan"
    user_request: str = ""
    priority: str = "normal"
    planning_mode: str = "create"


class ProjectSummary(BaseModel):
    project_name: str
    business_domain: str
    business_objective: str
    business_context: str


class PlatformSummary(BaseModel):
    target_platform: str = "Microsoft Fabric"
    target_environment: str = "DEV"
    capacity_sku: str = "F64"
    primary_language: str = "PySpark / T-SQL"
    containment_folder: str | None = None


class SolutionSummary(BaseModel):
    requirement: str
    expected_deliverables: list[str] = Field(default_factory=list)
    success_criteria: list[str] = Field(default_factory=list)


class ProjectContext(BaseModel):
    project_summary: ProjectSummary
    platform_summary: PlatformSummary
    solution_summary: SolutionSummary


class ColumnSpec(BaseModel):
    name: str
    data_type: str
    is_primary_key: bool = False
    is_pii: bool = False
    is_business_key: bool = False
    is_nullable: bool = True


class TableSpec(BaseModel):
    table_name: str
    description: str
    layer: str = "Bronze"
    primary_key: str
    watermark_column: str | None = None
    is_incremental: bool = False
    columns: list[ColumnSpec] = Field(default_factory=list)


class DataSourceSpec(BaseModel):
    source_name: str
    source_type: str
    system_name: str
    host: str
    database_name: str
    authentication_type: str = "Gateway_Kerberos"
    tables: list[TableSpec] = Field(default_factory=list)


class RetrievedContext(BaseModel):
    data_sources: list[DataSourceSpec] = Field(default_factory=list)
    project_constraints: list[str] = Field(default_factory=list)
    project_decisions: list[str] = Field(default_factory=list)
    applicable_standards: list[str] = Field(default_factory=list)


class GovernanceSummary(BaseModel):
    allowed_actions: list[str] = Field(default_factory=list)
    restricted_actions: list[str] = Field(default_factory=list)
    approval_triggers: list[str] = Field(default_factory=list)


class EnterpriseProjectIntake(BaseModel):
    """Unified enterprise intake format merging developer form data, DB catalog, and D&A business narrative."""

    schema_version: str = "1.0"
    planner_type: str = "project_micro_planner"
    request_context: RequestContext
    project_context: ProjectContext
    retrieved_context: RetrievedContext
    governance_summary: GovernanceSummary
    known_information_gaps: list[str] = Field(default_factory=list)

