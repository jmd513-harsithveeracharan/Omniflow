"""
app/engine/meta_planner.py
--------------------------
Stage 0 (Context Gate) and Stage 1 (Meta-Planner) execution for the 4-Stage State Machine.
"""

from __future__ import annotations

import json
import re
import uuid

from app.engine.models import PipelineState, PipelineStep, StepDAG, extract_json
from app.ingestion_planner import parse_schedule
from app.llm_router import chat
from app.meta_skill import CONTEXT_GATE_SYSTEM, META_PLANNER_SYSTEM


def run_context_gate(state: PipelineState) -> str:
    """Evaluates whether the prompt is an independent task or a follow-up refinement."""
    if not state.current_plan:
        return "independent"
    plan_summary = {
        "folder": state.current_plan.get("folder"),
        "notebooks": [nb.get("name") for nb in state.current_plan.get("notebooks", [])],
        "pipeline": state.current_plan.get("pipeline", {}).get("name") if state.current_plan.get("pipeline") else None,
    }
    msgs = [
        {"role": "system", "content": CONTEXT_GATE_SYSTEM},
        {"role": "user", "content": f"Current plan: {json.dumps(plan_summary)}\n\nNew user prompt: {state.prompt}"},
    ]
    try:
        raw = chat(
            msgs,
            complexity="standard",
            max_tokens=256,
            target_model=state.target_model,
            effort=state.effort,
            session_id=state.session_id,
        )
        parsed = extract_json(raw)
        if parsed and parsed.get("mode") in ("follow_up", "independent"):
            return parsed["mode"]
    except Exception:
        pass
    prompt_lower = state.prompt.lower()
    names = (plan_summary.get("notebooks") or []) + [plan_summary.get("folder") or "", plan_summary.get("pipeline") or ""]
    overlap = any(n.lower() in prompt_lower for n in names if n)
    return "follow_up" if overlap else "independent"


def run_meta_planner(state: PipelineState) -> StepDAG:
    """Decomposes the natural language directive into a typed execution StepDAG."""
    context_hint = ""
    if state.context_mode == "follow_up" and state.current_plan:
        context_hint = "\n\nExisting session context (for follow-up refinements only):\n" + json.dumps({
            "folder": state.current_plan.get("folder"),
            "notebooks": [n.get("name") for n in state.current_plan.get("notebooks", [])],
            "pipeline": state.current_plan.get("pipeline", {}).get("name") if state.current_plan.get("pipeline") else None,
        })

    msgs = [
        {"role": "system", "content": META_PLANNER_SYSTEM},
        {"role": "user", "content": state.prompt + context_hint},
    ]
    raw = ""
    for attempt in range(2):
        try:
            raw = chat(
                msgs,
                complexity="high",
                max_tokens=8192,
                target_model=state.target_model,
                effort=state.effort,
                session_id=state.session_id,
            )
            parsed = extract_json(raw)
            if parsed and parsed.get("steps"):
                break
        except Exception:
            if attempt == 1:
                break
    else:
        parsed = extract_json(raw)

    if not parsed or not parsed.get("steps"):
        return heuristic_dag(state.prompt)

    steps = []
    for s in parsed.get("steps", []):
        steps.append(PipelineStep(
            step_id=s.get("step_id", f"step_{uuid.uuid4().hex[:4]}"),
            type=s.get("type", "notebook"),
            name=s.get("name", "nb_transform"),
            layer=s.get("layer"),
            description=s.get("description", ""),
            depends_on=s.get("depends_on", []),
            can_parallel=s.get("can_parallel", False),
        ))

    lh_names = [s.name for s in steps if s.type == "lakehouse"]
    if not lh_names:
        folder_prefix = parsed.get("folder", "AI_Test_Folder").lower()
        if folder_prefix == "ai_test_folder":
            folder_prefix = "enterprise"
        lh_names = [f"lh_{folder_prefix}_bronze", f"lh_{folder_prefix}_silver", f"lh_{folder_prefix}_gold"]

    return StepDAG(
        context_mode=parsed.get("context_mode", state.context_mode),
        folder=parsed.get("folder", "AI_Test_Folder"),
        steps=steps,
        pipeline=parsed.get("pipeline"),
        summary=parsed.get("summary", ""),
        lakehouses=lh_names,
    )


