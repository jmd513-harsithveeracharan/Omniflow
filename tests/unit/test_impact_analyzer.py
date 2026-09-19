"""
Tests for app/impact_analyzer.py
Tests risk classification and the safe deletion protocol.
Run with: python -m pytest app/tests/test_impact_analyzer.py -v
"""

import json
import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from unittest.mock import patch

# Patch Fabric API calls before importing impact_analyzer
with patch("app.fabric_client.get_auth_headers", return_value={"Authorization": "Bearer mock_token"}):
    with patch("app.config.ALLOWED_WORKSPACE_ID", "mock-ws-id"):
        from app.impact_analyzer import analyze_impact, take_definition_snapshot


# ── analyze_impact Tests ──────────────────────────────────────────────────────

class TestAnalyzeImpact:

    def test_create_item_is_low_risk(self):
        result = analyze_impact("create_item")
        assert result["risk_level"] == "LOW"
        assert result["requires_confirmation"] is False
        assert result["can_proceed"] is True

    def test_delete_item_is_high_risk(self):
        result = analyze_impact("delete_item", {"item_name": "lh_sales_bronze"})
        assert result["risk_level"] == "HIGH"
        assert result["requires_confirmation"] is True
        assert result["can_proceed"] is False
        assert result["confirmation_phrase"] == "DELETE LH_SALES_BRONZE"

    def test_delete_folder_is_high_risk(self):
        result = analyze_impact("delete_folder", {"item_name": "SAP_SalesDB_Ingestion"})
        assert result["risk_level"] == "HIGH"
        assert result["requires_confirmation"] is True

    def test_overwrite_table_is_high_risk(self):
        result = analyze_impact("overwrite_table", {"item_name": "bronze_orders"})
        assert result["risk_level"] == "HIGH"

    def test_modify_schema_is_medium_risk(self):
        result = analyze_impact("modify_schema")
        assert result["risk_level"] == "MEDIUM"
        assert result["requires_confirmation"] is False
        assert result["can_proceed"] is True   # Warning shown but no gate

    def test_unknown_operation_defaults_to_low(self):
        result = analyze_impact("some_new_operation_we_forgot_to_classify")
        assert result["risk_level"] == "LOW"
        assert result["can_proceed"] is True

    def test_confirmation_phrase_uses_uppercase_item_name(self):
        result = analyze_impact("delete_item", {"item_name": "MyLakehouse"})
        assert result["confirmation_phrase"] == "DELETE MYLAKEHOUSE"

    def test_add_column_is_low_risk(self):
        result = analyze_impact("add_column")
        assert result["risk_level"] == "LOW"
        assert result["requires_confirmation"] is False


# ── Warning Message Quality Tests ─────────────────────────────────────────────

class TestWarningMessages:

    def test_overwrite_message_mentions_downstream(self):
        result = analyze_impact("overwrite_table")
        assert "downstream" in result["warning_message"].lower() or "overwrite" in result["warning_message"].lower()

    def test_delete_message_mentions_backup(self):
        result = analyze_impact("delete_item")
        assert "backup" in result["warning_message"].lower() or "snapshot" in result["warning_message"].lower()


# ── Definition Snapshot Tests ─────────────────────────────────────────────────

class TestDefinitionSnapshot:

    def test_snapshot_saved_to_disk(self, tmp_path):
        """Verifies that snapshot creates a file with correct JSON structure."""
        mock_parts = [
            {"path": "notebook-content.py", "payload": "cHJpbnQoJ2hlbGxvJyk=", "payloadType": "InlineBase64"}
        ]

        with patch("app.impact_analyzer.get_item_definition", return_value=mock_parts), \
             patch("app.impact_analyzer._ARCHIVE_DIR", str(tmp_path)):
            snapshot_path = take_definition_snapshot("item-123", "lh_sales_bronze", "mock-ws-id")

        assert snapshot_path is not None
        assert os.path.exists(snapshot_path)

        with open(snapshot_path) as f:
            data = json.load(f)

        assert data["item_id"] == "item-123"
        assert data["item_name"] == "lh_sales_bronze"
        assert data["definition_parts"] == mock_parts

    def test_snapshot_returns_none_on_api_failure(self):
        with patch("app.impact_analyzer.get_item_definition", return_value=None):
            result = take_definition_snapshot("bad-id", "broken_item", "mock-ws-id")
        assert result is None
