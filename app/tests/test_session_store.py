"""
Tests for app/session_store.py
Tests SQLite CRUD for sessions, messages, runs, learned facts, and workspace cache.
Run with: python -m pytest app/tests/test_session_store.py -v
"""

import sys
import os
import tempfile
import sqlite3
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app import session_store as store


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    """Point session_store to an isolated temporary SQLite database for each test."""
    db_file = str(tmp_path / "test_fabric_ai.db")
    monkeypatch.setattr(store, "_DB_PATH", db_file)
    store.init_db()
    return db_file


class TestSessionCRUD:

    def test_create_and_get_session(self):
        sid = "sess_test_123"
        ws_id = "ws_fabric_abc"
        created = store.create_session(sid, ws_id, {"browser": "chrome"})
        assert created == sid

        session = store.get_session(sid)
        assert session is not None
        assert session["session_id"] == sid
        assert session["workspace_id"] == ws_id

    def test_touch_session(self):
        sid = "sess_touch"
        store.create_session(sid, "ws_1")
        initial = store.get_session(sid)

        store.touch_session(sid)
        updated = store.get_session(sid)
        assert updated["last_active"] >= initial["last_active"]

    def test_list_sessions(self):
        store.create_session("s1", "ws_A")
        store.create_session("s2", "ws_A")
        store.create_session("s3", "ws_B")

        all_sess = store.list_sessions()
        assert len(all_sess) == 3

        ws_a_sess = store.list_sessions("ws_A")
        assert len(ws_a_sess) == 2


class TestMessageCRUD:

    def test_add_and_retrieve_messages(self):
        sid = "sess_msg_test"
        store.create_session(sid, "ws_1")

        m1 = store.add_message(sid, "user", "Hello agent")
        m2 = store.add_message(sid, "assistant", "Hello! How can I help?")

        assert m1 > 0
        assert m2 > m1

        msgs = store.get_messages(sid, last_n=10)
        assert len(msgs) == 2
        assert msgs[0]["role"] == "user"
        assert msgs[0]["content"] == "Hello agent"
        assert msgs[1]["role"] == "assistant"

    def test_message_window_limiting(self):
        sid = "sess_window"
        store.create_session(sid, "ws_1")

        for i in range(10):
            store.add_message(sid, "user" if i % 2 == 0 else "assistant", f"Turn {i}")

        last_3 = store.get_messages(sid, last_n=3)
        assert len(last_3) == 3
        # Should be turns 7, 8, 9
        assert last_3[0]["content"] == "Turn 7"
        assert last_3[2]["content"] == "Turn 9"


class TestRunCRUD:

    def test_upsert_and_get_run(self):
        run_id = "run_abc"
        sid = "sess_run"
        store.create_session(sid, "ws_1")

        store.upsert_run(
            run_id,
            sid,
            status="planned",
            source_id="azure_sql",
            source_name="Azure SQL",
            plan_json={"lakehouse": "lh_bronze", "tables": ["Orders"]},
        )

        run = store.get_run(run_id)
        assert run is not None
        assert run["status"] == "planned"
        assert run["source_name"] == "Azure SQL"
        assert isinstance(run["plan_json"], dict)
        assert run["plan_json"]["lakehouse"] == "lh_bronze"

        # Update status
        store.upsert_run(run_id, sid, status="completed", pipeline_item_id="pl_123")
        updated = store.get_run(run_id)
        assert updated["status"] == "completed"
        assert updated["pipeline_item_id"] == "pl_123"


class TestLearnedFacts:

    def test_set_and_get_facts(self):
        sid = "sess_facts"
        store.create_session(sid, "ws_1")

        store.set_fact(sid, "preferred_schedule", "nightly")
        store.set_fact(sid, "source_database", "SalesDB")

        facts = store.get_facts(sid)
        assert facts["preferred_schedule"] == "nightly"
        assert facts["source_database"] == "SalesDB"

        # Upsert should overwrite
        store.set_fact(sid, "preferred_schedule", "hourly")
        updated_facts = store.get_facts(sid)
        assert updated_facts["preferred_schedule"] == "hourly"


