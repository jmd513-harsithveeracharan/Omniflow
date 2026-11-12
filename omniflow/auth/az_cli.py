"""omniflow/auth/az_cli.py
-----------------------
Azure CLI subprocess execution and zero-latency azureProfile.json reader.
"""
from __future__ import annotations

import json
import logging
import os
import subprocess
import threading
from typing import Any, Optional

logger = logging.getLogger("omniflow.auth_az_cli")

_AZ_LOCK = threading.Lock()
_ACTIVE_FABRIC_ACCOUNT: Optional[dict[str, Any]] = None


def run_az_cmd(args: list[str], timeout: int = 30) -> tuple[int, str, str]:
    """Executes an Azure CLI command serialized by a lock to prevent MSAL cache contention."""
    is_windows = os.name == "nt"
    full_cmd = ["az.cmd" if is_windows else "az"] + args
    with _AZ_LOCK:
        try:
            proc = subprocess.run(full_cmd, capture_output=True, text=True, timeout=timeout, shell=is_windows)
            return proc.returncode, proc.stdout, proc.stderr
        except subprocess.TimeoutExpired:
            logger.warning(f"Timeout ({timeout}s) executing az: {' '.join(full_cmd)}")
            return 1, "", f"Operation timed out after {timeout}s"
        except Exception as e:
            logger.warning(f"Error executing az {' '.join(full_cmd)}: {e}")
            return 1, "", str(e)


def format_az_account(raw: dict[str, Any], force_active: bool | None = None) -> Optional[dict[str, Any]]:
    """Normalizes an Azure subscription/account entry into OmniFlow's FabricAccountProfile shape."""
    user_email = raw.get("user", {}).get("name", "")
    if not user_email:
        return None
    name = user_email.split("@")[0].replace(".", " ").title() if "@" in user_email else user_email
    sub_id = raw.get("id", "")
    tenant_id = raw.get("tenantId") or raw.get("homeTenantId") or os.getenv("AZURE_TENANT_ID", "")
    tenant_name = raw.get("tenantDisplayName") or raw.get("name") or "Fabric Tenant"
    raw_type = raw.get("name", "Azure CLI")
    is_active = force_active if force_active is not None else bool(raw.get("isDefault", False))
    return {
        "id": sub_id,
        "name": name,
        "email": user_email,
        "tenant_id": tenant_id,
        "tenant_name": tenant_name,
        "subscription_id": sub_id,
        "is_active": is_active,
        "account_type": raw_type.split(":")[0].strip() if ":" in raw_type else raw_type,
        "default_workspace_id": os.getenv("ALLOWED_WORKSPACE_ID", ""),
        "default_workspace_name": os.getenv("ALLOWED_WORKSPACE_NAME", tenant_name or "Fabric Workspace"),
    }


def read_azure_profile_accounts() -> list[dict[str, Any]]:
    """Reads Azure CLI's local azureProfile.json in <2ms without spawning az.cmd."""
    cfg_dir = os.getenv("AZURE_CONFIG_DIR") or os.path.expanduser("~/.azure")
    profile_path = os.path.join(cfg_dir, "azureProfile.json")
    if not os.path.isfile(profile_path):
        return []
    try:
        with open(profile_path, "r", encoding="utf-8-sig") as f:
            data = json.load(f)
        subs = data.get("subscriptions", [])
        accounts = [acc for sub in subs if (acc := format_az_account(sub)) is not None]
        accounts.sort(key=lambda x: not x["is_active"])
        return accounts
    except Exception as e:
        logger.debug(f"Fast azureProfile.json read skipped: {e}")
        return []


def get_azure_cli_account() -> Optional[dict[str, Any]]:
    """Resolves the active Azure CLI account from azureProfile.json first, falling back to az show."""
    global _ACTIVE_FABRIC_ACCOUNT
    fast_accounts = read_azure_profile_accounts()
    if fast_accounts:
        active = next((a for a in fast_accounts if a.get("is_active")), fast_accounts[0])
        _ACTIVE_FABRIC_ACCOUNT = active
        return active

    rc, out, _ = run_az_cmd(["account", "show", "--output", "json"], timeout=25)
    if rc == 0 and out.strip():
        try:
            formatted = format_az_account(json.loads(out), force_active=True)
            if formatted:
                _ACTIVE_FABRIC_ACCOUNT = formatted
                return formatted
        except Exception as e:
            logger.warning(f"Failed parsing az account show: {e}")
    return None
