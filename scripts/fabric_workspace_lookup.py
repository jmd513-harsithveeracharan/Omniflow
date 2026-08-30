import json
import subprocess
import requests

def get_fabric_token():
    """Retrieves access token using Azure CLI."""
    try:
        cmd = ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True, shell=True)
        return result.stdout.strip()
    except Exception as e:
        print(f"[ERROR] Failed to get Azure token: {e}")
        return None

def find_workspace_id(target_name="PBT_DATA_AGENT"):
    """
    Finds the exact workspace ID for the specified workspace name (PBT_DATA_AGENT).
    Locks the workspace ID into config.json for strict security isolation.
    """
    token = get_fabric_token()
    if not token:
        print("[ERROR] Cannot proceed without valid token. Run 'az login' first.")
        return None

    url = "https://api.fabric.microsoft.com/v1/workspaces"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }

    print(f"[SEARCH] Querying Microsoft Fabric Workspaces API for '{target_name}'...")
    response = requests.get(url, headers=headers)
    
    if response.status_code != 200:
        print(f"[ERROR] API call failed with status code {response.status_code}: {response.text}")
        return None

    data = response.json()
    workspaces = data.get("value", [])
    
    target_workspace = None
    for ws in workspaces:
        if ws.get("displayName", "").strip().upper() == target_name.upper():
            target_workspace = ws
            break

    if target_workspace:
        ws_id = target_workspace["id"]
        ws_name = target_workspace["displayName"]
        print(f"[FOUND] Workspace '{ws_name}' found! ID: {ws_id}")
        
        # Save to config.json with strict lock
        config_data = {
            "ALLOWED_WORKSPACE_NAME": ws_name,
            "ALLOWED_WORKSPACE_ID": ws_id,
            "ENFORCE_STRICT_ISOLATION": True
        }
        
        with open("config.json", "w", encoding="utf-8") as f:
            json.dump(config_data, f, indent=2)
            
        print("[CONFIG] Saved security lock to config.json successfully.")
        return ws_id
    else:
        print(f"[WARNING] Workspace '{target_name}' not found in accessible list.")
        print(f"Available Workspaces ({len(workspaces)} total):")
        for ws in workspaces[:10]:
            print(f"  - {ws.get('displayName')} (ID: {ws.get('id')})")
        return None

if __name__ == "__main__":
    find_workspace_id("PBT_DATA_AGENT")
