"""
app/tests/test_sql_transpiler.py
--------------------------------
Unit tests for SQL transpilation, AST validation, and lineage extraction.
"""

import pytest
from app.sql_transpiler import (
    transpile_to_spark,
    extract_sql_lineage,
    validate_sql,
    generate_pyspark_delta_merge,
)


class TestSqlTranspilation:
    def test_transpile_tsql_top_to_spark_limit(self):
        tsql = "SELECT TOP 10 OrderID, TotalAmount FROM Sales.Orders WHERE ISNULL(Status, 'Pending') = 'Pending'"
        spark_sql = transpile_to_spark(tsql, from_dialect="tsql")
        # In Spark SQL, TOP is transpiled to LIMIT and ISNULL to COALESCE / IFNULL
        assert "LIMIT 10" in spark_sql or "limit 10" in spark_sql.lower()
        assert "COALESCE" in spark_sql or "NVL" in spark_sql or "IFNULL" in spark_sql

    def test_transpile_empty_or_whitespace(self):
        assert transpile_to_spark("") == ""
        assert transpile_to_spark("   ") == "   "


class TestSqlLineage:
    def test_extract_tables_and_columns(self):
        sql = """
        SELECT o.OrderID, o.OrderDate, c.CustomerName, p.ProductName
        FROM Sales.Orders o
        JOIN Sales.Customers c ON o.CustomerID = c.CustomerID
        JOIN Sales.Products p ON o.ProductID = p.ProductID
        WHERE o.TotalAmount > 100
        """
        lineage = extract_sql_lineage(sql, dialect="tsql")
        assert "Sales.Orders" in lineage["source_tables"] or "Orders" in lineage["source_tables"]
        assert lineage["has_joins"] is True
        assert "OrderID" in lineage["columns"]
        assert "CustomerName" in lineage["columns"]

    def test_detect_insert_operation(self):
        sql = "INSERT INTO Silver_Orders (OrderID, TotalAmount) SELECT OrderID, TotalAmount FROM Bronze_Orders"
        lineage = extract_sql_lineage(sql, dialect="tsql")
        assert lineage["operation"] == "INSERT"


class TestSqlValidation:
    def test_valid_sql_syntax(self):
        sql = "SELECT id, name, created_at FROM users WHERE status = 'active'"
        res = validate_sql(sql, dialect="tsql")
        assert res["valid"] is True
        assert res["error"] is None

    def test_invalid_sql_syntax(self):
        sql = "SELEC FROM WHERE"
        res = validate_sql(sql, dialect="tsql")
        # SQLGlot will flag syntax errors
        assert res["valid"] is False or res["error"] is not None


class TestDeltaMergeGeneration:
    def test_generate_pyspark_delta_merge(self):
        code = generate_pyspark_delta_merge(
            source_df_var="df_source",
            target_table="Orders",
            primary_key="OrderID",
            columns=["OrderID", "CustomerID", "OrderDate", "TotalAmount", "updated_at"],
            lakehouse_name="lh_sales_bronze",
        )
        assert "DeltaTable.forPath" in code
        assert "target.OrderID = source.OrderID" in code
        assert "whenMatchedUpdate" in code
        assert "whenNotMatchedInsert" in code
        assert "lh_sales_bronze" in code
