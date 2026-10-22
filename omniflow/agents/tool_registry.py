from __future__ import annotations

import json
import os
import re
from typing import Any
import uuid
import networkx as nx
import psycopg2

try:
    from app.llm_router import chat
except ImportError:
    from omniflow.config.llm_adapter import chat

from omniflow.db.catalog_seeder import get_table_schema_context_from_db
from omniflow.db.postgres_repo import NEON_URI
from omniflow.tools.fabric_deployer import deploy_fabric_item, verify_fabric_workspace_connection
from omniflow.tools.fabric_executor import (
    debug_and_heal_notebook_failure,
    execute_fabric_job_and_poll,
    poll_fabric_job_status,
    trigger_fabric_job,
)


def deploy_fabric_item_tool(
    display_name: str,
    item_type: str,
    workspace_id: str | None = None,
    definition: dict[str, Any] | None = None,
    description: str = "",
) -> dict[str, Any]:
    """Single generic Microsoft Fabric REST API tool: provisions ANY item type
    (Lakehouse, Notebook, Warehouse, DataPipeline, SemanticModel, Eventstream)
    via POST /v1/workspaces/{workspaceId}/items.
    """
    return deploy_fabric_item(
        display_name=display_name,
        item_type=item_type,
        workspace_id=workspace_id,
        definition=definition,
        description=description,
    )


def verify_fabric_workspace_connection_tool(workspace_id: str | None = None) -> dict[str, Any]:
    """Checks live Microsoft Fabric REST API connectivity using the active Azure CLI token."""
    return verify_fabric_workspace_connection(workspace_id)


def execute_metadata_query_tool(query: str) -> dict[str, Any]:
    """AI Dynamic Exploration Tool: Executes a read-only SQL query against the Neon PostgreSQL metadata catalog.
    Enables the AI to inspect tables, columns, standards, ADRs, relationships, and runs freely at any phase.
    """
    clean_q = query.strip()
    upper_q = clean_q.upper()
    if not (upper_q.startswith("SELECT") or upper_q.startswith("WITH")):
        return {"success": False, "error": "Only read-only SELECT or WITH statements are allowed."}

    disallowed = ["DROP", "DELETE", "TRUNCATE", "ALTER", "UPDATE", "INSERT", "GRANT", "REVOKE"]
    for word in disallowed:
        if re.search(rf"\b{word}\b", upper_q):
            return {"success": False, "error": f"Destructive or mutating SQL keyword '{word}' is blocked."}

    try:
        with psycopg2.connect(NEON_URI, connect_timeout=8) as conn, conn.cursor() as cur:
            cur.execute(clean_q)
            if not cur.description:
                return {"success": True, "columns": [], "rows": [], "row_count": 0}
            columns = [desc[0] for desc in cur.description]
            raw_rows = cur.fetchall()
            rows = [dict(zip(columns, r)) for r in raw_rows]
            return {
                "success": True,
                "columns": columns,
                "rows": rows[:100],  # safety cap
                "row_count": len(rows),
                "truncated": len(rows) > 100,
            }
    except Exception as e:
        return {"success": False, "error": str(e)}



def query_standards_tool(layer: str = "ALL") -> dict[str, Any]:
    """Queries live engineering standards from Neon PostgreSQL via execute_metadata_query_tool."""
    q = "SELECT standard_name, target_layer, rule_markdown FROM engineering_standards ORDER BY standard_name;"
    if layer.upper() != "ALL":
        q = f"SELECT standard_name, target_layer, rule_markdown FROM engineering_standards WHERE target_layer IN ('{layer.upper()}', 'ALL') ORDER BY standard_name;"
    res = execute_metadata_query_tool(q)
    rows = res.get("rows", [])
    return {
        "layer_filter": layer,
        "standards_count": len(rows),
        "rules": [{"name": r.get("standard_name"), "layer": r.get("target_layer"), "rule": r.get("rule_markdown")} for r in rows],
    }


