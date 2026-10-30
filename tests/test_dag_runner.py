"""
tests/test_dag_runner.py
-------------------------
Unit and integration tests for Generic DAG Wave Runner & Optimistic 2-Pass Provisioning.
"""

import json
from unittest.mock import MagicMock, patch

import pytest
from omniflow.tools.dag_runner import (
    FabricItemSpec,
    GenericDAGProvisioner,
    _build_minimal_shell_payload,
    compile_definition_payload,
    interpolate_placeholders,
)


def test_plan_dag_waves_heterogeneous_items():
    """Verifies arbitrary Fabric items (Lakehouse, Notebook, Pipeline, Eventstream, DataActivator)
    are ordered into correct topological waves without hardcoding.
    """
    items = [
        FabricItemSpec(name="lh_bronze", item_type="Lakehouse", depends_on=[]),
        FabricItemSpec(name="wh_gold", item_type="Warehouse", depends_on=[]),
        FabricItemSpec(name="es_iot_telemetry", item_type="Eventstream", depends_on=[]),
        FabricItemSpec(name="nb_transform", item_type="Notebook", depends_on=["lh_bronze"]),
        FabricItemSpec(name="pl_master_ingest", item_type="DataPipeline", depends_on=["lh_bronze", "nb_transform"]),
        FabricItemSpec(name="da_reflex_alerts", item_type="DataActivator", depends_on=["es_iot_telemetry"]),
    ]

    provisioner = GenericDAGProvisioner(workspace_id="test-ws-123")
    is_acyclic, waves = provisioner.plan_dag_waves(items)

    assert is_acyclic is True
    # Wave 0 must contain roots with no dependencies
    assert set(waves[0]) == {"lh_bronze", "wh_gold", "es_iot_telemetry"}
    # Wave 1 must contain items whose dependencies were in Wave 0
    assert set(waves[1]) == {"nb_transform", "da_reflex_alerts"}
    # Wave 2 must contain the pipeline which depends on nb_transform
    assert waves[2] == ["pl_master_ingest"]


def test_cycle_detection():
    """Verifies cycles are caught gracefully without crashing."""
    cyclic_items = [
        FabricItemSpec(name="item_a", item_type="Notebook", depends_on=["item_b"]),
        FabricItemSpec(name="item_b", item_type="DataPipeline", depends_on=["item_a"]),
    ]
    provisioner = GenericDAGProvisioner(workspace_id="test-ws-123")
    is_acyclic, waves = provisioner.plan_dag_waves(cyclic_items)
    assert is_acyclic is False
    assert waves == []

    res = provisioner.execute_optimistic_provisioning(cyclic_items)
    assert res.status == "CYCLE_DETECTED_ERROR"
    assert res.is_acyclic is False


def test_interpolate_placeholders():
    """Verifies semantic GUID placeholder replacement."""
    registry = {
        "lh_bronze": "guid-lh-1111",
        "nb_cleanse": "guid-nb-2222",
        "wh_analytics": "guid-wh-3333",
    }
    raw_template = '{"lakehouseId": "{{lh_bronze.id}}", "notebook": "{{nb_cleanse.id}}", "target": "{{wh_analytics}}"}'
    interpolated = interpolate_placeholders(raw_template, registry)

    assert '"lakehouseId": "guid-lh-1111"' in interpolated
    assert '"notebook": "guid-nb-2222"' in interpolated
    assert '"target": "guid-wh-3333"' in interpolated


def test_build_minimal_shell_payload():
    """Verifies shells return None for instant serverless Fabric creation and compile_definition_payload works."""
    pl_shell = _build_minimal_shell_payload("DataPipeline", "pl_test")
    assert pl_shell is None

    # Test compilation for Pass 2 definition hydration
    compiled = compile_definition_payload("DataPipeline", '{"activities": []}', "pl_test")
    assert "parts" in compiled
    assert compiled["parts"][0]["path"] == "pipeline-content.json"
    import base64
    assert base64.b64decode(compiled["parts"][0]["payload"]).decode("utf-8") == '{"activities": []}'


def test_optimistic_two_pass_provisioning_flow():
    """Verifies Pass 1 parallel shell creation + Pass 2 definition hydration."""
    items = [
        FabricItemSpec(
            name="lh_bronze",
            item_type="Lakehouse",
            depends_on=[],
        ),
        FabricItemSpec(
            name="pl_ingest",
            item_type="DataPipeline",
            depends_on=["lh_bronze"],
            definition_template='{"activities": [{"name": "Copy", "sink": "{{lh_bronze.id}}"}]}',
        ),
    ]

    with patch("omniflow.tools.dag_runner.create_item") as mock_create, \
         patch("omniflow.tools.dag_runner.update_definition") as mock_update:

        # Mock Pass 1 shell creation responses
        def side_create(display_name, item_type, **kwargs):
            return {
                "success": True,
                "item_id": f"guid-{display_name}",
                "display_name": display_name,
                "item_type": item_type,
                "already_existed": False,
            }

        mock_create.side_effect = side_create
        mock_update.return_value = {"success": True, "item_id": "guid-pl_ingest"}

        provisioner = GenericDAGProvisioner(workspace_id="ws-test-456")
        res = provisioner.execute_optimistic_provisioning(items, enable_two_pass=True)

        assert res.status == "SUCCESS"
        assert res.total_items == 2
        assert res.guid_registry["lh_bronze"] == "guid-lh_bronze"
        assert res.guid_registry["pl_ingest"] == "guid-pl_ingest"

        # Check item statuses
        assert res.items["lh_bronze"].pass1_status == "MINTED"
        assert res.items["lh_bronze"].pass2_status == "NOT_REQUIRED"

        assert res.items["pl_ingest"].pass1_status == "MINTED"
        assert res.items["pl_ingest"].pass2_status == "HYDRATED"

        # Verify update_definition was called with the interpolated GUID
        mock_update.assert_called_once()
        call_args = mock_update.call_args
        assert call_args[0][1] == "guid-pl_ingest"
        compiled_def = call_args[0][2]
        payload_b64 = compiled_def["parts"][0]["payload"]
        import base64
        decoded_payload = base64.b64decode(payload_b64).decode("utf-8")
        assert "guid-lh_bronze" in decoded_payload
