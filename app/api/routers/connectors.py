"""
app/api/routers/connectors.py
-----------------------------
FastAPI router for source connector discovery, schema extraction, and connectivity tests.
"""

from typing import Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from connectors.connector_registry import get_connector, list_connectors

router = APIRouter(prefix="/api/connectors", tags=["Source Connectors"])


class DiscoverRequest(BaseModel):
    source_id: str = Field(..., description="Target connector identifier (e.g. postgres, azure_sql, oracle)")
    params: dict[str, Any] = Field(default_factory=dict, description="Connection parameters and credentials")


class SchemaRequest(BaseModel):
    source_id: str = Field(..., description="Connector identifier")
    table: str = Field(..., description="Target table name")
    schema_name: str = Field("dbo", description="Database schema name")
    params: dict[str, Any] = Field(default_factory=dict, description="Connection parameters")


class ConnectionTestRequest(BaseModel):
    source_id: str = Field(..., description="Connector identifier")
    params: dict[str, Any] = Field(default_factory=dict, description="Connection parameters")


@router.get("", summary="List All Registered Source Connectors")
async def get_connectors() -> list[dict[str, Any]]:
    """Returns metadata and parameter specifications for all registered source connectors."""
    return list_connectors()


@router.post("/test", summary="Test Source Connectivity")
async def test_source_connection(req: ConnectionTestRequest):
    """Performs a lightweight connectivity ping against the external source."""
    try:
        conn = get_connector(req.source_id)
        return conn.test_connection(req.params)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Connectivity test failed: {str(e)}") from e


@router.post("/discover", summary="Discover Tables in External Source")
async def discover_tables(req: DiscoverRequest):
    """Fetches table list and metadata without reading row data."""
    try:
        conn = get_connector(req.source_id)
        return conn.discover_tables(req.params)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Discovery failed: {str(e)}") from e


@router.post("/schema", summary="Extract Column Schema for Table")
async def get_table_schema(req: SchemaRequest):
    """Extracts column definitions, data types, and primary key constraints."""
    try:
        conn = get_connector(req.source_id)
        return conn.get_schema(req.table, req.params, schema_name=req.schema_name)
    except KeyError as e:
        raise HTTPException(status_code=404, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Schema extraction failed: {str(e)}") from e
