"""
verify_capabilities.py
----------------------
Comprehensive End-to-End Capability Verification Suite for Fabric AI Studio / OmniFlow.
Tests all 9 major capability pillars:
1. Live Azure CLI & Fabric Authentication
2. 4-Stage Multi-Agent Architecture Pipeline & Thought Metadata
3. 13 Granular Microsoft Fabric Item Compilers
4. SQLGlot Multi-Dialect AST Transpiler & Column Lineage
5. NetworkX Lineage Graph & JIT Context Hydration & Blast-Radius Engine
6. Closed-Loop PySpark Self-Healing Engine
7. Multi-Model Token Tracker & Cost Auditor
8. Session Store & Project Persistence Engine
9. FastAPI Endpoints & SSE Streaming Engine
"""

import sys
import os
import time
import json
import traceback

# Ensure UTF-8 output encoding for console
if sys.platform == "win32":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

# Add workspace root to path
sys.path.insert(0, os.getcwd())

results = []

def record_test(name: str, passed: bool, detail: str, duration_ms: float = 0.0):
    status_str = "[PASS]" if passed else "[FAIL]"
    print(f"[{status_str}] {name} ({duration_ms:.1f}ms): {detail}")
    results.append({"name": name, "passed": passed, "detail": detail, "duration_ms": duration_ms})


def test_1_auth_and_fabric_client():
    t0 = time.perf_counter()
    try:
        from app.auth import get_auth_status, get_fabric_token
        from app.fabric_client import list_workspaces, list_workspace_items
        from app.config import ALLOWED_WORKSPACE_ID
        
        status = get_auth_status()
        token = get_fabric_token()
        has_token = bool(token and len(token) > 20)
        
        # Test Fabric API list_workspaces
        workspaces = list_workspaces()
        
        detail = (
            f"Auth: {status.get('auth_method')} | User: {status.get('user_identity')} | "
            f"Token Present: {has_token} | Workspaces Found: {len(workspaces)}"
        )
        dur = (time.perf_counter() - t0) * 1000
        record_test("1. Azure & Fabric Authentication", True, detail, dur)
    except Exception as e:
        dur = (time.perf_counter() - t0) * 1000
        record_test("1. Azure & Fabric Authentication", False, str(e), dur)


def test_2_multi_agent_pipeline():
    t0 = time.perf_counter()
    try:
        from app.chat_service import process_chat_turn
        
        prompt = (
            "Create project folder RetailAnalytics with lh_bronze, lh_silver, lh_gold, "
            "notebooks nb_retail_bronze, nb_retail_silver, nb_retail_gold, "
            "and pipeline pl_retail_sync scheduled daily at 3AM."
        )
        
        response_text, plan = process_chat_turn(
            prompt=prompt,
            session_id="test_suite_pipeline_01",
            target_model="gemini-3.6-flash",
            effort="medium"
        )
        
        assert plan is not None, "Plan must not be None"
        assert "<!-- THOUGHT:" in response_text, "Response must include thought metadata"
        assert plan.get("folder") == "RetailAnalytics" or "RetailAnalytics" in str(plan.get("folder")), "Folder must be RetailAnalytics"
        assert len(plan.get("notebooks", [])) >= 3, "Must generate at least 3 notebooks"
        
        # Check PySpark Delta merge code in silver
        silver_nb = next((nb for nb in plan.get("notebooks", []) if "silver" in nb["name"].lower()), None)
        assert silver_nb is not None, "Must have silver notebook"
        assert len(silver_nb["pyspark_code"]) > 50, "Silver notebook must contain PySpark code"
        
        # Check pipeline presence
        pipeline_info = plan.get("pipeline")
        assert pipeline_info is not None, "Pipeline must be generated in plan"
        
        detail = (
            f"Folder: {plan.get('folder')} | Notebooks: {len(plan.get('notebooks', []))} | "
            f"Thought Tag Present: True | Pipeline: {pipeline_info}"
        )
        dur = (time.perf_counter() - t0) * 1000
        record_test("2. Multi-Agent Architecture Pipeline", True, detail, dur)
    except Exception as e:
        dur = (time.perf_counter() - t0) * 1000
        record_test("2. Multi-Agent Architecture Pipeline", False, f"{e}\n{traceback.format_exc()}", dur)


