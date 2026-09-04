"""
app/domain/storage/base.py
--------------------------
Abstract Base Storage Adapter interface defining strict CRUD and Vector Search contracts.
Concrete implementations:
  - SqliteStorageAdapter (local zero-setup mode)
  - PostgresStorageAdapter (enterprise pgvector mode)
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from app.domain.models.session import (
    ArchitectureRecipe,
    LearnedFact,
    MessageRecord,
    RunRecord,
    SessionRecord,
)


class StorageAdapter(ABC):
    """Abstract interface for all Fabric AI Studio persistence backends."""

    @abstractmethod
    def init_db(self) -> None:
        """Initialize database schema, tables, and vector extensions."""
        pass

    @abstractmethod
    def create_session(self, record: SessionRecord) -> SessionRecord:
        """Creates or upserts a session record."""
        pass

    @abstractmethod
    def get_session(self, session_id: str) -> SessionRecord | None:
        """Fetches a session by UUID."""
        pass

    @abstractmethod
    def list_sessions(self, workspace_id: str | None = None) -> list[SessionRecord]:
        """Lists active sessions sorted by last_active descending."""
        pass

    @abstractmethod
    def add_message(self, message: MessageRecord) -> MessageRecord:
        """Appends a new conversation message turn."""
        pass

    @abstractmethod
    def get_messages(self, session_id: str, limit: int = 20) -> list[MessageRecord]:
        """Fetches the last N messages in chronological order."""
        pass

    @abstractmethod
    def upsert_fact(self, fact: LearnedFact) -> None:
        """Upserts a learned preference or fact capsule."""
        pass

    @abstractmethod
    def get_facts(self, session_id: str) -> dict[str, str]:
        """Returns all learned facts for a session."""
        pass

    @abstractmethod
    def upsert_run(self, run: RunRecord) -> None:
        """Creates or updates a Fabric deployment run."""
        pass

    @abstractmethod
    def get_run(self, run_id: str) -> RunRecord | None:
        """Fetches a run by UUID."""
        pass

    @abstractmethod
    def save_recipe(self, recipe: ArchitectureRecipe) -> None:
        """Stores a 5-star architecture recipe with vector embedding."""
        pass

    @abstractmethod
    def search_recipes(self, query_embedding: list[float], limit: int = 5) -> list[ArchitectureRecipe]:
        """Performs cosine vector similarity search across architecture recipes."""
        pass
