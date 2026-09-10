"""
tests/test_db_and_containment_audit.py
--------------------------------------
Validates full SQLite DB schema operations and strict AI_Test_Folder containment security.
"""

import pytest
from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME
from app.fabric_client import WorkspaceSecurityError, _assert_workspace
from app.session_store import (
    add_message,
    create_project,
    create_session,
    delete_conversation,
    delete_project,
    get_all_projects,
    get_conversation_full,
    get_facts,
    get_messages,
    get_session,
    init_db,
    list_conversations_with_metadata,
    list_sessions,
    set_fact,
    touch_session,
    update_project,
    update_workspace_cache,
)


def test_database_init_and_tables_structure():
    init_db()
    # Verify tables can be queried without SQL errors
    sessions = list_sessions(ALLOWED_WORKSPACE_ID)
    assert isinstance(sessions, list)


def test_full_database_crud_lifecycle():
    import uuid
    session_id = f"test_db_audit_session_{uuid.uuid4().hex[:6]}"
    delete_conversation(session_id)
    create_session(session_id, ALLOWED_WORKSPACE_ID, {"client": "test_suite"})
    
    # 1. Session verification
    s = get_session(session_id)
    assert s is not None
    assert s["workspace_id"] == ALLOWED_WORKSPACE_ID

    # 2. Messages verification
    m1 = add_message(session_id, "user", "How to ingest sales data into Lakehouse?")
    m2 = add_message(session_id, "assistant", "Use Bronze Lakehouse with Delta format.")
    assert m1 > 0
    assert m2 > 0

    msgs = get_messages(session_id)
    assert len(msgs) == 2
    assert msgs[0]["role"] == "user"
    assert msgs[1]["role"] == "assistant"

    # 3. Facts verification
    set_fact(session_id, "target_layer", "silver", 0.95)
    facts = get_facts(session_id)
    assert facts.get("target_layer") == "silver"

    # 4. Conversation summary bundle
    bundle = get_conversation_full(session_id)
    assert bundle is not None
    assert bundle["session_id"] == session_id
    assert len(bundle["messages"]) == 2
    assert bundle["facts"]["target_layer"] == "silver"

    # 5. Clean deletion
    del_ok = delete_conversation(session_id)
    assert del_ok is True
    assert get_session(session_id) is None


def test_projects_crud_database_lifecycle():
    proj = create_project("Audit Test Project", "Testing DB persistence", {"domain": "sales"})
    pid = proj["id"]
    assert pid.startswith("proj_")

    all_projs = get_all_projects()
    assert any(p["id"] == pid for p in all_projs)

    up_ok = update_project(pid, name="Renamed Audit Project", is_pinned=1)
    assert up_ok is True

    del_ok = delete_project(pid)
    assert del_ok is True


def test_workspace_security_guardrail_strictly_locks_workspace():
    # Allowed workspace must pass
    _assert_workspace(ALLOWED_WORKSPACE_ID)

    # Unauthorized workspace MUST raise WorkspaceSecurityError
    unauthorized_ws = "99999999-0000-0000-0000-000000000000"
    with pytest.raises(WorkspaceSecurityError) as exc_info:
        _assert_workspace(unauthorized_ws)
    assert "SECURITY BLOCK" in str(exc_info.value)
    assert ALLOWED_WORKSPACE_NAME in str(exc_info.value)
