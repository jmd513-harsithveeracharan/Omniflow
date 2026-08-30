import json
import base64
import subprocess
import requests

def get_token():
    cmd = ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True, shell=True)
    return res.stdout.strip()

def deep_investigation():
    token = get_token()
    workspace_id = "db7344c1-ecd9-44d6-849f-f2de49484f9f"
    folder_id = "5371837b-0ee5-4727-8d79-47b3d48959cc" # SAP_Sales_Pipelines
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # 1. Fetch all items in Workspace
    url_items = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items"
    res_items = requests.get(url_items, headers=headers)
    all_items = res_items.json().get("value", [])
    
    print("=== DEEP WORKSPACE INVESTIGATION REPORT ===")
    print(f"Total Workspace Items: {len(all_items)}")

    # Filter target sales items
    target_names = ["Ingest_SAP_Orders", "Transform_Silver_Orders", "env_sap_analytics", "pl_sap_nightly_etl", "Clean_Sales_Data", "Daily_Sales_Pipeline", "pl_daily_sales_pipeline"]
    
    sales_items = [it for it in all_items if it.get("displayName") in target_names]
    
    print(f"\nTarget Sales Items Found ({len(sales_items)} total):")
    for it in sales_items:
        name = it.get("displayName")
        itype = it.get("type")
        item_id = it.get("id")
        f_id = it.get("folderId", "ROOT (No Folder)")
        in_sap_folder = (f_id == folder_id)
        print(f" - [{itype}] {name}")
        print(f"   ID: {item_id}")
        print(f"   Folder ID: {f_id} | In SAP_Sales_Pipelines Folder: {in_sap_folder}\n")

    # 2. Inspect Notebook Code definitions
    print("=== INSPECTING NOTEBOOK SOURCE CODE ===")
    notebooks_to_inspect = [it for it in sales_items if it.get("type") == "Notebook"]
    
    for nb in notebooks_to_inspect:
        nb_id = nb.get("id")
        nb_name = nb.get("displayName")
        print(f"\n--- Notebook: {nb_name} (ID: {nb_id}) ---")
        
        def_url = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items/{nb_id}/getDefinition"
        res_def = requests.post(def_url, headers=headers)
        
        if res_def.status_code in [200, 202]:
            def_parts = res_def.json().get("definition", {}).get("parts", [])
            for p in def_parts:
                path = p.get("path")
                if "notebook-content" in path:
                    b64_payload = p.get("payload", "")
                    try:
                        decoded_code = base64.b64decode(b64_payload).decode('utf-8')
                        print(f"Source File ({path}):\n{decoded_code[:400]}")
                    except Exception as e:
                        print(f"Base64 Decode Error: {e}")
        else:
            print(f"getDefinition API returned status {res_def.status_code}: {res_def.text}")

if __name__ == "__main__":
    deep_investigation()
