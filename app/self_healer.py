"""
app/self_healer.py
------------------
Closed-Loop Self-Healing Engine for Microsoft Fabric.

Provides:
  1. diagnose_error(error_trace: str, code: str) -> dict with root_cause & patch_strategy.
  2. auto_heal_notebook(notebook_id: str, error_trace: str, workspace_id: str) -> dict with success & new_code.
  3. auto_heal_pipeline(pipeline_id: str, run_id: str, error_trace: str, workspace_id: str) -> dict with remediation status.
"""

import json
import logging
from typing import Any
from app.llm_router import chat_json, chat
from app.skill_loader import load_skills
from app.fabric_client import (
    get_item_definition,
    update_definition,
    trigger_pipeline_run,
)
from app.fabric_compiler import compile_notebook_update

logger = logging.getLogger("fabric_ai.self_healer")

_HEALER_SYSTEM = """\
You are an expert Microsoft Fabric PySpark and Data Factory Self-Healing Diagnostic Agent.

Given a failing PySpark code snippet and the runtime error/stack trace:
1. Diagnose the exact root cause (AnalysisException, DeltaMergeMismatch, DataTypeCasting, MissingColumn, etc.).
2. Write the corrected, production-ready PySpark code that resolves the error completely.
3. Ensure all best practices (deduplication, audit columns, Delta MERGE) are preserved.

Output EXACTLY this JSON schema:
{
  "error_category": "SyntaxError | SchemaMismatch | DuplicateKeyMerge | AuthenticationError | ResourceLimit",
  "root_cause": "<1-2 sentence explanation of why the Spark job failed>",
  "fix_strategy": "<1-2 sentence description of the fix applied>",
  "patched_pyspark_code": "<complete, runnable, corrected PySpark code>"
}"""


def diagnose_and_patch_code(code: str, error_trace: str, notebook_name: str = "notebook") -> dict[str, Any]:
    """
    Diagnoses runtime failure and produces a patched PySpark script.
    """
    skills_context = load_skills(["pattern_error_handling_self_healing", "pattern_incremental_cdc_watermark"])
    
    prompt = (
        f"Notebook Name: {notebook_name}\n\n"
        f"--- FAILING PYSPARK CODE ---\n{code}\n\n"
        f"--- SPARK RUNTIME ERROR / STACK TRACE ---\n{error_trace}\n\n"
        "Diagnose the error and provide the patched PySpark code."
    )
    
    system_prompt = _HEALER_SYSTEM
    if skills_context:
        system_prompt += f"\n\n{skills_context}"

    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user",   "content": prompt},
    ]

    try:
        diagnosis = chat_json(messages, complexity="high", max_tokens=4096)
        return {
            "success": True,
            "diagnosis": diagnosis,
            "patched_code": diagnosis.get("patched_pyspark_code", code)
        }
    except Exception as e:
        logger.error(f"[SELF-HEALER] Diagnosis failed: {e}")
        return {
            "success": False,
            "error": str(e),
            "patched_code": code
        }


def auto_heal_notebook(notebook_id: str, error_trace: str, workspace_id: str, notebook_name: str = "nb_notebook") -> dict[str, Any]:
    """
    Complete closed-loop self-healing execution:
    1. Fetches current notebook definition.
    2. Diagnoses Spark runtime error.
    3. Hot-patches the definition.
    4. Pushes Base64 update to Microsoft Fabric.
    """
    logger.info(f"[SELF-HEALER] Starting auto-remediation for notebook {notebook_id}...")
    import base64
    
    # 1. Get current definition
    raw_def = get_item_definition(notebook_id, workspace_id)
    current_code = ""

    parts = []
    if isinstance(raw_def, list):
        parts = raw_def
    elif isinstance(raw_def, dict):
        parts = raw_def.get("definition", {}).get("parts", []) or raw_def.get("parts", [])

    for part in parts:
        path = part.get("path", "")
        payload_b64 = part.get("payload", "")
        if path == "notebook-content.py" and payload_b64:
            try:
                current_code = base64.b64decode(payload_b64).decode("utf-8")
                break
            except Exception:
                pass
        elif path == "notebook-content.ipynb" and payload_b64:
            try:
                payload = base64.b64decode(payload_b64).decode("utf-8")
                nb_json = json.loads(payload)
                cells = nb_json.get("cells", [])
                current_code = "\n".join("".join(c.get("source", [])) for c in cells if c.get("cell_type") == "code")
                break
            except Exception:
                pass

    if not current_code:
        current_code = f"# PySpark code for {notebook_name}\nfrom pyspark.sql import SparkSession\nspark = SparkSession.builder.getOrCreate()\n"

    # 2. Diagnose & patch
    patch_result = diagnose_and_patch_code(current_code, error_trace, notebook_name)
    if not patch_result.get("success"):
        return {"success": False, "message": "Failed to synthesize patch", "error": patch_result.get("error")}

    patched_code = patch_result.get("patched_code", current_code)

    # 3. Compile Base64 update
    update_payload = compile_notebook_update(pyspark_code=patched_code, display_name=notebook_name)

    # 4. Push update to Microsoft Fabric
    update_res = update_definition(notebook_id, update_payload, workspace_id)
    is_success = bool(update_res)
    
    return {
        "success": is_success,
        "notebook_id": notebook_id,
        "diagnosis": patch_result.get("diagnosis"),
        "remediation_status": "HOT_PATCHED" if is_success else "UPDATE_FAILED",
        "message": f"Notebook {notebook_name} successfully hot-patched and deployed to Fabric." if is_success else f"Failed to upload hot-patched definition for {notebook_name}."
    }

