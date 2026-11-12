"""
omniflow/graph_peli_builder.py
------------------------------
Generates a comprehensive, production-grade Medallion architecture DAG
and Column-Level Lineage Graph for the Peli BioThermal Fabric Platform.
Dynamically extracts tables, attributes, data types, and foreign key
relationships from real DDLs in wh_silver.Warehouse.
"""

from __future__ import annotations

import os
import re
from typing import Any
import networkx as nx
from omniflow.graph_generator import add_node, add_edge

REPO_ROOT = os.path.join(os.path.dirname(__file__), "peli-fabric-data-platform")
WH_PATH = os.path.join(REPO_ROOT, "01_fabric_dwh", "03 silver", "02 warehouse", "wh_silver.Warehouse")

_CACHED_GRAPH: nx.DiGraph | None = None


def _parse_ddl_cols(filepath: str, max_cols: int = 9) -> list[tuple[str, str, bool]]:
    cols: list[tuple[str, str, bool]] = []
    if not os.path.exists(filepath):
        return cols
    try:
        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
            content = f.read()
    except Exception:
        return cols

    match = re.search(r"CREATE\s+TABLE\s+(?:\[?(\w+)\]?\.)?\[?(\w+)\]?\s*\((.*)\)", content, re.IGNORECASE | re.DOTALL)
    if not match:
        return cols

    body = match.group(3)
    skip = ("dozisf_", "is_deleted", "master_record_id", "created_date", "last_modified", "system_modstamp")
    for line in body.split("\n"):
        line = line.strip().rstrip(",")
        if not line or line.startswith("--") or line.startswith("CONSTRAINT") or line.startswith(")"):
            continue
        col_match = re.match(r"\[?(\w+)\]?\s+([A-Za-z0-9_()]+)(?:\s+(NOT\s+NULL|NULL))?", line, re.IGNORECASE)
        if col_match:
            cname = col_match.group(1).lower()
            ctype = col_match.group(2).lower()
            is_pk = bool(col_match.group(3) and "NOT" in col_match.group(3).upper())
            if cname.upper() in ("PRIMARY", "FOREIGN", "KEY", "CONSTRAINT", "INDEX"):
                continue
            if any(cname.startswith(p) for p in skip):
                continue
            cols.append((cname, ctype, is_pk))
            if len(cols) >= max_cols:
                break
    return cols


