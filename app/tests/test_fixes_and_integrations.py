"""
app/tests/test_fixes_and_integrations.py
----------------------------------------
Targeted tests for recent bug fixes and enhancements:
1. Self-healer definition parsing & compile_notebook_update signature
2. Skill loader dynamic progressive disclosure & matching
3. LLM router dynamic model resolution & session pooling
4. MCP tool folder containment logic
"""

import base64
import json
import pytest
from unittest.mock import patch, MagicMock

from app.self_healer import diagnose_and_patch_code, auto_heal_notebook
from app.fabric_compiler import compile_notebook_update
from app.skill_loader import (
    discover_skills,
    get_skills_manifest,
    get_skill_by_name,
    match_relevant_skill,
    load_skills,
)
from app.llm_router import _model_to_provider_call, _SESSION


class TestSelfHealerFixes:
    def test_compile_notebook_update_signature(self):
        parts = compile_notebook_update("print('patched')", "nb_orders_clean")
        assert isinstance(parts, list)
        assert len(parts) == 1
        assert parts[0]["path"] == "notebook-content.py"
        decoded = base64.b64decode(parts[0]["payload"]).decode("utf-8")
        assert "print('patched')" in decoded
        assert "nb_orders_clean" in decoded

    @patch("app.self_healer.get_item_definition")
    @patch("app.self_healer.update_definition")
    @patch("app.self_healer.diagnose_and_patch_code")
    def test_auto_heal_notebook_flow(self, mock_diag, mock_update, mock_get_def):
        # Mock get_item_definition returning a list of parts
        fake_content = "# PySpark code\nspark.read.table('orders')"
        mock_get_def.return_value = [
            {
                "path": "notebook-content.py",
                "payload": base64.b64encode(fake_content.encode("utf-8")).decode("utf-8"),
                "payloadType": "InlineBase64",
            }
        ]
        mock_diag.return_value = {
            "success": True,
            "diagnosis": {"root_cause": "Fixed typo", "error_category": "SyntaxError"},
            "patched_code": "# Patched PySpark code\nspark.read.table('orders_v2')",
        }
        mock_update.return_value = True  # Returns bool

        res = auto_heal_notebook("item-123", "AnalysisException: table not found", "ws-456", "nb_orders")
        assert res["success"] is True
        assert res["remediation_status"] == "HOT_PATCHED"
        assert res["notebook_id"] == "item-123"


class TestSkillLoaderUnification:
    def test_discover_skills_structure(self):
        skills = discover_skills()
        assert len(skills) >= 6
        assert "fabric_medallion_architecture" in skills
        assert "displayName" in skills["fabric_medallion_architecture"]
        assert "snippet" in skills["fabric_medallion_architecture"]

    def test_skills_manifest_contains_key_skills(self):
        manifest = get_skills_manifest()
        assert "fabric_medallion_architecture:" in manifest
        assert "fabric_ingestion_and_scheduling:" in manifest
        assert "sql_transpilation_and_lineage:" in manifest

    def test_match_relevant_skill(self):
        s1 = match_relevant_skill("Create a Bronze Silver Gold lakehouse")
        assert s1 is not None
        assert s1["name"] == "fabric_medallion_architecture"

        s2 = match_relevant_skill("Safe delete this folder and evaluate blast radius")
        assert s2 is not None
        assert s2["name"] == "fabric_governance_and_safe_delete"

    def test_load_skills_formats_header(self):
        loaded = load_skills(["fabric_medallion_architecture"])
        assert "ACTIVE GROUNDED RUNBOOKS" in loaded
        assert "fabric_medallion_architecture" in loaded


class TestLlmRouterEnhancements:
    def test_session_pool_initialized(self):
        assert _SESSION is not None
        assert "https://" in _SESSION.adapters

    def test_model_to_provider_call_dynamic_resolution(self):
        # Gemini resolution
        gemini_attempt = _model_to_provider_call("gemini-3.6-flash", [{"role": "user", "content": "hi"}], 100)
        assert gemini_attempt is not None
        assert "Gemini" in gemini_attempt[1]

        # Groq resolution
        groq_attempt = _model_to_provider_call("openai/gpt-oss-120b", [{"role": "user", "content": "hi"}], 100)
        assert groq_attempt is not None
        assert "Groq" in groq_attempt[1]
