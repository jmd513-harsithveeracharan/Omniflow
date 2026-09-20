"""
app/engine/builder.py
---------------------
Stage 3: Assembles worker results into a unified FabricPlan and generates interactive visual DAG layout.
"""

from __future__ import annotations

from app.engine.models import StepDAG, WorkerResult
from app.engine.workspace_mirror import export_plan_to_mirror
from app.ingestion_planner import parse_schedule


def run_builder(dag: StepDAG, worker_results: dict[str, WorkerResult], run_id: str) -> dict:
    """Assembles worker outputs, cloud items, and visual flow DAG nodes into a unified FabricPlan."""
    notebook_steps = [s for s in dag.steps if s.type == "notebook"]
    notebooks = []
    for step in notebook_steps:
        res = worker_results.get(step.step_id)
        code = res.pyspark if res else f"# Missing code for {step.name}"
        notebooks.append({
            "name": step.name,
            "description": step.description,
            "layer": step.layer or "Notebook",
            "pyspark": code,
            "pyspark_code": code,
        })

    lakehouses = [s.name for s in dag.steps if s.type == "lakehouse"]
    warehouses = [s.name for s in dag.steps if s.type == "warehouse"]
    mirrored_databases = [s.name for s in dag.steps if s.type in ("mirrored_database", "mirrored_db")]
    kql_databases = [s.name for s in dag.steps if s.type == "kql_database"]
    kql_querysets = [s.name for s in dag.steps if s.type == "kql_queryset"]
    eventstreams = [s.name for s in dag.steps if s.type == "eventstream"]
    dataflows = [s.name for s in dag.steps if s.type == "dataflow"]
    spark_job_definitions = [s.name for s in dag.steps if s.type in ("spark_job_definition", "spark_job")]
    reflexes = [s.name for s in dag.steps if s.type == "reflex"]
    semantic_models = [s.name for s in dag.steps if s.type == "semantic_model"]
    reports = [s.name for s in dag.steps if s.type == "report"]
    graphql_apis = [s.name for s in dag.steps if s.type == "graphql_api"]
    ml_experiments = [s.name for s in dag.steps if s.type == "ml_experiment"]
    shortcuts = [s.name for s in dag.steps if s.type == "shortcut"]
    environments = [s.name for s in dag.steps if s.type == "environment"]

    pipeline = None
    if dag.pipeline:
        pl = dag.pipeline
        sched_raw = pl.get("schedule", "")
        if isinstance(sched_raw, dict):
            sched_info = sched_raw
        elif isinstance(sched_raw, str) and sched_raw.strip():
            sched_info = parse_schedule(sched_raw)
        else:
            sched_info = parse_schedule(dag.summary or "")
        pipeline = {"name": pl.get("name", f"pl_{dag.folder.lower()}_etl"), "schedule": sched_info}

    # Generate explicit DAG flow nodes & edges for the UI Visual Canvas
    flow_nodes = []
    flow_edges = []
    col_idx = 0
    COL_WIDTH = 300
    ROW_HEIGHT = 96

    # 1. Folder node
    flow_nodes.append({
        "id": "fld_root",
        "label": dag.folder,
        "type": "folder",
        "tag": "FABRIC CONTAINER",
        "sub": "Workspace Directory",
        "status": "live",
        "x": 30,
        "y": 30,
    })
    col_idx += 1

    # 2. Storage Tier (Lakehouses, Warehouses, Mirrored DBs)
    storage_ids = []
    storage_items = [(lh, "lakehouse", "LAKEHOUSE", "Managed Delta Store") for lh in lakehouses] + \
                    [(wh, "warehouse", "SYNAPSE WAREHOUSE", "T-SQL DDL & Direct Lake") for wh in warehouses] + \
                    [(mir, "mirrored_db", "MIRRORED DATABASE", "CDC Zero-ETL Sync") for mir in mirrored_databases]
    for i, (name, itype, tag, sub) in enumerate(storage_items):
        s_id = f"{itype}_{i}"
        flow_nodes.append({
            "id": s_id,
            "label": name,
            "type": itype,
            "tag": tag,
            "sub": sub,
            "status": "pending",
            "x": 30 + col_idx * COL_WIDTH,
            "y": 30 + i * ROW_HEIGHT,
        })
        flow_edges.append({"from": "fld_root", "to": s_id})
        storage_ids.append(s_id)
    if storage_items:
        col_idx += 1

    # 3. Real-Time & Ingestion (Eventstreams, KQL DBs, Dataflows)
    ingest_items = [(es, "eventstream", "REAL-TIME EVENTSTREAM", "Streaming Pipeline") for es in eventstreams] + \
                   [(kql, "kql_database", "KQL DATABASE", "Kusto Telemetry Store") for kql in kql_databases] + \
                   [(df, "dataflow", "DATAFLOW GEN2", "Power Query M Mashup") for df in dataflows]
    for i, (name, itype, tag, sub) in enumerate(ingest_items):
        i_id = f"{itype}_{i}"
        flow_nodes.append({
            "id": i_id,
            "label": name,
            "type": itype,
            "tag": tag,
            "sub": sub,
            "status": "pending",
            "x": 30 + col_idx * COL_WIDTH,
            "y": 30 + i * ROW_HEIGHT,
        })
        flow_edges.append({"from": "fld_root", "to": i_id})
    if ingest_items:
        col_idx += 1

    # 4. Compute & Notebooks
    compute_ids = []
    for i, nb in enumerate(notebooks):
        nb_id = f"nb_{i}"
        nb_layer = nb.get("layer", "PySpark")
        flow_nodes.append({
            "id": nb_id,
            "label": nb.get("name", f"notebook_{i+1}"),
            "type": "notebook",
            "tag": f"{nb_layer.upper()} NOTEBOOK",
            "sub": nb.get("description", "PySpark Code Transformation"),
            "status": "pending",
            "x": 30 + col_idx * COL_WIDTH,
            "y": 30 + i * ROW_HEIGHT,
        })
        compute_ids.append(nb_id)
        if storage_ids:
            target_store = storage_ids[min(i, len(storage_ids) - 1)]
            flow_edges.append({"from": target_store, "to": nb_id})
        elif i == 0:
            flow_edges.append({"from": "fld_root", "to": nb_id})

    for i, sjd_name in enumerate(spark_job_definitions):
        sjd_id = f"sjd_{i}"
        flow_nodes.append({
            "id": sjd_id,
            "label": sjd_name,
            "type": "spark_job",
            "tag": "SPARK JOB DEFINITION",
            "sub": "Batch PySpark Executable",
            "status": "pending",
            "x": 30 + col_idx * COL_WIDTH,
            "y": 30 + (len(notebooks) + i) * ROW_HEIGHT,
        })
        compute_ids.append(sjd_id)
        flow_edges.append({"from": storage_ids[-1] if storage_ids else "fld_root", "to": sjd_id})

    if notebooks or spark_job_definitions:
        col_idx += 1

    # 5. Serving & Analytics
    serving_ids = []
    serving_items = [(sm, "semantic_model", "DIRECT LAKE MODEL", "Power BI Direct Lake TMDL") for sm in semantic_models] + \
                    [(rpt, "report", "POWER BI REPORT", "PBIR Visual Model") for rpt in reports] + \
                    [(kq, "kql_queryset", "KQL QUERYSET", "Kusto Anomaly Queries") for kq in kql_querysets] + \
                    [(rfx, "reflex", "DATA ACTIVATOR", "Real-Time Triggers & Webhooks") for rfx in reflexes] + \
                    [(gql, "graphql_api", "GRAPHQL API", "GraphQL Schema & Resolvers") for gql in graphql_apis] + \
                    [(exp, "ml_experiment", "ML EXPERIMENT", "MLflow Run Tracking") for exp in ml_experiments]

    for i, (name, itype, tag, sub) in enumerate(serving_items):
        srv_id = f"{itype}_{i}"
        flow_nodes.append({
            "id": srv_id,
            "label": name,
            "type": itype,
            "tag": tag,
            "sub": sub,
            "status": "pending",
            "x": 30 + col_idx * COL_WIDTH,
            "y": 30 + i * ROW_HEIGHT,
        })
        serving_ids.append(srv_id)
        if compute_ids:
            flow_edges.append({"from": compute_ids[-1], "to": srv_id})
        elif storage_ids:
            flow_edges.append({"from": storage_ids[-1], "to": srv_id})
        else:
            flow_edges.append({"from": "fld_root", "to": srv_id})
    if serving_items:
        col_idx += 1

    # 6. Pipeline Orchestration
    if pipeline:
        pl_name = pipeline.get("name", f"pl_{dag.folder.lower()}_job")
        pl_sched = pipeline.get("schedule", "Scheduled Trigger DAG")
        max_rows = max(len(notebooks), len(storage_ids), len(serving_items), 1)
        pl_y = max(30, int((max_rows * ROW_HEIGHT) / 2) - 38)
        flow_nodes.append({
            "id": "pl_root",
            "label": pl_name,
            "type": "pipeline",
            "tag": "FABRIC PIPELINE",
            "sub": f"{pl_sched.get('frequency', 'Daily')} Trigger" if isinstance(pl_sched, dict) else str(pl_sched),
            "status": "pending",
            "x": 30 + col_idx * COL_WIDTH,
            "y": pl_y,
        })
        if serving_ids:
            for sid in serving_ids:
                flow_edges.append({"from": sid, "to": "pl_root"})
        elif compute_ids:
            for cid in compute_ids:
                flow_edges.append({"from": cid, "to": "pl_root"})
        elif storage_ids:
            for lid in storage_ids:
                flow_edges.append({"from": lid, "to": "pl_root"})
        else:
            flow_edges.append({"from": "fld_root", "to": "pl_root"})

    plan = {
        "type": "plan",
        "run_id": run_id,
        "folder": dag.folder,
        "lakehouses": lakehouses,
        "warehouses": warehouses,
        "mirrored_databases": mirrored_databases,
        "kql_databases": kql_databases,
        "kql_querysets": kql_querysets,
        "eventstreams": eventstreams,
        "dataflows": dataflows,
        "spark_job_definitions": spark_job_definitions,
        "reflexes": reflexes,
        "semantic_models": semantic_models,
        "reports": reports,
        "graphql_apis": graphql_apis,
        "ml_experiments": ml_experiments,
        "shortcuts": shortcuts,
        "environment": environments[0] if environments else None,
        "environments": environments,
        "notebooks": notebooks,
        "notebooks_preview": [{"name": nb["name"], "pyspark_code": nb["pyspark_code"]} for nb in notebooks],
        "pipeline": pipeline,
        "flow_nodes": flow_nodes,
        "flow_edges": flow_edges,
        "pyspark_code": notebooks[0]["pyspark_code"] if notebooks else "",
        "summary": dag.summary or f"Fabric architecture plan for {dag.folder}",
        "status": "planned",
        "_pipeline_type": "multi_agent",
    }

    try:
        export_plan_to_mirror(plan)
    except Exception:
        pass

    return plan

