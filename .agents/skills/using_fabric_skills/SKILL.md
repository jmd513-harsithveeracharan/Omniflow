---
name: using_fabric_skills
description: Meta-skill that discovers, routes, and orchestrates all specialized Fabric AI Studio skills. Use when a new task arrives or when coordinating multi-step data engineering workflows.
---

# Using Fabric AI Studio Skills (Meta-Skill)

## 1. Skill Routing Decision Matrix

When a user request arrives, identify the primary objective and invoke the specialized skill:

```
User Request Arrives
    │
    ├── Architecture / Lakehouse Setup? ──→ fabric_medallion_architecture
    │     (Bronze/Silver/Gold, Direct Lake, Delta lakehouse provisioning)
    │
    ├── Ingesting Tables / Schedules? ────→ fabric_ingestion_and_scheduling
    │     (Full vs Incremental classifier, Watermarks, Cron schedules, Fabric Data Factory)
    │
    ├── SQL Queries / Lineage / AST? ─────→ sql_transpilation_and_lineage
    │     (T-SQL/Oracle/SAP to Spark SQL, Column lineage, Delta MERGE PySpark code)
    │
    └── Deletions / Schema Changes / Risk? → fabric_governance_and_safe_delete
          (Blast-radius analysis, Soft-delete snapshots, Confirmation gate)
```

## 2. Core Operating Behaviors

1. **Zero Hardcoding**:
   - Never assume IDs, table names, or credentials. Always resolve from `.env`, connector discovery, or Fabric REST API.
2. **Progressive Disclosure**:
   - Only load full skill instructions when the task matches the skill's trigger intent.
3. **Token Budget Discipline**:
   - Keep total context under 2,200 tokens. Compact conversation turns beyond the last 10 turns.
4. **Self-Verification**:
   - Always run unit tests (`pytest app/tests/`) and smoke tests (`python smoke_test.py`) after making changes.
