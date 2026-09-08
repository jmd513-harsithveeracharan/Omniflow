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
    activities_spec: list[dict[str, Any]],
    pipeline_name: str = "Medallion_Ingestion_Pipeline",
    parameters: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """
    Constructs an official Microsoft Fabric Data Factory Pipeline JSON definition structure.
    
    activities_spec: list of dicts:
      [
        {
          "name": "Ingest_Bronze_Orders",
          "type": "TridentNotebook", # or "SynapseNotebook", "CopyActivity"
          "notebook_id": "...",
          "depends_on": [] # list of prior activity names
        },
        ...
      ]
    """
    pipeline_activities = []

    for act in activities_spec:
        act_name = act.get("name", "Execute_Step").replace(" ", "_")
        act_type = act.get("type", "TridentNotebook")
        notebook_id = act.get("notebook_id", "")
        depends_on = act.get("depends_on", [])

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
                "parameters": act.get("parameters", {}),
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


def package_pipeline_definition_parts(pipeline_json: dict[str, Any]) -> list[dict[str, Any]]:
    """
    Packages a pipeline JSON structure into Base64 inline definition parts format.
    Format matching official spec:
    [{"path": "pipeline-content.json", "payload": "<b64>", "payloadType": "InlineBase64"}]
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
