"""
omniflow/agents/claude_cli.py
----------------------------
Official Claude Code CLI subprocess bridge with native session resumption.
Executes prompts via `claude -p` using the user's active CLI login (zero API keys required).
Supports session resumption via `--session-id <uuid>` and `--resume <uuid>`.
"""
from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
import tempfile
import uuid
from typing import Any


def _strip_ansi_codes(text: str) -> str:
    """Removes terminal ANSI color and formatting escape sequences."""
    ansi_regex = re.compile(r"\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])")
    return ansi_regex.sub("", text)


def get_claude_cli_executable() -> str | None:
    """Finds the Claude Code CLI binary on Windows/Linux, preferring claude.cmd to avoid
    the pip-installed anthropic package CLI.
    """
    if sys.platform == "win32":
        direct_exe = r"C:\Users\BheesettiHarsithVeer\AppData\Roaming\npm\claude.cmd"
        if os.path.exists(direct_exe):
            return direct_exe
        direct_native = r"C:\Users\BheesettiHarsithVeer\AppData\Roaming\npm\node_modules\@anthropic-ai\claude-code\bin\claude.exe"
        if os.path.exists(direct_native):
            return direct_native
        found = shutil.which("claude.cmd") or shutil.which("claude")
        if found:
            return found
    else:
        found = shutil.which("claude")
        if found:
            return found
    return None


class ClaudeCLISession:
    """Subprocess client for Claude Code CLI with durable session resumption."""

    def __init__(self, default_model: str = "claude-3-5-sonnet") -> None:
        self.default_model = default_model
        self.cli_exe = get_claude_cli_executable()

    def is_available(self) -> bool:
        return self.cli_exe is not None and os.path.exists(self.cli_exe)

    def invoke(
        self,
        prompt: str,
        session_id: str | None = None,
        resume: bool = False,
        model: str | None = None,
        timeout_seconds: int = 120,
    ) -> dict[str, Any]:
        """Invokes Claude Code CLI via subprocess.
        
        Uses:
          - `claude -p` with input via stdin to prevent Windows 32KB command line limits.
          - `--session-id <uuid>` on initial turn to establish durable context.
          - `--resume <uuid>` on subsequent turns to retain full agent memory across the session.
        """
        if not self.cli_exe:
            return {
                "success": False,
                "output": "",
                "error": "Claude Code CLI binary not found. Ensure 'npm install -g @anthropic-ai/claude-code' is installed.",
            }

        target_model = model or self.default_model
        cmd = [self.cli_exe, "-p"]

        valid_session_id = None
        if session_id:
            try:
                valid_session_id = str(uuid.UUID(str(session_id)))
            except (ValueError, AttributeError):
                valid_session_id = str(uuid.uuid5(uuid.NAMESPACE_DNS, str(session_id)))

        if valid_session_id:
            if resume:
                cmd.extend(["--resume", valid_session_id])
            else:
                cmd.extend(["--session-id", valid_session_id])

        # Disable built-in bash/edit tools so Claude Code acts strictly as an agent reasoning LLM
        cmd.extend(["--tools", ""])

        if target_model:
            # Normalize model flag for Claude CLI
            m_lower = target_model.lower()
            if "sonnet" in m_lower:
                cmd.extend(["--model", "claude-3-5-sonnet"])
            elif "opus" in m_lower:
                cmd.extend(["--model", "claude-3-opus"])
            elif "haiku" in m_lower:
                cmd.extend(["--model", "claude-3-5-haiku"])

        neutral_cwd = tempfile.gettempdir()
        try:
            res = subprocess.run(
                cmd,
                input=prompt,
                capture_output=True,
                text=True,
                encoding="utf-8",
                cwd=neutral_cwd,
                timeout=timeout_seconds,
            )
            raw_stdout = _strip_ansi_codes(res.stdout or "").strip()
            raw_stderr = _strip_ansi_codes(res.stderr or "").strip()

            if "OAuth session expired" in raw_stdout or "OAuth session expired" in raw_stderr:
                return {
                    "success": False,
                    "output": "",
                    "session_expired": True,
                    "error": (
                        "Claude Code CLI OAuth session expired. Please run 'claude login' "
                        "in your terminal to re-authenticate with your Claude subscription."
                    ),
                }

            if res.returncode == 0 and raw_stdout:
                # Filter out standard non-blocking warning lines
                clean_lines = [line for line in raw_stdout.split("\n") if not line.startswith("Warning:")]
                return {
                    "success": True,
                    "output": "\n".join(clean_lines).strip(),
                    "session_id": session_id,
                    "error": None,
                }

            err_detail = raw_stderr or raw_stdout or f"Subprocess exited with code {res.returncode}"
            return {
                "success": False,
                "output": raw_stdout,
                "error": err_detail,
            }
        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "output": "",
                "error": f"Claude Code CLI timed out after {timeout_seconds}s.",
            }
        except Exception as e:
            return {
                "success": False,
                "output": "",
                "error": f"Failed to invoke Claude CLI subprocess: {e}",
            }


# Singleton bridge instance
claude_cli_bridge = ClaudeCLISession()
