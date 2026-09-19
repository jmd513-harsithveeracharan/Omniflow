"""
base_connector.py
-----------------
Abstract base class for all Fabric AI source connectors.

Every connector exposes exactly 3 discovery methods (metadata only — no data rows)
plus a code generator. All connectors are stateless; credentials are passed in
per-call from the session-held params dict.
"""

from abc import ABC, abstractmethod
from typing import Any


class BaseConnector(ABC):
    """
    Abstract source connector.

    Subclasses must implement:
        test_connection(params)   -> {"success": bool, "message": str}
        discover_tables(params)   -> list of {"schema": str, "table": str}
        get_schema(table, params) -> list of {"column": str, "type": str, "nullable": bool}
        generate_pyspark_ingest_code(table, schema, target_lakehouse, layer) -> str

    Attributes (set on subclass):
        name         (str)  — Human-readable name, e.g. "Azure SQL"
        source_id    (str)  — Slug, e.g. "azure_sql"
        icon_svg     (str)  — Inline SVG string for UI
        required_params (list[dict]) — [{key, label, type, placeholder}, ...]
    """

    # ── Subclass must define ──────────────────────────────────────────────────

    name: str = "Base Connector"
    source_id: str = "base"
    icon_svg: str = "<svg/>"
    required_params: list = []

    # ── Public Interface (agent calls these) ──────────────────────────────────

    @abstractmethod
    def test_connection(self, params: dict) -> dict:
        """
        Attempt a lightweight connection check.
        Returns {"success": bool, "message": str, "details": dict|None}
        Must never raise — catch all exceptions internally.
        """
        ...

    @abstractmethod
    def discover_tables(self, params: dict) -> dict:
        """
        Return list of available tables/views — metadata only, no row counts.
        Returns {"success": bool, "tables": [{"schema":..., "table":...}], "error": str|None}
        """
        ...

    @abstractmethod
    def get_schema(self, table: str, params: dict, schema_name: str = "dbo") -> dict:
        """
        Return column-level metadata for a single table.
        Returns {"success": bool, "columns": [{"column":..., "type":..., "nullable":...}], "error": str|None}
        Must NEVER fetch actual row data.
        """
        ...

    @abstractmethod
    def generate_pyspark_ingest_code(
        self,
        table: str,
        schema: list,
        target_lakehouse: str,
        layer: str = "Bronze",
        params: dict = None,
    ) -> str:
        """
        Generate PySpark notebook code string for ingesting this table into Fabric.
        The generated code must:
          - Use JDBC or native connector to read from source
          - Never print or display actual data rows (only counts/status)
          - Write to Delta table in the target lakehouse
          - Include basic data quality checks
        Returns the PySpark code as a plain string.
        """
        ...

    # ── Shared Helper ─────────────────────────────────────────────────────────

    def to_info_dict(self) -> dict:
        """Returns connector metadata for the /api/connectors endpoint."""
        return {
            "id": self.source_id,
            "source_id": self.source_id,
            "name": self.name,
            "category": getattr(self, "category", "Database"),
            "default_port": getattr(self, "default_port", "5432"),
            "icon_svg": self.icon_svg,
            "required_params": self.required_params,
        }

    def _safe_table_name(self, table: str) -> str:
        """Sanitise table name for use in Delta table identifiers."""
        return table.lower().replace(" ", "_").replace("-", "_").replace(".", "_")
