import json
import pytest
from omniflow.intake.helpers import build_dynamic_plan_object

def test_plan_naming_and_pipeline_activities():
    with open("omniflow/intake/project_intake_retail_postgres.json", "r", encoding="utf-8") as f:
        intake = json.load(f)

    p_sum = intake["project_context"]["project_summary"]
    proj_name = p_sum["project_name"]
    proj_code = p_sum["project_code"]
    clean_dom = p_sum["business_domain"]
    sol_sum = intake["project_context"].get("solution_summary", {})
    t_folders = sol_sum.get("target_folder_structure", {})
    root_f = t_folders.get("root_folder", "Retail_Omnichannel_Platform")
    sub_f = t_folders.get("subfolders", {"raw": "01 Raw", "stage": "02 Stage", "silver": "03 Silver", "gold": "04 Gold", "orchestration": "Pipeline Orchestration"})

    plan_obj, summary = build_dynamic_plan_object(
        intake=intake,
        res=None,
        proj_name=proj_name,
        proj_code=proj_code,
        clean_dom=clean_dom,
        root_f=root_f,
        sub_f=sub_f,
        ws_display="PBT_DATA_AGENT",
    )

    items = plan_obj.get("items", [])
    assert len(items) == 14, f"Expected 14 items, got {len(items)}"

    item_names = {it["name"] for it in items}
    
    # Verify simplified naming conventions
    assert "lh_retail_bronze" in item_names
    assert "lh_retail_silver" in item_names
    assert "wh_retail_gold" in item_names
    assert "sm_retail_gold" in item_names
    assert "pl_retail_ingest" in item_names
    assert "pl_master_orchestration" in item_names
    assert "nb_00_ingest_postgres_raw" in item_names
    assert "nb_01_curate_customers_loyalty" in item_names
    assert "nb_06_silver_conformed" in item_names
    assert "nb_07_quality_suite" in item_names

    # Verify Pipelines have activities and policy blocks
    for it in items:
        if it["type"] in ("DataPipeline", "Pipeline"):
            p = it.get("pipeline")
            assert p is not None, f"Pipeline {it['name']} has no definition"
            activities = p.get("properties", {}).get("activities", [])
            assert len(activities) > 0, f"Pipeline {it['name']} has 0 activities!"
            
            for act in activities:
                assert "policy" in act, f"Activity {act['name']} in {it['name']} missing policy"
                assert "timeout" in act["policy"]
                assert "retry" in act["policy"]
                assert "type" in act

    # Verify Ingest Pipeline has Wave 1 Ingest Activity
    ingest_pipe = next(it for it in items if it["name"] == "pl_retail_ingest")
    acts = ingest_pipe["pipeline"]["properties"]["activities"]
    assert len(acts) == 1
    assert acts[0]["name"] == "Act_00_Ingest_Postgres_Raw"
    assert acts[0]["type"] == "TridentNotebook"

    # Verify Master Pipeline has 5-Wave DAG
    master_pipe = next(it for it in items if it["name"] == "pl_master_orchestration")
    m_acts = master_pipe["pipeline"]["properties"]["activities"]
    assert len(m_acts) == 9  # 1 raw ingest + 5 curate + 1 silver + 1 quality + 1 gold stored proc
    assert any(a["name"] == "Act_00_Ingest_Postgres_Raw" for a in m_acts)
    assert any(a["name"] == "Act_06_Silver_Conformed" for a in m_acts)
    assert any(a["name"] == "Act_07_Quality_Suite" for a in m_acts)
    assert any(a["name"] == "Act_08_Gold_Star_Schema_ELT" for a in m_acts)

    # Verify Raw Ingestion Notebook PySpark Code
    raw_nb = next(it for it in items if it["name"] == "nb_00_ingest_postgres_raw")
    code = raw_nb["code"]
    assert "jdbc:postgresql://" in code
    assert "neondb" in code
    assert "lh_retail_bronze" in code
    assert "org.postgresql.Driver" in code

    print("ALL TESTS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    test_plan_naming_and_pipeline_activities()
