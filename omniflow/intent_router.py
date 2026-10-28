"""
omniflow/intent_router.py
-------------------------
Intent Classification & Context Hydration Router for OmniFlow.
Cleanly separates:
  - Mode 1: General Conversational & Concepts Q&A (Direct stream, 0 thought steps)
  - Mode 2: Project Context Q&A (Direct stream using JIT project schema & metadata, 0 thought steps)
  - Mode 3: Architecture Synthesis, Creation & Provisioning (Atomic, Tier 2 & Tier 3 multi-agent loops)
"""

from __future__ import annotations

import os
import re
from typing import Any, Literal
from pydantic import BaseModel, Field

ChatIntent = Literal[
    "GENERAL_CHAT",
    "PROJECT_QA",
    "ATOMIC_CREATE",
    "DEPLOY_TRIGGER",
    "FULL_BLUEPRINT",
    "COMPONENT_SYNTHESIS",
]

GREETING_PATTERNS: list[str] = [
    r"^(?:hi|hello|hey|howdy|hola|greetings)\b",
    r"^how are you",
    r"^who are you",
    r"^what can you do",
    r"^help\b",
    r"^good (?:morning|afternoon|evening)",
    r"^thanks|thank you",
]

PROJECT_QA_PATTERNS: list[str] = [
    r"what is this project",
    r"what does this project do",
    r"what is project",
    r"what is this particular thing",
    r"explain (?:this|the) project",
    r"tell me about (?:this|the) project",
    r"summary of (?:this|the) project",
    r"what tables (?:are in|exist in|do we have)",
    r"what are the (?:tables|layers|lakehouses|warehouses|notebooks|pipelines)",
    r"who is (?:on|in) (?:this|the) (?:team|project)",
    r"what is (?:the|our) (?:sla|rpo|rto|compliance)",
    r"show me the (?:lineage|architecture|schema)",
    r"load and focus on project context",
    r"prj-[a-z0-9\-]+",
]

ACTION_KEYWORDS: list[str] = [
    "create ", "make ", "provision ", "deploy ", "build ", "generate ",
    "synthesize ", "transpile ", "write a ", "write pyspark", "write sql",
    "scd2", "pipeline", "ddl", "stored procedure", "alter "
]


class ProjectContext(BaseModel):
    project_id: str = Field(..., description="Project code / ID")
    project_name: str = Field(..., description="Display name of the project")
    description: str = Field(default="", description="Business & architectural scope")
    domain: str = Field(default="enterprise", description="Business domain")
    root_folder: str = Field(default="Workspace Root", description="Fabric root folder")
    folders: dict[str, str] = Field(default_factory=dict, description="Subfolder mapping")
    tables: list[dict[str, Any]] = Field(default_factory=list, description="Target entities")
    local_path: str = Field(default="", description="Local artifacts folder path")
    team_members: list[str] = Field(default_factory=list, description="Assigned team members")


def classify_prompt_intent(
    message: str,
    mode: str | None = "project",
    has_intake: bool = False,
) -> ChatIntent:
    """Classifies user query into one of three distinct operational modes."""
    msg = message.strip()
    msg_lower = msg.lower()

    # 1. Intake Spec Attached -> Always Mode 3 (Full Blueprint)
    if has_intake:
        return "FULL_BLUEPRINT"

    # 2. Explicit Deploy Trigger -> Mode 3 (Deploy)
    if any(p in msg_lower for p in [
        "deploy active plan", "deploy plan", "execute deployment",
        "deploy to fabric", "deploy now"
    ]):
        return "DEPLOY_TRIGGER"

    # 3. Atomic Item Provisioning Fast Path (< 2s)
    atomic_match = re.search(
        r"^(?:create|make|add|provision|new)\s+(?:(?:me\s+)?(?:a\s+|an\s+|the\s+)?)?(folder|lakehouse|warehouse|notebook|pipeline|data\s+pipeline|data\s+agent|agent)\s+(?:called\s+|named\s+)?['\"]?([a-zA-Z0-9_\-]+)['\"]?(?:\s+in\s+workspace|\s*$|\.)",
        msg,
        re.IGNORECASE,
    )
    if atomic_match and not any(k in msg_lower for k in [
        "that ", "with ", "reads from", "dedupe", "join", "procedure", "select"
    ]):
        return "ATOMIC_CREATE"

    # 4. Tier 3 Full Blueprint Trigger
    if any(p in msg_lower for p in [
        "full medallion blueprint", "synthesize platform blueprint",
        "build end-to-end platform", "build end to end platform",
        "launch autonomous pipeline", "full platform architecture",
        "enterprise medallion platform", "full medallion architecture",
        "medallion pipeline blueprint",
    ]):
        return "FULL_BLUEPRINT"

    # 5. Explicit General Mode Selected in UI
    if mode == "general":
        is_code_request = any(k in msg_lower for k in [
            "write code", "generate sql", "write pyspark", "create table",
            "create procedure", "transpile", "synthesize"
        ])
        if is_code_request:
            return "COMPONENT_SYNTHESIS"
        return "GENERAL_CHAT"

    # 6. Conversational Greetings / General Chat (Instant reply, 0 thought steps)
    if any(re.search(pat, msg_lower) for pat in GREETING_PATTERNS) and len(msg.split()) <= 10:
        return "GENERAL_CHAT"

    # 7. Informational Inquiry & Conceptual Q&A Detection
    inquiry_indicators = [
        "what", "how", "who", "where", "why", "when", "can you", "could you",
        "tell me", "describe", "explain", "understand", "difference between",
        "is it", "is there", "versus", " vs ", "superior", "meaning", "definition",
        "guide", "overview", "hear me", "do you know"
    ]
    is_inquiry = (
        msg.endswith("?")
        or any(w in msg_lower for w in inquiry_indicators)
        or any(re.search(pat, msg_lower) for pat in GREETING_PATTERNS)
    )
    has_action = any(k in msg_lower for k in ACTION_KEYWORDS)
    is_proj_qa = any(re.search(pat, msg_lower) for pat in PROJECT_QA_PATTERNS)

    if not has_action and is_inquiry:
        is_specifically_proj = is_proj_qa or any(
            w in msg_lower
            for w in ["this project", "our tables", "our pipeline", "current plan", "team member", "active plan", "this folder"]
        )
        if is_specifically_proj:
            return "PROJECT_QA"
        return "GENERAL_CHAT"

    if is_proj_qa and not has_action:
        return "PROJECT_QA"

    # 8. Component Code Synthesis (Tier 2 PySpark / SQL / Pipeline generation)
    return "COMPONENT_SYNTHESIS"


