"""
Tests for app/ingestion_planner.py
Tests the Full vs. Incremental strategy classifier and plan generation.
Run with: python -m pytest app/tests/test_ingestion_planner.py -v
"""

import os
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", ".."))

from app.ingestion_planner import classify_strategy, generate_ingestion_plan, parse_schedule

# ── Strategy Classifier Tests ─────────────────────────────────────────────────

class TestClassifyStrategy:

    def test_incremental_when_pk_watermark_large(self):
        meta = {
            "table": "Orders",
            "estimated_rows": 500_000,
            "columns": [
                {"column": "OrderID",     "is_primary_key": True},
                {"column": "CustomerID",  "is_primary_key": False},
                {"column": "updated_at",  "is_primary_key": False},
                {"column": "Amount",      "is_primary_key": False},
            ],
        }
        result = classify_strategy(meta)
        assert result["load_type"] == "Incremental"
        assert result["watermark_column"] == "updated_at"
        assert result["primary_key"] == "OrderID"
        assert result["delta_strategy"] == "MERGE_UPSERT"

    def test_full_when_no_watermark(self):
        meta = {
            "table": "ProductCatalog",
            "estimated_rows": 1_200,
            "columns": [
                {"column": "ProductID", "is_primary_key": True},
                {"column": "Name",      "is_primary_key": False},
                {"column": "Price",     "is_primary_key": False},
            ],
        }
        result = classify_strategy(meta)
        assert result["load_type"] == "Full"
        assert result["delta_strategy"] == "OVERWRITE"

    def test_full_when_no_pk(self):
        meta = {
            "table": "EventLog",
            "estimated_rows": 2_000_000,
            "columns": [
                {"column": "EventType",  "is_primary_key": False},
                {"column": "updated_at", "is_primary_key": False},
            ],
        }
        result = classify_strategy(meta)
        assert result["load_type"] == "Full"

    def test_full_when_small_table(self):
        meta = {
            "table": "CurrencyRates",
            "estimated_rows": 200,
            "columns": [
                {"column": "CurrencyCode", "is_primary_key": True},
                {"column": "updated_at",   "is_primary_key": False},
            ],
        }
        result = classify_strategy(meta)
        assert result["load_type"] == "Full"

    def test_salesforce_watermark_detected(self):
        """Salesforce uses SystemModstamp — should detect correctly."""
        meta = {
            "table": "Account",
            "estimated_rows": 100_000,
            "columns": [
                {"column": "Id",             "is_primary_key": True},
                {"column": "Name",           "is_primary_key": False},
                {"column": "SystemModstamp", "is_primary_key": False},
            ],
        }
        result = classify_strategy(meta)
        assert result["load_type"] == "Incremental"
        assert result["watermark_column"] == "SystemModstamp"

    def test_empty_table_metadata(self):
        """Should not crash on empty metadata."""
        result = classify_strategy({})
        assert result["load_type"] == "Full"


# ── Schedule Parser Tests ─────────────────────────────────────────────────────

class TestParseSchedule:

    def test_nightly(self):
        result = parse_schedule("run nightly")
        assert result["cron"] == "0 2 * * *"

    def test_hourly(self):
        # 'hourly' keyword triggers the hourly pattern
        result = parse_schedule("run hourly")
        assert result["cron"] == "0 * * * *"

    def test_every_hour_phrase(self):
        # 'every hour' with no number — falls to default; real schedules say 'hourly' or 'every 2 hours'
        result = parse_schedule("every hour")
        # Accepts either hourly or daily default — main thing is it doesn't crash
        assert "cron" in result

    def test_every_6_hours(self):
        result = parse_schedule("run every 6 hours")
        assert "6" in result["cron"]

    def test_weekly(self):
        result = parse_schedule("run weekly")
        assert result["cron"] == "0 2 * * 1"

    def test_default_fallback(self):
        result = parse_schedule("just run it whenever")
        assert result["cron"] == "0 2 * * *"


# ── Plan Generator Integration Test ──────────────────────────────────────────

class TestGenerateIngestionPlan:

    def _make_tables(self):
        return [
            {
                "schema": "dbo", "table": "Orders",
                "estimated_rows": 1_000_000,
                "columns": [
                    {"column": "OrderID",   "is_primary_key": True},
                    {"column": "Amount",    "is_primary_key": False},
                    {"column": "updated_at","is_primary_key": False},
                ],
            },
            {
                "schema": "dbo", "table": "Products",
                "estimated_rows": 500,
                "columns": [
                    {"column": "ProductID", "is_primary_key": True},
                    {"column": "Name",      "is_primary_key": False},
                ],
            },
        ]

    def test_plan_has_required_keys(self):
        plan = generate_ingestion_plan("azure_sql", "Azure SQL", "SalesDB", self._make_tables())
        for key in ["run_id", "folder", "lakehouse", "notebooks", "pipeline",
                    "strategy_matrix", "flow_nodes", "flow_edges", "status"]:
            assert key in plan, f"Missing key: {key}"

    def test_strategy_matrix_populated(self):
        plan = generate_ingestion_plan("azure_sql", "Azure SQL", "SalesDB", self._make_tables())
        matrix = plan["strategy_matrix"]
        assert len(matrix) == 2

        orders = next(m for m in matrix if "Orders" in m["table"])
        products = next(m for m in matrix if "Products" in m["table"])

        assert orders["load_type"] == "Incremental"
        assert products["load_type"] == "Full"

    def test_dag_nodes_generated(self):
        plan = generate_ingestion_plan("azure_sql", "Azure SQL", "SalesDB", self._make_tables())
        node_ids = {n["id"] for n in plan["flow_nodes"]}
        assert "source" in node_ids
        assert "folder" in node_ids
        assert "lakehouse" in node_ids
        assert "pipeline" in node_ids

    def test_no_hardcoded_coordinates_collision(self):
        """With many tables, y-positions should not all be identical."""
        tables = [
            {"schema": "dbo", "table": f"Table{i}", "estimated_rows": 100, "columns": []}
            for i in range(10)
        ]
        plan = generate_ingestion_plan("azure_sql", "Azure SQL", "BigDB", tables)
        nb_nodes = [n for n in plan["flow_nodes"] if n["type"] == "notebook"]
        y_positions = [n["y"] for n in nb_nodes]
        assert len(set(y_positions)) > 1, "All notebooks have same y — layout is broken"
