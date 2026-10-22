"""
omniflow/server.py
------------------
Autonomous Multi-Agent Web Server & Execution Console for OmniFlow.
Dedicated, self-contained server with SSE streaming intermediate agent responses,
dynamic intake JSON formulation, database catalog queries, and code artifact inspection.
"""

from __future__ import annotations

import asyncio
import json
import os
import queue
import threading
from typing import Any

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, Field

from omniflow.agents.orchestrator import MultiAgentOrchestrator
from omniflow.agents.schemas import NaturalLanguagePlanRequest
from omniflow.config.llm_adapter import chat
from omniflow.db.postgres_repo import PostgresRepository
from omniflow.tools.fabric_deployer import verify_fabric_workspace_connection

app = FastAPI(
    title="OmniFlow Autonomous Data Studio",
    description="Standalone Multi-Agent Execution Console & Fabric Deployment Engine",
    version="2.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
WEB_DIR = os.path.join(BASE_DIR, "ui", "web")
INTAKE_DIR = os.path.join(BASE_DIR, "intake")
ARTIFACTS_DIR = os.path.join(BASE_DIR, "generated_artifacts")


class OrchestrateRequest(BaseModel):
    intake_json: dict[str, Any] | None = Field(default=None, description="Direct intake JSON object")
    template_name: str | None = Field(default=None, description="Intake template filename")
    project_code: str | None = Field(default=None, description="Override project code")
    project_name: str | None = Field(default=None, description="Override project name")
    prompt_text: str | None = Field(default=None, description="Custom NL instructions")
    resume: bool = Field(default=False, description="Reuse cached planning models")
    reset_synthesized_tools: bool = Field(default=True, description="Reset tool registry")


class ChatRequest(BaseModel):
    message: str = Field(..., description="User query about project, database, or Fabric assets")
    project_code: str | None = Field(default=None, description="Context project code")


@app.get("/")
async def serve_index() -> FileResponse:
    index_file = os.path.join(WEB_DIR, "index.html")
    if not os.path.exists(index_file):
        raise HTTPException(status_code=404, detail="OmniFlow Web UI not found.")
    return FileResponse(index_file)


@app.get("/api/status")
async def get_system_status() -> dict[str, Any]:
    fabric_status = verify_fabric_workspace_connection()
    repo = PostgresRepository()
    db_connected = False
    try:
        with repo._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1;")
                db_connected = True
    except Exception:
        db_connected = False

    return {
        "status": "online",
        "fabric": {
            "authenticated": fabric_status.get("authenticated", False),
            "workspace_id": fabric_status.get("workspace_id"),
            "workspace_name": fabric_status.get("workspace_name"),
            "target": "Microsoft Fabric Workspace Root (Zero Container)",
        },
        "database": {
            "connected": db_connected,
            "engine": "Neon PostgreSQL (Catalog & Memory Graph)",
        },
        "agents_roster": [
            {"name": "Architect Agent", "role": "Data Contracts & Schema Introspection"},
            {"name": "Modeler Agent", "role": "Medallion Star Schema & Direct Lake Modeling"},
            {"name": "Task Organizer", "role": "NetworkX Acyclic DAG Scheduling"},
            {"name": "Tool Synthesizer", "role": "Dynamic Zero-Shot Tool Synthesis"},
            {"name": "Fluid Executor", "role": "PySpark Delta & Spark SQL Generation"},
            {"name": "Quality Auditor", "role": "AST Validation & Great Expectations Gate"},
            {"name": "Fabric Deployer", "role": "Direct REST API Cloud Provisioning"},
        ],
    }


@app.get("/api/intake/templates")
async def get_intake_templates() -> list[dict[str, Any]]:
    templates: list[dict[str, Any]] = []
    if not os.path.exists(INTAKE_DIR):
        return templates

    for fname in os.listdir(INTAKE_DIR):
        if fname.endswith(".json"):
            fpath = os.path.join(INTAKE_DIR, fname)
            try:
                with open(fpath, "r", encoding="utf-8") as f:
                    data = json.load(f)
                p_sum = data.get("project_context", {}).get("project_summary", {})
                templates.append({
                    "filename": fname,
                    "project_name": p_sum.get("project_name", fname),
                    "project_code": p_sum.get("project_code", ""),
                    "domain": p_sum.get("business_domain", "Enterprise Analytics"),
                    "data": data,
                })
            except Exception:
                continue
    return templates


@app.post("/api/orchestrate")
async def run_orchestration(req: OrchestrateRequest) -> dict[str, Any]:
    intake_override = req.intake_json
    intake_file = None
    if not intake_override and req.template_name:
        intake_file = os.path.join(INTAKE_DIR, req.template_name)

    plan_req = None
    if req.prompt_text or req.project_code or req.project_name:
        plan_req = NaturalLanguagePlanRequest(
            project_code=req.project_code or "PRJ-DYNAMIC",
            project_name=req.project_name or "Dynamic Analytics Platform",
            prompt_text=req.prompt_text or "Deploy Microsoft Fabric Medallion Architecture",
            reset_synthesized_tools=req.reset_synthesized_tools,
        )

    orchestrator = MultiAgentOrchestrator()
    try:
        result = orchestrator.run_pipeline(
            req=plan_req,
            intake_file=intake_file,
            intake_data_override=intake_override,
            resume=req.resume,
        )
        return {"status": "success", "result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Orchestration failure: {str(e)}")


@app.get("/api/orchestrate/stream")
async def stream_orchestration(
    template_name: str | None = None,
    resume: bool = False,
    reset_tools: bool = True,
) -> StreamingResponse:
    event_q: queue.Queue[dict[str, Any] | None] = queue.Queue()

    def callback(event_type: str, data: dict[str, Any]) -> None:
        event_q.put({"event": event_type, "data": data})

    def worker() -> None:
        intake_file = os.path.join(INTAKE_DIR, template_name) if template_name else None
        try:
            orch = MultiAgentOrchestrator()
            res = orch.run_pipeline(
                intake_file=intake_file,
                resume=resume,
                event_callback=callback,
            )
            event_q.put({"event": "done", "data": {"status": "success", "run_id": res.get("run_id")}})
        except Exception as err:
            event_q.put({"event": "error", "data": {"error": str(err)}})
        finally:
            event_q.put(None)

    threading.Thread(target=worker, daemon=True).start()

    async def event_generator():
        while True:
            await asyncio.sleep(0.05)
            try:
                item = event_q.get_nowait()
            except queue.Empty:
                continue

            if item is None:
                break
            yield f"event: {item['event']}\ndata: {json.dumps(item['data'])}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")


