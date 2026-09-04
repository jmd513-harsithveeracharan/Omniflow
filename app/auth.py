"""
app/auth.py
-----------
Multi-strategy Azure authentication manager for Microsoft Fabric API.

Supports 3 authentication methods (evaluated in priority order):
  1. Static Token (.env: FABRIC_BEARER_TOKEN or AZURE_ACCESS_TOKEN)
  2. Service Principal (.env: AZURE_CLIENT_ID + AZURE_CLIENT_SECRET + AZURE_TENANT_ID)
  3. Azure CLI (az account get-access-token --resource https://api.fabric.microsoft.com)

Tokens are cached with thread-safety and refreshed before expiration.
Includes get_auth_status() for UI health checks and user identity display.
"""

import json
import subprocess
import threading
import time

import requests

import app.config as cfg

_cache_lock = threading.Lock()
_is_disconnected: bool = False
_token_cache: dict = {
    "token": None,
    "expires_at": 0,
    "auth_method": "none",
    "user_identity": "Not Connected",
    "tenant_id": "None",
}

_FABRIC_RESOURCE = "https://api.fabric.microsoft.com"
_SAFETY_MARGIN_SECONDS = 120  # Refresh 2 minutes before actual expiration


def _fetch_service_principal_token() -> tuple[str, float, str, str] | None:
    """
    Acquires an Azure token via OAuth2 Client Credentials flow (Service Principal).
    Returns (access_token, expires_at, user_identity, tenant_id) or None.
    """
    if not (cfg.AZURE_CLIENT_ID and cfg.AZURE_CLIENT_SECRET and cfg.AZURE_TENANT_ID):
        return None

    url = f"https://login.microsoftonline.com/{cfg.AZURE_TENANT_ID}/oauth2/v2.0/token"
    payload = {
        "grant_type": "client_credentials",
        "client_id": cfg.AZURE_CLIENT_ID,
        "client_secret": cfg.AZURE_CLIENT_SECRET,
        "scope": "https://api.fabric.microsoft.com/.default",
    }
    try:
        resp = requests.post(url, data=payload, timeout=15)
        if resp.status_code == 200:
            data = resp.json()
            token = data.get("access_token")
            expires_in = int(data.get("expires_in", 3600))
            expires_at = time.time() + max(60, expires_in - _SAFETY_MARGIN_SECONDS)
            return token, expires_at, f"App: {cfg.AZURE_CLIENT_ID[:8]}...", cfg.AZURE_TENANT_ID
        print(f"[AUTH ERROR] Service Principal token request failed: {resp.status_code} {resp.text[:200]}")
    except Exception as e:
        print(f"[AUTH ERROR] Service Principal request error: {e}")
    return None


def _fetch_azure_cli_token() -> tuple[str, float, str, str] | None:
    """
    Retrieves the token from Azure CLI (`az account get-access-token`).
    Parses JSON output for exact expiration and user account details.
    """
    try:
        cmd = [
            "az", "account", "get-access-token",
            "--resource", _FABRIC_RESOURCE,
            "-o", "json",
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, check=True, shell=True, timeout=20)
        data = json.loads(res.stdout)

        token = data.get("accessToken", "").strip()
        if not token:
            return None

        # Determine expiry timestamp
        expires_on_raw = data.get("expires_on") or data.get("expiresOn")
        now = time.time()
        if isinstance(expires_on_raw, (int, float)):
            expires_at = float(expires_on_raw) - _SAFETY_MARGIN_SECONDS
        else:
            expires_at = now + 3480  # Default ~58 minutes

        tenant_id = data.get("tenant", "Unknown")
        user_identity = "Azure CLI User"

        # Try to get user identity from az account show
        try:
            show_cmd = ["az", "account", "show", "-o", "json"]
            show_res = subprocess.run(show_cmd, capture_output=True, text=True, shell=True, timeout=10)
            if show_res.returncode == 0:
                show_data = json.loads(show_res.stdout)
                user_identity = show_data.get("user", {}).get("name") or show_data.get("name") or "Azure CLI User"
                tenant_id = show_data.get("tenantId") or tenant_id
        except Exception:
            pass

        return token, expires_at, user_identity, tenant_id

    except subprocess.CalledProcessError as e:
        print(f"[AUTH] Azure CLI not logged in or failed (exit code {e.returncode}). Run 'az login'.")
    except subprocess.TimeoutExpired:
        print("[AUTH ERROR] Azure CLI timed out after 20s.")
    except Exception as e:
        print(f"[AUTH ERROR] Azure CLI token error: {e}")

    return None