def build_general_chat_prompt(effort: str | None = "medium", is_voice: bool = False) -> str:
    """System prompt for Mode 1: Fast direct conversational Q&A without thought steps."""
    eff = (effort or "medium").lower()
    effort_clause = (
        "Reasoning depth: Maximum thoroughness and analytical precision."
        if eff == "high"
        else "Reasoning depth: Ultra-fast and concise."
        if eff == "low"
        else "Reasoning depth: Balanced and practical."
    )
    voice_clause = (
        "- Voice Conversation Mode Active: The user is speaking hands-free and listening aloud. "
        "Keep answers conversational, natural to listen to, and concise (typically 2-4 sentences or key highlights). "
        "Do NOT output large code blocks or dense ASCII tables unless explicitly asked.\n"
        "- Acoustic Phonetic Tolerance: The user may be speaking through a laptop mic where technical terms "
        "are transcribed phonetically (e.g. 'she Ali' or 'eul uli' for 'CLI', 'restopia' for 'REST API', 'won lake' for 'OneLake', 'pie spark' for 'PySpark'). "
        "Interpret these in context automatically without asking for clarification.\n"
        if is_voice
        else ""
    )
    return (
        "You are Tenali AI (OmniFlow), an intelligent, friendly AI assistant specializing in "
        f"Microsoft Fabric, PySpark, Delta Lake, SQL, and modern cloud data architectures. {effort_clause}\n"
        "Guidelines:\n"
        "- Answer greetings, conceptual questions, definitions, and discussions directly, concisely, and warmly.\n"
        f"{voice_clause}"
        "- Do NOT show intermediate engineering steps, agent-contact logs, or unnecessary technical boilerplate.\n"
        "- Use clean GitHub markdown formatting with bullet points and code blocks where helpful."
    )


def build_project_qa_prompt(ctx: ProjectContext, effort: str | None = "medium", is_voice: bool = False) -> str:
    """System prompt for Mode 2: Direct JIT project-aware Q&A without thought steps."""
    members_str = ", ".join(ctx.team_members) if ctx.team_members else "Sarah (Contributor), Harsith (Owner)"
    tables_str = ", ".join([t.get("name", "") for t in ctx.tables]) if ctx.tables else "Operational entities"
    artifacts_str = f"Artifacts folder: `{ctx.local_path}`" if ctx.local_path else "Standard Medallion artifacts"
    eff = (effort or "medium").lower()
    effort_clause = (
        "Reasoning effort: HIGH (Deep Exhaustive Analysis). Verify edge cases, schema constraints, and SLA boundaries thoroughly."
        if eff == "high"
        else "Reasoning effort: LOW (Fast). Deliver crisp, immediate answers with minimal verbosity."
        if eff == "low"
        else "Reasoning effort: MEDIUM (Balanced). Provide standard comprehensive reasoning."
    )
    voice_clause = (
        "- Voice Conversation Mode Active: The user is listening aloud. Deliver direct, spoken-friendly responses "
        "in 2-4 clear sentences without large code blocks or verbose preambles.\n"
        "- Acoustic Phonetic Tolerance: Automatically map spoken phonetic transcriptions (e.g. 'she Ali' -> CLI, 'restopia' -> REST API) to domain concepts.\n"
        if is_voice
        else ""
    )

    return (
        f"You are Tenali AI, the dedicated project assistant for:\n"
        f"- Project Name: {ctx.project_name} ({ctx.project_id})\n"
        f"- Business Domain: {ctx.domain}\n"
        f"- Project Scope: {ctx.description}\n"
        f"- Folder Boundary: {ctx.root_folder}\n"
        f"- Active Entities & Tables: {tables_str}\n"
        f"- Project Team Members: {members_str}\n"
        f"- Storage / Artifacts: {artifacts_str}\n"
        f"- {effort_clause}\n\n"
        f"Instructions:\n"
        f"- The user is asking an informational question about THIS project.\n"
        f"{voice_clause}"
        f"- Answer directly, informatively, and accurately using the project context above.\n"
        f"- Do NOT trigger multi-agent pipeline steps, agent contact thoughts, or unrequested file creation.\n"
        f"- Provide a clear, crisp, helpful breakdown addressing the user's specific inquiry."
    )

