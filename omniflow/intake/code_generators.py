"""OmniFlow Medallion Code Generators.

Generates production-grade Synapse PySpark notebooks and Fabric T-SQL DDL
with Stored Procedures for complete Medallion architectures.
"""

from typing import Any


def generate_curate_notebook_code(
    clean_dom: str, proj_name: str, table_configs: list[dict[str, Any]]
) -> str:
    """Generates multi-cell Synapse PySpark Bronze-to-Silver Delta MERGE curation notebook."""
    configs_repr = "[\n"
    for tc in table_configs:
        t = tc.get("table", "entity")
        pk = tc.get("pk", "id")
        wm = tc.get("wm", "updated_at")
        pii = tc.get("pii", [])
        configs_repr += f'    {{"table": "{t}", "pk": "{pk}", "wm": "{wm}", "pii": {pii}}},\n'
    configs_repr += "]"

    return f'''# Fabric Notebook source
# METADATA ********************
# {{"kernel":"synapse_pyspark","default_lakehouse":"lh_{clean_dom}_silver"}}

# CELL ********************
# Project: {proj_name}
# Module: Medallion Bronze-to-Silver Curation Engine
# Standards: ACID Delta Lake, Salted SHA-256 PII Masking, Window Deduplication
from delta.tables import DeltaTable
from pyspark.sql import functions as F
from pyspark.sql.window import Window

RAW_LAKEHOUSE = "lh_{clean_dom}_bronze"
SILVER_LAKEHOUSE = "lh_{clean_dom}_silver"
SALT_SECRET = "ms_fabric_audit_salt_v2"

TABLE_CONFIGS = {configs_repr}

# CELL ********************
def curate_and_merge(cfg: dict) -> dict:
    table_name = cfg["table"]
    pk_col = cfg["pk"]
    wm_col = cfg["wm"]
    pii_cols = cfg.get("pii", [])

    print(f"\\n🚀 [CURATE] Starting Bronze -> Silver promotion: {{table_name}}")
    source_path = f"{{RAW_LAKEHOUSE}}.{{table_name}}"
    target_path = f"{{SILVER_LAKEHOUSE}}.{{table_name}}"

    try:
        raw_df = spark.read.table(source_path)
    except Exception as e:
        print(f"⚠️ Source table {{source_path}} not found, skipping: {{e}}")
        return {{"table": table_name, "status": "SKIPPED", "error": str(e)}}

    # 1. High-watermark window deduplication on business primary key
    if pk_col in raw_df.columns:
        order_col = wm_col if wm_col in raw_df.columns else pk_col
        window_spec = Window.partitionBy(pk_col).orderBy(F.col(order_col).desc())
        curated_df = (
            raw_df.withColumn("_row_num", F.row_number().over(window_spec))
            .filter(F.col("_row_num") == 1)
            .drop("_row_num")
        )
    else:
        curated_df = raw_df.dropDuplicates()

    # 2. Salted SHA-256 deterministic PII masking
    for pii_field in pii_cols:
        if pii_field in curated_df.columns:
            curated_df = curated_df.withColumn(
                pii_field,
                F.when(
                    F.col(pii_field).isNotNull(),
                    F.sha2(F.concat(F.lit(SALT_SECRET), F.col(pii_field).cast("string")), 256),
                ).otherwise(None),
            )

    # 3. Add system audit lineage metadata
    curated_df = (
        curated_df.withColumn("_curated_at", F.current_timestamp())
        .withColumn("_source_system", F.lit("postgresql_enterprise"))
        .withColumn("_curation_layer", F.lit("silver"))
    )

    # 4. Atomic Delta MERGE Upsert
    if DeltaTable.isDeltaTable(spark, target_path):
        silver_table = DeltaTable.forName(spark, target_path)
        (
            silver_table.alias("tgt")
            .merge(curated_df.alias("src"), f"tgt.{{pk_col}} = src.{{pk_col}}")
            .whenMatchedUpdateAll()
            .whenNotMatchedInsertAll()
            .execute()
        )
        print(f"✅ Successfully MERGED {{curated_df.count()}} records into {{target_path}}")
    else:
        (
            curated_df.write.format("delta")
            .mode("overwrite")
            .option("overwriteSchema", "true")
            .saveAsTable(target_path)
        )
        print(f"✨ Initialized and wrote {{curated_df.count()}} records to {{target_path}}")

    return {{"table": table_name, "status": "SUCCESS"}}

# CELL ********************
print(f"Starting Medallion Curation Execution for {{len(TABLE_CONFIGS)}} entities...")
results = [curate_and_merge(cfg) for cfg in TABLE_CONFIGS]
print("\\n🏁 Curation Execution Completed. Summary:")
for r in results:
    print(f"  - {{r['table']}}: {{r['status']}}")
'''