def get_fabric_token() -> str | None:
    """
    Returns an active Bearer token for Microsoft Fabric REST API.
    Thread-safe and automatically refreshes when expired or stale.
    """
    now = time.time()

    with _cache_lock:
        if _is_disconnected:
            return None
        if _token_cache["token"] and _token_cache["expires_at"] > now:
            return _token_cache["token"]

    # 1. Check static token in config
    if cfg.FABRIC_BEARER_TOKEN:
        with _cache_lock:
            _token_cache.update({
                "token": cfg.FABRIC_BEARER_TOKEN,
                "expires_at": now + 86400,  # 24h
                "auth_method": "static_token",
                "user_identity": "Static Token",
                "tenant_id": "Configured",
            })
            return cfg.FABRIC_BEARER_TOKEN

    # 2. Check Service Principal
    sp_res = _fetch_service_principal_token()
    if sp_res:
        token, expires_at, user_identity, tenant_id = sp_res
        with _cache_lock:
            _token_cache.update({
                "token": token,
                "expires_at": expires_at,
                "auth_method": "service_principal",
                "user_identity": user_identity,
                "tenant_id": tenant_id,
            })
            print(f"[AUTH] Acquired Service Principal token for {user_identity} (valid until {int(expires_at - now)}s).")
            return token

    # 3. Fallback to Azure CLI
    cli_res = _fetch_azure_cli_token()
    if cli_res:
        token, expires_at, user_identity, tenant_id = cli_res
        with _cache_lock:
            _token_cache.update({
                "token": token,
                "expires_at": expires_at,
                "auth_method": "azure_cli",
                "user_identity": user_identity,
                "tenant_id": tenant_id,
            })
            print(f"[AUTH] Acquired Azure CLI token for {user_identity} (valid for {int(expires_at - now)}s).")
            return token

    return None


def get_auth_headers() -> dict:
    """Returns Authorization and Content-Type headers for Fabric API calls."""
    token = get_fabric_token()
    if not token:
        raise RuntimeError("Authentication failed: No valid Azure token found. Run 'az login' or configure .env.")
    return {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
    }


def get_auth_status() -> dict:
    """
    Returns full authentication status metadata for the UI.
    """
    now = time.time()
    with _cache_lock:
        if _is_disconnected:
            return {
                "authenticated": False,
                "auth_method": "none",
                "user_identity": "Not Connected",
                "tenant_id": "None",
                "expires_in_seconds": 0,
                "expires_in_minutes": 0,
            }
        token = _token_cache["token"]
        if token and _token_cache["expires_at"] > now:
            expires_in = max(0, int(_token_cache["expires_at"] - now))
            return {
                "authenticated": True,
                "auth_method": _token_cache["auth_method"],
                "user_identity": _token_cache["user_identity"],
                "tenant_id": _token_cache["tenant_id"],
                "expires_in_seconds": expires_in,
                "expires_in_minutes": round(expires_in / 60, 1),
            }

    token = get_fabric_token()
    with _cache_lock:
        is_authed = bool(token and _token_cache["expires_at"] > now)
        expires_in = max(0, int(_token_cache["expires_at"] - now)) if is_authed else 0
        return {
            "authenticated": is_authed,
            "auth_method": _token_cache["auth_method"] if is_authed else "none",
            "user_identity": _token_cache["user_identity"] if is_authed else "Not Connected",
            "tenant_id": _token_cache["tenant_id"] if is_authed else "None",
            "expires_in_seconds": expires_in,
            "expires_in_minutes": round(expires_in / 60, 1),
        }


