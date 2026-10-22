"""
app/config.py
-------------
Single unified configuration loader for Fabric AI Studio.

Load order (highest priority wins):
  1. .env file (via python-dotenv) or OS environment variables
  2. config.json workspace lock file

All other modules import from here — never from os.getenv() directly.
"""

import json
import os

# Load .env if present — graceful fallback if python-dotenv not installed
try:
    from dotenv import load_dotenv
    load_dotenv(override=False)   # Don't override real env vars already set at OS level
except ImportError:
    pass  # python-dotenv not installed — fall back to OS environment variables only

# ── LLM API Keys ─────────────────────────────────────────────────────────────

GROQ_KEYS: list[str] = [
    k for k in [
        os.getenv("GROQ_API_KEY_1"),
        os.getenv("GROQ_API_KEY_2"),
    ]
    if k
]

ANTHROPIC_KEY: str | None = os.getenv("ANTHROPIC_API_KEY")
OPENAI_KEY: str | None    = os.getenv("OPENAI_API_KEY")
GEMINI_KEY: str | None    = os.getenv("GEMINI_API_KEY")

# 🔵 In-House Azure OpenAI / ChatGPT Enterprise Endpoint
AZURE_OPENAI_ENDPOINT: str | None = os.getenv("AZURE_AI_ENDPOINT") or os.getenv("AZURE_OPENAI_ENDPOINT")
AZURE_OPENAI_KEY: str | None      = os.getenv("AZURE_AI_KEY") or os.getenv("AZURE_OPENAI_KEY") or os.getenv("AZURE_OPENAI_API_KEY")
AZURE_OPENAI_DEPLOYMENT: str      = os.getenv("DEPLOYMENT_NAME") or os.getenv("AZURE_OPENAI_DEPLOYMENT", "omni-flow-gpt-6-luna")
AZURE_OPENAI_API_VERSION: str     = os.getenv("AZURE_OPENAI_API_VERSION", "2024-08-01-preview")

# 🟢 Claude Web Subscription Bridge (Native Claude Mix)
CLAUDE_ORG_UUID: str = os.getenv("CLAUDE_ORG_UUID", "37000f3f-9944-4b11-9e3e-d255456192da")
CLAUDE_DEVICE_ID: str = os.getenv("CLAUDE_DEVICE_ID", "c69be8b5-7e37-4b28-b7c5-72c51c218c1d")
CLAUDE_COOKIE: str | None = os.getenv("CLAUDE_COOKIE")
CLAUDE_MIX_MODE: str = os.getenv("CLAUDE_MIX_MODE", "complexity") # 'complexity' | 'opus' | 'sonnet' | 'haiku'


# ── Microsoft Fabric Workspace Lock ──────────────────────────────────────────

_CONFIG_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "config.json")

def _load_config_json() -> dict:
    if os.path.exists(_CONFIG_FILE):
        with open(_CONFIG_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {}

_cfg = _load_config_json()

# .env takes precedence over config.json
ALLOWED_WORKSPACE_ID: str = (
    os.getenv("FABRIC_ALLOWED_WORKSPACE_ID")
    or os.getenv("ALLOWED_WORKSPACE_ID")
    or os.getenv("FABRIC_WORKSPACE_ID")
    or os.getenv("WORKSPACE_ID")
    or _cfg.get("ALLOWED_WORKSPACE_ID", "")
)
ALLOWED_WORKSPACE_NAME: str = (
    os.getenv("FABRIC_ALLOWED_WORKSPACE_NAME")
    or os.getenv("ALLOWED_WORKSPACE_NAME")
    or os.getenv("FABRIC_WORKSPACE_NAME")
    or os.getenv("WORKSPACE_NAME")
    or _cfg.get("ALLOWED_WORKSPACE_NAME", "PBT_DATA_AGENT")
)

# Startup validation — fail early with a clear message
if not ALLOWED_WORKSPACE_ID:
    raise OSError(
        "CRITICAL: FABRIC_ALLOWED_WORKSPACE_ID is not set!\n"
        "Set it in .env or config.json before starting the server."
    )

# ── Azure Service Principal Auth (Optional) ──────────────────────────────────
AZURE_CLIENT_ID: str | None     = os.getenv("AZURE_CLIENT_ID")
AZURE_CLIENT_SECRET: str | None = os.getenv("AZURE_CLIENT_SECRET")
AZURE_TENANT_ID: str | None     = os.getenv("AZURE_TENANT_ID")
FABRIC_BEARER_TOKEN: str | None = os.getenv("FABRIC_BEARER_TOKEN") or os.getenv("AZURE_ACCESS_TOKEN")


def set_active_workspace(ws_id: str, ws_name: str):
    """Dynamically updates the active workspace and persists to config.json."""
    global ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME
    ALLOWED_WORKSPACE_ID = ws_id
    ALLOWED_WORKSPACE_NAME = ws_name
    try:
        cfg = _load_config_json()
        cfg["ALLOWED_WORKSPACE_ID"] = ws_id
        cfg["ALLOWED_WORKSPACE_NAME"] = ws_name
        with open(_CONFIG_FILE, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
    except Exception as e:
        print(f"[CONFIG] Failed to persist workspace to config.json: {e}")


def set_service_principal(tenant_id: str, client_id: str, client_secret: str):
    """Dynamically sets Service Principal credentials for Entra ID authentication."""
    global AZURE_TENANT_ID, AZURE_CLIENT_ID, AZURE_CLIENT_SECRET
    AZURE_TENANT_ID = tenant_id
    AZURE_CLIENT_ID = client_id
    AZURE_CLIENT_SECRET = client_secret


def set_bearer_token(token: str):
    """Dynamically sets a static Fabric Bearer Token."""
    global FABRIC_BEARER_TOKEN
    FABRIC_BEARER_TOKEN = token


# ── LLM Model Names (Verified Production IDs) ────────────────────────────────
# All IDs match current provider APIs with configurable overrides

LLM_MODELS = {
    # Groq — Only two active models (llama-3.3-70b-versatile is deprecated)
    "groq_high":       os.getenv("GROQ_HIGH_MODEL",  "openai/gpt-oss-120b"),  # 120B MoE — architecture, code gen, planning
    "groq_fast":       os.getenv("GROQ_FAST_MODEL",  "openai/gpt-oss-20b"),   # 20B — intent parsing, summarization, compression

    # Anthropic (Verified API Model Strings)
    "anthropic_high":  os.getenv("ANTHROPIC_HIGH_MODEL", "claude-3-7-sonnet-20250219"), # Claude 3.7 Sonnet
    "anthropic_fast":  os.getenv("ANTHROPIC_FAST_MODEL", "claude-3-5-haiku-20241022"),  # Claude 3.5 Haiku

    # OpenAI
    "openai_high":     os.getenv("OPENAI_HIGH_MODEL", "gpt-4o"),
    "openai_fast":     os.getenv("OPENAI_FAST_MODEL", "gpt-4o-mini"),

    # Google Gemini
    "gemini_standard": os.getenv("GEMINI_STANDARD_MODEL", "gemini-3.6-flash"),
    "gemini_high":     os.getenv("GEMINI_HIGH_MODEL", "gemini-2.5-pro"),
}

# ── Feature Flags ────────────────────────────────────────────────────────────

ENABLE_EXECUTION_MONITOR = True   # POST /api/pipeline/trigger
ENABLE_IMPACT_ANALYZER   = True   # Blast-radius check before mutations
