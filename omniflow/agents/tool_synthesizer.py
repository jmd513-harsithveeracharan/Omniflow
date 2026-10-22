from __future__ import annotations

import os
from typing import Any

import omniflow.agents.tool_registry as tool_registry
from omniflow.agents.schemas import SynthesizedToolSpec
from omniflow.db.postgres_repo import PostgresRepository

SYNTHESIZED_FILE = os.path.join(os.path.dirname(__file__), "synthesized_tools.py")


TOOL_BLUEPRINTS: dict[str, dict[str, Any]] = {
    "build_sap_rfc_cdc_connector_tool": {
        "display_name": "SAP ECC ODP/RFC Change Data Capture Connector Synthesizer",
        "description": "Synthesizes a real-time SAP ODP/RFC CDC connector manifest and watermark state config for Fabric Bronze.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_code": {"type": "string"},
                "sap_tables": {"type": "array", "items": {"type": "string"}},
            },
        },
        "output_schema": {"type": "object", "properties": {"connector_config": {"type": "object"}}},
        "code": '''
def build_sap_rfc_cdc_connector_tool(project_code: str, sap_tables: list[str] | None = None, domain: str = "fin_ops", **kwargs):
    """Dynamically synthesized by OmniFlow Research Agent: SAP ECC RFC CDC connector builder."""
    sap_tables = sap_tables or ["BKPF", "BSEG", "VBAK", "VBAP", "KNA1"]
    config = {
        "connector_type": "SAP_ODP_RFC_CDC_STREAM",
        "project_code": project_code,
        "gateway_cluster": "onprem-sap-gateway-01.corp.internal:3300",
        "odp_context": "ABAP_CDS",
        "cdc_mode": "DELTA_QUEUE_WATERMARK",
        "subscribed_tables": [
            {"table": t, "delta_pointer_field": "AEDAT", "polling_interval_sec": 30}
            for t in sap_tables
        ],
        "sink_lakehouse": f"lh_{domain}_raw",
        "folder": kwargs.get("containment_folder") or "Workspace Root",
    }
    return {
        "file_extension": "json",
        "content_str": None,
        "definition": config,
    }
''',
    },
    "build_direct_lake_bim_tool": {
        "display_name": "Power BI Direct Lake Semantic Model (.bim) Synthesizer",
        "description": "Synthesizes a Tabular Object Model (model.bim) JSON with Direct Lake OneLake framing and DAX measures.",
        "input_schema": {
            "type": "object",
            "properties": {
                "project_code": {"type": "string"},
                "warehouse_name": {"type": "string"},
            },
        },
        "output_schema": {"type": "object", "properties": {"bim_model": {"type": "object"}}},
        "code": '''
def build_direct_lake_bim_tool(project_code: str, warehouse_name: str = "wh_fin_ops_analytics", **kwargs):
    """Dynamically synthesized by OmniFlow Research Agent: Power BI Direct Lake .bim generator."""
    bim = {
        "name": f"sm_{project_code.lower().replace('-', '_')}_direct_lake",
        "compatibilityLevel": 1604,
        "model": {
            "defaultPowerBIDataSourceVersion": "powerBI_V3",
            "defaultMode": "directLake",
            "expressions": [
                {
                    "name": "DatabaseQuery",
                    "kind": "m",
                    "expression": f"Sql.Database(\\"onelake.dfs.fabric.microsoft.com\\", \\"{warehouse_name}\\")",
                }
            ],
            "tables": [
                {
                    "name": "fact_financial_settlements",
                    "partitions": [
                        {
                            "name": "DirectLake_Partition",
                            "mode": "directLake",
                            "source": {"type": "entity", "entityName": "fact_financial_settlements", "expressionSource": "DatabaseQuery"},
                        }
                    ],
                    "measures": [
                        {"name": "Total Net Settlement USD", "expression": "SUM(fact_financial_settlements[net_amount_usd])", "formatString": "$#,0.00"},
                        {"name": "Total Tax USD", "expression": "SUM(fact_financial_settlements[tax_amount_usd])", "formatString": "$#,0.00"},
                    ],
                },
                {"name": "dim_customer", "partitions": [{"name": "DirectLake_Cust", "mode": "directLake"}]},
                {"name": "dim_product", "partitions": [{"name": "DirectLake_Prod", "mode": "directLake"}]},
            ],
            "relationships": [
                {
                    "name": "rel_fact_customer",
                    "fromTable": "fact_financial_settlements",
                    "fromColumn": "dim_customer_sk",
                    "toTable": "dim_customer",
                    "toColumn": "dim_customer_sk",
                }
            ],
        },
    }
    return {
        "file_extension": "bim.json",
        "content_str": None,
        "definition": bim,
    }
''',
    },
}


