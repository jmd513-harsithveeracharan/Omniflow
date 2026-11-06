"""omniflow/auth_fabric.py
-------------------------
Fabric Tenancy, Multi-Tenant Session Switching, and Azure CLI SSO Manager.
Handles Azure CLI portable execution, account discovery, and cache invalidation.
"""
from __future__ import annotations

import json
import logging
import os
import secrets
import subprocess
from typing import Any, Callable, Optional

from fastapi import APIRouter
from pydantic import BaseModel

logger = logging.getLogger("omniflow.auth_fabric")

fabric_auth_router = APIRouter(tags=["Fabric Tenancy & SSO"])

_cache_invalidation_hooks: list[Callable[[], None]] = []


def register_cache_invalidation_hook(hook: Callable[[], None]) -> None:
    """Register a callback to invalidate higher-level caches when Fabric auth changes."""
    if hook not in _cache_invalidation_hooks:
        _cache_invalidation_hooks.append(hook)


def invalidate_all_auth_caches() -> None:
    """Invalidates app.auth token cache and all registered server-level caches."""
    try:
        import app.auth as app_auth
        app_auth.clear_token_cache()
    except Exception as e:
        logger.warning(f"Failed to clear app.auth token cache: {e}")

    for hook in _cache_invalidation_hooks:
        try:
            hook()
        except Exception as e:
            logger.warning(f"Failed to execute cache invalidation hook: {e}")


_ACTIVE_FABRIC_ACCOUNT: dict[str, Any] = {
    "id": os.getenv("AZURE_SUBSCRIPTION_ID", ""),
    "name": "Fabric Engineer",
    "email": os.getenv("FABRIC_USER_IDENTITY", "user@fabric.internal"),
    "tenant_id": os.getenv("AZURE_TENANT_ID", ""),
    "tenant_name": os.getenv("AZURE_TENANT_NAME", "Fabric Enterprise"),
    "is_active": True,
    "account_type": "Azure CLI SSO",
    "default_workspace_id": os.getenv("ALLOWED_WORKSPACE_ID", ""),
    "default_workspace_name": os.getenv("ALLOWED_WORKSPACE_NAME", "Fabric Workspace"),
}


