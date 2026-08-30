import subprocess
import requests

def get_token():
    cmd = ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True, shell=True)
    return res.stdout.strip()

def move_all_to_folder():
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
    
    print("=== MOVING ALL SALES ITEMS TO SAP_Sales_Pipelines FOLDER ===")
    for it in sales_items:
        name = it.get("displayName")
        item_id = it.get("id")
        
        move_url = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items/{item_id}/move"
        res_move = requests.post(move_url, headers=headers, json={"targetFolderId": folder_id})
        print(f"MOVED [{it.get('type')}] '{name}' (ID: {item_id}) -> Status: {res_move.status_code}")

if __name__ == "__main__":
    move_all_to_folder()
