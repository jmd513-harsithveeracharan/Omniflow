import os
import sys
import uuid
from typing import Any

current_dir = os.path.dirname(os.path.abspath(__file__))
workspace_root = os.path.dirname(os.path.dirname(current_dir))
if workspace_root not in sys.path:
    sys.path.insert(0, workspace_root)

import psycopg2
from psycopg2.extras import Json

from omniflow.db.postgres_repo import NEON_URI


def seed_enterprise_context_knowledge_base(project_code: str = "PRJ-GLOBAL-FIN-HUB", db_uri: str = NEON_URI) -> dict[str, int]:
    """Populates PostgreSQL tables across Metadata, Governance, Memory, and Architecture domains
    so AI agents have realistic enterprise context to discover and query dynamically via tool calls.
    """
    stats = {
        "policies": 0,
        "project_decisions": 0,
        "project_constraints": 0,
        "project_memory": 0,
        "relationships": 0,
        "fabric_patterns": 0,
    }

    with psycopg2.connect(db_uri, connect_timeout=8) as conn, conn.cursor() as cur:
        # 1. Resolve project_id
        cur.execute("SELECT project_id::text FROM projects WHERE project_code = %s LIMIT 1;", (project_code,))
        row = cur.fetchone()
        if not row:
            project_id = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO projects (project_id, project_code, project_name, description, status, created_at, updated_at)
                VALUES (%s, %s, 'Global Commercial & Financial Enterprise Data Hub', 'Financial Operations Hub', 'active', NOW(), NOW());
                """,
                (project_id, project_code),
            )
        else:
            project_id = row[0]

        # 2. Seed Mandatory Governance Policies
        policies = [
            (
                "PII Data Anonymization Standard",
                "SECURITY",
                "Requires deterministic SHA-256 masking on all PII columns (customer_email, tax_id, iban_number, customer_name) before writing to Curated Delta tables.",
                "WORKSPACE",
                {"algorithm": "SHA-256", "enforce_at_layer": "curated", "salt_required": False, "preserve_nulls": True},
                True,
            ),
            (
                "Kimball Star Schema Warehouse Standard",
                "ARCHITECTURE",
                "All warehouse dimension and fact tables must use BIGINT surrogate primary keys with suffix '_sk' and track lineage with '_loaded_at' datetime2(6).",
                "WORKSPACE",
                {"surrogate_key_suffix": "_sk", "audit_col": "_loaded_at", "type": "BIGINT"},
                True,
            ),
            (
                "Fabric Workspace Containment Standard",
                "INFRASTRUCTURE",
                "All provisioned items (Lakehouses, Notebooks, Pipelines) must be deployed inside 'AI_Test_Folder' to protect workspace root.",
                "WORKSPACE",
                {"containment_folder": "AI_Test_Folder", "environment": "dev_test"},
                True,
            ),
        ]

        for pname, ptype, pdesc, pscope, prules, is_enf in policies:
            cur.execute("SELECT policy_id FROM policies WHERE policy_name = %s;", (pname,))
            if not cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO policies (policy_id, policy_name, policy_type, description, scope_type, rules_json, is_enforced, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, NOW());
                    """,
                    (str(uuid.uuid4()), pname, ptype, pdesc, pscope, Json(prules), is_enf),
                )
                stats["policies"] += 1

        # 3. Seed Architecture Decisions (ADRs)
        decisions = [
            (
                "Direct Lake Storage Mode for Power BI Semantic Models",
                "DirectQuery introduces query latency on large Delta tables, while Import mode requires scheduled memory refreshes and duplicates data.",
                "Adopt Power BI Direct Lake storage mode framed directly against OneLake Delta parquet files without data movement.",
                {"alternatives_considered": ["Import Mode", "DirectQuery", "Dual Mode"]},
                "Sub-second report queries on billion-row tables without duplicating memory or scheduling dataset refreshes.",
                "Lead Architect",
            ),
            (
                "SAP ECC Ingestion via ODP/RFC Real-Time Delta Queue",
                "Full batch extraction of large SAP financial tables (BKPF, BSEG) causes ERP database contention and excessive network load.",
                "Configure SAP Operational Data Provisioning (ODP) extractor with delta queue subscription on pointer field AEDAT.",
                {"alternatives_considered": ["JDBC Nightly Full Pull", "Database Trigger CDC", "File Extract"]},
                "Enables 30-second near-real-time micro-batch ingestion without impacting core SAP transaction processing.",
                "SAP Integration Lead",
            ),
        ]

        for dtitle, dctx, ddec, dalts, dreas, dby in decisions:
            cur.execute("SELECT decision_id FROM project_decisions WHERE project_id = %s AND decision_title = %s;", (project_id, dtitle))
            if not cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO project_decisions (decision_id, project_id, decision_title, context, decision, alternatives, reason, decided_by, status, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'APPROVED', NOW());
                    """,
                    (str(uuid.uuid4()), project_id, dtitle, dctx, ddec, Json(dalts), dreas, dby),
                )
                stats["project_decisions"] += 1

        # 4. Seed Project Constraints
        constraints = [
            (
                "CAPACITY_LIMIT",
                "Target Microsoft Fabric workspace is locked to F64 SKU capacity. Heavy transformation notebooks must implement Delta OPTIMIZE with Z-ORDER clustering to prevent CU throttling.",
                {"capacity_sku": "F64", "throttle_risk": "HIGH", "required_optimization": "Z-ORDER"},
                "HIGH",
                "Architecture Decision ADR-001",
            ),
            (
                "DATA_SOVEREIGNTY",
                "Customer tax IDs and European IBAN numbers are subject to GDPR and CCPA compliance. Raw tables must remain strictly internal with restricted read access.",
                {"regulations": ["GDPR", "CCPA"], "restricted_columns": ["tax_id", "iban_number", "customer_email"]},
                "CRITICAL",
                "Legal & Compliance Mandate",
            ),
        ]

        for ctype, cdesc, cval, csev, csrc in constraints:
            cur.execute("SELECT constraint_id FROM project_constraints WHERE project_id = %s AND description = %s;", (project_id, cdesc))
            if not cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO project_constraints (constraint_id, project_id, constraint_type, description, value, severity, source, is_active, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, true, NOW());
                    """,
                    (str(uuid.uuid4()), project_id, ctype, cdesc, Json(cval), csev, csrc),
                )
                stats["project_constraints"] += 1

        # 5. Seed Project Memory (Naming conventions, checkpoints, previous parameters)
        memories = [
            (
                "ARCHITECTURE_STATE",
                "Storage Tier Naming Convention",
                "Target storage items: Raw Lakehouse 'lh_fin_ops_raw', Curated Lakehouse 'lh_fin_ops_curated', Analytical Warehouse 'wh_fin_ops_analytics' inside 'AI_Test_Folder'.",
                95,
                1.0,
            ),
            (
                "CDC_CHECKPOINT",
                "Watermark Tracking Offsets",
                "Watermark pointers: orders.updated_at, customers.updated_at, BKPF.AEDAT, BSEG.AEDAT. Ingestion pipelines must append _omni_ingested_at audit timestamp.",
                85,
                0.95,
            ),
        ]

        for mtype, mtitle, mcontent, mimp, mconf in memories:
            cur.execute("SELECT memory_id FROM project_memory WHERE project_id = %s AND title = %s;", (project_id, mtitle))
            if not cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO project_memory (memory_id, project_id, memory_type, title, content, importance, confidence, status, created_at, updated_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, 'ACTIVE', NOW(), NOW());
                    """,
                    (str(uuid.uuid4()), project_id, mtype, mtitle, mcontent, mimp, mconf),
                )
                stats["project_memory"] += 1

        # 6. Seed Table Relationships (Foreign Keys & Lineage)
        cur.execute("SELECT table_id, table_name FROM tables;")
        table_lookup = {r[1].lower(): r[0] for r in cur.fetchall()}
        cur.execute("SELECT column_id, table_id, column_name FROM columns;")
        col_lookup = {(r[1], r[2].lower()): r[0] for r in cur.fetchall()}

        # orders.customer_id -> customers.customer_id
        if "orders" in table_lookup and "customers" in table_lookup:
            ord_id = table_lookup["orders"]
            cust_id = table_lookup["customers"]
            ord_cust_col = col_lookup.get((ord_id, "customer_id"))
            cust_pk_col = col_lookup.get((cust_id, "customer_id"))

            if ord_cust_col and cust_pk_col:
                cur.execute("SELECT relationship_id FROM relationships WHERE from_table_id = %s AND to_table_id = %s;", (ord_id, cust_id))
                if not cur.fetchone():
                    cur.execute(
                        """
                        INSERT INTO relationships (relationship_id, from_table_id, from_column_id, to_table_id, to_column_id, relationship_type, cardinality, is_active, description)
                        VALUES (%s, %s, %s, %s, %s, 'FOREIGN_KEY', 'N:1', true, 'Orders placed by customer');
                        """,
                        (str(uuid.uuid4()), ord_id, ord_cust_col, cust_id, cust_pk_col),
                    )
                    stats["relationships"] += 1

        # BSEG.BELNR -> BKPF.BELNR
        if "bseg" in table_lookup and "bkpf" in table_lookup:
            bseg_id = table_lookup["bseg"]
            bkpf_id = table_lookup["bkpf"]
            bseg_belnr = col_lookup.get((bseg_id, "belnr"))
            bkpf_belnr = col_lookup.get((bkpf_id, "belnr"))

            if bseg_belnr and bkpf_belnr:
                cur.execute("SELECT relationship_id FROM relationships WHERE from_table_id = %s AND to_table_id = %s;", (bseg_id, bkpf_id))
                if not cur.fetchone():
                    cur.execute(
                        """
                        INSERT INTO relationships (relationship_id, from_table_id, from_column_id, to_table_id, to_column_id, relationship_type, cardinality, is_active, description)
                        VALUES (%s, %s, %s, %s, %s, 'FOREIGN_KEY', 'N:1', true, 'SAP Accounting Document Item line to Header');
                        """,
                        (str(uuid.uuid4()), bseg_id, bseg_belnr, bkpf_id, bkpf_belnr),
                    )
                    stats["relationships"] += 1

        # 7. Seed Fabric Architectural Patterns
        patterns = [
            (
                "Delta Lake SCD2 Upsert Pattern",
                "Notebook",
                "Standard PySpark DeltaTable MERGE with null-safe SHA-256 PII masking and Z-Order compaction.",
                "Cleansing raw ingestion tables into curated Lakehouse with ACID deduplication.",
                {"language": "pyspark", "target_engine": "synapse_spark", "idempotent": True},
                {"required": ["source_lakehouse", "target_lakehouse", "table_name", "primary_key"]},
                ["delta", "merge", "pii", "pyspark"],
            ),
            (
                "Direct Lake Semantic Model Framing",
                "SemanticModel",
                "Power BI Direct Lake BIM framing against Fabric OneLake Gold Warehouse Delta parquet files.",
                "Sub-second interactive reporting on financial star schema.",
                {"compatibility_level": 1604, "mode": "directLake"},
                {"required": ["warehouse_name", "tables", "measures"]},
                ["powerbi", "direct_lake", "gold", "bim"],
            ),
        ]

        for pname, itype, pdesc, puse, ptmpl, pschema, ptags in patterns:
            cur.execute("SELECT pattern_id FROM fabric_patterns WHERE pattern_name = %s;", (pname,))
            if not cur.fetchone():
                cur.execute(
                    """
                    INSERT INTO fabric_patterns (pattern_id, pattern_name, fabric_item_type, description, use_case, template_definition, parameters_schema, tags, status, created_at)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'ACTIVE', NOW());
                    """,
                    (str(uuid.uuid4()), pname, itype, pdesc, puse, Json(ptmpl), Json(pschema), ptags),
                )
                stats["fabric_patterns"] += 1

        conn.commit()

    return stats


if __name__ == "__main__":
    res = seed_enterprise_context_knowledge_base()
    print("Enterprise Context Knowledge Base Seeded:")
    for k, v in res.items():
        print(f"  - {k:<25}: {v} records seeded")
