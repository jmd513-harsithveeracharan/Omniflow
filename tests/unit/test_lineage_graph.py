"""
tests/test_lineage_graph.py
---------------------------
Unit tests for NetworkX LineageGraphEngine, JIT Context Hydration, and Blast-Zone Analysis.
"""

import pytest

from app.domain.lineage.graph_store import LineageGraphEngine
from app.domain.models.lineage import AssetLayer, AssetType, DependencyType, LineageEdge, LineageNode


@pytest.fixture
def sample_graph():
    engine = LineageGraphEngine()

    # Source Table
    src_node = LineageNode(
        id="src_orders",
        name="dbo.Orders",
        asset_type=AssetType.TABLE,
        layer=AssetLayer.SOURCE,
        schema_definition=[
            {"name": "OrderID", "type": "int", "is_pk": True},
            {"name": "CustomerID", "type": "int"},
            {"name": "OrderDate", "type": "datetime"},
            {"name": "TotalAmount", "type": "decimal(18,2)"},
        ],
    )

    # Bronze Delta Table
    brz_node = LineageNode(
        id="brz_orders",
        name="lh_telecom_bronze.raw_orders",
        asset_type=AssetType.TABLE,
        layer=AssetLayer.BRONZE,
        schema_definition=[
            {"name": "OrderID", "type": "int"},
            {"name": "CustomerID", "type": "int"},
            {"name": "OrderDate", "type": "datetime"},
            {"name": "TotalAmount", "type": "decimal(18,2)"},
            {"name": "_ingested_at", "type": "timestamp"},
        ],
    )

    # Silver PySpark Notebook
    slv_nb = LineageNode(
        id="nb_clean_orders",
        name="nb_clean_orders",
        asset_type=AssetType.NOTEBOOK,
        layer=AssetLayer.SILVER,
    )

    # Silver Delta Table
    slv_node = LineageNode(
        id="slv_fact_orders",
        name="lh_telecom_silver.fact_orders",
        asset_type=AssetType.TABLE,
        layer=AssetLayer.SILVER,
        schema_definition=[
            {"name": "OrderID", "type": "int", "is_pk": True},
            {"name": "CustomerID", "type": "int"},
            {"name": "CleanAmount", "type": "decimal(18,2)"},
            {"name": "IsActive", "type": "boolean"},
        ],
    )

    # Power BI Report
    pbi_node = LineageNode(
        id="pbi_executive_sales",
        name="Executive Sales Dashboard",
        asset_type=AssetType.POWER_BI_REPORT,
        layer=AssetLayer.REPORT,
    )

    # Add nodes
    engine.add_asset(src_node)
    engine.add_asset(brz_node)
    engine.add_asset(slv_nb)
    engine.add_asset(slv_node)
    engine.add_asset(pbi_node)

    # Add directed edges: src -> brz -> slv_nb -> slv_node -> pbi
    engine.add_dependency(
        LineageEdge(source_id="src_orders", target_id="brz_orders", relation_type=DependencyType.INGESTS)
    )
    engine.add_dependency(
        LineageEdge(source_id="brz_orders", target_id="nb_clean_orders", relation_type=DependencyType.TRANSFORMS)
    )
    engine.add_dependency(
        LineageEdge(source_id="nb_clean_orders", target_id="slv_fact_orders", relation_type=DependencyType.TRANSFORMS)
    )
    engine.add_dependency(
        LineageEdge(source_id="slv_fact_orders", target_id="pbi_executive_sales", relation_type=DependencyType.RENDERS)
    )

    return engine


def test_jit_context_hydration(sample_graph):
    # Request JIT capsule for Silver fact_orders
    capsule = sample_graph.get_jit_context("slv_fact_orders")
    assert capsule is not None
    assert capsule.target_name == "lh_telecom_silver.fact_orders"
    assert capsule.layer == AssetLayer.SILVER
    assert len(capsule.upstream_dependencies) == 1
    assert capsule.upstream_dependencies[0].id == "nb_clean_orders"
    assert len(capsule.downstream_consumers) == 1
    assert capsule.downstream_consumers[0].id == "pbi_executive_sales"
    assert "Columns: OrderID:int, CustomerID:int" in capsule.condensed_prompt_snippet
    assert capsule.estimated_tokens < 100


def test_blast_radius_downstream_calculation(sample_graph):
    # Altering bronze raw_orders will affect notebook, silver table, and Power BI report
    report = sample_graph.calculate_blast_radius("brz_orders", is_destructive=True)
    assert report.risk_level == "critical"  # because Power BI report is downstream
    assert len(report.affected_nodes) == 3
    assert "Executive Sales Dashboard" in report.affected_reports
    assert "CRITICAL" in report.warning_message


def test_reactflow_export(sample_graph):
    flow_data = sample_graph.export_to_reactflow()
    assert len(flow_data["nodes"]) == 5
    assert len(flow_data["edges"]) == 4
    assert flow_data["edges"][0]["source"] == "src_orders"
