"""
tests/test_asset_indexer.py
----------------------------
Unit tests for Persistent Semantic Asset & Connection Index.
"""

import os
import tempfile
import pytest
from omniflow.tools.asset_indexer import AssetIndexer, AssetIndexEntry


@pytest.fixture
def temp_indexer():
    with tempfile.NamedTemporaryFile(suffix=".json", delete=False) as tf:
        temp_path = tf.name
    indexer = AssetIndexer(workspace_id="test-ws-guid", storage_path=temp_path)
    yield indexer
    if os.path.exists(temp_path):
        os.remove(temp_path)


def test_register_and_get_by_name(temp_indexer):
    entry = temp_indexer.register(
        name="sap_hana_sales_conn",
        item_type="Connection",
        guid="conn-guid-12345",
        summary="Production Fabric Gateway connection to SAP HANA ERP Sales module",
        tags=["sap", "hana", "sales", "gateway"],
        metadata={"host": "hana.corp.internal", "client": "100"},
    )

    assert entry.guid == "conn-guid-12345"
    assert entry.name == "sap_hana_sales_conn"

    # Exact lookup
    retrieved = temp_indexer.get_by_name("SAP_HANA_SALES_CONN")
    assert retrieved is not None
    assert retrieved.guid == "conn-guid-12345"
    assert "sales" in retrieved.tags
    assert retrieved.metadata["host"] == "hana.corp.internal"


def test_query_semantic_search_and_ranking(temp_indexer):
    temp_indexer.register(
        name="lh_sales_bronze",
        item_type="Lakehouse",
        guid="guid-lh-1",
        summary="Raw sales transaction storage with Delta Lake Parquet format",
        tags=["bronze", "raw", "sales"],
    )
    temp_indexer.register(
        name="wh_customer_analytics",
        item_type="Warehouse",
        guid="guid-wh-2",
        summary="Analytical Kimball star schema for customer churn and lifetime value",
        tags=["gold", "analytics", "customers"],
    )
    temp_indexer.register(
        name="pl_sap_daily_copy",
        item_type="DataPipeline",
        guid="guid-pl-3",
        summary="Automated daily scheduled pipeline extracting SAP sales to Bronze",
        tags=["pipeline", "sap", "daily"],
    )

    # Search for "sales" -> should match lh_sales_bronze and pl_sap_daily_copy
    results = temp_indexer.query("sales")
    assert len(results) >= 2
    assert results[0].name == "lh_sales_bronze"

    # Search with item_type filter
    wh_results = temp_indexer.query("churn analytics", item_type="Warehouse")
    assert len(wh_results) == 1
    assert wh_results[0].name == "wh_customer_analytics"
    assert wh_results[0].guid == "guid-wh-2"


def test_persistence_reload(temp_indexer):
    storage_path = temp_indexer.storage_path
    temp_indexer.register(
        name="test_item",
        item_type="Lakehouse",
        guid="guid-999",
        summary="Persistent test item",
    )

    # Re-instantiate from the same storage path
    new_indexer = AssetIndexer(workspace_id="test-ws-guid", storage_path=storage_path)
    loaded = new_indexer.get_by_name("test_item")
    assert loaded is not None
    assert loaded.guid == "guid-999"