def clear_token_cache():
    """Forces cache invalidation."""
    with _cache_lock:
        _token_cache.update({
            "token": None,
            "expires_at": 0,
            "auth_method": "none",
            "user_identity": "Not Connected",
            "tenant_id": "None",
        })


def disconnect() -> dict:
    """
    Explicitly disconnects from Microsoft Fabric and clears token cache.
    Prevents automatic background reconnection until the user explicitly logs in.
    """
    global _is_disconnected
    with _cache_lock:
        _is_disconnected = True
        _token_cache.update({
            "token": None,
            "expires_at": 0,
            "auth_method": "none",
            "user_identity": "Not Connected",
            "tenant_id": "None",
        })
    cfg.FABRIC_BEARER_TOKEN = None
    cfg.AZURE_CLIENT_ID = None
    cfg.AZURE_CLIENT_SECRET = None
    return get_auth_status()


def trigger_cli_login(force_interactive: bool = False) -> dict:
    """
    Acquires or refreshes Azure / Fabric CLI token.
    If force_interactive is False, fast-checks if Azure CLI already has a valid token session.
    If force_interactive is True, executes interactive browser sign-in to launch the browser authentication flow.
    """
    global _is_disconnected
    with _cache_lock:
        _is_disconnected = False
    clear_token_cache()

    if not force_interactive:
        # 1. Fast check if Azure CLI already has a valid token session
        cli_res = _fetch_azure_cli_token()
        if cli_res:
            token, expires_at, user_identity, tenant_id = cli_res
            with _cache_lock:
                _token_cache.update({
                    "token": token,
                    "expires_at": expires_at,
                    "auth_method": "azure_cli",
                    "user_identity": user_identity,
                    "tenant_id": tenant_id,
                })
            return {
                "success": True,
                "message": f"Successfully connected via Azure CLI ({user_identity})",
                "auth": get_auth_status()
            }

    # 2. Interactive Browser Login (opens Microsoft auth window in browser)
    try:
        cmd = ["az", "login", "--scope", "https://api.fabric.microsoft.com/.default", "--output", "json"]
        res = subprocess.run(cmd, capture_output=True, text=True, shell=True, timeout=60)
        clear_token_cache()
        cli_res = _fetch_azure_cli_token()
        if cli_res:
            token, expires_at, user_identity, tenant_id = cli_res
            with _cache_lock:
                _token_cache.update({
                    "token": token,
                    "expires_at": expires_at,
                    "auth_method": "azure_cli",
                    "user_identity": user_identity,
                    "tenant_id": tenant_id,
                })
        status = get_auth_status()
        if status.get("authenticated"):
            return {"success": True, "message": f"Successfully authenticated via browser login ({status.get('user_identity')})", "auth": status}
        return {"success": False, "error": res.stderr or "Browser login did not complete.", "auth": status}
    except Exception as e:
        return {"success": False, "error": str(e), "auth": get_auth_status()}


def apply_service_principal(tenant_id: str, client_id: str, client_secret: str) -> dict:
    """
    Applies and tests Service Principal credentials.
    """
    global _is_disconnected
    with _cache_lock:
        _is_disconnected = False
    cfg.set_service_principal(tenant_id.strip(), client_id.strip(), client_secret.strip())
    clear_token_cache()
    sp_res = _fetch_service_principal_token()
    if sp_res:
        status = get_auth_status()
        return {"success": True, "message": "Service Principal authenticated successfully", "auth": status}
    return {"success": False, "error": "Invalid Service Principal credentials or token request failed.", "auth": get_auth_status()}