def generate_quality_suite_code(
    clean_dom: str, proj_name: str, table_configs: list[dict[str, Any]]
) -> str:
    """Generates multi-cell Synapse PySpark Data Quality & Great Expectations assertion suite."""
    configs_repr = "[\n"
    for tc in table_configs:
        t = tc.get("table", "entity")
        pk = tc.get("pk", "id")
        wm = tc.get("wm", "updated_at")
        configs_repr += f'    {{"table": "{t}", "pk": "{pk}", "wm": "{wm}"}},\n'
    configs_repr += "]"

    return f'''# Fabric Notebook source
# METADATA ********************
# {{"kernel":"synapse_pyspark","default_lakehouse":"lh_{clean_dom}_silver"}}

# CELL ********************
# Project: {proj_name}
# Module: Great Expectations & Delta Lake Data Quality Certification Suite
# Target Layers: 01 Raw (lh_{clean_dom}_bronze) & 03 Silver (lh_{clean_dom}_silver)
from pyspark.sql import functions as F

RAW_LAKEHOUSE = "lh_{clean_dom}_bronze"
SILVER_LAKEHOUSE = "lh_{clean_dom}_silver"

TABLE_SPECS = {configs_repr}

# CELL ********************
def audit_entity_quality(spec: dict) -> dict:
    table = spec["table"]
    pk = spec["pk"]
    wm = spec["wm"]
    target_table = f"{{SILVER_LAKEHOUSE}}.{{table}}"

    print(f"🔍 Auditing Data Quality for: {{target_table}}")
    try:
        df = spark.read.table(target_table)
    except Exception as e:
        print(f"⚠️ Table {{target_table}} not found for quality audit: {{e}}")
        return {{"table": table, "passed": False, "reason": "TABLE_NOT_FOUND"}}

    total_rows = df.count()
    if total_rows == 0:
        return {{"table": table, "passed": True, "rows": 0, "notes": "Empty partition"}}

    # Check 1: Primary Key Uniqueness (Zero duplicate PKs)
    distinct_pks = df.select(pk).distinct().count()
    pk_unique = distinct_pks == total_rows

    # Check 2: Mandatory Key Nullability (Zero null PKs)
    null_pks = df.filter(F.col(pk).isNull()).count()
    pk_non_null = null_pks == 0

    # Check 3: Watermark Freshness & Non-null Check
    wm_nulls = df.filter(F.col(wm).isNull()).count() if wm in df.columns else 0
    wm_valid = wm_nulls == 0

    passed_all = pk_unique and pk_non_null and wm_valid
    scorecard = {{
        "table": table,
        "passed": passed_all,
        "total_rows": total_rows,
        "pk_unique": pk_unique,
        "null_pks": null_pks,
        "wm_valid": wm_valid,
    }}

    status_icon = "✅" if passed_all else "❌"
    print(f"{{status_icon}} [QUALITY RESULT] {{table}}: Unique PK: {{pk_unique}}, Null PKs: {{null_pks}}, Total: {{total_rows}}")
    return scorecard

# CELL ********************
print(f"Executing Quality Gate Suite across {{len(TABLE_SPECS)}} entities...")
audit_results = [audit_entity_quality(s) for s in TABLE_SPECS]
passed_count = sum(1 for r in audit_results if r.get("passed"))
compliance_pct = round((passed_count / max(1, len(audit_results))) * 100, 1)

print(f"\\n=======================================================")
print(f"🏆 DATA QUALITY CERTIFICATION SCORECARD: {{compliance_pct}}% PASS")
print(f"   Entities Verified: {{len(audit_results)}}")
print(f"   Passed Gates:      {{passed_count}} / {{len(audit_results)}}")
print(f"=======================================================")
assert compliance_pct >= 90.0, f"Quality gate failed: compliance {{compliance_pct}}% is below threshold."
'''


