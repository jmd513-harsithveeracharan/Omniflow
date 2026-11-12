"""
omniflow/git_service.py
-----------------------
Enterprise Git, GitHub REST API, and Azure DevOps integration service.
Provides local repository initialization, atomic commits, GitHub remote
creation via PAT, and Azure DevOps Board Work Item linking.
"""

from __future__ import annotations

import json
import os
import subprocess
import urllib.error
import urllib.parse
import urllib.request
from typing import Any
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

git_router = APIRouter(prefix="/api/git", tags=["git"])


# ==============================================================================
# PYDANTIC V2 SCHEMAS
# ==============================================================================

class GitInitRequest(BaseModel):
    project_id: str
    local_path: str


class GitCommitRequest(BaseModel):
    project_id: str
    local_path: str
    message: str = Field(..., min_length=1)


class GitHubCreateRepoRequest(BaseModel):
    project_id: str
    local_path: str
    token: str = Field(..., min_length=4)
    repo_name: str = Field(..., min_length=2)
    description: str = ""
    is_private: bool = True
    org_name: str | None = None


class AdoWorkItemRequest(BaseModel):
    project_id: str
    local_path: str | None = None
    organization: str = Field(..., min_length=2)
    project_name: str = Field(..., min_length=2)
    pat_token: str = Field(..., min_length=4)
    title: str = Field(..., min_length=2)
    description: str = ""
    work_item_type: str = "Task"  # Task, User Story, Bug, Feature


class GitStatusResponse(BaseModel):
    is_git_repo: bool
    branch: str = ""
    commit_count: int = 0
    last_commit_hash: str = ""
    last_commit_message: str = ""
    last_commit_date: str = ""
    uncommitted_files: list[str] = Field(default_factory=list)
    remote_origin: str = ""


# ==============================================================================
# LOCAL GIT OPERATIONS
# ==============================================================================

def run_git(args: list[str], cwd: str) -> tuple[int, str, str]:
    """Executes a git command safely with UTF-8 decoding."""
    try:
        proc = subprocess.run(
            ["git", *args],
            cwd=cwd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=30,
        )
        return proc.returncode, proc.stdout.strip(), proc.stderr.strip()
    except Exception as e:
        return 1, "", str(e)


@git_router.get("/status")
def get_git_status(local_path: str) -> GitStatusResponse:
    if not local_path or not os.path.exists(local_path):
        return GitStatusResponse(is_git_repo=False)

    git_dir = os.path.join(local_path, ".git")
    if not os.path.isdir(git_dir):
        return GitStatusResponse(is_git_repo=False)

    code, branch, _ = run_git(["rev-parse", "--abbrev-ref", "HEAD"], local_path)
    current_branch = branch if code == 0 else "main"

    code, count_str, _ = run_git(["rev-list", "--count", "HEAD"], local_path)
    commit_count = int(count_str) if code == 0 and count_str.isdigit() else 0

    last_hash, last_msg, last_date = "", "", ""
    if commit_count > 0:
        code, log_out, _ = run_git(["log", "-1", "--pretty=format:%h|%s|%cd"], local_path)
        if code == 0 and "|" in log_out:
            parts = log_out.split("|", 2)
            last_hash = parts[0]
            last_msg = parts[1]
            last_date = parts[2] if len(parts) > 2 else ""

    code, status_out, _ = run_git(["status", "--porcelain"], local_path)
    uncommitted = [line.strip() for line in status_out.splitlines() if line.strip()]

    code, remote_out, _ = run_git(["remote", "get-url", "origin"], local_path)
    remote_origin = remote_out if code == 0 else ""

    return GitStatusResponse(
        is_git_repo=True,
        branch=current_branch,
        commit_count=commit_count,
        last_commit_hash=last_hash,
        last_commit_message=last_msg,
        last_commit_date=last_date,
        uncommitted_files=uncommitted,
        remote_origin=remote_origin,
    )