def apply_bearer_token(token: str) -> dict:
    """
    Applies a raw Bearer token directly.
    """
    global _is_disconnected
    with _cache_lock:
        _is_disconnected = False
    cleaned_token = token.strip()
    if cleaned_token.lower().startswith("bearer "):
        cleaned_token = cleaned_token[7:].strip()
    cfg.set_bearer_token(cleaned_token)
    clear_token_cache()
    status = get_auth_status()
    return {"success": True, "message": "Bearer token applied", "auth": status}


def start_device_code_login() -> dict:
    """
    Initiates Microsoft OAuth 2.0 Device Code Authorization.
    Returns user_code, verification_uri, and device_code for browser login.
    """
    global _is_disconnected
    with _cache_lock:
        _is_disconnected = False

    url = "https://login.microsoftonline.com/organizations/oauth2/v2.0/devicecode"
    payload = {
        "client_id": "04b07795-8ddb-461a-bbee-02f9e1bf7b46",  # Standard Microsoft CLI client ID
        "scope": "https://api.fabric.microsoft.com/.default offline_access openid profile email"
    }
    try:
        resp = requests.post(url, data=payload, timeout=12)
        if resp.status_code == 200:
            data = resp.json()
            return {
                "success": True,
                "user_code": data.get("user_code"),
                "device_code": data.get("device_code"),
                "verification_uri": data.get("verification_uri", "https://login.microsoft.com/device"),
                "expires_in": data.get("expires_in", 900),
                "interval": data.get("interval", 5),
                "message": data.get("message")
            }
        return {"success": False, "error": f"Device authorization failed ({resp.status_code}): {resp.text[:200]}"}
    except Exception as e:
        return {"success": False, "error": str(e)}


def poll_device_code_token(device_code: str) -> dict:
    """
    Polls Microsoft OAuth token endpoint to check if the user has approved the device code.
    """
    url = "https://login.microsoftonline.com/organizations/oauth2/v2.0/token"
    payload = {
        "grant_type": "urn:ietf:params:oauth:grant-type:device_code",
        "client_id": "04b07795-8ddb-461a-bbee-02f9e1bf7b46",
        "device_code": device_code.strip()
    }
    try:
        resp = requests.post(url, data=payload, timeout=12)
        data = resp.json()
        if resp.status_code == 200:
            token = data.get("access_token")
            expires_in = int(data.get("expires_in", 3600))
            now = time.time()
            expires_at = now + max(60, expires_in - _SAFETY_MARGIN_SECONDS)

            user_identity = "Microsoft User"
            tenant_id = "Microsoft Entra"

            # Parse JWT payload from access_token or id_token
            raw_id = data.get("id_token") or token
            if raw_id and "." in raw_id:
                try:
                    import base64
                    parts = raw_id.split(".")
                    if len(parts) >= 2:
                        padded = parts[1] + "=" * ((4 - len(parts[1]) % 4) % 4)
                        payload_json = json.loads(base64.urlsafe_b64decode(padded).decode("utf-8", "ignore"))
                        user_identity = payload_json.get("unique_name") or payload_json.get("upn") or payload_json.get("email") or payload_json.get("name") or user_identity
                        tenant_id = payload_json.get("tid") or tenant_id
                except Exception:
                    pass

            with _cache_lock:
                _token_cache.update({
                    "token": token,
                    "expires_at": expires_at,
                    "auth_method": "browser_device_code",
                    "user_identity": user_identity,
                    "tenant_id": tenant_id,
                })
            return {"success": True, "status": "authenticated", "auth": get_auth_status()}

        err = data.get("error")
        if err == "authorization_pending":
            return {"success": True, "status": "pending"}
        elif err == "authorization_declined":
            return {"success": False, "status": "declined", "error": "Sign-in was declined on Microsoft."}
        elif err == "expired_token":
            return {"success": False, "status": "expired", "error": "Login code has expired. Please launch again."}
        else:
            return {"success": False, "status": "error", "error": data.get("error_description", err)}
    except Exception as e:
        return {"success": False, "error": str(e)}
