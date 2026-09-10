"""
app/generators/report_gen.py
----------------------------
Generates Power BI Enhanced Report (.pbir) definitions, visual layout JSON,
and executive KPI dashboard configurations bound to Direct Lake Semantic Models.
"""

from __future__ import annotations

import base64
import json
import uuid
from typing import Any


def generate_pbir_definition(
    report_name: str,
    semantic_model_id: str,
    semantic_model_name: str,
    pages: list[dict[str, Any]] | None = None,
) -> dict[str, str]:
    """
    Generates PBIR formatted report files for Microsoft Fabric Power BI Reports.
    Returns a dictionary of relative paths to string contents:
    {
      "definition.pbir": "...",
      "report.json": "..."
    }
    """
    pbir_manifest = {
        "version": "1.0",
        "datasetReference": {
            "byPath": None,
            "byConnection": {
                "connectionString": None,
                "pbiServiceModelId": None,
                "pbiModelVirtualServerName": "sobe_wowvirtualserver",
                "pbiModelDatabaseName": semantic_model_id,
                "name": semantic_model_name,
            },
        },
    }

    # Generate standard visual layout JSON
    visual_sections = []
    report_pages = pages or [
        {
            "name": "Executive Overview",
            "visuals": [
                {"type": "card", "title": "Total Revenue", "measure": "TotalRevenue"},
                {"type": "barChart", "title": "Revenue by Dimension", "category": "Category", "measure": "TotalRevenue"},
                {"type": "table", "title": "Detailed Breakdown", "columns": ["ID", "Category", "Amount"]},
            ],
        }
    ]

    for i, p in enumerate(report_pages):
        page_name = p.get("name", f"Page_{i + 1}")
        visual_sections.append({
            "name": f"Section_{i + 1}",
            "displayName": page_name,
            "visualContainers": [
                {
                    "config": json.dumps({
                        "name": f"Visual_{v_idx + 1}",
                        "title": v.get("title", f"Visual {v_idx + 1}"),
                        "visualType": v.get("type", "card"),
                    }),
                    "x": 20 + (v_idx % 3) * 380,
                    "y": 20 + (v_idx // 3) * 260,
                    "width": 360,
                    "height": 240,
                }
                for v_idx, v in enumerate(p.get("visuals", []))
            ],
        })

    report_content = {
        "config": json.dumps({"version": "5.50", "theme": "Dark"}),
        "sections": visual_sections,
    }

    return {
        "definition.pbir": json.dumps(pbir_manifest, indent=2),
        "report.json": json.dumps(report_content, indent=2),
    }


def package_report_definition_parts(
    pbir_files: dict[str, str],
) -> list[dict[str, Any]]:
    """
    Packages PBIR files into Base64 inline definition parts format for Fabric REST API.
    """
    parts = []
    for rel_path, content_str in pbir_files.items():
        encoded = base64.b64encode(content_str.encode("utf-8")).decode("utf-8")
        parts.append({
            "path": rel_path,
            "payload": encoded,
            "payloadType": "InlineBase64",
        })
    return parts