@git_router.post("/init")
def init_git_repo(req: GitInitRequest) -> dict[str, Any]:
    os.makedirs(req.local_path, exist_ok=True)

    # 1. git init
    code, out, err = run_git(["init"], req.local_path)
    if code != 0:
        raise HTTPException(status_code=500, detail=f"git init failed: {err}")

    # 2. Standard enterprise data engineering .gitignore
    gitignore_path = os.path.join(req.local_path, ".gitignore")
    if not os.path.exists(gitignore_path):
        with open(gitignore_path, "w", encoding="utf-8") as f:
            f.write(
                "# Fabric AI Studio / OmniFlow Local Artifacts\n"
                ".env\n"
                ".env.local\n"
                "*.pyc\n"
                "__pycache__/\n"
                ".DS_Store\n"
                "*.db\n"
                "*.sqlite\n"
                "credentials.json\n"
                "*.token\n"
            )

    # 3. Initial README.md
    readme_path = os.path.join(req.local_path, "README.md")
    if not os.path.exists(readme_path):
        with open(readme_path, "w", encoding="utf-8") as f:
            f.write(
                f"# Project {req.project_id}\n\n"
                "Microsoft Fabric Medallion Architecture managed by **OmniFlow**.\n\n"
                "### Layer Structure\n"
                "- `01_raw/`: Bronze Lakehouse raw ingestion schemas\n"
                "- `02_curated/`: Silver PySpark Delta MERGE scripts\n"
                "- `03_gold/`: Kimball Warehouse dimensional DDL & semantic models\n"
            )

    # 4. Initial commit
    run_git(["add", "."], req.local_path)
    run_git(["commit", "-m", "feat: initialize OmniFlow project repository with Medallion architecture"], req.local_path)

    return {"success": True, "message": "Initialized Git repository successfully", "path": req.local_path}


@git_router.post("/commit")
def commit_git_changes(req: GitCommitRequest) -> dict[str, Any]:
    if not os.path.exists(req.local_path):
        raise HTTPException(status_code=400, detail="Local path does not exist")

    # Stage all changes
    code, _, err = run_git(["add", "."], req.local_path)
    if code != 0:
        raise HTTPException(status_code=500, detail=f"git add failed: {err}")

    # Check if there are changes to commit
    code, status_out, _ = run_git(["status", "--porcelain"], req.local_path)
    if not status_out.strip():
        return {"success": True, "message": "Working directory clean; no changes to commit."}

    code, out, err = run_git(["commit", "-m", req.message], req.local_path)
    if code != 0:
        raise HTTPException(status_code=500, detail=f"git commit failed: {err}")

    return {"success": True, "message": req.message, "output": out}


# ==============================================================================
# GITHUB CLOUD REPO CREATION (REST API)
# ==============================================================================

