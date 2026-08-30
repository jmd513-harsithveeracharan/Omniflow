import os
import time
import json
import base64
import requests
import subprocess

def test_pipeline_update():
    cmd = ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"]
    token = subprocess.run(cmd, capture_output=True, text=True, shell=True).stdout.strip()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    ws_id = "db7344c1-ecd9-44d6-849f-f2de49484f9f"

    ts = int(time.time())
    name = f"Test_Pipeline_{ts}"
    res_create = requests.post(f"https://api.fabric.microsoft.com/v1/workspaces/{ws_id}/items", headers=headers, json={
        "displayName": name,
        "type": "DataPipeline",
        "description": "Testing pipeline activity definition"
    })
    print("Create pipeline status:", res_create.status_code)
    if res_create.status_code not in [200, 201]:
        print("Error creating pipeline:", res_create.text)
        return

    pl_id = res_create.json()["id"]
    print("Pipeline ID:", pl_id)

    pipeline_content = {
        "properties": {
            "activities": [
                {
                    "name": "Run_Ingestion_Notebook",
                    "type": "TridentNotebook",
                    "typeProperties": {
                        "notebookId": "97902c11-5a31-4f84-8e4a-eed9a8a41602",
                        "workspaceId": ws_id
                    }
                }
            ]
        }
    }

    platform_content = {
        "$schema": "https://developer.microsoft.com/json-schemas/fabric/gitIntegration/platformProperties/2.0.0/schema.json",
        "metadata": {
            "type": "DataPipeline",
            "displayName": name,
            "description": "Testing pipeline activity definition"
        },
        "config": {
            "version": "2.0",
            "logicalId": pl_id
        }
    }

    pl_json_str = json.dumps(pipeline_content, indent=2)
    plat_json_str = json.dumps(platform_content, indent=2)

    b64_pl = base64.b64encode(pl_json_str.encode("utf-8")).decode("utf-8")
    b64_plat = base64.b64encode(plat_json_str.encode("utf-8")).decode("utf-8")

    payload = {
        "definition": {
            "parts": [
                {"path": "pipeline-content.json", "payload": b64_pl, "payloadType": "InlineBase64"},
                {"path": ".platform", "payload": b64_plat, "payloadType": "InlineBase64"}
            ]
        }
    }
    update_url = f"https://api.fabric.microsoft.com/v1/workspaces/{ws_id}/items/{pl_id}/updateDefinition"
    res_up = requests.post(update_url, headers=headers, json=payload)
    print("Update status:", res_up.status_code)
    if res_up.status_code != 202:
        print("Pipeline update error:", res_up.text)
    else:
        op_loc = res_up.headers.get("Location")
        print("Polling LRO location:", op_loc)
        for i in range(15):
            time.sleep(2)
            poll = requests.get(op_loc, headers=headers)
            if poll.status_code == 200:
                print("LRO Pipeline Update Finished! Status:", poll.json().get("status"))
                break

if __name__ == "__main__":
    test_pipeline_update()
