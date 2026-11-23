"""
omniflow/graph_generator.py
--------------------------
Builds dense, multi-tier Medallion DAGs and column-level constellations
from both dynamic session plans and enterprise retail benchmarks.
"""

from __future__ import annotations

import json
import os
import re
from typing import Any, Literal
import networkx as nx


def add_node(
    g: nx.DiGraph,
    node_id: str,
    label: str,
    ntype: Literal["source", "schema", "lakehouse", "warehouse", "table", "column", "notebook", "pipeline", "metric"],
    layer: str,
    parent_id: str | None = None,
    data_type: str | None = None,
    is_pk: bool = False,
    is_fk: bool = False,
    radius: float = 8.0,
    desc: str | None = None,
    cluster: str | None = None,
) -> None:
    g.add_node(
        node_id,
        label=label,
        type=ntype,
        layer=layer,
        parent_id=parent_id,
        data_type=data_type,
        is_primary_key=is_pk,
        is_foreign_key=is_fk,
        radius=radius,
        description=desc,
        cluster_group=cluster or parent_id or layer,
    )


def add_edge(
    g: nx.DiGraph,
    source: str,
    target: str,
    rel: Literal["FEEDS", "CONTAINS", "TRANSFORMS_TO", "JOINS_WITH", "AGGREGATES", "DEPENDS_ON"],
    desc: str | None = None,
    cross_layer: bool = False,
) -> None:
    edge_id = f"e_{source}_{target}_{rel}"
    g.add_edge(source, target, id=edge_id, relationship=rel, description=desc, is_cross_layer=cross_layer)


