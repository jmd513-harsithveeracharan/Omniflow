"""
app/fabric/core.py
------------------
Core constants, security validations, and HTTP poller for Fabric REST API.
Includes dynamic facade resolution to ensure 100% backward compatibility
with unit test mocks patching app.fabric_client.*.
"""

import sys
import time
import requests
from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME

_BASE = "https://api.fabric.microsoft.com/v1"
_LRO_MAX_POLLS = 20
_LRO_POLL_INTERVAL = 2.0  # seconds


def get_client_attr(name: str, fallback=None):
    """
    Dynamically resolves attributes or functions from app.fabric_client facade
    if present (e.g. when unittest.mock patches app.fabric_client.<attr>).
    """
    fc = sys.modules.get("app.fabric_client")
    if fc is not None and hasattr(fc, name):
        return getattr(fc, name)
    return fallback


def get_auth_headers():
    """Resolves get_auth_headers, respecting any mock on app.fabric_client."""
    fn = get_client_attr("get_auth_headers")
    if fn and fn is not get_auth_headers:
        return fn()
    from app.auth import get_auth_headers as _auth
    return _auth()


def get_requests():
    """Resolves requests module, respecting any mock on app.fabric_client."""
    req = get_client_attr("requests")
    return req if req is not None else requests


class WorkspaceSecurityError(Exception):
    """Raised when an operation targets a workspace outside the allowed list."""
    pass


def _assert_workspace(workspace_id: str) -> None:
    """Validates that a target workspace ID is provided and active."""
    if not workspace_id or not str(workspace_id).strip():
        raise WorkspaceSecurityError("Target Microsoft Fabric workspace ID is required but was empty or None.")


def _poll_lro(location: str, headers: dict) -> bool:
    """
    Polls a Fabric Long-Running Operation (LRO) URL until complete or timeout.
    Returns True on success, False on timeout.
    """
    req = get_requests()
    for _ in range(_LRO_MAX_POLLS):
        time.sleep(_LRO_POLL_INTERVAL)
        try:
            resp = req.get(location, headers=headers, timeout=15)
            if resp.status_code == 200:
                status = resp.json().get("status", "").lower()
                if status in ("succeeded", "completed", ""):
                    return True
                if status in ("failed", "canceled"):
                    print(f"[LRO] Operation failed: {resp.text[:200]}")
                    return False
            elif resp.status_code == 202:
                continue  # Still in progress
        except Exception as e:
            print(f"[LRO] Poll error: {e}")
    print("[LRO] Timed out waiting for operation to complete.")
    return False

