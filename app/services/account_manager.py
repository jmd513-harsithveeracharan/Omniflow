"""
app/services/account_manager.py
--------------------------------
Service for discovering, managing, and switching multi-account Fabric sessions.
Integrates with Azure CLI, Fabric CLI, and local saved profile stores.
"""

import json
import os
import subprocess
import threading
import time

from app.auth import _cache_lock, _token_cache, clear_token_cache, get_auth_status
import app.config as cfg
from app.domain.auth_models import FabricAccountProfile
from app.workspace_cache import invalidate as invalidate_workspace_cache

_ACCOUNTS_FILE = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "fabric_accounts.json")
_accounts_lock = threading.Lock()


def _load_saved_accounts() -> dict[str, dict]:
    """Loads locally saved account profiles."""
    if os.path.exists(_ACCOUNTS_FILE):
        try:
            with open(_ACCOUNTS_FILE, encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _save_accounts(accounts: dict[str, dict]):
    """Persists account profiles to disk."""
    try:
        with open(_ACCOUNTS_FILE, "w", encoding="utf-8") as f:
            json.dump(accounts, f, indent=2)
    except Exception as e:
        print(f"[ACCOUNT_MANAGER] Failed to persist accounts: {e}")


def _discover_azure_cli_accounts() -> list[dict]:
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
    Returns a unified list of accounts from Azure CLI, current session, and saved profiles.
    """
    current_status = get_auth_status()
    current_user = current_status.get("user_identity", "")
    current_tenant = current_status.get("tenant_id", "")

    saved = _load_saved_accounts()
    cli_accounts = _discover_azure_cli_accounts()

    profiles: dict[str, FabricAccountProfile] = {}

    # 1. Process Azure CLI accounts
    for acc in cli_accounts:
        user_info = acc.get("user") or {}
        email = user_info.get("name") or acc.get("name") or "user"
        tenant_id = acc.get("tenantId") or acc.get("homeTenantId") or ""
        sub_id = acc.get("id")
        tenant_name = acc.get("tenantDisplayName") or acc.get("tenantDefaultDomain")

        # Determine friendly label and account type
        name = "Pelican BioThermal" if "peli" in email.lower() else "JMAN Group" if "jman" in email.lower() else tenant_name or email
        account_type = "Enterprise Medallion" if "peli" in email.lower() else "Fabric Trial" if "jman" in email.lower() else "Azure / Fabric"
        default_ws_name = "PBT_DATA_AGENT" if "peli" in email.lower() else "JMAN_TRIAL_WORKSPACE"

        acc_id = f"acc_{tenant_id[:8]}_{email.split('@')[0]}"
        is_active = bool(current_status.get("authenticated") and (email.lower() in current_user.lower() or tenant_id == current_tenant))

        profiles[acc_id] = FabricAccountProfile(
            id=acc_id,
            name=name,
            email=email,
            tenant_id=tenant_id,
            tenant_name=tenant_name,
            subscription_id=sub_id,
            is_active=is_active,
            account_type=account_type,
            default_workspace_name=default_ws_name,
        )

    # 2. Add default / expected accounts if not yet logged in
    # Pelican BioThermal
    peli_id = "acc_pelican_bio"
    if not any("peli" in p.email.lower() for p in profiles.values()):
        profiles[peli_id] = FabricAccountProfile(
            id=peli_id,
            name="Pelican BioThermal",
            email="Bheesetti.Harsith@Pelibiothermal.com",
            tenant_id="94b62ba4-8d71-4507-9dc9-9734a149f836",
            tenant_name="PELICAN PRODUCTS INC",
            is_active=bool("peli" in current_user.lower() or current_tenant == "94b62ba4-8d71-4507-9dc9-9734a149f836"),
            account_type="Enterprise Medallion",
            default_workspace_name="PBT_DATA_AGENT",
        )

    # JMAN Group (Fabric Trial)
    jman_id = "acc_jman_trial"
    if not any("jman" in p.email.lower() for p in profiles.values()):
        saved_jman = saved.get(jman_id, {})
        profiles[jman_id] = FabricAccountProfile(
            id=jman_id,
            name="JMAN Group",
            email=saved_jman.get("email", "harsith.veer@jmangroup.com"),
            tenant_id=saved_jman.get("tenant_id", "jmangroup.onmicrosoft.com"),
            tenant_name="JMAN Group",
            is_active=bool("jman" in current_user.lower()),
            account_type="Fabric Trial",
            default_workspace_name="JMAN_TRIAL_WORKSPACE",
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

                # Update target account as active
                target.is_active = True
                return True, f"Switched to {target.name} ({target.email})", target

        # If Azure CLI doesn't have token for this tenant, signal that browser login is required
        return False, f"Account '{target.name}' requires sign-in. Please use Browser Sign-in.", target
    except Exception as e:
        return False, f"Error switching account: {e}", target


def trigger_browser_login(tenant: str | None = None) -> tuple[bool, str]:
    """
    Opens browser for interactive Azure / Fabric login.
    """
    cmd = ["az", "login", "--scope", "https://api.fabric.microsoft.com/.default"]
    if tenant:
        cmd.extend(["--tenant", tenant.strip()])

    try:
        subprocess.run(cmd, shell=True, timeout=120)
        clear_token_cache()
        invalidate_workspace_cache()
        status = get_auth_status()
        if status.get("authenticated"):
            return True, f"Successfully authenticated as {status.get('user_identity')}"
        return False, "Browser login was cancelled or did not complete."
    except subprocess.TimeoutExpired:
        return False, "Browser login timed out after 2 minutes."
    except Exception as e:
        return False, f"Login error: {e}"

