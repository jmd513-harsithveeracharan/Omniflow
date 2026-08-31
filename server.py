"""
server.py — Fabric AI Studio Backend (Refactored)
---------------------------------------------------
Slim HTTP router — all business logic delegated to app/ modules.

Routes:
  Static files         GET  /
  Connectors           GET  /api/connectors
  Source Discovery     POST /api/connector/discover
  Table Schema         POST /api/connector/schema
  Workspaces           GET  /api/workspaces
  Workspace Items      GET  /api/workspace/items
  Workspace Refresh    GET  /api/workspace/refresh       [MEMORY]
  Session Summary      GET  /api/session/summary         [MEMORY]
  Ingestion Plan       POST /api/ingestion/plan
  Ingestion Deploy     POST /api/ingestion/deploy
  Run Status           GET  /api/ingestion/status/<run_id>
  Pipeline Trigger     POST /api/pipeline/trigger
  Pipeline Status      GET  /api/pipeline/status/<id>
  Safe Item Delete     POST /api/item/delete
  Architect Execute    POST /api/agent/execute
"""

import sys
import os
import json
import time
import threading
from datetime import datetime, timezone
import http.server
import socketserver
import urllib.parse

# Ensure standard streams handle UTF-8 cleanly on Windows
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
        sys.stderr.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

# ── App modules ───────────────────────────────────────────────────────────────
from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME, LLM_MODELS
from app.fabric_client import (
    list_workspaces,
    list_workspace_items,
    get_workspace_tree,
    get_or_create_folder,
    create_item,
    move_item,
    update_definition,
    trigger_pipeline_run,
    get_job_status,
)
from app.fabric_compiler import (
    compile_lakehouse,
    compile_notebook,
    compile_notebook_update,
    compile_pipeline,
    compile_environment,
)
from app.ingestion_planner import generate_ingestion_plan
from app.execution_monitor import start_monitoring_thread
from app.impact_analyzer import analyze_impact, safe_delete
from app.memory import MemoryManager
from app.workspace_cache import get_cached, refresh_cache, invalidate
from connectors.connector_registry import get_connector, list_connectors

# LLM Availability check from app.config
from app.config import GEMINI_KEY, ANTHROPIC_KEY, OPENAI_KEY, GROQ_KEYS
_LLM_AVAILABLE = bool(GEMINI_KEY or ANTHROPIC_KEY or OPENAI_KEY or GROQ_KEYS)

PORT = 8085
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# In-memory run tracker (also persisted to SQLite via session_store)
_RUNS: dict = {}
_RUNS_LOCK = threading.Lock()


# ── Session Utilities ─────────────────────────────────────────────────────────

def _get_session_id(handler) -> str:
    """Extracts session ID from request header, or generates a new one."""
    return handler.headers.get("X-Session-Id") or ""


def _add_session_header(handler, session_id: str):
    """Adds X-Session-Id to response so client can continue the session."""
    handler.send_header("X-Session-Id", session_id)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _json_response(handler, data: dict, status: int = 200, session_id: str | None = None):
    body = json.dumps(data, ensure_ascii=False).encode("utf-8")
    handler.send_response(status)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(body)))
    handler.send_header("Access-Control-Allow-Origin", "*")
    handler.send_header("Access-Control-Expose-Headers", "X-Session-Id")
    if session_id:
        handler.send_header("X-Session-Id", session_id)
    handler.end_headers()
    handler.wfile.write(body)


def _read_body(handler) -> dict:
    length = int(handler.headers.get("Content-Length", 0))
    if length == 0:
        return {}
    try:
        return json.loads(handler.rfile.read(length))
    except Exception:
        return {}


def _extract_run_id(path: str, prefix: str) -> str | None:
    if path.startswith(prefix):
        return path[len(prefix):].strip("/") or None
    return None


# ── Background Deploy: Ingestion ─────────────────────────────────────────────

def _deploy_ingestion_async(run_id: str, plan: dict):
    """Background thread: creates all Fabric items for an ingestion plan."""
    steps = []
    step_n = [0]

    def _log(title, detail, status="completed", node_id=None):
        step_n[0] += 1
        entry = {"step": step_n[0], "title": title, "detail": detail,
                 "status": status, "node_id": node_id}
        steps.append(entry)
        with _RUNS_LOCK:
            _RUNS[run_id]["steps"] = list(steps)
            if node_id:
                for n in _RUNS[run_id]["plan"]["flow_nodes"]:
                    if n["id"] == node_id:
                        n["status"] = status
                        break

    try:
        ws = ALLOWED_WORKSPACE_ID

        # Step 1: Folder
        folder_id = get_or_create_folder(plan["folder"], ws)
        _log("Workspace Folder", f"Folder '{plan['folder']}' ready", "completed", "folder")

        # Step 2: Lakehouse
        lh_result = create_item(plan["lakehouse"], "Lakehouse", ws, folder_id)
        lh_id = lh_result.get("item_id") if lh_result.get("success") else None
        _log("Bronze Lakehouse", f"'{plan['lakehouse']}' created (ID: {lh_id})",
             "completed" if lh_id else "failed", "lakehouse")

        # Step 3: Environment
        env_payload = compile_environment(plan["environment"])
        env_result = create_item(plan["environment"], "Environment", ws, folder_id)
        env_id = env_result.get("item_id") if env_result.get("success") else None
        _log("Spark Environment", f"'{plan['environment']}' created (ID: {env_id})",
             "completed" if env_id else "failed", "environment")

        # Step 4: Notebooks
        notebook_ids = []
        for i, nb in enumerate(plan.get("notebooks", [])):
            # Generate PySpark code using the connector
            try:
                connector = get_connector(plan["source_id"])
                code = connector.generate_pyspark_ingest_code(
                    nb["source_table"], nb.get("columns", []),
                    plan["lakehouse"], "Bronze",
                    params=plan.get("connection_params", {}),
                )
            except Exception:
                src_tbl = nb.get("source_table", "table")
                code = f"# Auto-generated notebook: {nb['name']}\nprint('Ingesting {src_tbl}...')\n"

            nb_payload = compile_notebook(nb["name"], code)
            nb_result = create_item(nb["name"], "Notebook", ws, folder_id)
            nb_id = nb_result.get("item_id") if nb_result.get("success") else None

            if nb_id:
                parts = compile_notebook_update(code, nb["name"])
                update_definition(nb_id, parts, ws)
                notebook_ids.append(nb_id)

            _log(f"Notebook: {nb['name']}", f"Table: {nb['source_table']}",
                 "completed" if nb_id else "failed", f"nb_{i}")

        # Step 5: Data Pipeline
        pl_name = plan["pipeline"]["name"]
        pl_payload, pl_parts = compile_pipeline(
            pl_name, notebook_ids, ws,
            schedule_cron=plan["pipeline"]["schedule"].get("cron"),
        )
        pl_result = create_item(pl_name, "DataPipeline", ws, folder_id)
        pl_id = pl_result.get("item_id") if pl_result.get("success") else None

        if pl_id and notebook_ids:
            update_definition(pl_id, pl_parts, ws)

        _log("Data Pipeline", f"'{pl_name}' created (ID: {pl_id})",
             "completed" if pl_id else "failed", "pipeline")

        # Mark run complete
        with _RUNS_LOCK:
            _RUNS[run_id]["status"] = "completed" if pl_id else "partial"
            _RUNS[run_id]["pipeline_item_id"] = pl_id

        from app import session_store as store
        store.upsert_run(run_id, None, status="completed" if pl_id else "partial", pipeline_item_id=pl_id, steps_json=steps)
        invalidate(ws)

        # Step 6: Auto-trigger execution monitoring
        if pl_id:
            start_monitoring_thread(ws, pl_id, pl_name, run_id, _RUNS, _RUNS_LOCK)

    except Exception as e:
        with _RUNS_LOCK:
            _RUNS[run_id]["status"] = "error"
            _RUNS[run_id]["error"] = str(e)
        from app import session_store as store
        store.upsert_run(run_id, None, status="error", failure_reason=str(e))
        print(f"[DEPLOY ERROR] run_id={run_id}: {e}")


# ── Background Deploy: Architect ──────────────────────────────────────────────

def format_plan_markdown(plan: dict) -> str:
    """Formats an architecture plan dict into consistent rich Markdown for chat bubbles & storage."""
    folder = plan.get("folder", "AI_Test_Folder")
    msg = f"### 🏛️ Proposed Fabric Architecture: `{folder}`\n\n"

    pl = plan.get("pipeline")
    if pl:
        if isinstance(pl, dict):
            raw_sched = pl.get("schedule")
            if isinstance(raw_sched, dict):
                sched_display = raw_sched.get("human") or raw_sched.get("cron") or "Daily"
            else:
                sched_display = raw_sched or "Daily"
            pl_name = pl.get("name", f"pl_{folder.lower()}_etl")
        else:
            pl_name = str(pl)
            sched_display = "Daily"
        msg += f"**Pipeline**: `{pl_name}` ({sched_display})\n\n"

    if plan.get("environment"):
        msg += f"**Environment**: `{plan['environment']}`\n\n"

    lakehouses = plan.get("lakehouses") or []
    if lakehouses:
        msg += f"**Medallion Lakehouses**: {', '.join([f'`{lh}`' for lh in lakehouses])}\n\n"

    if plan.get("_pipeline_type") == "multi_agent":
        msg += "> *Generated via 4-Stage Multi-Agent Pipeline*\n\n"

    notebooks = plan.get("notebooks") or []
    if notebooks:
        msg += f"**Notebooks ({len(notebooks)})**:\n"
        for nb in notebooks:
            if isinstance(nb, dict):
                nb_name = nb.get("name", "nb_notebook")
                nb_layer = nb.get("layer", "Transform")
                nb_desc = nb.get("description", "PySpark transform")
            else:
                nb_name = str(nb)
                nb_layer = "Transform"
                nb_desc = "PySpark transform"
            msg += f"- **{nb_name}** [{nb_layer}]: *{nb_desc}*\n"

    return msg.strip()


