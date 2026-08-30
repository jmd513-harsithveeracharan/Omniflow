import subprocess
import requests

def get_token():
    cmd = ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True, shell=True)
    return res.stdout.strip()

def move_items_into_folder():
    token = get_token()
    workspace_id = "db7344c1-ecd9-44d6-849f-f2de49484f9f"
    folder_id = "5371837b-0ee5-4727-8d79-47b3d48959cc" # SAP_Sales_Pipelines folder
    
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    # 1. Get Workspace items
    list_url = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items"
    res = requests.get(list_url, headers=headers)
    items = res.json().get("value", [])

    target_names = ["Ingest_SAP_Orders", "Transform_Silver_Orders", "env_sap_analytics", "pl_sap_nightly_etl", "Clean_Sales_Data", "Daily_Sales_Pipeline"]
    
    for it in items:
        name = it.get("displayName")
        item_id = it.get("id")
        if name in target_names:
            move_url = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items/{item_id}/moveToFolder"
            payload = {"targetFolderId": folder_id}
            print(f"[MOVING ITEM] Moving '{name}' (ID: {item_id}) into Folder 'SAP_Sales_Pipelines'...")
            res_move = requests.post(move_url, headers=headers, json=payload)
            print(f" -> Response Code: {res_move.status_code}")

if __name__ == "__main__":
    move_items_into_folder()