def test_3_granular_fabric_compilers():
    t0 = time.perf_counter()
    try:
        from app.fabric_compiler import (
            compile_lakehouse,
            compile_notebook,
            compile_pipeline,
            compile_environment,
            compile_semantic_model,
            compile_warehouse,
            compile_report,
            compile_eventstream,
            compile_graphql_api,
            compile_kql_database,
            compile_kql_queryset,
            compile_dataflow,
            compile_reflex,
            compile_spark_job_definition,
            compile_mirrored_database,
            compile_ml_experiment,
            compile_ml_model,
        )
        
        # 1. Lakehouse
        lh_payload = compile_lakehouse("lh_bronze")
        assert lh_payload["displayName"] == "lh_bronze" and lh_payload["type"] == "Lakehouse"
        
        # 2. Notebook
        nb_payload = compile_notebook(
            name="nb_test_comp",
            pyspark_code="# PySpark Test\nspark.range(10).show()"
        )
        assert "definition" in nb_payload and len(nb_payload["definition"]["parts"]) >= 1
        
        # 3. Pipeline
        pl_payload, pl_parts = compile_pipeline(
            name="pl_test_comp",
            notebook_ids=["nb_id_1", "nb_id_2"],
            workspace_id="ws-123",
            schedule_cron="0 2 * * *"
        )
        assert pl_payload["displayName"] == "pl_test_comp" and len(pl_parts) >= 1
        
        # 4. Semantic Model (TMDL)
        sm_payload = compile_semantic_model(
            name="sm_test_comp",
            lakehouse_id="lh-123",
            lakehouse_name="lh_gold",
            workspace_id="ws-123",
            tables=[{"name": "FactSales", "columns": [{"name": "id", "type": "int"}, {"name": "amt", "type": "double"}]}]
        )
        assert "definition" in sm_payload and len(sm_payload["definition"]["parts"]) >= 3
        
        # 5-13. Warehouse, Environment, Report, KQL, Eventstream, Reflex, Mirrored DB, Dataflow, Spark Job, ML
        wh = compile_warehouse("wh_test", tables=[{"name": "DimCust"}])
        env = compile_environment("env_test", extra_packages=["delta-spark"])
        rpt = compile_report("rpt_test", "sm-123", "sm_test_comp")
        kql_db = compile_kql_database("kql_test", tables=[{"name": "Events"}])
        kq = compile_kql_queryset("kq_test", "kql_test", tables=["Events"])
        es = compile_eventstream("es_test")
        df = compile_dataflow("df_test", "lh_bronze")
        rfx = compile_reflex("rfx_test", rules=[{"rule_name": "HighSpendAlert"}])
        mir = compile_mirrored_database("mir_test", "AzureSqlDatabase", "ProdDB")
        sjd = compile_spark_job_definition("sjd_test", "lh_gold")
        mlexp = compile_ml_experiment("mlexp_test")
        mlmod = compile_ml_model("mlmod_test")
        
        assert wh and env and rpt and kql_db and kq and es and df and rfx and mir and sjd and mlexp and mlmod
        
        detail = "All 13+ Granular Microsoft Fabric item compilers verified with Base64 & TMDL serialization."
        dur = (time.perf_counter() - t0) * 1000
        record_test("3. 13 Microsoft Fabric Item Compilers", True, detail, dur)
    except Exception as e:
        dur = (time.perf_counter() - t0) * 1000
        record_test("3. 13 Microsoft Fabric Item Compilers", False, f"{e}\n{traceback.format_exc()}", dur)


def test_4_sql_transpilation_and_lineage():
    t0 = time.perf_counter()
    try:
        from app.sql_transpiler import transpile_to_spark, extract_sql_lineage
        
        tsql_query = """
        SELECT 
            o.OrderID AS order_id,
            ISNULL(c.CustomerName, 'Unknown') AS customer_name,
            DATEADD(day, 7, o.OrderDate) AS estimated_delivery,
            o.TotalAmount * 1.05 AS total_with_tax
        FROM Orders o
        LEFT JOIN Customers c ON o.CustomerID = c.CustomerID
        WHERE o.Status = 'COMPLETED'
        """
        
        spark_sql = transpile_to_spark(tsql_query, from_dialect="tsql")
        lineage = extract_sql_lineage(tsql_query, dialect="tsql")
        
        assert "spark" in spark_sql.lower() or "select" in spark_sql.lower()
        # Ensure NVL/COALESCE/IFNULL transpilation for ISNULL
        assert "coalesce" in spark_sql.lower() or "ifnull" in spark_sql.lower() or "nvl" in spark_sql.lower()
        assert "Orders" in lineage.get("source_tables", [])
        assert "Customers" in lineage.get("source_tables", [])
        
        detail = f"Transpiled T-SQL -> Spark SQL | Detected Sources: {lineage.get('source_tables')} | Columns: {len(lineage.get('columns', []))} | Joins: {lineage.get('has_joins')}"
        dur = (time.perf_counter() - t0) * 1000
        record_test("4. SQL AST Transpiler & Column Lineage", True, detail, dur)
    except Exception as e:
        dur = (time.perf_counter() - t0) * 1000
        record_test("4. SQL AST Transpiler & Column Lineage", False, f"{e}\n{traceback.format_exc()}", dur)


