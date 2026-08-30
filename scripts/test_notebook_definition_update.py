import os
import time
import json
import base64
import requests
import subprocess

def test_notebook_update():
    cmd = ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"]
    token = subprocess.run(cmd, capture_output=True, text=True, shell=True).stdout.strip()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    ws_id = "db7344c1-ecd9-44d6-849f-f2de49484f9f"

    # Create notebook
    res_create = requests.post(f"https://api.fabric.microsoft.com/v1/workspaces/{ws_id}/items", headers=headers, json={
        "displayName": "Test_Notebook_Code_Populated",
        "type": "Notebook",
        "description": "Populated PySpark cells test"
    })
    print("Create notebook status:", res_create.status_code)
    if res_create.status_code not in [200, 201]:
        print("Error creating notebook:", res_create.text)
        return

    nb_id = res_create.json()["id"]
    print("Notebook ID:", nb_id)

    py_code = """from pyspark.sql.functions import current_timestamp, col
print("Hello from Fabric AI Studio!")
df = spark.createDataFrame([(1, "orders"), (2, "customers")], ["id", "type"])
df = df.withColumn("_created_at", current_timestamp())
display(df)"""

    nb_content = f"""# Fabric notebook source

# METADATA ********************

# META {{
# META   "kernel_info": {{
# META     "name": "synapse_pyspark"
# META   }},
# META   "dependencies": {{}}
# META }}

# CELL ********************

{py_code}

# METADATA ********************

# META {{
# META   "language": "python",
# META   "language_group": "synapse_pyspark"
# META }}
"""
    b64 = base64.b64encode(nb_content.encode("utf-8")).decode("utf-8")
    payload = {
        "definition": {
            "parts": [
                {"path": "notebook-content.py", "payload": b64, "payloadType": "InlineBase64"}
            ]
        }
    }
    update_url = f"https://api.fabric.microsoft.com/v1/workspaces/{ws_id}/items/{nb_id}/updateDefinition"
    res_up = requests.post(update_url, headers=headers, json=payload)
    print("Update status:", res_up.status_code)
    if res_up.status_code == 202:
        op_loc = res_up.headers.get("Location")
        print("Polling LRO location:", op_loc)
        for i in range(15):
            time.sleep(2)
            poll = requests.get(op_loc, headers=headers)
            if poll.status_code == 200:
                print("LRO Operation Finished! Status:", poll.json().get("status"))
                break

if __name__ == "__main__":
    test_notebook_update()
