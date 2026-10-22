"""
omniflow/ui/terminal.py
-----------------------
Clean, modern, executive-grade CLI output formatter for OmniFlow.
Renders high-density, professional progress without noisy logs, tacky banners,
or internal trace dumps.
"""

from __future__ import annotations

import sys
import time


def _clean_str(text: str) -> str:
    return (
        text.replace("\u2011", "-")
        .replace("\u2012", "-")
        .replace("\u2013", "-")
        .replace("\u2014", "-")
        .replace("\u202f", " ")
        .replace("\u00a0", " ")
        .replace("\u2018", "'")
        .replace("\u2019", "'")
        .replace("\u201c", '"')
        .replace("\u201d", '"')
    )


class TerminalUI:
    """Provides structured, executive-grade terminal streaming."""

    def __init__(self) -> None:
        if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
            try:
                sys.stdout.reconfigure(encoding="utf-8", errors="replace")
            except Exception:
                pass

    def banner(self, project_name: str, project_code: str, source_info: str, target_info: str, llm_model: str) -> None:
        border = "=" * 80
        sys.stdout.write(f"\n{border}\n")
        sys.stdout.write("  OmniFlow Studio — Microsoft Fabric Autonomous Data Platform\n")
        sys.stdout.write(f"{border}\n")
        sys.stdout.write(f"  Project:    {project_name} ({project_code})\n")
        sys.stdout.write(f"  Source:     {source_info}\n")
        sys.stdout.write(f"  Target:     {target_info}\n")
        sys.stdout.write(f"  LLM Engine: {llm_model}\n")
        sys.stdout.write(f"{border}\n\n")
        sys.stdout.flush()

    def stage(self, step_num: int, total_steps: int, title: str) -> None:
        sys.stdout.write(f"[{step_num}/{total_steps}] {title}\n")
        sys.stdout.flush()
        time.sleep(0.04)

    def success_bullet(self, message: str, indent: int = 1) -> None:
        pad = "  " * indent
        msg = _clean_str(message)
        sys.stdout.write(f"{pad}* {msg}\n")
        sys.stdout.flush()
        time.sleep(0.02)

    def sub_bullet(self, message: str, indent: int = 2) -> None:
        pad = "  " * indent
        msg = _clean_str(message)
        sys.stdout.write(f"{pad}- {msg}\n")
        sys.stdout.flush()
        time.sleep(0.01)

    def check_item(self, name: str, status: str, details: str = "", width: int = 46) -> None:
        dots = "." * max(2, width - len(name))
        line = f"    {name} {dots} [{status}]"
        if details:
            line += f" ({details})"
        sys.stdout.write(f"{line}\n")
        sys.stdout.flush()
        time.sleep(0.03)

    def divider(self) -> None:
        sys.stdout.write("\n")
        sys.stdout.flush()

    def complete(self, run_id: str, artifact_path: str, live_deployed: bool = True) -> None:
        border = "=" * 80
        status_text = "Execution & Fabric Cloud Provisioning Completed Successfully!" if live_deployed else "Execution Completed Successfully!"
        sys.stdout.write(f"\n{border}\n")
        sys.stdout.write(f"  {status_text}\n")
        sys.stdout.write(f"  Run ID:    {run_id}\n")
        sys.stdout.write(f"  Artifacts: {artifact_path}\n")
        sys.stdout.write(f"{border}\n\n")
        sys.stdout.flush()


ui = TerminalUI()