def build_rich_medallion_galaxy() -> nx.DiGraph:
    """Builds a dense enterprise constellation (90+ nodes) matching the Obsidian galaxy style."""
    g = nx.DiGraph()

    # Ingestion Sources
    add_node(g, "src_sap", "SAP ERP Gateway", "source", "source", radius=20.0, desc="SAP NetWeaver CDC connector")
    add_node(g, "src_sfdc", "Salesforce CRM Stream", "source", "source", radius=18.0, desc="Salesforce REST & Events API")
    add_node(g, "src_pos", "Point-of-Sale Eventhub", "source", "source", radius=16.0, desc="Kafka / Event Hub real-time feed")

    # Bronze Lakehouse Hub
    add_node(g, "lh_bronze", "lh_retail_bronze", "lakehouse", "bronze", radius=24.0, desc="Raw Medallion Ingestion Hub")

    # Bronze Tables
    brz_tables = [
        ("tbl_brz_orders", "raw_orders", [
            ("col_bo_id", "order_id", "bigint", True, False),
            ("col_bo_cust", "customer_id", "string", False, False),
            ("col_bo_store", "store_id", "string", False, False),
            ("col_bo_amt", "amount", "decimal(12,2)", False, False),
            ("col_bo_tax", "tax_amount", "decimal(8,2)", False, False),
            ("col_bo_dt", "created_at", "timestamp", False, False),
            ("col_bo_status", "status_code", "string", False, False),
        ]),
        ("tbl_brz_customers", "raw_customers", [
            ("col_bc_id", "customer_id", "string", True, False),
            ("col_bc_email", "email_raw", "string", False, False),
            ("col_bc_fname", "first_name", "string", False, False),
            ("col_bc_lname", "last_name", "string", False, False),
            ("col_bc_segment", "customer_segment", "string", False, False),
            ("col_bc_dt", "signup_timestamp", "timestamp", False, False),
        ]),
        ("tbl_brz_items", "raw_order_items", [
            ("col_bi_id", "item_id", "bigint", True, False),
            ("col_bi_order", "order_id", "bigint", False, True),
            ("col_bi_prod", "product_id", "string", False, False),
            ("col_bi_qty", "quantity", "integer", False, False),
            ("col_bi_price", "unit_price", "decimal(10,2)", False, False),
            ("col_bi_disc", "discount_rate", "decimal(5,4)", False, False),
        ]),
        ("tbl_brz_products", "raw_products", [
            ("col_bp_id", "product_id", "string", True, False),
            ("col_bp_sku", "sku_code", "string", False, False),
            ("col_bp_cat", "category_name", "string", False, False),
            ("col_bp_cost", "unit_cost", "decimal(10,2)", False, False),
            ("col_bp_active", "is_discontinued", "boolean", False, False),
        ]),
        ("tbl_brz_payments", "raw_payments", [
            ("col_by_id", "payment_id", "string", True, False),
            ("col_by_order", "order_id", "bigint", False, True),
            ("col_by_method", "payment_method", "string", False, False),
            ("col_by_amt", "settled_amount", "decimal(12,2)", False, False),
            ("col_by_dt", "processed_at", "timestamp", False, False),
        ]),
    ]

    for tbl_id, tbl_name, cols in brz_tables:
        add_node(g, tbl_id, tbl_name, "table", "bronze", parent_id="lh_bronze", radius=14.0, desc=f"Raw append Delta table: {tbl_name}")
        add_edge(g, "lh_bronze", tbl_id, "CONTAINS")
        for cid, cname, dtype, pk, fk in cols:
            add_node(g, cid, cname, "column", "bronze", parent_id=tbl_id, data_type=dtype, is_pk=pk, is_fk=fk, radius=5.5)
            add_edge(g, tbl_id, cid, "CONTAINS")

    add_edge(g, "src_sap", "tbl_brz_orders", "FEEDS", "CDC streaming microbatch", True)
    add_edge(g, "src_sfdc", "tbl_brz_customers", "FEEDS", "Customer master feed", True)
    add_edge(g, "src_pos", "tbl_brz_items", "FEEDS", "Terminal event payload", True)
    add_edge(g, "src_sap", "tbl_brz_products", "FEEDS", "ERP product sync", True)
    add_edge(g, "src_pos", "tbl_brz_payments", "FEEDS", "Payment terminal log", True)

    # Silver Layer Hub & Notebooks
    add_node(g, "lh_silver", "lh_retail_silver", "lakehouse", "silver", radius=25.0, desc="Curated & Cleansed Delta Lakehouse")
    add_node(g, "nb_clean_orders", "nb_01_curate_orders", "notebook", "silver", radius=15.0, desc="Delta MERGE on order_id with deduplication")
    add_node(g, "nb_clean_customers", "nb_02_curate_customers", "notebook", "silver", radius=15.0, desc="SCD Type 1 with email hashing")

    slv_tables = [
        ("tbl_slv_orders", "silver_orders", [
            ("col_so_id", "order_id", "bigint", True, False),
            ("col_so_cust", "customer_id", "string", False, True),
            ("col_so_store", "store_id", "string", False, False),
            ("col_so_amt", "net_amount", "decimal(12,2)", False, False),
            ("col_so_dt", "order_date", "date", False, False),
            ("col_so_valid", "is_valid", "boolean", False, False),
        ]),
        ("tbl_slv_customers", "silver_customers", [
            ("col_sc_id", "customer_id", "string", True, False),
            ("col_sc_email", "clean_email", "string", False, False),
            ("col_sc_name", "full_name", "string", False, False),
            ("col_sc_tier", "loyalty_tier", "string", False, False),
            ("col_sc_active", "is_active", "boolean", False, False),
        ]),
        ("tbl_slv_items", "silver_order_items", [
            ("col_si_id", "item_id", "bigint", True, False),
            ("col_si_order", "order_id", "bigint", False, True),
            ("col_si_prod", "product_id", "string", False, True),
            ("col_si_rev", "line_revenue", "decimal(12,2)", False, False),
        ]),
        ("tbl_slv_products", "silver_products", [
            ("col_sp_id", "product_id", "string", True, False),
            ("col_sp_name", "product_name", "string", False, False),
            ("col_sp_cat", "category", "string", False, False),
            ("col_sp_margin", "standard_margin", "decimal(6,4)", False, False),
        ]),
    ]

    for tbl_id, tbl_name, cols in slv_tables:
        add_node(g, tbl_id, tbl_name, "table", "silver", parent_id="lh_silver", radius=15.0, desc=f"Cleaned Delta table: {tbl_name}")
        add_edge(g, "lh_silver", tbl_id, "CONTAINS")
        for cid, cname, dtype, pk, fk in cols:
            add_node(g, cid, cname, "column", "silver", parent_id=tbl_id, data_type=dtype, is_pk=pk, is_fk=fk, radius=6.0)
            add_edge(g, tbl_id, cid, "CONTAINS")

    add_edge(g, "tbl_brz_orders", "nb_clean_orders", "DEPENDS_ON")
    add_edge(g, "nb_clean_orders", "tbl_slv_orders", "TRANSFORMS_TO", "MERGE upsert", True)
    add_edge(g, "tbl_brz_customers", "nb_clean_customers", "DEPENDS_ON")
    add_edge(g, "nb_clean_customers", "tbl_slv_customers", "TRANSFORMS_TO", "Cleanse & enrich", True)
    add_edge(g, "tbl_brz_items", "tbl_slv_items", "TRANSFORMS_TO", "Price enrichment", True)
    add_edge(g, "tbl_brz_products", "tbl_slv_products", "TRANSFORMS_TO", "Active catalog", True)

    # Cross-table joins in Silver
    add_edge(g, "col_so_cust", "col_sc_id", "JOINS_WITH", "FK: orders -> customers", False)
    add_edge(g, "col_si_order", "col_so_id", "JOINS_WITH", "FK: order_items -> orders", False)
    add_edge(g, "col_si_prod", "col_sp_id", "JOINS_WITH", "FK: order_items -> products", False)

    # Column-level lineage from Bronze to Silver
    add_edge(g, "col_bo_id", "col_so_id", "TRANSFORMS_TO", "Direct column map", True)
    add_edge(g, "col_bo_amt", "col_so_amt", "TRANSFORMS_TO", "Deductions applied", True)
    add_edge(g, "col_bc_id", "col_sc_id", "TRANSFORMS_TO", "Key preserved", True)

    # Gold Layer Hub & Star Schema
    add_node(g, "lh_gold", "lh_retail_gold", "lakehouse", "gold", radius=25.0, desc="Kimball Star Schema Analytical Hub")
    add_node(g, "nb_build_star", "nb_03_build_star_schema", "notebook", "gold", radius=15.0, desc="PySpark dimensional model generator")

    gold_tables = [
        ("tbl_gold_fact", "fact_sales", [
            ("col_gf_key", "sales_key", "bigint", True, False),
            ("col_gf_custkey", "customer_key", "bigint", False, True),
            ("col_gf_prodkey", "product_key", "bigint", False, True),
            ("col_gf_datekey", "date_key", "integer", False, True),
            ("col_gf_rev", "gross_revenue", "decimal(14,2)", False, False),
            ("col_gf_profit", "gross_profit", "decimal(14,2)", False, False),
            ("col_gf_qty", "units_sold", "integer", False, False),
        ]),
        ("tbl_gold_dim_cust", "dim_customer", [
            ("col_gdc_key", "customer_key", "bigint", True, False),
            ("col_gdc_id", "natural_customer_id", "string", False, False),
            ("col_gdc_name", "customer_name", "string", False, False),
            ("col_gdc_tier", "current_tier", "string", False, False),
            ("col_gdc_ltv", "computed_ltv", "decimal(12,2)", False, False),
        ]),
        ("tbl_gold_dim_prod", "dim_product", [
            ("col_gdp_key", "product_key", "bigint", True, False),
            ("col_gdp_id", "natural_product_id", "string", False, False),
            ("col_gdp_name", "product_title", "string", False, False),
            ("col_gdp_cat", "department", "string", False, False),
        ]),
    ]

    for tbl_id, tbl_name, cols in gold_tables:
        add_node(g, tbl_id, tbl_name, "table", "gold", parent_id="lh_gold", radius=16.0, desc=f"Gold table: {tbl_name}")
        add_edge(g, "lh_gold", tbl_id, "CONTAINS")
        for cid, cname, dtype, pk, fk in cols:
            add_node(g, cid, cname, "column", "gold", parent_id=tbl_id, data_type=dtype, is_pk=pk, is_fk=fk, radius=6.0)
            add_edge(g, tbl_id, cid, "CONTAINS")

    add_edge(g, "tbl_slv_orders", "nb_build_star", "DEPENDS_ON")
    add_edge(g, "tbl_slv_items", "nb_build_star", "DEPENDS_ON")
    add_edge(g, "nb_build_star", "tbl_gold_fact", "TRANSFORMS_TO", "Star aggregation", True)
    add_edge(g, "tbl_slv_customers", "tbl_gold_dim_cust", "TRANSFORMS_TO", "Dim SCD generator", True)
    add_edge(g, "tbl_slv_products", "tbl_gold_dim_prod", "TRANSFORMS_TO", "Dim product lookup", True)

    # Gold Join Lineage
    add_edge(g, "col_gf_custkey", "col_gdc_key", "JOINS_WITH", "Star Join: Fact -> Dim Customer", False)
    add_edge(g, "col_gf_prodkey", "col_gdp_key", "JOINS_WITH", "Star Join: Fact -> Dim Product", False)

    # Column-level aggregation lineage
    add_edge(g, "col_so_amt", "col_gf_rev", "TRANSFORMS_TO", "Sum to gross revenue", True)
    add_edge(g, "col_sc_id", "col_gdc_id", "TRANSFORMS_TO", "Surrogate mapping", True)

    # Power BI Semantic Model DAX Metrics
    dax_metrics = [
        ("met_rev", "Total Revenue ($)", "SUM(fact_sales[gross_revenue])"),
        ("met_profit", "Gross Profit ($)", "SUM(fact_sales[gross_profit])"),
        ("met_margin", "Margin %", "DIVIDE([Gross Profit], [Total Revenue])"),
        ("met_aov", "Average Order Value", "DIVIDE([Total Revenue], DISTINCTCOUNT(fact_sales[sales_key]))"),
        ("met_units", "Total Units Sold", "SUM(fact_sales[units_sold])"),
    ]
    for mid, mname, dax in dax_metrics:
        add_node(g, mid, mname, "metric", "bi", radius=11.0, desc=f"DAX: {dax}")

    add_edge(g, "col_gf_rev", "met_rev", "AGGREGATES", "DAX measure source", True)
    add_edge(g, "col_gf_profit", "met_profit", "AGGREGATES", "DAX measure source", True)
    add_edge(g, "met_profit", "met_margin", "AGGREGATES", "Derived DAX calculation", False)
    add_edge(g, "met_rev", "met_margin", "AGGREGATES", "Derived DAX calculation", False)
    add_edge(g, "met_rev", "met_aov", "AGGREGATES", "Derived DAX calculation", False)
    add_edge(g, "col_gf_qty", "met_units", "AGGREGATES", "DAX measure source", True)

    # Orchestration Data Pipeline
    add_node(g, "pipe_daily", "pl_daily_enterprise_orchestrator", "pipeline", "shared", radius=18.0, desc="Fabric Data Factory Pipeline")
    add_edge(g, "pipe_daily", "nb_clean_orders", "DEPENDS_ON", "Step 1: Ingest & Cleanse")
    add_edge(g, "pipe_daily", "nb_build_star", "DEPENDS_ON", "Step 2: Aggregate Star Schema")

    return g


