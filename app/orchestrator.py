"""
app/orchestrator.py
-------------------
Architect Agent LLM orchestrator for Fabric AI Studio.
Phase 1: Parse user intent via LLM.
Phase 2: Generate PySpark code for each notebook concurrently.
Phase 3: Assemble plan dictionary.
"""

import concurrent.futures
import json
import re
import uuid

from app.llm_router import chat
from app.skill_loader import load_skills

_INTENT_SYSTEM = """You are the Microsoft Fabric Architecture Agent.
You are powered by enterprise data engineering runbooks and specialized Microsoft Fabric skills.
Analyze the user request and return a JSON object with:
{
  "intent": "provision" | "create_lakehouse" | "create_notebook" | "create_pipeline" | "create_folder" | "delete_folder" | "delete_item" | "list_workspace" | "schedule_pipeline" | "deploy_active_plan" | "conversation",
  "folder": string | null,
  "create": {
    "lakehouses": [string],
    "environment": string | null,
    "notebooks": [
      {
        "name": string,
        "layer": "Bronze" | "Silver" | "Gold" | "Notebook",
        "description": string
      }
    ],
    "tables": [
      {
        "name": string,
        "lakehouse": string,
        "layer": "Bronze" | "Silver" | "Gold",
        "columns": [{"name": string, "type": string, "pk": boolean, "nullable": boolean}]
      }
    ],
    "pipeline": {"name": string, "schedule": string} | null
  },
  "edit": {
    "delete_items": [string],
    "rename_items": [{"old": string, "new": string}]
  },
  "summary": string
}

IMPORTANT RULES:
1. If the user request asks for more than one thing (e.g., folder + notebook, notebook + pipeline, lakehouse + transform), ALWAYS set "intent": "provision" and populate all items in "create".
2. If the user specifies a schedule (e.g., "at 10:30 am daily" or "11:00 PM daily"), always include it in "pipeline.schedule".
3. Extract the exact notebook names specified by the user (e.g., "nb_page_rank", "nb_dijkstra_shortest_path"). Never omit requested notebooks.
4. Standalone algorithms (sorting, search, graph, math, ML transforms) that are not multi-tier Medallion ETL should have "layer": "Notebook".
Return ONLY valid JSON.
"""


def _extract_json_safe(raw: str) -> dict | None:
    """Extracts and parses JSON object from LLM response safely."""
    if not raw or not raw.strip():
        return None

    clean = raw.strip()

    # 1. Try parsing directly
    try:
        return json.loads(clean)
    except Exception:
        pass

    # 2. Try markdown fenced block
    fence_match = re.search(r"```(?:json)?\s*([\s\S]*?)\s*```", clean, re.IGNORECASE)
    if fence_match:
        try:
            return json.loads(fence_match.group(1).strip())
        except Exception:
            pass

    # 3. Try outermost curly braces
    first_brace = clean.find("{")
    last_brace = clean.rfind("}")
    if first_brace != -1 and last_brace != -1 and last_brace > first_brace:
        json_candidate = clean[first_brace:last_brace + 1]
        try:
            return json.loads(json_candidate)
        except Exception:
            # Try removing trailing commas
            cleaned_commas = re.sub(r",\s*([\}\]])", r"\1", json_candidate)
            try:
                return json.loads(cleaned_commas)
            except Exception:
                pass

    return None