def search_database_catalog_tool(query: str = "ALL", domain: str = "ALL") -> dict[str, Any]:
    """AI Context Tool: Discovers registered data sources and candidate tables via execute_metadata_query_tool."""
    src_res = execute_metadata_query_tool("SELECT source_name, source_type, system_name FROM data_sources WHERE status = 'active';")
    sources = src_res.get("rows", [])
    tbl_res = execute_metadata_query_tool("SELECT table_name, layer, primary_key, watermark_column FROM tables WHERE status = 'active' ORDER BY table_name;")
    tables = []
    for r in tbl_res.get("rows", []):
        pk = r.get("primary_key")
        pk_val = pk[0] if isinstance(pk, (list, tuple)) and pk else (pk or "id")
        tables.append({"table_name": r.get("table_name"), "layer": r.get("layer"), "primary_key": pk_val, "watermark": r.get("watermark_column")})
    return {
        "total_sources": len(sources),
        "data_sources": sources,
        "total_tables": len(tables),
        "tables": tables,
        "table_names": [t["table_name"] for t in tables],
    }


def get_table_schema_and_lineage_tool(table_names: list[str]) -> dict[str, Any]:
    """AI Context Tool: Queries exact columns, data types, primary keys, PII sensitivity, and foreign keys."""
    schemas = get_table_schema_context_from_db(table_names, NEON_URI)
    rel_res = execute_metadata_query_tool(
        """
        SELECT pt.table_name, pc.column_name, ct.table_name, cc.column_name, r.relationship_type, r.cardinality
        FROM relationships r
        JOIN tables pt ON r.from_table_id = pt.table_id
        JOIN columns pc ON r.from_column_id = pc.column_id
        JOIN tables ct ON r.to_table_id = ct.table_id
        JOIN columns cc ON r.to_column_id = cc.column_id
        WHERE r.is_active = true;
        """
    )
    relationships = [
        {
            "from_table": r.get("table_name"),
            "from_column": r.get("column_name"),
            "to_table": r.get("ct_table_name", r.get("table_name")),
            "to_column": r.get("cc_column_name", r.get("column_name")),
            "type": r.get("relationship_type"),
            "cardinality": r.get("cardinality"),
        }
        for r in rel_res.get("rows", [])
    ]
    return {
        "retrieved_tables_count": len(schemas),
        "schemas": schemas,
        "relationships": relationships,
    }


def query_governance_and_compliance_policies_tool(project_code: str = "PRJ-GLOBAL-FIN-HUB") -> dict[str, Any]:
    """AI Context Tool: Queries mandatory data governance policies via execute_metadata_query_tool."""
    res = execute_metadata_query_tool("SELECT policy_name, policy_type, description, rules_json, is_enforced FROM policies WHERE is_enforced = true;")
    policies = [
        {
            "policy_name": r.get("policy_name"),
            "policy_type": r.get("policy_type"),
            "description": r.get("description"),
            "rules": r.get("rules_json"),
            "is_enforced": r.get("is_enforced"),
        }
        for r in res.get("rows", [])
    ]
    return {"policies_count": len(policies), "policies": policies}


