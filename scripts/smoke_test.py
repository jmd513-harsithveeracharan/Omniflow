"""
Quick integration smoke test — runs without Fabric API (no az login needed).
Tests: config loading, connector registry, ingestion planner, impact analyzer, LLM router structure.
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

print("\n" + "="*60)
print("  FABRIC AI — SMOKE TEST")
print("="*60)

# ── 1. Config ─────────────────────────────────────────────────────
print("\n[1/5] Config loading...")
from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME, GROQ_KEYS, LLM_MODELS
assert ALLOWED_WORKSPACE_ID, "No workspace ID"
assert GROQ_KEYS, "No Groq keys"
print(f"  Workspace : {ALLOWED_WORKSPACE_NAME}")
print(f"  WS ID     : {ALLOWED_WORKSPACE_ID}")
print(f"  Groq Keys : {len(GROQ_KEYS)} loaded")
print(f"  Primary   : {LLM_MODELS['groq_high']}")
print("  [PASS]")

# ── 2. Connector Registry ─────────────────────────────────────────
print("\n[2/5] Connector auto-discovery...")
from connectors.connector_registry import list_connectors, get_connector
connectors = list_connectors()
for c in connectors:
    stub = "[STUB]" if c.get("is_stub") else "[LIVE]"
    print(f"  {stub} {c['id']:<20} -> {c['name']}")
assert any(c["id"] == "azure_sql" for c in connectors), "Azure SQL missing"
print("  [PASS]")

# ── 3. Ingestion Planner — Strategy Classifier ───────────────────
print("\n[3/5] Ingestion planner + strategy classifier...")
from app.ingestion_planner import generate_ingestion_plan

tables = [
    {"schema": "dbo", "table": "Orders",
     "estimated_rows": 500_000,
     "columns": [
         {"column": "OrderID",    "is_primary_key": True},
         {"column": "Amount",     "is_primary_key": False},
         {"column": "updated_at", "is_primary_key": False},
     ]},
    {"schema": "dbo", "table": "Config",
     "estimated_rows": 50,
     "columns": [
         {"column": "Key",   "is_primary_key": True},
         {"column": "Value", "is_primary_key": False},
     ]},
]

plan = generate_ingestion_plan("azure_sql", "Azure SQL", "SalesDB", tables, "run nightly")
matrix = plan["strategy_matrix"]
orders_strat = next(m for m in matrix if "Orders" in m["table"])
config_strat  = next(m for m in matrix if "Config" in m["table"])

print(f"  Orders  : {orders_strat['load_type']} ({orders_strat['delta_strategy']})")
print(f"  Config  : {config_strat['load_type']}  ({config_strat['delta_strategy']})")
print(f"  DAG nodes: {len(plan['flow_nodes'])}")
print(f"  Schedule : {plan['pipeline']['schedule']['human']}")
assert orders_strat["load_type"] == "Incremental"
assert config_strat["load_type"] == "Full"
print("  [PASS]")

# ── 4. Impact Analyzer ────────────────────────────────────────────
print("\n[4/5] Impact analyzer...")
from app.impact_analyzer import analyze_impact

tests = [
    ("create_item",   "LOW",    False),
    ("delete_item",   "HIGH",   True),
    ("modify_schema", "MEDIUM", False),
    ("overwrite_table", "HIGH", True),
]
for op, expected_risk, expected_confirm in tests:
    result = analyze_impact(op, {"item_name": "lh_test"})
    assert result["risk_level"] == expected_risk, f"{op}: got {result['risk_level']}"
    assert result["requires_confirmation"] == expected_confirm
    print(f"  {op:<25} -> {result['risk_level']:<6} confirm={expected_confirm}")
print("  [PASS]")

# ── 5. Fabric Compiler ────────────────────────────────────────────
print("\n[5/5] Fabric item compiler (Base64 builders)...")
from app.fabric_compiler import compile_lakehouse, compile_notebook, compile_environment
import base64

lh = compile_lakehouse("lh_test_bronze")
assert lh["type"] == "Lakehouse"
assert len(lh["definition"]["parts"]) == 2

nb = compile_notebook("nb_test_ingest", "print('hello spark')")
nb_content_b64 = next(p["payload"] for p in nb["definition"]["parts"] if p["path"] == "notebook-content.py")
nb_content = base64.b64decode(nb_content_b64).decode()
assert "synapse_pyspark" in nb_content
assert "print('hello spark')" in nb_content

env = compile_environment("env_test_spark", extra_packages=["great-expectations>=0.18"])
env_yml_b64 = next(p["payload"] for p in env["definition"]["parts"] if p["path"] == "environment.yml")
env_yml = base64.b64decode(env_yml_b64).decode()
assert "great-expectations" in env_yml

print(f"  Lakehouse parts : {len(lh['definition']['parts'])}")
print(f"  Notebook content: {len(nb_content)} chars, synapse_pyspark kernel confirmed")
print(f"  Environment YAML: {len(env_yml.splitlines())} lines")
print("  [PASS]")

# ── 6. Memory & Session Store ──────────────────────────────────────
print("\n[6/6] Memory & session store...")
from app.memory import MemoryManager
from app.workspace_cache import update_after_deploy, find_item_by_name

mem = MemoryManager.get_or_create("smoke_test_session")
mem.add_user("We need to ingest CustomerDB tables nightly at 3am")
mem.add_assistant("Plan created for CustomerDB.")

summary = mem.get_summary()
assert summary["message_count"] == 2
assert "nightly" in summary["facts"].get("preferred_schedule", "").lower() or "3am" in summary["facts"].get("preferred_schedule", "").lower()
assert summary["facts"].get("source_database") == "CustomerDB"

# Test optimistic cache update
update_after_deploy([
    {"id": "smoke_lh_1", "displayName": "lh_customer_bronze", "type": "Lakehouse"}
], workspace_id=ALLOWED_WORKSPACE_ID)

found_lh = find_item_by_name("lh_customer_bronze")
assert found_lh is not None
assert found_lh["id"] == "smoke_lh_1"

# Build enriched messages for LLM
messages = mem.build_llm_messages()
assert len(messages) == 3  # system + 2 turns
assert messages[0]["role"] == "system"
assert "CustomerDB" in messages[0]["content"] or "nightly" in messages[0]["content"]

print(f"  Session ID   : {mem.session_id}")
print(f"  Message count: {summary['message_count']}")
print(f"  Learned facts: {summary['facts']}")
print(f"  Cached items : {found_lh['displayName']} ({found_lh['type']})")
print("  [PASS]")

# ── 7. SQLGlot Transpiler & Lineage ────────────────────────────────
print("\n[7/7] SQL AST parsing, transpilation & column lineage...")
from app.sql_transpiler import transpile_to_spark, extract_sql_lineage, validate_sql

spark_sql = transpile_to_spark("SELECT TOP 5 OrderID FROM Orders WHERE ISNULL(Status, '') = ''")
assert "LIMIT 5" in spark_sql or "limit 5" in spark_sql.lower()

lineage = extract_sql_lineage("SELECT o.id, c.name FROM Orders o JOIN Customers c ON o.cid = c.id")
assert lineage["has_joins"] is True
assert len(lineage["columns"]) >= 2

validation = validate_sql("SELECT 1 AS ok")
assert validation["valid"] is True

print(f"  Transpilation : T-SQL 'TOP 5' -> Spark SQL '{spark_sql[:30]}...'")
print(f"  Lineage tables: {lineage['source_tables']}")
print("  [PASS]")

# ── Summary ────────────────────────────────────────────────────────
print("\n" + "="*60)
print("  ALL 7 SMOKE TESTS PASSED")
print("="*60)
print("\nTo start the server: python server.py")
print("Server will run at: http://localhost:8085\n")
