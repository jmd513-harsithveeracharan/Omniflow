"""omniflow/auth.py
Authentication & Role-Based Access Control (RBAC) Module for OmniFlow.
Strict Pydantic v2 models, PBKDF2 password hashing, and PostgreSQL persistence.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
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

logger = logging.getLogger("omniflow.auth")

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
                    admin_pwd = os.getenv("INITIAL_ADMIN_PASSWORD") or secrets.token_urlsafe(12)
                    member_pwd = os.getenv("INITIAL_MEMBER_PASSWORD") or secrets.token_urlsafe(12)
                    seed_users = [
                        ("usr_lead", os.getenv("FABRIC_USER_IDENTITY", "admin@fabric.internal"), "System Lead", admin_pwd, "#10b981"),
                        ("usr_sarah", "sarah.chen@fabric.internal", "Sarah Chen", member_pwd, "#3b82f6"),
                        ("usr_david", "david.miller@fabric.internal", "David Miller", member_pwd, "#8b5cf6"),
                        ("usr_elena", "elena.rostova@fabric.internal", "Elena Rostova", member_pwd, "#f59e0b"),
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
# Microsoft Fabric Account & Tenancy Submodule
# -----------------------------------------------------------------------------
from omniflow.auth.fabric import (
    fabric_auth_router,
    register_cache_invalidation_hook,
    invalidate_all_auth_caches,
    _get_azure_cli_account,
    _run_az_cmd,
    _ACTIVE_FABRIC_ACCOUNT,
    BrowserLoginRequest,
    SwitchAccountRequest,
    DeviceCodePollRequest,
    get_fabric_accounts,
)

auth_router.include_router(fabric_auth_router)
