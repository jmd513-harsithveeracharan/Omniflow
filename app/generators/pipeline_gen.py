"""
app/generators/pipeline_gen.py
------------------------------
Generates Microsoft Fabric Data Factory Pipeline JSON definition topologies
with activity execution DAGs, parameters, and Base64 definition parts.
"""

import base64
import json
from typing import Any


def generate_pipeline_activity_dag(
    activities_spec: list[dict[str, Any]] | list[str],
    pipeline_name: str = "Medallion_Ingestion_Pipeline",
    workspace_id: str | None = None,
    parameters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Constructs an official Microsoft Fabric Data Factory Pipeline JSON definition structure.
    """
    pipeline_activities = []
    prev_activity_name: str | None = None

    for i, act in enumerate(activities_spec):
        if isinstance(act, str):
            act_name = f"Execute_Notebook_{i+1}"
            act_type = "TridentNotebook"
            notebook_id = act
            act_ws_id = workspace_id or ""
            depends_on = [prev_activity_name] if prev_activity_name else []
            prev_activity_name = act_name
        else:
            act_name = act.get("name", f"Execute_Step_{i+1}").replace(" ", "_")
            act_type = act.get("type", "TridentNotebook")
            notebook_id = act.get("notebook_id", "")
            act_ws_id = act.get("workspace_id") or workspace_id or ""
            depends_on = act.get("depends_on", [])
            prev_activity_name = act_name

        dependencies = [
            {
                "activity": prev_name.replace(" ", "_"),
                "dependencyConditions": ["Succeeded"],
            }
            for prev_name in depends_on
        ]

        activity_def = {
            "name": act_name,
            "type": act_type,
            "dependsOn": dependencies,
            "policy": {
                "timeout": "0.12:00:00",
                "retry": 2,
                "retryIntervalInSeconds": 30,
                "secureOutput": False,
                "secureInput": False,
            },
            "typeProperties": {
                "notebookId": notebook_id,
                "workspaceId": act_ws_id,
                "parameters": act.get("parameters", {}) if isinstance(act, dict) else {},
            },
        }
        pipeline_activities.append(activity_def)

    return {
        "name": pipeline_name,
        "properties": {
            "activities": pipeline_activities,
            "parameters": parameters or {},
            "annotations": ["Fabric AI Studio", "Medallion Ingestion"],
        },
    }


def package_pipeline_definition_parts(
    pipeline_json: dict[str, Any],
    schedule_cron: str | None = None,
) -> list[dict[str, Any]]:
    """
    Packages a pipeline JSON structure into Base64 inline definition parts format.
    """
    raw_str = json.dumps(pipeline_json, indent=2)
    encoded_payload = base64.b64encode(raw_str.encode("utf-8")).decode("utf-8")
    return [
        {
            "path": "pipeline-content.json",
            "payload": encoded_payload,
            "payloadType": "InlineBase64",
        }
    ]
