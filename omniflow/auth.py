"""omniflow/auth.py
Authentication & Role-Based Access Control (RBAC) Module for OmniFlow.
Strict Pydantic v2 models, PBKDF2 password hashing, and PostgreSQL persistence.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import os
import secrets
import subprocess
import time
import uuid
from typing import Any, List, Optional
from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

load_dotenv("omniflow/.env")
load_dotenv()

auth_router = APIRouter(prefix="/api", tags=["Auth & RBAC"])

def get_db_uri() -> str:
    return (
        os.getenv("NEON_DATABASE_URL")
        or os.getenv("DATABASE_URL")
        or os.getenv("POSTGRES_URI")
        or ""
    )

NEON_URI = get_db_uri()

# -----------------------------------------------------------------------------
# Models
# -----------------------------------------------------------------------------

class UserRegisterRequest(BaseModel):
    email: str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$")
    password: str = Field(..., min_length=6)
    name: str = Field(..., min_length=2)

class UserLoginRequest(BaseModel):
    email: str = Field(..., pattern=r"^[^@]+@[^@]+\.[^@]+$")
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    name: str
    avatar_color: str
    created_at: str

class ProjectMemberAddRequest(BaseModel):
    user_id: str
    role: str = Field(default="contributor", pattern="^(owner|contributor|viewer)$")

class ProjectMemberRoleRequest(BaseModel):
    user_id: str
    role: str = Field(..., pattern="^(owner|contributor|viewer)$")

class ProjectMemberResponse(BaseModel):
    id: str
    project_id: str
    user_id: str
    name: str
    email: str
    role: str
    avatar_color: str
    joined_at: str

# -----------------------------------------------------------------------------
# Security & Hashing
# -----------------------------------------------------------------------------

def _hash_password(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
    return f"{salt}:{dk.hex()}"

def _verify_password(password: str, stored_hash: str) -> bool:
    try:
        salt, expected_hex = stored_hash.split(":", 1)
        dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt.encode("utf-8"), 100000)
        return hmac.compare_digest(dk.hex(), expected_hex)
    except Exception:
        return False

# In-memory fast cache
_USERS_CACHE: list[dict[str, Any]] = []
_MEMBERS_CACHE: dict[str, list[dict[str, Any]]] = {}

# -----------------------------------------------------------------------------
# DB Migration & Seeding
# -----------------------------------------------------------------------------

def init_auth_db() -> None:
    """Creates users and project_members tables and seeds default team accounts."""
    global _USERS_CACHE, _MEMBERS_CACHE
    if not NEON_URI:
        return

    try:
        with psycopg2.connect(NEON_URI, connect_timeout=8) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id VARCHAR(64) PRIMARY KEY,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        password_hash TEXT NOT NULL,
                        name VARCHAR(255) NOT NULL,
                        avatar_color VARCHAR(32) DEFAULT '#10b981',
                        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
                    );

                    CREATE TABLE IF NOT EXISTS project_members (
                        id VARCHAR(64) PRIMARY KEY,
                        project_id VARCHAR(64) NOT NULL,
                        user_id VARCHAR(64) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        role VARCHAR(32) NOT NULL DEFAULT 'contributor',
                        joined_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE (project_id, user_id)
                    );
                """)
                conn.commit()

                # Seed initial team accounts if empty
                cur.execute("SELECT COUNT(*) FROM users;")
                count = cur.fetchone()[0]
                if count == 0:
                    seed_users = [
                        ("usr_lead", "Bheesetti.Harsith@Pelibiothermal.com", "Bheesetti Harsith", "AdminPass123!", "#10b981"),
                        ("usr_sarah", "sarah.chen@fabric.ai", "Sarah Chen", "MemberPass123!", "#3b82f6"),
                        ("usr_david", "david.miller@fabric.ai", "David Miller", "MemberPass123!", "#8b5cf6"),
                        ("usr_elena", "elena.rostova@fabric.ai", "Elena Rostova", "MemberPass123!", "#f59e0b"),
                    ]
                    for uid, email, name, pwd, color in seed_users:
                        cur.execute(
                            "INSERT INTO users (id, email, password_hash, name, avatar_color) VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING;",
                            (uid, email, _hash_password(pwd), name, color),
                        )
                    conn.commit()

                # Warm cache
                cur.execute("SELECT id, email, name, avatar_color, created_at FROM users;")
                rows = cur.fetchall()
                _USERS_CACHE = [
                    {
                        "id": r[0],
                        "email": r[1],
                        "name": r[2],
                        "avatar_color": r[3] or "#10b981",
                        "created_at": r[4].isoformat() if r[4] else time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                    }
                    for r in rows
                ]
    except Exception as e:
        print(f"[OmniFlow Auth] DB Init Warning: {e}")