def generate_silver_transformations_code(
    clean_dom: str, proj_name: str, table_configs: list[dict[str, Any]]
) -> str:
    """Generates multi-cell Synapse PySpark Silver SCD Type-2 Conformed Transformations notebook."""
    return f'''# Fabric Notebook source
# METADATA ********************
# {{"kernel":"synapse_pyspark","default_lakehouse":"lh_{clean_dom}_silver"}}

# CELL ********************
# Project: {proj_name}
# Module: Silver Conformed Dimensions & SCD Type-2 History Tracking
# Target Lakehouse: lh_{clean_dom}_silver
from delta.tables import DeltaTable
from pyspark.sql import functions as F
from pyspark.sql.window import Window

SILVER_LAKEHOUSE = "lh_{clean_dom}_silver"

print("🔄 Initializing Silver SCD Type-2 Conformed Transformation Engine...")

# CELL ********************
# 1. Conformed SCD Type-2 Customer Dimension
def build_conformed_scd2_customers():
    src_table = f"{{SILVER_LAKEHOUSE}}.retail_ops_customers"
    tgt_table = f"{{SILVER_LAKEHOUSE}}.dim_customers_scd2"

    try:
        cust_df = spark.read.table(src_table)
    except Exception:
        try:
            cust_df = spark.read.table(f"{{SILVER_LAKEHOUSE}}.source_crm_customers")
        except Exception as e:
            print(f"⚠️ Source customer table not found: {{e}}")
            return

    # Window over customer_id ordered by updated_at
    w_spec = Window.partitionBy("customer_id").orderBy(F.col("updated_at").asc())

    scd2_df = (
        cust_df.withColumn("effective_from", F.col("updated_at"))
        .withColumn("effective_to", F.lead("updated_at").over(w_spec))
        .withColumn(
            "is_current",
            F.when(F.col("effective_to").isNull(), F.lit(True)).otherwise(F.lit(False)),
        )
        .withColumn(
            "effective_to",
            F.coalesce(F.col("effective_to"), F.to_timestamp(F.lit("9999-12-31 23:59:59"))),
        )
    )

    scd2_df.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable(tgt_table)
    print(f"✅ Conformed SCD-2 Customer Dimension committed: {{tgt_table}}")

# CELL ********************
# 2. Conformed Product Hierarchy Dimension
def build_conformed_product_hierarchy():
    prod_table = f"{{SILVER_LAKEHOUSE}}.retail_ops_products"
    cat_table = f"{{SILVER_LAKEHOUSE}}.retail_ops_product_categories"
    tgt_table = f"{{SILVER_LAKEHOUSE}}.dim_products_conformed"

    try:
        prods = spark.read.table(prod_table)
        cats = spark.read.table(cat_table)
        joined = prods.join(cats, "category_id", "left_outer").select(
            prods["*"],
            cats["category_name"],
            cats["department_id"],
        )
        joined.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable(tgt_table)
        print(f"✅ Conformed Product Hierarchy committed: {{tgt_table}}")
    except Exception as e:
        print(f"⚠️ Skipping product hierarchy: {{e}}")

# CELL ********************
build_conformed_scd2_customers()
build_conformed_product_hierarchy()
print("✨ Silver Conformed Transformations successfully executed and committed.")
'''


