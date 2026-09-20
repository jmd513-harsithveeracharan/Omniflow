---
name: fabric_warehouse_and_tsql
description: Guidelines for architecting and provisioning Microsoft Fabric Data Warehouses, T-SQL DDL tables, cross-database queries, and Stored Procedures for ELT orchestration.
---

# Fabric Data Warehouse & T-SQL Playbook (Enterprise Standard)

## 1. Architectural Principles

- **Fabric Data Warehouse (`type: "Warehouse"`)**:
  - Full ACID transaction support, native T-SQL engine, distributed columnar storage.
  - Cross-lakehouse and cross-warehouse querying supported natively via standard 3-part or 2-part T-SQL (`[WarehouseName].[SchemaName].[TableName]`).
  - Native primary keys, foreign keys (enforced for query optimization).

- **Layer Separation in Fabric Warehouse**:
  - **Staging Schema (`stg.*`)**: Fast bulk ingestion via `COPY INTO` from OneLake or Azure Storage.
  - **Conformed Schema (`dbo.*` or `silver.*`)**: Cleaned, typed tables updated via `MERGE` statements.
  - **Mart Schema (`gold.*` or `mart.*`)**: Fact and Dimension star-schema tables and indexed Views.

---

## 2. Canonical T-SQL Templates (Few-Shot Anchors)

### Canonical Table DDL (Star Schema)
```sql
-- Create Staging Table
CREATE TABLE [stg].[orders] (
    [order_id] VARCHAR(64) NOT NULL,
    [customer_id] VARCHAR(64) NOT NULL,
    [total_amount] DECIMAL(18, 2) NOT NULL,
    [order_status] VARCHAR(32) NOT NULL,
    [order_date] DATE NOT NULL,
    [_ingested_at] DATETIME2(3) DEFAULT SYSUTCDATETIME()
);

-- Create Gold Fact Table
CREATE TABLE [dbo].[fact_orders] (
    [order_sk] VARCHAR(64) NOT NULL,
    [order_id] VARCHAR(64) NOT NULL,
    [customer_id] VARCHAR(64) NOT NULL,
    [order_date] DATE NOT NULL,
    [year] INT NOT NULL,
    [month] INT NOT NULL,
    [total_amount] DECIMAL(18, 2) NOT NULL,
    CONSTRAINT PK_fact_orders PRIMARY KEY NONCLUSTERED ([order_sk]) NOT ENFORCED
);
```

### Canonical T-SQL ELT Stored Procedure (Idempotent MERGE)
```sql
CREATE PROCEDURE [dbo].[usp_transform_orders_silver]
AS
BEGIN
    SET NOCOUNT ON;

    -- Upsert Staging to Clean Silver Table
    MERGE [dbo].[dim_customers] AS target
    USING (
        SELECT DISTINCT [customer_id], [customer_name], [email]
        FROM [stg].[customers]
        WHERE [customer_id] IS NOT NULL
    ) AS source
    ON target.[customer_id] = source.[customer_id]
    WHEN MATCHED THEN
        UPDATE SET target.[customer_name] = source.[customer_name],
                   target.[email] = source.[email],
                   target.[updated_at] = SYSUTCDATETIME()
    WHEN NOT MATCHED THEN
        INSERT ([customer_id], [customer_name], [email], [created_at])
        VALUES (source.[customer_id], source.[customer_name], source.[email], SYSUTCDATETIME());
END;
```
