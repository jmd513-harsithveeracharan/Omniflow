"""
api_server.py
-------------
High-Performance FastAPI Backend Server for Fabric AI Studio.
Provides:
  - Session-aware chat endpoints with native Claude CLI resumption (--resume)
  - Server-Sent Events (SSE) token and stage streaming
  - Pydantic v2 validated request and response schemas
  - Interactive OpenAPI Swagger documentation at /docs
  - SQL transpiler, Fabric deployment, and workspace status routes
  - Static file hosting for legacy and modern UI frontends
"""

from __future__ import annotations

import asyncio
import json
import os
import time
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from app.api import (
    auth_router,
    connectors_router,
    governance_router,
    pipelines_router,
    skills_router,
    workflow_router,
    workspaces_router,
)
from app.config import ALLOWED_WORKSPACE_ID
from app.deployment_executor import deploy_fabric_plan
from app.fabric_client import list_workspaces
from app.llm_router import chat
from app.session_store import (
    add_message,
    create_project,
    create_session,
    get_all_projects,
    get_conversation_full,
    get_facts,
    get_session,
    init_db,
    list_conversations_with_metadata,
    touch_session,
)
from app.sql_transpiler import extract_sql_lineage, transpile_to_spark

# Initialize DB on server start
init_db()


app = FastAPI(
    title="Fabric AI Studio API",
    description="Enterprise Data Engineering & Fabric Orchestration Engine with Native Multi-Turn Sessioning",
    version="2.0.0",
)

# Enable CORS for local React/Vite development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount Modular Domain Routers
app.include_router(auth_router)
app.include_router(workflow_router)
app.include_router(skills_router)
app.include_router(connectors_router)
app.include_router(workspaces_router)
app.include_router(pipelines_router)
app.include_router(governance_router)




# ── Pydantic Schemas ─────────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    message: str = Field(..., description="User prompt or instruction")
    session_id: str | None = Field(None, description="Active chat thread / session UUID")
    workspace_id: str | None = Field(None, description="Microsoft Fabric Workspace ID")
    model: str | None = Field(None, description="Target LLM model override")
    complexity: str = Field("standard", description="standard | high | compress")
    effort: str = Field("medium", description="Thinking effort: low | medium | high")
    mode: str = Field("auto", description="Chat mode: auto | general | project")
    stream: bool = Field(False, description="Whether to stream response tokens via SSE")


class SessionInitRequest(BaseModel):
    session_id: str | None = Field(None, description="Custom session UUID if provided by client")
    workspace_id: str | None = Field(None, description="Fabric Workspace ID")
    metadata: dict[str, Any] | None = Field(default_factory=dict)


class TranspileRequest(BaseModel):
    sql: str = Field(..., description="Source SQL dialect code (T-SQL, Oracle, Snowflake, Postgres)")
    source_dialect: str = Field("tsql", description="Dialect: tsql | oracle | snowflake | postgres")
    target_dialect: str = Field("spark", description="Target dialect: spark")


class FabricDeployRequest(BaseModel):
    plan: dict[str, Any] = Field(..., description="Fabric execution plan with Medallion items")
    session_id: str | None = None
    workspace_id: str | None = None


# ── Endpoints ───────────────────────────────────────────────────────────────


@app.get("/api/health", summary="Health Check")
async def health_check():
    return {
        "status": "online",
        "service": "Fabric AI Studio API",
        "version": "2.0.0",
        "timestamp": datetime.now(UTC).isoformat(),
    }


# ── Fabric Status Cache ───────────────────────────────────────────────────────
_FABRIC_STATUS_CACHE: dict[str, Any] = {}
_FABRIC_STATUS_CACHE_TIME: float = 0.0