@app.get("/api/artifacts")
async def list_artifacts(project_code: str | None = None) -> list[dict[str, Any]]:
    artifacts: list[dict[str, Any]] = []
    if not os.path.exists(ARTIFACTS_DIR):
        return artifacts

    target_dirs = [os.path.join(ARTIFACTS_DIR, project_code)] if project_code else [
        os.path.join(ARTIFACTS_DIR, d) for d in os.listdir(ARTIFACTS_DIR)
        if os.path.isdir(os.path.join(ARTIFACTS_DIR, d))
    ]

    for pdir in target_dirs:
        pcode = os.path.basename(pdir)
        if not os.path.exists(pdir):
            continue
        for fname in sorted(os.listdir(pdir)):
            fpath = os.path.join(pdir, fname)
            if os.path.isfile(fpath):
                ext = fname.split(".")[-1]
                mime = "python" if ext == "py" else ("sql" if ext == "sql" else "json")
                try:
                    with open(fpath, "r", encoding="utf-8") as f:
                        code = f.read()
                    artifacts.append({
                        "project_code": pcode,
                        "filename": fname,
                        "type": mime,
                        "size_bytes": os.path.getsize(fpath),
                        "content": code,
                    })
                except Exception:
                    continue
    return artifacts


@app.get("/api/database/records")
async def get_db_records() -> dict[str, Any]:
    repo = PostgresRepository()
    items: list[dict[str, Any]] = []
    projects: list[dict[str, Any]] = []
    try:
        with repo._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT item_name, item_type, status, workspace_id, created_at FROM fabric_items ORDER BY created_at DESC LIMIT 50;")
                for r in cur.fetchall():
                    items.append({
                        "item_name": r[0],
                        "item_type": r[1],
                        "status": r[2],
                        "workspace_id": str(r[3]) if r[3] else None,
                        "created_at": r[4].isoformat() if hasattr(r[4], "isoformat") else str(r[4]),
                    })
                cur.execute("SELECT project_code, project_name, status, created_at FROM projects ORDER BY created_at DESC LIMIT 20;")
                for r in cur.fetchall():
                    projects.append({
                        "project_code": r[0],
                        "project_name": r[1],
                        "status": r[2],
                        "created_at": r[3].isoformat() if hasattr(r[3], "isoformat") else str(r[3]),
                    })
    except Exception as e:
        return {"error": str(e), "items": [], "projects": []}
    return {"items": items, "projects": projects}


@app.post("/api/chat")
async def chat_with_intelligence(req: ChatRequest) -> dict[str, Any]:
    repo = PostgresRepository()
    db_ctx: list[str] = []
    try:
        with repo._connect() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT item_name, item_type, status, workspace_id FROM fabric_items ORDER BY created_at DESC LIMIT 15;")
                items = cur.fetchall()
                db_ctx.append("Active Fabric Items in Target Workspace:")
                for itm in items:
                    db_ctx.append(f"- {itm[0]} ({itm[1]}) | Status: {itm[2]} | Workspace: {itm[3]}")
                cur.execute("SELECT standard_name, rule_markdown FROM engineering_standards LIMIT 5;")
                rules = cur.fetchall()
                db_ctx.append("\nMedallion Engineering Standards:")
                for rl in rules:
                    db_ctx.append(f"- {rl[0]}: {rl[1]}")
    except Exception as e:
        db_ctx.append(f"DB context query notice: {e}")

    system_prompt = (
        "You are OmniFlow Intelligence, the autonomous Microsoft Fabric AI architect. "
        "Answer questions precisely and concisely about the deployed medallion assets, delta lake tables, "
        "star schemas, and data engineering standards based on the live PostgreSQL context below:\n"
        + "\n".join(db_ctx)
    )

    reply = chat([
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": req.message},
    ])
    return {"reply": reply, "sources_consulted": ["fabric_items", "engineering_standards"]}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8090"))
    print(f"\n[OmniFlow] Launching Standalone UI Console on http://127.0.0.1:{port}\n")
    uvicorn.run("omniflow.server:app", host="127.0.0.1", port=port, reload=True)