def _heuristic_intent_fallback(prompt: str) -> dict:
    """Intelligently extracts folder, notebooks, lakehouses, and pipeline from prompt if LLM JSON fails."""
    folder = "AI_Test_Folder"
    fm = re.search(r"\b(?:project\s+folder|folder|project|directory)\s+(?:named\s+|called\s+)?['\"]?([A-Za-z0-9_\-]+)['\"]?", prompt, re.IGNORECASE)
    if fm and fm.group(1).lower() not in ("named", "called", "folder", "project"):
        folder = fm.group(1).strip()
    elif fm:
        fm2 = re.search(r"\b(?:named|called)\s+['\"]?([A-Za-z0-9_\-]+)['\"]?", prompt, re.IGNORECASE)
        if fm2:
            folder = fm2.group(1).strip()

    # Discover explicit notebooks with descriptions (e.g. - nb_page_rank: Implement ...)
    notebooks = []
    nb_lines = re.findall(r"[-*•]?\s*(nb_[a-zA-Z0-9_\-]+)\s*[:\-–]\s*([^\n\r]+)", prompt, re.IGNORECASE)
    if nb_lines:
        for nb_name, desc in nb_lines:
            layer = "Notebook"
            if any(k in nb_name.lower() for k in ("bronze", "raw")):
                layer = "Bronze"
            elif any(k in nb_name.lower() for k in ("silver", "clean", "merge")):
                layer = "Silver"
            elif any(k in nb_name.lower() for k in ("gold", "star", "agg", "metric")):
                layer = "Gold"
            notebooks.append({"name": nb_name.strip(), "layer": layer, "description": desc.strip()})
    else:
        # Fallback to any nb_ tokens
        nb_tokens = list(dict.fromkeys(re.findall(r"\b(nb_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
        for nb_tok in nb_tokens:
            notebooks.append({"name": nb_tok, "layer": "Notebook", "description": f"PySpark implementation for {nb_tok}"})

    if not notebooks:
        notebooks = [{"name": f"nb_{folder.lower()}_transform", "layer": "Notebook", "description": f"PySpark implementation in {folder}"}]

    # Discover Lakehouses
    lakehouses = list(dict.fromkeys(re.findall(r"\b(lh_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))

    # Discover Pipeline
    pl_match = re.search(r"\b(pl_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)
    pl_name = pl_match.group(1) if pl_match else f"pl_{folder.lower()}_etl"

    # Discover Schedule
    from app.ingestion_planner import parse_schedule
    sched_info = parse_schedule(prompt)
    sched_str = sched_info.get("human", sched_info.get("cron", "Daily at 10:30 AM UTC"))

    return {
        "intent": "provision",
        "folder": folder,
        "create": {
            "lakehouses": lakehouses,
            "environment": None,
            "notebooks": notebooks,
            "tables": [],
            "pipeline": {
                "name": pl_name,
                "schedule": sched_str
            }
        },
        "edit": {"delete_items": [], "rename_items": []},
        "summary": f"Provisioned architecture for {folder} with {len(notebooks)} PySpark notebook(s) and pipeline {pl_name}."
    }


def parse_intent(
    prompt: str,
    history: list[dict] | None = None,
    target_model: str | None = None,
    effort: str = "medium",
    session_id: str | None = None,
) -> dict:
    """Extracts structured intent from user prompt using LLM grounded with specialized Fabric skills."""
    # Dynamically select and load relevant grounded skills
    selected_skills = ["using_fabric_skills"]
    lower_prompt = prompt.lower()
    if any(k in lower_prompt for k in ("medallion", "lakehouse", "bronze", "silver", "gold", "star schema", "dimension", "layer")):
        selected_skills.append("fabric_medallion_architecture")
    if any(k in lower_prompt for k in ("schedule", "cron", "pipeline", "dag", "frequency", "daily", "hourly", "ingest", "ingestion")):
        selected_skills.append("fabric_ingestion_and_scheduling")
    if any(k in lower_prompt for k in ("sql", "transpile", "oracle", "sap", "t-sql", "tsql", "snowflake", "lineage", "ast")):
        selected_skills.append("sql_transpilation_and_lineage")
    if any(k in lower_prompt for k in ("quality", "test", "validate", "expectation", "anomaly", "constraint", "schema check")):
        selected_skills.append("fabric_data_quality_and_testing")
    if any(k in lower_prompt for k in ("delete", "drop", "safe delete", "governance", "impact", "blast radius", "archive")):
        selected_skills.append("fabric_governance_and_safe_delete")

    skills_context = load_skills(selected_skills)
    system_prompt = _INTENT_SYSTEM + ("\n\n" + skills_context if skills_context else "")

    messages = [{"role": "system", "content": system_prompt}]
    if history:
        messages.extend(history[-6:])
    messages.append({"role": "user", "content": prompt})

    raw = chat(
        messages,
        complexity="standard",
        max_tokens=2048,
        target_model=target_model,
        effort=effort,
        session_id=session_id,
    )

    # Fast regex match for direct deploy
    deploy_match = re.search(r"\b(?:deploy|launch|provision|execute)\s+(?:this|the|current|active)?\s*(?:plan|architecture|pipeline|items)?\b", prompt, re.IGNORECASE)
    if deploy_match and not any(kw in prompt.lower() for kw in ("create", "build", "make", "add", "generate", "folder", "notebook", "pipeline")):
        return {"intent": "deploy_active_plan", "summary": "Deploy active architecture plan to Microsoft Fabric."}

    parsed = _extract_json_safe(raw)
    if parsed and isinstance(parsed, dict) and (parsed.get("create") or parsed.get("intent")):
        return parsed

    # Intelligent heuristic fallback when LLM output is malformed
    return _heuristic_intent_fallback(prompt)


def _generate_single_notebook_code(
    nb: dict,
    folder: str,
    target_model: str | None = None,
    effort: str = "medium",
    session_id: str | None = None,
) -> str:
    """Generates PySpark/Python code for a single notebook."""
    nb_name = nb.get("name", "nb_transform")
    desc = nb.get("description", "PySpark data transformation")
    layer = nb.get("layer", "")

    # Distinguish pure algorithms/utilities from enterprise Medallion ETL
    is_algo = any(kw in f"{nb_name} {desc}".lower() for kw in ("sort", "search", "tree", "graph", "algorithm", "algo", "matrix", "calc", "math", "test", "demo", "sample", "benchmark"))
    is_medallion = layer.lower() in ("bronze", "silver", "gold") or any(kw in f"{nb_name} {desc}".lower() for kw in ("medallion", "lakehouse", "upsert", "dedup", "star schema", "ingestion"))

    if is_algo and not is_medallion:
        sys_prompt = (
            "You are an expert Python and PySpark engineer writing Microsoft Fabric notebooks.\n"
            "The user requested an algorithm, utility, or computational logic notebook.\n"
            "Write clean, elegant, self-contained Python/PySpark code with cell structure comments (# CELL).\n"
            "Focus directly on the requested algorithm with clear step-by-step logic, sample input data, and driver execution printouts.\n"
            "DO NOT create fake database tables, dummy Delta read/writes, or unnecessary DBFS mounts unless explicitly requested.\n"
            "Return ONLY Python code, no markdown fences."
        )
    else:
        # Load Medallion / Data quality guidelines
        medallion_skill = load_skills(["fabric_medallion_architecture", "fabric_data_quality_and_testing"])
        sys_prompt = (
            "You are an expert PySpark engineer writing Microsoft Fabric production data engineering notebooks.\n"
            "Generate production-grade, executable PySpark code with cell structure comments (# CELL).\n"
            "Adhere to Microsoft Fabric best practices: Delta Lake format, spark.read, spark.write, and error handling.\n"
            + (f"\n{medallion_skill}\n" if medallion_skill else "") +
            "Return ONLY Python code, no markdown fences."
        )

    user_prompt = f"Write PySpark code for notebook '{nb_name}' in project folder '{folder}'. Description: {desc}"
    msgs = [{"role": "system", "content": sys_prompt}, {"role": "user", "content": user_prompt}]
    code = chat(
        msgs,
        complexity="standard",
        max_tokens=2048,
        target_model=target_model,
        effort=effort,
        session_id=session_id,
    )
    clean_code = code.strip()
    if clean_code.startswith("```"):
        lines = clean_code.split("\n")
        if lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].startswith("```"):
            lines = lines[:-1]
        clean_code = "\n".join(lines).strip()
    return clean_code


def generate_notebook_codes(
    notebooks: list[dict],
    folder: str,
    target_model: str | None = None,
    effort: str = "medium",
    session_id: str | None = None,
) -> dict[str, str]:
    """Generates PySpark code for all notebooks in parallel."""
    codes = {}
    if not notebooks:
        return codes

    with concurrent.futures.ThreadPoolExecutor(max_workers=min(len(notebooks), 4)) as pool:
        future_map = {
            pool.submit(_generate_single_notebook_code, nb, folder, target_model, effort, session_id): nb.get("name", f"nb_{i}")
            for i, nb in enumerate(notebooks)
        }
        for future in concurrent.futures.as_completed(future_map):
            nb_name = future_map[future]
            try:
                codes[nb_name] = future.result()
            except Exception as e:
                codes[nb_name] = f"# Code generation error: {e}\nprint('Error')\n"
    return codes


def assemble_plan(intent: dict, notebook_codes: dict, run_id: str | None = None, prompt: str = "") -> dict:
    """
    Merges Phase 1 intent + Phase 2 per-notebook codes into the final
    plan dict consumed by _deploy_architect_async().
    """
    run_id = run_id or uuid.uuid4().hex[:8]
    create = intent.get("create", {})
    folder = intent.get("folder", "AI_Project")
    has_medallion = bool(create.get("lakehouses"))

    raw_notebooks = create.get("notebooks", [])
    processed_notebooks = []
    for nb in raw_notebooks:
        nb_name = nb.get("name", "nb_notebook")
        code = notebook_codes.get(nb_name, f"# {nb_name}\nprint('Done.')\n")
        processed_notebooks.append({
            "name":         nb_name,
            "description":  nb.get("description", ""),
            "layer":        _infer_layer(nb_name, has_medallion),
            "pyspark":      code,
            "pyspark_code": code,
        })

    notebooks_preview = [
        {"name": nb["name"], "pyspark_code": nb["pyspark_code"]}
        for nb in processed_notebooks
    ]

    pipeline_raw = create.get("pipeline")
    from app.ingestion_planner import parse_schedule
    sched_info = parse_schedule(prompt) if prompt else {"cron": "0 2 * * *", "human": "Daily at 02:00 UTC"}

    if isinstance(pipeline_raw, str):
        pipeline = {"name": pipeline_raw, "schedule": sched_info}
    elif isinstance(pipeline_raw, dict):
        pipeline = dict(pipeline_raw)
        if not pipeline.get("schedule"):
            pipeline["schedule"] = sched_info
    elif pipeline_raw is None and "pipeline" in prompt.lower():
        pipeline = {"name": f"pl_{folder.lower()}_etl", "schedule": sched_info}
    else:
        pipeline = None

    raw_tables = create.get("tables", [])
    flat_schema = []
    if isinstance(raw_tables, list):
        for tbl in raw_tables:
            tbl_name = tbl.get("name", "table")
            tbl_layer = tbl.get("layer", "Bronze")
            tbl_lh = tbl.get("lakehouse", "")
            for col in tbl.get("columns", []):
                flat_schema.append({
                    "name": col.get("name"),
                    "type": col.get("type", "STRING"),
                    "pk": bool(col.get("pk", False)),
                    "nullable": bool(col.get("nullable", True)),
                    "layer": tbl_layer,
                    "table": tbl_name,
                    "lakehouse": tbl_lh,
                })

    plan = {
        "run_id":            run_id,
        "folder":            folder,
        "lakehouses":        create.get("lakehouses", []),
        "environment":       create.get("environment"),
        "notebooks":         processed_notebooks,
        "notebooks_preview": notebooks_preview,
        "tables":            raw_tables,
        "schema":            flat_schema,
        "pipeline":          pipeline,
        "pyspark_code":      processed_notebooks[0]["pyspark_code"] if processed_notebooks else "",
        "summary":           intent.get("summary", f"Fabric items provisioned for {folder}."),
        "status":            "planned",
        "_intent":           intent.get("intent", "provision"),
        "_edit":             intent.get("edit", {}),
    }
    return plan


def _infer_layer(nb_name: str, has_medallion: bool = False) -> str:
    """Infer Bronze/Silver/Gold Medallion layer or default to Transform/Notebook."""
    name = nb_name.lower()
    if "bronze" in name or "_raw" in name:
        return "Bronze"
    if "silver" in name or "_clean" in name or "_dedup" in name:
        return "Silver"
    if "gold" in name or "_agg" in name or "_metric" in name or "_analytics" in name:
        return "Gold"
    return "Silver" if has_medallion else "Notebook"


def is_complex_provision(intent: dict) -> bool:
    """
    Returns True when the intent requires the full 4-stage multi-agent pipeline.
    Simple single-item intents (folder-only, single notebook, schedule update, delete)
    stay on the fast existing path.

    Complexity triggers:
    - 2+ notebooks requested
    - 1+ lakehouse AND 1+ notebook together
    - Medallion layers (Bronze/Silver/Gold) detected
    - Notebook(s) + pipeline together (code generation + scheduling in one shot)
    """
    create = intent.get("create", {})
    notebooks = create.get("notebooks", [])
    lakehouses = create.get("lakehouses", [])
    pipeline = create.get("pipeline")

    nb_count = len(notebooks)
    lh_count = len(lakehouses)

    # Two or more notebooks: always use multi-agent
    if nb_count >= 2:
        return True

    # Any Medallion layers: sequential chaining needed
    layers = [nb.get("layer", "") for nb in notebooks]
    if any(layer in ("Bronze", "Silver", "Gold") for layer in layers):
        return True

    # Lakehouse + notebook together
    if lh_count >= 1 and nb_count >= 1:
        return True

    # Notebook + pipeline: code gen + AST assembly
    if nb_count == 1 and pipeline:
        return True

    return False
