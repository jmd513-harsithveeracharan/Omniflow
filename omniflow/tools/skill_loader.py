"""
app/skill_loader.py
-------------------
Dynamic 2-Tier Skill Discovery & Ingestion Engine for Fabric AI Studio.

Provides:
  1. get_skill_index() -> Returns lightweight list of {name, type, description} for Stage 1 Triage Router.
  2. load_skills(skill_names: list[str]) -> Loads and formats requested SKILL.md files into grounded prompt context.
  3. auto_register_skill(skill_name: str, content: str, category: str = "patterns") -> Auto-saves newly synthesized skills.
"""

import re
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent.parent
SKILLS_DIR = BASE_DIR / ".agents" / "skills"


def _parse_frontmatter(content: str) -> dict[str, str]:
    """Extracts name and description from YAML frontmatter in SKILL.md."""
    match = re.match(r"^---\s*\n(.*?)\n---\s*\n", content, re.DOTALL)
    metadata = {}
    if match:
        fm = match.group(1)
        for line in fm.splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                metadata[k.strip().lower()] = v.strip().strip("\"'")
    return metadata


def _clean_display_name(name: str) -> str:
    """Formats snake_case skill names into clean Title Case."""
    parts = name.replace("fabric_", "").replace("pattern_", "").split("_")
    return " ".join(p.capitalize() for p in parts)


def _extract_preview_snippet(content: str, name: str) -> str:
    """Extracts a clean 4-6 line preview code snippet or ASCII flowchart."""
    # Special preview for using_fabric_skills
    if name == "using_fabric_skills":
        return "User Request Arrives\n  ├── Architecture / Lakehouse? ──→ fabric_medallion_architecture\n  ├── Ingesting Tables / Schedules? ─→ fabric_ingestion_and_scheduling\n  ├── SQL / AST / Lineage? ──────────→ sql_transpilation_and_lineage\n  └── Delete / Governance? ──────────→ fabric_governance_and_safe_delete"

    # Search for first code block
    code_match = re.search(r"```(?:\w+)?\n(.*?)```", content, re.DOTALL)
    if code_match:
        lines = [l for l in code_match.group(1).strip().splitlines() if l.strip()]
        return "\n".join(lines[:5])

    # Fallback to key instructions
    lines = [l.strip() for l in content.splitlines() if l.strip() and not l.startswith("#") and not l.startswith("---")]
    return "\n".join(lines[:4]) if lines else f"# Operational playbook for {name}"


def get_skill_index() -> list[dict[str, Any]]:
    """
    Returns a comprehensive index of all available skills categorized by tier.
    """
    index = []
    if not SKILLS_DIR.exists():
        return index

    for skill_path in SKILLS_DIR.rglob("SKILL.md"):
        skill_dir = skill_path.parent
        rel_path = skill_dir.relative_to(SKILLS_DIR).as_posix()
        skill_name = skill_dir.name

        # Skip non-fabric external helper skills if any
        if skill_name in ["design_taste_frontend", "atomic", "patterns", "impeccable"] and not (skill_dir / "SKILL.md").exists():
            continue

        try:
            content = skill_path.read_text(encoding="utf-8", errors="replace")
            meta = _parse_frontmatter(content)
            desc = meta.get("description", f"Operational guide for {skill_name}")

            # Tier classification
            if skill_name == "using_fabric_skills":
                tier = "orchestrator"
            elif skill_name in [
                "fabric_medallion_architecture",
                "fabric_ingestion_and_scheduling",
                "sql_transpilation_and_lineage",
                "fabric_data_quality_and_testing",
                "fabric_governance_and_safe_delete"
            ]:
                tier = "workflow"
            elif "patterns" in rel_path:
                tier = "pattern"
            else:
                tier = "atomic"

            display_title = meta.get("name") or _clean_display_name(skill_name)
            snippet = _extract_preview_snippet(content, skill_name)

            index.append({
                "name": skill_name,
                "displayName": display_title,
                "path": rel_path,
                "tier": tier,
                "description": desc,
                "snippet": snippet,
                "fullContent": content,
                "enabled": True,
            })
        except Exception:
            continue

    # Order: orchestrator first, then workflow, pattern, atomic
    tier_order = {"orchestrator": 0, "workflow": 1, "pattern": 2, "atomic": 3}
    return sorted(index, key=lambda x: (tier_order.get(x["tier"], 9), x["name"]))


