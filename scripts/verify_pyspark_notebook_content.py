import json
import base64
import subprocess
import requests

def get_token():
    cmd = ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True, shell=True)
    return res.stdout.strip()

def verify_notebooks():
    token = get_token()
    workspace_id = "db7344c1-ecd9-44d6-849f-f2de49484f9f"
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    url_items = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items"
    res_items = requests.get(url_items, headers=headers)
    items = res_items.json().get("value", [])
    
    notebooks = [it for it in items if it.get("type") == "Notebook" and any(k in it.get("displayName", "") for k in ["Ingest", "Transform", "Clean"])]
    print(f"Found {len(notebooks)} notebooks to verify:")
    
    for nb in notebooks:
        nb_id = nb.get("id")
        nb_name = nb.get("displayName")
        def_url = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items/{nb_id}/getDefinition"
        res_def = requests.post(def_url, headers=headers)
        print(f"\nNotebook '{nb_name}' (ID: {nb_id}) | getDefinition status: {res_def.status_code}")
        
        if res_def.status_code in [200, 202]:
            parts = res_def.json().get("definition", {}).get("parts", [])
            print(f"Total parts in definition: {len(parts)}")
            for p in parts:
                print(f" - Part Path: {p.get('path')}")
                if "notebook-content" in p.get('path', ''):
                    b64 = p.get("payload", "")
                    try:
                        decoded = base64.b64decode(b64).decode('utf-8')
                        print(f"   [DECODED CODE SNIPPET]:\n{decoded[:300]}")
                    except Exception as e:
                        print(f"   Decode Error: {e}")

if __name__ == "__main__":
    verify_notebooks()
