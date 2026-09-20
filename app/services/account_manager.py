"""
app/services/account_manager.py
--------------------------------
Service for discovering, managing, and switching multi-account Fabric sessions.
Integrates with Azure CLI, Entra ID, and local profile stores. Zero dummy accounts.
"""

import json
import os
import subprocess
import threading
import time
from typing import Any

from app.auth import _cache_lock, _token_cache, clear_token_cache, get_auth_status
from app.domain.auth_models import FabricAccountProfile
from app.workspace_cache import invalidate as invalidate_workspace_cache

_ACCOUNTS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "fabric_accounts.json")
_accounts_lock = threading.Lock()


def _load_saved_accounts() -> dict[str, dict[str, Any]]:
    """Loads locally saved account profiles."""
    if os.path.exists(_ACCOUNTS_FILE):
        try:
            with open(_ACCOUNTS_FILE, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_accounts(accounts: dict[str, dict[str, Any]]) -> None:
    """Persists account profiles to disk."""
    try:
        with open(_ACCOUNTS_FILE, "w", encoding="utf-8") as f:
            json.dump(accounts, f, indent=2)
    except Exception as e:
        print(f"[ACCOUNT_MANAGER] Failed to persist accounts: {e}")


def _discover_azure_cli_accounts() -> list[dict[str, Any]]:
    """Queries Azure CLI for all locally authenticated accounts."""
    try:
        cmd = ["az", "account", "list", "-o", "json"]
        res = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=12)
        if res.returncode == 0 and res.stdout.strip():
            return json.loads(res.stdout)
    except Exception as e:
        print(f"[ACCOUNT_MANAGER] Error reading az accounts: {e}")
    return []


def list_all_accounts() -> list[FabricAccountProfile]:
    """
    Returns a list of real accounts discovered from Azure CLI, active session,
    and previously authenticated accounts. Zero hardcoded dummy accounts.
    """
    current_status = get_auth_status()
    current_user = current_status.get("user_identity", "").strip().lower()
    current_tenant = current_status.get("tenant_id", "").strip().lower()

    saved = _load_saved_accounts()
    cli_accounts = _discover_azure_cli_accounts()

    profiles: dict[str, FabricAccountProfile] = {}

    # 1. Process Azure CLI accounts
    for acc in cli_accounts:
        user_info = acc.get("user") or {}
        email = user_info.get("name") or acc.get("name") or "User"
        tenant_id = acc.get("tenantId") or acc.get("homeTenantId") or ""
        sub_id = acc.get("id")
        tenant_display = acc.get("tenantDisplayName")
        tenant_domain = acc.get("tenantDefaultDomain")
        name = tenant_display or tenant_domain or email

        sub_name = acc.get("name", "")
        if "student" in sub_name.lower():
            account_type = "Azure / Education"
        elif "trial" in sub_name.lower() or not sub_id:
            account_type = "Fabric Trial"
        else:
            account_type = "Enterprise"

        acc_id = f"acc_{tenant_id[:8]}_{email.split('@')[0]}"
        is_active = bool(
            current_status.get("authenticated")
            and (email.lower() == current_user or (tenant_id and tenant_id.lower() == current_tenant))
        )

        profiles[acc_id] = FabricAccountProfile(
            id=acc_id,
            name=name,
            email=email,
            tenant_id=tenant_id,
            tenant_name=tenant_display or tenant_domain,
            subscription_id=sub_id,
            is_active=is_active,
            account_type=account_type,
            default_workspace_name=None,
        )

    # 2. Add saved accounts from previous interactive/device-code logins
    for acc_id, s_data in saved.items():
        if acc_id not in profiles:
            email = s_data.get("email", "")
            tenant_id = s_data.get("tenant_id", "")
            is_active = bool(
                current_status.get("authenticated")
                and (email.lower() == current_user or (tenant_id and tenant_id.lower() == current_tenant))
            )
            profiles[acc_id] = FabricAccountProfile(
                id=acc_id,
                name=s_data.get("name") or email,
                email=email,
                tenant_id=tenant_id,
                tenant_name=s_data.get("tenant_name"),
                subscription_id=s_data.get("subscription_id"),
                is_active=is_active,
                account_type=s_data.get("account_type", "Fabric Account"),
                default_workspace_name=s_data.get("default_workspace_name"),
            )

    # 3. If current session is authenticated but not yet mapped, add it
    if current_status.get("authenticated") and current_status.get("user_identity"):
        sess_email = current_status.get("user_identity", "")
        sess_tenant = current_status.get("tenant_id", "")
        found = any(p.email.lower() == sess_email.lower() for p in profiles.values())
        if not found and "@" in sess_email:
            sess_id = f"acc_{sess_tenant[:8]}_{sess_email.split('@')[0]}"
            profiles[sess_id] = FabricAccountProfile(
                id=sess_id,
                name=sess_email.split("@")[1].split(".")[0].title() if "." in sess_email else sess_email,
                email=sess_email,
                tenant_id=sess_tenant,
                tenant_name=None,
                subscription_id=None,
                is_active=True,
                account_type="Fabric Account",
                default_workspace_name=None,
            )

    return list(profiles.values())


