"""
tests/test_intent_classifier.py
---------------------------------
Unit and integration tests for the fast LLM intent classifier and fallback rules.
"""

import pytest
from app.intent_classifier import (
    classify_prompt_intent,
    _fallback_rule_classify,
)


def test_fallback_rule_build_architecture():
    """Verify build orders are recognized as BUILD_ARCHITECTURE in fallback rules."""
    prompts = [
        "Create project Sales_5 with lh_bronze, lh_silver, 3 notebooks",
        "Please create a folder Analytics_Core with lakehouse lh_raw and pipeline pl_daily",
        "Deploy medallion architecture for SAP ERP",
        "build project Finance_Prod with lh_bronze and lh_silver",
        "provision lakehouse lh_telemetry and warehouse wh_reporting",
    ]
    for p in prompts:
        intent, reason = _fallback_rule_classify(p)
        assert intent == "BUILD_ARCHITECTURE", f"Expected BUILD_ARCHITECTURE for '{p}', got {intent} ({reason})"


def test_fallback_rule_project_consult():
    """Verify DE advisory and architecture questions are recognized as PROJECT_CONSULT."""
    prompts = [
        "We ingested using batch load, do you think incremental load is better for this table?",
        "How should I partition silver tables in Delta Lake?",
        "What is the difference between Lakehouse and Warehouse in Microsoft Fabric?",
        "How do I configure PySpark Z-Order indexing for large Delta tables?",
        "Should we use SCD Type 1 or SCD Type 2 for customer dimension?",
    ]
    for p in prompts:
        intent, reason = _fallback_rule_classify(p)
        assert intent == "PROJECT_CONSULT", f"Expected PROJECT_CONSULT for '{p}', got {intent} ({reason})"


def test_fallback_rule_general_chat_anti_slop():
    """Verify questions with words like 'building' or 'plan' do NOT trigger build architecture."""
    prompts = [
        "what are skill.md files and why do we need them if we are building one?",
        "can you explain how neural network backpropagation works?",
        "write a python function to reverse a linked list",
        "hello! how are you doing today?",
        "what is the weather like in Seattle?",
    ]
    for p in prompts:
        intent, reason = _fallback_rule_classify(p)
        assert intent == "GENERAL_CHAT", f"Expected GENERAL_CHAT for '{p}', got {intent} ({reason})"


def test_forced_mode_overrides():
    """Verify UI forced_mode takes priority over auto detection."""
    # Forced general mode always yields GENERAL_CHAT even on build commands
    intent_gen, meta_gen = classify_prompt_intent(
        "Create folder Sales_5 with lh_bronze, lh_silver",
        forced_mode="general",
    )
    assert intent_gen == "GENERAL_CHAT"
    assert meta_gen["reason"] == "forced_general_mode"

    # Forced project mode promotes general questions to project consults
    intent_proj, meta_proj = classify_prompt_intent(
        "Explain how python generators work",
        forced_mode="project",
    )
    assert intent_proj in ("PROJECT_CONSULT", "BUILD_ARCHITECTURE")


def test_end_to_end_classify_intent():
    """Test full classifier entry point across key user scenarios."""
    # Scenario 1: Ambiguous prompt with "building"
    intent, _ = classify_prompt_intent("what are skill.md files if we are building one?")
    assert intent in ("GENERAL_CHAT", "PROJECT_CONSULT")
    assert intent != "BUILD_ARCHITECTURE"

    # Scenario 2: Clear build command
    intent_build, _ = classify_prompt_intent("Create project Sales_5 with lh_bronze, lh_silver, 3 notebooks")
    assert intent_build == "BUILD_ARCHITECTURE"


def test_fallback_rule_deploy_and_run():
    """Verify deploy and run orders are recognized as DEPLOY_AND_RUN."""
    prompts = [
        "deploy and run this pipeline",
        "execute active plan in Fabric and verify Delta tables",
        "deploy it run the pipeline check if any errors are there solve them",
        "trigger notebook nb_silver and verify output",
    ]
    for p in prompts:
        intent, reason = _fallback_rule_classify(p)
        assert intent == "DEPLOY_AND_RUN", f"Expected DEPLOY_AND_RUN for '{p}', got {intent} ({reason})"
