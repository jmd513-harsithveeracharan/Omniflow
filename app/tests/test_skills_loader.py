"""
app/tests/test_skills_loader.py
-------------------------------
Unit tests for the dynamic skills loader and progressive disclosure system.
"""

import pytest
from app.skills_loader import (
    discover_skills,
    get_skills_manifest,
    get_skill_by_name,
    match_relevant_skill,
)


class TestSkillsLoader:
    def test_discover_skills_loads_all_custom_skills(self):
        skills = discover_skills()
        assert len(skills) >= 6
        assert "using_fabric_skills" in skills
        assert "fabric_medallion_architecture" in skills
        assert "fabric_ingestion_and_scheduling" in skills
        assert "sql_transpilation_and_lineage" in skills
        assert "fabric_governance_and_safe_delete" in skills
        assert "fabric_data_quality_and_testing" in skills

    def test_skill_has_yaml_frontmatter_parsed(self):
        skill = get_skill_by_name("fabric_medallion_architecture")
        assert skill is not None
        assert "name" in skill
        assert "description" in skill
        assert "content" in skill
        assert "Bronze" in skill["content"] or "bronze" in skill["content"].lower()

    def test_skills_manifest_formatting(self):
        manifest = get_skills_manifest()
        assert "fabric_medallion_architecture:" in manifest
        assert "fabric_ingestion_and_scheduling:" in manifest

    def test_semantic_skill_matching(self):
        # Medallion query
        s1 = match_relevant_skill("Build a Bronze, Silver, Gold lakehouse architecture")
        assert s1 is not None
        assert s1["name"] == "fabric_medallion_architecture"

        # Ingestion & Schedule query
        s2 = match_relevant_skill("Ingest Orders table with nightly cron schedule")
        assert s2 is not None
        assert s2["name"] == "fabric_ingestion_and_scheduling"

        # SQL Transpiler query
        s3 = match_relevant_skill("Transpile this T-SQL query and extract lineage")
        assert s3 is not None
        assert s3["name"] == "sql_transpilation_and_lineage"

        # Safe Delete query
        s4 = match_relevant_skill("Delete this lakehouse and check blast-radius risk")
        assert s4 is not None
        assert s4["name"] == "fabric_governance_and_safe_delete"

        # Data Quality query
        s5 = match_relevant_skill("Enforce schema constraints and data quality validation")
        assert s5 is not None
        assert s5["name"] == "fabric_data_quality_and_testing"