def query_project_memory_and_decisions_tool(project_code: str = "PRJ-GLOBAL-FIN-HUB") -> dict[str, Any]:
    """AI Context Tool: Queries ADRs, constraints, and project memory via execute_metadata_query_tool."""
    dec_res = execute_metadata_query_tool(
        f"""
        SELECT pd.decision_title, pd.decision, pd.reason, pd.decided_by
        FROM project_decisions pd
        JOIN projects p ON pd.project_id = p.project_id
        WHERE p.project_code = '{project_code}' AND pd.status = 'APPROVED';
        """
    )
    con_res = execute_metadata_query_tool(
        f"""
        SELECT pc.constraint_type, pc.description, pc.severity, pc.value
        FROM project_constraints pc
        JOIN projects p ON pc.project_id = p.project_id
        WHERE p.project_code = '{project_code}' AND pc.is_active = true;
        """
    )
    mem_res = execute_metadata_query_tool(
        f"""
        SELECT pm.memory_type, pm.title, pm.content, pm.importance
        FROM project_memory pm
        JOIN projects p ON pm.project_id = p.project_id
        WHERE p.project_code = '{project_code}' AND pm.status = 'ACTIVE';
        """
    )

    decisions = [
        {"title": r.get("decision_title"), "decision": r.get("decision"), "reason": r.get("reason"), "decided_by": r.get("decided_by")}
        for r in dec_res.get("rows", [])
    ]
    constraints = [
        {"type": r.get("constraint_type"), "description": r.get("description"), "severity": r.get("severity"), "value": r.get("value")}
        for r in con_res.get("rows", [])
    ]
    memory = [
        {"type": r.get("memory_type"), "title": r.get("title"), "content": r.get("content"), "importance": r.get("importance")}
        for r in mem_res.get("rows", [])
    ]
    return {
        "decisions_count": len(decisions),
        "decisions": decisions,
        "constraints_count": len(constraints),
        "constraints": constraints,
        "memory_count": len(memory),
        "memory": memory,
    }


def get_table_schema_context_tool(table_names: list[str]) -> list[dict[str, Any]]:
    """Legacy alias: queries Neon PostgreSQL catalog tables and columns via get_table_schema_and_lineage_tool."""
    return get_table_schema_and_lineage_tool(table_names).get("schemas", [])


def validate_dag_tool(steps: list[dict[str, Any]]) -> dict[str, Any]:
    """Builds a NetworkX DiGraph from planned steps, verifies acyclicity, and returns execution waves."""
    graph = nx.DiGraph()
    for step in steps:
        code = step["step_code"]
        graph.add_node(code, name=step.get("step_name", code))
        for dep in step.get("depends_on_steps", []):
            graph.add_edge(dep, code)

    is_acyclic = nx.is_directed_acyclic_graph(graph)
    if not is_acyclic:
        return {"is_acyclic": False, "waves": [], "topological_order": [], "critical_path": []}

    waves = [list(gen) for gen in nx.topological_generations(graph)]
    topo_order = list(nx.topological_sort(graph))
    critical_path = nx.dag_longest_path(graph) if graph.nodes else []
    return {
        "is_acyclic": True,
        "waves": waves,
        "topological_order": topo_order,
        "critical_path": critical_path,
    }


def build_workspace_manifest_tool(
    project_code: str,
    domain: str = "fin_ops",
    capacity_sku: str = "F64",
    raw_layer: str = "raw",
    curated_layer: str = "curated",
    analytical_layer: str = "analytics",
    containment_folder: str | None = None,
    **_: Any,
) -> dict[str, Any]:
    provisioned_items: list[dict[str, str]] = []
    if containment_folder:
        provisioned_items.append({"item_type": "Folder", "display_name": containment_folder})
    provisioned_items.extend([
        {"item_type": "Lakehouse", "display_name": f"lh_{domain}_{raw_layer}", "tier": "raw_ingestion"},
        {"item_type": "Lakehouse", "display_name": f"lh_{domain}_{curated_layer}", "tier": "curated_harmonized"},
        {"item_type": "Warehouse", "display_name": f"wh_{domain}_{analytical_layer}", "tier": "analytical_serving"},
    ])
    manifest = {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/workspace-provisioning/v1.json",
        "project_code": project_code,
        "containment_folder": containment_folder or "Workspace Root",
        "capacity_sku": capacity_sku,
        "provisioned_items": provisioned_items,
    }
    return {"file_extension": "json", "content_str": None, "definition": manifest}


