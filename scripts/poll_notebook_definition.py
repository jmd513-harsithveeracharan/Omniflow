import time
import json
import base64
import subprocess
import requests

def get_token():
    cmd = ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True, shell=True)
    return res.stdout.strip()

def poll_definition(workspace_id: str, item_id: str, item_name: str):
    token = get_token()
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    
    url = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items/{item_id}/getDefinition"
    res = requests.post(url, headers=headers)
    print(f"\n--- Notebook '{item_name}' (ID: {item_id}) ---")
    print(f"POST getDefinition status: {res.status_code}")
    
    if res.status_code == 200:
        parts = res.json().get("definition", {}).get("parts", [])
        for p in parts:
            if "notebook-content" in p.get("path", ""):
                b64 = p.get("payload", "")
                print(f"[PYSPARK CODE IN FABRIC]:\n{base64.b64decode(b64).decode('utf-8')[:400]}")
    elif res.status_code == 202:
        loc = res.headers.get("Location") or res.headers.get("Operation-Location")
        retry_after = int(res.headers.get("Retry-After", 3))
        print(f"Polling location: {loc} (waiting {retry_after}s)...")
        time.sleep(retry_after)
        
        res_result = requests.get(loc, headers=headers)
        print(f"Result Status: {res_result.status_code}")
        if res_result.status_code == 200:
            parts = res_result.json().get("definition", {}).get("parts", [])
            for p in parts:
                if "notebook-content" in p.get("path", ""):
                    b64 = p.get("payload", "")
                    print(f"✅ [VERIFIED PYSPARK CODE IN FABRIC]:\n{base64.b64decode(b64).decode('utf-8')[:400]}")
        else:
            print(f"Result Body: {res_result.text}")

if __name__ == "__main__":
    WORKSPACE_ID = "db7344c1-ecd9-44d6-849f-f2de49484f9f"
    poll_definition(WORKSPACE_ID, "26278688-aaac-47fe-b17a-507ec0c76ae1", "Clean_Sales_Data")
    poll_definition(WORKSPACE_ID, "b6213c9d-333c-41dc-8a48-247e0724ed51", "Ingest_SAP_Orders")