def _deploy_architect_async(run_id: str, plan: dict, session_id: str | None = None):
    """Background thread: creates all Fabric items for an architect plan."""
    start_dep_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + " UTC"
    t_dep_0 = time.perf_counter()
    steps = []
    step_n = [0]

    from app import session_store as store
    from app.workspace_cache import invalidate

    # Initialize run in database
    store.upsert_run(run_id, session_id, status="deploying", plan_json=plan)

    def _log(title, detail, status="completed", node_id=None):
        step_n[0] += 1
        ts_now = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + " UTC"
        entry = {"step": step_n[0], "timestamp": ts_now, "title": title, "detail": detail,
                 "status": status, "node_id": node_id}
        steps.append(entry)
        with _RUNS_LOCK:
            if run_id in _RUNS:
                _RUNS[run_id]["steps"] = list(steps)
                plan_obj = _RUNS[run_id].get("plan", {})
                flow_nodes = plan_obj.get("flow_nodes")
                if node_id and isinstance(flow_nodes, list):
                    for n in flow_nodes:
                        if n.get("id") == node_id:
                            n["status"] = status
                            break

    try:
        from app.config import ALLOWED_WORKSPACE_ID as ws, ALLOWED_WORKSPACE_NAME as ws_name
        folder_name = plan.get("folder", "AI_Test_Folder")
        
        # 1. Folder
        folder_id = get_or_create_folder(folder_name, ws)
        _log("Workspace Folder", f"Folder '{folder_name}' created (ID: {folder_id})", "completed", "fld_root")

        # 2. Environment (Optional)
        env_name = plan.get("environment")
        if env_name:
            try:
                env_result = create_item(env_name, "Environment", ws, folder_id)
                env_id = env_result.get("item_id") if env_result.get("success") else None
                _log("Spark Environment", f"'{env_name}' ready (ID: {env_id})",
                     "completed" if env_id else "failed", "environment")
            except Exception as e:
                _log("Spark Environment", f"Environment skipped or already exists: {e}", "completed", "environment")

        # 3. Lakehouses
        for i, lh_name in enumerate(plan.get("lakehouses", [])):
            try:
                lh_result = create_item(lh_name, "Lakehouse", ws, folder_id)
                lh_id = lh_result.get("item_id") if lh_result.get("success") else None
                action = "renamed & synchronized" if lh_result.get("already_existed") else "created"
                _log(f"Lakehouse ({lh_name})", f"'{lh_name}' {action} (ID: {lh_id})",
                     "completed" if lh_id else "failed", f"lh_{i}")
            except Exception as e:
                _log(f"Lakehouse ({lh_name})", f"Lakehouse '{lh_name}' error: {e}", "failed", f"lh_{i}")

        # 4. Notebooks
        notebook_ids = []
        import re
        for i, nb in enumerate(plan.get("notebooks", [])):
            nb_name = f"nb_transform_{i}"
            nb_pyspark = plan.get("pyspark_code") or f"# Auto-generated notebook\nprint('Running...')\n"

            if isinstance(nb, dict):
                nb_name = nb.get("name") or nb_name
                nb_pyspark = nb.get("pyspark_code") or nb.get("pyspark") or nb_pyspark
            elif isinstance(nb, str):
                nm = re.search(r"name\s*=\s*([A-Za-z0-9_\-]+)", nb)
                if nm:
                    nb_name = nm.group(1)
                elif not any(c in nb for c in (" ", "\n", "{", "@", ";")):
                    nb_name = nb

            # Clean nb_name to only valid alphanumeric & underscore
            nb_name = re.sub(r"[^A-Za-z0-9_\-]", "", nb_name) or f"nb_transform_{i}"

            try:
                nb_result = create_item(nb_name, "Notebook", ws, folder_id)
                nb_id = nb_result.get("item_id") if nb_result.get("success") else None
                if nb_id:
                    parts = compile_notebook_update(nb_pyspark, nb_name)
                    update_definition(nb_id, parts, ws)
                    notebook_ids.append(nb_id)
                action = "renamed & code synchronized" if nb_result.get("already_existed") else "created and PySpark code updated"
                _log(f"PySpark Notebook ({nb_name})", f"'{nb_name}' {action} (ID: {nb_id})",
                     "completed" if nb_id else "failed", f"nb_{i}")
            except Exception as e:
                _log(f"PySpark Notebook ({nb_name})", f"Notebook error: {e}", "failed", f"nb_{i}")

        # 5. Data Pipeline
        pl_info = plan.get("pipeline", {})
        pl_name = f"pl_{folder_name.lower()}_etl"
        pl_cron = "0 2 * * *"
        pl_end_time = None

        if isinstance(pl_info, dict):
            pl_name = pl_info.get("name") or pl_name
            raw_sched = pl_info.get("schedule")
            if isinstance(raw_sched, dict):
                pl_cron = raw_sched.get("cron", "0 2 * * *")
                pl_end_time = raw_sched.get("end_time")
            elif isinstance(raw_sched, str):
                try:
                    from app.ingestion_planner import parse_schedule
                    sched_dict = parse_schedule(raw_sched)
                    pl_cron = sched_dict.get("cron", "0 2 * * *")
                    pl_end_time = sched_dict.get("end_time")
                except Exception:
                    pl_cron = "0 2 * * *"
        elif isinstance(pl_info, str):
            pl_name = pl_info

        try:
            pl_payload, pl_parts = compile_pipeline(pl_name, notebook_ids, ws, schedule_cron=pl_cron, end_time=pl_end_time)
            pl_result = create_item(pl_name, "DataPipeline", ws, folder_id)
            pl_id = pl_result.get("item_id") if pl_result.get("success") else None
            if pl_id:
                if notebook_ids:
                    update_definition(pl_id, pl_parts, ws)
                # Activate official Fabric Schedule via Fabric Jobs Execute API
                time_parts = pl_cron.split()
                time_val = "10:30"
                if len(time_parts) >= 2:
                    mm = time_parts[0].zfill(2)
                    hh = time_parts[1].zfill(2)
                    time_val = f"{hh}:{mm}"
                from app.fabric_client import create_pipeline_schedule
                create_pipeline_schedule(pl_id, time_str=time_val, schedule_type="Daily", workspace_id=ws)

            exp_note = f" (expires {pl_end_time[:10]})" if pl_end_time else ""
            action = "renamed & schedule updated" if pl_result.get("already_existed") else f"created with schedule {pl_cron}{exp_note}"
            _log(f"Data Pipeline ({pl_name})", f"'{pl_name}' {action} (ID: {pl_id})",
                 "completed" if pl_id else "failed", "pl_root")
        except Exception as e:
            _log(f"Data Pipeline ({pl_name})", f"Pipeline error: {e}", "failed", "pl_root")

        with _RUNS_LOCK:
            if run_id in _RUNS:
                _RUNS[run_id]["status"] = "completed"
                _RUNS[run_id]["steps"] = list(steps)

        # Update SQLite store & invalidate workspace items cache
        store.upsert_run(run_id, session_id, status="completed", steps_json=steps, plan_json=plan)
        invalidate(ws)

        # Record deployment completion in session memory if session_id is available
        if session_id:
            try:
                mem = MemoryManager.get_or_create(session_id)
                dep_msg = (
                    f"### 🚀 Architecture Deployed to Microsoft Fabric\n\n"
                    f"- **Target Folder**: `{folder_name}` *(Live in Fabric OneLake)*\n"
                    f"- **Fabric Workspace**: `{ws_name}`\n"
                    f"- **Deployment Run ID**: `{run_id}`\n\n"
                    f"#### 📦 Deployed Fabric Resources\n"
                )
                for st in steps:
                    status_icon = "✅" if st.get("status") == "completed" else "❌"
                    dep_msg += f"- {status_icon} **{st.get('title')}**: {st.get('detail')}\n"
                mem.add_assistant(dep_msg.strip())
            except Exception as mem_err:
                print(f"[DEPLOY MEMORY RECORD ERROR] {mem_err}")

        # Log live deployment audit to execution_traces
        try:
            from app.execution_logger import log_agent_execution
            class DummyState:
                def __init__(self, run_id, plan):
                    self.run_id = run_id
                    self.prompt = f"Live Deployment of plan {plan.get('folder')}"
                    self.context_mode = "deploy"
                    self.dag = None
                    self.worker_results = None
                    self.fabric_plan = plan
                    self.audit = None
                    self.audit_messages = []
                    self.retry_count = 0
            end_dep_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + " UTC"
            t_dep_1 = time.perf_counter()
            deploy_summary = {
                "status": "completed",
                "workspace_id": ws,
                "folder_id": folder_id,
                "started_at": start_dep_utc,
                "completed_at": end_dep_utc,
                "duration_sec": round(t_dep_1 - t_dep_0, 2),
                "steps": list(steps)
            }
            log_agent_execution(run_id, DummyState(run_id, plan), deployment_result=deploy_summary)
        except Exception as log_err:
            print(f"[DEPLOY TRACE LOG ERROR] {log_err}")

    except Exception as e:
        with _RUNS_LOCK:
            if run_id in _RUNS:
                _RUNS[run_id]["status"] = "error"
                _RUNS[run_id]["error"] = str(e)
        store.upsert_run(run_id, session_id, status="error", failure_reason=str(e), plan_json=plan)
        print(f"[ARCHITECT ERROR] run_id={run_id}: {e}")
        if session_id:
            try:
                mem = MemoryManager.get_or_create(session_id)
                mem.add_assistant(f"⚠️ **Deployment Failed**: {str(e)}")
            except Exception:
                pass