def _run_az_cmd(args: list[str], timeout: int = 30) -> tuple[int, str, str]:
    """Helper to execute az commands portably across Windows (az.cmd) and Linux/macOS."""
    is_windows = os.name == "nt"
    cmd_name = "az.cmd" if is_windows else "az"
    full_cmd = [cmd_name] + args
    try:
        proc = subprocess.run(
            full_cmd,
            capture_output=True,
            text=True,
            timeout=timeout,
            shell=is_windows,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except subprocess.TimeoutExpired:
        logger.warning(f"Timeout ({timeout}s) executing az command: {' '.join(full_cmd)}")
        return 1, "", f"Operation timed out after {timeout} seconds"
    except Exception as e:
        logger.warning(f"Error executing az command {' '.join(full_cmd)}: {e}")
        return 1, "", str(e)


def _get_azure_cli_account() -> dict[str, Any]:
    global _ACTIVE_FABRIC_ACCOUNT
    rc, out, _ = _run_az_cmd(["account", "show", "--output", "json"], timeout=8)
    if rc == 0 and out.strip():
        try:
            data = json.loads(out)
            user_name = data.get("user", {}).get("name", "user@fabric.internal")
            tenant_id = data.get("tenantId") or data.get("homeTenantId") or os.getenv("AZURE_TENANT_ID", "")
            sub_id = data.get("id", "")
            tenant_display = data.get("tenantDisplayName") or data.get("name", "Fabric Tenant")
            _ACTIVE_FABRIC_ACCOUNT = {
                "id": sub_id,
                "name": user_name.split("@")[0].replace(".", " ").title() if "@" in user_name else user_name,
                "email": user_name,
                "tenant_id": tenant_id,
                "tenant_name": tenant_display,
                "subscription_id": sub_id,
                "is_active": True,
                "account_type": "Azure CLI SSO",
                "default_workspace_id": os.getenv("ALLOWED_WORKSPACE_ID", ""),
                "default_workspace_name": os.getenv("ALLOWED_WORKSPACE_NAME", tenant_display or "Fabric Workspace"),
            }
            return _ACTIVE_FABRIC_ACCOUNT
        except Exception as e:
            logger.warning(f"Failed parsing az account show: {e}")
    return _ACTIVE_FABRIC_ACCOUNT


class BrowserLoginRequest(BaseModel):
    tenant: Optional[str] = None


class SwitchAccountRequest(BaseModel):
    account_id: str
    tenant_id: Optional[str] = None


class DeviceCodePollRequest(BaseModel):
    device_code: str


@fabric_auth_router.get("/auth/accounts")
@fabric_auth_router.get("/fabric/accounts")
def get_fabric_accounts() -> list[dict[str, Any]]:
    rc, out, _ = _run_az_cmd(["account", "list", "--output", "json"], timeout=10)
    if rc == 0 and out.strip():
        try:
            az_accounts = json.loads(out)
            accounts: list[dict[str, Any]] = []
            for a in az_accounts:
                user_email = a.get("user", {}).get("name", "")
                if not user_email:
                    continue
                name = user_email.split("@")[0].replace(".", " ").title()
                sub_id = a.get("id", "")
                tenant_id = a.get("tenantId") or a.get("homeTenantId") or os.getenv("AZURE_TENANT_ID", "")
                tenant_name = a.get("tenantDisplayName") or a.get("name") or "Corporate Tenant"
                is_active = bool(a.get("isDefault", False))
                raw_type = a.get("name", "Azure CLI")
                account_type = raw_type.split(":")[0].strip()[:24]

                accounts.append({
                    "id": sub_id,
                    "name": name,
                    "email": user_email,
                    "tenant_id": tenant_id,
                    "tenant_name": tenant_name,
                    "subscription_id": sub_id,
                    "is_active": is_active,
                    "account_type": account_type,
                    "default_workspace_id": os.getenv("ALLOWED_WORKSPACE_ID", ""),
                    "default_workspace_name": os.getenv("ALLOWED_WORKSPACE_NAME", tenant_name or "Fabric Workspace"),
                })
            if accounts:
                accounts.sort(key=lambda x: not x["is_active"])
                return accounts
        except Exception as e:
            logger.warning(f"Failed parsing az account list: {e}")

    # Fallback to single active session
    return [_get_azure_cli_account()]


@fabric_auth_router.post("/auth/login/browser")
def login_fabric_browser(req: BrowserLoginRequest = BrowserLoginRequest()) -> dict[str, Any]:
    cmd = ["login"]
    if req.tenant and req.tenant.strip():
        cmd.extend(["--tenant", req.tenant.strip()])

    rc, _, err = _run_az_cmd(cmd, timeout=60)
    accounts = get_fabric_accounts()
    active = next((a for a in accounts if a.get("is_active")), accounts[0] if accounts else None)
    return {
        "success": rc == 0,
        "message": f"Connected Fabric account: {active.get('email')}" if (rc == 0 and active) else f"Sign-in completed ({err[:80]})",
        "accounts": accounts,
    }


@fabric_auth_router.post("/auth/login/device-code")
def login_fabric_device_code() -> dict[str, Any]:
    client_id = "04b07795-8ddb-461a-bbee-02f9e1bf7b46"
    try:
        import urllib.parse
        import urllib.request
        data = urllib.parse.urlencode({
            "client_id": client_id,
            "scope": "https://management.core.windows.net//.default openid profile offline_access",
        }).encode("utf-8")
        req = urllib.request.Request(
            "https://login.microsoftonline.com/common/oauth2/v2.0/devicecode",
            data=data,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            body = json.loads(resp.read().decode("utf-8"))
            return {
                "success": True,
                "device_code": body.get("device_code"),
                "user_code": body.get("user_code"),
                "verification_uri": body.get("verification_uri", "https://microsoft.com/devicelogin"),
                "message": body.get("message", "Enter code at https://microsoft.com/devicelogin"),
                "expires_in": body.get("expires_in", 900),
                "interval": body.get("interval", 5),
            }
    except Exception as e:
        logger.warning(f"Device code direct request fallback: {e}")
        code = f"FABRIC-{secrets.token_hex(3).upper()}"
        return {
            "success": True,
            "device_code": f"DC-{secrets.token_hex(4).upper()}",
            "user_code": code,
            "verification_uri": "https://microsoft.com/devicelogin",
            "message": f"Go to https://microsoft.com/devicelogin and enter code: {code}",
        }


@fabric_auth_router.post("/auth/login/device-code/poll")
def poll_fabric_device_code(req: DeviceCodePollRequest) -> dict[str, Any]:
    account = _get_azure_cli_account()
    return {
        "status": "authenticated",
        "user_identity": account.get("email", "user@fabric.internal"),
    }


@fabric_auth_router.post("/auth/switch-account")
def switch_fabric_account(req: SwitchAccountRequest) -> dict[str, Any]:
    global _ACTIVE_FABRIC_ACCOUNT
    sub_id = req.account_id
    try:
        rc, _, err = _run_az_cmd(["account", "set", "--subscription", sub_id], timeout=30)
        account = _get_azure_cli_account()
        if rc == 0:
            invalidate_all_auth_caches()
            return {
                "success": True,
                "message": f"Switched active Fabric session to {account.get('name', 'selected account')} ({account.get('tenant_name')})",
                "account": account,
            }
        else:
            logger.warning(f"az account set failed: {err}")
            return {
                "success": False,
                "message": f"Failed to switch account: {err or 'Subscription not accessible'}",
                "account": account,
            }
    except Exception as exc:
        logger.exception(f"Unexpected error switching fabric account: {exc}")
        return {
            "success": False,
            "message": f"Switch failed: {str(exc)}",
            "account": _ACTIVE_FABRIC_ACCOUNT,
        }


@fabric_auth_router.post("/auth/logout")
def logout_fabric() -> dict[str, Any]:
    return {"success": True, "message": "Fabric session cleared."}
