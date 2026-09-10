"""
app/generators/dataflow_gen.py
------------------------------
Generates Power Query M-code (mashup.pq) and Dataflow Gen2 item definition parts
for low-code ETL, schema casting, and direct Lakehouse Delta ingestion.
"""

from __future__ import annotations

import base64
import json
from typing import Any


def _b64(content: str) -> str:
    """Encodes a UTF-8 string to Base64."""
    return base64.b64encode(content.encode("utf-8")).decode("utf-8")


def generate_powerquery_mashup(
    dataflow_name: str,
    source_type: str = "AzureBlobStorage",
    source_url: str = "https://adlsstorage.dfs.core.windows.net/raw/data.csv",
    target_lakehouse_name: str = "lh_bronze",
    target_table_name: str = "raw_ingest",
    columns: list[dict[str, str]] | None = None,
) -> str:
    """Generates a production Power Query M-code mashup script (mashup.pq)."""
    cols = columns or [
        {"name": "id", "type": "Int64.Type"},
        {"name": "customer_id", "type": "Text.Type"},
        {"name": "amount", "type": "Double.Type"},
        {"name": "transaction_date", "type": "DateTime.Type"},
    ]

    type_transforms = ",\n        ".join(
        [f'{{"{c["name"]}", {c.get("type", "Text.Type")}}}' for c in cols]
    )

    mashup = f"""section Section1;

shared {target_table_name} = let
    // 1. Source Connectivity
    Source = AzureStorage.DataLake("{source_url}"),
    CsvContent = Source{{[Name="{target_table_name}.csv"]}}[Content],
    ImportedCsv = Csv.Document(CsvContent, [Delimiter=",", Encoding=65001, QuoteStyle=QuoteStyle.Csv]),
    PromotedHeaders = Table.PromoteHeaders(ImportedCsv, [PromoteAllScalars=true]),

    // 2. Strong Type Casting
    ChangedTypes = Table.TransformColumnTypes(PromotedHeaders, {{
        {type_transforms}
    }}),

    // 3. System Audit Metadata
    AddedAuditTs = Table.AddColumn(ChangedTypes, "_ingest_ts", each DateTimeZone.UtcNow(), type datetimezone),
    AddedSourceFile = Table.AddColumn(AddedAuditTs, "_source_file", each "{target_table_name}.csv", type text)
in
    AddedSourceFile;
"""
    return mashup


def package_dataflow_definition_parts(
    dataflow_name: str,
    mashup_code: str,
    target_lakehouse_id: str | None = None,
    target_lakehouse_name: str = "lh_bronze",
) -> list[dict[str, Any]]:
    """Packages Dataflow Gen2 mashup and metadata parts into Base64 payload."""
    template_meta = {
        "name": dataflow_name,
        "description": f"Fabric Dataflow Gen2 low-code pipeline ({dataflow_name})",
        "version": "2.0",
        "outputDestination": {
            "type": "FabricLakehouse",
            "lakehouseId": target_lakehouse_id or "00000000-0000-0000-0000-000000000000",
            "lakehouseName": target_lakehouse_name,
        },
    }

    return [
        {
            "path": "mashup.pq",
            "payload": _b64(mashup_code),
            "payloadType": "InlineBase64",
        },
        {
            "path": "dataflow-template.json",
            "payload": _b64(json.dumps(template_meta, indent=2)),
            "payloadType": "InlineBase64",
        },
    ]
