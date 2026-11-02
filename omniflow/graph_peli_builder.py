"""
omniflow/graph_peli_builder.py
------------------------------
Generates a comprehensive, production-grade Medallion architecture DAG
and Column-Level Lineage Graph for the Peli BioThermal Cold-Chain Fabric Platform.
Includes column-to-column transformation logic, T-SQL expressions, and foreign key joins.
"""

from __future__ import annotations
import networkx as nx
from omniflow.graph_generator import add_node, add_edge


def build_peli_biothermal_graph() -> nx.DiGraph:
    """Builds the complete Peli BioThermal production platform with column lineages."""
    g = nx.DiGraph()

    # -------------------------------------------------------------
    # 1. Ingestion Sources (layer: 'source')
    # -------------------------------------------------------------
    sources = [
        ("src_sap_erp", "SAP S/4HANA ERP", "Core SAP Order-to-Cash & Material Master CDC Gateway"),
        ("src_salesforce_crm", "Salesforce CRM", "Enterprise Accounts, Pipeline & Opportunity Events API"),
        ("src_nanocool_telemetry", "NanoCool IoT Gateway", "Active Thermal Packaging & Probe Telemetry Stream"),
        ("src_cod_asset_tracker", "COD Fleet Rental API", "Cold-Chain Reusable Shipper Asset & Rental Tracking"),
        ("src_evo_fulfillment", "EVO Warehouse WMS", "Packout, Delivery & Cold Storage Fulfillment Stream"),
    ]
    for sid, sname, sdesc in sources:
        add_node(g, sid, sname, "source", "source", radius=9.0, desc=sdesc)

    # -------------------------------------------------------------
    # 2. Bronze / Staging Lakehouse (lh_stg / layer: 'bronze')
    # -------------------------------------------------------------
    stg_tables = [
        ("tbl_stg_customers", "stg_sap_customers", [
            ("customer_id", "bigint", True),
            ("sales_org", "string", False),
            ("region_code", "string", False),
            ("credit_limit_usd", "decimal(12,2)", False),
            ("payment_terms", "string", False),
        ]),
        ("tbl_stg_orders", "stg_sap_orders", [
            ("order_id", "bigint", True),
            ("customer_id", "bigint", False),
            ("order_date", "date", False),
            ("currency_code", "string", False),
            ("gross_amount", "decimal(12,2)", False),
        ]),
        ("tbl_stg_order_items", "stg_sap_order_items", [
            ("order_item_id", "bigint", True),
            ("order_id", "bigint", False),
            ("material_sku", "string", False),
            ("ordered_qty", "integer", False),
            ("net_price_usd", "decimal(10,2)", False),
        ]),
        ("tbl_stg_invoices", "stg_sap_invoices", [
            ("invoice_id", "bigint", True),
            ("order_id", "bigint", False),
            ("invoice_date", "date", False),
            ("customer_id", "bigint", False),
            ("total_usd", "decimal(12,2)", False),
        ]),
        ("tbl_stg_materials", "stg_sap_materials", [
            ("material_sku", "string", True),
            ("product_name", "string", False),
            ("thermal_class", "string", False),
            ("standard_cost", "decimal(10,2)", False),
        ]),
        ("tbl_stg_accounts", "stg_crm_accounts", [
            ("account_id", "string", True),
            ("account_name", "string", False),
            ("industry_vertical", "string", False),
            ("parent_account_id", "string", False),
        ]),
        ("tbl_stg_rentals", "stg_cod_rentals", [
            ("rental_id", "bigint", True),
            ("customer_id", "bigint", False),
            ("asset_serial_no", "string", False),
            ("start_date", "date", False),
            ("daily_rate_usd", "decimal(8,2)", False),
        ]),
        ("tbl_stg_telemetry", "stg_thermal_telemetry", [
            ("reading_id", "bigint", True),
            ("asset_serial_no", "string", False),
            ("probe_time", "timestamp", False),
            ("temp_celsius", "decimal(5,2)", False),
            ("battery_pct", "integer", False),
        ]),
    ]

    for tid, tname, cols in stg_tables:
        add_node(g, tid, tname, "table", "bronze", radius=6.5, desc=f"Raw Delta Staging Table: {tname}")
        for cname, dtype, is_pk in cols:
            cid = f"col_{tid}_{cname}"
            add_node(g, cid, cname, "column", "bronze", parent_id=tid, data_type=dtype, is_pk=is_pk, radius=3.0)
            add_edge(g, tid, cid, "CONTAINS", desc=f"Column attribute ({dtype})")

    # Ingestion flows (Source -> Staging Table)
    add_edge(g, "src_sap_erp", "tbl_stg_customers", "FEEDS", "CDC Ingestion from SAP KNA1")
    add_edge(g, "src_sap_erp", "tbl_stg_orders", "FEEDS", "Microbatch Ingestion from SAP VBAK")
    add_edge(g, "src_sap_erp", "tbl_stg_order_items", "FEEDS", "Microbatch Ingestion from SAP VBAP")
    add_edge(g, "src_sap_erp", "tbl_stg_invoices", "FEEDS", "Billing Ingestion from SAP VBRK")
    add_edge(g, "src_sap_erp", "tbl_stg_materials", "FEEDS", "Material Sync from SAP MARA")
    add_edge(g, "src_salesforce_crm", "tbl_stg_accounts", "FEEDS", "REST Batch Ingestion from Salesforce")
    add_edge(g, "src_cod_asset_tracker", "tbl_stg_rentals", "FEEDS", "Rental Log Stream Ingestion")
    add_edge(g, "src_nanocool_telemetry", "tbl_stg_telemetry", "FEEDS", "IoT Event Hub Telemetry Ingestion")

    # -------------------------------------------------------------
    # 3. Silver Conformed Warehouse (wh_silver / layer: 'silver')
    # -------------------------------------------------------------
    slv_tables = [
        ("tbl_dim_customer", "dim_customer", [
            ("customer_key", "string", True),
            ("customer_name", "string", False),
            ("sales_org", "string", False),
            ("region_code", "string", False),
            ("total_credit_usd", "decimal(14,2)", False),
        ]),
        ("tbl_dim_material", "dim_material", [
            ("material_key", "string", True),
            ("product_name", "string", False),
            ("thermal_range", "string", False),
            ("standard_cost_usd", "decimal(10,2)", False),
        ]),
        ("tbl_dim_equipment", "dim_equipment", [
            ("equipment_key", "string", True),
            ("asset_serial_no", "string", False),
            ("calibration_date", "date", False),
            ("compliance_status", "string", False),
        ]),
        ("tbl_fact_sales_order", "fact_sales_order", [
            ("order_key", "string", True),
            ("customer_key", "string", False),
            ("order_date", "date", False),
            ("order_total_usd", "decimal(14,2)", False),
        ]),
        ("tbl_fact_order_line", "fact_order_line", [
            ("line_key", "string", True),
            ("order_key", "string", False),
            ("material_key", "string", False),
            ("ordered_qty", "integer", False),
            ("line_net_usd", "decimal(12,2)", False),
        ]),
        ("tbl_fact_invoice_line", "fact_invoice_line", [
            ("inv_line_key", "string", True),
            ("customer_key", "string", False),
            ("material_key", "string", False),
            ("billed_qty", "integer", False),
            ("line_total_usd", "decimal(12,2)", False),
        ]),
        ("tbl_fact_cod_rental", "fact_cod_rental", [
            ("rental_key", "string", True),
            ("customer_key", "string", False),
            ("equipment_key", "string", False),
            ("rental_days", "integer", False),
            ("total_rental_usd", "decimal(12,2)", False),
        ]),
        ("tbl_fact_excursion", "fact_thermal_excursion", [
            ("excursion_key", "string", True),
            ("equipment_key", "string", False),
            ("temp_celsius", "decimal(5,2)", False),
            ("is_excursion", "boolean", False),
        ]),
    ]

    for tid, tname, cols in slv_tables:
        add_node(g, tid, tname, "table", "silver", radius=6.5, desc=f"Conformed Silver Dimension/Fact: {tname}")
        for cname, dtype, is_pk in cols:
            cid = f"col_{tid}_{cname}"
            add_node(g, cid, cname, "column", "silver", parent_id=tid, data_type=dtype, is_pk=is_pk, radius=3.0)
            add_edge(g, tid, cid, "CONTAINS", desc=f"Column attribute ({dtype})")

    # Table-level Silver Lineage
    add_edge(g, "tbl_stg_customers", "tbl_dim_customer", "TRANSFORMS_TO", "sp_dim_customer SCD-1 Conformed Upsert")
    add_edge(g, "tbl_stg_materials", "tbl_dim_material", "TRANSFORMS_TO", "sp_dim_material SKU Harmonization")
    add_edge(g, "tbl_stg_orders", "tbl_fact_sales_order", "TRANSFORMS_TO", "sp_fact_sales_order Header Transformation")
    add_edge(g, "tbl_stg_order_items", "tbl_fact_order_line", "TRANSFORMS_TO", "sp_fact_sales_order_line Pricing Calculation")
    add_edge(g, "tbl_stg_invoices", "tbl_fact_invoice_line", "TRANSFORMS_TO", "sp_fact_invoice_line Revenue Enrichment")
    add_edge(g, "tbl_stg_rentals", "tbl_fact_cod_rental", "TRANSFORMS_TO", "sp_fact_cod_rental Duration & Fee Logic")
    add_edge(g, "tbl_stg_telemetry", "tbl_fact_excursion", "TRANSFORMS_TO", "IoT Excursion Detection Algorithm")

    # -------------------------------------------------------------
    # 4. Gold Warehouse Aggregations (wh_gold / layer: 'gold')
    # -------------------------------------------------------------
    gold_tables = [
        ("tbl_gold_fact_billings", "fact_billings", [
            ("billing_key", "string", True),
            ("customer_key", "string", False),
            ("billing_month", "date", False),
            ("qty_real", "integer", False),
            ("qty_artificial", "decimal(12,2)", False),
            ("amount_spot_usd", "decimal(14,2)", False),
            ("is_covid_impacted", "boolean", False),
        ]),
        ("tbl_gold_product_margin", "fact_product_margin", [
            ("margin_key", "string", True),
            ("material_key", "string", False),
            ("gross_rev_usd", "decimal(14,2)", False),
            ("cogs_usd", "decimal(14,2)", False),
            ("gross_margin_usd", "decimal(14,2)", False),
            ("margin_pct", "decimal(5,2)", False),
        ]),
        ("tbl_gold_sales_waterfall", "fact_sales_waterfall", [
            ("waterfall_key", "string", True),
            ("customer_key", "string", False),
            ("starting_arr", "decimal(14,2)", False),
            ("expansion_arr", "decimal(14,2)", False),
            ("ending_arr", "decimal(14,2)", False),
        ]),
    ]

    for tid, tname, cols in gold_tables:
        add_node(g, tid, tname, "warehouse", "gold", radius=7.2, desc=f"Star Schema Enterprise Fact: {tname}")
        for cname, dtype, is_pk in cols:
            cid = f"col_{tid}_{cname}"
            add_node(g, cid, cname, "column", "gold", parent_id=tid, data_type=dtype, is_pk=is_pk, radius=3.0)
            add_edge(g, tid, cid, "CONTAINS", desc=f"Column attribute ({dtype})")

    add_edge(g, "tbl_fact_order_line", "tbl_gold_fact_billings", "AGGREGATES", "curated.sp_fact_billings Billing Rollup")
    add_edge(g, "tbl_fact_invoice_line", "tbl_gold_product_margin", "AGGREGATES", "curated.sp_fact_product_margin Margin Calculation")
    add_edge(g, "tbl_fact_sales_order", "tbl_gold_sales_waterfall", "AGGREGATES", "ARR Cohort Waterfall Analysis")

    # -------------------------------------------------------------
    # 5. Direct Lake Semantic Models (layer: 'bi')
    # -------------------------------------------------------------
    add_node(g, "sm_peli_commercial", "Peli Commercial Scorecard", "metric", "bi", radius=8.0, desc="Power BI Direct Lake Semantic Model")
    add_node(g, "sm_cold_chain_iot", "Cold-Chain IoT Telemetry", "metric", "bi", radius=8.0, desc="Direct Lake Probe & Quality Monitoring")

    add_edge(g, "tbl_gold_fact_billings", "sm_peli_commercial", "AGGREGATES", "DAX Commercial Direct Lake Model")
    add_edge(g, "tbl_gold_product_margin", "sm_peli_commercial", "AGGREGATES", "DAX Margin & Price Realization")
    add_edge(g, "tbl_fact_excursion", "sm_cold_chain_iot", "AGGREGATES", "DAX Real-Time Temperature SLA Model")

    # -------------------------------------------------------------
    # 6. Granular Column-to-Column Lineage & SQL Transformation Edges
    # -------------------------------------------------------------
    col_lineages = [
        # Stg -> Silver Customer
        ("col_tbl_stg_customers_customer_id", "col_tbl_dim_customer_customer_key", "TRANSFORMS_TO",
         "HASHBYTES('SHA2_256', UPPER(TRIM(stg.customer_id))) AS customer_key"),
        ("col_tbl_stg_customers_credit_limit_usd", "col_tbl_dim_customer_total_credit_usd", "TRANSFORMS_TO",
         "SUM(COALESCE(stg.credit_limit_usd, 0.0)) AS total_credit_usd GROUP BY customer_id"),

        # Stg -> Silver Material
        ("col_tbl_stg_materials_material_sku", "col_tbl_dim_material_material_key", "TRANSFORMS_TO",
         "CONCAT('MAT_', UPPER(TRIM(stg.material_sku))) AS material_key"),
        ("col_tbl_stg_materials_standard_cost", "col_tbl_dim_material_standard_cost_usd", "TRANSFORMS_TO",
         "CAST(stg.standard_cost AS DECIMAL(10,2)) AS standard_cost_usd"),

        # Stg -> Silver Orders & Lines
        ("col_tbl_stg_orders_gross_amount", "col_tbl_fact_sales_order_order_total_usd", "TRANSFORMS_TO",
         "stg.gross_amount * fx.spot_exchange_rate AS order_total_usd"),
        ("col_tbl_stg_order_items_ordered_qty", "col_tbl_fact_order_line_ordered_qty", "TRANSFORMS_TO",
         "CAST(stg.ordered_qty AS INT) AS ordered_qty"),
        ("col_tbl_stg_order_items_net_price_usd", "col_tbl_fact_order_line_line_net_usd", "TRANSFORMS_TO",
         "stg.ordered_qty * stg.net_price_usd * (1.0 - COALESCE(stg.discount_rate, 0.0)) AS line_net_usd"),

        # Stg -> Silver Telemetry
        ("col_tbl_stg_telemetry_temp_celsius", "col_tbl_fact_excursion_is_excursion", "TRANSFORMS_TO",
         "CASE WHEN temp_celsius < -20.0 OR temp_celsius > -15.0 THEN 1 ELSE 0 END AS is_excursion"),

        # Stg -> Silver Rentals
        ("col_tbl_stg_rentals_daily_rate_usd", "col_tbl_fact_cod_rental_total_rental_usd", "TRANSFORMS_TO",
         "rental_days * daily_rate_usd AS total_rental_usd"),

        # Silver -> Gold Billings & Margin
        ("col_tbl_fact_order_line_ordered_qty", "col_tbl_gold_fact_billings_qty_artificial", "TRANSFORMS_TO",
         "b.ordered_qty * COALESCE(c.covid_impact_quantity_factor, 1.0) AS qty_artificial"),
        ("col_tbl_fact_order_line_line_net_usd", "col_tbl_gold_fact_billings_amount_spot_usd", "TRANSFORMS_TO",
         "b.line_net_usd * COALESCE(c.covid_impact_amount_factor, 1.0) AS amount_spot_usd"),
        ("col_tbl_fact_invoice_line_line_total_usd", "col_tbl_gold_product_margin_gross_margin_usd", "TRANSFORMS_TO",
         "inv.line_total_usd - (inv.billed_qty * mat.standard_cost_usd) AS gross_margin_usd"),
        ("col_tbl_gold_product_margin_gross_margin_usd", "col_tbl_gold_product_margin_margin_pct", "TRANSFORMS_TO",
         "ROUND((gross_margin_usd / NULLIF(gross_rev_usd, 0.0)) * 100.0, 2) AS margin_pct"),

        # Column Foreign Key Joins
        ("col_tbl_fact_sales_order_customer_key", "col_tbl_dim_customer_customer_key", "JOINS_WITH",
         "FOREIGN KEY JOIN: fact_sales_order.customer_key = dim_customer.customer_key"),
        ("col_tbl_fact_order_line_material_key", "col_tbl_dim_material_material_key", "JOINS_WITH",
         "FOREIGN KEY JOIN: fact_order_line.material_key = dim_material.material_key"),
        ("col_tbl_fact_invoice_line_customer_key", "col_tbl_dim_customer_customer_key", "JOINS_WITH",
         "FOREIGN KEY JOIN: fact_invoice_line.customer_key = dim_customer.customer_key"),
        ("col_tbl_fact_cod_rental_equipment_key", "col_tbl_dim_equipment_equipment_key", "JOINS_WITH",
         "FOREIGN KEY JOIN: fact_cod_rental.equipment_key = dim_equipment.equipment_key"),
    ]

    for src_col, tgt_col, rel, sql_desc in col_lineages:
        if src_col in g.nodes and tgt_col in g.nodes:
            add_edge(g, src_col, tgt_col, rel, desc=sql_desc)

    return g

