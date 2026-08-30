import json
import subprocess
import requests

def get_token():
    cmd = ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True, shell=True)
    return res.stdout.strip()

def check_workspace_items():
    token = get_token()
    workspace_id = "db7344c1-ecd9-44d6-849f-f2de49484f9f"
    url = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items"
    headers = {"Authorization": f"Bearer {token}"}
    
    res = requests.get(url, headers=headers)
    print(f"Status Code: {res.status_code}")
    items = res.json().get("value", [])
    print(f"Total Items in PBT_DATA_AGENT: {len(items)}\n")
    
    clean_sales_items = [it for it in items if "Clean_Sales" in it.get("displayName", "") or "Daily_Sales" in it.get("displayName", "")]
    print("Found Sales Items:")
    for it in clean_sales_items:
        print(f" - Name: {it.get('displayName')} | Type: {it.get('type')} | ID: {it.get('id')}")

if __name__ == "__main__":
    check_workspace_items()
