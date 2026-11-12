"""omniflow/auth/az_login_flows.py
------------------------------
Interactive Azure CLI login flow managers for Browser Sign-in and Device Code Sign-in.
Uses direct Python subprocess invocation with Windows WAM disabled so browser tabs and
Microsoft device codes work reliably without blocking or leaking orphan processes.
"""
from __future__ import annotations

import json
import logging
import re
import secrets
import subprocess
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Optional

from omniflow.auth.az_cli import resolve_az_command

logger = logging.getLogger("omniflow.auth_login_flows")

_FLOW_LOCK = threading.Lock()
_DEVICE_CODE_REGEX = re.compile(r"enter the code\s+([A-Z0-9-]{6,20})", re.IGNORECASE)
_URL_REGEX = re.compile(r"(https://[^\s]+)")
_DEFAULT_DEVICE_URL = "https://login.microsoft.com/device"


@dataclass
class DeviceFlowSession:
    flow_id: str
    proc: subprocess.Popen[str]
    user_code: str
    verification_uri: str
    expires_at: float
    output_lines: list[str] = field(default_factory=list)
    drain_thread: Optional[threading.Thread] = None
    cancelled: bool = False


_DEVICE_FLOWS: dict[str, DeviceFlowSession] = {}
_ACTIVE_BROWSER_PROC: Optional[subprocess.Popen[str]] = None
_BROWSER_CANCELLED: bool = False


def _terminate_proc(proc: Optional[subprocess.Popen[str]]) -> None:
    """Terminates an interactive login subprocess cleanly without hanging."""
    if proc is None or proc.poll() is not None:
        return
    try:
        proc.terminate()
        proc.wait(timeout=3)
    except Exception:
        try:
            proc.kill()
        except Exception:
            pass


def _extract_logged_in_identity(raw_text: str) -> tuple[Optional[str], Optional[str]]:
    """Extracts (email, tenant_id) from Azure CLI login JSON output even if prefixed by warnings."""
    end = raw_text.rfind("]")
    if end == -1:
        return None, None
    idx = 0
    while idx < end:
        start = raw_text.find("[", idx, end)
        if start == -1:
            return None, None
        try:
            payload = json.loads(raw_text[start : end + 1])
        except Exception:
            idx = start + 1
            continue
        if isinstance(payload, list) and payload:
            first = payload[0] if isinstance(payload[0], dict) else {}
            email = (first.get("user") or {}).get("name") if isinstance(first.get("user"), dict) else None
            tenant_id = first.get("tenantId") or first.get("homeTenantId")
            return email, tenant_id
        return None, None
    return None, None


def _build_login_args(tenant: Optional[str], use_device_code: bool) -> list[str]:
    """Builds common Azure CLI login arguments for browser or device-code authentication."""
    args = ["login", "--allow-no-subscriptions", "--output", "json"]
    if use_device_code:
        args.append("--use-device-code")
    clean_tenant = (tenant or "").strip()
    if clean_tenant:
        args.extend(["--tenant", clean_tenant])
    return args


def _clean_az_error(raw_text: str, fallback: str) -> str:
    """Returns a concise user-facing error message from Azure CLI output."""
    lines = [
        line.strip()
        for line in raw_text.splitlines()
        if line.strip() and not line.strip().startswith(("{", "["))
    ]
    for line in reversed(lines):
        if any(k in line.lower() for k in ("error:", "aadsts", "failed", "canceled", "cancelled", "expired", "timed out")):
            return line[:220]
    return lines[-1][:220] if lines else fallback


def cancel_browser_login_flow() -> dict[str, Any]:
    """Cancels an active interactive browser sign-in subprocess if running."""
    global _ACTIVE_BROWSER_PROC, _BROWSER_CANCELLED
    with _FLOW_LOCK:
        proc = _ACTIVE_BROWSER_PROC
        if proc is not None and proc.poll() is None:
            _BROWSER_CANCELLED = True
            _terminate_proc(proc)
            _ACTIVE_BROWSER_PROC = None
            return {"success": True, "cancelled": True, "message": "Browser sign-in cancelled."}
    return {"success": True, "cancelled": False, "message": "No active browser sign-in."}


def run_browser_login_flow(tenant: Optional[str] = None, timeout_seconds: int = 150) -> dict[str, Any]:
    """Launches real interactive browser sign-in via Azure CLI with Windows WAM disabled."""
    global _ACTIVE_BROWSER_PROC, _BROWSER_CANCELLED
    cancel_browser_login_flow()
    _cancel_existing_device_flows()

    cmd, use_shell, env = resolve_az_command(_build_login_args(tenant, use_device_code=False), disable_wam_broker=True)
    proc = subprocess.Popen(
        cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
        text=True, shell=use_shell, env=env,
    )
    with _FLOW_LOCK:
        _BROWSER_CANCELLED = False
        _ACTIVE_BROWSER_PROC = proc

    try:
        stdout, stderr = proc.communicate(timeout=timeout_seconds)
        with _FLOW_LOCK:
            was_cancelled = _BROWSER_CANCELLED
            if _ACTIVE_BROWSER_PROC is proc:
                _ACTIVE_BROWSER_PROC = None
        if was_cancelled:
            return {"success": False, "cancelled": True, "message": "Browser sign-in was cancelled."}
        email, tenant_id = _extract_logged_in_identity(stdout or "")
        if proc.returncode == 0:
            return {"success": True, "email": email, "tenant_id": tenant_id, "message": "Sign-in succeeded."}
        return {"success": False, "email": None, "tenant_id": None, "message": _clean_az_error(f"{stdout}\n{stderr}", "Browser sign-in was cancelled or failed.")}
    except subprocess.TimeoutExpired:
        _terminate_proc(proc)
        with _FLOW_LOCK:
            if _ACTIVE_BROWSER_PROC is proc:
                _ACTIVE_BROWSER_PROC = None
        return {"success": False, "email": None, "tenant_id": None, "message": f"Browser sign-in timed out after {timeout_seconds}s. Try again or use Device Code Sign-in."}
    except Exception as exc:
        _terminate_proc(proc)
        with _FLOW_LOCK:
            if _ACTIVE_BROWSER_PROC is proc:
                _ACTIVE_BROWSER_PROC = None
        return {"success": False, "email": None, "tenant_id": None, "message": f"Browser sign-in error: {exc}"}


