"""
app/deployment_executor.py
--------------------------
Universal Multi-Phase Deployment Engine for Microsoft Fabric.
Deploys granular items (Folders, Environments, Lakehouses, Warehouses,
Mirrored Databases, KQL Databases, KQL Querysets, Eventstreams, Dataflows,
Notebooks, Spark Job Definitions, Reflexes, Semantic Models, Reports,
GraphQL APIs, Shortcuts, ML Assets, Pipelines) with topological ordering
and cyclic self-healing.
"""

from __future__ import annotations

import logging
import time
import uuid
from datetime import UTC, datetime
from typing import Any

from pydantic import BaseModel, Field

from app.config import ALLOWED_WORKSPACE_ID
from app.fabric_client import (
    create_onelake_shortcut,
    create_pipeline_schedule,
    get_or_create_folder,
    provision_item_with_definition,
)
from app.fabric_compiler import (
    compile_dataflow,
    compile_environment,
    compile_eventstream,
    compile_graphql_api,
    compile_kql_database,
    compile_kql_queryset,
    compile_lakehouse,
    compile_mirrored_database,
    compile_ml_experiment,
    compile_ml_model,
    compile_notebook,
    compile_pipeline,
    compile_reflex,
    compile_report,
    compile_semantic_model,
    compile_spark_job_definition,
    compile_warehouse,
)
from app.self_healer import diagnose_and_patch_code

logger = logging.getLogger("fabric_ai.deployment_executor")


class DeploymentStepResult(BaseModel):
    step_id: str
    item_type: str
    name: str
    status: str = "success"  # success | failed | healed | skipped
    item_id: str | None = None
    details: str = ""
    error: str | None = None
    retry_count: int = 0
    duration_sec: float = 0.0


class DeploymentReport(BaseModel):
    run_id: str
    workspace_id: str
    folder_name: str
    folder_id: str | None = None
    status: str = "completed"  # completed | partial | failed
    started_at: str = Field(default_factory=lambda: datetime.now(UTC).isoformat())
    completed_at: str = ""
    duration_sec: float = 0.0
    deployed_items: list[DeploymentStepResult] = Field(default_factory=list)
    errors: list[str] = Field(default_factory=list)


def _now_utc() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + " UTC"


def _deploy_notebook_with_healing(
    name: str, pyspark_code: str, folder_id: str | None, workspace_id: str, max_retries: int = 2
) -> DeploymentStepResult:
    """Provisions a PySpark notebook with automated cyclic self-healing retries."""
    t0 = time.perf_counter()
    code, retries, last_error = pyspark_code, 0, None

    while retries <= max_retries:
        payload = compile_notebook(name, code)
        parts = payload.get("definition", {}).get("parts", [])
        res = provision_item_with_definition(name, "Notebook", parts=parts, folder_id=folder_id, workspace_id=workspace_id)
        if res.get("success"):
            return DeploymentStepResult(
                step_id=f"nb_{name}", item_type="notebook", name=name,
                status="healed" if retries > 0 else "success",
                item_id=res.get("item_id"),
                details=f"Deployed {name} successfully" + (f" after {retries} retry(ies)" if retries else ""),
                retry_count=retries, duration_sec=round(time.perf_counter() - t0, 2),
            )
        last_error = res.get("error", "Deployment error")
        if retries < max_retries:
            heal = diagnose_and_patch_code(code, last_error, notebook_name=name)
            if heal.get("success") and heal.get("patched_code"):
                code = heal["patched_code"]
        retries += 1

    return DeploymentStepResult(
        step_id=f"nb_{name}", item_type="notebook", name=name, status="failed",
        error=last_error, retry_count=retries - 1, duration_sec=round(time.perf_counter() - t0, 2),
    )


