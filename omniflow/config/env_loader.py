"""
omniflow/config/env_loader.py
-----------------------------
Dynamic environment variable and workspace resolution for OmniFlow.
Priority:
  1. OS environment variables
  2. omniflow/.env (local OmniFlow configuration)
  3. Parent .env (Fabric_AI root configuration)
"""

from __future__ import annotations

import os

try:
    from dotenv import load_dotenv

    _current_dir = os.path.dirname(os.path.abspath(__file__))
    _omni_dir = os.path.dirname(_current_dir)
    _root_dir = os.path.dirname(_omni_dir)

    _omni_env = os.path.join(_omni_dir, ".env")
    _root_env = os.path.join(_root_dir, ".env")

    # Load omniflow/.env first, then fallback to root .env
    if os.path.exists(_omni_env):
        load_dotenv(_omni_env, override=False)
    if os.path.exists(_root_env):
        load_dotenv(_root_env, override=False)
except ImportError:
    pass


def get_workspace_id() -> str:
    """Dynamically resolves the active Microsoft Fabric workspace ID."""
    ws_id = (
        os.getenv("FABRIC_ALLOWED_WORKSPACE_ID")
        or os.getenv("ALLOWED_WORKSPACE_ID")
        or os.getenv("FABRIC_WORKSPACE_ID")
        or os.getenv("WORKSPACE_ID", "")
    )
    return ws_id.strip()


def get_workspace_name() -> str:
    """Dynamically resolves the active Microsoft Fabric workspace display name."""
    ws_name = (
        os.getenv("FABRIC_ALLOWED_WORKSPACE_NAME")
        or os.getenv("ALLOWED_WORKSPACE_NAME")
        or os.getenv("FABRIC_WORKSPACE_NAME")
        or os.getenv("WORKSPACE_NAME", "")
    )
    return ws_name.strip() or "Fabric_Workspace"


def get_containment_folder() -> str | None:
    """Resolves optional containment folder. Returns None if deploying to workspace root."""
    folder = os.getenv("FABRIC_CONTAINMENT_FOLDER") or os.getenv("CONTAINMENT_FOLDER")
    if folder:
        clean = folder.strip().strip("/")
        if clean.lower() in ("none", "null", "root", "", "false"):
            return None
        return clean
    return None
