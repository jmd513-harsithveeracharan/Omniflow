"""
Fabric AI Studio — Official Model Context Protocol (MCP) Server
Supports dual transport:
  1. Standard SSE Transport (GET /sse, POST /messages) for Copilot & Claude
  2. Direct JSON-RPC HTTP POST Transport (POST /, POST /mcp, POST /sse) for Google Gemini Custom Apps
"""
import os
import sys
import json
import uvicorn
from starlette.applications import Starlette
from starlette.responses import JSONResponse, Response
from starlette.routing import Route
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME
from app.fabric_client import list_workspace_items, create_item
from app.fabric_compiler import compile_lakehouse
from app.auth import get_auth_status
from mcp.server import MCPServer
from mcp.server.transport_security import TransportSecuritySettings

# ── 1. Tool Implementations ───────────────────────────────────────────────────

TOOLS_SPEC = [
    {
        "name": "get_fabric_status",
        "description": "Check Fabric AI Studio status, active workspace name, and Azure authentication state.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "list_workspace_items_summary",
        "description": "List all deployed Lakehouses, PySpark Notebooks, and Data Pipelines in the active Fabric workspace.",
        "inputSchema": {
            "type": "object",
            "properties": {},
            "required": []
        }
    },
    {
        "name": "create_lakehouse",
        "description": "Create a new Medallion Delta Lakehouse in Microsoft Fabric.",
        "inputSchema": {
            "type": "object",
            "properties": {
                "lakehouse_name": {"type": "string", "description": "Name of the lakehouse, e.g. lh_sales_bronze"},
                "layer": {"type": "string", "description": "Medallion layer: Bronze, Silver, or Gold", "default": "Bronze"}
            },
            "required": ["lakehouse_name"]
        }
    },
    {
        "name": "create_notebook",
        "description": "Create a new Python/PySpark Notebook with populated executable code in Microsoft Fabric (inside AI_Test_Folder).",
        "inputSchema": {
            "type": "object",
            "properties": {
                "notebook_name": {"type": "string", "description": "Name of the notebook, e.g. nb_bubble_sort"},
                "code": {"type": "string", "description": "Python / PySpark source code to put inside the notebook cells"},
                "description": {"type": "string", "description": "Description of the notebook"}
            },
            "required": ["notebook_name", "code"]
        }
    }
]


async def _execute_tool(name: str, args: dict) -> str:
    if name == "get_fabric_status":
        auth = get_auth_status()
        user = auth.get("user_identity", "Authenticated User")
        items_data = list_workspace_items(ALLOWED_WORKSPACE_ID)
        items_list = items_data.get("items", []) if isinstance(items_data, dict) else []
        return f"Fabric AI Studio is ONLINE. Active Workspace: {ALLOWED_WORKSPACE_NAME} ({len(items_list)} items). Authenticated User: {user}."

    elif name == "list_workspace_items_summary":
        items_data = list_workspace_items(ALLOWED_WORKSPACE_ID)
        items_list = items_data.get("items", []) if isinstance(items_data, dict) else []
        lakehouses = [it.get("displayName") for it in items_list if it.get("type") == "Lakehouse"]
        notebooks = [it.get("displayName") for it in items_list if it.get("type") == "Notebook"]
        pipelines = [it.get("displayName") for it in items_list if it.get("type") == "DataPipeline"]
        return f"Workspace '{ALLOWED_WORKSPACE_NAME}' Summary:\n- Lakehouses ({len(lakehouses)}): {', '.join(lakehouses[:10])}\n- Notebooks ({len(notebooks)}): {', '.join(notebooks[:10])}\n- Pipelines ({len(pipelines)}): {', '.join(pipelines[:10])}"

    elif name == "create_lakehouse":
        lakehouse_name = args.get("lakehouse_name", "lh_new")
        layer = args.get("layer", "Bronze")
        try:
            from app.fabric_client import get_or_create_folder
            folder_res = get_or_create_folder("AI_Test_Folder", ALLOWED_WORKSPACE_ID)
            folder_id = folder_res.get("id") if isinstance(folder_res, dict) else folder_res
            res = create_item(
                display_name=lakehouse_name,
                item_type="Lakehouse",
                workspace_id=ALLOWED_WORKSPACE_ID,
                folder_id=folder_id,
                description=f"Medallion {layer} Lakehouse provisioned in AI_Test_Folder"
            )
            if res.get("success"):
                item_id = res.get("item_id") or res.get("id")
                return f"Successfully created Lakehouse '{lakehouse_name}' ({layer} layer) inside 'AI_Test_Folder' (ID: {item_id}) in workspace '{ALLOWED_WORKSPACE_NAME}'."
            else:
                return f"Failed to create lakehouse: {res.get('error')}"
        except Exception as e:
            return f"Error creating lakehouse: {e}"

    elif name == "create_notebook":
        nb_name = args.get("notebook_name", "nb_notebook")
        code = args.get("code", "# Python code\nprint('Hello Fabric')\n")
        desc = args.get("description", "Notebook generated by Fabric AI Studio")
        try:
            from app.fabric_client import get_or_create_folder, update_definition
            from app.fabric_compiler import compile_notebook_update
            folder_res = get_or_create_folder("AI_Test_Folder", ALLOWED_WORKSPACE_ID)
            folder_id = folder_res.get("id") if isinstance(folder_res, dict) else folder_res

            # Step 1: Create Notebook item
            res = create_item(
                display_name=nb_name,
                item_type="Notebook",
                workspace_id=ALLOWED_WORKSPACE_ID,
                folder_id=folder_id,
                description=desc
            )
            if not res.get("success"):
                return f"Failed to create notebook item: {res.get('error')}"

            nb_id = res.get("item_id") or res.get("id")

            # Step 2: Populate Base64 definition
            update_parts = compile_notebook_update(pyspark_code=code, display_name=nb_name)
            up_success = update_definition(item_id=nb_id, parts=update_parts, workspace_id=ALLOWED_WORKSPACE_ID)

            if up_success:
                return f"Successfully created and populated Notebook '{nb_name}' with code inside 'AI_Test_Folder' (ID: {nb_id}) in workspace '{ALLOWED_WORKSPACE_NAME}'."
            else:
                return f"Created Notebook '{nb_name}' (ID: {nb_id}), but code upload failed."
        except Exception as e:
            return f"Error creating notebook: {e}"

    return f"Unknown tool: {name}"


