import subprocess
import requests

def get_token():
    cmd = ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True, shell=True)
    return res.stdout.strip()

def patch_item_folders():
    token = get_token()
    workspace_id = "db7344c1-ecd9-44d6-849f-f2de49484f9f"
    folder_id = "5371837b-0ee5-4727-8d79-47b3d48959cc" # SAP_Sales_Pipelines folder
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    url_items = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items"
    res_items = requests.get(url_items, headers=headers)
    all_items = res_items.json().get("value", [])
    
    target_names = ["Ingest_SAP_Orders", "Transform_Silver_Orders", "env_sap_analytics", "pl_sap_nightly_etl", "Clean_Sales_Data", "Daily_Sales_Pipeline"]
    sales_items = [it for it in all_items if it.get("displayName") in target_names]
    
    print("=== PATCHING FOLDER ASSIGNMENTS ===")
    for it in sales_items:
        name = it.get("displayName")
        item_id = it.get("id")
        
        # PATCH /v1/workspaces/{workspaceId}/items/{itemId} with folderId
        patch_url = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items/{item_id}"
        payload = {"folderId": folder_id}
        
        res_patch = requests.patch(patch_url, headers=headers, json=payload)
        print(f"PATCH [{it.get('type')}] '{name}' (ID: {item_id}) -> Folder ID {folder_id} | Status: {res_patch.status_code}")
        if res_patch.status_code not in [200, 204]:
            print(f"  Error: {res_patch.text}")

if __name__ == "__main__":
    patch_item_folders()
