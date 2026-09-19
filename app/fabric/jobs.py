"""
app/fabric/jobs.py
------------------
Job execution, pipeline schedules, and Git CI/CD synchronization in Microsoft Fabric.
"""

import datetime
from app.config import ALLOWED_WORKSPACE_ID
from app.fabric.core import (
    _BASE,
    _assert_workspace,
    _poll_lro,
    get_auth_headers,
    get_client_attr,
    get_requests,
)


def trigger_pipeline_run(
    pipeline_id: str,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> dict:
    """
    Triggers a Data Factory pipeline run via the Fabric Jobs API.
    Returns {success, job_id, location} or {success: False, error}.
    """
    _assert_workspace(workspace_id)
    req = get_requests()
    headers = get_auth_headers()
    resp = req.post(
        f"{_BASE}/workspaces/{workspace_id}/items/{pipeline_id}/jobs/instances?jobType=Pipeline",
        headers=headers,
        timeout=20,
    )

    if resp.status_code in (200, 201, 202):
        location = resp.headers.get("Location", "")
        job_id = location.split("/")[-1] if "/" in location else None
        print(f"[FABRIC] Pipeline {pipeline_id} triggered. Job ID: {job_id}")
        return {"success": True, "job_id": job_id, "location": location}

    print(f"[FABRIC] Pipeline trigger failed: {resp.status_code} {resp.text[:300]}")
    return {"success": False, "error": resp.text, "status_code": resp.status_code}


def create_pipeline_schedule(
    pipeline_id: str,
    time_str: str = "10:30",
    schedule_type: str = "Daily",
    time_zone: str = "UTC",
    days_valid: int = 365,
    enabled: bool = True,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> dict:
    """
    Creates/activates an automated schedule for a Data Factory pipeline in Microsoft Fabric.
    Official Spec: POST /v1/workspaces/{workspaceId}/items/{pipelineId}/jobs/Execute/schedules
    """
    _assert_workspace(workspace_id)
    req = get_requests()
    headers = get_auth_headers()

    now = datetime.datetime.now(datetime.UTC)
    start_dt = now.strftime("%Y-%m-%dT%H:%M:%S")
    end_dt = (now + datetime.timedelta(days=days_valid)).strftime("%Y-%m-%dT%H:%M:%S")

    clean_time = time_str.replace(".", ":").strip()
    if ":" in clean_time:
        parts = clean_time.split(":")
        hh = parts[0].zfill(2)
        mm = parts[1].zfill(2)
        clean_time = f"{hh}:{mm}"
    else:
        clean_time = "10:30"

    payload = {
        "enabled": enabled,
        "configuration": {
            "type": schedule_type if schedule_type in ("Daily", "Weekly", "Cron") else "Daily",
            "startDateTime": start_dt,
            "endDateTime": end_dt,
            "localTimeZoneId": time_zone,
            "times": [clean_time],
        },
    }
    resp = req.post(
        f"{_BASE}/workspaces/{workspace_id}/items/{pipeline_id}/jobs/Execute/schedules",
        headers=headers,
        json=payload,
        timeout=20,
    )
    if resp.status_code in (200, 201):
        print(f"[FABRIC] Pipeline schedule created for {pipeline_id} at {clean_time} {time_zone} (Valid until {end_dt[:10]}).")
        return {"success": True, "schedule": resp.json()}
    print(f"[FABRIC] Pipeline schedule create failed for {pipeline_id}: {resp.status_code} {resp.text}")
    return {"success": False, "error": resp.text, "status_code": resp.status_code}


def get_job_status(
    pipeline_id: str,
    job_id: str,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> dict:
    """
    Fetches the current status of a pipeline job instance.
    Returns {status, start_time, end_time, failure_reason} or error dict.
    """
    _assert_workspace(workspace_id)
    req = get_requests()
    headers = get_auth_headers()
    resp = req.get(
        f"{_BASE}/workspaces/{workspace_id}/items/{pipeline_id}/jobs/instances/{job_id}",
        headers=headers,
        timeout=15,
    )

    if resp.status_code == 200:
        data = resp.json()
        return {
            "success": True,
            "status": data.get("status", "Unknown"),
            "start_time": data.get("startTimeUtc"),
            "end_time": data.get("endTimeUtc"),
            "failure_reason": data.get("failureReason"),
            "raw": data,
        }

    return {"success": False, "error": resp.text, "status_code": resp.status_code}


def get_git_status(workspace_id: str = ALLOWED_WORKSPACE_ID) -> dict:
    """
    Fetches the Git status of the connected workspace repository.
    Official Spec: POST /v1/workspaces/{workspaceId}/git/getGitStatus
    """
    fn = get_client_attr("get_git_status")
    if fn and fn is not get_git_status:
        return fn(workspace_id)

    _assert_workspace(workspace_id)
    req = get_requests()
    headers = get_auth_headers()
    resp = req.post(
        f"{_BASE}/workspaces/{workspace_id}/git/getGitStatus",
        headers=headers,
        timeout=20,
    )
    if resp.status_code == 200:
        return {"success": True, "git_status": resp.json()}
    return {"success": False, "error": resp.text, "status_code": resp.status_code}


def commit_to_git(
    comment: str,
    workspace_head: str | None = None,
    mode: str = "All",
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> dict:
    """
    Commits workspace changes to the connected Git branch.
    Official Spec: POST /v1/workspaces/{workspaceId}/git/commitToGit
    """
    _assert_workspace(workspace_id)
    req = get_requests()
    headers = get_auth_headers()

    if not workspace_head:
        git_fn = get_client_attr("get_git_status", get_git_status)
        status_res = git_fn(workspace_id)
        if status_res.get("success"):
            workspace_head = status_res.get("git_status", {}).get("workspaceHead", "")

    payload = {
        "mode": mode,
        "comment": comment[:300],
    }
    if workspace_head:
        payload["workspaceHead"] = workspace_head

    resp = req.post(
        f"{_BASE}/workspaces/{workspace_id}/git/commitToGit",
        headers=headers,
        json=payload,
        timeout=30,
    )

    if resp.status_code in (200, 202):
        location = resp.headers.get("Location")
        if location and resp.status_code == 202:
            success = _poll_lro(location, headers)
            return {"success": success, "message": "Committed to Git"}
        return {"success": True, "message": "Committed to Git"}

    return {"success": False, "error": resp.text, "status_code": resp.status_code}


def run_notebook(
    notebook_id: str,
    parameters: dict | None = None,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> dict:
    """
    Triggers execution of a PySpark Notebook via Jobs API (jobType=RunNotebook).
    Official Spec: POST /v1/workspaces/{workspaceId}/items/{itemId}/jobs/instances?jobType=RunNotebook
    """
    _assert_workspace(workspace_id)
    req = get_requests()
    headers = get_auth_headers()
    payload = {}
    if parameters:
        payload["executionData"] = {"parameters": parameters}

    resp = req.post(
        f"{_BASE}/workspaces/{workspace_id}/items/{notebook_id}/jobs/instances?jobType=RunNotebook",
        headers=headers,
        json=payload if parameters else None,
        timeout=20,
    )
    if resp.status_code in (200, 201, 202):
        location = resp.headers.get("Location", "")
        job_id = location.split("/")[-1] if "/" in location else None
        print(f"[FABRIC] Notebook {notebook_id} execution triggered. Job ID: {job_id}")
        return {"success": True, "job_id": job_id, "location": location}
    print(f"[FABRIC] Notebook run trigger failed: {resp.status_code} {resp.text[:250]}")
    return {"success": False, "error": resp.text, "status_code": resp.status_code}


def refresh_semantic_model(
    semantic_model_id: str,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
) -> dict:
    """
    Triggers refresh on a Power BI Semantic Model via Jobs API (jobType=Execute).
    """
    _assert_workspace(workspace_id)
    req = get_requests()
    headers = get_auth_headers()
    resp = req.post(
        f"{_BASE}/workspaces/{workspace_id}/items/{semantic_model_id}/jobs/instances?jobType=Execute",
        headers=headers,
        timeout=20,
    )
    if resp.status_code in (200, 201, 202):
        location = resp.headers.get("Location", "")
        job_id = location.split("/")[-1] if "/" in location else None
        print(f"[FABRIC] Semantic Model {semantic_model_id} refresh triggered. Job ID: {job_id}")
        return {"success": True, "job_id": job_id, "location": location}
    print(f"[FABRIC] Semantic Model refresh trigger failed: {resp.status_code} {resp.text[:250]}")
    return {"success": False, "error": resp.text, "status_code": resp.status_code}

