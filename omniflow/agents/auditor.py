from __future__ import annotations

import ast
import json
import os
import uuid
from typing import Any

import psycopg2

from omniflow.db.postgres_repo import NEON_URI


class QualityAuditFinding(dict):
    """Represents a single audit finding recorded in PostgreSQL audit_findings table."""


def audit_generated_artifacts(
    run_id: str,
    artifacts_dir: str,
    db_uri: str = NEON_URI,
) -> dict[str, Any]:
    """Auditor Agent: validates generated code, JSON schemas, PII compliance, and logs findings to PostgreSQL."""
    findings: list[dict[str, Any]] = []
    checks_passed = 0
    checks_total = 0

    with psycopg2.connect(db_uri, connect_timeout=8) as conn, conn.cursor() as cur:
        # Check 1: PySpark Notebook Syntax & PII Masking Audit
        for root, _, files in os.walk(artifacts_dir):
            for file in files:
                full_path = os.path.join(root, file)

                if file.endswith(".py"):
                    checks_total += 1
                    with open(full_path, "r", encoding="utf-8") as f:
                        code_content = f.read()

                    # AST compilation check
                    try:
                        ast.parse(code_content)
                        checks_passed += 1
                    except SyntaxError as e:
                        fid = str(uuid.uuid4())
                        finding = {
                            "finding_id": fid,
                            "run_id": run_id,
                            "defect_type": "SYNTAX_ERROR",
                            "severity": "CRITICAL",
                            "finding_details": f"PySpark notebook '{file}' has Python syntax error: {e}",
                        }
                        findings.append(finding)
                        cur.execute(
                            """
                            INSERT INTO audit_findings
                                (finding_id, run_id, defect_type, severity, finding_details, status, created_at)
                            VALUES (%s, %s, %s, %s, %s, 'OPEN', NOW());
                            """,
                            (fid, run_id, finding["defect_type"], finding["severity"], finding["finding_details"]),
                        )

                    # PII check: verify sha2 masking is present if PII columns exist
                    checks_total += 1
                    has_pii = any(k in code_content.lower() for k in ("email", "phone", "street", "pii"))
                    if has_pii and ("sha2" in code_content or "hash" in code_content):
                        checks_passed += 1
                    elif not has_pii:
                        checks_passed += 1
                    else:
                        fid = str(uuid.uuid4())
                        finding = {
                            "finding_id": fid,
                            "run_id": run_id,
                            "defect_type": "COMPLIANCE_NON_CONFORMANCE",
                            "severity": "HIGH",
                            "finding_details": f"Notebook '{file}' contains plain PII fields without required SHA-256 masking.",
                        }
                        findings.append(finding)
                        cur.execute(
                            """
                            INSERT INTO audit_findings
                                (finding_id, run_id, defect_type, severity, finding_details, status, created_at)
                            VALUES (%s, %s, %s, %s, %s, 'OPEN', NOW());
                            """,
                            (fid, run_id, finding["defect_type"], finding["severity"], finding["finding_details"]),
                        )

                elif file.endswith(".json") or file.endswith(".bim"):
                    checks_total += 1
                    with open(full_path, "r", encoding="utf-8") as f:
                        try:
                            json_data = json.load(f)
                            checks_passed += 1
                            # Validate Direct Lake mode if semantic model
                            if "model" in json_data and isinstance(json_data["model"], dict):
                                checks_total += 1
                                if json_data["model"].get("defaultMode") == "directLake":
                                    checks_passed += 1
                                else:
                                    fid = str(uuid.uuid4())
                                    findings.append(
                                        {
                                            "finding_id": fid,
                                            "run_id": run_id,
                                            "defect_type": "ARCHITECTURE_STANDARD",
                                            "severity": "MEDIUM",
                                            "finding_details": "Semantic model not configured with Direct Lake storage mode.",
                                        }
                                    )
                        except json.JSONDecodeError as je:
                            fid = str(uuid.uuid4())
                            findings.append(
                                {
                                    "finding_id": fid,
                                    "run_id": run_id,
                                    "defect_type": "MALFORMED_JSON",
                                    "severity": "CRITICAL",
                                    "finding_details": f"JSON artifact '{file}' is malformed: {je}",
                                }
                            )

                elif file.endswith(".sql"):
                    checks_total += 1
                    with open(full_path, "r", encoding="utf-8") as f:
                        sql_text = f.read()
                    if "CREATE TABLE" in sql_text and "_sk" in sql_text:
                        checks_passed += 1
                    else:
                        fid = str(uuid.uuid4())
                        findings.append(
                            {
                                "finding_id": fid,
                                "run_id": run_id,
                                "defect_type": "KIMBALL_STANDARD",
                                "severity": "MEDIUM",
                                "finding_details": f"SQL DDL '{file}' does not enforce Kimball surrogate key naming (_sk).",
                            }
                        )

        conn.commit()

    compliance_pct = int((checks_passed / checks_total) * 100) if checks_total > 0 else 100
    return {
        "run_id": run_id,
        "auditor_agent": "OmniFlow Quality & Standards Auditor Agent",
        "compliance_score_pct": compliance_pct,
        "total_checks": checks_total,
        "passed_checks": checks_passed,
        "findings_count": len(findings),
        "status": "APPROVED_FOR_DEPLOYMENT" if len(findings) == 0 else "DEFECTS_DETECTED",
        "findings": findings,
    }