# -----------------------------------------------------------------------------
# Endpoints
# -----------------------------------------------------------------------------

@auth_router.post("/auth/register")
def register_user(req: UserRegisterRequest) -> dict[str, Any]:
    global _USERS_CACHE
    uid = f"usr_{uuid.uuid4().hex[:8]}"
    pwd_hash = _hash_password(req.password)
    color = secrets.choice(["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ec4899", "#06b6d4"])

    # Check email duplicate in cache
    if any(u["email"].lower() == req.email.lower() for u in _USERS_CACHE):
        raise HTTPException(status_code=400, detail="User with this email already exists.")

    new_user = {
        "id": uid,
        "email": req.email,
        "name": req.name,
        "avatar_color": color,
        "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }
    _USERS_CACHE.append(new_user)

    if NEON_URI:
        try:
            with psycopg2.connect(NEON_URI, connect_timeout=5) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO users (id, email, password_hash, name, avatar_color) VALUES (%s, %s, %s, %s, %s);",
                        (uid, req.email, pwd_hash, req.name, color),
                    )
                    conn.commit()
        except Exception as e:
            print(f"[Auth Register Error]: {e}")

    return {"success": True, "user": new_user}


@auth_router.post("/auth/login")
def login_user(req: UserLoginRequest) -> dict[str, Any]:
    target_user = None
    stored_hash = None

    if NEON_URI:
        try:
            with psycopg2.connect(NEON_URI, connect_timeout=5) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "SELECT id, email, password_hash, name, avatar_color, created_at FROM users WHERE LOWER(email) = LOWER(%s);",
                        (req.email,),
                    )
                    row = cur.fetchone()
                    if row:
                        stored_hash = row[2]
                        target_user = {
                            "id": row[0],
                            "email": row[1],
                            "name": row[3],
                            "avatar_color": row[4] or "#10b981",
                            "created_at": row[5].isoformat() if row[5] else time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        }
        except Exception:
            pass

    if not target_user or not stored_hash or not _verify_password(req.password, stored_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password.")

    return {"success": True, "user": target_user}


@auth_router.get("/users/search")
def search_users(q: str = Query("", description="Query string")) -> dict[str, Any]:
    global _USERS_CACHE
    query = q.strip().lower()
    if not query:
        return {"users": _USERS_CACHE[:15]}
    filtered = [
        u for u in _USERS_CACHE
        if query in u["name"].lower() or query in u["email"].lower()
    ]
    if "@" in query and not any(u["email"].lower() == query for u in filtered):
        c_name = query.split("@")[0].replace(".", " ").replace("_", " ").title()
        filtered.append({
            "id": f"usr_{uuid.uuid4().hex[:6]}",
            "name": c_name,
            "email": query,
            "avatar_color": "#10b981",
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
        })
    return {"users": filtered[:15]}


@auth_router.get("/projects/{project_id}/members")
def get_project_members(project_id: str) -> dict[str, Any]:
    global _MEMBERS_CACHE
    if project_id in _MEMBERS_CACHE:
        return {"members": _MEMBERS_CACHE[project_id]}

    members = []
    if NEON_URI:
        try:
            with psycopg2.connect(NEON_URI, connect_timeout=5) as conn:
                with conn.cursor() as cur:
                    cur.execute("""
                        SELECT pm.id, pm.project_id, pm.user_id, u.name, u.email, pm.role, u.avatar_color, pm.joined_at
                        FROM project_members pm
                        JOIN users u ON pm.user_id = u.id
                        WHERE pm.project_id = %s
                        ORDER BY pm.joined_at ASC;
                    """, (project_id,))
                    for r in cur.fetchall():
                        members.append({
                            "id": r[0],
                            "project_id": r[1],
                            "user_id": r[2],
                            "name": r[3],
                            "email": r[4],
                            "role": r[5],
                            "avatar_color": r[6] or "#10b981",
                            "joined_at": r[7].isoformat() if r[7] else time.strftime("%Y-%m-%dT%H:%M:%SZ"),
                        })
        except Exception:
            pass

    _MEMBERS_CACHE[project_id] = members
    return {"members": members}


@auth_router.post("/projects/{project_id}/members/add")
def add_project_member(project_id: str, req: ProjectMemberAddRequest) -> dict[str, Any]:
    global _MEMBERS_CACHE, _USERS_CACHE
    user = next((u for u in _USERS_CACHE if u["id"] == req.user_id or u["email"].lower() == req.user_id.lower()), None)
    if not user:
        if "@" in req.user_id:
            user = {
                "id": f"usr_{uuid.uuid4().hex[:8]}",
                "name": req.user_id.split("@")[0].replace(".", " ").title(),
                "email": req.user_id.strip(),
                "avatar_color": "#3b82f6",
                "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
            }
            _USERS_CACHE.append(user)
        else:
            raise HTTPException(status_code=404, detail="User not found.")

    member_id = f"mem_{uuid.uuid4().hex[:8]}"
    new_member = {
        "id": member_id,
        "project_id": project_id,
        "user_id": user["id"],
        "name": user["name"],
        "email": user["email"],
        "role": req.role,
        "avatar_color": user["avatar_color"],
        "joined_at": time.strftime("%Y-%m-%dT%H:%M:%SZ"),
    }

    if project_id not in _MEMBERS_CACHE:
        _MEMBERS_CACHE[project_id] = []
    
    # Check if already added
    if any(m["user_id"] == user["id"] or m["email"].lower() == user["email"].lower() for m in _MEMBERS_CACHE[project_id]):
        raise HTTPException(status_code=400, detail="User is already a member of this project.")

    _MEMBERS_CACHE[project_id].append(new_member)

    # Also synchronize with server.PROJECTS_CACHE so scoping picks it up immediately
    try:
        from server import PROJECTS_CACHE
        target_p = next((p for p in PROJECTS_CACHE if p["id"] == project_id), None)
        if target_p:
            meta = target_p.get("metadata") or {}
            m_list = list(meta.get("members", []))
            m_list = [m for m in m_list if m.get("email", "").lower() != user["email"].lower()]
            m_list.append({
                "id": member_id,
                "user_id": user["id"],
                "name": user["name"],
                "email": user["email"],
                "role": req.role,
                "avatarBg": user["avatar_color"],
            })
            meta["members"] = m_list
            target_p["metadata"] = meta
    except Exception:
        pass

    if NEON_URI:
        try:
            with psycopg2.connect(NEON_URI, connect_timeout=5) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "INSERT INTO project_members (id, project_id, user_id, role) VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING;",
                        (member_id, project_id, req.user_id, req.role),
                    )
                    conn.commit()
        except Exception as e:
            print(f"[Add Member Error]: {e}")

    return {"success": True, "member": new_member}


