"""
app/domain/storage/factory.py
-----------------------------
Factory for instantiating the active StorageAdapter (PostgreSQL + pgvector or SQLite fallback).
"""

from __future__ import annotations

import os
from functools import lru_cache

from app.domain.storage.base import StorageAdapter
from app.domain.storage.sqlite_adapter import SqliteStorageAdapter

_active_storage: StorageAdapter | None = None


@lru_cache(maxsize=1)
def get_storage() -> StorageAdapter:
    """
    Returns the singleton StorageAdapter instance based on DATABASE_URL.
    Defaults to local SQLite if no PostgreSQL connection is configured.
    """
    global _active_storage
    if _active_storage is not None:
        return _active_storage

    db_url = os.getenv("DATABASE_URL", "").strip()

    if db_url.startswith("postgresql://") or db_url.startswith("postgres://"):
        try:
            from app.domain.storage.postgres_adapter import PostgresStorageAdapter

            _active_storage = PostgresStorageAdapter(db_url)
            return _active_storage
        except Exception as e:
            print(f"[STORAGE FACTORY] Failed to connect to PostgreSQL ({e}). Falling back to SQLite.")

    # Local SQLite fallback
    db_path = os.getenv("SQLITE_DB_PATH", "fabric_ai_memory.db")
    _active_storage = SqliteStorageAdapter(db_path)
    return _active_storage