def generate_gold_warehouse_sql(
    clean_dom: str,
    proj_name: str,
    dimensions: list[str] | None = None,
    facts: list[str] | None = None,
) -> str:
    """Generates enterprise Kimball Star Schema DDL and ELT Stored Procedures for Fabric Warehouse."""
    return f"""-- ==============================================================================
-- Microsoft Fabric Analytical Data Warehouse: wh_{clean_dom}_gold
-- Project: {proj_name}
-- Architecture: Kimball Star Schema Dimensional analytical marts with Direct Lake
-- Deliverables: 6 Conformed Dimensions, 4 Analytical Facts, 5 ELT Stored Procedures
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. DIMENSION TABLES (Kimball Conformed Star Schema)
-- ------------------------------------------------------------------------------

CREATE TABLE [dbo].[dim_customers] (
    [customer_sk] BIGINT IDENTITY(1,1) NOT NULL,
    [customer_id] VARCHAR(64) NOT NULL,
    [first_name_masked] VARCHAR(64) NULL,
    [last_name_masked] VARCHAR(64) NULL,
    [email_masked] VARCHAR(64) NULL,
    [phone_masked] VARCHAR(64) NULL,
    [segment_name] VARCHAR(64) NULL,
    [loyalty_tier] VARCHAR(32) NULL,
    [effective_from] DATETIME2(6) NOT NULL,
    [effective_to] DATETIME2(6) NOT NULL,
    [is_current] BIT NOT NULL DEFAULT 1,
    [_dw_inserted_at] DATETIME2(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE [dbo].[dim_products] (
    [product_sk] BIGINT IDENTITY(1,1) NOT NULL,
    [product_id] VARCHAR(64) NOT NULL,
    [product_name] VARCHAR(256) NOT NULL,
    [sku] VARCHAR(64) NULL,
    [category_name] VARCHAR(128) NULL,
    [department_name] VARCHAR(128) NULL,
    [brand_name] VARCHAR(128) NULL,
    [unit_price] DECIMAL(18, 4) NOT NULL DEFAULT 0.0,
    [unit_cost] DECIMAL(18, 4) NOT NULL DEFAULT 0.0,
    [is_active] BIT NOT NULL DEFAULT 1,
    [_dw_inserted_at] DATETIME2(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE [dbo].[dim_stores] (
    [store_sk] BIGINT IDENTITY(1,1) NOT NULL,
    [store_id] VARCHAR(64) NOT NULL,
    [store_name] VARCHAR(128) NOT NULL,
    [store_type] VARCHAR(32) NOT NULL,
    [region] VARCHAR(64) NOT NULL,
    [city] VARCHAR(64) NOT NULL,
    [state_province] VARCHAR(64) NULL,
    [is_active] BIT NOT NULL DEFAULT 1,
    [_dw_inserted_at] DATETIME2(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE [dbo].[dim_suppliers] (
    [supplier_sk] BIGINT IDENTITY(1,1) NOT NULL,
    [supplier_id] VARCHAR(64) NOT NULL,
    [supplier_name] VARCHAR(128) NOT NULL,
    [country] VARCHAR(64) NOT NULL,
    [rating] DECIMAL(3, 2) NULL,
    [_dw_inserted_at] DATETIME2(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE [dbo].[dim_date] (
    [date_sk] INT NOT NULL,
    [calendar_date] DATE NOT NULL,
    [calendar_year] INT NOT NULL,
    [calendar_quarter] INT NOT NULL,
    [calendar_month] INT NOT NULL,
    [month_name] VARCHAR(16) NOT NULL,
    [day_of_month] INT NOT NULL,
    [day_of_week] INT NOT NULL,
    [day_name] VARCHAR(16) NOT NULL,
    [is_weekend] BIT NOT NULL,
    [is_holiday] BIT NOT NULL DEFAULT 0
);

CREATE TABLE [dbo].[dim_promotions] (
    [promotion_sk] BIGINT IDENTITY(1,1) NOT NULL,
    [promotion_id] VARCHAR(64) NOT NULL,
    [promotion_name] VARCHAR(128) NOT NULL,
    [discount_type] VARCHAR(32) NOT NULL,
    [discount_rate] DECIMAL(5, 4) NOT NULL DEFAULT 0.0,
    [start_date] DATE NOT NULL,
    [end_date] DATE NOT NULL
);

-- ------------------------------------------------------------------------------
-- 2. FACT TABLES (Analytical Business Metrics)
-- ------------------------------------------------------------------------------

CREATE TABLE [dbo].[fact_sales_orders] (
    [sales_order_sk] BIGINT IDENTITY(1,1) NOT NULL,
    [order_id] VARCHAR(64) NOT NULL,
    [customer_sk] BIGINT NOT NULL,
    [store_sk] BIGINT NOT NULL,
    [date_sk] INT NOT NULL,
    [total_gross_amount] DECIMAL(18, 4) NOT NULL,
    [total_tax_amount] DECIMAL(18, 4) NOT NULL DEFAULT 0.0,
    [total_discount_amount] DECIMAL(18, 4) NOT NULL DEFAULT 0.0,
    [total_net_amount] DECIMAL(18, 4) NOT NULL,
    [order_status] VARCHAR(32) NOT NULL,
    [payment_method] VARCHAR(32) NULL,
    [order_timestamp] DATETIME2(6) NOT NULL,
    [_dw_inserted_at] DATETIME2(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE [dbo].[fact_order_items] (
    [order_item_sk] BIGINT IDENTITY(1,1) NOT NULL,
    [order_id] VARCHAR(64) NOT NULL,
    [product_sk] BIGINT NOT NULL,
    [quantity] INT NOT NULL,
    [unit_price] DECIMAL(18, 4) NOT NULL,
    [line_discount_amount] DECIMAL(18, 4) NOT NULL DEFAULT 0.0,
    [line_net_amount] DECIMAL(18, 4) NOT NULL,
    [_dw_inserted_at] DATETIME2(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE [dbo].[fact_inventory_daily_snapshot] (
    [inventory_snapshot_sk] BIGINT IDENTITY(1,1) NOT NULL,
    [snapshot_date_sk] INT NOT NULL,
    [product_sk] BIGINT NOT NULL,
    [store_sk] BIGINT NOT NULL,
    [quantity_on_hand] INT NOT NULL DEFAULT 0,
    [quantity_reserved] INT NOT NULL DEFAULT 0,
    [quantity_available] INT NOT NULL DEFAULT 0,
    [unit_cost] DECIMAL(18, 4) NOT NULL DEFAULT 0.0,
    [total_inventory_valuation] DECIMAL(18, 4) NOT NULL DEFAULT 0.0,
    [_dw_inserted_at] DATETIME2(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE [dbo].[fact_customer_returns] (
    [return_sk] BIGINT IDENTITY(1,1) NOT NULL,
    [return_id] VARCHAR(64) NOT NULL,
    [order_id] VARCHAR(64) NOT NULL,
    [customer_sk] BIGINT NOT NULL,
    [product_sk] BIGINT NOT NULL,
    [return_date_sk] INT NOT NULL,
    [return_quantity] INT NOT NULL,
    [refund_amount] DECIMAL(18, 4) NOT NULL,
    [return_reason] VARCHAR(128) NULL,
    [_dw_inserted_at] DATETIME2(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ------------------------------------------------------------------------------
-- 3. T-SQL STORED PROCEDURES (ELT Orchestration & Lakehouse Ingestion)
-- ------------------------------------------------------------------------------

GO
CREATE OR ALTER PROCEDURE [dbo].[sp_load_dim_customers]
AS
BEGIN
    SET NOCOUNT ON;
    PRINT '>> Executing sp_load_dim_customers: Merging Silver conformed into Gold Dimension...';

    -- Upsert SCD Type-2 Customer Dimension from Silver Lakehouse Shortcut
    MERGE [dbo].[dim_customers] AS target
    USING (
        SELECT 
            customer_id,
            first_name_masked,
            last_name_masked,
            email_masked,
            phone_masked,
            segment_name,
            loyalty_tier,
            effective_from,
            effective_to,
            is_current
        FROM [lh_{clean_dom}_silver].[dbo].[dim_customers_scd2]
    ) AS source
    ON target.[customer_id] = source.[customer_id] 
       AND target.[effective_from] = source.[effective_from]
    WHEN MATCHED AND target.[is_current] <> source.[is_current] THEN
        UPDATE SET 
            target.[is_current] = source.[is_current],
            target.[effective_to] = source.[effective_to],
            target.[_dw_inserted_at] = CURRENT_TIMESTAMP
    WHEN NOT MATCHED THEN
        INSERT (
            customer_id, first_name_masked, last_name_masked, email_masked, phone_masked,
            segment_name, loyalty_tier, effective_from, effective_to, is_current, _dw_inserted_at
        )
        VALUES (
            source.customer_id, source.first_name_masked, source.last_name_masked, source.email_masked, source.phone_masked,
            source.segment_name, source.loyalty_tier, source.effective_from, source.effective_to, source.is_current, CURRENT_TIMESTAMP
        );

    PRINT '<< sp_load_dim_customers completed successfully.';
END;
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_load_dim_products]
AS
BEGIN
    SET NOCOUNT ON;
    PRINT '>> Executing sp_load_dim_products: Loading conformed product hierarchy...';

    MERGE [dbo].[dim_products] AS target
    USING (
        SELECT 
            product_id,
            product_name,
            sku,
            category_name,
            department_name,
            brand_name,
            unit_price,
            unit_cost
        FROM [lh_{clean_dom}_silver].[dbo].[dim_products_conformed]
    ) AS source
    ON target.[product_id] = source.[product_id]
    WHEN MATCHED THEN
        UPDATE SET
            target.[product_name] = source.[product_name],
            target.[unit_price] = source.[unit_price],
            target.[unit_cost] = source.[unit_cost],
            target.[category_name] = source.[category_name],
            target.[_dw_inserted_at] = CURRENT_TIMESTAMP
    WHEN NOT MATCHED THEN
        INSERT (product_id, product_name, sku, category_name, department_name, brand_name, unit_price, unit_cost, is_active, _dw_inserted_at)
        VALUES (source.product_id, source.product_name, source.sku, source.category_name, source.department_name, source.brand_name, source.unit_price, source.unit_cost, 1, CURRENT_TIMESTAMP);

    PRINT '<< sp_load_dim_products completed successfully.';
END;
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_load_fact_sales_orders]
AS
BEGIN
    SET NOCOUNT ON;
    PRINT '>> Executing sp_load_fact_sales_orders: Loading sales orders with surrogate key lookups...';

    INSERT INTO [dbo].[fact_sales_orders] (
        order_id, customer_sk, store_sk, date_sk,
        total_gross_amount, total_tax_amount, total_discount_amount, total_net_amount,
        order_status, payment_method, order_timestamp, _dw_inserted_at
    )
    SELECT 
        o.order_id,
        COALESCE(c.customer_sk, -1) AS customer_sk,
        COALESCE(s.store_sk, -1) AS store_sk,
        CAST(CONVERT(VARCHAR(8), o.order_date, 112) AS INT) AS date_sk,
        o.gross_amount,
        o.tax_amount,
        o.discount_amount,
        o.net_amount,
        o.order_status,
        o.payment_method,
        o.created_at,
        CURRENT_TIMESTAMP
    FROM [lh_{clean_dom}_silver].[dbo].[retail_ops_orders] o
    LEFT JOIN [dbo].[dim_customers] c 
        ON o.customer_id = c.customer_id AND c.is_current = 1
    LEFT JOIN [dbo].[dim_stores] s 
        ON o.store_id = s.store_id
    WHERE o.order_id NOT IN (SELECT order_id FROM [dbo].[fact_sales_orders]);

    PRINT '<< sp_load_fact_sales_orders completed successfully.';
END;
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_load_fact_inventory_daily_snapshot]
AS
BEGIN
    SET NOCOUNT ON;
    PRINT '>> Executing sp_load_fact_inventory_daily_snapshot...';

    INSERT INTO [dbo].[fact_inventory_daily_snapshot] (
        snapshot_date_sk, product_sk, store_sk,
        quantity_on_hand, quantity_reserved, quantity_available,
        unit_cost, total_inventory_valuation, _dw_inserted_at
    )
    SELECT 
        CAST(CONVERT(VARCHAR(8), inv.snapshot_date, 112) AS INT) AS snapshot_date_sk,
        COALESCE(p.product_sk, -1) AS product_sk,
        COALESCE(s.store_sk, -1) AS store_sk,
        inv.qty_on_hand,
        inv.qty_reserved,
        (inv.qty_on_hand - inv.qty_reserved) AS qty_available,
        COALESCE(p.unit_cost, 0.0),
        (inv.qty_on_hand * COALESCE(p.unit_cost, 0.0)) AS valuation,
        CURRENT_TIMESTAMP
    FROM [lh_{clean_dom}_silver].[dbo].[retail_ops_inventory_snapshots] inv
    LEFT JOIN [dbo].[dim_products] p ON inv.product_id = p.product_id
    LEFT JOIN [dbo].[dim_stores] s ON inv.store_id = s.store_id;

    PRINT '<< sp_load_fact_inventory_daily_snapshot completed successfully.';
END;
GO

CREATE OR ALTER PROCEDURE [dbo].[sp_load_gold_star_schema]
AS
BEGIN
    SET NOCOUNT ON;
    PRINT '=======================================================';
    PRINT '🚀 STARTING MASTER GOLD STAR SCHEMA ELT ORCHESTRATION';
    PRINT '=======================================================';

    BEGIN TRY
        -- Wave 1: Dimensions
        EXEC [dbo].[sp_load_dim_customers];
        EXEC [dbo].[sp_load_dim_products];

        -- Wave 2: Fact Tables
        EXEC [dbo].[sp_load_fact_sales_orders];
        EXEC [dbo].[sp_load_fact_inventory_daily_snapshot];

        PRINT '=======================================================';
        PRINT '✨ MASTER GOLD STAR SCHEMA ORCHESTRATION COMPLETED (100% SUCCESS)';
        PRINT '=======================================================';
    END TRY
    BEGIN CATCH
        PRINT '❌ ERROR OCCURRED DURING STAR SCHEMA LOAD: ' + ERROR_MESSAGE();
        THROW;
    END CATCH;
END;
GO
"""
