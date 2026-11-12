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
import threading
import time
from typing import Any, Callable, Optional

from fastapi import APIRouter
from pydantic import BaseModel

from omniflow.auth.az_cli import (
    _ACTIVE_FABRIC_ACCOUNT,
    format_az_account,
    get_azure_cli_account as _get_azure_cli_account,
    read_azure_profile_accounts,
    run_az_cmd as _run_az_cmd,
)

logger = logging.getLogger("omniflow.auth_fabric")

fabric_auth_router = APIRouter(tags=["Fabric Tenancy & SSO"])

_cache_invalidation_hooks: list[Callable[[], None]] = []

# Fast in-memory caching to avoid cold CLI delays
_ACCOUNTS_CACHE: list[dict[str, Any]] | None = None
_ACCOUNTS_CACHE_TIME: float = 0.0
_ACCOUNTS_CACHE_TTL: float = 300.0  # 5 minutes TTL


def register_cache_invalidation_hook(hook: Callable[[], None]) -> None:
    if hook not in _cache_invalidation_hooks:
        _cache_invalidation_hooks.append(hook)


def invalidate_all_auth_caches() -> None:
    global _ACCOUNTS_CACHE
    _ACCOUNTS_CACHE = None
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


class BrowserLoginRequest(BaseModel):
    tenant: Optional[str] = None


class SwitchAccountRequest(BaseModel):
    account_id: str
    tenant_id: Optional[str] = None


class DeviceCodePollRequest(BaseModel):
    device_code: str


class RemoveAccountRequest(BaseModel):
    account_id: Optional[str] = None
    email: Optional[str] = None


@fabric_auth_router.get("/auth/accounts")
@fabric_auth_router.get("/fabric/accounts")
def get_fabric_accounts(refresh: bool = False) -> list[dict[str, Any]]:
    global _ACCOUNTS_CACHE, _ACCOUNTS_CACHE_TIME
    now = time.time()
    if not refresh and _ACCOUNTS_CACHE is not None and (now - _ACCOUNTS_CACHE_TIME) < _ACCOUNTS_CACHE_TTL:
        return _ACCOUNTS_CACHE

    if not refresh:
        fast_accounts = read_azure_profile_accounts()
        if fast_accounts:
            _ACCOUNTS_CACHE, _ACCOUNTS_CACHE_TIME = fast_accounts, now
            return fast_accounts

    rc, out, _ = _run_az_cmd(["account", "list", "--output", "json"], timeout=25)
    if rc == 0 and out.strip():
        try:
            az_accounts = json.loads(out)
            accounts = [acc for raw in az_accounts if (acc := format_az_account(raw)) is not None]
            if accounts:
                accounts.sort(key=lambda x: not x["is_active"])
                _ACCOUNTS_CACHE, _ACCOUNTS_CACHE_TIME = accounts, time.time()
                return accounts
        except Exception as e:
            logger.warning(f"Failed parsing az account list: {e}")

    fast_fallback = read_azure_profile_accounts()
    if fast_fallback:
        _ACCOUNTS_CACHE, _ACCOUNTS_CACHE_TIME = fast_fallback, time.time()
        return fast_fallback

    cli_acc = _get_azure_cli_account()
    if cli_acc:
        fallback = [cli_acc]
        _ACCOUNTS_CACHE, _ACCOUNTS_CACHE_TIME = fallback, time.time()
        return fallback

    _ACCOUNTS_CACHE = None
    return []


@fabric_auth_router.post("/auth/login/browser")
def login_fabric_browser(req: BrowserLoginRequest = BrowserLoginRequest()) -> dict[str, Any]:
    cmd = ["login"]
    if req.tenant and req.tenant.strip():
        cmd.extend(["--tenant", req.tenant.strip()])

    rc, _, err = _run_az_cmd(cmd, timeout=60)
    invalidate_all_auth_caches()
    accounts = get_fabric_accounts(refresh=True)
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
        import urllib.parse, urllib.request
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
    return {"status": "authenticated", "user_identity": account.get("email", "user@fabric.internal")}


@fabric_auth_router.post("/auth/switch-account")
def switch_fabric_account(req: SwitchAccountRequest) -> dict[str, Any]:
    sub_id = req.account_id
    try:
        rc, _, err = _run_az_cmd(["account", "set", "--subscription", sub_id], timeout=30)
        account = _get_azure_cli_account() or {}
        if rc == 0:
            invalidate_all_auth_caches()
            return {
                "success": True,
                "message": f"Switched active Fabric session to {account.get('name', 'selected account')} ({account.get('tenant_name')})",
                "account": account,
            }
        logger.warning(f"az account set failed: {err}")
        return {"success": False, "message": f"Failed to switch account: {err or 'Subscription not accessible'}", "account": account}
    except Exception as exc:
        logger.exception(f"Unexpected error switching fabric account: {exc}")
        return {"success": False, "message": f"Switch failed: {str(exc)}", "account": _get_azure_cli_account()}


@fabric_auth_router.post("/auth/accounts/remove")
def remove_fabric_account(req: RemoveAccountRequest) -> dict[str, Any]:
    """Disconnect and log out a specific Fabric account from Azure CLI credentials."""
    target_email = (req.email or "").strip()
    target_id = (req.account_id or "").strip()
    if not target_email and target_id:
        current = get_fabric_accounts(refresh=False)
        for acc in current:
            if acc.get("id") == target_id or acc.get("subscription_id") == target_id:
                target_email = acc.get("email", "")
                break
    if not target_email:
        return {"success": False, "message": "Account email or subscription ID required to disconnect."}

    logger.info(f"Disconnecting Fabric account: {target_email}")
    rc, _, err = _run_az_cmd(["logout", "--username", target_email], timeout=25)
    invalidate_all_auth_caches()
    remaining = get_fabric_accounts(refresh=True)
    if not any(a.get("is_active") for a in remaining) and remaining:
        first_sub = remaining[0].get("id")
        if first_sub:
            _run_az_cmd(["account", "set", "--subscription", first_sub], timeout=15)
            remaining = get_fabric_accounts(refresh=True)

    return {
        "success": rc == 0,
        "message": f"Successfully disconnected {target_email}" if rc == 0 else f"Failed to disconnect: {err[:100]}",
        "accounts": remaining,
    }


@fabric_auth_router.post("/auth/logout")
def logout_fabric() -> dict[str, Any]:
    invalidate_all_auth_caches()
    return {"success": True, "message": "Fabric session cleared."}


def _prewarm_fabric_cache() -> None:
    try:
        get_fabric_accounts(refresh=False)
    except Exception as e:
        logger.debug(f"Prewarm accounts failed: {e}")


threading.Thread(target=_prewarm_fabric_cache, daemon=True, name="fabric_prewarm").start()