class TestWorkspaceCacheStore:

    def test_update_and_get_workspace_cache(self):
        ws_id = "ws_cache_test"
        items = [{"id": "item_1", "displayName": "lh_sales", "type": "Lakehouse"}]
        folders = [{"id": "f_1", "displayName": "Sales_Ingestion"}]

        store.update_workspace_cache(ws_id, items, folders)
        cache = store.get_workspace_cache(ws_id)

        assert cache is not None
        assert len(cache["items"]) == 1
        assert cache["items"][0]["displayName"] == "lh_sales"
        assert len(cache["folders"]) == 1


class TestConversationCRUD:

    def test_list_conversations_with_metadata(self):
        sid1 = "sess_conv_1"
        sid2 = "sess_conv_2"
        store.create_session(sid1, "ws_1")
        store.create_session(sid2, "ws_1")

        store.add_message(sid1, "user", "Create a Medallion Lakehouse architecture")
        store.add_message(sid1, "assistant", "I will create bronze, silver, and gold.")

        store.add_message(sid2, "user", "Ingest data from SAP HANA")

        convs = store.list_conversations_with_metadata("ws_1")
        assert len(convs) == 2
        assert any(c["session_id"] == sid1 and c["message_count"] == 2 for c in convs)
        assert any(c["session_id"] == sid2 and c["message_count"] == 1 for c in convs)
        
        # Check auto-generated title
        conv1 = next(c for c in convs if c["session_id"] == sid1)
        assert "Medallion" in conv1["title"]

    def test_get_conversation_full(self):
        sid = "sess_full_test"
        store.create_session(sid, "ws_1")
        store.add_message(sid, "user", "Test prompt")
        store.add_message(sid, "assistant", "Test response")
        store.set_fact(sid, "preferred_schedule", "Daily")

        full = store.get_conversation_full(sid)
        assert full is not None
        assert full["session_id"] == sid
        assert len(full["messages"]) == 2
        assert full["facts"]["preferred_schedule"] == "Daily"

    def test_rename_conversation(self):
        sid = "sess_rename_test"
        store.create_session(sid, "ws_1")
        store.add_message(sid, "user", "Initial prompt")

        renamed = store.rename_conversation(sid, "Custom Project Alpha")
        assert renamed is True

        full = store.get_conversation_full(sid)
        assert full["title"] == "Custom Project Alpha"

    def test_delete_conversation(self):
        sid = "sess_del_test"
        store.create_session(sid, "ws_1")
        store.add_message(sid, "user", "Delete me")
        store.set_fact(sid, "sample_key", "sample_val")

        deleted = store.delete_conversation(sid)
        assert deleted is True

        assert store.get_session(sid) is None
        assert len(store.get_messages(sid)) == 0
        assert len(store.get_facts(sid)) == 0


class TestTierSummaries:

    def test_set_and_get_tier_summary(self):
        sid = "sess_tier_test"
        store.create_session(sid, "ws_1")

        # Initially None
        assert store.get_tier_summary(sid, 2) is None
        assert store.get_tier_summary(sid, 3) is None

        # Set Tier 2 summary
        store.set_tier_summary(sid, 2, "User requested 3 lakehouses and 2 notebooks.", compressed_up_to_turn=12)

        cached = store.get_tier_summary(sid, 2)
        assert cached is not None
        assert cached["summary"] == "User requested 3 lakehouses and 2 notebooks."
        assert cached["compressed_up_to_turn"] == 12

        # Verify it does not bleed into normal facts
        facts = store.get_facts(sid)
        assert "_tier2_summary" in facts  # stored in DB
        # But when retrieved without system keys in MemoryManager, it's filtered

