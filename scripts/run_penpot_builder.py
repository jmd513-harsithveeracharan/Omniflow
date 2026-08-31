import json
import requests
import sys

token = "eyJhbGciOiJBMjU2S1ciLCJlbmMiOiJBMjU2R0NNIn0.IvHYIVM7qTXb2XI7eMx3bijBoY4ivY4TNZHGAmKKUWuARNGtD915jw.MaQf5_2E21wzj0SB.6inLguRhu7qhBEwE4JRF3WB_DGbBIQsMYlDGbHfqgikQxd-jnZaIoirnYz03ZIQ7smiSBpwpC6yU4wNzThvw6THOVJsCyQnA7sgVgqI7e_x3APFQSg0kQe1BwdCEWFlnah_7OfPisiDmmS5bba5JRKgpWpr6IPpH4xeZyDRgt7peitwq9Jt7ZI_R6A3I6-WkWsxYxRZlbNmq.iM8VMFxEze3cYASCF-c52Q"
url = f"http://localhost:9001/mcp/stream?userToken={token}"

headers = {
    "Accept": "text/event-stream, application/json",
    "Content-Type": "application/json"
}

# 1. Initialize
init_resp = requests.post(url, json={
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {"name": "FabricAIClient", "version": "1.0.0"}
    }
}, headers=headers, timeout=5)

session_id = init_resp.headers.get("mcp-session-id")
print("[MCP] Session Initialized:", session_id)

from generate_penpot_design_suite import PENPOT_JS_CODE

print("[MCP] Transmitting 4-Board Master UI Suite to Penpot Canvas...")
call_resp = requests.post(url, json={
    "jsonrpc": "2.0",
    "id": 10,
    "method": "tools/call",
    "params": {
        "name": "execute_code",
        "arguments": {
            "code": PENPOT_JS_CODE
        }
    }
}, headers={**headers, "mcp-session-id": session_id} if session_id else headers, timeout=60)

print("[MCP] Tool Call Status:", call_resp.status_code)
print("[MCP] Tool Response:", call_resp.text)
