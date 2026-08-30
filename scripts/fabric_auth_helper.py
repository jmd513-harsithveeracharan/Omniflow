import json
import subprocess
import requests

def get_token_via_azure_cli():
    """
    Easiest Method for Developers: Uses your active Azure CLI login ('az login').
    Requires Azure CLI installed on your machine.
    """
    try:
        cmd = ["az", "account", "get-access-token", "--resource", "https://api.fabric.microsoft.com", "--query", "accessToken", "-o", "tsv"]
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        token = result.stdout.strip()
        print("[AUTH] Successfully retrieved Access Token via Azure CLI!")
        return token
    except Exception as e:
        print(f"[AUTH ERROR] Could not get token via Azure CLI: {e}")
        print("Make sure you have run 'az login' in your terminal.")
        return None

def get_token_via_service_principal(tenant_id: str, client_id: str, client_secret: str):
    """
    Production Enterprise Method: Uses Azure AD Service Principal credentials.
    """
    url = f"https://login.microsoftonline.com/{tenant_id}/oauth2/v2.0/token"
    payload = {
        "grant_type": "client_credentials",
        "client_id": client_id,
        "client_secret": client_secret,
        "scope": "https://api.fabric.microsoft.com/.default"
    }
    headers = {"Content-Type": "application/x-www-form-request-urlencoded"}
    
    response = requests.post(url, data=payload, headers=headers)
    if response.status_code == 200:
        token = response.json().get("access_token")
        print("[AUTH] Successfully retrieved Access Token via Service Principal!")
        return token
    else:
        print(f"[AUTH ERROR] Failed to authenticate: {response.text}")
        return None

if __name__ == "__main__":
    print("=== Microsoft Fabric Authentication Helper ===\n")
    print("Option 1: Azure CLI (Instant for Local Dev)")
    print("Option 2: Service Principal (Tenant ID + Client ID + Secret)\n")
    
    # Try fetching via Azure CLI
    token = get_token_via_azure_cli()
    if token:
        print(f"\nToken Preview: {token[:25]}...{token[-15:]}")
