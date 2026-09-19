"""
app/fabric/__init__.py
----------------------
Modular Fabric API client suite conforming to AGENTS.md single responsibility.
"""

from app.fabric.core import (
    _BASE,
    _LRO_MAX_POLLS,
    _LRO_POLL_INTERVAL,
    WorkspaceSecurityError,
    _assert_workspace,
    _poll_lro,
)
from app.fabric.workspaces import (
    list_workspaces,
    list_workspace_items,
    list_folders,
    get_workspace_tree,
    _get_or_create_single_folder,
    get_or_create_folder,
    delete_folder,
)
from app.fabric.items import (
    create_item,
    move_item,
    update_definition,
    get_item_definition,
    delete_item,
    provision_item_with_definition,
)
from app.fabric.shortcuts import (
    create_onelake_shortcut,
    list_onelake_shortcuts,
    get_onelake_shortcut,
    delete_onelake_shortcut,
)
from app.fabric.jobs import (
    trigger_pipeline_run,
    create_pipeline_schedule,
    get_job_status,
    get_git_status,
    commit_to_git,
    run_notebook,
    refresh_semantic_model,
)

__all__ = [
    "_BASE",
    "_LRO_MAX_POLLS",
    "_LRO_POLL_INTERVAL",
    "WorkspaceSecurityError",
    "_assert_workspace",
    "_poll_lro",
    "list_workspaces",
    "list_workspace_items",
    "list_folders",
    "get_workspace_tree",
    "_get_or_create_single_folder",
    "get_or_create_folder",
    "delete_folder",
    "create_item",
    "move_item",
    "update_definition",
    "get_item_definition",
    "delete_item",
    "provision_item_with_definition",
    "create_onelake_shortcut",
    "list_onelake_shortcuts",
    "get_onelake_shortcut",
    "delete_onelake_shortcut",
    "trigger_pipeline_run",
    "create_pipeline_schedule",
    "get_job_status",
    "get_git_status",
    "commit_to_git",
    "run_notebook",
    "refresh_semantic_model",
]

