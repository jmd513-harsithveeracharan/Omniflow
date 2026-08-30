import subprocess
import requests

def get_token():
    cmd = ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True, shell=True)
    return res.stdout.strip()

def create_direct_notebook():
    token = get_token()
    workspace_id = "db7344c1-ecd9-44d6-849f-f2de49484f9f"
    url = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/items"
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    payload = {
        "displayName": "Clean_Sales_Data",
        "type": "Notebook",
        "description": "Clean Sales Data PySpark Notebook"
    }
    
    print(f"Creating Notebook 'Clean_Sales_Data' in workspace {workspace_id}...")
    res = requests.post(url, headers=headers, json=payload)
    print(f"Response Status Code: {res.status_code}")
    print(f"Response Body: {res.text}")

if __name__ == "__main__":
    create_direct_notebook()