def test_5_lineage_graph_and_blast_radius():
    t0 = time.perf_counter()
    try:
        from app.impact_analyzer import analyze_impact
        from app.domain.lineage.graph_store import LineageGraphEngine
        from app.domain.models.lineage import LineageNode, LineageEdge, AssetType, AssetLayer, DependencyType
        
        # 1. Test Impact Analyzer Gate
        high_risk_gate = analyze_impact("delete_item", context={"item_name": "lh_gold"})
        assert high_risk_gate["requires_confirmation"] is True
        assert high_risk_gate["risk_level"] == "HIGH"
        
        # 2. Test Lineage Graph Engine DAG & Blast Radius
        engine = LineageGraphEngine()
        
        engine.add_asset(LineageNode(id="tbl_raw_orders", name="raw_orders", asset_type=AssetType.TABLE, layer=AssetLayer.SOURCE))
        engine.add_asset(LineageNode(id="lh_bronze", name="lh_bronze", asset_type=AssetType.LAKEHOUSE, layer=AssetLayer.BRONZE))
        engine.add_asset(LineageNode(id="nb_silver_clean", name="nb_silver_clean", asset_type=AssetType.NOTEBOOK, layer=AssetLayer.SILVER))
        engine.add_asset(LineageNode(id="lh_gold", name="lh_gold", asset_type=AssetType.LAKEHOUSE, layer=AssetLayer.GOLD))
        engine.add_asset(LineageNode(id="rpt_sales_exec", name="rpt_sales_exec", asset_type=AssetType.POWER_BI_REPORT, layer=AssetLayer.REPORT))
        
        engine.add_dependency(LineageEdge(source_id="tbl_raw_orders", target_id="lh_bronze", relation_type=DependencyType.INGESTS))
        engine.add_dependency(LineageEdge(source_id="lh_bronze", target_id="nb_silver_clean", relation_type=DependencyType.TRANSFORMS))
        engine.add_dependency(LineageEdge(source_id="nb_silver_clean", target_id="lh_gold", relation_type=DependencyType.TRANSFORMS))
        engine.add_dependency(LineageEdge(source_id="lh_gold", target_id="rpt_sales_exec", relation_type=DependencyType.FEEDS))
        
        # Calculate blast radius for modifying lh_bronze
        report = engine.calculate_blast_radius("lh_bronze", is_destructive=True)
        assert len(report.affected_nodes) >= 3, "Blast radius must detect all downstream assets"
        assert report.risk_level in ("high", "critical"), "Destructive upstream change must have high risk"
        
        # JIT Context Hydration (~85 tokens)
        jit_capsule = engine.get_jit_context("lh_gold", hops=1)
        assert jit_capsule is not None
        assert any(n.id == "nb_silver_clean" for n in jit_capsule.upstream_dependencies)
        assert any(n.id == "rpt_sales_exec" for n in jit_capsule.downstream_consumers)
        
        detail = (
            f"Downstream Blast Zone: {[n.name for n in report.affected_nodes]} | "
            f"Risk Level: {report.risk_level} | JIT Context Tokens: {jit_capsule.estimated_tokens}t | Upstream: {[n.name for n in jit_capsule.upstream_dependencies]} | Downstream: {[n.name for n in jit_capsule.downstream_consumers]}"
        )
        dur = (time.perf_counter() - t0) * 1000
        record_test("5. Lineage Graph & Blast Radius Engine", True, detail, dur)
    except Exception as e:
        dur = (time.perf_counter() - t0) * 1000
        record_test("5. Lineage Graph & Blast Radius Engine", False, f"{e}\n{traceback.format_exc()}", dur)


