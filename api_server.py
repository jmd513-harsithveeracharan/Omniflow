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
import uuid
from datetime import UTC, datetime
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

# Core app imports
from app.config import ALLOWED_WORKSPACE_ID
from app.domain.workflow.router import router as workflow_router
from app.fabric_client import list_workspaces
from app.llm_router import chat
from app.session_store import (
    add_message,
    create_session,
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

# Mount Routers
app.include_router(workflow_router)



# ── Pydantic Schemas ─────────────────────────────────────────────────────────


class ChatRequest(BaseModel):
    message: str = Field(..., description="User prompt or instruction")
    session_id: str | None = Field(None, description="Active chat thread / session UUID")
    workspace_id: str | None = Field(None, description="Microsoft Fabric Workspace ID")
    model: str | None = Field(None, description="Target LLM model override")
    complexity: str = Field("standard", description="standard | high | compress")
    effort: str = Field("medium", description="Thinking effort: low | medium | high")
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


@app.get("/api/fabric/status", summary="Microsoft Fabric Connection Status")
async def get_fabric_status():
    """Checks Microsoft Fabric REST API authentication and workspace connectivity."""
    try:
        workspaces = list_workspaces()
        return {
            "authenticated": len(workspaces) > 0,
            "workspace_id": ALLOWED_WORKSPACE_ID,
            "target_folder": "AI_Test_Folder",
            "workspaces_count": len(workspaces),
            "message": "Fabric REST API connected." if workspaces else "Offline or zero workspaces found.",
        }
    except Exception as e:
        return {
            "authenticated": False,
            "workspace_id": ALLOWED_WORKSPACE_ID,
            "error": str(e),
            "message": "Running in offline/mock mode or credentials not yet configured.",
        }


@app.get("/api/sessions", summary="List Chat Threads")
async def get_sessions(workspace_id: str | None = None):
    """Returns all active conversation threads with titles, run counts, and message counts."""
    convs = list_conversations_with_metadata(workspace_id or ALLOWED_WORKSPACE_ID)
    return {"sessions": convs, "count": len(convs)}


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
    Executes a chat completion turn using native session resumption (--resume).
    Claude CLI maintains conversation memory on disk without requiring full transcript dumps.
    """
    sid = req.session_id or str(uuid.uuid4())
    wid = req.workspace_id or ALLOWED_WORKSPACE_ID

    # Ensure session exists in SQLite store
    session_data = get_session(sid)
    is_resuming = session_data is not None
    if not is_resuming:
        create_session(sid, wid, {"source": "fastapi_backend"})
    else:
        touch_session(sid)

    # Persist the incoming user message
    add_message(sid, "user", req.message)

    # Prepare message turn
    messages = [{"role": "user", "content": req.message}]

    try:
        # Call LLM router with native session resumption flag
        response_text = chat(
            messages=messages,
            complexity=req.complexity,
            target_model=req.model,
            effort=req.effort,
            session_id=sid,
            resume=is_resuming,
        )

        # Persist assistant response
        add_message(sid, "assistant", response_text)

        return {
            "session_id": sid,
            "response": response_text,
            "model_used": req.model or "auto-routed",
            "resumed_session": is_resuming,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM execution failed: {str(e)}") from e


@app.post("/api/chat/stream", summary="SSE Streaming Chat")
async def handle_chat_stream(req: ChatRequest):
    """
    Server-Sent Events (SSE) endpoint streaming live response tokens and stage progress.
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
        # Emit initial session metadata
        yield f"data: {json.dumps({'type': 'init', 'session_id': sid, 'resuming': is_resuming})}\n\n"

        try:
            # Run in worker thread to prevent blocking event loop
            loop = asyncio.get_event_loop()
            messages = [{"role": "user", "content": req.message}]
            response_text = await loop.run_in_executor(
                None,
                lambda: chat(
                    messages=messages,
                    complexity=req.complexity,
                    target_model=req.model,
                    effort=req.effort,
                    session_id=sid,
                    resume=is_resuming,
                ),
            )

            # Persist assistant turn
            add_message(sid, "assistant", response_text)

            # Stream chunks for smooth UI typing
            chunk_size = 32
            for i in range(0, len(response_text), chunk_size):
                chunk = response_text[i : i + chunk_size]
                yield f"data: {json.dumps({'type': 'chunk', 'text': chunk})}\n\n"
                await asyncio.sleep(0.01)

            yield f"data: {json.dumps({'type': 'done', 'session_id': sid})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'error': str(e)})}\n\n"

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


# ── Static File Serving (Legacy & Modern Frontends) ─────────────────────────
STATIC_DIR = os.path.dirname(os.path.abspath(__file__))


@app.get("/")
async def serve_index():
    index_path = os.path.join(STATIC_DIR, "index.html")
    if os.path.exists(index_path):
        return FileResponse(index_path)
    return {"message": "Fabric AI Studio API Online. Access /docs for Swagger UI."}


# Mount assets and static files if present
if os.path.exists(os.path.join(STATIC_DIR, "assets")):
    app.mount("/assets", StaticFiles(directory=os.path.join(STATIC_DIR, "assets")), name="assets")


@app.get("/{filename:path}")
async def serve_static_root_files(filename: str):
    file_path = os.path.join(STATIC_DIR, filename)
    if os.path.isfile(file_path):
        return FileResponse(file_path)
    raise HTTPException(status_code=404, detail="File not found")


if __name__ == "__main__":
    import uvicorn

    print("[API] Starting Fabric AI Studio FastAPI Server on http://127.0.0.1:8085")
    uvicorn.run("api_server:app", host="127.0.0.1", port=8085, reload=True)
