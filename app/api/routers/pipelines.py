"""
app/api/routers/pipelines.py
----------------------------
FastAPI router for Medallion ingestion planning, Fabric deployment execution,
and Data Factory pipeline orchestration and scheduling.
"""

import uuid
from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.config import ALLOWED_WORKSPACE_ID
from app.deployment_executor import deploy_fabric_plan
from app.fabric_client import (
    create_pipeline_schedule,
    get_job_status,
    trigger_pipeline_run,
)
from app.ingestion_planner import generate_ingestion_plan
from connectors.connector_registry import get_connector

router = APIRouter(prefix="/api/pipeline", tags=["Pipelines & Ingestion"])

# Global run progress registry
_RUN_STORE: dict[str, dict[str, Any]] = {}


class IngestionPlanRequest(BaseModel):
    source_id: str = Field(..., description="Source connector slug")
    selected_tables: list[dict[str, Any]] = Field(..., description="Selected tables with column schemas")
    target_lakehouse_prefix: str = Field("lh_enterprise", description="Prefix for Lakehouses")
    schedule: str = Field("Daily 02:00 UTC", description="Ingestion schedule")
    workspace_id: str | None = None


class DeployPlanRequest(BaseModel):
    plan: dict[str, Any] = Field(..., description="Full structured ingestion plan")
    workspace_id: str | None = None
    session_id: str | None = None


class PipelineTriggerRequest(BaseModel):
    pipeline_id: str = Field(..., description="Fabric Pipeline Item GUID")
    workspace_id: str | None = None


class PipelineScheduleRequest(BaseModel):
    pipeline_id: str = Field(..., description="Target Fabric Pipeline Item GUID")
    time_str: str = Field("02:00", description="Execution time (HH:MM)")
    schedule_type: str = Field("Daily", description="Daily | Weekly | Hourly")
    workspace_id: str | None = None


@router.post("/plan", summary="Generate Medallion Ingestion Plan")
async def create_ingestion_plan(req: IngestionPlanRequest):
    """Analyzes source schemas and constructs Medallion Bronze/Silver/Gold plan with Delta MERGE strategies."""
    try:
        conn = get_connector(req.source_id)
        source_name = getattr(conn, "name", req.source_id) if conn else req.source_id
        plan = generate_ingestion_plan(
            source_id=req.source_id,
            source_name=source_name,
            database=req.target_lakehouse_prefix,
            selected_tables=req.selected_tables,
            schedule_prompt=req.schedule,
        )
        return {"status": "success", "plan": plan}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Plan generation failed: {str(e)}") from e



@router.post("/deploy", summary="Deploy Plan Items to Microsoft Fabric")
async def deploy_plan(req: DeployPlanRequest):
    """Deploys all granular items (lakehouses, notebooks, models, pipelines) to Microsoft Fabric."""
    wid = req.workspace_id or ALLOWED_WORKSPACE_ID
    run_id = req.plan.get("run_id") or f"run_{uuid.uuid4().hex[:10]}"

    try:
        report = deploy_fabric_plan(req.plan, workspace_id=wid, session_id=req.session_id)
        _RUN_STORE[report.run_id] = report.model_dump()
        return {
            "status": "success" if report.status in ("completed", "partial") else "failed",
            "run_id": report.run_id,
            "deployment_status": report.status,
            "duration_sec": report.duration_sec,
            "deployed_items": [i.model_dump() for i in report.deployed_items],
            "errors": report.errors,
        }
    except Exception as e:
        _RUN_STORE[run_id] = {
            "run_id": run_id,
            "status": "failed",
            "workspace_id": wid,
            "errors": [str(e)],
        }
        raise HTTPException(status_code=500, detail=f"Deployment failed: {str(e)}") from e


@router.get("/status/{run_id}", summary="Get Deployment Run Status")
async def get_run_status(run_id: str):
    """Checks the live progress of an active ingestion deployment run."""
    if run_id not in _RUN_STORE:
        raise HTTPException(status_code=404, detail=f"Run '{run_id}' not found.")
    return _RUN_STORE[run_id]


@router.post("/trigger", summary="Trigger Fabric Pipeline Run")
async def trigger_pipeline(req: PipelineTriggerRequest):
    """Triggers an asynchronous execution run of a Fabric Data Pipeline."""
    wid = req.workspace_id or ALLOWED_WORKSPACE_ID
    try:
        res = trigger_pipeline_run(req.pipeline_id, workspace_id=wid)
        return {"status": "triggered", "pipeline_id": req.pipeline_id, "run_details": res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Pipeline trigger failed: {str(e)}") from e


@router.get("/job/{pipeline_id}/{job_id}", summary="Check Pipeline Run Status")
async def check_pipeline_job(pipeline_id: str, job_id: str, workspace_id: str | None = None):
    """Polls the status of an ongoing Data Pipeline job."""
    wid = workspace_id or ALLOWED_WORKSPACE_ID
    try:
        status_res = get_job_status(pipeline_id, job_id, workspace_id=wid)
        return {"status": "success", "pipeline_id": pipeline_id, "job_id": job_id, "details": status_res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to query job status: {str(e)}") from e


@router.post("/schedule", summary="Configure Pipeline Schedule")
async def schedule_pipeline(req: PipelineScheduleRequest):
    """Schedules a daily or recurring pipeline trigger in Fabric Data Factory."""
    wid = req.workspace_id or ALLOWED_WORKSPACE_ID
    try:
        sched_res = create_pipeline_schedule(
            pipeline_id=req.pipeline_id,
            time_str=req.time_str,
            schedule_type=req.schedule_type,
            workspace_id=wid,
        )
        return {"status": "scheduled", "pipeline_id": req.pipeline_id, "schedule": sched_res}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to configure schedule: {str(e)}") from e


class InteractiveNotebookRunRequest(BaseModel):
    notebook_id: str = Field(..., description="Fabric notebook GUID or name")
    notebook_name: str = Field("notebook", description="Display name of notebook")
    workspace_id: str | None = Field(None, description="Target workspace ID")
    session_id: str | None = Field(None, description="Optional session UUID for progress telemetry")
    code: str | None = Field(None, description="Optional PySpark code override to execute")
    timeout_sec: int = Field(60, description="Interactive execution timeout in seconds")
    max_heal_retries: int = Field(1, description="Max self-healing retries upon cell error")
    max_allowed_duplicates: int = Field(0, description="Maximum allowed primary key duplicates")
    max_allowed_nulls: int = Field(0, description="Maximum allowed null values in required columns")


@router.post("/notebook/run-interactive", summary="Run Single Notebook Interactively")
async def run_notebook_interactive(req: InteractiveNotebookRunRequest) -> dict[str, Any]:
    """
    Executes a single PySpark notebook interactively with Data Quality gate checks and self-healing.
    """
    from app.engine.interactive_runner import run_single_notebook_interactive as exec_interactive
    wid = req.workspace_id or ALLOWED_WORKSPACE_ID
    try:
        res = exec_interactive(
            notebook_id=req.notebook_id,
            notebook_name=req.notebook_name,
            workspace_id=wid,
            session_id=req.session_id,
            timeout_sec=req.timeout_sec,
            current_code=req.code,
            max_heal_retries=req.max_heal_retries,
            max_allowed_duplicates=req.max_allowed_duplicates,
            max_allowed_nulls=req.max_allowed_nulls,
        )
        return res
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Interactive execution failed: {str(e)}") from e

