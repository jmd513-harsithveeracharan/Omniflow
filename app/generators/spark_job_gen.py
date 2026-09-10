"""
app/generators/spark_job_gen.py
-------------------------------
Generates Microsoft Fabric Synapse Spark Job Definition (SJD) parts,
batch executable Python files (Main.py), and compute properties.
"""

from __future__ import annotations

import base64
import json
from typing import Any


def _b64(content: str) -> str:
    """Encodes a UTF-8 string to Base64."""
    return base64.b64encode(content.encode("utf-8")).decode("utf-8")


def generate_spark_job_main_py(
    job_name: str,
    target_lakehouse: str = "lh_gold",
    task_type: str = "batch_aggregation",
) -> str:
    """Generates the Main.py entrypoint script for a Spark Job Definition."""
    return f"""#!/usr/bin/env python
\"\"\"
Main.py
-------
Batch executable for Fabric Spark Job Definition: {job_name}
Target Lakehouse: {target_lakehouse}
Task Type: {task_type}
\"\"\"

import sys
import argparse
from pyspark.sql import SparkSession
from pyspark.sql import functions as F


def run_batch_job(env_name: str, date_filter: str):
    spark = SparkSession.builder.appName("{job_name}").getOrCreate()
    spark.conf.set("spark.sql.streaming.forceDeleteTempCheckpointLocation", "true")

    print(f"=== Starting Fabric Spark Batch Job: {job_name} ===")
    print(f"Environment: {{env_name}} | Filter: {{date_filter}}")

    # Ingest from Silver Delta tables
    silver_table = "lh_silver.fact_sales"
    print(f"Reading from {{silver_table}}...")
    
    try:
        df_silver = spark.read.format("delta").table(silver_table)
        df_agg = (
            df_silver
            .groupBy("customer_id")
            .agg(
                F.count("*").alias("total_orders"),
                F.sum("amount").alias("total_spend"),
                F.max("order_date").alias("last_order_ts")
            )
            .withColumn("_job_run_id", F.lit("{job_name}"))
            .withColumn("_processed_ts", F.current_timestamp())
        )

        target_path = "{target_lakehouse}.dim_customer_metrics"
        print(f"Writing aggregated batch to {{target_path}}...")
        (
            df_agg.write
            .format("delta")
            .mode("overwrite")
            .option("overwriteSchema", "true")
            .saveAsTable(target_path)
        )
        print("=== Spark Batch Job Completed Successfully ===")
    except Exception as exc:
        print(f"Spark Job Execution Warning: {{exc}}", file=sys.stderr)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Fabric Spark Job Runner")
    parser.add_argument("--env", default="production", help="Deployment environment")
    parser.add_argument("--date", default="latest", help="Processing date partition")
    args = parser.parse_args()

    run_batch_job(args.env, args.date)
"""


def package_spark_job_definition_parts(
    job_name: str,
    main_py_code: str,
    environment_name: str | None = None,
    default_lakehouse_name: str = "lh_gold",
    cli_args: list[str] | None = None,
) -> list[dict[str, Any]]:
    """Packages Spark Job Definition parts into Base64 payload for Fabric REST API."""
    properties = {
        "executableFile": "Main.py",
        "defaultLakehouseArtifactId": default_lakehouse_name,
        "mainDefinition": {
            "file": "Main.py",
            "className": "",
            "arguments": cli_args or ["--env", "production", "--date", "latest"],
        },
        "environment": {
            "name": environment_name or "env_default_runtime",
        },
        "sparkConfig": {
            "spark.driver.memory": "4g",
            "spark.driver.cores": "2",
            "spark.executor.memory": "8g",
            "spark.executor.cores": "4",
            "spark.dynamicAllocation.enabled": "true",
        },
    }

    return [
        {
            "path": "Main.py",
            "payload": _b64(main_py_code),
            "payloadType": "InlineBase64",
        },
        {
            "path": "SparkJobDefinitionProperties.json",
            "payload": _b64(json.dumps(properties, indent=2)),
            "payloadType": "InlineBase64",
        },
    ]
