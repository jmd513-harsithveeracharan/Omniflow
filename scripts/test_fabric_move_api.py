import subprocess
import requests

def get_token():
    cmd = ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True, shell=True)
    return res.stdout.strip()

def test_fabric_move():
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
    
    target_names = ["Ingest_SAP_Orders", "Transform_Silver_Orders", "Clean_Sales_Data"]
    sales_items = [it for it in all_items if it.get("displayName") in target_names]
    
    for it in sales_items:
        name = it.get("displayName")
        item_id = it.get("id")
        
        # Test 1: POST /v1/workspaces/{workspaceId}/items/{itemId}/move
        url1 = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items/{item_id}/move"
        res1 = requests.post(url1, headers=headers, json={"targetFolderId": folder_id})
        print(f"URL1 (move) [{name}]: Code {res1.status_code} | Body: {res1.text}")
        
        # Test 2: POST /v1/workspaces/{workspaceId}/folders/{folderId}/items
        url2 = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/folders/{folder_id}/items"
        res2 = requests.post(url2, headers=headers, json={"itemId": item_id})
        print(f"URL2 (folder/items) [{name}]: Code {res2.status_code} | Body: {res2.text}")

if __name__ == "__main__":
    test_fabric_move()
