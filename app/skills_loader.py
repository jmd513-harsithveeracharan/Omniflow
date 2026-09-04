"""
app/skills_loader.py
--------------------
Unified skills loader shim for backward compatibility.
Delegates directly to app.skill_loader (the active 2-tier skill engine).
"""

from app.skill_loader import (
    auto_register_skill,
    discover_skills,
    get_skill_by_name,
    get_skill_index,
    get_skills_manifest,
    load_skills,
    match_relevant_skill,
)

__all__ = [
    "discover_skills",
    "get_skills_manifest",
    "get_skill_by_name",
    "match_relevant_skill",
    "get_skill_index",
    "load_skills",
    "auto_register_skill",
]
