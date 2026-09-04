"""
connectors/connector_registry.py
---------------------------------
Auto-discovering connector registry for Fabric AI Studio.

Instead of maintaining a hardcoded list of imports, this module scans
the connectors/ directory and loads all concrete BaseConnector subclasses
automatically. Adding a new connector requires only:
  1. Create connectors/my_new_connector.py
  2. Define a class inheriting from BaseConnector
  No changes to this file required.
"""

import os
import importlib
import inspect

from connectors.base_connector import BaseConnector

_REGISTRY: dict[str, BaseConnector] = {}
_CONNECTORS_DIR = os.path.dirname(__file__)


def _load_all_connectors():
    """
    Scans the connectors/ directory for Python files and imports any
    class that inherits from BaseConnector and has a non-empty source_id.
    """
    for filename in sorted(os.listdir(_CONNECTORS_DIR)):
        if not filename.endswith(".py"):
            continue
        if filename.startswith("_") or filename in ("base_connector.py", "connector_registry.py"):
            continue

        module_name = f"connectors.{filename[:-3]}"
        try:
            module = importlib.import_module(module_name)
        except Exception as e:
            print(f"[REGISTRY] Failed to import {module_name}: {e}")
            continue

        for _, cls in inspect.getmembers(module, inspect.isclass):
            if (
                issubclass(cls, BaseConnector)
                and cls is not BaseConnector
                and getattr(cls, "source_id", None)
            ):
                try:
                    instance = cls()
                    _REGISTRY[instance.source_id] = instance
                    stub_tag = " [STUB]" if getattr(instance, "is_stub", False) else ""
                    print(f"[REGISTRY] Loaded connector: {instance.source_id}{stub_tag}")
                except Exception as e:
                    print(f"[REGISTRY] Failed to instantiate {cls.__name__}: {e}")

    # Load custom user-defined connectors from disk
    try:
        from connectors.jit_connector_factory import ARCHETYPE_TEMPLATES, DynamicJITConnector, load_custom_connectors

        custom_map = load_custom_connectors()
        for sid, cdef in custom_map.items():
            _REGISTRY[sid] = DynamicJITConnector(sid, cdef)
            print(f"[REGISTRY] Loaded custom connector: {sid} ({cdef.get('name')})")

        # Also load standard enterprise archetypes (Postgres, Snowflake, Oracle, S3, etc.)
        for sid, template in ARCHETYPE_TEMPLATES.items():
            if sid not in _REGISTRY:
                _REGISTRY[sid] = DynamicJITConnector(sid, template)
                print(f"[REGISTRY] Loaded archetype connector: {sid} ({template.get('name')})")
    except Exception as e:
        print(f"[REGISTRY] Could not load custom connectors: {e}")


# Load connectors on module import
_load_all_connectors()


def get_connector(source_id: str) -> BaseConnector:
    """
    Returns the connector instance for the given source_id.
    If not already registered, dynamically synthesizes a JIT connector on-the-fly.
    """
    if source_id not in _REGISTRY:
        try:
            from connectors.jit_connector_factory import synthesize_connector
            jit_instance = synthesize_connector(source_id)
            _REGISTRY[source_id] = jit_instance
            print(f"[REGISTRY] Dynamically synthesized JIT connector: {source_id} ({jit_instance.name})")
            return jit_instance
        except Exception as e:
            available = list(_REGISTRY.keys())
            raise KeyError(
                f"Could not synthesize connector '{source_id}'. Error: {e}. "
                f"Available connectors: {available}"
            )
    return _REGISTRY[source_id]


def list_connectors() -> list[dict]:
    """
    Returns connector metadata for all registered connectors.
    Used by the /api/connectors endpoint.
    """
    result = []
    for source_id, connector in _REGISTRY.items():
        info = connector.to_info_dict()
        info["is_stub"] = getattr(connector, "is_stub", False)
        result.append(info)
    return result


def reload_connectors():
    """Force re-discovery of all connectors (useful during development)."""
    global _REGISTRY
    _REGISTRY.clear()
    _load_all_connectors()