# ── Request Handler ───────────────────────────────────────────────────────────

class FabricAIHandler(http.server.SimpleHTTPRequestHandler):

    def log_message(self, fmt, *args):
        print(f"[HTTP] {fmt % args}")

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()

    def do_GET(self):
        path = urllib.parse.urlparse(self.path).path
        session_id = _get_session_id(self)

        if path == "/api/connectors":
            _json_response(self, {"connectors": list_connectors()}, session_id=session_id)

        elif path == "/api/workspaces":
            import app.config as cfg
            workspaces = list_workspaces()
            _json_response(self, {
                "workspaces": workspaces,
                "locked_workspace": {
                    "id": cfg.ALLOWED_WORKSPACE_ID,
                    "name": cfg.ALLOWED_WORKSPACE_NAME,
                },
            }, session_id=session_id)

        elif path == "/api/workspace/items":
            result = list_workspace_items(ALLOWED_WORKSPACE_ID)
            _json_response(self, result, session_id=session_id)

        elif path == "/api/workspace/tree":
            tree = get_workspace_tree(ALLOWED_WORKSPACE_ID)
            _json_response(self, tree, session_id=session_id)

        elif path == "/api/workspace/refresh":
            cache_data = refresh_cache(ALLOWED_WORKSPACE_ID)
            _json_response(self, {"success": True, "cache": cache_data}, session_id=session_id)

        elif path == "/api/session/summary":
            mem = MemoryManager.get_or_create(session_id)
            _json_response(self, mem.get_summary(), session_id=mem.session_id)

        elif path == "/api/conversations":
            from app import session_store as store
            convs = store.list_conversations_with_metadata(ALLOWED_WORKSPACE_ID)
            _json_response(self, {"conversations": convs, "active_session_id": session_id}, session_id=session_id)

        elif path.startswith("/api/conversation/"):
            sid = path[len("/api/conversation/"):]
            from app import session_store as store
            data = store.get_conversation_full(sid)
            if data:
                _json_response(self, data, session_id=sid)
            else:
                _json_response(self, {"success": False, "notFound": True, "messages": []}, 200, session_id=session_id)

        elif path.startswith("/api/ingestion/status/"):
            run_id = _extract_run_id(path, "/api/ingestion/status/")
            if not run_id:
                _json_response(self, {"error": "Missing run_id"}, 400, session_id=session_id)
                return
            with _RUNS_LOCK:
                run = _RUNS.get(run_id)
            if not run:
                from app import session_store as store
                run = store.get_run(run_id)
            if not run:
                _json_response(self, {"error": f"Run '{run_id}' not found"}, 404, session_id=session_id)
            else:
                _json_response(self, run, session_id=session_id)

        elif path == "/api/auth/status":
            from app.auth import get_auth_status
            _json_response(self, get_auth_status(), session_id=session_id)

        elif path == "/api/system/stats":
            from app import session_store as store
            from app.workspace_cache import get_item_counts
            from app.auth import get_auth_status
            db_stats = store.get_db_stats()
            item_counts = get_item_counts()
            auth_info = get_auth_status()
            _json_response(self, {
                "workspace": {"name": ALLOWED_WORKSPACE_NAME, "id": ALLOWED_WORKSPACE_ID},
                "auth": auth_info,
                "models": LLM_MODELS,
                "db_stats": db_stats,
                "item_counts": item_counts,
            }, session_id=session_id)

        elif path == "/api/skills":
            from app.skill_loader import get_skill_index
            skills = get_skill_index()
            _json_response(self, {"skills": skills, "count": len(skills)}, session_id=session_id)

        elif path == "/api/models/status":
            from app.config import GEMINI_KEY, GROQ_KEYS, ANTHROPIC_KEY, OPENAI_KEY
            import requests

            # Probe local Ollama instance
            ollama_models = []
            ollama_online = False
            try:
                r_ollama = requests.get("http://localhost:11434/api/tags", timeout=0.8)
                if r_ollama.status_code == 200:
                    ollama_online = True
                    ollama_models = [m["name"] for m in r_ollama.json().get("models", [])]
            except Exception:
                ollama_online = False

            # Probe local LM Studio instance
            lmstudio_models = []
            lmstudio_online = False
            try:
                r_lm = requests.get("http://localhost:1234/v1/models", timeout=0.4)
                if r_lm.status_code == 200:
                    lmstudio_online = True
                    lmstudio_models = [m.get("id", "") for m in r_lm.json().get("data", [])]
            except Exception:
                lmstudio_online = False

            _json_response(self, {
                "providers": {
                    "gemini": {
                        "configured": bool(GEMINI_KEY),
                        "name": "Google Gemini",
                        "active_models": ["gemini-1.5-pro", "gemini-3.6-flash"]
                    },
                    "groq": {
                        "configured": bool(GROQ_KEYS),
                        "name": "Groq",
                        "active_models": ["openai/gpt-oss-120b", "openai/gpt-oss-20b"]
                    },
                    "anthropic": {
                        "configured": bool(ANTHROPIC_KEY or os.getenv("CLAUDE_COOKIE")),
                        "name": "Anthropic Claude (Native Mix)",
                        "active_models": ["claude-mix", "claude-opus-5", "claude-3-5-sonnet", "claude-3-5-haiku"]
                    },
                    "openai": {
                        "configured": bool(OPENAI_KEY),
                        "name": "OpenAI",
                        "active_models": ["gpt-4o", "gpt-4o-mini"]
                    }
                },
                "local": {
                    "ollama": {
                        "online": ollama_online,
                        "url": "http://localhost:11434",
                        "models": ollama_models
                    },
                    "lmstudio": {
                        "online": lmstudio_online,
                        "url": "http://localhost:1234",
                        "models": lmstudio_models
                    }
                }
            }, session_id=session_id)

        elif path == "/api/vault/status":
            from app.vault import vault
            _json_response(self, {"vault_entries": vault.list_connector_statuses()}, session_id=session_id)

        elif path == "/api/governance/audit":
            audit_file = os.path.join(BASE_DIR, "audit_trail.json")
            trail = []
            if os.path.exists(audit_file):
                try:
                    with open(audit_file, "r", encoding="utf-8") as f:
                        trail = json.load(f)
                except Exception:
                    trail = []
            _json_response(self, {"audit_trail": trail, "count": len(trail)}, session_id=session_id)

        elif path == "/openapi.json":
            host_header = self.headers.get("Host", "localhost:8085")
            proto = "https" if "devtunnels" in host_header or "localtunnel" in host_header or "ngrok" in host_header else "http"
            openapi_spec = {
                "openapi": "3.0.1",
                "info": {
                    "title": "Fabric AI Studio Action",
                    "description": "Enables Microsoft 365 Copilot to inspect and control Microsoft Fabric data architectures.",
                    "version": "1.0.0"
                },
                "servers": [{"url": f"{proto}://{host_header}"}],
                "paths": {
                    "/api/copilot/status": {
                        "get": {
                            "operationId": "getFabricStatus",
                            "summary": "Check Fabric AI connection status and active workspace",
                            "description": "Returns status of Fabric AI Studio, active workspace name, and Azure authentication state.",
                            "responses": {
                                "200": {
                                    "description": "Success",
                                    "content": {
                                        "application/json": {
                                            "schema": {
                                                "type": "object",
                                                "properties": {
                                                    "status": {"type": "string"},
                                                    "workspace_name": {"type": "string"},
                                                    "authenticated_user": {"type": "string"},
                                                    "total_items": {"type": "integer"}
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "/api/copilot/items": {
                        "get": {
                            "operationId": "getWorkspaceItems",
                            "summary": "List Lakehouses and Notebooks in the Fabric workspace",
                            "description": "Returns a summary list of all deployed Lakehouses and PySpark Notebooks.",
                            "responses": {
                                "200": {
                                    "description": "Success",
                                    "content": {
                                        "application/json": {
                                            "schema": {
                                                "type": "object",
                                                "properties": {
                                                    "workspace_name": {"type": "string"},
                                                    "lakehouses": {"type": "array", "items": {"type": "string"}},
                                                    "notebooks": {"type": "array", "items": {"type": "string"}}
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "/api/copilot/create_lakehouse": {
                        "post": {
                            "operationId": "createLakehouse",
                            "summary": "Create a new Lakehouse in Microsoft Fabric",
                            "description": "Provisions a new Delta Lakehouse in the active Fabric workspace.",
                            "requestBody": {
                                "required": True,
                                "content": {
                                    "application/json": {
                                        "schema": {
                                            "type": "object",
                                            "required": ["lakehouse_name"],
                                            "properties": {
                                                "lakehouse_name": {"type": "string", "description": "Name of the lakehouse, e.g. lh_sales_bronze"},
                                                "layer": {"type": "string", "description": "Medallion layer: Bronze, Silver, or Gold"}
                                            }
                                        }
                                    }
                                }
                            },
                            "responses": {
                                "200": {
                                    "description": "Success",
                                    "content": {
                                        "application/json": {
                                            "schema": {
                                                "type": "object",
                                                "properties": {
                                                    "success": {"type": "boolean"},
                                                    "message": {"type": "string"},
                                                    "item_id": {"type": "string"}
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            _json_response(self, openapi_spec, session_id=session_id)

        elif path == "/api/copilot/status":
            from app.auth import get_auth_status
            auth = get_auth_status()
            items_data = list_workspace_items(ALLOWED_WORKSPACE_ID)
            items_list = items_data.get("items", []) if isinstance(items_data, dict) else []
            _json_response(self, {
                "status": "online",
                "workspace_name": ALLOWED_WORKSPACE_NAME,
                "authenticated_user": auth.get("user_identity", "Authenticated User"),
                "total_items": len(items_list),
                "message": f"Fabric AI Studio is online and connected to workspace '{ALLOWED_WORKSPACE_NAME}'."
            }, session_id=session_id)

        elif path == "/api/copilot/items":
            items_data = list_workspace_items(ALLOWED_WORKSPACE_ID)
            items_list = items_data.get("items", []) if isinstance(items_data, dict) else []
            lakehouses = [it.get("displayName") for it in items_list if it.get("type") == "Lakehouse"]
            notebooks = [it.get("displayName") for it in items_list if it.get("type") == "Notebook"]
            _json_response(self, {
                "workspace_name": ALLOWED_WORKSPACE_NAME,
                "lakehouses": lakehouses,
                "notebooks": notebooks,
                "total_count": len(items_list)
            }, session_id=session_id)

        elif path in ("/api/projects", "/api/projects/list"):
            from app import session_store as store
            projects = store.get_all_projects()
            _json_response(self, {"success": True, "projects": projects}, session_id=session_id)

        elif path in ("/sse", "/mcp"):
            # MCP Server-Sent Events handshake
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "keep-alive")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            host = self.headers.get("Host", "localhost:8085")
            proto = "https" if "devtunnels" in host or "localtunnel" in host or "ngrok" in host else "http"
            event_payload = f"event: endpoint\r\ndata: {proto}://{host}/messages\r\n\r\n"
            self.wfile.write(event_payload.encode("utf-8"))
            self.wfile.flush()
            return

        else:
            # Serve static files (index.html, app.js, style.css, etc.)
            super().do_GET()

    def do_POST(self):
        path = urllib.parse.urlparse(self.path).path
        body = _read_body(self)
        session_id = _get_session_id(self) or body.get("session_id")
        mem = MemoryManager.get_or_create(session_id)
        current_session_id = mem.session_id

        # ── Projects API ─────────────────────────────────────────────────────
        if path == "/api/projects/new":
            from app import session_store as store
            name = body.get("name", "").strip()
            desc = body.get("description", "").strip()
            if not name:
                _json_response(self, {"success": False, "error": "Project name is required"}, status=400, session_id=current_session_id)
            else:
                p = store.create_project(name, desc)
                _json_response(self, {"success": True, "project": p}, session_id=current_session_id)

        elif path == "/api/projects/update":
            from app import session_store as store
            pid = body.get("id") or body.get("project_id")
            if not pid:
                _json_response(self, {"success": False, "error": "Project ID required"}, status=400, session_id=current_session_id)
            else:
                ok = store.update_project(
                    pid,
                    name=body.get("name"),
                    description=body.get("description"),
                    is_pinned=body.get("is_pinned"),
                    is_archived=body.get("is_archived")
                )
                _json_response(self, {"success": ok}, session_id=current_session_id)

        elif path == "/api/projects/delete":
            from app import session_store as store
            pid = body.get("id") or body.get("project_id")
            if not pid:
                _json_response(self, {"success": False, "error": "Project ID required"}, status=400, session_id=current_session_id)
            else:
                ok = store.delete_project(pid)
                _json_response(self, {"success": ok}, session_id=current_session_id)

        # ── Data Source Connectors & Zero-Leak Vault ─────────────────────────
        elif path in ("/api/connectors/diagnose", "/api/connector/diagnose"):
            from connectors.network_doctor import NetworkDoctor
            host = body.get("host", "")
            port = body.get("port", 5432)
            diag = NetworkDoctor.diagnose_target(host, port)
            _json_response(self, diag, session_id=current_session_id)

        elif path in ("/api/connectors/discover", "/api/connector/discover"):
            from connectors.connector_registry import get_connector
            source_id = body.get("source_id", "postgres")
            conn = get_connector(source_id)
            tables_res = conn.discover_tables(body.get("params", body))
            _json_response(self, tables_res, session_id=current_session_id)

        elif path in ("/api/connectors/schema", "/api/connector/schema"):
            from connectors.connector_registry import get_connector
            source_id = body.get("source_id", "postgres")
            table = body.get("table", "orders")
            conn = get_connector(source_id)
            schema_res = conn.get_schema(table, body.get("params", body))
            _json_response(self, schema_res, session_id=current_session_id)

        elif path in ("/api/vault/save", "/api/vault/store"):
            from app.vault import vault
            source_id = body.get("source_id", "")
            creds = body.get("credentials", {})
            master_pin = body.get("master_pin")
            success = vault.save_connector_credentials(source_id, creds, master_pin)
            _json_response(self, {"success": success, "source_id": source_id}, session_id=current_session_id)

        elif path in ("/api/vault/unlock", "/api/vault/verify"):
            from app.vault import vault
            master_pin = body.get("master_pin", "")
            is_valid = vault.verify_master_password(master_pin)
            if is_valid:
                entries = vault.list_connector_statuses(master_pin)
                _json_response(self, {"success": True, "entries": entries}, session_id=current_session_id)
            else:
                _json_response(self, {"success": False, "error": "Invalid master PIN/password."}, status=401, session_id=current_session_id)

        elif path == "/api/connectors/ai-generate":
            from connectors.jit_connector_factory import ai_synthesize_from_prompt
            prompt_text = body.get("prompt", "").strip()
            if not prompt_text:
                _json_response(self, {"error": "Prompt cannot be empty."}, 400, session_id=current_session_id)
            else:
                synth = ai_synthesize_from_prompt(prompt_text)
                _json_response(self, {"success": True, "connector": synth}, session_id=current_session_id)

        elif path == "/api/connectors/custom/save":
            from connectors.jit_connector_factory import save_custom_connector
            from connectors.connector_registry import reload_connectors
            connector_def = body.get("connector", body)
            saved_instance = save_custom_connector(connector_def)
            reload_connectors()
            _json_response(self, {
                "success": True, 
                "source_id": saved_instance.source_id,
                "name": saved_instance.name,
                "info": saved_instance.to_info_dict()
            }, session_id=current_session_id)

        # ── Auth & Workspace Management ──────────────────────────────────────
        elif path == "/api/auth/refresh":
            from app.auth import clear_token_cache, get_auth_status
            clear_token_cache()
            _json_response(self, {"success": True, "auth": get_auth_status()}, session_id=current_session_id)

        elif path == "/api/auth/login-cli":
            from app.auth import trigger_cli_login
            res = trigger_cli_login()
            _json_response(self, res, session_id=current_session_id)

        elif path == "/api/auth/service-principal":
            from app.auth import apply_service_principal
            t_id = body.get("tenant_id", "")
            c_id = body.get("client_id", "")
            c_sec = body.get("client_secret", "")
            res = apply_service_principal(t_id, c_id, c_sec)
            _json_response(self, res, session_id=current_session_id)

        elif path == "/api/auth/token":
            from app.auth import apply_bearer_token
            tok = body.get("token", "")
            res = apply_bearer_token(tok)
            _json_response(self, res, session_id=current_session_id)

        elif path == "/api/workspaces/set-active":
            import app.config as cfg
            from app.workspace_cache import invalidate
            ws_id = body.get("workspace_id", "")
            ws_name = body.get("workspace_name", "")
            if ws_id:
                cfg.set_active_workspace(ws_id, ws_name or ws_id)
                invalidate(ws_id)
                _json_response(self, {
                    "success": True,
                    "workspace": {
                        "id": cfg.ALLOWED_WORKSPACE_ID,
                        "name": cfg.ALLOWED_WORKSPACE_NAME
                    }
                }, session_id=current_session_id)
            else:
                _json_response(self, {"success": False, "error": "workspace_id is required"}, 400, session_id=current_session_id)

        # ── Conversation Management ─────────────────────────────────────────
        elif path == "/api/conversation/new":
            from app import session_store as store
            import uuid
            new_sid = "sess_" + uuid.uuid4().hex[:10]
            store.create_session(new_sid, ALLOWED_WORKSPACE_ID)
            _json_response(self, {"success": True, "session_id": new_sid}, session_id=new_sid)

        elif path == "/api/conversation/rename":
            from app import session_store as store
            target_sid = body.get("session_id") or current_session_id
            title = body.get("title", "").strip()
            if not title:
                _json_response(self, {"error": "Title cannot be empty"}, 400, session_id=current_session_id)
                return
            success = store.rename_conversation(target_sid, title)
            _json_response(self, {"success": success, "session_id": target_sid, "title": title}, session_id=current_session_id)

        elif path == "/api/conversation/delete":
            from app import session_store as store
            target_sid = body.get("session_id")
            if not target_sid:
                _json_response(self, {"error": "session_id is required"}, 400, session_id=current_session_id)
                return
            success = store.delete_conversation(target_sid)
            _json_response(self, {"success": success, "deleted_session_id": target_sid}, session_id=current_session_id)

        # ── Connector Discovery ─────────────────────────────────────────────
        elif path == "/api/connector/discover":
            source_id = body.get("source_id")
            params    = body.get("params", {})
            try:
                connector = get_connector(source_id)
                if getattr(connector, "is_stub", False):
                    _json_response(self, {"success": False, "error": "This connector is not yet implemented.", "is_stub": True}, session_id=current_session_id)
                    return
                result = connector.discover_tables(params)
                _json_response(self, result, session_id=current_session_id)
            except KeyError as e:
                _json_response(self, {"success": False, "error": str(e)}, 404, session_id=current_session_id)

        elif path == "/api/connector/schema":
            source_id  = body.get("source_id")
            table      = body.get("table")
            params     = body.get("params", {})
            schema_name= body.get("schema", "dbo")
            try:
                connector = get_connector(source_id)
                result = connector.get_schema(table, params, schema_name)
                _json_response(self, result, session_id=current_session_id)
            except KeyError as e:
                _json_response(self, {"success": False, "error": str(e)}, 404, session_id=current_session_id)

        # ── Ingestion Plan ───────────────────────────────────────────────────
        elif path == "/api/ingestion/plan":
            plan = generate_ingestion_plan(
                source_id      = body.get("source_id", "unknown"),
                source_name    = body.get("source_name", "Unknown"),
                database       = body.get("database", "db"),
                selected_tables= body.get("tables", []),
                schedule_prompt= body.get("schedule", ""),
                extra_context  = body.get("context", ""),
            )
            # Store plan under run_id for status tracking (in-memory + SQLite)
            with _RUNS_LOCK:
                _RUNS[plan["run_id"]] = {
                    "status": "planned",
                    "plan": plan,
                    "steps": [],
                    "connection_params": body.get("params", {}),
                }
            mem.track_run(
                plan["run_id"],
                status="planned",
                source_id=plan["source_id"],
                source_name=plan["source_name"],
                database_name=plan["database"],
                plan_json=plan,
            )
            mem.add_user(f"Plan ingestion for {plan['source_name']} ({plan['database']}) with {len(plan['notebooks'])} tables")
            mem.add_assistant(f"Ingestion plan generated for {plan['source_name']}: {plan['folder']} lakehouse={plan['lakehouse']}")
            from app.memory import record_plan_facts
            record_plan_facts(current_session_id, plan)
            _json_response(self, plan, session_id=current_session_id)

        # ── Ingestion Deploy ─────────────────────────────────────────────────
        elif path == "/api/ingestion/deploy":
            run_id = body.get("run_id")
            with _RUNS_LOCK:
                run = _RUNS.get(run_id)
            if not run:
                from app import session_store as store
                run = store.get_run(run_id)
                if run and "plan_json" in run:
                    run["plan"] = run["plan_json"]
            if not run:
                _json_response(self, {"error": f"No plan found for run_id='{run_id}'"}, 404, session_id=current_session_id)
                return
            plan = run["plan"]
            plan["connection_params"] = run.get("connection_params", {})

            with _RUNS_LOCK:
                _RUNS[run_id]["status"] = "deploying"
            mem.track_run(run_id, status="deploying")

            t = threading.Thread(
                target=_deploy_ingestion_async,
                args=(run_id, plan),
                daemon=True,
                name=f"deploy-{run_id}",
            )
            t.start()
            _json_response(self, {"run_id": run_id, "status": "deploying"}, session_id=current_session_id)

        # ── Pipeline Trigger ─────────────────────────────────────────────────
        elif path == "/api/pipeline/trigger":
            pipeline_id   = body.get("pipeline_id")
            pipeline_name = body.get("pipeline_name", pipeline_id)
            run_id        = body.get("run_id")

            if not pipeline_id:
                _json_response(self, {"error": "pipeline_id is required"}, 400, session_id=current_session_id)
                return

            if run_id:
                with _RUNS_LOCK:
                    if run_id not in _RUNS:
                        _RUNS[run_id] = {"status": "triggering", "steps": []}
                mem.track_run(run_id, status="triggering", pipeline_item_id=pipeline_id)

            result = trigger_pipeline_run(pipeline_id, ALLOWED_WORKSPACE_ID)

            if result.get("success") and run_id:
                start_monitoring_thread(
                    ALLOWED_WORKSPACE_ID, pipeline_id, pipeline_name,
                    run_id, _RUNS, _RUNS_LOCK
                )

            _json_response(self, result, session_id=current_session_id)

        # ── Safe Item Delete ─────────────────────────────────────────────────
        elif path == "/api/item/delete":
            item_id       = body.get("item_id")
            item_name     = body.get("item_name", item_id)
            confirmation  = body.get("confirmation", "")

            if not item_id:
                _json_response(self, {"error": "item_id is required"}, 400, session_id=current_session_id)
                return

            impact = analyze_impact("delete_item", {"item_name": item_name})
            if impact["requires_confirmation"] and not confirmation:
                _json_response(self, {
                    "success": False,
                    "requires_confirmation": True,
                    "confirmation_phrase": impact["confirmation_phrase"],
                    "warning": impact["warning_message"],
                }, session_id=current_session_id)
                return

            result = safe_delete(item_id, item_name, confirmation, ALLOWED_WORKSPACE_ID)
            if result.get("success"):
                invalidate(ALLOWED_WORKSPACE_ID)
            _json_response(self, result, session_id=current_session_id)

        # ── Auth & Workspace Connection Management ───────────────────────────
        elif path == "/api/auth/login-cli":
            from app.auth import trigger_cli_login
            force = bool(body.get("force", False))
            result = trigger_cli_login(force_interactive=force)
            _json_response(self, result, session_id=current_session_id)

        elif path == "/api/auth/device-code/start":
            from app.auth import start_device_code_login
            result = start_device_code_login()
            _json_response(self, result, session_id=current_session_id)

        elif path == "/api/auth/device-code/poll":
            from app.auth import poll_device_code_token
            device_code = body.get("device_code", "")
            result = poll_device_code_token(device_code)
            _json_response(self, result, session_id=current_session_id)

        elif path == "/api/auth/service-principal":
            from app.auth import apply_service_principal
            tenant_id = body.get("tenant_id", "")
            client_id = body.get("client_id", "")
            client_secret = body.get("client_secret", "")
            result = apply_service_principal(tenant_id, client_id, client_secret)
            _json_response(self, result, session_id=current_session_id)

        elif path == "/api/auth/token":
            from app.auth import apply_bearer_token
            token = body.get("token", "")
            result = apply_bearer_token(token)
            _json_response(self, result, session_id=current_session_id)

        elif path == "/api/auth/disconnect":
            from app.auth import disconnect
            auth_info = disconnect()
            _json_response(self, {"success": True, "message": "Disconnected from Microsoft Fabric", "auth": auth_info}, session_id=current_session_id)

        elif path == "/api/workspaces/set-active":
            import app.config as cfg
            from app.workspace_cache import invalidate
            ws_id = body.get("workspace_id")
            ws_name = body.get("workspace_name", "Fabric Workspace")
            if not ws_id:
                _json_response(self, {"error": "workspace_id is required"}, 400, session_id=current_session_id)
                return
            cfg.set_active_workspace(ws_id, ws_name)
            invalidate(ws_id)
            _json_response(self, {"success": True, "workspace_id": ws_id, "workspace_name": ws_name}, session_id=current_session_id)

        # ── Conversation Management ──────────────────────────────────────────
        elif path == "/api/conversation/rename":
            session_id = body.get("session_id")
            title = body.get("title", "").strip()
            if not session_id or not title:
                _json_response(self, {"error": "session_id and title are required"}, 400, session_id=current_session_id)
                return
            from app import session_store as store
            ok = store.rename_conversation(session_id, title)
            _json_response(self, {"success": ok}, session_id=current_session_id)

        elif path == "/api/conversation/delete":
            session_id = body.get("session_id")
            if not session_id:
                _json_response(self, {"error": "session_id is required"}, 400, session_id=current_session_id)
                return
            from app import session_store as store
            ok = store.delete_conversation(session_id)
            _json_response(self, {"success": ok}, session_id=current_session_id)

        elif path == "/api/conversation/truncate":
            session_id = body.get("session_id") or current_session_id
            turn_index = body.get("turn_index", 0)
            if not session_id:
                _json_response(self, {"error": "session_id is required"}, 400, session_id=current_session_id)
                return
            from app import session_store as store
            deleted = store.truncate_messages_from(session_id, int(turn_index))
            _json_response(self, {"success": True, "deleted_count": deleted}, session_id=session_id)

        elif path == "/api/audio/transcribe":
            import base64
            import io
            import requests
            b64_data = body.get("audio_base64")
            if not b64_data:
                _json_response(self, {"error": "audio_base64 required"}, 400, session_id=current_session_id)
                return
            
            try:
                audio_bytes = base64.b64decode(b64_data)
                mime_type = body.get("mime_type", "audio/webm")
                ext = "webm" if "webm" in mime_type else ("wav" if "wav" in mime_type else "mp3")
                
                from app.config import GROQ_KEYS
                transcribed_text = ""
                for key in GROQ_KEYS:
                    try:
                        files = {
                            "file": (f"audio.{ext}", io.BytesIO(audio_bytes), mime_type)
                        }
                        data = {
                            "model": "whisper-large-v3-turbo",
                            "language": "en"
                        }
                        r = requests.post(
                            "https://api.groq.com/openai/v1/audio/transcriptions",
                            headers={"Authorization": f"Bearer {key}"},
                            files=files,
                            data=data,
                            timeout=25
                        )
                        if r.status_code == 200:
                            transcribed_text = r.json().get("text", "")
                            break
                    except Exception as e:
                        print(f"[WHISPER ERROR] {e}")
                        continue
                
                _json_response(self, {"success": True, "text": transcribed_text.strip()}, session_id=current_session_id)
            except Exception as e:
                _json_response(self, {"error": str(e)}, 500, session_id=current_session_id)

        # ── Architect Agent ──────────────────────────────────────────────────
        elif path in ("/api/agent/execute", "/api/architect/plan", "/api/architect/deploy"):
            if not _LLM_AVAILABLE:
                _json_response(self, {"error": "LLM not available — check API keys in .env"}, 503, session_id=current_session_id)
                return

            prompt       = body.get("prompt", "")
            folder_name  = body.get("folder", "AI_Test_Folder")
            deploy       = body.get("deploy", path == "/api/architect/deploy")
            target_model = body.get("model")
            effort       = body.get("effort", "medium")

            is_internal_deploy = deploy or prompt.strip().lower() in ("deploy active plan", "deploy plan", "deploy")
            if not is_internal_deploy and prompt.strip():
                mem.add_user(prompt)

            import uuid
            run_id = uuid.uuid4().hex[:8]

            try:
                from app.orchestrator import parse_intent, generate_notebook_codes, assemble_plan
                from app.llm_router import chat

                llm_messages = mem.build_llm_messages()
                intent = parse_intent(prompt, llm_messages)
                intent_type = intent.get("intent", "conversation")

                has_items_to_create = bool(intent.get("create", {}).get("lakehouses") or intent.get("create", {}).get("notebooks"))

                # ── Action 0: Update Pipeline Schedule Directly ──────────────────────
                is_schedule_intent = (
                    intent_type in ("schedule_pipeline", "edit") or
                    any(kw in prompt.lower() for kw in ("schedule", "cron", "recurring", "frequency", "expiration", "expires"))
                )
                is_pipeline_target = (
                    "pipeline" in prompt.lower() or
                    "pl_" in prompt.lower() or
                    any(itm.get("displayName", "").lower() in prompt.lower()
                        for itm in list_workspace_items(ALLOWED_WORKSPACE_ID).get("items", [])
                        if itm.get("type") == "DataPipeline")
                )
                if is_schedule_intent and is_pipeline_target and not has_items_to_create:
                    try:
                        import re
                        from app.fabric_client import update_definition
                        from app.fabric_compiler import compile_pipeline
                        from app.ingestion_planner import parse_schedule

                        sched_info = parse_schedule(prompt)
                        cron_exp = sched_info.get("cron", "0 10 * * *")
                        human_sched = sched_info.get("human", "Daily")
                        end_time_val = sched_info.get("end_time")

                        # Find target pipeline name from prompt or workspace
                        ws_items = list_workspace_items(ALLOWED_WORKSPACE_ID).get("items", [])
                        pipeline_items = [itm for itm in ws_items if itm.get("type") == "DataPipeline"]
                        target_pl = None

                        # Check for explicit match
                        for itm in pipeline_items:
                            name_clean = itm.get("displayName", "").lower()
                            if name_clean in prompt.lower() or any(part in prompt.lower() for part in name_clean.split("_") if len(part) > 2):
                                target_pl = itm
                                break

                        if not target_pl and pipeline_items:
                            target_pl = pipeline_items[0]

                            update_definition(pl_id, pl_parts, ALLOWED_WORKSPACE_ID)
                            time_parts = cron_exp.split()
                            time_val = "10:30"
                            if len(time_parts) >= 2:
                                mm = time_parts[0].zfill(2)
                                hh = time_parts[1].zfill(2)
                                time_val = f"{hh}:{mm}"
                            from app.fabric_client import create_pipeline_schedule
                            create_pipeline_schedule(pl_id, time_str=time_val, schedule_type="Daily", workspace_id=ALLOWED_WORKSPACE_ID)
                            reply_text = (
                                f"### ✅ Pipeline Schedule Updated in Fabric\n\n"
                                f"- **Pipeline**: `{pl_name}`\n"
                                f"- **Fabric ID**: `{pl_id}`\n"
                                f"- **Workspace**: `{ALLOWED_WORKSPACE_NAME}`\n"
                                f"- **Schedule**: `{human_sched}` (`{cron_exp}`)\n"
                            )
                            if end_time_val:
                                reply_text += f"- **Expiration Date**: `{end_time_val[:10]} UTC` (Active for 1 year)\n"
                            reply_text += f"- **Status**: Live & active in Azure Data Factory / Fabric trigger engine."
                        else:
                            reply_text = f"⚠️ Could not find a Data Pipeline in workspace `{ALLOWED_WORKSPACE_NAME}` to apply the schedule to."

                        mem.add_assistant(reply_text)
                        _json_response(self, {
                            "type": "chat",
                            "summary": f"Updated schedule for {target_pl.get('displayName') if target_pl else 'pipeline'}",
                            "text": reply_text,
                            "intent": "schedule_pipeline",
                            "session_id": current_session_id
                        }, session_id=current_session_id)
                        return
                    except Exception as sched_err:
                        print(f"[SCHEDULE UPDATE ERROR] {sched_err}")

                # ── Action 1: Standalone Folder Creation ──────────────────────────────
                has_child_items = bool(
                    has_items_to_create or
                    intent.get("create", {}).get("pipeline") or
                    any(kw in prompt.lower() for kw in ("notebook", "pipeline", "code", "lakehouse", "table", "pyspark", "schedule", "merge_sort", "quick_sort", "tim_sort", "transform"))
                )
                if intent_type == "create_folder" and not has_child_items:
                    import re
                    f_target = intent.get("folder")
                    if not f_target or f_target == "AI_Project":
                        fm = re.search(r"\b(?:folder|directory)\s+(?:named\s+|called\s+)?['\"]?([A-Za-z0-9_\-]+)['\"]?", prompt, re.IGNORECASE)
                        f_target = fm.group(1).strip() if fm else (folder_name or "AI_Test_Folder")

                    try:
                        from app.fabric_client import get_or_create_folder
                        from app.workspace_cache import invalidate
                        f_id = get_or_create_folder(f_target, ALLOWED_WORKSPACE_ID)
                        if f_id:
                            invalidate(ALLOWED_WORKSPACE_ID)
                            reply_text = (
                                f"### ✅ Folder Created in Fabric\n\n"
                                f"- **Folder Name**: `{f_target}`\n"
                                f"- **Fabric Folder ID**: `{f_id}`\n"
                                f"- **Workspace**: `{ALLOWED_WORKSPACE_NAME}`\n"
                                f"- **Status**: Live in Microsoft Fabric OneLake.\n\n"
                                f"You can now organize Lakehouses, PySpark Notebooks, and Data Pipelines inside this folder."
                            )
                        else:
                            reply_text = f"⚠️ Could not create folder `{f_target}` in workspace `{ALLOWED_WORKSPACE_NAME}`. Please verify your Azure / Fabric connection."
                    except Exception as err:
                        reply_text = f"⚠️ Error executing folder creation in Fabric: {err}"

                    mem.add_assistant(reply_text)
                    _json_response(self, {
                        "type": "chat",
                        "summary": f"Created folder {f_target}",
                        "text": reply_text,
                        "intent": "create_folder",
                        "folder_id": f_id if 'f_id' in locals() and f_id else None,
                        "folder": f_target,
                        "session_id": current_session_id
                    }, session_id=current_session_id)
                    return

                # ── Action 2: Standalone Folder Deletion ──────────────────────────────
                elif intent_type == "delete_folder":
                    f_target = intent.get("folder") or folder_name
                    try:
                        from app.fabric_client import list_folders, delete_folder
                        from app.workspace_cache import invalidate
                        folders = list_folders(ALLOWED_WORKSPACE_ID)
                        matched = next((f for f in folders if f.get("displayName", "").lower() == f_target.lower()), None)
                        if matched:
                            ok = delete_folder(matched.get("id"), ALLOWED_WORKSPACE_ID)
                            if ok:
                                invalidate(ALLOWED_WORKSPACE_ID)
                                reply_text = f"### 🗑️ Folder Deleted\n\nFolder `{f_target}` (ID: `{matched.get('id')}`) was successfully removed from workspace `{ALLOWED_WORKSPACE_NAME}`."
                            else:
                                reply_text = f"⚠️ Failed to delete folder `{f_target}` from Microsoft Fabric."
                        else:
                            reply_text = f"ℹ️ Folder `{f_target}` was not found in workspace `{ALLOWED_WORKSPACE_NAME}`."
                    except Exception as err:
                        reply_text = f"⚠️ Error deleting folder: {err}"

                    mem.add_assistant(reply_text)
                    _json_response(self, {
                        "type": "chat",
                        "summary": reply_text,
                        "text": reply_text,
                        "intent": "delete_folder",
                        "session_id": current_session_id
                    }, session_id=current_session_id)
                    return

                # ── Action 3: Workspace Item Inspection ───────────────────────────────
                elif intent_type in ("list_workspace", "list_items"):
                    try:
                        from app.fabric_client import get_workspace_tree
                        tree = get_workspace_tree(ALLOWED_WORKSPACE_ID)
                        folders = tree.get("folders", [])
                        root_items = tree.get("root_items", [])

                        reply_text = f"### 📂 Workspace Items: `{ALLOWED_WORKSPACE_NAME}`\n\n"
                        if folders:
                            reply_text += "**Folders & Contents**:\n"
                            for f in folders:
                                reply_text += f"- 📁 **`{f.get('name')}`** ({len(f.get('items', []))} items)\n"
                                for itm in f.get("items", []):
                                    reply_text += f"  - `{itm.get('name')}` *({itm.get('type')})*\n"
                            reply_text += "\n"
                        if root_items:
                            reply_text += "**Root Workspace Items**:\n"
                            for itm in root_items:
                                reply_text += f"- `{itm.get('name')}` *({itm.get('type')})*\n"
                        if not folders and not root_items:
                            reply_text += "*No items or folders currently found in workspace.*"
                    except Exception as err:
                        reply_text = f"⚠️ Failed to inspect workspace: {err}"

                    mem.add_assistant(reply_text)
                    _json_response(self, {
                        "type": "chat",
                        "summary": reply_text,
                        "text": reply_text,
                        "intent": "list_workspace",
                        "session_id": current_session_id
                    }, session_id=current_session_id)
                    return


                # ── Action 4: Standalone Lakehouse Creation ───────────────────────────
                elif intent_type == "create_lakehouse" or (has_items_to_create and len(intent.get("create", {}).get("lakehouses", [])) == 1 and not intent.get("create", {}).get("notebooks") and not intent.get("create", {}).get("pipeline")):
                    lh_name = intent.get("create", {}).get("lakehouses", [])[0]
                    f_target = intent.get("folder")
                    try:
                        from app.fabric_client import create_item, get_or_create_folder
                        from app.fabric_compiler import compile_lakehouse
                        from app.workspace_cache import invalidate

                        f_id = get_or_create_folder(f_target, ALLOWED_WORKSPACE_ID) if (f_target and f_target != "AI_Project") else None
                        res = create_item(
                            display_name=lh_name,
                            item_type="Lakehouse",
                            workspace_id=ALLOWED_WORKSPACE_ID,
                            folder_id=f_id,
                            description=f"Lakehouse provisioned by Fabric AI Studio ({lh_name})"
                        )
                        if res.get("success"):
                            invalidate(ALLOWED_WORKSPACE_ID)
                            reply_text = (
                                f"### ✅ Lakehouse Created in Fabric\n\n"
                                f"- **Lakehouse**: `{lh_name}`\n"
                                f"- **Fabric ID**: `{res.get('id')}`\n"
                                f"- **Workspace**: `{ALLOWED_WORKSPACE_NAME}`\n"
                                f"- **Folder**: `{f_target or 'Root'}`\n"
                                f"- **Delta Storage**: Initialized & ready for PySpark ingestion."
                            )
                        else:
                            reply_text = f"⚠️ Failed to create lakehouse `{lh_name}`: {res.get('error', 'Unknown error')}"
                    except Exception as err:
                        reply_text = f"⚠️ Error creating lakehouse: {err}"

                    mem.add_assistant(reply_text)
                    _json_response(self, {
                        "type": "chat",
                        "summary": reply_text,
                        "text": reply_text,
                        "intent": "create_lakehouse",
                        "session_id": current_session_id
                    }, session_id=current_session_id)
                    return

                # ── Action 5: Direct Deploy of Active Plan ────────────────────────────
                elif intent_type == "deploy_active_plan" or deploy:
                    from app.session_store import get_conversation_full
                    conv_data = get_conversation_full(current_session_id)
                    active_plan = None
                    if conv_data and conv_data.get("latest_run"):
                        active_plan = conv_data["latest_run"].get("plan_json")
                        if isinstance(active_plan, str):
                            try: active_plan = json.loads(active_plan)
                            except Exception: pass

                    if not active_plan and isinstance(body.get("plan"), dict):
                        active_plan = body.get("plan")

                    if not active_plan:
                        reply_text = "⚠️ No active architecture plan found in this session to deploy. Please generate an architecture plan first."
                        _json_response(self, {"type": "chat", "text": reply_text, "summary": reply_text}, session_id=current_session_id)
                        return

                    import uuid
                    deploy_run_id = uuid.uuid4().hex[:8]
                    with _RUNS_LOCK:
                        _RUNS[deploy_run_id] = {"status": "deploying", "plan": active_plan, "steps": []}
                    mem.track_run(deploy_run_id, status="deploying", plan_json=active_plan)
                    t = threading.Thread(target=_deploy_architect_async, args=(deploy_run_id, active_plan, current_session_id), daemon=True)
                    t.start()

                    reply_text = (
                        f"### 🚀 Deploying Architecture to Microsoft Fabric\n\n"
                        f"- **Target Folder**: `{active_plan.get('folder', 'AI_Test_Folder')}`\n"
                        f"- **Workspace**: `{ALLOWED_WORKSPACE_NAME}`\n"
                        f"- **Run ID**: `{deploy_run_id}`\n\n"
                        f"Live provisioning Lakehouses, PySpark Notebooks, and Data Pipelines into Fabric OneLake..."
                    )
                    mem.add_assistant(reply_text)
                    _json_response(self, {
                        "type": "deploying",
                        "run_id": deploy_run_id,
                        "status": "deploying",
                        "plan": active_plan,
                        "text": reply_text,
                        "summary": "Deployment initiated.",
                        "session_id": current_session_id
                    }, session_id=current_session_id)
                    return

                # ── Action 6: Conversational Chat or Q&A ─────────────────────────────
                if intent_type in ("conversation", "question", "general", "architecture_qa") and not has_items_to_create:
                    qa_system = (
                        "You are Fabric AI, an expert Microsoft Fabric Data Engineering and Architecture Assistant.\n"
                        "Answer the user's questions clearly, naturally, and concisely using clean Markdown paragraphs, bullet points, and code blocks.\n"
                        "Avoid generating large comparison tables unless the user explicitly asks for a tabular comparison.\n"
                        "If the user asks questions or follow-ups about previous architectures, lakehouses, tables, or PySpark code "
                        "generated in this conversation session, use the conversation history to provide insightful, concrete answers."
                    )
                    chat_msgs = [{"role": "system", "content": qa_system}]
                    chat_msgs.extend([m for m in llm_messages if m.get("role") != "system"])
                    if not chat_msgs or chat_msgs[-1].get("content") != prompt:
                        chat_msgs.append({"role": "user", "content": prompt})

                    reply_text = chat(chat_msgs, complexity="standard", target_model=target_model, effort=effort)
                    mem.add_assistant(reply_text)
                    _json_response(self, {
                        "type": "chat",
                        "summary": reply_text,
                        "text": reply_text,
                        "intent": intent_type,
                        "session_id": current_session_id
                    }, session_id=current_session_id)
                    return

                # ── Action 6: Architecture Provisioning (Multi-Agent or Fast Path) ──
                f_name = intent.get("folder") or folder_name
                from app.orchestrator import is_complex_provision

                if is_complex_provision(intent):
                    # Full 4-stage multi-agent pipeline (Planner → Workers → Builder → Auditor)
                    from app.agent_pipeline import run_pipeline
                    active_plan = None
                    try:
                        from app.session_store import get_conversation_full
                        conv_data = get_conversation_full(current_session_id)
                        if conv_data and conv_data.get("latest_run"):
                            active_plan = conv_data["latest_run"].get("plan_json")
                            if isinstance(active_plan, str):
                                try: active_plan = json.loads(active_plan)
                                except Exception: active_plan = None
                    except Exception:
                        active_plan = None

                    plan, audit_messages = run_pipeline(
                        prompt=prompt,
                        session_id=current_session_id,
                        history=llm_messages,
                        current_plan=active_plan
                    )
                    plan["type"] = "plan"
                    plan["run_id"] = plan.get("run_id", run_id)
                    plan["audit_messages"] = audit_messages or []

                    # Record audit messages in memory history
                    for audit_msg in (audit_messages or []):
                        if audit_msg:
                            mem.add_assistant(f"🔍 [Pipeline Audit] {audit_msg}")
                else:
                    # Fast single-item path (existing orchestrator)
                    notebooks_req = intent.get("create", {}).get("notebooks", [])
                    codes = generate_notebook_codes(notebooks_req, f_name)
                    plan = assemble_plan(intent, codes, run_id, prompt=prompt)
                    plan["type"] = "plan"

            except Exception as e:
                print(f"[LLM ARCHITECT ERROR] {e}")
                lower_p = prompt.lower().strip()
                if lower_p in ("hi", "hello", "hey", "help", "who are you", "who are you?") or ("what" in lower_p and "is" in lower_p and "create" not in lower_p):
                    from app.llm_router import chat
                    reply_text = chat([
                        {"role": "system", "content": "You are Fabric AI Studio Assistant. Respond helpfully to the user in clean Markdown."},
                        {"role": "user", "content": prompt}
                    ], complexity="fast")
                    mem.add_assistant(reply_text)
                    _json_response(self, {"type": "chat", "summary": reply_text, "text": reply_text}, session_id=current_session_id)
                    return

                err_msg = f"⚠️ **Architecture Synthesis Error**: {str(e)}\n\nPlease refine your prompt or retry with specific item names."
                mem.add_assistant(err_msg)
                _json_response(self, {
                    "type": "error",
                    "error": str(e),
                    "summary": err_msg,
                    "text": err_msg,
                    "session_id": current_session_id
                }, session_id=current_session_id)
                return

            plan_markdown = format_plan_markdown(plan)
            mem.add_assistant(plan_markdown)
            mem.track_run(plan["run_id"], status="planned", plan_json=plan)
            from app.memory import record_plan_facts
            record_plan_facts(current_session_id, plan)

            if deploy:
                with _RUNS_LOCK:
                    _RUNS[run_id] = {"status": "deploying", "plan": plan, "steps": []}
                mem.track_run(run_id, status="deploying", plan_json=plan)
                t = threading.Thread(target=_deploy_architect_async, args=(run_id, plan, current_session_id), daemon=True)
                t.start()
                _json_response(self, {"run_id": run_id, "status": "deploying", "plan": plan}, session_id=current_session_id)
            else:
                _json_response(self, plan, session_id=current_session_id)
        # ── Copilot Action: Create Lakehouse ────────────────────────────────
        elif path == "/api/copilot/create_lakehouse":
            lakehouse_name = body.get("lakehouse_name")
            layer = body.get("layer", "Bronze")
            if not lakehouse_name:
                _json_response(self, {"error": "lakehouse_name is required"}, 400, session_id=current_session_id)
                return

            res = create_item(
                display_name=lakehouse_name,
                item_type="Lakehouse",
                workspace_id=ALLOWED_WORKSPACE_ID,
                description=f"Medallion {layer} Lakehouse provisioned via Copilot"
            )
            if res.get("success"):
                invalidate(ALLOWED_WORKSPACE_ID)
                _json_response(self, {
                    "success": True,
                    "message": f"Lakehouse '{lakehouse_name}' ({layer} layer) successfully created in workspace '{ALLOWED_WORKSPACE_NAME}'.",
                    "item_id": res.get("id"),
                    "workspace": ALLOWED_WORKSPACE_NAME
                }, session_id=current_session_id)
            else:
                _json_response(self, {
                    "success": False,
                    "error": res.get("error", "Failed to create lakehouse on Microsoft Fabric.")
                }, 500, session_id=current_session_id)

        # ── MCP JSON-RPC 2.0 Dispatcher ──────────────────────────────────────
        elif path in ("/messages", "/mcp"):
            req_id = body.get("id")
            method = body.get("method")
            params = body.get("params", {})

            if method == "initialize":
                _json_response(self, {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "protocolVersion": "2024-11-05",
                        "capabilities": {"tools": {}},
                        "serverInfo": {"name": "Fabric AI Studio", "version": "1.0.0"}
                    }
                }, session_id=current_session_id)

            elif method == "notifications/initialized":
                _json_response(self, {"jsonrpc": "2.0", "result": {}}, session_id=current_session_id)

            elif method == "ping":
                _json_response(self, {"jsonrpc": "2.0", "id": req_id, "result": {}}, session_id=current_session_id)

            elif method == "tools/list":
                _json_response(self, {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "result": {
                        "tools": [
                            {
                                "name": "get_fabric_status",
                                "description": "Check Fabric AI Studio status, active workspace name, and Azure authentication state.",
                                "inputSchema": {"type": "object", "properties": {}}
                            },
                            {
                                "name": "list_workspace_items_summary",
                                "description": "List all deployed Lakehouses, PySpark Notebooks, and Data Pipelines in the Fabric workspace.",
                                "inputSchema": {"type": "object", "properties": {}}
                            },
                            {
                                "name": "create_lakehouse",
                                "description": "Create a new Medallion Delta Lakehouse in Microsoft Fabric.",
                                "inputSchema": {
                                    "type": "object",
                                    "required": ["lakehouse_name"],
                                    "properties": {
                                        "lakehouse_name": {"type": "string", "description": "Name of the lakehouse, e.g. lh_sales_bronze"},
                                        "layer": {"type": "string", "description": "Medallion layer: Bronze, Silver, or Gold"}
                                    }
                                }
                            }
                        ]
                    }
                }, session_id=current_session_id)

            elif method == "tools/call":
                tool_name = params.get("name")
                tool_args = params.get("arguments", {})

                if tool_name == "get_fabric_status":
                    from app.auth import get_auth_status
                    auth = get_auth_status()
                    user = auth.get("user_identity", "Authenticated User")
                    items_data = list_workspace_items(ALLOWED_WORKSPACE_ID)
                    items_list = items_data.get("items", []) if isinstance(items_data, dict) else []
                    msg = f"Fabric AI Studio is ONLINE. Active Workspace: {ALLOWED_WORKSPACE_NAME} ({len(items_list)} items). Authenticated User: {user}."
                    _json_response(self, {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": {"content": [{"type": "text", "text": msg}]}
                    }, session_id=current_session_id)

                elif tool_name == "list_workspace_items_summary":
                    items_data = list_workspace_items(ALLOWED_WORKSPACE_ID)
                    items_list = items_data.get("items", []) if isinstance(items_data, dict) else []
                    lakehouses = [it.get("displayName") for it in items_list if it.get("type") == "Lakehouse"]
                    notebooks = [it.get("displayName") for it in items_list if it.get("type") == "Notebook"]
                    pipelines = [it.get("displayName") for it in items_list if it.get("type") == "DataPipeline"]
                    msg = f"Workspace '{ALLOWED_WORKSPACE_NAME}' Summary:\n- Lakehouses ({len(lakehouses)}): {', '.join(lakehouses[:10])}\n- Notebooks ({len(notebooks)}): {', '.join(notebooks[:10])}\n- Pipelines ({len(pipelines)}): {', '.join(pipelines[:10])}"
                    _json_response(self, {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": {"content": [{"type": "text", "text": msg}]}
                    }, session_id=current_session_id)

                elif tool_name == "create_lakehouse":
                    lh_name = tool_args.get("lakehouse_name")
                    layer = tool_args.get("layer", "Bronze")
                    res = create_item(
                        display_name=lh_name,
                        item_type="Lakehouse",
                        workspace_id=ALLOWED_WORKSPACE_ID,
                        description=f"Medallion {layer} Lakehouse provisioned via MCP"
                    )
                    if res.get("success"):
                        invalidate(ALLOWED_WORKSPACE_ID)
                        msg = f"Successfully created Lakehouse '{lh_name}' ({layer} layer) with ID {res.get('id')} in workspace '{ALLOWED_WORKSPACE_NAME}'."
                    else:
                        msg = f"Failed to create lakehouse: {res.get('error')}"
                    _json_response(self, {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "result": {"content": [{"type": "text", "text": msg}]}
                    }, session_id=current_session_id)

                else:
                    _json_response(self, {
                        "jsonrpc": "2.0",
                        "id": req_id,
                        "error": {"code": -32601, "message": f"Tool '{tool_name}' not found."}
                    }, session_id=current_session_id)

            else:
                _json_response(self, {
                    "jsonrpc": "2.0",
                    "id": req_id,
                    "error": {"code": -32601, "message": f"Method '{method}' not found."}
                }, session_id=current_session_id)

        else:
            _json_response(self, {"error": f"Unknown endpoint: {path}"}, 404, session_id=current_session_id)


# ── Server Startup ────────────────────────────────────────────────────────────

class _ReuseAddrServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True
    daemon_threads = True


if __name__ == "__main__":
    os.chdir(BASE_DIR)
    print("======================================================")
    print("         Fabric AI Studio Backend (Refactored)        ")
    print(f"  Workspace: {ALLOWED_WORKSPACE_NAME}")
    print(f"  URL:       http://localhost:{PORT}")
    print("======================================================")

    with _ReuseAddrServer(("", PORT), FabricAIHandler) as httpd:
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\n[SERVER] Shutting down gracefully...")
