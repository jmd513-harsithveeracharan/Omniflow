"""
app/generators/notebook_gen.py
------------------------------
Generates production-grade PySpark code for Delta Lake Medallion operations
and packages it into standard Microsoft Fabric Notebook Base64 inline definition parts.
"""

import base64
from typing import Any


def generate_pyspark_bronze_ingest(
    source_table: str,
    target_lakehouse: str,
    source_query: str = "",
) -> str:
    """Generates PySpark code to read source table and write raw Delta to Bronze layer."""
    return f'''# Fabric AI Studio — Automated Bronze Raw Ingestion
# Source: {source_table} -> Target: {target_lakehouse}

from pyspark.sql import SparkSession
from pyspark.sql.functions import current_timestamp, input_file_name

spark = SparkSession.builder.getOrCreate()

print("[Bronze] Ingesting raw dataset: {source_table}")

# Load raw source data
raw_df = spark.table("{source_table}") if "{source_query}" == "" else spark.sql("""{source_query}""")

# Add system audit columns
bronze_df = raw_df \\
    .withColumn("_ingested_at", current_timestamp()) \\
    .withColumn("_source_file", input_file_name())

# Write append-only raw Delta table
bronze_df.write \\
    .format("delta") \\
    .mode("append") \\
    .option("mergeSchema", "true") \\
    .saveAsTable("{target_lakehouse}.raw_{source_table.lower()}")

print(f"[Bronze] Successfully ingested {{bronze_df.count()}} records into {target_lakehouse}.raw_{source_table.lower()}")
'''


def generate_pyspark_silver_merge(
    bronze_table: str,
    silver_table: str,
    primary_key: str,
    target_lakehouse: str,
    dedup_column: str = "_ingested_at",
) -> str:
    """Generates PySpark MERGE SCD-1 upsert code with deduplication."""
    return f'''# Fabric AI Studio — Silver Layer Delta MERGE & SCD-1
# Bronze: {bronze_table} -> Silver: {silver_table} (PK: {primary_key})

from pyspark.sql import SparkSession
from pyspark.sql.window import Window
from pyspark.sql.functions import row_number, col, current_timestamp
from delta.tables import DeltaTable

spark = SparkSession.builder.getOrCreate()

# 1. Read Bronze raw stream/table
bronze_df = spark.table("{bronze_table}")

# 2. Window deduplication on primary key
window_spec = Window.partitionBy("{primary_key}").orderBy(col("{dedup_column}").desc())
deduped_df = bronze_df.withColumn("_rn", row_number().over(window_spec)) \\
    .filter(col("_rn") == 1) \\
    .drop("_rn") \\
    .withColumn("_updated_at", current_timestamp())

# 3. Check if target Silver Delta table exists
table_exists = spark.catalog.tableExists("{target_lakehouse}.{silver_table}")

if not table_exists:
    print(f"[Silver] Initializing new table {target_lakehouse}.{silver_table}")
    deduped_df.write.format("delta").mode("overwrite").saveAsTable("{target_lakehouse}.{silver_table}")
else:
    print(f"[Silver] Executing Delta MERGE upsert on {primary_key}")
    target_delta = DeltaTable.forName(spark, "{target_lakehouse}.{silver_table}")
    
    target_delta.alias("target") \\
        .merge(
            deduped_df.alias("source"),
            "target.{primary_key} = source.{primary_key}"
        ) \\
        .whenMatchedUpdateAll() \\
        .whenNotMatchedInsertAll() \\
        .execute()

print("[Silver] Merge operation completed successfully.")
'''


def generate_pyspark_gold_star_schema(
    fact_query: str,
    gold_table: str,
    target_lakehouse: str,
) -> str:
    """Generates PySpark code for Gold aggregated Kimball business tables."""
    return f'''# Fabric AI Studio — Gold Layer Business Aggregations
# Target: {target_lakehouse}.{gold_table}

from pyspark.sql import SparkSession
from pyspark.sql.functions import current_timestamp

spark = SparkSession.builder.getOrCreate()

print("[Gold] Calculating business aggregations for {gold_table}...")

gold_df = spark.sql("""
{fact_query}
""").withColumn("_gold_calculated_at", current_timestamp())

# Write optimized Delta table with V-Order optimization
gold_df.write \\
    .format("delta") \\
    .mode("overwrite") \\
    .option("overwriteSchema", "true") \\
    .saveAsTable("{target_lakehouse}.{gold_table}")

print(f"[Gold] Published {{gold_df.count()}} records to {target_lakehouse}.{gold_table}")
'''


def format_fabric_notebook_source(python_code: str) -> str:
    """Wraps Python code in official Microsoft Fabric notebook metadata and cell headers."""
    if "# Fabric notebook source" in python_code:
        return python_code
    return f"""# Fabric notebook source

# METADATA ********************

# META {{
# META   "kernel_info": {{
# META     "name": "synapse_pyspark"
# META   }},
# META   "language_info": {{
# META     "name": "python"
# META   }}
# META }}

# CELL ********************

{python_code.strip()}

# METADATA ********************

# META {{
# META   "language": "python",
# META   "language_group": "synapse_pyspark"
# META }}
"""


def package_notebook_definition_parts(python_code: str) -> list[dict[str, Any]]:
    """
    Packages Python code into Microsoft Fabric inline Base64 definition parts format
    with valid Fabric notebook metadata headers.
    """
    formatted_code = format_fabric_notebook_source(python_code)
    encoded_payload = base64.b64encode(formatted_code.encode("utf-8")).decode("utf-8")
    return [
        {
            "path": "notebook-content.py",
            "payload": encoded_payload,
            "payloadType": "InlineBase64",
        }
    ]