@app.get("/api/status", summary="System & Fabric Status Alias")
@app.get("/api/fabric/status", summary="Microsoft Fabric Connection Status")
async def get_fabric_status():
    """Checks Microsoft Fabric REST API authentication and workspace connectivity with background caching."""
    global _FABRIC_STATUS_CACHE, _FABRIC_STATUS_CACHE_TIME
    now = time.time()
    if _FABRIC_STATUS_CACHE and (now - _FABRIC_STATUS_CACHE_TIME < 60.0):
        return _FABRIC_STATUS_CACHE

    try:
        from app.auth import get_auth_status
        auth_info = get_auth_status()
        workspaces = await asyncio.to_thread(list_workspaces)
        res = {
            "authenticated": len(workspaces) > 0 or auth_info.get("authenticated", False),
            "workspace_id": ALLOWED_WORKSPACE_ID,
            "target_folder": "AI_Test_Folder",
            "workspaces_count": len(workspaces),
            "user_identity": auth_info.get("user_identity", "Bheesetti.Harsith@Pelibiothermal.com"),
            "user_identity": auth_info.get("user_identity") or "Not Connected",
            "auth_method": auth_info.get("auth_method", "azure_cli"),
            "tenant_id": auth_info.get("tenant_id", "None"),
            "expires_in_minutes": auth_info.get("expires_in_minutes", 0),
            "message": "Fabric REST API connected." if workspaces else "Offline or zero workspaces found.",
        }
        _FABRIC_STATUS_CACHE = res
        _FABRIC_STATUS_CACHE_TIME = now
        return res
    except Exception as e:
        from app.auth import get_auth_status
        auth_info = get_auth_status()
        return {
            "authenticated": auth_info.get("authenticated", False),
            "workspace_id": ALLOWED_WORKSPACE_ID,
            "target_folder": "AI_Test_Folder",
            "workspaces_count": 0,
            "user_identity": auth_info.get("user_identity", "Bheesetti.Harsith@Pelibiothermal.com"),
            "user_identity": auth_info.get("user_identity") or "Not Connected",
            "auth_method": auth_info.get("auth_method", "none"),
            "tenant_id": auth_info.get("tenant_id", "None"),
            "expires_in_minutes": 0,
            "error": str(e),
            "message": "Running in offline/mock mode or credentials not yet configured.",
        }


@app.get("/api/sessions", summary="List Chat Threads")
@app.get("/api/conversations", summary="List Chat Threads (Alias)")
def get_sessions(workspace_id: str | None = None):
    """Returns all active conversation threads with titles, run counts, and message counts."""
    convs = list_conversations_with_metadata(workspace_id or ALLOWED_WORKSPACE_ID)
    return {"sessions": convs, "conversations": convs, "count": len(convs)}


@app.get("/api/sessions/{session_id}", summary="Get Full Conversation Thread")
@app.get("/api/conversation/{session_id}", summary="Get Full Conversation Thread (Alias)")
def get_session_detail(session_id: str):
    """Returns full conversation bundle with messages, metadata, and learned facts."""
    bundle = get_conversation_full(session_id)
    if not bundle:
        raise HTTPException(status_code=404, detail="Conversation session not found")
    return bundle


class RenameSessionRequest(BaseModel):
    title: str = Field(..., description="New display title for conversation thread")