# ── 2. Direct JSON-RPC Handler for Gemini Custom Apps ────────────────────────

async def handle_jsonrpc(request):
    try:
        body = await request.json()
    except Exception:
        body = {}

    req_id = body.get("id")
    method = body.get("method", "")
    params = body.get("params", {})

    print(f"[MCP JSON-RPC] Received method: '{method}' with id: {req_id}")

    if method == "initialize":
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "protocolVersion": "2024-11-05",
                "capabilities": {
                    "tools": {"listChanged": False}
                },
                "serverInfo": {
                    "name": "Fabric AI Studio",
                    "version": "1.0.0"
                }
            }
        })

    elif method == "notifications/initialized":
        return JSONResponse({"jsonrpc": "2.0", "result": {}})

    elif method == "ping":
        return JSONResponse({"jsonrpc": "2.0", "id": req_id, "result": {}})

    elif method == "tools/list":
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "tools": TOOLS_SPEC
            }
        })

    elif method == "tools/call":
        tool_name = params.get("name", "")
        tool_args = params.get("arguments", {})
        try:
            result_text = await _execute_tool(tool_name, tool_args)
        except Exception as e:
            result_text = f"Tool execution failed: {e}"
        return JSONResponse({
            "jsonrpc": "2.0",
            "id": req_id,
            "result": {
                "content": [
                    {
                        "type": "text",
                        "text": result_text
                    }
                ],
                "isError": False
            }
        })

    # Default fallback
    return JSONResponse({
        "jsonrpc": "2.0",
        "id": req_id,
        "result": {}
    })


async def handle_oauth_probe(request):
    """Answers OAuth probe to indicate server is unauthenticated or public."""
    return JSONResponse({
        "resource": "Fabric AI Studio MCP",
        "authorization_servers": [],
        "scopes_supported": []
    }, status_code=200)


async def handle_health(request):
    return JSONResponse({"status": "online", "server": "Fabric AI Studio MCP", "protocol": "mcp-2.0"}, status_code=200)


# ── 3. FastMCP SSE App Integration ────────────────────────────────────────────

mcp = MCPServer(
    name="Fabric AI Studio",
    version="1.0.0",
    instructions="Autonomous Medallion Architecture and PySpark engineering tools for Microsoft Fabric."
)

@mcp.tool(description="Check Fabric AI Studio status, active workspace name, and Azure authentication state.")
async def get_fabric_status() -> str:
    return await _execute_tool("get_fabric_status", {})

@mcp.tool(description="List all deployed Lakehouses, PySpark Notebooks, and Data Pipelines in the active Fabric workspace.")
async def list_workspace_items_summary() -> str:
    return await _execute_tool("list_workspace_items_summary", {})

@mcp.tool(description="Create a new Medallion Delta Lakehouse in Microsoft Fabric.")
async def create_lakehouse(lakehouse_name: str, layer: str = "Bronze") -> str:
    return await _execute_tool("create_lakehouse", {"lakehouse_name": lakehouse_name, "layer": layer})

@mcp.tool(description="Create a new Python/PySpark Notebook with populated executable code in Microsoft Fabric (inside AI_Test_Folder).")
async def create_notebook(notebook_name: str, code: str, description: str = "") -> str:
    return await _execute_tool("create_notebook", {"notebook_name": notebook_name, "code": code, "description": description})

security_settings = TransportSecuritySettings(enable_dns_rebinding_protection=False)
sse_subapp = mcp.sse_app(transport_security=security_settings)

# Build unified Starlette app
routes = [
    Route("/", handle_health, methods=["GET", "HEAD"]),
    Route("/", handle_jsonrpc, methods=["POST"]),
    Route("/mcp", handle_health, methods=["GET", "HEAD"]),
    Route("/mcp", handle_jsonrpc, methods=["POST"]),
    Route("/sse", handle_jsonrpc, methods=["POST"]),
    Route("/.well-known/oauth-protected-resource", handle_oauth_probe, methods=["GET", "HEAD"]),
    Route("/.well-known/oauth-protected-resource/{path:path}", handle_oauth_probe, methods=["GET", "HEAD"]),
]

middleware = [
    Middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
]

app = Starlette(routes=routes, middleware=middleware)
app.mount("/", sse_subapp)


if __name__ == "__main__":
    import socket

    is_stdio = "--stdio" in sys.argv or (not sys.stdin.isatty() and "--http" not in sys.argv)
    
    if is_stdio:
        # Running inside Antigravity IDE / Claude Desktop STDIO mode
        mcp.run(transport="stdio")
    else:
        # Running HTTP/SSE Server for Tunnel & Gemini Custom Apps
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.bind(("0.0.0.0", 8086))
            sock.close()
            print("======================================================")
            print("      Fabric AI Studio — Unified MCP Server (Port 8086)")
            print("======================================================")
            uvicorn.run(app, host="0.0.0.0", port=8086)
        except OSError:
            # If port 8086 is already running, run STDIO
            mcp.run(transport="stdio")
