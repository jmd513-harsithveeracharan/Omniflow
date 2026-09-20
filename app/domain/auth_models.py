"""
app/domain/auth_models.py
-------------------------
Pydantic v2 domain models for multi-account Fabric authentication and switching.
"""

from pydantic import BaseModel, Field


class FabricAccountProfile(BaseModel):
    id: str = Field(..., description="Unique ID for this account/subscription")
    name: str = Field(..., description="Friendly display label (e.g. Pelican BioThermal, JMAN Group)")
    email: str = Field(..., description="User principal name or email")
    tenant_id: str = Field(..., description="Microsoft Entra Tenant ID")
    tenant_name: str | None = Field(None, description="Organization / Tenant display name")
    subscription_id: str | None = Field(None, description="Azure subscription ID if applicable")
    is_active: bool = Field(False, description="Whether this is the currently active authenticated session")
    account_type: str = Field("Fabric Account", description="Type (e.g. Enterprise, Fabric Trial, Student)")
    default_workspace_id: str | None = Field(None, description="Default active workspace for this account")
    default_workspace_name: str | None = Field(None, description="Default workspace display name")


class SwitchAccountRequest(BaseModel):
    account_id: str = Field(..., description="ID of the account to switch to")
    tenant_id: str | None = Field(None, description="Optional tenant override")
    default_workspace_id: str | None = Field(None, description="Optional default workspace ID")
    default_workspace_name: str | None = Field(None, description="Optional default workspace name")


class BrowserLoginRequest(BaseModel):
    tenant: str | None = Field(None, description="Optional specific tenant ID or domain to log in into")


class DeviceCodeInitResponse(BaseModel):
    success: bool
    user_code: str | None = None
    device_code: str | None = None
    verification_uri: str = "https://login.microsoft.com/device"
    expires_in: int = 900
    interval: int = 5
    message: str | None = None
    error: str | None = None


class DeviceCodePollRequest(BaseModel):
    device_code: str = Field(..., description="Device code returned from initiation")


class DeviceCodePollResponse(BaseModel):
    success: bool
    status: str = Field(..., description="pending | authenticated | declined | expired | error")
    error: str | None = None
    user_identity: str | None = None
    tenant_id: str | None = None

