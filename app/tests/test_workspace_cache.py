"""
Tests for app/workspace_cache.py
Tests in-memory + SQLite caching, lookup helpers, and optimistic updates.
Run with: python -m pytest app/tests/test_workspace_cache.py -v
"""

import sys
import os
import pytest
from unittest.mock import patch

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app import session_store as store
from app import workspace_cache as cache


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    """Use a clean temporary database and reset in-memory cache for each test."""
    db_file = str(tmp_path / "test_cache.db")
    monkeypatch.setattr(store, "_DB_PATH", db_file)
    monkeypatch.setattr(cache, "ALLOWED_WORKSPACE_ID", "ws_test")
    store.init_db()

    # Reset in-memory cache
    cache._mem_cache = {
        "items": [],
        "folders": [],
        "synced_at": None,
        "expires_at": 0,
    }
    return db_file


class TestWorkspaceCache:

    def test_optimistic_update_and_lookup(self):
        items = [
            {"id": "item_1", "displayName": "lh_bronze_sales", "type": "Lakehouse"},
            {"id": "item_2", "displayName": "pl_nightly_etl", "type": "DataPipeline"},
            {"id": "item_3", "displayName": "nb_transform", "type": "Notebook"},
        ]
        cache.update_after_deploy(items, workspace_id="ws_test")

        # Test lookup by name
        lh = cache.find_item_by_name("lh_bronze_sales", workspace_id="ws_test")
        assert lh is not None
        assert lh["id"] == "item_1"
        assert lh["type"] == "Lakehouse"

        # Case-insensitive lookup
        lh_case = cache.find_item_by_name("LH_BRONZE_SALES", workspace_id="ws_test")
        assert lh_case is not None
        assert lh_case["id"] == "item_1"

        # Filter by type
        pl = cache.find_item_by_name("pl_nightly_etl", item_type="DataPipeline", workspace_id="ws_test")
        assert pl is not None

        # Filter by wrong type returns None
        wrong = cache.find_item_by_name("pl_nightly_etl", item_type="Lakehouse", workspace_id="ws_test")
        assert wrong is None

    def test_get_item_counts(self):
        items = [
            {"id": "1", "displayName": "lh1", "type": "Lakehouse"},
            {"id": "2", "displayName": "lh2", "type": "Lakehouse"},
            {"id": "3", "displayName": "pl1", "type": "DataPipeline"},
        ]
        cache.update_after_deploy(items, workspace_id="ws_test")

        counts = cache.get_item_counts(workspace_id="ws_test")
        assert counts.get("Lakehouse") == 2
        assert counts.get("DataPipeline") == 1

    def test_get_deployed_pipelines_and_lakehouses(self):
        items = [
            {"id": "1", "displayName": "lh1", "type": "Lakehouse"},
            {"id": "2", "displayName": "pl1", "type": "DataPipeline"},
        ]
        cache.update_after_deploy(items, workspace_id="ws_test")

        pipelines = cache.get_deployed_pipelines(workspace_id="ws_test")
        lakehouses = cache.get_deployed_lakehouses(workspace_id="ws_test")

        assert len(pipelines) == 1
        assert pipelines[0]["displayName"] == "pl1"

        assert len(lakehouses) == 1
        assert lakehouses[0]["displayName"] == "lh1"

    def test_invalidate_cache(self):
        items = [{"id": "1", "displayName": "lh1", "type": "Lakehouse"}]
        cache.update_after_deploy(items, workspace_id="ws_test")
        assert cache._mem_cache["expires_at"] > 0

        cache.invalidate("ws_test")
        assert cache._mem_cache["expires_at"] == 0