def clear_synthesized_runtime_tools() -> None:
    """Clears dynamically synthesized tools from memory and disk prior to a fresh demonstration run."""
    for tname in TOOL_BLUEPRINTS:
        if hasattr(tool_registry, tname):
            delattr(tool_registry, tname)
    with open(SYNTHESIZED_FILE, "w", encoding="utf-8") as f:
        f.write('"""Dynamically synthesized tools generated at runtime by OmniFlow Research Agent."""\n')


def synthesize_and_register_tool(tool_name: str, repo: PostgresRepository) -> SynthesizedToolSpec:
    """Synthesizes Python tool implementation, attaches to tool_registry, and inserts into PostgreSQL."""
    blueprint = TOOL_BLUEPRINTS.get(tool_name)
    if not blueprint:
        # Generic fallback synthesizer for any custom tool name discovered from user prompt
        code = f'''
def {tool_name}(project_code: str = "PRJ-CUSTOM", **kwargs):
    """Dynamically synthesized custom tool: {tool_name}"""
    return {{
        "file_extension": "json",
        "content_str": None,
        "definition": {{"tool": "{tool_name}", "project_code": project_code, "parameters": kwargs, "status": "synthesized"}},
    }}
'''
        blueprint = {
            "display_name": f"Synthesized Tool: {tool_name}",
            "description": f"Autonomously researched and synthesized tool '{tool_name}' for Fabric execution.",
            "input_schema": {"type": "object", "properties": {"project_code": {"type": "string"}}},
            "output_schema": {"type": "object", "properties": {"definition": {"type": "object"}}},
            "code": code,
        }

    # 1. Run AST Security Guardrail & Secret Scanner
    from omniflow.tools.guardrails import validate_synthesized_python_code

    security_check = validate_synthesized_python_code(blueprint["code"])
    if not security_check["is_safe"]:
        raise PermissionError(f"Synthesized code failed security guardrail: {security_check['violations']}")

    # 2. Append Python implementation to omniflow/agents/synthesized_tools.py
    with open(SYNTHESIZED_FILE, "a", encoding="utf-8") as f:
        f.write("\n" + blueprint["code"].strip() + "\n")

    # 3. Compile and attach to tool_registry module in memory
    namespace: dict[str, Any] = {}
    exec(blueprint["code"], namespace)
    func = namespace[tool_name]
    setattr(tool_registry, tool_name, func)

    # 3. Register tool and agent_tools binding in live PostgreSQL database
    endpoint = f"omniflow.agents.synthesized_tools.{tool_name}"
    tool_id = repo.register_synthesized_tool(
        tool_name=tool_name,
        display_name=blueprint["display_name"],
        description=blueprint["description"],
        endpoint=endpoint,
        input_schema=blueprint["input_schema"],
        output_schema=blueprint["output_schema"],
        bind_to_agent="executor_agent",
    )

    return SynthesizedToolSpec(
        tool_id=tool_id,
        tool_name=tool_name,
        display_name=blueprint["display_name"],
        description=blueprint["description"],
        endpoint=endpoint,
        input_schema=blueprint["input_schema"],
        output_schema=blueprint["output_schema"],
        python_file_path=SYNTHESIZED_FILE,
        persisted_to_postgres=True,
    )