def _cancel_existing_device_flows() -> None:
    with _FLOW_LOCK:
        sessions = list(_DEVICE_FLOWS.values())
        _DEVICE_FLOWS.clear()
    for sess in sessions:
        sess.cancelled = True
        _terminate_proc(sess.proc)


def start_device_code_flow(tenant: Optional[str] = None, wait_code_timeout: float = 18.0) -> dict[str, Any]:
    """Starts real `az login --use-device-code` and extracts its Microsoft user code and URL."""
    _cancel_existing_device_flows()
    cmd, use_shell, env = resolve_az_command(_build_login_args(tenant, use_device_code=True), disable_wam_broker=True)
    proc = subprocess.Popen(
        cmd, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1, shell=use_shell, env=env,
    )

    output_lines: list[str] = []
    found_event = threading.Event()
    extracted: dict[str, Optional[str]] = {"user_code": None, "verification_uri": None, "message": None}

    def _reader() -> None:
        if proc.stdout is None:
            found_event.set()
            return
        try:
            for line in iter(proc.stdout.readline, ""):
                output_lines.append(line)
                if not found_event.is_set():
                    code_match = _DEVICE_CODE_REGEX.search(line)
                    url_match = _URL_REGEX.search(line)
                    if code_match:
                        extracted["user_code"] = code_match.group(1).strip()
                        extracted["verification_uri"] = url_match.group(1).strip() if url_match else _DEFAULT_DEVICE_URL
                        extracted["message"] = line.strip()
                        found_event.set()
        except Exception as exc:
            logger.debug(f"Device code stream reader ended: {exc}")
        finally:
            found_event.set()

    drain_thread = threading.Thread(target=_reader, daemon=True)
    drain_thread.start()
    found_event.wait(timeout=wait_code_timeout)

    user_code = extracted.get("user_code")
    if not user_code:
        _terminate_proc(proc)
        return {
            "success": False,
            "verification_uri": _DEFAULT_DEVICE_URL,
            "expires_in": 900,
            "interval": 3,
            "error": _clean_az_error("".join(output_lines), "Timed out waiting for Microsoft device code from Azure CLI."),
        }

    flow_id = f"dc_{secrets.token_hex(8)}"
    verification_uri = extracted.get("verification_uri") or _DEFAULT_DEVICE_URL
    session = DeviceFlowSession(flow_id=flow_id, proc=proc, user_code=user_code, verification_uri=verification_uri, expires_at=time.time() + 900, output_lines=output_lines, drain_thread=drain_thread)
    with _FLOW_LOCK:
        _DEVICE_FLOWS[flow_id] = session

    return {
        "success": True,
        "device_code": flow_id,
        "user_code": user_code,
        "verification_uri": verification_uri,
        "message": extracted.get("message") or f"Go to {verification_uri} and enter code {user_code}",
        "expires_in": 900,
        "interval": 3,
    }


def poll_device_code_flow(device_code: str) -> dict[str, Any]:
    """Polls an active `az login --use-device-code` subprocess until authenticated, failed, or expired."""
    with _FLOW_LOCK:
        session = _DEVICE_FLOWS.get(device_code)
    if session is None:
        return {"success": False, "status": "error", "error": "Device login session expired or was replaced."}

    rc = session.proc.poll()
    if rc is None:
        if time.time() > session.expires_at:
            _terminate_proc(session.proc)
            with _FLOW_LOCK:
                _DEVICE_FLOWS.pop(device_code, None)
            return {"success": False, "status": "expired", "error": "Device login code expired. Please generate a new code."}
        return {"success": True, "status": "pending"}

    if session.drain_thread is not None:
        session.drain_thread.join(timeout=1.5)
    with _FLOW_LOCK:
        _DEVICE_FLOWS.pop(device_code, None)

    raw_output = "".join(session.output_lines)
    if rc == 0:
        email, tenant_id = _extract_logged_in_identity(raw_output)
        return {"success": True, "status": "authenticated", "user_identity": email, "tenant_id": tenant_id}

    lower_out = raw_output.lower()
    status = "declined" if "declined" in lower_out else ("expired" if "expired" in lower_out else "error")
    return {"success": False, "status": status, "error": _clean_az_error(raw_output, "Microsoft device code authentication failed.")}
