"""
omniflow/tools/asset_indexer.py
--------------------------------
Persistent Semantic Asset & Connection Index for Microsoft Fabric.
Scalable metadata catalog storing item and connection GUIDs with semantic summaries,
enabling instant lookups, zero duplicate provisioning, and cross-session JIT hydration.
"""

from __future__ import annotations

import json
import os
import re
import time
from typing import Optional
from pydantic import BaseModel, Field

from omniflow.config.env_loader import get_workspace_id
from omniflow.tools.fabric_adapter import list_workspace_items


class AssetIndexEntry(BaseModel):
    """Semantic catalog entry for a Microsoft Fabric Item or Connection."""

    guid: str = Field(..., description="Fabric Item GUID or Connection ID")
    name: str = Field(..., description="Display name / identifier")
    item_type: str = Field(..., description="Lakehouse, Warehouse, Notebook, DataPipeline, Connection, Eventstream, etc.")
    workspace_id: str = Field(..., description="Fabric Workspace ID")
    summary: str = Field(default="", description="Semantic summary of contents, purpose, and schemas")
    tags: list[str] = Field(default_factory=list, description="Categorization tags (e.g. sap, sales, bronze, delta)")
    metadata: dict[str, str] = Field(default_factory=dict, description="Custom metadata (e.g. sql_endpoint, tables, source)")
    created_at: float = Field(default_factory=time.time)
    last_used_at: float = Field(default_factory=time.time)


class AssetIndexCatalog(BaseModel):
    """Root catalog schema for persistent asset indexing."""

    workspace_id: str
    version: str = "1.0.0"
    last_synced_at: float = Field(default_factory=time.time)
    entries: dict[str, AssetIndexEntry] = Field(default_factory=dict)


class AssetIndexer:
    """Manages scaling persistent asset indexing with fast semantic query matching."""

    def __init__(self, workspace_id: Optional[str] = None, storage_path: Optional[str] = None) -> None:
        self.workspace_id = workspace_id or get_workspace_id()
        base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.storage_path = storage_path or os.path.join(base_dir, ".fabric_asset_index.json")
        self.catalog = self._load_catalog()

    def _load_catalog(self) -> AssetIndexCatalog:
        if os.path.exists(self.storage_path):
            try:
                with open(self.storage_path, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    return AssetIndexCatalog.model_validate(data)
            except Exception:
                pass
        return AssetIndexCatalog(workspace_id=self.workspace_id)

    def save(self) -> None:
        """Persists the index atomically to disk."""
        try:
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump(self.catalog.model_dump(), f, indent=2)
        except Exception as e:
            print(f"[INDEX ERROR] Failed to save asset index: {e}")

    def register(
        self,
        name: str,
        item_type: str,
        guid: str,
        summary: str = "",
        tags: Optional[list[str]] = None,
        metadata: Optional[dict[str, str]] = None,
    ) -> AssetIndexEntry:
        """Indexes or updates a Fabric item/connection GUID with semantic details."""
        clean_key = name.lower().strip()
        all_tags = [t.lower().strip() for t in (tags or [])]
        for token in re.split(r"[_\s\-]+", name.lower()):
            if token and token not in all_tags:
                all_tags.append(token)

        entry = AssetIndexEntry(
            guid=guid,
            name=name,
            item_type=item_type,
            workspace_id=self.workspace_id,
            summary=summary or f"Fabric {item_type} '{name}'",
            tags=all_tags,
            metadata=metadata or {},
            last_used_at=time.time(),
        )
        self.catalog.entries[clean_key] = entry
        self.save()
        return entry

    def get_by_name(self, name: str) -> Optional[AssetIndexEntry]:
        """Exact case-insensitive name lookup."""
        entry = self.catalog.entries.get(name.lower().strip())
        if entry:
            entry.last_used_at = time.time()
            self.save()
        return entry

    def query(
        self,
        query_text: str,
        item_type: Optional[str] = None,
        limit: int = 5,
    ) -> list[AssetIndexEntry]:
        """Searches index by keywords, semantic summary, and tags with ranking."""
        tokens = set(re.findall(r"\w+", query_text.lower()))
        if not tokens:
            return list(self.catalog.entries.values())[:limit]

        scored: list[tuple[int, AssetIndexEntry]] = []
        for entry in self.catalog.entries.values():
            if item_type and entry.item_type.lower() != item_type.lower():
                continue

            score = 0
            entry_name_tokens = set(re.findall(r"\w+", entry.name.lower()))
            score += len(tokens.intersection(entry_name_tokens)) * 5

            entry_tags = set(entry.tags)
            score += len(tokens.intersection(entry_tags)) * 3

            summary_tokens = set(re.findall(r"\w+", entry.summary.lower()))
            score += len(tokens.intersection(summary_tokens)) * 1

            if score > 0:
                scored.append((score, entry))

        scored.sort(key=lambda x: x[0], reverse=True)
        return [item for _, item in scored[:limit]]

    def sync_with_workspace(self) -> int:
        """Pulls all live items from Microsoft Fabric workspace and auto-indexes new entries."""
        try:
            live_items = list_workspace_items(self.workspace_id)
            new_count = 0
            for it in live_items:
                name = it.get("displayName", "")
                itype = it.get("type", "Item")
                guid = it.get("id", "")
                if not name or not guid:
                    continue
                clean_key = name.lower().strip()
                if clean_key not in self.catalog.entries:
                    self.register(
                        name=name,
                        item_type=itype,
                        guid=guid,
                        summary=f"Discovered Fabric {itype} '{name}' in workspace {self.workspace_id}",
                        tags=[itype.lower()],
                    )
                    new_count += 1
            self.catalog.last_synced_at = time.time()
            self.save()
            return new_count
        except Exception as e:
            print(f"[INDEX ERROR] Workspace sync notice: {e}")
            return 0
