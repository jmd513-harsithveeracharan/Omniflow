"""
app/providers/claude.py
-----------------------
Official Claude Code CLI subprocess handler and browser session integration.
"""

import json
import os
import shutil
import subprocess
from app.config import (
    CLAUDE_COOKIE,
    CLAUDE_DEVICE_ID,
    CLAUDE_ORG_UUID,
)
from app.providers.session import _SESSION


def _get_claude_cli_binary() -> str | None:
    """Finds the Claude Code CLI executable path on the system, preferring native binary."""
    direct_exe = r"C:\Users\BheesettiHarsithVeer\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe"
    if os.path.exists(direct_exe):
        return direct_exe
    found = shutil.which("claude")
    if found:
        return found
    fallback_win = r"C:\Users\BheesettiHarsithVeer\AppData\Roaming\npm\claude.cmd"
    if os.path.exists(fallback_win):
        return fallback_win
    return None


def _call_claude_cli(
    messages: list,
    model: str = None,
    max_tokens: int = 8192,
    session_id: str = None,
    resume: bool = False,
) -> str:
    """
    Call official Claude Code CLI subprocess (claude -p) using user's active terminal authentication.
    Supports native session resumption via --resume <session_id> and --session-id <session_id>.
    """
    claude_bin = _get_claude_cli_binary()
    if not claude_bin:
        raise RuntimeError("Claude Code CLI is not installed or not found in PATH.")

    valid_uuid_session = None
    if session_id:
        try:
            import uuid
            valid_uuid_session = str(uuid.UUID(session_id))
        except Exception:
            import uuid
            valid_uuid_session = str(uuid.uuid5(uuid.NAMESPACE_DNS, session_id))

    # Sanitize model parameter for Claude Code CLI
    effective_model = model
    if effective_model:
        em_lower = effective_model.lower().strip()
        if em_lower in ("claude-mix", "claude_mix", "mix", "default", "auto") or "haiku" in em_lower:
            effective_model = None
        elif "sonnet" in em_lower:
            effective_model = "claude-3-7-sonnet"
        elif "opus" in em_lower:
            effective_model = "claude-3-opus-20240229"

    target_m = effective_model or model
    if valid_uuid_session and resume:
        latest_user_msgs = [m.get("content", "") for m in messages if m.get("role") == "user"]
        latest_turn = latest_user_msgs[-1] if latest_user_msgs else "Continue"
        cmd = [claude_bin, "-p", latest_turn, "--resume", valid_uuid_session, "--tools", ""]
        if target_m:
            cmd.extend(["--model", target_m])
    else:
        system_prompts = [m["content"] for m in messages if m.get("role") == "system"]
        conversation_turns = [m for m in messages if m.get("role") != "system"]

        sys_text = "\n\n".join(system_prompts).strip() if system_prompts else ""

        formatted_parts = []
        if sys_text:
            formatted_parts.append(sys_text)

        if conversation_turns:
            if len(conversation_turns) == 1 and conversation_turns[0].get("role") == "user":
                formatted_parts.append(f"USER REQUEST:\n{conversation_turns[0].get('content', '')}")
            else:
                for m in conversation_turns:
                    role = m.get("role", "user").upper()
                    formatted_parts.append(f"[{role}]:\n{m.get('content', '')}")

        full_prompt = "\n\n---\n\n".join(formatted_parts) if formatted_parts else "Hello"
        import uuid as _uuid
        cmd = [claude_bin, "-p", full_prompt, "--tools", "", "--session-id", str(_uuid.uuid4())]
        if target_m:
            cmd.extend(["--model", target_m])

    try:
        import tempfile
        res = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            stdin=subprocess.DEVNULL,
            encoding="utf-8",
            cwd=tempfile.gettempdir(),
            timeout=120,
        )
        if res.returncode == 0:
            out = res.stdout.strip()
            if "Warning:" in out:
                lines = out.split("\n")
                out = "\n".join([l for l in lines if not l.startswith("Warning:")]).strip()
            if out:
                return out
            raise RuntimeError("Claude Code CLI returned an empty response.")
        else:
            err_msg = res.stderr.strip() or res.stdout.strip() or f"Exited with code {res.returncode}"
            raise RuntimeError(f"Claude Code CLI error: {err_msg}")
    except subprocess.TimeoutExpired:
        raise RuntimeError("Claude Code CLI timed out after 120 seconds.")
    except Exception as e:
        raise RuntimeError(f"Claude Code CLI invocation failed: {e}")


def _call_claude_session(messages: list, model: str = "claude-opus-5", max_tokens: int = 8192) -> str:
    """Call Claude Web Session using user's active browser subscription cookies with real-time SSE parsing."""
    if not CLAUDE_COOKIE:
        raise RuntimeError("CLAUDE_COOKIE is not configured in .env.")

    import uuid
    full_prompt = "\n\n".join([f"{m['role'].upper()}: {m['content']}" for m in messages])
    chat_uuid = str(uuid.uuid4())

    headers = {
        'Cookie': CLAUDE_COOKIE,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/151.0.0.0 Safari/537.36 Edg/151.0.0.0',
        'Content-Type': 'application/json',
        'Accept': 'text/event-stream, text/plain, */*',
        'Origin': 'https://claude.ai',
        'Referer': 'https://claude.ai/new',
        'anthropic-client-platform': 'web_claude_ai',
        'anthropic-device-id': CLAUDE_DEVICE_ID,
        'Sec-Fetch-Site': 'same-origin',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Dest': 'empty',
    }

    try:
        _SESSION.post(
            f"https://claude.ai/api/organizations/{CLAUDE_ORG_UUID}/chat_conversations",
            headers=headers,
            json={"uuid": chat_uuid, "name": "Fabric AI Studio Request"},
            timeout=15,
        )
    except Exception as e:
        raise RuntimeError(f"Claude Web Session initialization error: {e}")

    resp = _SESSION.post(
        f"https://claude.ai/api/organizations/{CLAUDE_ORG_UUID}/chat_conversations/{chat_uuid}/completion",
        headers=headers,
        json={
            "prompt": full_prompt,
            "timezone": "Asia/Calcutta",
            "locale": "en-US",
            "model": model,
            "attachments": [],
            "files": [],
        },
        stream=True,
        timeout=90,
    )

    full_text = []
    for line in resp.iter_lines():
        if line:
            decoded = line.decode('utf-8')
            if decoded.startswith('data: '):
                try:
                    payload = json.loads(decoded[6:])
                    if 'completion' in payload:
                        full_text.append(payload['completion'])
                except Exception:
                    pass

    output = "".join(full_text)
    if not output:
        raise RuntimeError("Claude Web Session returned empty response.")
    return output


def _resolve_claude_mix_model(prompt_text: str) -> str:
    """Dynamically select Claude model based on complexity and prompt analysis."""
    is_heavy = len(prompt_text) > 450 or any(k in prompt_text.lower() for k in ["pyspark", "transpile", "stored procedure", "merge sort", "self-healing", "lakehouse", "lineage", "refactor"])
    is_light = len(prompt_text) < 90 or any(k in prompt_text.lower() for k in ["summarize", "in 1 sentence", "what is", "classify", "intent"])

    if is_heavy:
        return "claude-opus-5"
    elif is_light:
        return "claude-3-5-haiku-20241022"
    else:
        return "claude-3-5-sonnet-20241022"