def heuristic_dag(prompt: str) -> StepDAG:
    """Regex-based fallback StepDAG if LLM JSON is malformed."""
    folder = "AI_Test_Folder"
    fm = re.search(r"\b(?:project\s+folder|folder|project)\s+(?:like|named|called|for)?\s*['\"]?([A-Za-z0-9_\-]+)", prompt, re.IGNORECASE)
    if fm and fm.group(1).lower() not in ("named", "called", "folder", "like", "for"):
        folder = fm.group(1).strip()
    else:
        nm = re.search(r"\b(?:named|called|like)\s+['\"]?([A-Za-z0-9_\-]+)", prompt, re.IGNORECASE)
        if nm and nm.group(1).lower() not in ("named", "called", "folder", "like"):
            folder = nm.group(1).strip()

    nb_lines = re.findall(r"[-*\u2022]?\s*(nb_[a-zA-Z0-9_\-]+)\s*[:\-]\s*([^\n\r]+)", prompt, re.IGNORECASE)
    nb_tokens = list(dict.fromkeys(re.findall(r"\b(nb_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))

    # Detect numeric notebook counts e.g. "3 nb", "3 notebooks"
    # Detect Medallion layers or numeric counts
    # Detect multi-entity domain lists (e.g. Customers, Orders, Products or Patients, Encounters, Claims)
    entity_matches = re.findall(r"\b(customers?|orders?|products?|shipments?|inventory|suppliers?|claims?|patients?|encounters?|invoices?|payments?)\b", prompt, re.IGNORECASE)
    unique_entities = list(dict.fromkeys([e.lower().rstrip("s") for e in entity_matches]))

    # Detect numeric notebook counts e.g. "3 nb", "3 notebooks" or Medallion layers
    if not nb_lines and not nb_tokens:
        count_m = re.search(r"\b(\d+)\s*(?:nb|notebooks?|pyspark)\b", prompt, re.IGNORECASE)
        is_medallion = (
            "medallion" in prompt.lower()
            or ("bronze" in prompt.lower() and "silver" in prompt.lower())
            or bool(re.search(r"\blh_[a-zA-Z0-9_\-]+_(?:bronze|silver|gold)\b", prompt, re.IGNORECASE))
            or len(unique_entities) >= 2
        )
        if count_m:
            cnt = int(count_m.group(1))
            prefix = folder.lower() if folder != "AI_Test_Folder" else "medallion"
            if cnt == 3:
                nb_lines = [
                    (f"nb_{prefix}_bronze_ingest", "Raw data ingestion and schema validation"),
                    (f"nb_{prefix}_silver_merge", "Delta Lake MERGE deduplication and SCD upsert"),
                    (f"nb_{prefix}_gold_star", "Kimball dimensional modeling and star schema aggregations"),
                ]
            else:
                nb_lines = [
                    (f"nb_{prefix}_stage_{i+1}", f"PySpark data processing activity {i+1}")
                    for i in range(cnt)
                ]
        elif len(unique_entities) >= 2:
            prefix = folder.lower() if folder != "AI_Test_Folder" else "enterprise"
            nb_lines = []
            for ent in unique_entities:
                nb_lines.append((f"nb_{prefix}_{ent}_bronze", f"Ingest raw {ent} source data into immutable Bronze Delta table"))
                nb_lines.append((f"nb_{prefix}_{ent}_silver", f"Deduplicate, cleanse, and conform {ent} into Silver table"))
            nb_lines.append((f"nb_{prefix}_fact_gold", f"Construct Kimball star-schema Fact table joining Silver {' + '.join(unique_entities)}"))
        elif is_medallion:
            prefix = folder.lower() if folder != "AI_Test_Folder" else "medallion"
            lh_m = re.search(r"\blh_([a-zA-Z0-9_\-]+)_(?:bronze|silver|gold)\b", prompt, re.IGNORECASE)
            if lh_m:
                prefix = lh_m.group(1).lower()
            elif re.search(r'["\']([A-Za-z0-9_\-]+)["\']', prompt):
                prefix = re.search(r'["\']([A-Za-z0-9_\-]+)["\']', prompt).group(1).lower()
            nb_lines = [
                (f"nb_{prefix}_bronze_ingestion", "Ingest raw source data streams and relational tables into immutable Bronze Delta Lake tables with ingestion timestamps and lineage tags."),
                (f"nb_{prefix}_silver_transformation", "Cleanse, type-cast, deduplicate, compute excursion flags, enforce Great Expectations data quality rules, and perform idempotent Delta Lake MERGE on primary keys."),
                (f"nb_{prefix}_gold_starschema", "Construct Kimball star-schema dimensional models (Fact and Dimension tables) with business aggregations optimized for Power BI Direct Lake consumption."),
            ]

    # Structure folder steps with containment inside AI_Test_Folder
    if folder != "AI_Test_Folder":
        steps = [
            PipelineStep(step_id="step_root_folder", type="folder", name="AI_Test_Folder", layer=None,
                         description="Workspace containment sandbox root", depends_on=[], can_parallel=False),
            PipelineStep(step_id="step_folder", type="folder", name=f"AI_Test_Folder/{folder}", layer=None,
                         description=f"Project folder {folder} inside AI_Test_Folder", depends_on=["step_root_folder"], can_parallel=False),
        ]
    else:
        steps = [PipelineStep(step_id="step_folder", type="folder", name=folder, layer=None,
                              description=f"Create folder {folder}", depends_on=[], can_parallel=False)]
    nb_step_ids = []

    if nb_lines:
        for nb_name, desc in nb_lines:
            sid = f"step_{nb_name.strip().lower()}"
            layer = "Bronze" if "bronze" in nb_name.lower() else ("Silver" if "silver" in nb_name.lower() else ("Gold" if "gold" in nb_name.lower() else "Notebook"))
            deps = ["step_folder"]
            if layer == "Silver":
                matching_b = [s.step_id for s in steps if s.layer == "Bronze" and any(part in s.name for part in nb_name.lower().split("_") if part not in ("nb", "silver", "transformation", "merge"))]
                deps = matching_b if matching_b else ([s.step_id for s in steps if s.layer == "Bronze"][-1:] or ["step_folder"])
            elif layer == "Gold":
                all_silver = [s.step_id for s in steps if s.layer == "Silver"]
                deps = all_silver if all_silver else ([s.step_id for s in steps if s.layer in ("Bronze", "Silver")][-1:] or ["step_folder"])

            steps.append(PipelineStep(
                step_id=sid,
                type="notebook",
                name=nb_name.strip(),
                layer=layer,
                description=desc.strip(),
                depends_on=deps,
                can_parallel=(layer in ("Bronze", "Notebook")),
            ))
            nb_step_ids.append(sid)
    elif nb_tokens:
        for tok in nb_tokens:
            sid = f"step_{tok.lower()}"
            layer = "Bronze" if "bronze" in tok.lower() else ("Silver" if "silver" in tok.lower() else ("Gold" if "gold" in tok.lower() else "Notebook"))
            deps = ["step_folder"]
            if layer == "Silver":
                matching_b = [s.step_id for s in steps if s.layer == "Bronze"]
                deps = matching_b[-1:] if matching_b else ["step_folder"]
            elif layer == "Gold":
                all_silver = [s.step_id for s in steps if s.layer == "Silver"]
                deps = all_silver if all_silver else ["step_folder"]

            steps.append(PipelineStep(
                step_id=sid,
                type="notebook",
                name=tok,
                layer=layer,
                description=f"PySpark notebook {tok}",
                depends_on=deps,
                can_parallel=(layer in ("Bronze", "Notebook")),
            ))
            nb_step_ids.append(sid)
    elif "notebook" in prompt.lower():
        algo_m = re.search(r"with\s+([A-Za-z0-9_\-]+)\s+code", prompt, re.IGNORECASE)
        nb_m = re.search(r"notebook\s+(?:named\s+|called\s+)?([A-Za-z0-9_\-]+)", prompt, re.IGNORECASE)
        name_cand = algo_m.group(1) if algo_m else (nb_m.group(1) if nb_m else "transform")
        if not name_cand.startswith("nb_"):
            name_cand = f"nb_{name_cand}"
        sid = f"step_{name_cand.lower()}"
        steps.append(PipelineStep(
            step_id=sid,
            type="notebook",
            name=name_cand,
            layer="Notebook",
            description=f"PySpark algorithm notebook {name_cand}",
            depends_on=["step_folder"],
            can_parallel=True,
        ))
        nb_step_ids.append(sid)

    lh_tokens = list(dict.fromkeys(re.findall(r"\b(lh_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    if not lh_tokens and "lakehouse" in prompt.lower():
        prefix = folder.lower() if folder != "AI_Test_Folder" else "enterprise"
        lh_tokens = [f"lh_{prefix}_bronze", f"lh_{prefix}_silver", f"lh_{prefix}_gold"]
    for lh in lh_tokens:
        steps.append(PipelineStep(step_id=f"step_{lh}", type="lakehouse", name=lh, layer=None,
                                  description=f"Create lakehouse {lh}", depends_on=["step_folder"], can_parallel=True))

    wh_tokens = list(dict.fromkeys(re.findall(r"\b(wh_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    if not wh_tokens and "warehouse" in prompt.lower():
        prefix = folder.lower() if folder != "AI_Test_Folder" else "enterprise"
        wh_tokens = [f"wh_{prefix}_analytics"]
    for wh in wh_tokens:
        steps.append(PipelineStep(step_id=f"step_{wh}", type="warehouse", name=wh, layer=None,
                                  description=f"Synapse Warehouse {wh}", depends_on=["step_folder"], can_parallel=True))

    mir_tokens = list(dict.fromkeys(re.findall(r"\b(mir_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    for mir in mir_tokens:
        steps.append(PipelineStep(step_id=f"step_{mir}", type="mirrored_db", name=mir, layer=None,
                                  description=f"Mirrored Database {mir}", depends_on=["step_folder"], can_parallel=True))

    env_tokens = list(dict.fromkeys(re.findall(r"\b(env_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    if not env_tokens and "environment" in prompt.lower():
        env_tokens = [f"env_{folder.lower()}_runtime"]
    for env in env_tokens:
        steps.append(PipelineStep(step_id=f"step_{env}", type="environment", name=env, layer=None,
                                  description=f"Fabric Environment {env}", depends_on=["step_folder"], can_parallel=True))

    kql_tokens = list(dict.fromkeys(re.findall(r"\b(kql_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    for kql in kql_tokens:
        steps.append(PipelineStep(step_id=f"step_{kql}", type="kql_database", name=kql, layer=None,
                                  description=f"KQL Database {kql}", depends_on=["step_folder"], can_parallel=True))

    for kq in list(dict.fromkeys(re.findall(r"\b(kq_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE))):
        steps.append(PipelineStep(step_id=f"step_{kq}", type="kql_queryset", name=kq, layer=None, description=f"KQL Queryset {kq}", depends_on=["step_folder"], can_parallel=True))

    for es in list(dict.fromkeys(re.findall(r"\b(es_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE))):
        steps.append(PipelineStep(step_id=f"step_{es}", type="eventstream", name=es, layer=None, description=f"Real-Time Eventstream {es}", depends_on=["step_folder"], can_parallel=True))

    for df in list(dict.fromkeys(re.findall(r"\b(df_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE))):
        steps.append(PipelineStep(step_id=f"step_{df}", type="dataflow", name=df, layer=None, description=f"Dataflow Gen2 {df}", depends_on=["step_folder"], can_parallel=True))

    for sjd in list(dict.fromkeys(re.findall(r"\b(sjd_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE))):
        steps.append(PipelineStep(step_id=f"step_{sjd}", type="spark_job", name=sjd, layer=None, description=f"Spark Job Definition {sjd}", depends_on=["step_folder"], can_parallel=True))

    for rfx in list(dict.fromkeys(re.findall(r"\b(rfx_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE))):
        steps.append(PipelineStep(step_id=f"step_{rfx}", type="reflex", name=rfx, layer=None, description=f"Data Activator Reflex {rfx}", depends_on=["step_folder"], can_parallel=True))

    sm_tokens = list(dict.fromkeys(re.findall(r"\b(sm_[a-zA-Z0-9_\-]+|sem_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    if not sm_tokens and "semantic model" in prompt.lower():
        sm_tokens = [f"sm_{folder.lower()}_gold"]
    for sm in sm_tokens:
        steps.append(PipelineStep(step_id=f"step_{sm}", type="semantic_model", name=sm, layer="Gold", description=f"Direct Lake Semantic Model {sm}", depends_on=nb_step_ids or ["step_folder"], can_parallel=True))

    for rpt in list(dict.fromkeys(re.findall(r"\b(rpt_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE))):
        steps.append(PipelineStep(step_id=f"step_{rpt}", type="report", name=rpt, layer=None, description=f"Power BI Report {rpt}", depends_on=nb_step_ids or ["step_folder"], can_parallel=True))

    for gql in list(dict.fromkeys(re.findall(r"\b(gql_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE))):
        steps.append(PipelineStep(step_id=f"step_{gql}", type="graphql_api", name=gql, layer=None, description=f"GraphQL API {gql}", depends_on=nb_step_ids or ["step_folder"], can_parallel=True))

    for exp in list(dict.fromkeys(re.findall(r"\b(mlexp_[a-zA-Z0-9_\-]+|exp_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE))):
        steps.append(PipelineStep(step_id=f"step_{exp}", type="ml_experiment", name=exp, layer=None, description=f"ML Experiment {exp}", depends_on=["step_folder"], can_parallel=True))

    sc_tokens = list(dict.fromkeys(re.findall(r"\b(sc_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)))
    if not sc_tokens and "shortcut" in prompt.lower():
        sc_tokens = [f"sc_{folder.lower()}_raw"]
    for sc in sc_tokens:
        steps.append(PipelineStep(step_id=f"step_{sc}", type="shortcut", name=sc, layer=None, description=f"OneLake Shortcut {sc}", depends_on=["step_folder"], can_parallel=True))

    pl_match = re.search(r"\b(pl_[a-zA-Z0-9_\-]+)\b", prompt, re.IGNORECASE)
    pl_name = pl_match.group(1) if pl_match else f"pl_{folder.lower()}_etl"
    sched = parse_schedule(prompt)
    pipeline_dict = {"name": pl_name, "schedule": sched}

    steps.append(PipelineStep(step_id="step_pipeline", type="pipeline", name=pl_name, layer=None,
                               description=f"Pipeline {pl_name}", depends_on=nb_step_ids or ["step_folder"],
                               can_parallel=False))

    nb_desc = f"{len(nb_step_ids)} notebook(s)" if nb_step_ids else "PySpark pipeline"
    sched_text = sched.get("human", "Daily") if isinstance(sched, dict) else str(sched)
    return StepDAG(
        context_mode="independent",
        folder=folder,
        steps=steps,
        pipeline=pipeline_dict,
        summary=f"Architecture plan for folder '{folder}' with {nb_desc} orchestrated by pipeline '{pl_name}' ({sched_text}).",
    )

