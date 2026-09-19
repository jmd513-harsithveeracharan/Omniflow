"""
app/storage/__init__.py
-----------------------
Modular persistence and state storage suite conforming to AGENTS.md single responsibility.
"""

from app.storage.cache import (
    get_workspace_cache,
    update_workspace_cache,
)
from app.storage.db import (
    _DB_PATH,
    _SCHEMA,
    _db_lock,
    _get_conn,
    _now,
    get_db_stats,
    init_db,
    prune_old_sessions,
)
from app.storage.facts import (
    get_facts,
    get_messages_with_index,
    get_tier_summary,
    set_fact,
    set_tier_summary,
)
from app.storage.messages import (
    add_message,
    get_conversation_full,
    get_conversation_messages,
    get_message_count,
    get_messages,
)
from app.storage.projects import (
    create_project,
    delete_project,
    get_all_projects,
    seed_default_projects_if_empty,
    update_project,
)
from app.storage.runs import (
    _deserialize_run,
    get_recent_runs,
    get_run,
    get_session_runs,
    upsert_run,
)
from app.storage.sessions import (
    create_session,
    delete_conversation,
    get_session,
    list_conversations_with_metadata,
    list_sessions,
    rename_conversation,
    touch_session,
    truncate_messages_from,
)

__all__ = [
    "_DB_PATH",
    "_SCHEMA",
    "_db_lock",
    "_get_conn",
    "_now",
    "init_db",
    "get_db_stats",
    "prune_old_sessions",
    "create_session",
    "touch_session",
    "get_session",
    "list_sessions",
    "list_conversations_with_metadata",
    "rename_conversation",
    "delete_conversation",
    "truncate_messages_from",
    "add_message",
    "get_messages",
    "get_conversation_messages",
    "get_conversation_full",
    "get_message_count",
    "upsert_run",
    "_deserialize_run",
    "get_run",
    "get_session_runs",
    "get_recent_runs",
    "set_fact",
    "get_facts",
    "get_tier_summary",
    "set_tier_summary",
    "get_messages_with_index",
    "update_workspace_cache",
    "get_workspace_cache",
    "get_all_projects",
    "create_project",
    "update_project",
    "delete_project",
    "seed_default_projects_if_empty",
]

