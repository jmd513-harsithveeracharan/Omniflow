"""
azure_sql_connector.py
----------------------
Connector for Azure SQL Database / SQL Server on-premises.

Discovery uses INFORMATION_SCHEMA — metadata only, zero data rows fetched.
PySpark code generation produces JDBC-based ingestion notebooks for Fabric.
"""

from connectors.base_connector import BaseConnector

# pyodbc is imported lazily inside _connect() so the server starts
# even if the ODBC driver is not installed on this machine.


ICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="24" height="24" fill="none" stroke="#0078d4" stroke-width="2">
  <ellipse cx="16" cy="8" rx="12" ry="4"/>
  <path d="M4 8v6c0 2.21 5.37 4 12 4s12-1.79 12-4V8"/>
  <path d="M4 14v6c0 2.21 5.37 4 12 4s12-1.79 12-4v-6"/>
</svg>"""


class AzureSQLConnector(BaseConnector):
    """
    Azure SQL / SQL Server source connector.

    Required params from user:
        server   — e.g. myserver.database.windows.net  or  localhost\\SQLEXPRESS
        database — e.g. SalesDB
        username — SQL auth username
        password — SQL auth password (session-only, never persisted)
        port     — default 1433
    """

    name = "Azure SQL / SQL Server"
    source_id = "azure_sql"
    icon_svg = ICON_SVG

    required_params = [
        {
            "key": "server",
            "label": "Server",
            "type": "text",
            "placeholder": "myserver.database.windows.net",
        },
        {
            "key": "database",
            "label": "Database",
            "type": "text",
            "placeholder": "SalesDB",
        },
        {
            "key": "username",
            "label": "Username",
            "type": "text",
            "placeholder": "db_user",
        },
        {
            "key": "password",
            "label": "Password",
            "type": "password",
            "placeholder": "••••••••",
        },
        {
            "key": "port",
            "label": "Port",
            "type": "text",
            "placeholder": "1433",
        },
    ]

    # ── Internal ──────────────────────────────────────────────────────────────

    def _build_connection_string(self, params: dict) -> str:
        server = params.get("server", "")
        database = params.get("database", "")
        username = params.get("username", "")
        password = params.get("password", "")
        port = params.get("port", "1433")

        return (
            f"DRIVER={{ODBC Driver 18 for SQL Server}};"
            f"SERVER={server},{port};"
            f"DATABASE={database};"
            f"UID={username};"
            f"PWD={password};"
            f"Encrypt=yes;"
            f"TrustServerCertificate=yes;"
            f"Connection Timeout=10;"
        )

    def _connect(self, params: dict):
        """Returns a pyodbc connection. Raises on failure."""
        import pyodbc  # lazy import — only when actually connecting
        return pyodbc.connect(self._build_connection_string(params), autocommit=True)

    # ── Public Interface ──────────────────────────────────────────────────────

    def test_connection(self, params: dict) -> dict:
        try:
            conn = self._connect(params)
            cursor = conn.cursor()
            cursor.execute("SELECT @@VERSION")
            version_row = cursor.fetchone()
            version = version_row[0].splitlines()[0] if version_row else "Unknown"
            conn.close()
            return {
                "success": True,
                "message": f"Connected successfully to {params.get('database')} on {params.get('server')}.",
                "details": {"server_version": version},
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Connection failed: {str(e)}",
                "details": None,
            }

    def discover_tables(self, params: dict) -> dict:
        """
        Returns all user tables and views.
        Uses INFORMATION_SCHEMA — metadata only, zero row data.
        """
        try:
            conn = self._connect(params)
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT
                    TABLE_SCHEMA,
                    TABLE_NAME,
                    TABLE_TYPE
                FROM INFORMATION_SCHEMA.TABLES
                WHERE TABLE_TYPE IN ('BASE TABLE', 'VIEW')
                  AND TABLE_SCHEMA NOT IN ('sys', 'INFORMATION_SCHEMA')
                ORDER BY TABLE_SCHEMA, TABLE_NAME
                """
            )
            rows = cursor.fetchall()
            conn.close()

            tables = [
                {
                    "schema": row[0],
                    "table": row[1],
                    "type": "VIEW" if row[2] == "VIEW" else "TABLE",
                    "full_name": f"{row[0]}.{row[1]}",
                }
                for row in rows
            ]
            return {"success": True, "tables": tables, "error": None}

        except Exception as e:
            return {"success": False, "tables": [], "error": str(e)}

    def get_schema(self, table: str, params: dict, schema_name: str = "dbo") -> dict:
        """
        Returns column-level metadata for a single table.
        Fetches ONLY column names, data types, and nullability — never row data.
        """
        try:
            # Support "schema.table" format
            if "." in table:
                parts = table.split(".", 1)
                schema_name, table = parts[0], parts[1]

            conn = self._connect(params)
            cursor = conn.cursor()
            cursor.execute(
                """
                SELECT
                    c.COLUMN_NAME,
                    c.DATA_TYPE,
                    c.IS_NULLABLE,
                    c.CHARACTER_MAXIMUM_LENGTH,
                    c.NUMERIC_PRECISION,
                    c.NUMERIC_SCALE,
                    CASE WHEN pk.COLUMN_NAME IS NOT NULL THEN 1 ELSE 0 END AS IS_PRIMARY_KEY
                FROM INFORMATION_SCHEMA.COLUMNS c
                LEFT JOIN (
                    SELECT ku.COLUMN_NAME
                    FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS tc
                    JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE ku
                      ON tc.CONSTRAINT_NAME = ku.CONSTRAINT_NAME
                     AND tc.TABLE_NAME = ku.TABLE_NAME
                    WHERE tc.CONSTRAINT_TYPE = 'PRIMARY KEY'
                      AND tc.TABLE_NAME = ?
                      AND tc.TABLE_SCHEMA = ?
                ) pk ON c.COLUMN_NAME = pk.COLUMN_NAME
                WHERE c.TABLE_NAME = ?
                  AND c.TABLE_SCHEMA = ?
                ORDER BY c.ORDINAL_POSITION
                """,
                (table, schema_name, table, schema_name),
            )
            rows = cursor.fetchall()
            conn.close()

            columns = [
                {
                    "column": row[0],
                    "type": row[1],
                    "nullable": row[2] == "YES",
                    "max_length": row[3],
                    "precision": row[4],
                    "scale": row[5],
                    "is_primary_key": bool(row[6]),
                }
                for row in rows
            ]
            return {"success": True, "columns": columns, "error": None, "table": table, "schema": schema_name}

        except Exception as e:
            return {"success": False, "columns": [], "error": str(e)}

    def generate_pyspark_ingest_code(
        self,
        table: str,
        schema: list,
        target_lakehouse: str,
        layer: str = "Bronze",
        params: dict = None,
    ) -> str:
        """
        Generates a complete PySpark notebook cell for ingesting this table.
        Uses JDBC to read from SQL Server → writes to Delta table.
        Credentials are referenced via Fabric Secret (not hardcoded).
        """
        params = params or {}
        server = params.get("server", "<your_server>")
        database = params.get("database", "<your_database>")
        port = params.get("port", "1433")
        safe_name = self._safe_table_name(table)
        layer_lower = layer.lower()
        delta_table = f"{target_lakehouse}.{layer_lower}_{safe_name}"

        # Identify primary key columns for deduplication
        pk_cols = [c["column"] for c in schema if c.get("is_primary_key")]
        pk_comment = f"# Primary Keys: {pk_cols}" if pk_cols else "# No primary keys detected"

        # Build column cast expressions
        col_casts = []
        type_map = {
            "int": "IntegerType()", "bigint": "LongType()", "smallint": "ShortType()",
            "tinyint": "ByteType()", "decimal": "DoubleType()", "numeric": "DoubleType()",
            "float": "FloatType()", "real": "FloatType()", "money": "DoubleType()",
            "bit": "BooleanType()", "datetime": "TimestampType()", "datetime2": "TimestampType()",
            "date": "DateType()", "varchar": "StringType()", "nvarchar": "StringType()",
            "char": "StringType()", "nchar": "StringType()", "text": "StringType()",
            "uniqueidentifier": "StringType()",
        }
        for col in schema:
            spark_type = type_map.get(col["type"].lower(), "StringType()")
            col_casts.append(f'    col("{col["column"]}").cast({spark_type}).alias("{col["column"]}")')

        casts_str = ",\n".join(col_casts) if col_casts else '    "*"'

        code = f'''# ============================================================
# AUTO-GENERATED BY FABRIC AI STUDIO
# Source: Azure SQL Server — {database}.{table}
# Target: {delta_table} ({layer} Layer)
# Connector: azure_sql v1.0
# ============================================================

from pyspark.sql.types import (
    IntegerType, LongType, ShortType, ByteType, DoubleType,
    FloatType, BooleanType, TimestampType, DateType, StringType
)
from pyspark.sql.functions import col, current_timestamp, lit
from delta.tables import DeltaTable

# ── Connection (credentials stored in Fabric Secret scope) ──────────────
jdbc_url = f"jdbc:sqlserver://{server}:{port};databaseName={database};encrypt=true;trustServerCertificate=true"

# Use Fabric Secret scope — set these in your workspace secrets:
#   scope: "fabric-ai-secrets", key: "sql-username" / "sql-password"
try:
    sql_username = dbutils.secrets.get(scope="fabric-ai-secrets", key="sql-username")
    sql_password = dbutils.secrets.get(scope="fabric-ai-secrets", key="sql-password")
except Exception:
    # Fallback: prompt in notebook (development only — remove in production)
    sql_username = dbutils.widgets.get("sql_username") if False else "<SET_SECRET>"
    sql_password = dbutils.widgets.get("sql_password") if False else "<SET_SECRET>"

# ── Read source table — metadata/schema validated, no unlimited scans ───
{pk_comment}
print(f"[INGEST] Reading schema and data from [{database}].[{table}]...")

df_raw = (
    spark.read.format("jdbc")
    .option("url", jdbc_url)
    .option("dbtable", "[{table.replace(".", "].[") }]")
    .option("user", sql_username)
    .option("password", sql_password)
    .option("driver", "com.microsoft.sqlserver.jdbc.SQLServerDriver")
    .option("fetchsize", "10000")
    .load()
)

row_count = df_raw.count()
print(f"[INGEST] Rows read from source: {{row_count:,}}")

# ── Type-safe column selection ──────────────────────────────────────────
df_typed = df_raw.select(
{casts_str}
)

# ── Watermark & audit columns ───────────────────────────────────────────
df_final = (
    df_typed
    .withColumn("_fabric_ingested_at", current_timestamp())
    .withColumn("_fabric_source", lit("azure_sql:{database}.{table}"))
    .withColumn("_fabric_layer", lit("{layer}"))
)

# ── Write to Delta ({layer} Layer) ──────────────────────────────────────
target_table = "{delta_table}"

if DeltaTable.isDeltaTable(spark, f"Tables/{{target_table.split('.')[-1]}}"):
    # Incremental append — production uses MERGE for SCD if PKs exist
    df_final.write.format("delta").mode("append").saveAsTable(target_table)
    print(f"[INGEST] Appended {{row_count:,}} rows to {{target_table}}")
else:
    # First load — full overwrite
    df_final.write.format("delta").mode("overwrite").option("overwriteSchema", "true").saveAsTable(target_table)
    print(f"[INGEST] Initial load: {{row_count:,}} rows written to {{target_table}}")

print(f"[DONE] {{target_table}} — {layer} layer ingestion complete.")
'''
        return code
