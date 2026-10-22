"""
app/api/__init__.py
-------------------
FastAPI routers package for Fabric AI Studio.
"""

from app.api.routers.auth import router as auth_router
from app.api.routers.connectors import router as connectors_router
from app.api.routers.governance import router as governance_router
from app.api.routers.omniflow import router as omniflow_router
from app.api.routers.pipelines import router as pipelines_router
from app.api.routers.skills import router as skills_router
from app.api.routers.workspaces import router as workspaces_router
from app.domain.workflow.router import router as workflow_router

__all__ = [
    "auth_router",
    "skills_router",
    "connectors_router",
    "workspaces_router",
    "pipelines_router",
    "governance_router",
    "workflow_router",
    "omniflow_router",
]