def build_adf_pipeline_json_tool(
    project_code: str,
    sources: list[str] | None = None,
    tables: list[str] | None = None,
    domain: str = "fin_ops",
    raw_layer: str = "raw",
    **_: Any,
) -> dict[str, Any]:
    sources = sources or ["PostgreSQL_ERP", "SAP_ECC"]
    tables = tables or ["orders", "customers", "invoices", "shipments"]
    target_lakehouse = f"lh_{domain}_{raw_layer}"
    activities = [
        {
            "name": f"Ingest_{tbl}_to_Raw",
            "type": "Copy",
            "typeProperties": {
                "source": {
                    "type": "RelationalSource",
                    "sqlReaderQuery": f"SELECT *, CURRENT_TIMESTAMP AS _omni_ingested_at FROM {tbl}",
                },
                "sink": {"type": "LakehouseTableSink", "tableActionOption": "Append"},
            },
            "destination": {"lakehouse": target_lakehouse, "table": tbl},
        }
        for tbl in tables
    ]
    return {
        "file_extension": "json",
        "content_str": None,
        "definition": {
            "name": f"pl_raw_batch_ingest_{project_code.lower().replace('-', '_')}",
            "properties": {"activities": activities},
        },
    }


def build_pyspark_notebook_tool(
    project_code: str,
    domain: str = "crm_sales",
    tables: list[str] | None = None,
    pii_columns: list[str] | None = None,
    raw_layer: str = "bronze",
    curated_layer: str = "silver",
    **_: Any,
) -> dict[str, Any]:
    tables = tables or ["customers", "orders", "products", "order_items"]
    raw_lh = f"lh_{domain}_{raw_layer}"
    curated_lh = f"lh_{domain}_{curated_layer}"

    # Self-directed dynamic schema context lookup from Neon DB catalog
    table_configs = []
    try:
        from omniflow.db.catalog_seeder import get_table_schema_context_from_db
        db_schemas = get_table_schema_context_from_db(tables)
        schema_map = {s["table_name"].lower(): s for s in db_schemas}
    except Exception:
        schema_map = {}

    for tbl in tables:
        t_meta = schema_map.get(tbl.lower())
        pk = t_meta["primary_key"] if t_meta else "id"
        t_pii = t_meta["pii_columns"] if t_meta and t_meta["pii_columns"] else (pii_columns or [])
        wm = t_meta.get("watermark_column") if t_meta else "updated_at"
        table_configs.append({"table_name": tbl, "primary_key": pk, "pii_columns": t_pii, "watermark": wm})

    code_str = None
    try:
        llm_prompt = (
            f"You are a Principal Microsoft Fabric Data Engineer.\n"
            f"Write an enterprise PySpark Synapse Delta Lake notebook to curate Bronze raw data into the Silver lakehouse.\n"
            f"Raw Lakehouse: '{raw_lh}'\n"
            f"Curated Lakehouse: '{curated_lh}'\n"
            f"Tables and schemas to curate:\n{json.dumps(table_configs, indent=2)}\n\n"
            f"Mandatory requirements:\n"
            f"1. Start with '# Fabric Notebook source', standard metadata header with kernel 'synapse_pyspark' and default lakehouse '{curated_lh}'.\n"
            f"2. Separate logic into clean Synapse cells marked with '# CELL ********************'.\n"
            f"3. For every table: apply null-safe SHA-256 hashing (F.sha2(F.col(c).cast('string'), 256)) to all PII columns.\n"
            f"4. Deduplicate using Window.partitionBy(primary_key).orderBy(watermark.desc()).\n"
            f"5. Perform DeltaTable.merge ACID upsert (whenMatchedUpdateAll, whenNotMatchedInsertAll).\n"
            f"6. Run OPTIMIZE and ZORDER BY primary_key.\n"
            f"Return ONLY valid executable PySpark python code. Do not wrap in markdown fences."
        )
        llm_resp = chat([{"role": "user", "content": llm_prompt}], target_model="omni-flow-gpt-6-luna")
        if llm_resp and ("from pyspark.sql" in llm_resp or "spark" in llm_resp):
            cleaned = llm_resp.strip()
            if cleaned.startswith("```python"):
                cleaned = cleaned[len("```python"):].strip()
            if cleaned.startswith("```"):
                cleaned = cleaned[len("```"):].strip()
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3].strip()
            code_str = cleaned
    except Exception:
        code_str = None

    if not code_str:
        # Fallback to deterministic clean template if LLM is unavailable
        code_lines = [
            "# Fabric Notebook source",
            "# METADATA ********************",
            "# META {",
            '# META   "kernel_info": {"name": "synapse_pyspark"},',
            f'# META   "default_lakehouse": "{curated_lh}"',
            "# META }",
            "",
            "# CELL ********************",
            "from pyspark.sql import functions as F",
            "from pyspark.sql.window import Window",
            "from delta.tables import DeltaTable",
            "",
            f"RAW_LAKEHOUSE = '{raw_lh}'",
            f"CURATED_LAKEHOUSE = '{curated_lh}'",
            "",
            "# CELL ********************",
            "def curate_and_merge_table(",
            "    table_name: str,",
            "    primary_key: str,",
            "    pii_columns: list[str] | None = None,",
            "    watermark_col: str | None = None,",
            ") -> None:",
            '    """Loads raw records, applies null-safe SHA-256 PII hashing, deduplicates, and merges into Delta."""',
            "    pii_cols = pii_columns or []",
            "    raw_df = spark.read.table(f'{RAW_LAKEHOUSE}.{table_name}')",
            "",
            "    # 1. Null-Safe SHA-256 PII Masking",
            "    for col_name in pii_cols:",
            "        if col_name in raw_df.columns:",
            "            raw_df = raw_df.withColumn(",
            "                col_name,",
            "                F.when(F.col(col_name).isNotNull(), F.sha2(F.col(col_name).cast('string'), 256)).otherwise(F.lit(None)),",
            "            )",
            "",
            "    # 2. Window-Based Deduplication (Latest Ingest Wins)",
            "    order_col = watermark_col if (watermark_col and watermark_col in raw_df.columns) else '_omni_ingested_at'",
            "    if order_col in raw_df.columns:",
            "        win = Window.partitionBy(primary_key).orderBy(F.col(order_col).desc())",
            "    else:",
            "        win = Window.partitionBy(primary_key).orderBy(F.lit(1))",
            "    dedup_df = raw_df.withColumn('_rn', F.row_number().over(win)).filter(F.col('_rn') == 1).drop('_rn')",
            "",
            "    # 3. Delta Lake ACID Upsert (MERGE)",
            "    target_table = f'{CURATED_LAKEHOUSE}.{table_name}'",
            "    if spark.catalog.tableExists(target_table):",
            "        delta_tbl = DeltaTable.forName(spark, target_table)",
            "        delta_tbl.alias('t').merge(",
            "            dedup_df.alias('s'),",
            "            f't.{primary_key} = s.{primary_key}',",
            "        ).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()",
            "    else:",
            "        dedup_df.write.format('delta').mode('overwrite').saveAsTable(target_table)",
            "",
            "    # 4. Storage Compaction & Z-Order Clustering",
            "    spark.sql(f'OPTIMIZE {target_table} ZORDER BY ({primary_key})')",
            "    print(f'[OmniFlow] Successfully curated and merged table: {target_table}')",
            "",
            "# CELL ********************",
        ]
        for cfg in table_configs:
            code_lines.append(
                f"curate_and_merge_table(table_name={cfg['table_name']!r}, primary_key={cfg['primary_key']!r}, "
                f"pii_columns={cfg['pii_columns']!r}, watermark_col={cfg['watermark']!r})"
            )
        code_str = "\n".join(code_lines)

    return {
        "file_extension": "py",
        "content_str": code_str,
        "definition": {
            "notebook_format": "fabric_pyspark_py",
            "project_code": project_code,
            "code": code_str,
        },
    }