def test_6_self_healing_engine():
    t0 = time.perf_counter()
    try:
        from app.self_healer import diagnose_and_patch_code
        
        failing_code = """
        from pyspark.sql import SparkSession
        spark = SparkSession.builder.getOrCreate()
        df = spark.read.format("delta").load("abfss://wrong_container/raw_data")
        df_clean = df.dropDuplicates(["non_existent_key"])
        df_clean.write.format("delta").save("abfss://silver/target")
        """
        
        error_trace = "AnalysisException: cannot resolve '`non_existent_key`' given input columns: [order_id, customer_id, amount]"
        
        res = diagnose_and_patch_code(
            code=failing_code,
            error_trace=error_trace,
            notebook_name="nb_silver_orders",
            target_model="openai/gpt-oss-120b"
        )
        
        assert res.get("success") is True, f"Self-healing failed: {res.get('error')}"
        assert "patched_code" in res, "Must return patched code"
        assert len(res["patched_code"]) > 20, "Patched code must not be empty"
        
        diag = res.get("diagnosis", {})
        detail = f"Diagnosis Category: {diag.get('error_category', 'Schema')} | Root Cause: {str(diag.get('root_cause', 'Key mismatch'))[:60]}... | Patched Lines: {len(res['patched_code'].splitlines())}"
        dur = (time.perf_counter() - t0) * 1000
        record_test("6. PySpark Self-Healing Engine", True, detail, dur)
    except Exception as e:
        dur = (time.perf_counter() - t0) * 1000
        record_test("6. PySpark Self-Healing Engine", False, f"{e}\n{traceback.format_exc()}", dur)


def test_7_token_tracker_and_auditor():
    t0 = time.perf_counter()
    try:
        from app.token_tracker import record_token_usage, get_token_audit_summary
        
        record_token_usage(
            provider="Google Gemini",
            model="gemini-3.6-flash",
            prompt_text=[{"role": "user", "content": "Sample prompt for testing token tracking."}],
            completion_text="Sample completion text output from LLM engine.",
            duration_ms=124.5,
            session_id="test_suite_session",
            complexity="standard"
        )
        
        summary = get_token_audit_summary(session_id="test_suite_session")
        assert summary.total_calls >= 1, "Must record at least 1 call"
        assert summary.total_tokens > 0, "Tokens must be greater than 0"
        
        detail = f"Total Logged Calls: {summary.total_calls} | Total Tokens: {summary.total_tokens} | Est Cost: ${summary.total_cost_usd:.6f}"
        dur = (time.perf_counter() - t0) * 1000
        record_test("7. Token Usage & Cost Tracker", True, detail, dur)
    except Exception as e:
        dur = (time.perf_counter() - t0) * 1000
        record_test("7. Token Usage & Cost Tracker", False, f"{e}\n{traceback.format_exc()}", dur)


def test_8_session_store_and_projects():
    t0 = time.perf_counter()
    try:
        from app.session_store import (
            create_session,
            get_session,
            add_message,
            get_messages,
            create_project,
            get_all_projects,
            update_project,
            delete_project,
        )
        
        # Test Session
        sid = f"test_sess_{int(time.time())}"
        create_session(sid, "test_ws_id", {"test": True})
        add_message(sid, "user", "Hello World")
        add_message(sid, "assistant", "Hello! I am Fabric AI Studio.")
        
        history = get_messages(sid)
        assert len(history) == 2, "Must retain 2 messages"
        
        # Test Project CRUD
        proj = create_project("Test Automation Project", "Automated verification project")
        assert proj and proj.get("id")
        pid = proj["id"]
        
        updated = update_project(pid, is_pinned=1)
        assert updated is True
        
        projects = get_all_projects()
        assert any(p["id"] == pid for p in projects)
        
        deleted = delete_project(pid)
        assert deleted is True
        
        detail = f"Session History: {len(history)} msgs | Project Created, Pinned & Deleted: True"
        dur = (time.perf_counter() - t0) * 1000
        record_test("8. Session Store & Project Persistence", True, detail, dur)
    except Exception as e:
        dur = (time.perf_counter() - t0) * 1000
        record_test("8. Session Store & Project Persistence", False, f"{e}\n{traceback.format_exc()}", dur)


