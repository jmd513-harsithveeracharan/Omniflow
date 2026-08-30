# 03. Skill System & MCP Connector Bundles

---

## 1. Overview of the Skill System

In Fabric AI, source connectors are not monolithic, hardcoded Python files. Instead, each data source is packaged as a self-contained **Connector Skill Bundle** conforming to the **Model Context Protocol (MCP)** standard.

This modular architecture ensures:
1. **Zero Core Code Bloat:** Adding a new source (e.g., Snowflake, HubSpot, MongoDB) requires zero changes to the central orchestration engine.
2. **Context Window Efficiency:** The LLM only loads the specific `SKILL.md` for the active source being ingested, saving context tokens and eliminating hallucination across unrelated databases.
3. **Self-Skilling Capability:** When an unfamiliar source is introduced, the Agent can analyze documentation and automatically generate a new `SKILL.md` for human review.

---

## 2. Anatomy of a Connector Skill Bundle

Every connector lives in `skills/connectors/<source_id>/` and contains three standardized files:

```
skills/connectors/
├── azure_sql/
│   ├── SKILL.md              <-- AI Ingestion Playbook & PySpark Recipes
│   ├── config_schema.json    <-- UI Parameter Form Specification
│   └── connector_tools.py    <-- Stateless Metadata MCP Tools
│
├── salesforce/
│   ├── SKILL.md
│   ├── config_schema.json
│   └── connector_tools.py
│
├── sap_ecc/
│   ├── SKILL.md
│   ├── config_schema.json
│   └── connector_tools.py
│
├── amazon_redshift/
│   ├── SKILL.md
│   ├── config_schema.json
│   └── connector_tools.py
│
└── azure_blob_storage/
    ├── SKILL.md
    ├── config_schema.json
    └── connector_tools.py
```

---

## 3. Specification of the 3 Bundle Files

### File 1: `config_schema.json` (UI Parameter Form Specification)
This file defines the input parameters required to connect to the source. The frontend web studio reads this JSON to dynamically render clean, accessible UI input forms.

```json
{
  "source_id": "azure_sql",
  "name": "Azure SQL / SQL Server",
  "category": "Relational Database",
  "icon_svg": "<svg>...</svg>",
  "parameters": [
    {
      "key": "server",
      "label": "Server Endpoint",
      "type": "text",
      "placeholder": "myserver.database.windows.net",
      "required": true,
      "description": "Fully qualified Azure SQL Server domain or on-prem hostname"
    },
    {
      "key": "database",
      "label": "Database Name",
      "type": "text",
      "placeholder": "SalesDB",
      "required": true
    },
    {
      "key": "username",
      "label": "Database User",
      "type": "text",
      "placeholder": "sql_reader_user",
      "required": true
    },
    {
      "key": "key_vault_secret_name",
      "label": "Key Vault Password Secret Name",
      "type": "text",
      "placeholder": "SalesDB-Password-Secret",
      "required": true,
      "description": "The secret key name in Azure Key Vault containing the password"
    },
    {
      "key": "port",
      "label": "Port",
      "type": "number",
      "default": 1433,
      "required": false
    }
  ]
}
```

---

### File 2: `SKILL.md` (The AI Ingestion Playbook)
This Markdown document serves as the LLM's system instructions for that specific source. It documents connection mechanisms, rate limits, pagination cursors, and PySpark read templates.

```markdown
---
source_id: "azure_sql"
source_name: "Azure SQL Database"
auth_type: "SQL_Auth_KeyVault"
cdc_supported: true
cdc_mechanism: "Change_Tracking_or_Watermark"
pagination: "Offset_Fetch"
fabric_runtime: "PySpark_3.4"
delta_table_format: "append_merge"
---

# Azure SQL Ingestion Skill Playbook

## 1. Connectivity Protocol
- Use standard JDBC connection string:
  `jdbc:sqlserver://<server>:<port>;databaseName=<database>;encrypt=true;trustServerCertificate=false`
- JDBC Driver: `com.microsoft.sqlserver.jdbc.SQLServerDriver`

## 2. Watermark & Incremental Ingestion Strategy
- Watermark Candidates: `sys_updated_at`, `ModifiedDate`, `LastModifiedDate`, `RowVersion`
- Incremental Read Query Pattern:
  ```sql
  SELECT * FROM <schema>.<table> WHERE <watermark_col> >= '<last_watermark>'
  ```

## 3. High-Throughput Partitioning Optimization
- For tables > 1,000,000 rows, split read using `numPartitions`, `partitionColumn`, `lowerBound`, `upperBound`.

## 4. Delta Lake Idempotent Upsert Recipe
```python
from delta.tables import DeltaTable

target_table = f"{target_lakehouse}.bronze_{table_slug}"
if DeltaTable.isDeltaTable(spark, target_table):
    dt = DeltaTable.forName(spark, target_table)
    dt.alias("tgt").merge(
        source_df.alias("src"),
        f"tgt.{primary_key} = src.{primary_key}"
    ).whenMatchedUpdateAll().whenNotMatchedInsertAll().execute()
else:
    source_df.write.format("delta").mode("overwrite").saveAsTable(target_table)
```
```

---

### File 3: `connector_tools.py` (The MCP Tool Implementation)
Implements the standardized Python class inheriting from `BaseConnector`.

```python
from connectors.base_connector import BaseConnector

class AzureSQLConnector(BaseConnector):
    name = "Azure SQL / SQL Server"
    source_id = "azure_sql"

    def test_connection(self, params: dict) -> dict:
        """Lightweight connection ping."""
        ...

    def discover_tables(self, params: dict) -> dict:
        """Queries INFORMATION_SCHEMA.TABLES. Returns table list without row data."""
        ...

    def get_schema(self, table: str, params: dict, schema_name: str = "dbo") -> dict:
        """Queries INFORMATION_SCHEMA.COLUMNS. Returns column names, types, nullability."""
        ...

    def generate_pyspark_ingest_code(self, table: str, schema: list, target_lakehouse: str, layer: str = "Bronze", params: dict = None) -> str:
        """Emits production-grade PySpark notebook code using the SKILL.md recipe."""
        ...
```

---

## 4. The Self-Skilling Mechanism (Autonomous Skill Discovery)

When a user requests ingestion from an unsupported or new source system (e.g., *"Ingest data from ServiceNow or Stripe"*):

```
User Intent: "Ingest from ServiceNow"
          │
          ▼
Agent checks skills/connectors/servicenow/
          │
          ├── FOUND ➔ Load existing SKILL.md and proceed.
          │
          └── NOT FOUND ➔ Enter Self-Skilling Mode:
                    │
                    ▼
              1. LLM queries official API specs & documentation.
              2. Generates draft `config_schema.json` & `SKILL.md`.
              3. Presents generated Skill to user for review (HITL Checkpoint 1).
              4. User approves or edits the Skill.
              5. Skill is committed to `skills/connectors/servicenow/` for all future runs!
```

This self-skilling capability ensures that the platform's knowledge base **compounds over time**, continuously expanding its connectivity coverage.