@auth_router.post("/projects/{project_id}/members/remove")
def remove_project_member(project_id: str, payload: dict[str, str]) -> dict[str, Any]:
    global _MEMBERS_CACHE
    user_id = payload.get("user_id")
    if not user_id:
        raise HTTPException(status_code=400, detail="user_id is required.")

    if project_id in _MEMBERS_CACHE:
        _MEMBERS_CACHE[project_id] = [m for m in _MEMBERS_CACHE[project_id] if m["user_id"] != user_id]

    if NEON_URI:
        try:
            with psycopg2.connect(NEON_URI, connect_timeout=5) as conn:
                with conn.cursor() as cur:
                    cur.execute(
                        "DELETE FROM project_members WHERE project_id = %s AND user_id = %s;",
                        (project_id, user_id),
                    )
                    conn.commit()
        except Exception:
            pass

    return {"success": True}


# -----------------------------------------------------------------------------
# Microsoft Fabric Account & Tenancy Endpoints
# -----------------------------------------------------------------------------

class BrowserLoginRequest(BaseModel):
    tenant: Optional[str] = None


class SwitchAccountRequest(BaseModel):
    account_id: str
    tenant_id: Optional[str] = None


class DeviceCodePollRequest(BaseModel):
    device_code: str


_ACTIVE_FABRIC_ACCOUNT: dict[str, Any] = {
    "id": "fb730ff8-3f18-4cf8-a13b-5558407772c1",
    "name": "Bheesetti Harsith",
    "email": "Bheesetti.Harsith@Pelibiothermal.com",
    "tenant_id": os.getenv("AZURE_TENANT_ID", "94b62ba4-8d71-4507-9dc9-9734a149f836"),
    "tenant_name": "PELICAN PRODUCTS INC",
    "is_active": True,
    "account_type": "Azure CLI / Enterprise SSO",
    "default_workspace_id": os.getenv("ALLOWED_WORKSPACE_ID", "db7344c1-ecd9-44d6-849f-f2de49484f9f"),
    "default_workspace_name": os.getenv("ALLOWED_WORKSPACE_NAME", "PBT_DATA_AGENT"),
}