def build_peli_biothermal_graph() -> nx.DiGraph:
    """Builds the complete Peli BioThermal production platform with 620+ nodes and rich foreign key lineage."""
    global _CACHED_GRAPH
    if _CACHED_GRAPH is not None:
        return _CACHED_GRAPH

    g = nx.DiGraph()

    # 1. Ingestion Sources
    sources = [
        ("src_sap_erp", "SAP S/4HANA ERP", "Core SAP Order-to-Cash, Invoicing & Material Master CDC Gateway"),
        ("src_salesforce_crm", "Salesforce CRM", "Enterprise Accounts, Pipeline & Opportunity Events API"),
        ("src_evo_warehouse", "EVO Warehouse WMS", "Packout, Delivery & Cold Storage Fulfillment Stream"),
        ("src_cod_rental", "COD Fleet Rental API", "Cold-Chain Reusable Shipper Asset & Rental Tracking"),
        ("src_nanocool_iot", "NanoCool IoT Gateway", "Active Thermal Packaging & Probe Telemetry Stream"),
    ]
    for sid, sname, sdesc in sources:
        add_node(g, sid, sname, "source", "source", radius=12.5, desc=sdesc)

    # 2. Staging Lakehouse (lh_stg with explicit source schema hubs -> table squares -> columns)
    stg_tables = [
        ("tbl_stg_sap_vbak", "vbak", "src_sap_erp", "sap", [("vbeln", "string", True), ("erdat", "date", False), ("kunnr", "string", False), ("netwr", "decimal(14,2)", False), ("waerk", "string", False), ("vkorg", "string", False)]),
        ("tbl_stg_sap_vbap", "vbap", "src_sap_erp", "sap", [("vbeln", "string", True), ("posnr", "string", True), ("matnr", "string", False), ("kwmeng", "decimal(10,2)", False), ("netpr", "decimal(10,2)", False)]),
        ("tbl_stg_sap_kna1", "kna1", "src_sap_erp", "sap", [("kunnr", "string", True), ("name1", "string", False), ("land1", "string", False), ("ort01", "string", False), ("regio", "string", False)]),
        ("tbl_stg_sap_mara", "mara", "src_sap_erp", "sap", [("matnr", "string", True), ("mtart", "string", False), ("matkl", "string", False), ("meins", "string", False)]),
        ("tbl_stg_sap_marc", "marc", "src_sap_erp", "sap", [("matnr", "string", True), ("werks", "string", True), ("ekgrp", "string", False)]),
        ("tbl_stg_sap_vbrk", "vbrk", "src_sap_erp", "sap", [("vbeln", "string", True), ("fkdat", "date", False), ("kunrg", "string", False), ("netwr", "decimal(14,2)", False)]),
        ("tbl_stg_sap_vbrp", "vbrp", "src_sap_erp", "sap", [("vbeln", "string", True), ("posnr", "string", True), ("fkimg", "decimal(10,2)", False), ("netwr", "decimal(12,2)", False)]),
        ("tbl_stg_sap_bkpf", "bkpf", "src_sap_erp", "sap", [("belnr", "string", True), ("bukrs", "string", True), ("gjahr", "int", True), ("bldat", "date", False)]),
        ("tbl_stg_sap_bseg", "bseg", "src_sap_erp", "sap", [("belnr", "string", True), ("bukrs", "string", True), ("gjahr", "int", True), ("buzei", "int", True), ("dmbtr", "decimal(14,2)", False)]),
        ("tbl_stg_sfdc_accounts", "account", "src_salesforce_crm", "salesforce", [("id", "string", True), ("name", "string", False), ("type", "string", False), ("industry", "string", False), ("annualrevenue", "decimal(14,2)", False)]),
        ("tbl_stg_sfdc_opps", "opportunity", "src_salesforce_crm", "salesforce", [("id", "string", True), ("accountid", "string", False), ("stagename", "string", False), ("amount", "decimal(14,2)", False), ("closedate", "date", False)]),
        ("tbl_stg_sfdc_contacts", "contact", "src_salesforce_crm", "salesforce", [("id", "string", True), ("accountid", "string", False), ("email", "string", False), ("title", "string", False)]),
        ("tbl_stg_evo_packout", "packout", "src_evo_warehouse", "evo", [("packout_id", "string", True), ("order_number", "string", False), ("shipper_sku", "string", False), ("qc_status", "string", False)]),
        ("tbl_stg_evo_shipments", "shipments", "src_evo_warehouse", "evo", [("shipment_id", "string", True), ("tracking_no", "string", False), ("carrier", "string", False), ("ship_date", "date", False)]),
        ("tbl_stg_cod_rentals", "rentals", "src_cod_rental", "cod", [("rental_id", "string", True), ("serial_no", "string", False), ("customer_id", "string", False), ("daily_rate", "decimal(8,2)", False)]),
        ("tbl_stg_nanocool", "telemetry", "src_nanocool_iot", "nanocool", [("reading_id", "string", True), ("device_id", "string", False), ("temp_c", "decimal(5,2)", False), ("battery_pct", "int", False)]),
    ]

    stg_schemas: set[str] = set()
    for tid, tname, src_id, s_schema, cols in stg_tables:
        schema_id = f"schema_stg_{s_schema}"
        if schema_id not in stg_schemas:
            stg_schemas.add(schema_id)
            add_node(g, schema_id, f"lh_stg.{s_schema}", "schema", "staging", parent_id=src_id, radius=12.5, desc=f"[lh_stg].[{s_schema}] — Raw Staging Schema")
            add_edge(g, src_id, schema_id, "FEEDS", desc=f"CDC Stream: {src_id} -> [lh_stg].[{s_schema}]", cross_layer=True)
        desc = f"[lh_stg].[{s_schema}].[{tname}] — Raw Staging Delta Table"
        add_node(g, tid, tname, "table", "staging", parent_id=schema_id, radius=6.8, desc=desc)
        add_edge(g, schema_id, tid, "CONTAINS", desc=f"Schema [lh_stg].[{s_schema}] contains [{tname}]")
        for cname, dtype, is_pk in cols:
            cid = f"col_{tid}_{cname}"
            add_node(g, cid, cname, "column", "staging", parent_id=tid, data_type=dtype, is_pk=is_pk, radius=3.0, desc=f"[{s_schema}].[{tname}].[{cname}] ({dtype})")
            add_edge(g, tid, cid, "CONTAINS", desc=f"{dtype}")

    # 3. Silver Dimensions & Facts from SQL DDLs (with explicit dim & fact schemas)
    add_node(g, "schema_silver_dim", "wh_silver.dim", "schema", "silver", radius=13.0, desc="[wh_silver].[dim] — Conformed Dimension Schema")
    add_node(g, "schema_silver_fact", "wh_silver.fact", "schema", "silver", radius=13.0, desc="[wh_silver].[fact] — Conformed Fact Schema")
    dim_dir = os.path.join(WH_PATH, "dim", "Tables")
    fact_dir = os.path.join(WH_PATH, "fact", "Tables")

    dim_files = [
        "customer.sql", "account.sql", "material.sql", "company.sql", "country.sql",
        "equipment.sql", "contract.sql", "locations.sql", "location_all.sql", "master_vin.sql",
        "calendar.sql", "bom.sql", "certifications.sql", "part.sql", "group.sql",
        "pipeline_stage_mapping.sql", "material_volume_updated.sql", "sales_org.sql",
        "site.sql", "program.sql", "services_sub_type.sql", "customer_erp.sql",
        "customer_mapping.sql", "customer_master_data_partner_function.sql", "vins.sql",
        "price_mechanism_hierarchy.sql", "user_crm.sql"
    ]

    fact_files = [
        "sales_order.sql", "sales_order_line.sql", "invoice.sql", "invoice_line.sql",
        "bookings.sql", "opportunities.sql", "opportunity_line.sql", "demand.sql",
        "inventory.sql", "cod_orders.sql", "cod_rental.sql", "cod_tracker.sql",
        "purchase_order_delivery_history.sql", "packout_cgo.sql", "proe_transactions.sql",
        "proe_shipped.sql", "transfer_logs.sql", "tic_conditioning_forms.sql",
        "price_override.sql", "report_shipped.sql", "service_order.sql",
        "service_order_line.sql", "fx_rates.sql", "open_order.sql", "case.sql",
        "ontime_shipment.sql", "material_consumption.sql", "material_costs.sql"
    ]

    for df in dim_files:
        tname = df[:-4]
        tid = f"tbl_dim_{tname}"
        add_node(g, tid, f"dim_{tname}", "table", "silver", parent_id="schema_silver_dim", radius=6.8, desc=f"[wh_silver].[dim].[{tname}] — Conformed Dimension")
        add_edge(g, "schema_silver_dim", tid, "CONTAINS", desc="[wh_silver].[dim] contains table")
        cols = _parse_ddl_cols(os.path.join(dim_dir, df), max_cols=9)
        for cname, ctype, is_pk in cols:
            cid = f"col_dim_{tname}_{cname}"
            add_node(g, cid, cname, "column", "silver", parent_id=tid, data_type=ctype, is_pk=is_pk, radius=3.0, desc=f"[dim].[{tname}].[{cname}] ({ctype})")
            add_edge(g, tid, cid, "CONTAINS", desc=f"{ctype}")

    for ff in fact_files:
        tname = ff[:-4]
        tid = f"tbl_fact_{tname}"
        add_node(g, tid, f"fact_{tname}", "table", "silver", parent_id="schema_silver_fact", radius=6.8, desc=f"[wh_silver].[fact].[{tname}] — Conformed Fact")
        add_edge(g, "schema_silver_fact", tid, "CONTAINS", desc="[wh_silver].[fact] contains table")
        cols = _parse_ddl_cols(os.path.join(fact_dir, ff), max_cols=9)
        for cname, ctype, is_pk in cols:
            cid = f"col_fact_{tname}_{cname}"
            add_node(g, cid, cname, "column", "silver", parent_id=tid, data_type=ctype, is_pk=is_pk, radius=3.0, desc=f"[fact].[{tname}].[{cname}] ({ctype})")
            add_edge(g, tid, cid, "CONTAINS", desc=f"{ctype}")

    # Staging Table -> Silver Schema/Table Lineage Bridges
    stg_to_silver = [
        ("tbl_stg_sap_vbak", "tbl_fact_sales_order", "Pipeline: SAP VBAK -> fact_sales_order"),
        ("tbl_stg_sap_vbap", "tbl_fact_sales_order_line", "Pipeline: SAP VBAP -> fact_sales_order_line"),
        ("tbl_stg_sap_vbrk", "tbl_fact_invoice", "Pipeline: SAP VBRK -> fact_invoice"),
        ("tbl_stg_sap_vbrp", "tbl_fact_invoice_line", "Pipeline: SAP VBRP -> fact_invoice_line"),
        ("tbl_stg_sap_kna1", "tbl_dim_customer", "Pipeline: SAP KNA1 -> dim_customer"),
        ("tbl_stg_sap_mara", "tbl_dim_material", "Pipeline: SAP MARA -> dim_material"),
        ("tbl_stg_sfdc_accounts", "tbl_dim_account", "Pipeline: SFDC Account -> dim_account"),
        ("tbl_stg_sfdc_opps", "tbl_fact_opportunities", "Pipeline: SFDC Opportunity -> fact_opportunities"),
        ("tbl_stg_evo_packout", "tbl_fact_packout_cgo", "Pipeline: EVO Packout -> fact_packout_cgo"),
        ("tbl_stg_evo_shipments", "tbl_fact_ontime_shipment", "Pipeline: EVO Shipments -> fact_ontime_shipment"),
        ("tbl_stg_cod_rentals", "tbl_fact_cod_rental", "Pipeline: COD Rentals -> fact_cod_rental"),
        ("tbl_stg_nanocool", "tbl_fact_tic_conditioning_forms", "Pipeline: NanoCool Telemetry -> fact_tic_conditioning_forms"),
    ]
    for stg_id, silv_id, ldesc in stg_to_silver:
        if stg_id in g and silv_id in g:
            add_edge(g, stg_id, silv_id, "FEEDS", desc=ldesc, cross_layer=True)

    # 4. Reporting Warehouse Schemas & BI Semantic Models
    gold_items = [
        ("mart_wh_report", "wh_report", "schema", "reporting", "[wh_report] — Reporting Warehouse Schema / Mart"),
        ("sm_price_overrides", "Price Overrides SemanticModel", "notebook", "bi", "Power BI DirectLake Semantic Model"),
        ("sm_sales_scorecard", "Sales KPI Scorecard", "notebook", "bi", "Executive Commercial Revenue Model"),
        ("sm_report_usage", "mdl_report_usage", "notebook", "bi", "Fabric Capacity & Report Telemetry Model"),
    ]
    for gid, gname, gtype, glayer, gdesc in gold_items:
        rad = 13.0 if gtype == "schema" else 8.5
        add_node(g, gid, gname, gtype, glayer, radius=rad, desc=gdesc)

    # 5. BI Metrics & KPIs
    metrics = [
        ("m_gross_margin", "Gross Margin %", "AVG(gross_margin_usd / net_sales_usd)", "tbl_fact_sales_order_line"),
        ("m_net_sales", "Net Sales Revenue USD", "SUM(line_net_usd)", "tbl_fact_sales_order_line"),
        ("m_otif_rate", "OTIF Shipment Rate %", "COUNT(ontime_shipments) / COUNT(total_shipments)", "tbl_fact_ontime_shipment"),
        ("m_excursion_rate", "Excursion Rate %", "COUNT(temp_excursions) / COUNT(active_trips)", "tbl_fact_tic_conditioning_forms"),
        ("m_rental_util", "Rental Asset Utilization %", "SUM(rented_days) / SUM(available_days)", "tbl_fact_cod_rental"),
        ("m_pipeline_win", "Pipeline Win Rate %", "SUM(won_opps) / SUM(closed_opps)", "tbl_fact_opportunities"),
        ("m_active_arr", "Active Customer ARR", "SUM(contract_annual_value)", "tbl_dim_contract"),
        ("m_price_var", "Price-Volume Variance USD", "(actual_price - baseline_price) * volume", "tbl_fact_price_override"),
    ]
    for mid, mname, mlogic, src_table in metrics:
        add_node(g, mid, mname, "metric", "bi", radius=4.5, desc=f"Metric: {mlogic}")
        if src_table in g:
            add_edge(g, src_table, mid, "AGGREGATES", desc=mlogic, cross_layer=True)

    # 6. Column-Level Lineage & Transformations
    lineage_mappings = [
        ("col_tbl_stg_sap_vbak_vbeln", "col_fact_sales_order_sales_document", "CAST(vbeln AS INT)"),
        ("col_tbl_stg_sap_vbak_erdat", "col_fact_sales_order_order_created_date", "CAST(erdat AS DATE)"),
        ("col_tbl_stg_sap_vbak_kunnr", "col_dim_customer_sap_customer", "UPPER(TRIM(kunnr))"),
        ("col_tbl_stg_sap_vbap_matnr", "col_dim_material_material_number", 'LPAD(matnr, 18, "0")'),
        ("col_tbl_stg_sfdc_accounts_id", "col_dim_account_id", "TRIM(id)"),
        ("col_tbl_stg_sfdc_opps_amount", "col_fact_opportunities_amount", "COALESCE(amount, 0)"),
        ("col_tbl_stg_cod_rentals_serial_no", "col_dim_equipment_serial_no", "UPPER(serial_no)"),
        ("col_tbl_stg_nanocool_temp_c", "col_fact_tic_conditioning_forms_temperature", "ROUND(temp_c, 1)"),
    ]
    for sc, tc, expr in lineage_mappings:
        if sc in g and tc in g:
            add_edge(g, sc, tc, "TRANSFORMS_TO", desc=expr, cross_layer=True)

    # 7. Automated Semantic Foreign Key Joins across Facts and Dimensions
    dim_target_cols: dict[str, list[str]] = {
        "customer": ["customer_key", "sap_customer", "sold_to_party", "customer_id", "customer"],
        "material": ["material_key", "material_number", "material", "sku", "material_sku"],
        "company": ["company_code", "company_key"],
        "calendar": ["order_created_date", "date", "posting_date", "changed_on_date"],
        "account": ["account_id", "account"],
        "equipment": ["equipment_id", "serial_no", "equipment_key"],
        "locations": ["location_id", "plant", "site_id"],
        "master_vin": ["master_vin", "vin"],
        "country": ["country_code", "country"],
        "contract": ["contract_id", "contract_number"],
    }

    for ff in fact_files:
        f_path = os.path.join(fact_dir, ff)
        if not os.path.exists(f_path):
            continue
        try:
            with open(f_path, "r", encoding="utf-8", errors="ignore") as fh:
                f_content = fh.read().lower()
        except Exception:
            continue
        ft = f"tbl_fact_{ff[:-4]}"
        if ft not in g:
            continue
        for dim_name, target_cols in dim_target_cols.items():
            dt = f"tbl_dim_{dim_name}"
            if dt not in g:
                continue
            for tc in target_cols:
                if re.search(r"\b" + tc + r"\b", f_content):
                    add_edge(g, ft, dt, "JOINS_WITH", desc=f"FK Join: {tc} -> dim_{dim_name}")
                    break

    # 8. Stored Procedure & DirectLake Model Cross-Dependencies
    sp_deps = [
        ("tbl_dim_account", "tbl_dim_customer", "sp_dim_customer (SCD Type 1 Sync)"),
        ("tbl_dim_customer", "tbl_dim_customer_mapping", "sp_customer_mapping_update"),
        ("tbl_dim_locations", "tbl_dim_master_vin", "sp_dim_master_vin (Asset Calibration)"),
        ("tbl_dim_material", "tbl_dim_master_vin", "sp_dim_master_vin (SKU BOM Mapping)"),
        ("tbl_dim_locations", "tbl_dim_vins", "sp_dim_vins (Cold-Chain Fleet Tracker)"),
        ("tbl_dim_material", "tbl_fact_bookings", "sp_fact_bookings (Pricing & Margin)"),
        ("tbl_dim_material", "tbl_fact_invoice_line", "sp_fact_invoice_line (Billing Validation)"),
        ("tbl_dim_material", "tbl_fact_open_order", "sp_fact_open_order (Fulfillment Queue)"),
        ("tbl_dim_part", "tbl_fact_inventory", "sp_fact_inventory (Stock Reorder Point)"),
        ("tbl_fact_sales_order", "mart_wh_report", "DirectLake Sync: wh_report"),
        ("tbl_fact_invoice_line", "mart_wh_report", "DirectLake Sync: wh_report"),
        ("tbl_fact_opportunities", "sm_sales_scorecard", "Pipeline DirectLake: Sales KPI Scorecard"),
        ("tbl_fact_price_override", "sm_price_overrides", "Pricing DirectLake: Price Overrides"),
    ]
    for s_tbl, t_tbl, sp_desc in sp_deps:
        if s_tbl in g and t_tbl in g:
            add_edge(g, s_tbl, t_tbl, "DEPENDS_ON", desc=sp_desc, cross_layer=True)

    _CACHED_GRAPH = g
    return g
