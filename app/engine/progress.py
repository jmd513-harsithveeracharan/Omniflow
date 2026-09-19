"""
app/engine/progress.py
----------------------
Real-time intermediate progress tracking and listener dispatch for Fabric AI Studio.
"""

from __future__ import annotations

import threading
from datetime import UTC, datetime
from typing import Callable

_ACTIVE_PROGRESS: dict[str, list[dict]] = {}
_PROGRESS_LOCK = threading.Lock()
_STEP_LISTENERS: dict[str, list[Callable[[dict], None]]] = {}
_LISTENERS_LOCK = threading.Lock()


def _now_utc_str() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + " UTC"


def add_step_listener(session_id: str, callback: Callable[[dict], None]) -> None:
    """Registers a real-time listener callback for pipeline step events."""
    if not session_id:
        return
    with _LISTENERS_LOCK:
        if session_id not in _STEP_LISTENERS:
            _STEP_LISTENERS[session_id] = []
        _STEP_LISTENERS[session_id].append(callback)


def remove_step_listener(session_id: str, callback: Callable[[dict], None]) -> None:
    """Unregisters a real-time listener callback."""
    if not session_id:
        return
    with _LISTENERS_LOCK:
        if session_id in _STEP_LISTENERS:
            try:
                _STEP_LISTENERS[session_id].remove(callback)
            except ValueError:
                pass
            if not _STEP_LISTENERS[session_id]:
                _STEP_LISTENERS.pop(session_id, None)


def get_progress(session_id: str) -> list[dict]:
    """Returns a copy of the live intermediate steps for an active session."""
    with _PROGRESS_LOCK:
        return list(_ACTIVE_PROGRESS.get(session_id, []))


def set_progress_step(
    session_id: str,
    title: str,
    detail: str = "",
    status: str = "in_progress",
    action: str = "",
    badge: str = "",
    target: str = "",
    diff: str = "",
    output: str = "",
) -> None:
    """Emits or advances a real-time progress step for the frontend and triggers active listeners."""
    if not session_id:
        return
    now_utc = _now_utc_str()
    if not action:
        words = title.split()
        action = words[0] if words else "Processed"

    step_data = {
        "title": title,
        "detail": detail,
        "status": status,
        "timestamp": now_utc,
        "action": action,
        "badge": badge,
        "target": target or title,
        "diff": diff,
        "output": output,
    }
    with _PROGRESS_LOCK:
        if session_id not in _ACTIVE_PROGRESS:
            _ACTIVE_PROGRESS[session_id] = []
        steps = _ACTIVE_PROGRESS[session_id]
        existing_idx = next(
            (i for i, s in enumerate(steps) if (target and s.get("target") == target) or s.get("title") == title),
            -1,
        )
        if existing_idx >= 0:
            steps[existing_idx] = step_data
        else:
            for s in steps:
                if s.get("status") == "in_progress":
                    s["status"] = "completed"
            steps.append(step_data)

    with _LISTENERS_LOCK:
        listeners = list(_STEP_LISTENERS.get(session_id, []))
    for listener in listeners:
        try:
            listener(step_data)
        except Exception:
            pass


def clear_progress(session_id: str) -> None:
    """Cleans up active progress memory for a session."""
    if not session_id:
        return
    with _PROGRESS_LOCK:
        _ACTIVE_PROGRESS.pop(session_id, None)

