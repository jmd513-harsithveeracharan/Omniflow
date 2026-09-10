"""
app/generators/eventstream_gen.py
---------------------------------
Generates Microsoft Fabric Real-Time Eventstream topology specifications,
streaming routing graphs, and Lakehouse/KQL destination bindings.
"""

from __future__ import annotations

import base64
import json
import uuid
from typing import Any


def generate_eventstream_topology(
    eventstream_name: str,
    source_type: str = "CustomApp",
    destinations: list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """
    Constructs an Eventstream topology definition JSON.
    Routes real-time streaming events to Lakehouses and KQL Databases.
    """
    stream_id = str(uuid.uuid4())
    source_node_id = f"src_{uuid.uuid4().hex[:8]}"

    sources = [
        {
            "name": f"{eventstream_name}_Source",
            "id": source_node_id,
            "type": source_type if source_type in ("CustomApp", "AzureEventHub", "Kafka") else "CustomApp",
            "properties": {"endpoint": f"https://fabric.eventstream/{eventstream_name}"},
        }
    ]

    operators = []
    dest_nodes = []
    edges = []

    dest_list = destinations or [
        {"type": "Lakehouse", "target_name": "lh_streaming_bronze", "table_name": "raw_events"}
    ]

    for i, d in enumerate(dest_list):
        dest_node_id = f"dst_{i + 1}_{uuid.uuid4().hex[:6]}"
        dtype = d.get("type", "Lakehouse")
        tname = d.get("target_name", "lh_bronze")
        tbl = d.get("table_name", "stream_events")

        dest_nodes.append({
            "name": f"Destination_{tname}",
            "id": dest_node_id,
            "type": dtype,
            "properties": {
                "targetItemName": tname,
                "tableName": tbl,
                "dataFormat": "Delta",
            },
        })
        edges.append({"source": source_node_id, "target": dest_node_id})

    return {
        "eventstreamId": stream_id,
        "name": eventstream_name,
        "sources": sources,
        "operators": operators,
        "destinations": dest_nodes,
        "topology": {"edges": edges},
    }


def package_eventstream_definition_parts(
    topology: dict[str, Any],
) -> list[dict[str, Any]]:
    """
    Packages Eventstream topology JSON into Base64 inline definition parts format for Fabric API.
    """
    payload_str = json.dumps(topology, indent=2)
    b64_payload = base64.b64encode(payload_str.encode("utf-8")).decode("utf-8")
    return [
        {
            "path": "eventstream.json",
            "payload": b64_payload,
            "payloadType": "InlineBase64",
        }
    ]