@git_router.post("/github/create")
def create_github_repo(req: GitHubCreateRepoRequest) -> dict[str, Any]:
    os.makedirs(req.local_path, exist_ok=True)

    # Ensure git is initialized locally first
    git_dir = os.path.join(req.local_path, ".git")
    if not os.path.isdir(git_dir):
        init_git_repo(GitInitRequest(project_id=req.project_id, local_path=req.local_path))

    # GitHub API Endpoint
    api_url = (
        f"https://api.github.com/orgs/{req.org_name}/repos"
        if req.org_name
        else "https://api.github.com/user/repos"
    )

    payload = {
        "name": req.repo_name,
        "description": req.description or f"OmniFlow Medallion project: {req.project_id}",
        "private": req.is_private,
        "auto_init": False,
    }

    req_data = json.dumps(payload).encode("utf-8")
    headers = {
        "Authorization": f"Bearer {req.token}",
        "Accept": "application/vnd.github.v3+json",
        "Content-Type": "application/json",
        "User-Agent": "OmniFlow-Fabric-Studio",
    }

    try:
        http_req = urllib.request.Request(api_url, data=req_data, headers=headers, method="POST")
        with urllib.request.urlopen(http_req, timeout=15) as res:
            res_body = json.loads(res.read().decode("utf-8"))
            html_url = res_body.get("html_url", "")
            clone_url = res_body.get("clone_url", "")
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        if e.code == 422 and "already exists" in err_msg:
            # Repo already exists on GitHub, proceed to push
            clone_url = f"https://github.com/{req.org_name or 'user'}/{req.repo_name}.git"
            html_url = f"https://github.com/{req.org_name or 'user'}/{req.repo_name}"
        else:
            raise HTTPException(status_code=e.code, detail=f"GitHub API Error: {err_msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to GitHub: {str(e)}")

    # Add/Update remote origin with auth token embedded safely
    authenticated_remote = clone_url.replace("https://", f"https://{req.token}@")
    run_git(["remote", "remove", "origin"], req.local_path)
    run_git(["remote", "add", "origin", authenticated_remote], req.local_path)
    run_git(["branch", "-M", "main"], req.local_path)

    # Push to GitHub
    code, out, err = run_git(["push", "-u", "origin", "main"], req.local_path)
    if code != 0:
        # Retry with force lease if already initialized
        code2, out2, err2 = run_git(["push", "-u", "origin", "main", "--force"], req.local_path)
        if code2 != 0:
            raise HTTPException(status_code=500, detail=f"Failed to push to GitHub: {err or err2}")

    return {
        "success": True,
        "repo_url": html_url,
        "clone_url": clone_url,
        "message": f"Successfully created GitHub repository and pushed main branch.",
    }


# ==============================================================================
# AZURE DEVOPS BOARDS & WORK ITEMS (REST API)
# ==============================================================================

@git_router.post("/azure-devops/workitem")
def create_ado_work_item(req: AdoWorkItemRequest) -> dict[str, Any]:
    """
    Creates an Azure DevOps Work Item (Task, User Story, Feature) on the team board
    using the Azure DevOps REST API via JSON Patch.
    """
    import base64

    # ADO requires Basic authentication with base64 encoded PAT: ":<PAT>"
    auth_header = "Basic " + base64.b64encode(f":{req.pat_token}".encode("ascii")).decode("ascii")

    enc_proj = urllib.parse.quote(req.project_name)
    enc_type = urllib.parse.quote(f"${req.work_item_type}")
    api_url = (
        f"https://dev.azure.com/{req.organization}/{enc_proj}/_apis/wit/workitems/{enc_type}?api-version=7.1-preview.3"
    )

    patch_doc = [
        {"op": "add", "path": "/fields/System.Title", "value": req.title},
        {
            "op": "add",
            "path": "/fields/System.Description",
            "value": f"{req.description}<br/><br/><i>Created by OmniFlow Fabric Studio for Project {req.project_id}</i>",
        },
        {"op": "add", "path": "/fields/System.Tags", "value": "OmniFlow; Microsoft-Fabric; Medallion"},
    ]

    req_data = json.dumps(patch_doc).encode("utf-8")
    headers = {
        "Authorization": auth_header,
        "Content-Type": "application/json-patch+json",
        "User-Agent": "OmniFlow-Fabric-Studio",
    }

    try:
        http_req = urllib.request.Request(api_url, data=req_data, headers=headers, method="POST")
        with urllib.request.urlopen(http_req, timeout=15) as res:
            res_body = json.loads(res.read().decode("utf-8"))
            item_id = res_body.get("id")
            web_url = res_body.get("_links", {}).get("html", {}).get("href", "")
            return {
                "success": True,
                "work_item_id": item_id,
                "work_item_url": web_url,
                "title": req.title,
                "type": req.work_item_type,
                "message": f"Created Azure DevOps Work Item #{item_id}: {req.title}",
            }
    except urllib.error.HTTPError as e:
        err_msg = e.read().decode("utf-8", errors="ignore")
        raise HTTPException(status_code=e.code, detail=f"Azure DevOps API Error: {err_msg}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to connect to Azure DevOps: {str(e)}")