def load_skills(skill_names: list[str]) -> str:
    """
    Reads the full SKILL.md content for the requested skill names and returns
    a formatted prompt context block.
    """
    if not skill_names or not SKILLS_DIR.exists():
        return ""

    loaded_blocks = []
    for s_name in skill_names:
        # Search direct match or partial match in .agents/skills
        matches = list(SKILLS_DIR.rglob(f"*{s_name}*/SKILL.md")) or list(SKILLS_DIR.rglob(f"{s_name}/SKILL.md"))
        if not matches:
            # Fallback search by folder name
            matches = [p for p in SKILLS_DIR.rglob("SKILL.md") if s_name.lower() in p.parent.name.lower()]

        if matches:
            target_file = matches[0]
            try:
                raw_text = target_file.read_text(encoding="utf-8", errors="replace")
                # Strip YAML frontmatter for cleaner prompt injection
                clean_text = re.sub(r"^---\s*\n.*?\n---\s*\n", "", raw_text, flags=re.DOTALL).strip()
                loaded_blocks.append(f"### [SKILL REFERENCE: {target_file.parent.name}]\n{clean_text}")
            except Exception as e:
                loaded_blocks.append(f"### [SKILL: {s_name}] (Error loading skill: {e})")

    if not loaded_blocks:
        return ""

    return "\n\n" + "=" * 60 + "\nACTIVE GROUNDED RUNBOOKS & SKILL GUIDES:\n" + "=" * 60 + "\n" + "\n\n".join(loaded_blocks)


def discover_skills() -> dict[str, dict[str, Any]]:
    """
    Returns a map of all available skills by name.
    Format: {skill_name: {"name", "description", "content", "path", ...}}
    """
    index = get_skill_index()
    skills_map = {}
    for item in index:
        skills_map[item["name"]] = {
            "name": item["name"],
            "displayName": item.get("displayName", item["name"]),
            "description": item.get("description", ""),
            "content": item.get("fullContent", ""),
            "path": item.get("path", ""),
            "tier": item.get("tier", "atomic"),
            "snippet": item.get("snippet", ""),
        }
    return skills_map


def get_skills_manifest(skills_map: dict[str, dict] | None = None) -> str:
    """
    Generates a concise Progressive Disclosure manifest of all available skills.
    Injected into LLM system prompts without blowing token limits.
    """
    if skills_map is None:
        skills_map = discover_skills()

    if not skills_map:
        return "  No specialized skills loaded."

    lines = []
    for name, meta in skills_map.items():
        desc = meta.get("description", "").replace("\n", " ")
        lines.append(f"  - {name}: {desc}")

    return "\n".join(lines)


def get_skill_by_name(name: str) -> dict[str, Any] | None:
    """Retrieves a specific skill by its unique name."""
    skills = discover_skills()
    if name in skills:
        return skills[name]
    # Fallback case-insensitive match
    for k, v in skills.items():
        if k.lower() == name.lower():
            return v
    return None


def match_relevant_skill(user_query: str) -> dict[str, Any] | None:
    """
    Dynamically matches the most relevant skill for a user query intent.
    Checks semantic intents and skill descriptions.
    """
    if not user_query:
        return None

    query_lower = user_query.lower()
    skills = discover_skills()

    # Dynamic Intent-to-Skill Priority
    if any(w in query_lower for w in ["delete", "remove", "risk", "safe", "drop", "blast", "archive"]):
        return skills.get("fabric_governance_and_safe_delete")
    elif any(w in query_lower for w in ["quality", "constraint", "anomaly", "validation", "quarantine", "check", "expectation"]):
        return skills.get("fabric_data_quality_and_testing")
    elif any(w in query_lower for w in ["transpile", "tsql", "t-sql", "lineage", "ast", "syntax", "oracle", "sap"]):
        return skills.get("sql_transpilation_and_lineage")
    elif any(w in query_lower for w in ["schedule", "cron", "watermark", "ingest", "ingestion", "pipeline"]):
        return skills.get("fabric_ingestion_and_scheduling")
    elif any(w in query_lower for w in ["bronze", "silver", "gold", "medallion", "lakehouse", "layer", "star schema"]):
        return skills.get("fabric_medallion_architecture")

    # Dynamic fallback: scan skill descriptions for token overlap
    best_match = None
    max_score = 0
    words = set(re.findall(r"\w+", query_lower))
    for name, meta in skills.items():
        desc_words = set(re.findall(r"\w+", (meta.get("description", "") + " " + name).lower()))
        score = len(words & desc_words)
        if score > max_score:
            max_score = score
            best_match = meta

    return best_match if max_score >= 2 else None


def auto_register_skill(skill_name: str, markdown_content: str, category: str = "patterns") -> str:
    """
    Self-Skilling Flywheel: writes a newly learned skill into .agents/skills/.
    """
    target_dir = SKILLS_DIR / category / skill_name
    target_dir.mkdir(parents=True, exist_ok=True)
    skill_file = target_dir / "SKILL.md"

    frontmatter = f"---\nname: {skill_name}\ndescription: Auto-synthesized skill for {skill_name}\ntier: {category}\n---\n\n"
    skill_file.write_text(frontmatter + markdown_content, encoding="utf-8", errors="replace")
    return str(skill_file)