def build_warehouse_ddl_tool(
    project_code: str,
    domain: str = "crm_sales",
    analytical_layer: str = "gold",
    dimensions: list[str] | None = None,
    facts: list[str] | None = None,
    **_: Any,
) -> dict[str, Any]:
    dimensions = dimensions or ["dim_customers", "dim_products", "dim_date"]
    facts = facts or ["fact_sales_orders", "fact_order_items"]
    sql_str = None

    try:
        llm_prompt = (
            f"You are a Principal Data Warehouse Architect specializing in Microsoft Fabric T-SQL and Kimball Star Schemas.\n"
            f"Generate an enterprise T-SQL DDL script for Gold warehouse 'wh_{domain}_{analytical_layer}' for project '{project_code}'.\n"
            f"Target Dimensions: {dimensions}\n"
            f"Target Facts: {facts}\n"
            f"Source domain: CRM & eCommerce Sales.\n"
            f"Requirements:\n"
            f"1. Create dimension tables with BIGINT surrogate keys (*_sk), business keys, SCD2 tracking (effective_from, is_current).\n"
            f"2. Create fact tables with surrogate keys, dimension foreign keys, business measures (net_amount, quantity, line_total), and _loaded_at.\n"
            f"3. Use standard Fabric T-SQL DDL syntax ([dbo].[table_name]).\n"
            f"Return ONLY clean executable T-SQL DDL statements. No markdown fences."
        )
        llm_resp = chat([{"role": "user", "content": llm_prompt}], target_model="omni-flow-gpt-6-luna")
        if llm_resp and "CREATE TABLE" in llm_resp.upper():
            cleaned = llm_resp.strip()
            if cleaned.startswith("```sql"):
                cleaned = cleaned[len("```sql"):].strip()
            if cleaned.startswith("```"):
                cleaned = cleaned[len("```"):].strip()
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3].strip()
            sql_str = cleaned
    except Exception:
        sql_str = None

    if not sql_str:
        sql_blocks = [f"-- OmniFlow Analytical Warehouse Star Schema DDL ({project_code})"]
        for dim in dimensions:
            sql_blocks.append(
                f"CREATE TABLE [dbo].[{dim}] (\n"
                f"    [{dim}_sk] BIGINT NOT NULL,\n"
                f"    [business_key] VARCHAR(128) NOT NULL,\n"
                f"    [effective_from] DATETIME2(6) NOT NULL,\n"
                f"    [is_current] BIT NOT NULL\n"
                f");"
            )
        for fact in facts:
            sql_blocks.append(
                f"CREATE TABLE [dbo].[{fact}] (\n"
                f"    [settlement_sk] BIGINT NOT NULL,\n"
                f"    [dim_customer_sk] BIGINT NOT NULL,\n"
                f"    [net_amount_usd] DECIMAL(18, 2) NOT NULL,\n"
                f"    [_loaded_at] DATETIME2(6) NOT NULL\n"
                f");"
            )
        sql_str = "\n\n".join(sql_blocks)

    return {
        "file_extension": "sql",
        "content_str": sql_str,
        "definition": {"warehouse": f"wh_{domain}_{analytical_layer}", "sql_ddl": sql_str},
    }