def deploy_fabric_plan(
    plan: dict[str, Any], workspace_id: str = ALLOWED_WORKSPACE_ID, session_id: str | None = None
) -> DeploymentReport:
    """Executes a multi-tier Fabric architecture plan end-to-end to Microsoft Fabric."""
    t_start = time.perf_counter()
    run_id = plan.get("run_id") or f"run_{uuid.uuid4().hex[:8]}"
    folder_name = plan.get("folder") or "AI_Test_Folder"
    report = DeploymentReport(run_id=run_id, workspace_id=workspace_id, folder_name=folder_name, started_at=_now_utc())
    lakehouse_ids: dict[str, str] = {}
    semantic_model_ids: dict[str, str] = {}
    notebook_ids: list[str] = []

    # 1. Folder Containment: Always ensure AI_Test_Folder root sandbox, and nest custom project subfolder
    try:
        root_folder_id = get_or_create_folder("AI_Test_Folder", workspace_id)
        report.deployed_items.append(DeploymentStepResult(step_id="fld_root", item_type="folder", name="AI_Test_Folder", item_id=root_folder_id))

        if folder_name and folder_name != "AI_Test_Folder":
            subfolder_clean = folder_name.replace("AI_Test_Folder/", "").strip()
            folder_id = get_or_create_folder(subfolder_clean, workspace_id, parent_folder_id=root_folder_id)
            report.folder_id = folder_id or root_folder_id
            report.deployed_items.append(DeploymentStepResult(step_id="fld_sub", item_type="folder", name=f"AI_Test_Folder/{subfolder_clean}", item_id=folder_id))
        else:
            folder_id = root_folder_id
            report.folder_id = root_folder_id
    except Exception as e:
        report.errors.append(f"Folder error: {e}")
        folder_id = None

    # 2. Environments
    for env in (plan.get("environments", []) or ([plan["environment"]] if plan.get("environment") else [])):
        ename = env.get("name") if isinstance(env, dict) else str(env)
        ep = compile_environment(ename, extra_packages=env.get("packages", []) if isinstance(env, dict) else [])
        res = provision_item_with_definition(ename, "Environment", parts=ep["definition"]["parts"], folder_id=folder_id, workspace_id=workspace_id)
        report.deployed_items.append(DeploymentStepResult(step_id=f"env_{ename}", item_type="environment", name=ename, status="success" if res.get("success") else "failed", item_id=res.get("item_id"), error=res.get("error")))

    # 3. Storage Tier: Lakehouses, Warehouses & Mirrored DBs
    for lh in plan.get("lakehouses", []):
        lhname = lh.get("name") if isinstance(lh, dict) else str(lh)
        lp = compile_lakehouse(lhname)
        res = provision_item_with_definition(lhname, "Lakehouse", parts=lp["definition"]["parts"], folder_id=folder_id, workspace_id=workspace_id)
        if res.get("item_id"):
            lakehouse_ids[lhname] = res["item_id"]
        report.deployed_items.append(DeploymentStepResult(step_id=f"lh_{lhname}", item_type="lakehouse", name=lhname, status="success" if res.get("success") else "failed", item_id=res.get("item_id"), error=res.get("error")))

    for wh in plan.get("warehouses", []):
        whname = wh.get("name") if isinstance(wh, dict) else str(wh)
        wp = compile_warehouse(whname, tables=wh.get("tables", plan.get("tables", [])) if isinstance(wh, dict) else plan.get("tables", []))
        res = provision_item_with_definition(whname, "Warehouse", parts=wp["definition"]["parts"], folder_id=folder_id, workspace_id=workspace_id)
        report.deployed_items.append(DeploymentStepResult(step_id=f"wh_{whname}", item_type="warehouse", name=whname, status="success" if res.get("success") else "failed", item_id=res.get("item_id"), error=res.get("error")))

    for mir in plan.get("mirrored_databases", []):
        mname = mir.get("name") if isinstance(mir, dict) else str(mir)
        mp = compile_mirrored_database(mname)
        res = provision_item_with_definition(mname, "MirroredDatabase", parts=mp["definition"]["parts"], folder_id=folder_id, workspace_id=workspace_id)
        report.deployed_items.append(DeploymentStepResult(step_id=f"mir_{mname}", item_type="mirrored_database", name=mname, status="success" if res.get("success") else "failed", item_id=res.get("item_id"), error=res.get("error")))

    # 4. Real-Time Analytics: KQL Databases, Eventstreams & Querysets
    for kql in plan.get("kql_databases", []):
        kname = kql.get("name") if isinstance(kql, dict) else str(kql)
        kp = compile_kql_database(kname, tables=kql.get("tables", []) if isinstance(kql, dict) else [])
        res = provision_item_with_definition(kname, "KQLDatabase", parts=kp["definition"]["parts"], folder_id=folder_id, workspace_id=workspace_id)
        report.deployed_items.append(DeploymentStepResult(step_id=f"kql_{kname}", item_type="kql_database", name=kname, status="success" if res.get("success") else "failed", item_id=res.get("item_id"), error=res.get("error")))

    for kq in plan.get("kql_querysets", []):
        kqname = kq.get("name") if isinstance(kq, dict) else str(kq)
        kqp = compile_kql_queryset(kqname, target_db=kq.get("database", "KQLDatabase") if isinstance(kq, dict) else "KQLDatabase")
        res = provision_item_with_definition(kqname, "KQLQueryset", parts=kqp["definition"]["parts"], folder_id=folder_id, workspace_id=workspace_id)
        report.deployed_items.append(DeploymentStepResult(step_id=f"kq_{kqname}", item_type="kql_queryset", name=kqname, status="success" if res.get("success") else "failed", item_id=res.get("item_id"), error=res.get("error")))

    for es in plan.get("eventstreams", []):
        esname = es.get("name") if isinstance(es, dict) else str(es)
        esp = compile_eventstream(esname, source_type=es.get("source_type", "CustomApp") if isinstance(es, dict) else "CustomApp")
        res = provision_item_with_definition(esname, "Eventstream", parts=esp["definition"]["parts"], folder_id=folder_id, workspace_id=workspace_id)
        report.deployed_items.append(DeploymentStepResult(step_id=f"es_{esname}", item_type="eventstream", name=esname, status="success" if res.get("success") else "failed", item_id=res.get("item_id"), error=res.get("error")))

    # 5. Low-Code & Compute Tier: Dataflows, Notebooks & Spark Job Definitions
    for df in plan.get("dataflows", []):
        dfname = df.get("name") if isinstance(df, dict) else str(df)
        dfp = compile_dataflow(dfname, lakehouse_name=list(lakehouse_ids.keys())[0] if lakehouse_ids else "lh_bronze")
        res = provision_item_with_definition(dfname, "Dataflow", parts=dfp["definition"]["parts"], folder_id=folder_id, workspace_id=workspace_id)
        report.deployed_items.append(DeploymentStepResult(step_id=f"df_{dfname}", item_type="dataflow", name=dfname, status="success" if res.get("success") else "failed", item_id=res.get("item_id"), error=res.get("error")))

    for nb in plan.get("notebooks", []):
        nb_name = nb.get("name", "nb_transform") if isinstance(nb, dict) else str(nb)
        nb_code = nb.get("pyspark_code") or nb.get("pyspark", "") if isinstance(nb, dict) else ""
        step = _deploy_notebook_with_healing(nb_name, nb_code, folder_id, workspace_id)
        if step.item_id:
            notebook_ids.append(step.item_id)
        if step.status == "failed" and step.error:
            report.errors.append(f"Notebook '{nb_name}' failed: {step.error}")
        report.deployed_items.append(step)

    for sjd in plan.get("spark_job_definitions", []):
        sname = sjd.get("name") if isinstance(sjd, dict) else str(sjd)
        sjp = compile_spark_job_definition(sname, lakehouse_name=list(lakehouse_ids.keys())[-1] if lakehouse_ids else "lh_gold")
        res = provision_item_with_definition(sname, "SparkJobDefinition", parts=sjp["definition"]["parts"], folder_id=folder_id, workspace_id=workspace_id)
        report.deployed_items.append(DeploymentStepResult(step_id=f"sjd_{sname}", item_type="spark_job_definition", name=sname, status="success" if res.get("success") else "failed", item_id=res.get("item_id"), error=res.get("error")))

    # 6. Action Triggers: Reflexes (Data Activator)
    for rfx in plan.get("reflexes", []):
        rname = rfx.get("name") if isinstance(rfx, dict) else str(rfx)
        rp = compile_reflex(rname, rules=rfx.get("rules") if isinstance(rfx, dict) else None)
        res = provision_item_with_definition(rname, "Reflex", parts=rp["definition"]["parts"], folder_id=folder_id, workspace_id=workspace_id)
        report.deployed_items.append(DeploymentStepResult(step_id=f"rfx_{rname}", item_type="reflex", name=rname, status="success" if res.get("success") else "failed", item_id=res.get("item_id"), error=res.get("error")))

    # 7. Semantic Models & Power BI Reports
    for sm in plan.get("semantic_models", []):
        sm_name = sm.get("name") if isinstance(sm, dict) else str(sm)
        target_lh = sm.get("lakehouse_name") if isinstance(sm, dict) else (list(lakehouse_ids.keys())[-1] if lakehouse_ids else "lh_gold")
        target_lh_id = lakehouse_ids.get(target_lh, str(uuid.uuid4()))
        sp = compile_semantic_model(name=sm_name, lakehouse_id=target_lh_id, lakehouse_name=target_lh, workspace_id=workspace_id, tables=sm.get("tables", plan.get("tables", [])) if isinstance(sm, dict) else plan.get("tables", []))
        res = provision_item_with_definition(sm_name, "SemanticModel", parts=sp["definition"]["parts"], folder_id=folder_id, workspace_id=workspace_id)
        if res.get("item_id"):
            semantic_model_ids[sm_name] = res["item_id"]
        report.deployed_items.append(DeploymentStepResult(step_id=f"sm_{sm_name}", item_type="semantic_model", name=sm_name, status="success" if res.get("success") else "failed", item_id=res.get("item_id"), error=res.get("error")))

    for rpt in plan.get("reports", []):
        rname = rpt.get("name") if isinstance(rpt, dict) else str(rpt)
        sm_target = rpt.get("semantic_model", list(semantic_model_ids.keys())[-1] if semantic_model_ids else "sm_model") if isinstance(rpt, dict) else "sm_model"
        sm_id = semantic_model_ids.get(sm_target, str(uuid.uuid4()))
        rp = compile_report(rname, semantic_model_id=sm_id, semantic_model_name=sm_target)
        res = provision_item_with_definition(rname, "Report", parts=rp["definition"]["parts"], folder_id=folder_id, workspace_id=workspace_id)
        report.deployed_items.append(DeploymentStepResult(step_id=f"rpt_{rname}", item_type="report", name=rname, status="success" if res.get("success") else "failed", item_id=res.get("item_id"), error=res.get("error")))

    # 8. GraphQL APIs, Data Science Assets & Shortcuts
    for gql in plan.get("graphql_apis", []):
        gname = gql.get("name") if isinstance(gql, dict) else str(gql)
        gp = compile_graphql_api(gname, tables=gql.get("tables", plan.get("tables", [])) if isinstance(gql, dict) else plan.get("tables", []))
        res = provision_item_with_definition(gname, "GraphQLApi", parts=gp["definition"]["parts"], folder_id=folder_id, workspace_id=workspace_id)
        report.deployed_items.append(DeploymentStepResult(step_id=f"gql_{gname}", item_type="graphql_api", name=gname, status="success" if res.get("success") else "failed", item_id=res.get("item_id"), error=res.get("error")))

    for exp in plan.get("ml_experiments", []):
        xname = exp.get("name") if isinstance(exp, dict) else str(exp)
        xp = compile_ml_experiment(xname)
        res = provision_item_with_definition(xname, "MLExperiment", parts=xp["definition"]["parts"], folder_id=folder_id, workspace_id=workspace_id)
        report.deployed_items.append(DeploymentStepResult(step_id=f"exp_{xname}", item_type="ml_experiment", name=xname, status="success" if res.get("success") else "failed", item_id=res.get("item_id"), error=res.get("error")))

    for sc in plan.get("shortcuts", []):
        sc_name = sc.get("name", "shortcut") if isinstance(sc, dict) else str(sc)
        sc_lh_id = lakehouse_ids.get(sc.get("lakehouse_name", ""), list(lakehouse_ids.values())[0] if lakehouse_ids else "")
        if sc_lh_id and isinstance(sc, dict) and sc.get("payload"):
            res = create_onelake_shortcut(sc_lh_id, sc["payload"], workspace_id=workspace_id)
            report.deployed_items.append(DeploymentStepResult(step_id=f"sc_{sc_name}", item_type="shortcut", name=sc_name, status="success" if res.get("success") else "failed", details=f"Shortcut '{sc_name}' deployed", error=res.get("error")))

    # 9. Master Orchestration Pipeline
    pipeline = plan.get("pipeline")
    if pipeline:
        pl_name = pipeline.get("name", f"pl_{folder_name.lower()}_etl") if isinstance(pipeline, dict) else str(pipeline)
        sched_info = pipeline.get("schedule") if isinstance(pipeline, dict) else None
        cron = sched_info.get("cron") if isinstance(sched_info, dict) else (str(sched_info) if sched_info else None)
        _, update_parts = compile_pipeline(name=pl_name, notebook_ids=notebook_ids, workspace_id=workspace_id, schedule_cron=cron)
        res = provision_item_with_definition(pl_name, "DataPipeline", parts=update_parts, folder_id=folder_id, workspace_id=workspace_id)
        pl_id = res.get("item_id")
        report.deployed_items.append(DeploymentStepResult(step_id="pl_root", item_type="pipeline", name=pl_name, status="success" if res.get("success") else "failed", item_id=pl_id, error=res.get("error")))
        if pl_id and cron:
            time_str = sched_info.get("time_str", "02:00") if isinstance(sched_info, dict) else "02:00"
            create_pipeline_schedule(pl_id, time_str=time_str, schedule_type="Daily", workspace_id=workspace_id)

    report.completed_at = _now_utc()
    report.duration_sec = round(time.perf_counter() - t_start, 2)
    report.status = "completed" if not report.errors else ("partial" if any(i.status in ("success", "healed") for i in report.deployed_items) else "failed")
    return report