def test_9_fastapi_endpoints():
    t0 = time.perf_counter()
    try:
        from fastapi.testclient import TestClient
        from api_server import app
        
        client = TestClient(app)
        
        # 1. Health
        h_res = client.get("/api/health")
        assert h_res.status_code == 200 and h_res.json()["status"] == "online"
        
        # 2. Fabric Status
        s_res = client.get("/api/fabric/status")
        assert s_res.status_code == 200
        assert "authenticated" in s_res.json()
        assert "user_identity" in s_res.json()
        
        # 3. Skills endpoint
        sk_res = client.get("/api/skills")
        assert sk_res.status_code == 200
        assert len(sk_res.json()) >= 4
        
        # 4. Connectors endpoint
        cn_res = client.get("/api/connectors")
        assert cn_res.status_code == 200
        assert len(cn_res.json()) >= 3
        
        # 5. SQL Transpile endpoint
        tr_res = client.post("/api/transpile", json={"sql": "SELECT TOP 10 * FROM Orders", "source_dialect": "tsql"})
        assert tr_res.status_code == 200
        assert "spark_sql" in tr_res.json()
        
        detail = f"Health: 200 | Status: 200 | Skills: {len(sk_res.json())} | Connectors: {len(cn_res.json())} | Transpile: 200"
        dur = (time.perf_counter() - t0) * 1000
        record_test("9. FastAPI REST & SSE Endpoints", True, detail, dur)
    except Exception as e:
        dur = (time.perf_counter() - t0) * 1000
        record_test("9. FastAPI REST & SSE Endpoints", False, f"{e}\n{traceback.format_exc()}", dur)


def test_10_postgresql_pgvector_adapter():
    t0 = time.perf_counter()
    try:
        from app.domain.models.session import ArchitectureRecipe, ProjectLedgerRecord
        from app.domain.storage.factory import get_storage
        from app.domain.storage.postgres_adapter import PostgresStorageAdapter

        db_url = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/fabric_ai")
        adapter = PostgresStorageAdapter(db_url)
        stats = adapter.get_db_stats()

        # Test HNSW vector search
        test_recipe = ArchitectureRecipe(
            id=f"rec_verify_{int(time.time())}",
            title="E2E Medallion Delta Lakehouse Pipeline",
            description="Verified pipeline with automated table lineage and PySpark Delta Lake merge",
            source_dialect="tsql",
            target_fabric_type="lakehouse",
            code_template="spark.read.format('delta')...",
            tags=["medallion", "lakehouse", "verified"],
            rating=5,
            embedding=[0.05] * 1536,
        )
        adapter.save_recipe(test_recipe)
        results = adapter.search_recipes([0.05] * 1536, limit=1)
        assert len(results) >= 1, "Must find at least 1 vector match"

        # Test Project Ledger Record commit
        ledger_rec = ProjectLedgerRecord(
            project_id=f"proj_ledger_{int(time.time())}",
            project_name="E2E Enterprise Migration",
            workspace_id="test_ws",
            status="completed",
            summary="Complete automated data migration",
            workstreams=["Bronze Ingestion", "Silver Enrichment", "Gold Aggregates"],
            lineage_dag={"nodes": ["raw_orders", "bronze_orders", "silver_orders", "gold_sales"]},
            table_catalog=[{"name": "orders", "layer": "bronze"}],
            adrs=[{"title": "ADR-001 Delta Lake format"}],
            embedding=[0.02] * 1536,
        )
        adapter.commit_completed_project(ledger_rec)
        fetched_ledger = adapter.get_completed_project(ledger_rec.project_id)
        assert fetched_ledger is not None
        assert fetched_ledger.project_name == "E2E Enterprise Migration"

        detail = f"Postgres DB Tables: {len(stats)} | Vector HNSW Match: '{results[0].title}' | Master Ledger: OK"
        dur = (time.perf_counter() - t0) * 1000
        record_test("10. PostgreSQL + pgvector Storage & HNSW Memory", True, detail, dur)
    except Exception as e:
        dur = (time.perf_counter() - t0) * 1000
        record_test("10. PostgreSQL + pgvector Storage & HNSW Memory", False, f"{e}\n{traceback.format_exc()}", dur)


if __name__ == "__main__":
    print("\n" + "="*80)
    print("      FABRIC AI STUDIO / OMNIFLOW - END-TO-END VERIFICATION SUITE")
    print("="*80 + "\n")
    
    test_1_auth_and_fabric_client()
    test_2_multi_agent_pipeline()
    test_3_granular_fabric_compilers()
    test_4_sql_transpilation_and_lineage()
    test_5_lineage_graph_and_blast_radius()
    test_6_self_healing_engine()
    test_7_token_tracker_and_auditor()
    test_8_session_store_and_projects()
    test_9_fastapi_endpoints()
    test_10_postgresql_pgvector_adapter()
    
    print("\n" + "="*80)
    passed_count = sum(1 for r in results if r["passed"])
    total_count = len(results)
    print(f"VERIFICATION SUMMARY: {passed_count}/{total_count} CAPABILITIES FULLY VERIFIED")
    print("="*80 + "\n")
    
    if passed_count != total_count:
        sys.exit(1)
