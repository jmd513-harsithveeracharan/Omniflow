"""
app/generators/semantic_gen.py
------------------------------
Generates Power BI Direct Lake Tabular Model Definition Language (TMDL)
definitions reading directly from Gold Delta Lakehouse tables in OneLake.
"""

import base64
from typing import Any


def generate_direct_lake_tmdl(
    model_name: str,
    lakehouse_id: str,
    lakehouse_name: str,
    workspace_id: str,
    tables: list[dict[str, Any]],
    measures: list[dict[str, str]] | None = None,
) -> dict[str, str]:
    """
    Generates TMDL format text files for a Direct Lake Power BI Semantic Model.
    
    Returns a dictionary of relative file paths to raw TMDL text content:
    {
      "definition.tmdl": "...",
      "model.tmdl": "...",
      "tables/FactOrders.tmdl": "...",
      ...
    }
    """
    tmdl_parts: dict[str, str] = {}

    # 1. Main model header (definition.tmdl)
    tmdl_parts["definition.tmdl"] = f"""definition
\tmodel {model_name}
\t\tculture: en-US
"""

    # 2. Model settings with Direct Lake partition connection
    tmdl_parts["model.tmdl"] = f"""model Model
\tculture: en-US
\tdefaultPowerBIDataSourceVersion: powerBI_V3
\tsourceQueryCulture: en-US
\tdataAccessOptions
\t\tlegacyRedirects
\t\treturnErrorValuesAsNull

annotation __PBI_TimeIntelligenceEnabled = 1
annotation PBIDesktopVersion = 2.138.0.0
annotation DirectLakeConnectionId = {{"workspaceId":"{workspace_id}","itemId":"{lakehouse_id}"}}
"""

    # 3. Individual Table Definitions
    for tbl in tables:
        tbl_name = tbl.get("name", "Table")
        cols = tbl.get("columns", [])

        col_defs = []
        for c in cols:
            c_name = c.get("name", "Col")
            c_type = c.get("type", "string").lower()
            data_type = "string"
            if "int" in c_type or "long" in c_type:
                data_type = "int64"
            elif "double" in c_type or "float" in c_type or "decimal" in c_type:
                data_type = "double"
            elif "bool" in c_type:
                data_type = "boolean"
            elif "date" in c_type or "time" in c_type:
                data_type = "dateTime"

            col_defs.append(f"""\tcolumn {c_name}
\t\tdataType: {data_type}
\t\tsourceColumn: {c_name}
\t\tsummarizeBy: none
""")

        # Add Measures if specified for this table
        measure_defs = []
        if measures:
            for m in measures:
                if m.get("table", tbl_name) == tbl_name:
                    m_name = m.get("name", "Measure")
                    m_dax = m.get("dax", "COUNTROWS()")
                    measure_defs.append(f"""\tmeasure '{m_name}' = {m_dax}
\t\tformatString: #,##0
""")

        table_tmdl = f"""table {tbl_name}
\tlineageTag: {tbl_name}_tag

{chr(10).join(col_defs)}
{chr(10).join(measure_defs)}
\tpartition {tbl_name} = entity
\t\tmode: directLake
\t\tsource
\t\t\tentityName: {tbl_name}
\t\t\tschemaName: dbo
\t\t\tlakehouseName: {lakehouse_name}
"""
        tmdl_parts[f"tables/{tbl_name}.tmdl"] = table_tmdl

    return tmdl_parts


def package_semantic_model_definition_parts(tmdl_files: dict[str, str]) -> list[dict[str, Any]]:
    """
    Packages multiple TMDL files into Base64 inline definition parts format for Fabric API.
    """
    parts = []
    for rel_path, content_str in tmdl_files.items():
        encoded = base64.b64encode(content_str.encode("utf-8")).decode("utf-8")
        parts.append({
            "path": rel_path,
            "payload": encoded,
            "payloadType": "InlineBase64",
        })
    return parts
