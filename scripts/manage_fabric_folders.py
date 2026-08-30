import json
import subprocess
import requests

def get_token():
    cmd = ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"]
    res = subprocess.run(cmd, capture_output=True, text=True, check=True, shell=True)
    return res.stdout.strip()

def list_and_create_folder(workspace_id: str, folder_name: str):
    token = get_token()
    headers = {
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json"
    }
    
    # 1. Check existing folders
    list_url = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/folders"
    res_list = requests.get(list_url, headers=headers)
    print(f"[FOLDERS LIST STATUS] {res_list.status_code}")
    
    folders = []
    if res_list.status_code == 200:
        folders = res_list.json().get("value", [])
        print(f"Total Folders in Workspace: {len(folders)}")
        for f in folders:
            print(f" - Folder: {f.get('displayName')} | ID: {f.get('id')}")

    target_folder = next((f for f in folders if f.get("displayName") == folder_name), None)
    
    if target_folder:
        print(f"[FOUND EXISTING FOLDER] '{folder_name}' ID: {target_folder['id']}")
        return target_folder['id']
    else:
        # 2. Create Folder
        create_url = f"https://api.fabric.microsoft.com/v1/workspaces/{workspace_id}/folders"
        payload = {"displayName": folder_name}
        print(f"[CREATING FOLDER] Creating folder '{folder_name}' in workspace {workspace_id}...")
        res_create = requests.post(create_url, headers=headers, json=payload)
        print(f"[CREATE FOLDER RESPONSE] Code: {res_create.status_code} | Body: {res_create.text}")
        
        if res_create.status_code in [200, 201]:
            folder_id = res_create.json().get("id")
            print(f"✅ Folder '{folder_name}' Created Live! Folder ID: {folder_id}")
            return folder_id
        return None

if __name__ == "__main__":
    WORKSPACE_ID = "db7344c1-ecd9-44d6-849f-f2de49484f9f"
    list_and_create_folder(WORKSPACE_ID, "SAP_Sales_Pipelines")
