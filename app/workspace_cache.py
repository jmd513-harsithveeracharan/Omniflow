"""
app/workspace_cache.py
-----------------------
Fabric workspace state cache — keeps a local snapshot of what's deployed.

Two-layer design:
  1. In-memory cache (fast reads, survives within a server process)
  2. SQLite persistence (survives server restarts via session_store.py)

The cache is:
  - Refreshed automatically after every deploy
  - Refreshed on demand via refresh_cache()
  - Injected into the LLM system prompt by memory.py
  - Stale after CACHE_TTL_SECONDS even without a deploy

Why maintain a local cache?
  - The Fabric list API can take 1-3 seconds per call
  - Most chat turns don't need a fresh listing
  - The LLM benefits greatly from knowing "these 5 lakehouses already exist"
    without having to wait for an API roundtrip on every message
"""

import threading
import time
from datetime import UTC, datetime

from app import session_store as store
from app.config import ALLOWED_WORKSPACE_ID

_CACHE_TTL_SECONDS = 300   # 5 minutes — refresh if older than this
_cache_lock = threading.Lock()

# In-memory L1 cache
_mem_cache: dict = {
    "items":     [],
    "folders":   [],
    "synced_at": None,
    "expires_at": 0,
}


def _now_iso() -> str:
    return datetime.now(UTC).isoformat()


def _is_stale() -> bool:
    return time.time() > _mem_cache["expires_at"]


# ── Public interface ──────────────────────────────────────────────────────────

def refresh_cache(workspace_id: str = ALLOWED_WORKSPACE_ID) -> dict:
    """
    Fetches fresh workspace items and folders from Fabric API.
    Updates both in-memory cache and SQLite persistence.

    Returns the cache dict: {items, folders, synced_at}
    """
    try:
        from app.fabric_client import list_folders, list_workspace_items
        items_result = list_workspace_items(workspace_id)
        items   = items_result.get("items", []) if items_result.get("success") else []
        folders = list_folders(workspace_id)
    except Exception as e:
        print(f"[CACHE] Fabric API unavailable for refresh: {e}")
        # Return whatever we have in memory
        return get_cached(workspace_id)

    synced_at = _now_iso()

    with _cache_lock:
        _mem_cache["items"]      = items
        _mem_cache["folders"]    = folders
        _mem_cache["synced_at"]  = synced_at
        _mem_cache["expires_at"] = time.time() + _CACHE_TTL_SECONDS

    # Persist to SQLite
    store.update_workspace_cache(workspace_id, items, folders)

    print(f"[CACHE] Workspace refreshed: {len(items)} items, {len(folders)} folders @ {synced_at[:16]}")
    return {"items": items, "folders": folders, "synced_at": synced_at}


def get_cached(workspace_id: str = ALLOWED_WORKSPACE_ID) -> dict:
    """
    Returns the workspace cache, refreshing if stale.
    On Fabric API failure, falls back to SQLite then empty dict.
    """
    with _cache_lock:
        if not _is_stale() and _mem_cache["synced_at"]:
            return {
                "items":     list(_mem_cache["items"]),
                "folders":   list(_mem_cache["folders"]),
                "synced_at": _mem_cache["synced_at"],
            }

    # Try to load from SQLite first (fast, no API call)
    persisted = store.get_workspace_cache(workspace_id)
    if persisted:
        with _cache_lock:
            _mem_cache["items"]      = persisted["items"]
            _mem_cache["folders"]    = persisted["folders"]
            _mem_cache["synced_at"]  = persisted["synced_at"]
            # Short TTL — will re-fetch from API on next call if still stale
            _mem_cache["expires_at"] = time.time() + 60

        # Trigger a background refresh so it's fresh for next call
        _bg_refresh(workspace_id)
        return persisted

    # Nothing anywhere — fetch fresh
    return refresh_cache(workspace_id)


def _bg_refresh(workspace_id: str):
    """Fire-and-forget background cache refresh."""
    import threading
    t = threading.Thread(target=refresh_cache, args=(workspace_id,), daemon=True)
    t.start()


def invalidate(workspace_id: str = ALLOWED_WORKSPACE_ID):
    """
    Immediately marks the cache as stale.
    Call this after a delete or deploy so next get_cached() fetches fresh data.
    """
    with _cache_lock:
        _mem_cache["expires_at"] = 0
    print("[CACHE] Cache invalidated — next access will refresh from Fabric API.")


def update_after_deploy(
    new_items: list[dict] | None = None,
    workspace_id: str = ALLOWED_WORKSPACE_ID,
):
    """
    Optimistic update: adds newly deployed items to the cache immediately
    without waiting for a full API refresh.
    """
    if not new_items:
        invalidate(workspace_id)
        return

    with _cache_lock:
        existing_ids = {i.get("id") for i in _mem_cache["items"]}
        for item in new_items:
            if item.get("id") and item["id"] not in existing_ids:
                _mem_cache["items"].append(item)
        _mem_cache["synced_at"] = _now_iso()
        _mem_cache["expires_at"] = time.time() + _CACHE_TTL_SECONDS

    # Persist the updated list
    store.update_workspace_cache(
        workspace_id,
        _mem_cache["items"],
        _mem_cache["folders"],
    )
    print(f"[CACHE] Optimistic update: added {len(new_items)} new items to cache.")


# ── Item lookup helpers ───────────────────────────────────────────────────────

def find_item_by_name(display_name: str, item_type: str | None = None, workspace_id: str = ALLOWED_WORKSPACE_ID) -> dict | None:
    """
    Searches the cache for an item by display name (case-insensitive).
    Optionally filters by item type (Lakehouse, Notebook, DataPipeline, etc.)
    """
    cache = get_cached(workspace_id)
    for item in cache.get("items", []):
        name_match = item.get("displayName", "").lower() == display_name.lower()
        type_match = (item_type is None) or (item.get("type", "") == item_type)
        if name_match and type_match:
            return item
    return None


def get_item_counts(workspace_id: str = ALLOWED_WORKSPACE_ID) -> dict[str, int]:
    """Returns count of items by type from the cache."""
    cache = get_cached(workspace_id)
    counts: dict[str, int] = {}
    for item in cache.get("items", []):
        t = item.get("type", "Unknown")
        counts[t] = counts.get(t, 0) + 1
    return counts


def get_deployed_pipelines(workspace_id: str = ALLOWED_WORKSPACE_ID) -> list[dict]:
    """Returns all DataPipeline items from the cache."""
    cache = get_cached(workspace_id)
    return [i for i in cache.get("items", []) if i.get("type") == "DataPipeline"]


def get_deployed_lakehouses(workspace_id: str = ALLOWED_WORKSPACE_ID) -> list[dict]:
    """Returns all Lakehouse items from the cache."""
    cache = get_cached(workspace_id)
    return [i for i in cache.get("items", []) if i.get("type") == "Lakehouse"]
