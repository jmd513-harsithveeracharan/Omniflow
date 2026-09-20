"""
tests/unit/test_workspace_mirror.py
-----------------------------------
Unit tests for Local Workspace Mirror, JIT Hydration, and Cloud Reconciler.
"""

import json
import pytest
from pathlib import Path

from app.engine.workspace_mirror import (
    export_plan_to_mirror,
    load_mirror_catalog,
    hydrate_context_from_mirror,
)
from app.engine.reconciler import reconcile_workspace, format_reconciliation_markdown


@pytest.fixture
def sample_plan():
    return {
        "folder": "SalesAnalytics",
        "lakehouses": ["lh_sales_bronze", "lh_sales_silver", "lh_sales_gold"],
        "notebooks": [
            {
                "name": "nb_sales_bronze",
                "layer": "Bronze",
                "pyspark_code": "df = spark.read.load('abfss://...')\ndf.write.format('delta').saveAsTable('raw_orders')",
            },
            {
                "name": "nb_sales_silver",
                "layer": "Silver",
                "pyspark_code": "df = spark.read.table('raw_orders')\ndf.write.format('delta').saveAsTable('cleaned_orders')",
            },
        ],
        "pipeline": {
            "name": "pl_sales_daily",
            "schedule": {"frequency": "Daily", "time": "02:00"},
        },
    }


def test_export_plan_to_mirror(tmp_path, sample_plan):
    base_dir = str(tmp_path / "fabric_workspace")
    created_paths = export_plan_to_mirror(sample_plan, base_dir=base_dir)

    assert len(created_paths) > 0
    folder = Path(base_dir) / "AI_Test_Folder" / "SalesAnalytics"
    assert folder.exists()

    # Lakehouse items
    lh_bronze_dir = folder / "lh_sales_bronze.Lakehouse"
    assert lh_bronze_dir.exists()
    assert (lh_bronze_dir / ".platform").exists()
    assert (lh_bronze_dir / "lakehouse.metadata.json").exists()

    # Notebook items
    nb_bronze_dir = folder / "nb_sales_bronze.Notebook"
    assert nb_bronze_dir.exists()
    nb_content_file = nb_bronze_dir / "notebook-content.py"
    assert nb_content_file.exists()
    content = nb_content_file.read_text(encoding="utf-8")
    assert "# Fabric notebook source" in content
    assert "saveAsTable('raw_orders')" in content

    # Pipeline items
    pl_dir = folder / "pl_sales_daily.DataPipeline"
    assert pl_dir.exists()
    assert (pl_dir / "pipeline-content.json").exists()


def test_load_mirror_catalog_and_jit_hydration(tmp_path, sample_plan):
    base_dir = str(tmp_path / "fabric_workspace")
    export_plan_to_mirror(sample_plan, base_dir=base_dir)

    catalog = load_mirror_catalog(base_dir=base_dir)
    assert "nb_sales_bronze" in catalog
    assert "nb_sales_silver" in catalog
    assert "lh_sales_bronze" in catalog

    # Table discovery
    assert "raw_orders" in catalog["nb_sales_bronze"].tables
    assert "cleaned_orders" in catalog["nb_sales_silver"].tables

    # JIT Context Hydration
    context = hydrate_context_from_mirror("Show me orders transformations", base_dir=base_dir)
    assert "Local Workspace Context" in context
    assert "nb_sales_bronze" in context or "nb_sales_silver" in context


def test_reconcile_workspace(tmp_path, sample_plan):
    base_dir = str(tmp_path / "fabric_workspace")
    export_plan_to_mirror(sample_plan, base_dir=base_dir)

    # Mock cloud state: nb_sales_bronze is synced, but external_lakehouse is cloud-only
    mock_cloud_items = [
        {"displayName": "nb_sales_bronze", "type": "Notebook"},
        {"displayName": "lh_sales_bronze", "type": "Lakehouse"},
        {"displayName": "external_untracked_lakehouse", "type": "Lakehouse"},
    ]

    report = reconcile_workspace(
        workspace_id="test-workspace-id",
        base_dir=base_dir,
        cloud_items=mock_cloud_items,
    )

    assert report.total_local == 6  # 3 lakehouses + 2 notebooks + 1 pipeline
    assert report.total_cloud == 3
    assert report.synced_count == 2  # nb_sales_bronze, lh_sales_bronze
    assert report.cloud_only_count == 1  # external_untracked_lakehouse
    assert report.local_only_count == 4

    md = format_reconciliation_markdown(report)
    assert "Workspace Reconciliation Report" in md
    assert "SYNCED" in md
    assert "LOCAL_ONLY" in md
    assert "CLOUD_ONLY" in md

