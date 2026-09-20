"""
app/api/routers/auth.py
-----------------------
FastAPI router for Fabric multi-account management, account switching, and UI login.
"""

import asyncio
from typing import Any

from fastapi import APIRouter, HTTPException

from app.auth import (
    disconnect,
    get_auth_status,
    poll_device_code_token,
    start_device_code_login,
)
from app.domain.auth_models import (
    BrowserLoginRequest,
    DeviceCodeInitResponse,
    DeviceCodePollRequest,
    DeviceCodePollResponse,
    FabricAccountProfile,
    SwitchAccountRequest,
)
from app.services.account_manager import (
    list_all_accounts,
    switch_to_account,
    trigger_browser_login,
)

router = APIRouter(prefix="/api/auth", tags=["Fabric Authentication & Accounts"])


@router.get("/status", summary="Get Current Fabric Auth Status")
async def get_status() -> dict[str, Any]:
    """Returns status of current active Fabric authentication."""
    return get_auth_status()


@router.get("/accounts", summary="List Available Fabric Accounts", response_model=list[FabricAccountProfile])
async def get_accounts() -> list[FabricAccountProfile]:
    """Returns all accounts discovered from Azure CLI and saved profiles."""
    try:
        return await asyncio.to_thread(list_all_accounts)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to list accounts: {e}") from e


@router.post("/switch-account", summary="Switch Active Fabric Account")
async def switch_account_endpoint(req: SwitchAccountRequest) -> dict[str, Any]:
    """Switches the active Fabric account session and refreshes workspace cache."""
    success, message, profile = await asyncio.to_thread(switch_to_account, req.account_id, req.tenant_id)
    if not success:
        return {
            "success": False,
            "message": message,
            "requires_login": True,
            "account": profile.model_dump() if profile else None,
        }
    return {
        "success": True,
        "message": message,
        "requires_login": False,
        "account": profile.model_dump() if profile else None,
        "auth": get_auth_status(),
    }


@router.post("/login/browser", summary="Trigger Interactive Browser Login")
async def browser_login_endpoint(req: BrowserLoginRequest | None = None) -> dict[str, Any]:
    """Launches interactive browser sign-in for Microsoft Fabric."""
    tenant = req.tenant if req else None
    success, message = await asyncio.to_thread(trigger_browser_login, tenant)
    return {
        "success": success,
        "message": message,
        "auth": get_auth_status(),
        "accounts": [a.model_dump() for a in list_all_accounts()],
    }


@router.post("/login/device-code", summary="Start Microsoft Device Code Flow", response_model=DeviceCodeInitResponse)
async def device_code_endpoint() -> DeviceCodeInitResponse:
    """Initiates device code login flow returning code and verification URL."""
    res = await asyncio.to_thread(start_device_code_login)
    return DeviceCodeInitResponse(**res)


@router.post("/login/device-code/poll", summary="Poll Device Code Status", response_model=DeviceCodePollResponse)
async def device_code_poll_endpoint(req: DeviceCodePollRequest) -> DeviceCodePollResponse:
    """Polls token endpoint to verify if user finished browser authorization."""
    res = await asyncio.to_thread(poll_device_code_token, req.device_code)
    auth_info = res.get("auth") or {}
    return DeviceCodePollResponse(
        success=res.get("success", False),
        status=res.get("status", "pending"),
        error=res.get("error"),
        user_identity=auth_info.get("user_identity"),
        tenant_id=auth_info.get("tenant_id"),
    )


@router.post("/logout", summary="Disconnect Fabric Session")
async def logout_endpoint() -> dict[str, Any]:
    """Disconnects the current active session."""
    return disconnect()

