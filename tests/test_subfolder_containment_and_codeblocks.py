"""
tests/test_subfolder_containment_and_codeblocks.py
--------------------------------------------------
Validates:
1. Subfolder creation and nesting inside AI_Test_Folder
2. Heuristic DAG generation with numeric notebook counts and Synapse warehouse
3. End-to-end plan deployment folder hierarchy
"""

from unittest.mock import MagicMock, patch
import pytest

from app.config import ALLOWED_WORKSPACE_ID
from app.fabric_client import get_or_create_folder, get_workspace_tree
from app.deployment_executor import deploy_fabric_plan
from app.agent_pipeline import _heuristic_dag


def test_heuristic_dag_subfolder_and_items_extraction():
    prompt = "create 3 nb and lakehouse and warehouse with their respective folder like SalesPipeline"
    dag = _heuristic_dag(prompt)

    assert dag.folder == "SalesPipeline"
    step_names = [s.name for s in dag.steps]
    step_types = [s.type for s in dag.steps]

    # Root folder AI_Test_Folder and subfolder SalesPipeline
    assert "AI_Test_Folder" in step_names
    assert "AI_Test_Folder/SalesPipeline" in step_names
    assert "folder" in step_types
    assert "lakehouse" in step_types
    assert "warehouse" in step_types
    assert "notebook" in step_types

    # 3 PySpark notebooks generated
    notebook_steps = [s for s in dag.steps if s.type == "notebook"]
    assert len(notebook_steps) == 3

    # Synapse Warehouse generated
    warehouse_steps = [s for s in dag.steps if s.type == "warehouse"]
    assert len(warehouse_steps) >= 1
    assert "wh_salespipeline_analytics" in [w.name for w in warehouse_steps]


def test_get_or_create_folder_nests_under_ai_test_folder():
    with patch("app.fabric_client.list_folders", return_value=[]), \
         patch("app.fabric_client.requests.post") as mock_post:

        mock_resp = MagicMock()
        mock_resp.status_code = 201
        mock_resp.json.side_effect = [
            {"id": "root-ai-test-folder-id"},
            {"id": "sub-sales-pipeline-id"},
        ]
        mock_post.return_value = mock_resp

        # Calling with single custom folder should ensure AI_Test_Folder root first
        fid = get_or_create_folder("SalesPipeline", workspace_id=ALLOWED_WORKSPACE_ID)

        assert fid == "sub-sales-pipeline-id"
        assert mock_post.call_count == 2
        
        # First call creates AI_Test_Folder
        first_call_payload = mock_post.call_args_list[0][1]["json"]
        assert first_call_payload["displayName"] == "AI_Test_Folder"

        # Second call creates SalesPipeline with parentFolderId
        second_call_payload = mock_post.call_args_list[1][1]["json"]
        assert second_call_payload["displayName"] == "SalesPipeline"
        assert second_call_payload["parentFolderId"] == "root-ai-test-folder-id"


def test_deploy_fabric_plan_records_root_and_subfolder_steps():
    plan = {
        "run_id": "run_test_nested",
        "folder": "SalesPipeline",
        "lakehouses": ["lh_sales_bronze"],
        "warehouses": [{"name": "wh_sales_analytics"}],
        "notebooks": [{"name": "nb_sales_ingest", "pyspark_code": "print('ok')"}],
    }

    with patch("app.deployment_executor.get_or_create_folder") as mock_folder, \
         patch("app.deployment_executor.provision_item_with_definition") as mock_prov:

        mock_folder.side_effect = ["root-fld-id", "sub-fld-id"]
        mock_prov.return_value = {"success": True, "item_id": "item-123"}

        report = deploy_fabric_plan(plan, workspace_id=ALLOWED_WORKSPACE_ID)

        assert report.status == "completed"
        assert report.folder_name == "SalesPipeline"
        assert report.folder_id == "sub-fld-id"

        deployed_names = [i.name for i in report.deployed_items]
        assert "AI_Test_Folder" in deployed_names
        assert "AI_Test_Folder/SalesPipeline" in deployed_names
        assert "lh_sales_bronze" in deployed_names
        assert "wh_sales_analytics" in deployed_names
        assert "nb_sales_ingest" in deployed_names