@app.delete("/api/sessions/{session_id}", summary="Delete Conversation Session")
@app.delete("/api/conversation/{session_id}", summary="Delete Conversation Session (Alias)")
def handle_delete_session(session_id: str):
    """Permanently deletes a chat conversation session and its message history."""
    from app.session_store import delete_conversation
    deleted = delete_conversation(session_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Conversation session not found or already deleted")
    return {"status": "success", "session_id": session_id, "deleted": True}


@app.patch("/api/sessions/{session_id}", summary="Rename Conversation Session")
@app.post("/api/sessions/{session_id}/rename", summary="Rename Conversation Session (POST Alias)")
@app.post("/api/conversation/{session_id}/rename", summary="Rename Conversation Session (Legacy Alias)")
def handle_rename_session(session_id: str, req: RenameSessionRequest):
    """Updates the title of a conversation thread."""
    from app.session_store import rename_conversation
    renamed = rename_conversation(session_id, req.title)
    if not renamed:
        raise HTTPException(status_code=404, detail="Conversation session not found")
    return {"status": "success", "session_id": session_id, "title": req.title}


@app.get("/api/projects", summary="List Active Projects")
def get_projects():
    """Returns all projects stored in the persistent database."""
    projects = get_all_projects()
    return {"projects": projects, "count": len(projects)}


class CreateProjectRequest(BaseModel):
    name: str = Field(..., description="Project name")
    description: str = Field("", description="Project description")
    metadata: dict[str, Any] | None = Field(default_factory=dict)


class UpdateProjectRequest(BaseModel):
    id: str = Field(..., description="Project UUID")
    name: str | None = None
    description: str | None = None
    is_pinned: int | None = None
    is_archived: int | None = None
    metadata: dict[str, Any] | None = None


class DeleteProjectRequest(BaseModel):
    id: str = Field(..., description="Project UUID")


@app.post("/api/projects/new", summary="Create New Project")
async def create_new_project_endpoint(req: CreateProjectRequest):
    from app.session_store import create_project
    proj = create_project(req.name, req.description, req.metadata)
    return {"status": "success", "success": True, "project": proj}


@app.post("/api/projects/update", summary="Update Project")
async def update_project_endpoint(req: UpdateProjectRequest):
    from app.session_store import update_project
    updated = update_project(req.id, req.name, req.description, req.is_pinned, req.is_archived)
    updated = update_project(req.id, req.name, req.description, req.is_pinned, req.is_archived, req.metadata)
    return {"status": "success", "success": updated, "id": req.id}


@app.post("/api/projects/delete", summary="Delete Project")
async def delete_project_post_endpoint(req: DeleteProjectRequest):
    from app.session_store import delete_project
    deleted = delete_project(req.id)
    return {"status": "success", "success": deleted, "id": req.id}


@app.delete("/api/projects/{project_id}", summary="Delete Project")
async def delete_project_delete_endpoint(project_id: str):
    from app.session_store import delete_project
    deleted = delete_project(project_id)
    return {"status": "success", "success": deleted, "id": project_id}


@app.post("/api/sessions/new", summary="Initialize New Session")
async def init_new_session(req: SessionInitRequest):
    """Creates a new persistent session paired with Claude CLI / provider sessions."""
    sid = req.session_id or str(uuid.uuid4())
    wid = req.workspace_id or ALLOWED_WORKSPACE_ID
    create_session(sid, wid, req.metadata or {})
    return {"session_id": sid, "workspace_id": wid, "created_at": datetime.now(UTC).isoformat()}


@app.post("/api/chat", summary="Session-Aware Chat Completion")
async def handle_chat(req: ChatRequest):
    """
    Executes a chat completion turn using the grounded Fabric AI Studio engine
    and 4-stage LangGraph multi-agent architecture synthesis.
    """
    sid = req.session_id or str(uuid.uuid4())
    wid = req.workspace_id or ALLOWED_WORKSPACE_ID

    session_data = get_session(sid)
    is_resuming = session_data is not None
    if not is_resuming:
        create_session(sid, wid, {"source": "fastapi_backend"})
    else:
        touch_session(sid)

    add_message(sid, "user", req.message)

    try:
        from app.chat_service import process_chat_turn
        response_text, plan = process_chat_turn(
            prompt=req.message,
            session_id=sid,
            is_resuming=is_resuming,
            target_model=req.model,
            complexity=req.complexity,
            effort=req.effort,
            mode=req.mode,
        )

        add_message(sid, "assistant", response_text)

        return {
            "session_id": sid,
            "response": response_text,
            "plan": plan,
            "model_used": req.model or "auto-routed",
            "resumed_session": is_resuming,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM execution failed: {str(e)}") from e


@app.post("/api/chat/stream", summary="SSE Streaming Chat")
async def handle_chat_stream(req: ChatRequest):
    """
    Server-Sent Events (SSE) endpoint streaming live response tokens, stage progress, and plan.
    """
    sid = req.session_id or str(uuid.uuid4())
    wid = req.workspace_id or ALLOWED_WORKSPACE_ID

    session_data = get_session(sid)
    is_resuming = session_data is not None
    if not is_resuming:
        create_session(sid, wid)
    else:
        touch_session(sid)

    add_message(sid, "user", req.message)

    async def event_generator():
        yield f"data: {json.dumps({'type': 'init', 'session_id': sid, 'resuming': is_resuming})}\n\n"

        queue: asyncio.Queue[tuple[str, str, Any] | None] = asyncio.Queue()
        loop = asyncio.get_running_loop()

        def producer():
            try:
                from app.chat_service import process_chat_turn_stream
                for item in process_chat_turn_stream(
                    prompt=req.message,
                    session_id=sid,
                    is_resuming=is_resuming,
                    target_model=req.model,
                    complexity=req.complexity,
                    effort=req.effort,
                    mode=req.mode,
                ):
                    loop.call_soon_threadsafe(queue.put_nowait, item)
            except Exception as ex:
                loop.call_soon_threadsafe(queue.put_nowait, ("error", str(ex), None))
            finally:
                loop.call_soon_threadsafe(queue.put_nowait, None)

        loop.run_in_executor(None, producer)

        full_response_text = ""
        while True:
            item = await queue.get()
            if item is None:
                break
            ev_type, text_payload, plan_payload = item
            if ev_type == "thought_step":
                step_obj = json.loads(text_payload) if isinstance(text_payload, str) else text_payload
                yield f"data: {json.dumps({'type': 'thought_step', 'step': step_obj})}\n\n"
            elif ev_type == "stage":
                yield f"data: {json.dumps({'type': 'stage', 'text': text_payload})}\n\n"
            elif ev_type == "chunk":
                full_response_text += text_payload
                yield f"data: {json.dumps({'type': 'chunk', 'text': text_payload})}\n\n"
            elif ev_type == "done":
                final_text = text_payload or full_response_text
                add_message(sid, "assistant", final_text)
                yield f"data: {json.dumps({'type': 'done', 'session_id': sid, 'plan': plan_payload})}\n\n"
            elif ev_type == "error":
                yield f"data: {json.dumps({'type': 'error', 'error': text_payload})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.post("/api/transpile", summary="SQL AST Transpiler & Lineage")
async def transpile_sql(req: TranspileRequest):
    """Transpiles source SQL dialect into native Spark SQL and extracts column lineage."""
    try:
        spark_sql = transpile_to_spark(req.sql, from_dialect=req.source_dialect)
        lineage = extract_sql_lineage(req.sql, dialect=req.source_dialect)
        return {
            "status": "success",
            "source_dialect": req.source_dialect,
            "target_dialect": req.target_dialect,
            "spark_sql": spark_sql,
            "lineage": lineage,
        }
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Transpilation failed: {str(e)}") from e


@app.get("/api/memory/facts/{session_id}", summary="Learned Fact Capsule")
async def get_session_facts_endpoint(session_id: str):
    """Returns key preferences and facts stored in the session's fact capsule."""
    facts = get_facts(session_id)
    return {"session_id": session_id, "facts": facts}


# ── Token Tracking & Auditing ──────────────────────────────────────────────────

@app.get("/api/tokens/audit", summary="Token Usage & Cost Audit")
async def get_token_audit_endpoint(session_id: str | None = None):
    """Returns aggregated token usage, cost estimations, and provider/model granularity breakdown."""
    from app.token_tracker import get_token_audit_summary
    summary = get_token_audit_summary(session_id=session_id)
    return summary.model_dump()


@app.get("/api/tokens/history", summary="Recent Token Usage Call Logs")
async def get_token_history_endpoint(limit: int = 50, session_id: str | None = None):
    """Returns chronologically recent token call logs for auditing."""
    from app.token_tracker import get_recent_token_history
    history = get_recent_token_history(limit=limit, session_id=session_id)
    return {"history": [h.model_dump() for h in history], "count": len(history)}


@app.post("/api/fabric/deploy", summary="Deploy Architecture Plan to Microsoft Fabric")
@app.post("/api/deploy", summary="Deploy Architecture Plan to Microsoft Fabric (Alias)")
async def handle_fabric_deploy(req: FabricDeployRequest):
    """Executes full multi-tier architecture plan to Microsoft Fabric with cyclic self-healing."""
    wid = req.workspace_id or ALLOWED_WORKSPACE_ID
    try:
        report = deploy_fabric_plan(req.plan, workspace_id=wid, session_id=req.session_id)
        return {
            "status": "success" if report.status in ("completed", "partial") else "failed",
            "run_id": report.run_id,
            "deployment_status": report.status,
            "duration_sec": report.duration_sec,
            "deployed_items": [i.model_dump() for i in report.deployed_items],
            "errors": report.errors,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Fabric deployment failed: {str(e)}") from e


# ── Static File Serving (Studio UI & Assets) ──────────────────────────────────
STATIC_ROOT = os.path.dirname(os.path.abspath(__file__))
FRONTEND_DIST = os.path.join(STATIC_ROOT, "frontend", "dist")

if os.path.exists(os.path.join(FRONTEND_DIST, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(FRONTEND_DIST, "assets")), name="react_assets")
elif os.path.exists(os.path.join(STATIC_ROOT, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_ROOT, "assets")), name="assets")


@app.get("/")
async def serve_index():
    if os.path.exists(os.path.join(FRONTEND_DIST, "index.html")):
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
    index_path = os.path.join(STATIC_ROOT, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Fabric AI Studio API Online. Access /docs for Swagger UI."}


@app.get("/{filename:path}")
async def serve_static_root_files(filename: str):
    if filename.startswith("api/"):
        raise HTTPException(status_code=404, detail=f"API endpoint '/{filename}' not found")

    dist_file = os.path.join(FRONTEND_DIST, filename)
    if os.path.isfile(dist_file):
        return FileResponse(dist_file)

    file_path = os.path.join(STATIC_ROOT, filename)
    if os.path.isfile(file_path):
        return FileResponse(file_path)

    if os.path.exists(os.path.join(FRONTEND_DIST, "index.html")):
        return FileResponse(os.path.join(FRONTEND_DIST, "index.html"))
    index_path = os.path.join(STATIC_ROOT, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    raise HTTPException(status_code=404, detail="File not found")


if __name__ == "__main__":
    import uvicorn

    print("[API] Starting Fabric AI Studio FastAPI Server on http://127.0.0.1:8085")
    uvicorn.run("api_server:app", host="127.0.0.1", port=8085, reload=True)
