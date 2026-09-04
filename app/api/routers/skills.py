"""
app/api/routers/skills.py
-------------------------
FastAPI router for Microsoft Fabric specialized domain skills.
Provides skill indexing, dynamic matching, and runbook retrieval.
"""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.skill_loader import (
    discover_skills,
    get_skill_by_name,
    get_skill_index,
    match_relevant_skill,
)

router = APIRouter(prefix="/api/skills", tags=["Domain Skills"])


class SkillSummary(BaseModel):
    name: str = Field(..., description="Unique skill identifier")
    display_name: str = Field(..., description="Human-readable title")
    description: str = Field(..., description="Skill summary and trigger criteria")
    tier: str = Field("atomic", description="Skill classification tier")
    snippet: str = Field("", description="Preview snippet or ASCII diagram")


class SkillMatchRequest(BaseModel):
    query: str = Field(..., description="User prompt or intent to match against skills catalog")


@router.get("", summary="List All Available Fabric Skills")
async def list_skills() -> list[dict[str, Any]]:
    """Returns the index of all available Fabric AI specialized skills."""
    return get_skill_index()


@router.get("/detailed", summary="Get Full Skills Catalog with Content")
async def get_all_skills_detailed() -> dict[str, Any]:
    """Returns all loaded skills with full markdown content."""
    return discover_skills()


@router.get("/{skill_name}", summary="Get Specific Skill by Name")
async def get_skill(skill_name: str):
    """Retrieves full runbook and prompt instructions for a specific skill."""
    skill = get_skill_by_name(skill_name)
    if not skill:
        raise HTTPException(status_code=404, detail=f"Skill '{skill_name}' not found.")
    return skill


@router.post("/match", summary="Match Relevant Skill for Intent")
async def match_skill(req: SkillMatchRequest):
    """Dynamically matches the most relevant skill for a given query or task."""
    matched = match_relevant_skill(req.query)
    if not matched:
        return {"matched": False, "skill": None}
    return {"matched": True, "skill": matched}
