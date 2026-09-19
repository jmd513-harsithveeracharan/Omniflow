"""
sap_connector.py
----------------
SAP source connector stub — connector #2 after Azure SQL.

Supports two SAP access modes:
  1. SAP HANA (direct HDBCLI/JDBC connection, schema discovery via SYS.TABLE_COLUMNS)
  2. SAP ODP via REST (uses SAP Datasphere or SAP BW ODP REST endpoint)

Column-name/type discovery only — no row data ever fetched.
"""

from connectors.base_connector import BaseConnector


ICON_SVG = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="24" height="24" fill="none" stroke="#00893d" stroke-width="2">
  <rect x="4" y="8" width="24" height="16" rx="3"/>
  <text x="16" y="21" font-size="9" text-anchor="middle" fill="#00893d" stroke="none" font-family="Arial" font-weight="bold">SAP</text>
</svg>"""


class SAPConnector(BaseConnector):
    """
    SAP source connector (HANA + ODP).

    Stub implementation — full code added in Phase 2 of connector build-out.
    Returns is_stub=True in all responses so the UI shows a "Coming Soon" badge.
    """

    name = "SAP (HANA / ODP)"
    source_id = "sap"
    icon_svg = ICON_SVG
    is_stub = True  # UI reads this to show "Coming Soon" state

    required_params = [
        {
            "key": "mode",
            "label": "Connection Mode",
            "type": "select",
            "options": ["SAP HANA (JDBC)", "SAP ODP REST"],
            "placeholder": "Select SAP access mode",
        },
        {
            "key": "host",
            "label": "Host / URL",
            "type": "text",
            "placeholder": "hana-host.example.com or https://odp-endpoint",
        },
        {
            "key": "port",
            "label": "Port",
            "type": "text",
            "placeholder": "30015 (HANA) or 443 (ODP REST)",
        },
        {
            "key": "username",
            "label": "Username / Client ID",
            "type": "text",
            "placeholder": "SAP user or OAuth client ID",
        },
        {
            "key": "password",
            "label": "Password / Client Secret",
            "type": "password",
            "placeholder": "••••••••",
        },
        {
            "key": "schema",
            "label": "Schema / Namespace",
            "type": "text",
            "placeholder": "SAPHANADB or /sap/opu/odata/sap/...",
        },
    ]

    # ── Stub implementations ──────────────────────────────────────────────────

    def test_connection(self, params: dict) -> dict:
        return {
            "success": False,
            "message": "SAP connector is not yet implemented. Coming soon — Azure SQL is available now.",
            "details": {"is_stub": True},
        }

    def discover_tables(self, params: dict) -> dict:
        return {
            "success": False,
            "tables": [],
            "error": "SAP connector stub — not yet implemented.",
            "is_stub": True,
        }

    def get_schema(self, table: str, params: dict, schema_name: str = "") -> dict:
        return {
            "success": False,
            "columns": [],
            "error": "SAP connector stub — not yet implemented.",
            "is_stub": True,
        }

    def generate_pyspark_ingest_code(
        self,
        table: str,
        schema: list,
        target_lakehouse: str,
        layer: str = "Bronze",
        params: dict = None,
    ) -> str:
        return f"""# SAP connector not yet implemented.
# This notebook will be auto-generated when the SAP connector is complete.
# Target table: {target_lakehouse}.{layer.lower()}_{self._safe_table_name(table)}
raise NotImplementedError("SAP connector coming soon")
"""