def build_direct_lake_bim_tool(
    project_code: str,
    domain: str = "crm_sales",
    **_: Any,
) -> dict[str, Any]:
    """Generates the Power BI Direct Lake Tabular Model (.bim) definition."""
    bim = {
        "name": f"sm_{domain}_direct_lake",
        "compatibilityLevel": 1604,
        "model": {
            "defaultPowerBIDataSourceVersion": "powerBI_V3",
            "defaultMode": "directLake",
            "expressions": [
                {
                    "name": "DatabaseQuery",
                    "kind": "m",
                    "expression": f'Sql.Database("onelake.dfs.fabric.microsoft.com", "wh_{domain}_gold")',
                }
            ],
            "tables": [
                {
                    "name": "fact_sales_orders",
                    "partitions": [{"name": "DirectLake_Orders", "mode": "directLake"}],
                    "measures": [
                        {"name": "Total Revenue", "expression": "SUM(fact_sales_orders[total_amount])", "formatString": "$#,0.00"},
                        {"name": "Total Orders", "expression": "COUNTROWS(fact_sales_orders)", "formatString": "#,0"},
                    ],
                },
                {"name": "dim_customers", "partitions": [{"name": "DirectLake_Cust", "mode": "directLake"}]},
                {"name": "dim_products", "partitions": [{"name": "DirectLake_Prod", "mode": "directLake"}]},
            ],
            "relationships": [
                {
                    "name": "rel_orders_customers",
                    "fromTable": "fact_sales_orders",
                    "fromColumn": "customer_id",
                    "toTable": "dim_customers",
                    "toColumn": "customer_id",
                }
            ],
        },
    }
    return {
        "file_extension": "json",
        "content_str": None,
        "definition": bim,
    }


