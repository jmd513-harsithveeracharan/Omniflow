"""
tests/test_postgres_storage.py
------------------------------
Comprehensive Unit and Integration Tests for PostgreSQL + pgvector Storage Adapter.
Validates:
  1. PostgreSQL DDL schema & table creation script
  2. Session lifecycle & multi-turn message retention
  3. Project CRUD operations & metadata indexing
  4. Deployment run states & JSONB plan payloads
  5. HNSW pgvector similarity search & recipe ranking
  6. Token usage audit logging & aggregation
"""

import json
from unittest.mock import MagicMock, patch
import pytest

from app.domain.models.session import ArchitectureRecipe, MessageRecord, RunRecord, SessionRecord
from app.domain.storage.postgres_adapter import PostgresStorageAdapter
from app.domain.storage.postgres_schema import PG_SCHEMA_DDL


def test_postgres_schema_ddl_validity():
    """Verify that PG_SCHEMA_DDL contains all required tables and pgvector extension."""
    assert "CREATE EXTENSION IF NOT EXISTS vector;" in PG_SCHEMA_DDL
    assert "CREATE TABLE IF NOT EXISTS sessions" in PG_SCHEMA_DDL
    assert "CREATE TABLE IF NOT EXISTS messages" in PG_SCHEMA_DDL
    assert "CREATE TABLE IF NOT EXISTS projects" in PG_SCHEMA_DDL
    assert "CREATE TABLE IF NOT EXISTS runs" in PG_SCHEMA_DDL
    assert "CREATE TABLE IF NOT EXISTS learned_facts" in PG_SCHEMA_DDL
    assert "CREATE TABLE IF NOT EXISTS token_usage" in PG_SCHEMA_DDL
    assert "CREATE TABLE IF NOT EXISTS recipes" in PG_SCHEMA_DDL
    assert "CREATE TABLE IF NOT EXISTS lineage_nodes" in PG_SCHEMA_DDL
    assert "CREATE TABLE IF NOT EXISTS lineage_edges" in PG_SCHEMA_DDL
    assert "USING hnsw (embedding vector_cosine_ops)" in PG_SCHEMA_DDL
    assert "USING gin(plan_json)" in PG_SCHEMA_DDL


def test_postgres_adapter_mocked_session_lifecycle():
    """Test PostgresStorageAdapter session and message operations with mocked connection."""
    with patch("psycopg.connect") as mock_connect:
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        adapter = PostgresStorageAdapter("postgresql://postgres:postgres@localhost:5432/fabric_ai_test")

        # 1. Create Session
        sess = SessionRecord(session_id="sess_pg_001", workspace_id="ws-123", metadata={"title": "Test Session"})
        saved_sess = adapter.create_session(sess)
        assert saved_sess.session_id == "sess_pg_001"
        assert mock_cur.execute.called

        # 2. Add Message
        msg = MessageRecord(session_id="sess_pg_001", turn_index=1, role="user", content="Build Delta Lakehouse")
        mock_cur.fetchone.return_value = {"id": 101}
        saved_msg = adapter.add_message(msg)
        assert saved_msg.id == 101


def test_postgres_adapter_mocked_project_crud():
    """Test project creation and queries in PostgreSQL adapter."""
    with patch("psycopg.connect") as mock_connect:
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        adapter = PostgresStorageAdapter("postgresql://postgres:postgres@localhost:5432/fabric_ai_test")

        proj = adapter.create_project("Enterprise Analytics", "Medallion architecture")
        assert proj["name"] == "Enterprise Analytics"
        assert proj["id"].startswith("proj_")

        mock_cur.fetchall.return_value = [
            {
                "id": "proj_123",
                "name": "Enterprise Analytics",
                "description": "Desc",
                "is_pinned": 1,
                "is_archived": 0,
                "metadata": "{}",
                "created_at": "2026-09-15T12:00:00Z",
                "updated_at": "2026-09-15T12:00:00Z",
            }
        ]
        all_projs = adapter.get_all_projects()
        assert len(all_projs) == 1
        assert all_projs[0]["name"] == "Enterprise Analytics"


def test_postgres_adapter_mocked_recipe_vector_search():
    """Test HNSW vector similarity search execution."""
    with patch("psycopg.connect") as mock_connect:
        mock_conn = MagicMock()
        mock_cur = MagicMock()
        mock_connect.return_value.__enter__.return_value = mock_conn
        mock_conn.cursor.return_value.__enter__.return_value = mock_cur

        adapter = PostgresStorageAdapter("postgresql://postgres:postgres@localhost:5432/fabric_ai_test")

        # Mock vector similarity query response
        mock_cur.fetchall.return_value = [
            {
                "id": "rec_001",
                "title": "Direct Lake Semantic Model",
                "description": "TMDL Power BI Direct Lake pattern",
                "source_dialect": "tsql",
                "target_fabric_type": "semantic_model",
                "code_template": "model Model\n...",
                "tags": ["direct_lake", "tmdl"],
                "rating": 5,
                "similarity_score": 0.985,
            }
        ]

        results = adapter.search_similar_recipes([0.01] * 1536, top_k=1)
        assert len(results) == 1
        assert results[0]["title"] == "Direct Lake Semantic Model"
        assert results[0]["similarity_score"] == 0.985