def build_mesh_from_plan(plan: dict[str, Any] | None) -> nx.DiGraph:
    """Dynamically compiles a pure tabular Entity-Relationship & Lineage DAG from the architecture plan.
    Strictly models schemas, tables, and columns with foreign keys and transformations.
    Eliminates folder nodes, pipeline noise, and generic feeds edges.
    """
    if not plan or not isinstance(plan, dict) or not plan.get("lakehouses"):
        return build_rich_medallion_galaxy()

    g = nx.DiGraph()
    lakehouses = plan.get("lakehouses", [])
    tables = plan.get("tables", [])
    warehouse = plan.get("warehouse") or "wh_postgres_medallion_gold"

    lh_bronze = next((str(l) for l in lakehouses if "bronze" in str(l).lower()), lakehouses[0] if lakehouses else "lh_bronze")
    lh_silver = next((str(l) for l in lakehouses if "silver" in str(l).lower()), lakehouses[1] if len(lakehouses) > 1 else "lh_silver")

    # 1. Clean Schema Containers (Grouping boundaries without folder noise)
    add_node(g, "schema_source", "Source Relational Schema", "schema", "source", radius=14.0, desc="Source Tables & Entity Relations")
    add_node(g, "schema_bronze", str(lh_bronze), "schema", "bronze", radius=14.0, desc=f"Raw Delta Lakehouse: {lh_bronze}")
    add_node(g, "schema_silver", str(lh_silver), "schema", "silver", radius=14.0, desc=f"Harmonized Clean Delta Lakehouse: {lh_silver}")
    add_node(g, "schema_gold", str(warehouse), "schema", "gold", radius=14.0, desc=f"Direct Lake Dimensional Mart: {warehouse}")

    # Standard column registry for known data entities
    COLUMN_CATALOG: dict[str, list[tuple[str, str, bool, bool]]] = {
        "customers": [
            ("customer_id", "bigint", True, False),
            ("email", "varchar(255)", False, False),
            ("first_name", "varchar(100)", False, False),
            ("last_name", "varchar(100)", False, False),
            ("created_at", "timestamp", False, False),
        ],
        "orders": [
            ("order_id", "bigint", True, False),
            ("customer_id", "bigint", False, True),
            ("order_date", "timestamp", False, False),
            ("total_amount", "decimal(12,2)", False, False),
            ("status", "varchar(50)", False, False),
        ],
        "order_items": [
            ("item_id", "bigint", True, False),
            ("order_id", "bigint", False, True),
            ("product_id", "bigint", False, True),
            ("quantity", "int", False, False),
            ("unit_price", "decimal(10,2)", False, False),
        ],
        "products": [
            ("product_id", "bigint", True, False),
            ("sku", "varchar(50)", False, False),
            ("product_name", "varchar(200)", False, False),
            ("price", "decimal(10,2)", False, False),
            ("is_active", "boolean", False, False),
        ],
        "runs": [
            ("run_id", "varchar(64)", True, False),
            ("project_code", "varchar(64)", False, True),
            ("status", "varchar(32)", False, False),
            ("started_at", "timestamp", False, False),
            ("duration_ms", "bigint", False, False),
        ],
        "agent_runs": [
            ("agent_run_id", "varchar(64)", True, False),
            ("run_id", "varchar(64)", False, True),
            ("agent_name", "varchar(100)", False, False),
            ("status", "varchar(32)", False, False),
        ],
        "tool_runs": [
            ("tool_run_id", "varchar(64)", True, False),
            ("run_id", "varchar(64)", False, True),
            ("tool_name", "varchar(100)", False, False),
            ("latency_ms", "int", False, False),
        ],
        "fabric_items": [
            ("item_id", "varchar(64)", True, False),
            ("project_code", "varchar(64)", False, True),
            ("item_name", "varchar(128)", False, False),
            ("item_type", "varchar(64)", False, False),
        ],
        "projects": [
            ("project_code", "varchar(64)", True, False),
            ("project_name", "varchar(128)", False, False),
            ("owner_email", "varchar(128)", False, True),
            ("created_at", "timestamp", False, False),
        ],
        "users": [
            ("user_id", "varchar(64)", True, False),
            ("email", "varchar(128)", False, False),
            ("role", "varchar(64)", False, False),
        ],
        "lineage_graph_edges": [
            ("edge_id", "varchar(64)", True, False),
            ("run_id", "varchar(64)", False, True),
            ("source_node", "varchar(128)", False, False),
            ("target_node", "varchar(128)", False, False),
        ],
        "llm_token_logs": [
            ("log_id", "varchar(64)", True, False),
            ("run_id", "varchar(64)", False, True),
            ("prompt_tokens", "int", False, False),
            ("completion_tokens", "int", False, False),
        ],
    }

    # Inter-table foreign key relationships
    KNOWN_FK_EDGES = [
        ("order_items", "orders", "order_id"),
        ("orders", "customers", "customer_id"),
        ("order_items", "products", "product_id"),
        ("agent_runs", "runs", "run_id"),
        ("tool_runs", "runs", "run_id"),
        ("lineage_graph_edges", "runs", "run_id"),
        ("llm_token_logs", "runs", "run_id"),
        ("fabric_items", "projects", "project_code"),
        ("runs", "projects", "project_code"),
        ("projects", "users", "owner_email"),
    ]

    short_entities: set[str] = set()
    if tables and isinstance(tables, list):
        for tbl in tables:
            tname = str(tbl.get("name", "table"))
            clean_short = tname
            if clean_short.startswith("brz_"):
                clean_short = clean_short[4:]
            elif clean_short.startswith("slv_"):
                clean_short = clean_short[4:]
            elif "." in clean_short:
                clean_short = clean_short.split(".")[-1]
            short_entities.add(clean_short.strip().lower())

    if not short_entities:
        short_entities = {"customers", "orders", "order_items", "products"}

    # 2. Build Medallion Tabular Nodes & Columns
    for entity in short_entities:
        src_id = f"tbl_src_{entity}"
        brz_id = f"tbl_brz_{entity}"
        slv_id = f"tbl_slv_{entity}"
        gold_id = f"tbl_gold_{entity}"
        gold_name = f"fact_{entity}" if any(w in entity for w in ("order", "run", "item", "log", "edge")) else f"dim_{entity}"

        # Source Table
        add_node(g, src_id, entity, "table", "source", parent_id="schema_source", radius=7.0, desc=f"Source Relational Entity: {entity}")
        add_edge(g, "schema_source", src_id, "CONTAINS")

        # Bronze Delta Table
        add_node(g, brz_id, f"brz_{entity}", "table", "bronze", parent_id="schema_bronze", radius=7.0, desc=f"Raw Bronze Delta Table: brz_{entity}")
        add_edge(g, "schema_bronze", brz_id, "CONTAINS")
        add_edge(g, src_id, brz_id, "TRANSFORMS_TO", "Raw Delta Append Ingest", True)

        # Silver Delta Table
        add_node(g, slv_id, f"slv_{entity}", "table", "silver", parent_id="schema_silver", radius=7.5, desc=f"Silver Curated Delta: slv_{entity} (SCD2 MERGE)")
        add_edge(g, "schema_silver", slv_id, "CONTAINS")
        add_edge(g, brz_id, slv_id, "TRANSFORMS_TO", "Delta MERGE Upsert & PII Mask", True)

        # Gold Mart Table
        add_node(g, gold_id, gold_name, "table", "gold", parent_id="schema_gold", radius=8.0, desc=f"Gold Dimensional Model: {gold_name}")
        add_edge(g, "schema_gold", gold_id, "CONTAINS")
        add_edge(g, slv_id, gold_id, "TRANSFORMS_TO", "Kimball Star Aggregation", True)

        # Expand Columns for this entity
        col_specs = COLUMN_CATALOG.get(entity, [
            (f"{entity}_id", "bigint", True, False),
            ("name", "varchar(100)", False, False),
            ("updated_at", "timestamp", False, False),
        ])
        for col_name, col_type, is_pk, is_fk in col_specs:
            cid = f"col_{entity}_{col_name}"
            add_node(
                g,
                cid,
                col_name,
                "column",
                "silver",
                parent_id=slv_id,
                data_type=col_type,
                is_pk=is_pk,
                is_fk=is_fk,
                radius=3.2,
                desc=f"Column [{col_name}] Type: {col_type}" + (" (Primary Key)" if is_pk else (" (Foreign Key)" if is_fk else "")),
            )
            add_edge(g, slv_id, cid, "CONTAINS")

    # 3. Add Tabular Foreign Key Joins (Entity Relationships)
    for child, parent, fk_col in KNOWN_FK_EDGES:
        if child in short_entities and parent in short_entities:
            # Source FK
            add_edge(g, f"tbl_src_{child}", f"tbl_src_{parent}", "JOINS_WITH", f"FK: {fk_col}")
            # Silver FK
            add_edge(g, f"tbl_slv_{child}", f"tbl_slv_{parent}", "JOINS_WITH", f"FK: {fk_col}")
            # Gold Star Schema FK
            add_edge(g, f"tbl_gold_{child}", f"tbl_gold_{parent}", "JOINS_WITH", f"Fact-to-Dim: {fk_col}")

    return g