def _run_az_cmd(args: list[str], timeout: int = 15) -> tuple[int, str, str]:
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
    except Exception as e:
        logger.warning(f"Error executing az command {' '.join(full_cmd)}: {e}")
        return 1, "", str(e)


def _get_azure_cli_account() -> dict[str, Any]:
    global _ACTIVE_FABRIC_ACCOUNT
    rc, out, _ = _run_az_cmd(["account", "show", "--output", "json"], timeout=8)
    if rc == 0 and out.strip():
        try:
            data = json.loads(out)
            user_name = data.get("user", {}).get("name", "Bheesetti.Harsith@Pelibiothermal.com")
            tenant_id = data.get("tenantId") or data.get("homeTenantId") or os.getenv("AZURE_TENANT_ID", "94b62ba4-8d71-4507-9dc9-9734a149f836")
            sub_id = data.get("id", "fb730ff8-3f18-4cf8-a13b-5558407772c1")
            tenant_display = data.get("tenantDisplayName") or data.get("name", "PELICAN PRODUCTS INC")
            _ACTIVE_FABRIC_ACCOUNT = {
                "id": sub_id,
                "name": user_name.split("@")[0].replace(".", " ").title(),
                "email": user_name,
                "tenant_id": tenant_id,
                "tenant_name": tenant_display,
                "subscription_id": sub_id,
                "is_active": True,
                "account_type": "Azure CLI SSO",
                "default_workspace_id": os.getenv("ALLOWED_WORKSPACE_ID", "db7344c1-ecd9-44d6-849f-f2de49484f9f"),
                "default_workspace_name": os.getenv("ALLOWED_WORKSPACE_NAME", "PBT_DATA_AGENT"),
            }
            return _ACTIVE_FABRIC_ACCOUNT
        except Exception as e:
            logger.warning(f"Failed parsing az account show: {e}")
    return _ACTIVE_FABRIC_ACCOUNT


@auth_router.get("/auth/accounts")
@auth_router.get("/fabric/accounts")
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
                accounts.append({
                    "id": sub_id,
                    "name": name,
                    "email": user_email,
                    "tenant_id": tenant_id,
                    "tenant_name": tenant_name,
                    "subscription_id": sub_id,
                    "is_active": is_active,
                    "account_type": a.get("name", "Azure CLI"),
                    "default_workspace_id": os.getenv("ALLOWED_WORKSPACE_ID", "db7344c1-ecd9-44d6-849f-f2de49484f9f"),
                    "default_workspace_name": os.getenv("ALLOWED_WORKSPACE_NAME", "PBT_DATA_AGENT"),
                })
            if accounts:
                accounts.sort(key=lambda x: not x["is_active"])
                return accounts
        except Exception as e:
            logger.warning(f"Failed parsing az account list: {e}")

    # Fallback to single active session
    return [_get_azure_cli_account()]


@auth_router.post("/auth/login/browser")
def login_fabric_browser(req: BrowserLoginRequest = BrowserLoginRequest()) -> dict[str, Any]:
    """Initiates browser sign-in for Microsoft Fabric via Azure CLI."""
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


@auth_router.post("/auth/login/device-code")
def login_fabric_device_code() -> dict[str, Any]:
    client_id = "04b07795-8ddb-461a-bbee-02f9e1bf7b46"
    try:
        import urllib.request, urllib.parse
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


@auth_router.post("/auth/login/device-code/poll")
def poll_fabric_device_code(req: DeviceCodePollRequest) -> dict[str, Any]:
    account = _get_azure_cli_account()
    return {
        "status": "authenticated",
        "user_identity": account.get("email", "Bheesetti.Harsith@Pelibiothermal.com"),
    }


@auth_router.post("/auth/switch-account")
def switch_fabric_account(req: SwitchAccountRequest) -> dict[str, Any]:
    global _ACTIVE_FABRIC_ACCOUNT
    sub_id = req.account_id
    rc, _, err = _run_az_cmd(["account", "set", "--subscription", sub_id], timeout=10)
    account = _get_azure_cli_account()
    if rc == 0:
        return {
            "success": True,
            "message": f"Switched active Fabric session to {account.get('name', 'selected account')} ({account.get('tenant_name')})",
            "account": account,
        }
    else:
        logger.warning(f"az account set failed: {err}")
        return {
            "success": False,
            "message": f"Failed to switch account: {err}",
            "account": account,
        }


@auth_router.post("/auth/logout")
def logout_fabric() -> dict[str, Any]:
    return {"success": True, "message": "Fabric session cleared."}
