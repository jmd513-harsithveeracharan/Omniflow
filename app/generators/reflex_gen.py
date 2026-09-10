"""
app/generators/reflex_gen.py
----------------------------
Generates Microsoft Fabric Reflex (Data Activator) item definition parts,
event rules, trigger thresholds, and automated action bindings.
"""

from __future__ import annotations

import base64
import json
from typing import Any
from pydantic import BaseModel, Field


class ReflexRule(BaseModel):
    rule_name: str
    event_stream_or_table: str
    column_name: str
    condition: str = "GreaterThan"  # GreaterThan, LessThan, AnomalyDetected, Equals
    threshold_value: float | str = 100.0
    action_type: str = "TeamsNotification"  # TeamsNotification, Email, FabricPipeline, Webhook
    action_target: str = "https://outlook.office.com/webhook/..."


def _b64(content: str) -> str:
    """Encodes a UTF-8 string to Base64."""
    return base64.b64encode(content.encode("utf-8")).decode("utf-8")


def generate_reflex_rules(
    reflex_name: str,
    rules: list[ReflexRule] | list[dict[str, Any]] | None = None,
) -> dict[str, Any]:
    """Generates the structured JSON configuration for a Data Activator / Reflex item."""
    rule_configs = []
    default_rules = [
        {
            "rule_name": "HighLatencyAlert",
            "event_stream_or_table": "StreamIngestEvents",
            "column_name": "latency_ms",
            "condition": "GreaterThan",
            "threshold_value": 500.0,
            "action_type": "TeamsNotification",
            "action_target": "https://webhook.teams.microsoft.com/alerts",
        },
        {
            "rule_name": "DataQualityDropTrigger",
            "event_stream_or_table": "DataQualitySummary",
            "column_name": "null_rate_pct",
            "condition": "GreaterThan",
            "threshold_value": 5.0,
            "action_type": "FabricPipeline",
            "action_target": "pl_remediate_quarantine",
        },
    ]

    target_rules = rules or default_rules

    for r in target_rules:
        r_dict = r.model_dump() if isinstance(r, ReflexRule) else r
        rule_configs.append({
            "id": r_dict.get("rule_name", "Rule").lower().replace(" ", "_"),
            "name": r_dict.get("rule_name", "Rule"),
            "source": {
                "item": r_dict.get("event_stream_or_table", "Events"),
                "column": r_dict.get("column_name", "value"),
            },
            "condition": {
                "operator": r_dict.get("condition", "GreaterThan"),
                "threshold": r_dict.get("threshold_value", 100),
                "evaluationWindow": "5m",
            },
            "action": {
                "type": r_dict.get("action_type", "TeamsNotification"),
                "target": r_dict.get("action_target", ""),
                "payloadTemplate": {
                    "alert": f"Alert triggered for {reflex_name}",
                    "rule": r_dict.get("rule_name"),
                    "value": "{{current_value}}",
                    "triggered_at": "{{timestamp}}",
                },
            },
        })

    return {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/reflex/1.0.0/schema.json",
        "reflexName": reflex_name,
        "version": "1.0",
        "triggers": rule_configs,
    }


def package_reflex_definition_parts(
    reflex_name: str,
    reflex_config: dict[str, Any] | None = None,
) -> list[dict[str, Any]]:
    """Packages Data Activator reflex definition parts into Base64 payload."""
    cfg = reflex_config or generate_reflex_rules(reflex_name)
    return [
        {
            "path": "reflex.json",
            "payload": _b64(json.dumps(cfg, indent=2)),
            "payloadType": "InlineBase64",
        }
    ]
