"""
app/generators/generic_gen.py
-----------------------------
Universal payload packager for any Microsoft Fabric REST API item type.
"""

import base64
import json
from typing import Any


def package_generic_definition_parts(
    files: dict[str, str | bytes | dict[str, Any]],
) -> list[dict[str, Any]]:
    """
    Takes a dictionary mapping relative file paths to content (str, bytes, or JSON dict)
    and encodes them into the standard Microsoft Fabric inline Base64 definition parts format.
    
    Format:
    [
      {
        "path": "definition.json",
        "payload": "<Base64>",
        "payloadType": "InlineBase64"
      }
    ]
    """
    parts = []
    for rel_path, content in files.items():
        if isinstance(content, dict):
            raw_bytes = json.dumps(content, indent=2).encode("utf-8")
        elif isinstance(content, str):
            raw_bytes = content.encode("utf-8")
        elif isinstance(content, bytes):
            raw_bytes = content
        else:
            raw_bytes = str(content).encode("utf-8")

        encoded_payload = base64.b64encode(raw_bytes).decode("utf-8")
        parts.append({
            "path": rel_path,
            "payload": encoded_payload,
            "payloadType": "InlineBase64",
        })

    return parts
