"""
tests/test_storage_adapter.py
-----------------------------
Unit tests for SqliteStorageAdapter and semantic vector recipe search.
"""

import pytest

from app.domain.models.session import (
    ArchitectureRecipe,
    LearnedFact,
    MessageRecord,
    SessionRecord,
)
from app.domain.storage.sqlite_adapter import SqliteStorageAdapter


@pytest.fixture
def storage():
    # Use in-memory SQLite for isolated test runs
    adapter = SqliteStorageAdapter(db_path=":memory:")
    return adapter


def test_session_lifecycle(storage):
    rec = SessionRecord(session_id="test-ses-1", workspace_id="ws-123", metadata={"browser": "Chrome"})
    storage.create_session(rec)

    fetched = storage.get_session("test-ses-1")
    assert fetched is not None
    assert fetched.session_id == "test-ses-1"
    assert fetched.workspace_id == "ws-123"
    assert fetched.metadata.get("browser") == "Chrome"

    sessions = storage.list_sessions()
    assert len(sessions) == 1


def test_messages_ordering(storage):
    storage.create_session(SessionRecord(session_id="ses-chat", workspace_id="ws-123"))

    msg1 = MessageRecord(session_id="ses-chat", turn_index=0, role="user", content="Hello", token_est=2)
    msg2 = MessageRecord(session_id="ses-chat", turn_index=1, role="assistant", content="Hi there!", token_est=3)

    storage.add_message(msg1)
    storage.add_message(msg2)

    history = storage.get_messages("ses-chat", limit=10)
    assert len(history) == 2
    assert history[0].role == "user"
    assert history[0].content == "Hello"
    assert history[1].role == "assistant"
    assert history[1].content == "Hi there!"


def test_facts_upsert(storage):
    storage.create_session(SessionRecord(session_id="ses-fact", workspace_id="ws-123"))

    fact1 = LearnedFact(session_id="ses-fact", fact_key="preferred_schedule", fact_value="nightly")
    storage.upsert_fact(fact1)

    facts = storage.get_facts("ses-fact")
    assert facts.get("preferred_schedule") == "nightly"

    # Upsert with new value
    fact2 = LearnedFact(session_id="ses-fact", fact_key="preferred_schedule", fact_value="hourly")
    storage.upsert_fact(fact2)

    updated_facts = storage.get_facts("ses-fact")
    assert updated_facts.get("preferred_schedule") == "hourly"


def test_recipe_vector_similarity_search(storage):
    # Recipe A: Telecom CDC
    r_telecom = ArchitectureRecipe(
        id="rec_telecom_cdc",
        title="Telecom CDC Pipeline",
        description="Ingests Call Detail Records into Bronze and Silver",
        source_dialect="oracle",
        target_fabric_type="lakehouse",
        code_template="spark.read.format('delta')...",
        tags=["telecom", "cdc", "oracle"],
        embedding=[0.9, 0.1, 0.05, 0.0],
    )

    # Recipe B: Financial General Ledger
    r_finance = ArchitectureRecipe(
        id="rec_finance_gl",
        title="General Ledger Star Schema",
        description="Builds Gold Dimension and Fact tables for Accounting",
        source_dialect="tsql",
        target_fabric_type="lakehouse",
        code_template="CREATE TABLE gold_gl...",
        tags=["finance", "accounting", "gold"],
        embedding=[0.05, 0.0, 0.85, 0.9],
    )

    storage.save_recipe(r_telecom)
    storage.save_recipe(r_finance)

    # Search with a telecom-like query vector
    query_telecom = [0.88, 0.12, 0.04, 0.0]
    results = storage.search_recipes(query_telecom, limit=2)
    assert len(results) == 2
    assert results[0].id == "rec_telecom_cdc"

    # Search with a finance-like query vector
    query_finance = [0.02, 0.01, 0.82, 0.88]
    results_fin = storage.search_recipes(query_finance, limit=2)
    assert len(results_fin) == 2
    assert results_fin[0].id == "rec_finance_gl"
