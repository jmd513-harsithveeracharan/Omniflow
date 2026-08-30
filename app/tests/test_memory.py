"""
Tests for app/memory.py
Tests MemoryManager conversation handling, fact extraction, and LLM prompt building.
Run with: python -m pytest app/tests/test_memory.py -v
"""

import sys
import os
import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app import session_store as store
from app.memory import MemoryManager, _extract_facts, _build_system_prompt


@pytest.fixture(autouse=True)
def temp_db(tmp_path, monkeypatch):
    """Use a clean temporary database for each test."""
    db_file = str(tmp_path / "test_memory.db")
    monkeypatch.setattr(store, "_DB_PATH", db_file)
    store.init_db()
    return db_file


class TestFactExtraction:

    def test_extract_schedule_nightly(self):
        facts = _extract_facts("Please ingest these tables nightly at 2am")
        # Value is now the human-readable form
        assert ("preferred_schedule", "Nightly at 02:00 UTC") in facts

    def test_extract_schedule_hourly(self):
        facts = _extract_facts("We want this to run hourly")
        # Value is now the human-readable form
        assert ("preferred_schedule", "Hourly") in facts

    def test_extract_database_name(self):
        facts = _extract_facts("Load all records from CustomerDB")
        assert ("source_database", "CustomerDB") in facts

    def test_extract_source_type(self):
        facts = _extract_facts("The source is Azure SQL Server")
        assert ("preferred_source", "Azure SQL") in facts


class TestMemoryManager:

    def test_get_or_create_new_session(self):
        mem = MemoryManager.get_or_create()
        assert mem.session_id is not None

        summary = mem.get_summary()
        assert summary["message_count"] == 0
        assert summary["run_count"] == 0

    def test_add_user_and_assistant_messages(self):
        mem = MemoryManager.get_or_create("sess_test_1")
        mem.add_user("Can you load data from SalesDB nightly?")
        mem.add_assistant("I have created an ingestion plan for SalesDB.")

        summary = mem.get_summary()
        assert summary["message_count"] == 2
        # Verify fact was auto-extracted
        assert "preferred_schedule" in summary["facts"]
        # Value is now the human-readable form
        assert summary["facts"]["preferred_schedule"] == "Nightly at 02:00 UTC"

    def test_build_llm_messages_contains_context(self):
        mem = MemoryManager.get_or_create("sess_test_2")
        mem.add_user("Plan an ingestion for FinanceDB")
        mem.add_assistant("Plan ready for FinanceDB.")
        mem.add_user("Make it run weekly")

        ws_cache = {
            "items": [
                {"id": "1", "displayName": "lh_bronze", "type": "Lakehouse"},
                {"id": "2", "displayName": "pl_nightly", "type": "DataPipeline"},
            ],
            "folders": [{"displayName": "Finance_Ingest"}],
            "synced_at": "2026-08-20T00:00:00Z",
        }

        messages = mem.build_llm_messages(workspace_cache=ws_cache)
        assert len(messages) >= 4  # system + 3 history messages

        # System message is first
        assert messages[0]["role"] == "system"
        sys_content = messages[0]["content"]

        # System message contains workspace context
        assert "Lakehouse" in sys_content
        assert "DataPipeline" in sys_content
        assert "Finance_Ingest" in sys_content

        # Conversation history preserved in order
        assert messages[1]["content"] == "Plan an ingestion for FinanceDB"
        assert messages[2]["content"] == "Plan ready for FinanceDB."
        assert messages[3]["content"] == "Make it run weekly"

    def test_track_and_get_run(self):
        mem = MemoryManager.get_or_create("sess_run_track")
        mem.track_run("run_100", status="planned", source_name="Azure SQL")

        run = mem.get_run("run_100")
        assert run is not None
        assert run["status"] == "planned"
        assert run["source_name"] == "Azure SQL"

        session_runs = mem.get_session_runs()
        assert len(session_runs) == 1
        assert session_runs[0]["run_id"] == "run_100"


class TestSqueezeStraw:

    def test_squeeze_straw_short_conversation(self):
        """Conversations with <= 10 messages should be 100% verbatim in Tier 1."""
        mem = MemoryManager.get_or_create("sess_short_conv")
        for i in range(4):
            mem.add_user(f"User message {i}")
            mem.add_assistant(f"Assistant response {i}")

        messages = mem.build_llm_messages()
        # System prompt + 8 history messages
        assert len(messages) == 9
        # No archive header injected since history is short
        assert not any("[ARCHIVED CONTEXT" in m["content"] for m in messages)

    def test_squeeze_straw_long_conversation_tiering(self, monkeypatch):
        """Conversations with > 10 messages should split into verbatim Tier 1 and compressed Tier 2/3."""
        # Mock _compress_tier to return deterministic strings
        from app import memory as mem_mod
        monkeypatch.setattr(mem_mod, "_compress_tier", lambda msgs, label: f"[MOCK_COMPRESSED_{label.upper()}]")

        mem = MemoryManager.get_or_create("sess_long_conv")
        # Add 25 messages (12 user + 13 assistant)
        for i in range(12):
            mem.add_user(f"User turn {i}: Configure table_{i}")
            mem.add_assistant(f"Assistant turn {i}: Created table_{i}")

        messages = mem.build_llm_messages()

        # System message is first
        assert messages[0]["role"] == "system"

        # Check that compressed block exists
        archived_msg = next((m for m in messages if "[ARCHIVED CONTEXT" in m["content"] or "[RECENT CONTEXT" in m["content"]), None)
        assert archived_msg is not None

        # Verify Tier 1 retains the latest turns verbatim
        last_turn_content = messages[-1]["content"]
        assert "turn 11" in last_turn_content or "Created table_11" in last_turn_content