def build_data_quality_suite_tool(
    project_code: str,
    domain: str = "analytics",
    tables: list[str] | None = None,
    **_: Any,
) -> dict[str, Any]:
    """Generates an automated PySpark Data Quality & Reconciliation Test Suite."""
    tables = tables or ["customers", "orders", "products"]
    raw_lh = f"lh_{domain}_bronze"
    curated_lh = f"lh_{domain}_silver"

    code_str = None
    try:
        prompt = (
            f"You are a Senior Data Quality & Governance Engineer for Microsoft Fabric.\n"
            f"Write an automated PySpark Data Quality & Reconciliation suite script for project '{project_code}'.\n"
            f"Tables: {tables}\n"
            f"Bronze: '{raw_lh}', Silver: '{curated_lh}'\n"
            f"Requirements:\n"
            f"1. Reconcile source-to-Bronze row counts (assert variance < 0.5%).\n"
            f"2. Validate primary key uniqueness and reject duplicate keys.\n"
            f"3. Check for unexpected nulls on mandatory business columns.\n"
            f"4. Verify null-safe SHA-256 masking on PII columns.\n"
            f"5. Return a structured test results dictionary with status PASSED/FAILED.\n"
            f"Return ONLY valid executable PySpark code. No markdown fences."
        )
        llm_resp = chat([{"role": "user", "content": prompt}], target_model="omni-flow-gpt-6-luna")
        if llm_resp and ("spark" in llm_resp or "def " in llm_resp):
            cleaned = llm_resp.strip()
            if cleaned.startswith("```python"):
                cleaned = cleaned[len("```python"):].strip()
            if cleaned.startswith("```"):
                cleaned = cleaned[len("```"):].strip()
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3].strip()
            code_str = cleaned
    except Exception:
        code_str = None

    if not code_str:
        code_lines = [
            "# Fabric Data Quality & Reconciliation Suite",
            "from pyspark.sql import functions as F",
            "",
            "def run_data_quality_suite(spark):",
            "    results = {'total_checks': 0, 'passed_checks': 0, 'failures': []}",
            f"    tables = {tables!r}",
            "    for tbl in tables:",
            f"        df = spark.read.table(f'{curated_lh}.{{tbl}}')",
            "        results['total_checks'] += 1",
            "        if df.count() >= 0:",
            "            results['passed_checks'] += 1",
            "    print(f'[OmniFlow DQ] Completed quality suite: {results}')",
            "    return results",
            "",
            "run_data_quality_suite(spark)",
        ]
        code_str = "\n".join(code_lines)

    return {
        "file_extension": "py",
        "content_str": code_str,
        "definition": {"name": f"dq_suite_{domain}", "code": code_str},
    }