def switch_to_account(account_id: str, tenant_id: str | None = None) -> tuple[bool, str, FabricAccountProfile | None]:
    """
    Switches active authentication context to the requested account.
    """
    accounts = {a.id: a for a in list_all_accounts()}
    target = accounts.get(account_id)
    if not target:
        return False, f"Account '{account_id}' not found", None

    effective_tenant = tenant_id or target.tenant_id

    # If subscription ID exists, set active in Azure CLI
    if target.subscription_id:
        try:
            subprocess.run(["az", "account", "set", "--subscription", target.subscription_id], shell=True, timeout=10)
        except Exception as e:
            print(f"[ACCOUNT_MANAGER] Warning: az account set failed: {e}")

    # Fetch token for target tenant
    try:
        cmd = [
            "az", "account", "get-access-token",
            "--resource", "https://api.fabric.microsoft.com",
            "--tenant", effective_tenant,
            "-o", "json",
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=25)
        if res.returncode == 0:
            data = json.loads(res.stdout)
            token = data.get("accessToken", "").strip()
            if token:
                now = time.time()
                expires_at = now + 3480
                with _cache_lock:
                    _token_cache.update({
                        "token": token,
                        "expires_at": expires_at,
                        "auth_method": "azure_cli",
                        "user_identity": target.email,
                        "tenant_id": effective_tenant,
                    })

                # Invalidate workspace cache so fresh workspaces are loaded
                invalidate_workspace_cache()

                target.is_active = True
                return True, f"Switched to {target.name} ({target.email})", target

        return False, f"Account '{target.name}' requires sign-in. Please use Browser Sign-in.", target
    except Exception as e:
        return False, f"Error switching account: {e}", target


def trigger_browser_login(tenant: str | None = None) -> tuple[bool, str, FabricAccountProfile | None]:
    """
    Opens browser for interactive Azure / Fabric login.
    Uses --allow-no-subscriptions for Fabric trial support.
    """
    cmd = [
        "az", "login",
        "--allow-no-subscriptions",
        "--scope", "https://api.fabric.microsoft.com/.default",
        "-o", "json",
    ]
    if tenant and tenant.strip():
        cmd.extend(["--tenant", tenant.strip()])

    try:
        res = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=180)
        if res.returncode != 0:
            err_msg = res.stderr.strip() or res.stdout.strip() or "Sign-in was cancelled or encountered an error."
            return False, err_msg, None

        clear_token_cache()
        invalidate_workspace_cache()

        logged_email = None
        logged_tenant = None
        if res.stdout.strip():
            try:
                data = json.loads(res.stdout)
                if isinstance(data, list) and len(data) > 0:
                    first = data[0]
                    logged_email = (first.get("user") or {}).get("name")
                    logged_tenant = first.get("tenantId")
            except Exception:
                pass

        all_accounts = list_all_accounts()
        matched = None
        if logged_email:
            matched = next((a for a in all_accounts if a.email.lower() == logged_email.lower()), None)
        if not matched and all_accounts:
            matched = next((a for a in all_accounts if a.is_active), all_accounts[0])

        if matched:
            switch_to_account(matched.id, matched.tenant_id)
            return True, f"Successfully authenticated as {matched.email}", matched

        status = get_auth_status()
        if status.get("authenticated"):
            return True, f"Successfully authenticated as {status.get('user_identity', 'user')}", None
        return False, "Browser login was cancelled or did not complete.", None

    except subprocess.TimeoutExpired:
        return False, "Browser sign-in timed out. Please retry or use Device Code.", None
    except Exception as e:
        return False, f"Login error: {e}", None
