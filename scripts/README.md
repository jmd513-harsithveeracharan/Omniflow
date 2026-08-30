# scripts/README.md
# One-off and diagnostic scripts for Fabric AI Studio

These scripts were used during development and investigation of the Microsoft Fabric API.
They are **not part of the production server** — they are standalone diagnostic tools.

| Script | Purpose |
|:---|:---|
| `check_pbt_workspace_items.py` | Lists all items currently in the PBT_DATA_AGENT workspace |
| `deep_fabric_investigation.py` | Deep introspection of item types, folder structure, and API responses |
| `fabric_auth_helper.py` | Verifies Azure CLI authentication is working and token is valid |
| `fabric_workspace_lookup.py` | Looks up workspace ID by name — generates `config.json` |
| `manage_fabric_folders.py` | Creates, lists, and deletes Fabric workspace folders |
| `move_all_to_sap_folder.py` | Bulk move all SAP-related items into the SAP folder |
| `move_and_inspect_items.py` | Moves an item to a folder and inspects the response |
| `move_items_to_folder.py` | Utility to batch-move workspace items into a folder |
| `patch_item_folder.py` | Patches a single item's folder assignment |
| `poll_notebook_definition.py` | Polls the LRO location for a notebook `getDefinition` call |
| `test_fabric_item_creation.py` | Integration test: creates a Lakehouse and Notebook in Fabric |
| `test_fabric_move_api.py` | Integration test: verifies the `/move` API works |
| `test_live_fabric_deployment.py` | End-to-end integration test for a full deploy flow |
| `test_notebook_definition_update.py` | Tests `updateDefinition` on an existing Notebook |
| `test_notebook_direct.py` | Minimal notebook creation test |
| `test_pipeline_definition_update.py` | Tests `updateDefinition` on an existing Pipeline |
| `update_notebook_code.py` | Patches the PySpark code of an existing notebook by item ID |
| `verify_pyspark_notebook_content.py` | Downloads and decodes notebook content to verify Base64 payload |

## How to run

```powershell
# Activate your Python environment, then:
cd c:\Harsith_Work\Fabric_AI

# Example: verify auth is working
python scripts/fabric_auth_helper.py

# Example: find your workspace ID
python scripts/fabric_workspace_lookup.py
```

## Note on `fabric_workspace_lookup.py`

This script must be run once before starting the server for the first time.
It writes `config.json` with your `ALLOWED_WORKSPACE_ID`.
Alternatively, set `FABRIC_ALLOWED_WORKSPACE_ID` in your `.env` file directly.
