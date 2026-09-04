"""
app/execution_logger.py
-----------------------
Generates human-readable Markdown execution trace and reconciliation reports
with high-precision UTC timestamps and elapsed duration for every stage,
worker activity, and live Fabric deployment.

Each session gets its own detailed Markdown document in `execution_traces/`
recording:
  - User Prompt & Global Timestamp
  - Stage-by-Stage Timeline & Duration Matrix
  - Stage 0: Context Gate Decision (Timestamped)
  - Stage 1: Meta-Planner Step DAG & Dependency Classification (Timestamped)
  - Stage 2: Worker Agents Execution (Per-Worker Start/Finish Timestamps & Code Preview)
  - Stage 3: Builder & Reconciler AST unification (Timestamped)
  - Stage 4: Auditor & Self-Healing Verification (Timestamped)
  - Stage 5: Live Microsoft Fabric Deployment Audit (Per-Step Timestamps & Status)
"""

from datetime import UTC, datetime
from pathlib import Path
from typing import Any

BASE_DIR = Path(__file__).resolve().parent.parent
TRACES_DIR = BASE_DIR / "execution_traces"
TRACES_DIR.mkdir(exist_ok=True)


def log_agent_execution(session_id: str, state: Any, deployment_result: dict | None = None) -> str:
    """
    Appends a structured markdown trace block to the session's log file in execution_traces/.
    Includes exact stage-by-stage and activity-by-activity UTC timestamps and duration.
    """
    safe_sid = "".join(c for c in session_id if c.isalnum() or c in ("-", "_"))[:32] or "default"
    log_file = TRACES_DIR / f"session_{safe_sid}.md"

    now_utc = datetime.now(UTC).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + " UTC"

    plan = getattr(state, "fabric_plan", None) or {}
    dag = getattr(state, "dag", None)
    worker_results = getattr(state, "worker_results", None) or {}
    audit = getattr(state, "audit", None)
    audit_messages = getattr(state, "audit_messages", None) or []
    run_id = getattr(state, "run_id", "run_001")
    prompt = getattr(state, "prompt", "")
    context_mode = getattr(state, "context_mode", "independent")
    retry_count = getattr(state, "retry_count", 0)
    started_at = getattr(state, "started_at", now_utc)
    completed_at = getattr(state, "completed_at", now_utc)
    total_dur = getattr(state, "total_duration_sec", 0.0)
    stage_timings = getattr(state, "stage_timings", {}) or {}

    md = []
    # If new file, add header
    if not log_file.exists():
        md.append("# 🏛️ Fabric AI Studio — Agent Execution Trace & Reconciliation Log")
        md.append(f"- **Session ID**: `{session_id}`")
        md.append(f"- **Log Created At**: `{now_utc}`\n")
        md.append("---\n")

    md.append(f"## ⏱️ Execution Run: `{run_id}`")
    md.append(f"- **Started At**: `{started_at}`")
    md.append(f"- **Completed At**: `{completed_at}`")
    if total_dur > 0:
        md.append(f"- **Total Duration**: `{total_dur}s`")
    md.append("")

    md.append(f"### 📥 1. User Request\n```text\n{prompt.strip()}\n```\n")

    # Timeline & Duration Summary Matrix
    if stage_timings:
        md.append("### 📊 Stage-by-Stage Execution Timeline & Duration Matrix")
        md.append("| Stage / Activity | Started At (UTC) | Completed At (UTC) | Duration |")
        md.append("| :--- | :--- | :--- | :--- |")
        for stage_name, timing in stage_timings.items():
            st_start = timing.get("started_at", "-")
            st_end = timing.get("completed_at", "-")
            dur = timing.get("duration_sec", 0.0)
            md.append(f"| **{stage_name}** | `{st_start}` | `{st_end}` | `{dur}s` |")
        md.append("")

    # Stage 0: Context Gate
    t0_meta = stage_timings.get("Stage 0 (Context Gate)", {})
    t0_dur_str = f" *({t0_meta.get('duration_sec', 0)}s)*" if t0_meta else ""
    md.append(f"### 🚪 2. Stage 0: Context Gate Decision{t0_dur_str}")
    if t0_meta:
        md.append(f"- **Timestamp**: `{t0_meta.get('started_at', '-')} → {t0_meta.get('completed_at', '-')}`")
    md.append(f"- **Mode**: `{context_mode.upper()}`")
    if context_mode == "independent":
        md.append("- **Action**: Decoupled from prior conversation history. Started with pristine context.")
    else:
        md.append("- **Action**: Connected to active plan state for conversational refinement.")
    md.append("")

    # Stage 1: Meta-Planner
    t1_meta = stage_timings.get("Stage 1 (Meta-Planner)", {})
    t1_dur_str = f" *({t1_meta.get('duration_sec', 0)}s)*" if t1_meta else ""
    md.append(f"### 🗺️ 3. Stage 1: Meta-Planner Step DAG{t1_dur_str}")
    if t1_meta:
        md.append(f"- **Timestamp**: `{t1_meta.get('started_at', '-')} → {t1_meta.get('completed_at', '-')}`")
    if dag:
        md.append(f"- **Target Folder**: `{dag.folder}`")
        md.append(f"- **Summary**: {dag.summary}")
        md.append(f"- **Total Steps**: `{len(dag.steps)}`\n")
        md.append("| Step ID | Type | Name | Layer | Execution Mode | Depends On |")
        md.append("| :--- | :--- | :--- | :--- | :--- | :--- |")
        for s in dag.steps:
            mode = "⚡ Parallel" if s.can_parallel else "🔗 Sequential Chain"
            deps = ", ".join(s.depends_on) if s.depends_on else "*None (Root)*"
            md.append(f"| `{s.step_id}` | `{s.type}` | `{s.name}` | `{s.layer or '-'}` | {mode} | {deps} |")
    else:
        md.append("*No DAG generated.*")
    md.append("")

    # Stage 2: Forward-Chaining Workers
    md.append("### ⚡ 4. Stage 2: Worker Agents & Forward-Chaining State")
    if worker_results:
        for sid, wr in worker_results.items():
            dur_str = f" *({wr.duration_sec}s)*" if wr.duration_sec else ""
            md.append(f"#### 📦 Worker: `{wr.name}` ({wr.layer or 'Notebook'}){dur_str}")
            md.append(f"- **Step ID**: `{sid}`")
            if wr.started_at:
                md.append(f"- **Execution Timestamp**: `{wr.started_at} → {wr.completed_at}` (`{wr.duration_sec}s`)")
            md.append(f"- **OneLake ABFSS Path**: `{wr.lh_path}`")
            if wr.error:
                md.append(f"- **Status**: ❌ Error: `{wr.error}`")
            else:
                code_lines = wr.pyspark.strip().splitlines()
                md.append(f"- **Status**: ✅ Code Generated (`{len(code_lines)}` lines)")
                md.append("```python")
                preview = code_lines[:15]
                md.append("\n".join(preview))
                if len(code_lines) > 15:
                    md.append(f"# ... (+ {len(code_lines) - 15} lines)")
                md.append("```")
            md.append("")
    else:
        md.append("*No worker outputs recorded.*")
    md.append("")

    # Stage 3: Builder / Reconciler
    t3_meta = stage_timings.get("Stage 3 (Builder / Reconciler - Attempt 1)", {})
    t3_dur_str = f" *({t3_meta.get('duration_sec', 0)}s)*" if t3_meta else ""
    md.append(f"### 🏗️ 5. Stage 3: Builder & Reconciler{t3_dur_str}")
    if t3_meta:
        md.append(f"- **Timestamp**: `{t3_meta.get('started_at', '-')} → {t3_meta.get('completed_at', '-')}`")
    if plan:
        md.append(f"- **Unified Plan Folder**: `{plan.get('folder')}`")
        md.append(f"- **Lakehouses ({len(plan.get('lakehouses', []))})**: {', '.join(plan.get('lakehouses', [])) or '*None*'}")
        md.append(f"- **Notebooks ({len(plan.get('notebooks', []))})**: {', '.join(nb.get('name') for nb in plan.get('notebooks', []))}")
        pl = plan.get("pipeline")
        if pl:
            sched = pl.get("schedule", {})
            sched_str = sched.get("human") if isinstance(sched, dict) else str(sched)
            md.append(f"- **Data Pipeline**: `{pl.get('name')}` (Schedule: `{sched_str}`)")
    md.append("")

    # Stage 4: Auditor & Self-Healing
    t4_meta = stage_timings.get("Stage 4 (Auditor - Attempt 1)", {})
    t4_dur_str = f" *({t4_meta.get('duration_sec', 0)}s)*" if t4_meta else ""
    md.append(f"### 🔍 6. Stage 4: Auditor & Self-Healing Verification{t4_dur_str}")
    if t4_meta:
        md.append(f"- **Timestamp**: `{t4_meta.get('started_at', '-')} → {t4_meta.get('completed_at', '-')}`")
    if audit:
        md.append(f"- **Audit Passed**: `{'✅ YES' if audit.passed else '❌ NO'}`")
        md.append(f"- **Auto-Remediation Loops**: `{retry_count}`")
        md.append(f"- **Missing Items Detected**: `{audit.missing_items or 'None'}`")
        md.append(f"- **Extra Items Detected**: `{audit.extra_items or 'None'}`")
        md.append(f"- **Audit Verdict Message**: {audit.chat_message}")
        if audit_messages:
            md.append("- **Audit Log Stream**:")
            for am in audit_messages:
                md.append(f"  - `{am}`")
    md.append("")

    # Stage 5: Live Deployment Audit (if applicable)
    if deployment_result:
        dep_start = deployment_result.get("started_at", now_utc)
        dep_end = deployment_result.get("completed_at", now_utc)
        dep_dur = deployment_result.get("duration_sec", 0.0)
        dur_note = f" *({dep_dur}s)*" if dep_dur else ""
        md.append(f"### 🚀 7. Stage 5: Live Microsoft Fabric Deployment Audit{dur_note}")
        md.append(f"- **Deployment Timestamp**: `{dep_start} → {dep_end}`")
        md.append(f"- **Deployment Status**: `{deployment_result.get('status', 'completed').upper()}`")
        md.append(f"- **Fabric Workspace ID**: `{deployment_result.get('workspace_id')}`")
        md.append(f"- **Target Folder ID**: `{deployment_result.get('folder_id')}`")
        steps = deployment_result.get("steps", [])
        if steps:
            md.append("\n| Step # | Timestamp (UTC) | Resource Title | Status | Details |")
            md.append("| :--- | :--- | :--- | :--- | :--- |")
            for st in steps:
                st_icon = "✅" if st.get("status") == "completed" else ("⏳" if st.get("status") == "running" else "❌")
                st_ts = st.get("timestamp", "-")
                md.append(f"| {st.get('step')} | `{st_ts}` | {st.get('title')} | {st_icon} {st.get('status')} | {st.get('detail')} |")
    md.append("\n---\n")

    with open(log_file, "a", encoding="utf-8") as f:
        f.write("\n".join(md))

    return str(log_file)