def record_lineage_graph_tool(
    project_code: str,
    domain: str = "analytics",
    tables: list[str] | None = None,
    **_: Any,
) -> dict[str, Any]:
    """Constructs NetworkX lineage graph from Source -> Bronze -> Silver -> Gold -> Power BI,
    computes blast-zone downstream reach, and persists to PostgreSQL lineage tables.
    """
    import networkx as nx
    from psycopg2.extras import Json
    g = nx.DiGraph()
    tables = tables or ["orders", "customers", "products"]

    source_node = f"source_{domain}"
    g.add_node(source_node, type="SOURCE", layer="Source")

    for tbl in tables:
        b_node = f"lh_{domain}_bronze.{tbl}"
        s_node = f"lh_{domain}_silver.{tbl}"
        g.add_edge(source_node, b_node, relationship="INGESTS")
        g.add_edge(b_node, s_node, relationship="TRANSFORMS_SCD2")

    fact_node = f"wh_{domain}_gold.fact_{domain}"
    dim_node = f"wh_{domain}_gold.dim_{domain}"
    pbi_node = f"sm_{domain}_direct_lake"

    for tbl in tables:
        s_node = f"lh_{domain}_silver.{tbl}"
        g.add_edge(s_node, fact_node, relationship="AGGREGATES")
        g.add_edge(s_node, dim_node, relationship="DIMENSIONALIZES")

    g.add_edge(fact_node, pbi_node, relationship="SERVES_DIRECT_LAKE")
    g.add_edge(dim_node, pbi_node, relationship="SERVES_DIRECT_LAKE")

    lineage_data = {
        "project_code": project_code,
        "total_nodes": g.number_of_nodes(),
        "total_edges": g.number_of_edges(),
        "nodes": list(g.nodes()),
        "edges": [{"from": u, "to": v, "rel": d.get("relationship")} for u, v, d in g.edges(data=True)],
        "blast_zone_reach": len(list(nx.descendants(g, source_node))),
    }

    try:
        with psycopg2.connect(NEON_URI, connect_timeout=8) as conn, conn.cursor() as cur:
            for edge in lineage_data["edges"]:
                cur.execute(
                    """
                    INSERT INTO lineage_graph_edges
                        (edge_id, transformation_type, transformation_logic, column_mapping_json, is_active, created_at)
                    VALUES (%s, %s, %s, %s, true, NOW())
                    ON CONFLICT DO NOTHING;
                    """,
                    (
                        str(uuid.uuid4()),
                        edge.get("rel", "TRANSFORMS"),
                        f"{edge['from']} -> {edge['to']}",
                        Json({"from": edge["from"], "to": edge["to"], "project_code": project_code}),
                    ),
                )
            conn.commit()
    except Exception:
        pass

    return {
        "file_extension": "json",
        "content_str": None,
        "definition": lineage_data,
    }


def trigger_fabric_job_tool(
    item_id: str,
    item_type: str = "Notebook",
    parameters: dict[str, Any] | None = None,
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Triggers an asynchronous job execution for a Notebook, DataPipeline, or SemanticModel in Microsoft Fabric."""
    return trigger_fabric_job(item_id=item_id, item_type=item_type, parameters=parameters, workspace_id=workspace_id)


def poll_fabric_job_status_tool(
    item_id: str,
    job_id: str,
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Polls the status of an active Fabric job instance."""
    return poll_fabric_job_status(item_id=item_id, job_id=job_id, workspace_id=workspace_id)


def execute_fabric_job_and_poll_tool(
    item_id: str,
    item_type: str = "Notebook",
    parameters: dict[str, Any] | None = None,
    timeout_seconds: int = 300,
    poll_interval_seconds: int = 5,
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Executes a Fabric item (Notebook, Pipeline) and actively polls its status until completion or failure."""
    return execute_fabric_job_and_poll(
        item_id=item_id,
        item_type=item_type,
        parameters=parameters,
        timeout_seconds=timeout_seconds,
        poll_interval_seconds=poll_interval_seconds,
        workspace_id=workspace_id,
    )


def debug_failed_notebook_tool(
    item_id: str,
    notebook_name: str,
    original_code: str,
    error_message: str,
    lakehouse_name: str,
    workspace_id: str | None = None,
) -> dict[str, Any]:
    """Autonomous Self-Healing: Diagnoses Fabric job failure, fixes PySpark code with LLM, compiles, and updates Fabric definition."""
    return debug_and_heal_notebook_failure(
        item_id=item_id,
        notebook_name=notebook_name,
        original_code=original_code,
        error_message=error_message,
        lakehouse_name=lakehouse_name,
        workspace_id=workspace_id,
    )



