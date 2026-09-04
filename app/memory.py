"""
app/memory.py
-------------
Memory Manager — the brain connecting conversation history, workspace context,
and learned facts into coherent LLM-ready context.

This is the single interface the agent and server use for all memory operations.
It wraps session_store.py (persistence) and workspace_cache.py (Fabric state).

Key responsibilities:
  1. Build enriched system prompts injecting workspace state + learned facts
  2. Manage rolling conversation window (trimmed to stay within token budget)
  3. Extract and persist facts from user messages automatically
  4. Provide a unified interface: MemoryManager(session_id)

Usage:
    from app.memory import MemoryManager

    mem = MemoryManager(session_id="abc123")
    mem.add_user("Ingest the Orders table from SalesDB nightly")
    messages = mem.build_llm_messages()  # inject into chat()
    response = chat(messages, complexity="high")
    mem.add_assistant(response)
"""

import re
import uuid

from app import session_store as store
from app.config import ALLOWED_WORKSPACE_ID, ALLOWED_WORKSPACE_NAME

# ── Constants ─────────────────────────────────────────────────────────────────

_MAX_CONVERSATION_TURNS = 30   # Max messages retrieved from DB for Squeeze Straw processing
_MAX_SYSTEM_PROMPT_FACTS = 6   # Max facts injected into system prompt
_TOKEN_BUDGET_MAX = 6000       # Token ceiling — raised to support longer architectural sessions

# Squeeze Straw tier boundaries (in message count, not turn pairs)
_TIER1_VERBATIM_MSGS = 10    # Last 10 messages (5 user+5 assistant) = 100% verbatim
_TIER2_COMPRESS_MSGS = 20    # Messages -21 to -11 = compressed paragraph (Tier 2)
# Everything older than _TIER2_COMPRESS_MSGS = Tier 3 (dense archive paragraph)


# ── Fact & Entity Extractor ────────────────────────────────────────────────────

# Patterns → (regex, fact_key, static_val|None)
_FACT_PATTERNS = [
    # Schedule patterns — store human-readable description
    (r"\b(nightly|every night)\b",                                     "preferred_schedule", "Nightly at 02:00 UTC"),
    (r"\b(hourly|every hour|every \d+ hours?)\b",                     "preferred_schedule", "Hourly"),
    (r"\b(daily|every day)\b",                                         "preferred_schedule", "Daily"),
    (r"\b(weekly|every week)\b",                                       "preferred_schedule", "Weekly"),
    (r"\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm|utc)?)\b",             "preferred_schedule", None),  # e.g. "at 2am"

    # Database/source patterns — keep the full name
    (r"(?:from|database\s+is|db\s+is|into|ingest|load|for)\s+([A-Za-z][A-Za-z0-9_]+(?:db|database|DB))\b", "source_database", None),
    (r"\b([A-Za-z][A-Za-z0-9_]*DB)\b", "source_database", None),

    # Target Lakehouse (lh_xxx)
    (r"\b(lh_[A-Za-z0-9_]+)\b", "target_lakehouse", None),

    # Source connector
    (r"(?:source\s+is|using|connector\s+is|from)\s+(azure\s*sql|sap|salesforce|redshift|blob storage|snowflake)", "preferred_source", None),

    # Layer / architecture preferences
    (r"\b(bronze only|bronze\s+and\s+silver|all\s+three\s+layers|medallion|full medallion)\b", "architecture_pattern", None),
    (r"\b(medallion|bronze|silver|gold)\b", "architecture_pattern", None),

    # Folder / project names  (e.g. "folder FinTech_Risk" or "in folder Enterprise_Retail")
    (r"(?:folder|project|workspace)\s+([A-Za-z][A-Za-z0-9_]+)", "last_folder", None),

    # Items explicitly mentioned
    (r"\b(nb_[A-Za-z0-9_]+)\b", "last_notebook", None),
    (r"\b(pl_[A-Za-z0-9_]+)\b", "last_pipeline", None),
]

# Human-readable labels shown in the UI sidebar and system prompt
_FACT_LABELS = {
    "preferred_schedule":    "Schedule preference",
    "source_database":       "Source database",
    "target_lakehouse":      "Target lakehouse",
    "target_lakehouses":     "Target lakehouses",
    "preferred_source":      "Data source connector",
    "architecture_pattern":  "Architecture pattern",
    "working_folder":        "Working folder",
    "last_folder":           "Working folder",
    "notebooks_created":     "Notebooks configured",
    "last_notebook":         "Last notebook referenced",
    "orchestration_pipeline": "Orchestration pipeline",
    "last_pipeline":         "Last pipeline referenced",
    "session_context":       "Session context",
    "project_summary":       "Project summary",
}


def _extract_facts(text: str) -> list[tuple[str, str]]:
    """
    Scans a user message for recognizable patterns and returns
    a list of (fact_key, fact_value) tuples to persist.
    Values are normalised to be human-readable (not bare keywords).
    """
    extracted = []
    for pattern, key, static_val in _FACT_PATTERNS:
        m = re.search(pattern, text, re.IGNORECASE)
        if m:
            if static_val:
                val = static_val
            else:
                raw_val = m.group(1).strip()
                # Normalise known source names to pretty strings
                rl = raw_val.lower()
                if "azure" in rl and "sql" in rl:
                    val = "Azure SQL"
                elif "sap" in rl:
                    val = "SAP HANA"
                elif "salesforce" in rl:
                    val = "Salesforce CRM"
                elif "snowflake" in rl:
                    val = "Snowflake"
                elif "blob" in rl:
                    val = "Azure Blob Storage"
                elif "medallion" in rl or "bronze" in rl:
                    val = "Medallion (Bronze → Silver → Gold)"
                else:
                    val = raw_val
            extracted.append((key, val))
    return extracted


def _build_narrative_architecture_summary(plan: dict) -> str:
    """
    Creates a comprehensive, cohesive narrative explanation of the architecture
    detailing the folder, lakehouses, notebooks (with layer-to-lakehouse linkage),
    and scheduled pipeline activities.
    """
    folder = plan.get("folder", "Default")
    lakehouses = plan.get("lakehouses", [])
    notebooks = plan.get("notebooks", [])
    pl = plan.get("pipeline")

    sentences = []

    # 1. Folder & Lakehouses
    if lakehouses:
        lh_list = ", ".join(f"`{lh}`" for lh in lakehouses)
        sentences.append(f"In workspace folder **'{folder}'**, {len(lakehouses)} Lakehouses were architected: {lh_list}.")
    elif folder:
        sentences.append(f"Working within Fabric workspace folder **'{folder}'**.")

    # 2. Notebooks with layer/purpose mapping
    if notebooks:
        nb_details = []
        for nb in notebooks:
            name = nb.get("name", "notebook")
            layer = nb.get("layer", "")
            desc = nb.get("description", "")
            if layer and desc:
                nb_details.append(f"`{name}` ({layer} layer: {desc.rstrip('.')})")
            elif layer:
                nb_details.append(f"`{name}` ({layer} layer)")
            else:
                nb_details.append(f"`{name}`")

        sentences.append(f"{len(notebooks)} PySpark notebooks are configured: " + "; ".join(nb_details) + ".")

    # 3. Pipeline & Scheduling
    if pl and isinstance(pl, dict):
        pl_name = pl.get("name", "pl_orchestrator")
        pl_sched = pl.get("schedule", {}).get("human") or pl.get("schedule", {}).get("cron", "Scheduled")
        sentences.append(
            f"The Data Factory pipeline `{pl_name}` sequences all {len(notebooks)} notebook activities and is configured with trigger schedule **{pl_sched}**."
        )

    return " ".join(sentences)


def record_plan_facts(session_id: str, plan: dict):
    """
    Auto-populates session memory facts from a successfully generated
    architecture plan.
    """
    if not session_id or not plan:
        return

    try:
        folder = plan.get("folder")
        if folder:
            store.set_fact(session_id, "folder_target", f"Folder '{folder}'")

        lakehouses = plan.get("lakehouses", [])
        if lakehouses:
            store.set_fact(session_id, "target_lakehouses", f"Lakehouses ({len(lakehouses)}): {', '.join(lakehouses)}")

        notebooks = plan.get("notebooks", [])
        if notebooks:
            nb_names = [nb.get("name") for nb in notebooks if nb.get("name")]
            store.set_fact(session_id, "notebooks_created", f"{len(notebooks)} notebook(s): {', '.join(nb_names)}")

        pl = plan.get("pipeline")
        if pl and isinstance(pl, dict):
            pl_name = pl.get("name", "pl_pipeline")
            raw_sched = pl.get("schedule")
            if isinstance(raw_sched, dict):
                pl_sched = raw_sched.get("human") or raw_sched.get("cron", "Scheduled")
            elif isinstance(raw_sched, str):
                pl_sched = raw_sched
            else:
                pl_sched = "Scheduled"
            store.set_fact(session_id, "orchestration_pipeline", f"Pipeline '{pl_name}' ({pl_sched})")
        elif pl and isinstance(pl, str):
            store.set_fact(session_id, "orchestration_pipeline", f"Pipeline '{pl}'")

        summary = plan.get("summary")
        if summary:
            store.set_fact(session_id, "project_summary", summary)

        # Narrative explanation for session context
        narrative = _build_narrative_architecture_summary(plan)
        if narrative:
            store.set_fact(session_id, "session_context", narrative)
    except Exception as e:
        print(f"[MEMORY] Non-fatal fact extraction error: {e}")



def _build_session_context_summary(messages: list[dict]) -> str:
    """
    Builds a short 1-2 line plain-English summary of what has been
    accomplished in this session, derived from the conversation history.
    Used as the 'session_context' fact shown in the sidebar.
    """
    # Collect key nouns from assistant messages (plans, folder names, etc.)
    nb_pat = re.compile(r"\bnb_[A-Za-z0-9_]+\b")
    lh_pat = re.compile(r"\blh_[A-Za-z0-9_]+\b")
    pl_pat = re.compile(r"\bpl_[A-Za-z0-9_]+\b")

    notebooks, lakehouses, pipelines = set(), set(), set()
    turn_count = 0

    for m in messages:
        if m.get("role") not in ("user", "assistant"):
            continue
        content = m.get("content", "")
        turn_count += 1
        notebooks.update(nb_pat.findall(content))
        lakehouses.update(lh_pat.findall(content))
        pipelines.update(pl_pat.findall(content))

    if not (notebooks or lakehouses or pipelines):
        return f"{turn_count // 2} exchange(s) so far — no Fabric items created yet."

    parts = []
    if notebooks:
        parts.append(f"{len(notebooks)} notebook(s): {', '.join(sorted(notebooks)[:3])}")
    if lakehouses:
        parts.append(f"{len(lakehouses)} lakehouse(s): {', '.join(sorted(lakehouses)[:2])}")
    if pipelines:
        parts.append(f"pipeline: {', '.join(sorted(pipelines)[:2])}")

    return "; ".join(parts) + f" ({turn_count // 2} turn(s))."



# ── System Prompt Builder ─────────────────────────────────────────────────────

def _build_system_prompt(
    workspace_summary: str,
    learned_facts: dict[str, str],
    recent_runs: list[dict],
    active_skill: dict | None = None,
) -> str:
    """
    Builds the enriched system prompt injected as the first message
    in every LLM call. Keeps it concise — verbose prompts waste tokens.
    """
    from app.skill_loader import get_skills_manifest

    # Recent run summary (last 3)
    run_lines = []
    for r in recent_runs[:3]:
        status = r.get("status", "unknown")
        name   = r.get("source_name") or r.get("database_name") or r.get("run_id", "")
        ts     = (r.get("updated_at") or r.get("created_at") or "")[:16]
        run_lines.append(f"  - [{status.upper()}] {name} @ {ts}")
    runs_block = "\n".join(run_lines) if run_lines else "  None yet."

    # Learned facts block — show human-readable label and value
    fact_lines = []
    for k, v in list(learned_facts.items())[:_MAX_SYSTEM_PROMPT_FACTS]:
        label = _FACT_LABELS.get(k, k.replace("_", " ").title())
        fact_lines.append(f"  {label}: {v}")
    facts_block = "\n".join(fact_lines) if fact_lines else "  None learned yet."

    # Dynamic Skills Manifest (Progressive Disclosure)
    skills_manifest = get_skills_manifest()

    active_skill_block = ""
    if active_skill:
        active_skill_block = f"""
ACTIVE SPECIALIZED SKILL: [{active_skill.get('name')}]
{active_skill.get('content')}
"""

    return f"""You are Fabric AI Studio — an expert Microsoft Fabric data engineering agent.

WORKSPACE:
  Name: {ALLOWED_WORKSPACE_NAME}
  ID:   {ALLOWED_WORKSPACE_ID}
{workspace_summary}

RECENT RUNS:
{runs_block}

LEARNED USER PREFERENCES:
{facts_block}

AVAILABLE SPECIALIZED SKILLS (Progressive Disclosure):
{skills_manifest}
{active_skill_block}
SAFETY RULES (NEVER break these):
  - Only operate on workspace {ALLOWED_WORKSPACE_NAME}
  - Always show impact analysis before destructive operations
  - HIGH risk operations require explicit user confirmation
  - Never expose credentials or raw secrets in responses

RESPONSE STYLE:
  - Be concise and direct. No fluff.
  - When proposing a plan, summarize it in 3-5 bullet points first.
  - When something fails, explain WHY and propose a concrete fix.
  - Use exact Fabric item names (lakehouses, notebooks) from context when available.
"""


# ── MemoryManager ─────────────────────────────────────────────────────────────

class MemoryManager:
    """
    Per-session memory manager.

    Typical usage in a request handler:
        mem = MemoryManager.get_or_create(session_id)
        mem.add_user(user_message)
        llm_messages = mem.build_llm_messages(workspace_cache)
        response = chat(llm_messages, complexity="high")
        mem.add_assistant(response)
    """

    def __init__(self, session_id: str):
        self.session_id = session_id

    # ── Factory ───────────────────────────────────────────────────────────────

    @classmethod
    def get_or_create(cls, session_id: str | None = None) -> "MemoryManager":
        """
        Returns a MemoryManager for the given session_id.
        If session_id is None or not found, creates a new session.
        """
        if not session_id or not store.get_session(session_id):
            session_id = str(uuid.uuid4())[:16]
            store.create_session(session_id, ALLOWED_WORKSPACE_ID)
        return cls(session_id)

    # ── Message Management ────────────────────────────────────────────────────

    def add_user(self, content: str) -> int:
        """Persists a user message and auto-extracts facts from it."""
        msg_id = store.add_message(self.session_id, "user", content)
        # Auto-extract and persist facts
        facts = _extract_facts(content)
        for key, val in facts:
            store.set_fact(self.session_id, key, val)
            try:
                print(f"[MEMORY] Learned fact: {key}={val}")
            except Exception:
                pass
        return msg_id

    def add_assistant(self, content: str) -> int:
        """Persists an assistant (LLM) response and refreshes session context."""
        msg_id = store.add_message(self.session_id, "assistant", content)
        # After each assistant turn, refresh the session context summary
        try:
            history = store.get_messages(self.session_id, last_n=20)
            ctx = _build_session_context_summary(history)
            if ctx:
                store.set_fact(self.session_id, "session_context", ctx)
        except Exception:
            pass
        return msg_id


    def add_tool_result(self, content: str) -> int:
        """Persists a tool call result (plan output, deploy status, etc.)"""
        return store.add_message(self.session_id, "tool", content)

    # ── Context Building ──────────────────────────────────────────────────────

    def build_llm_messages(
        self,
        workspace_cache: dict | None = None,
        extra_context: str = "",
    ) -> list[dict]:
        """
        Builds the complete message list ready for the LLM using the
        Squeeze Straw progressive compression algorithm.

        Context is built in 3 tiers:
          Tier 3 (archive) — dense 1-paragraph summary of oldest messages
          Tier 2 (mid)     — compressed paragraph of middle messages
          Tier 1 (active)  — last N messages verbatim

        Tier 2 and 3 are cached in SQLite and only re-compressed when new
        messages arrive past each tier boundary (lazy, zero-overhead).

        Args:
            workspace_cache: dict from workspace_cache.py (items, folders)
            extra_context:   Any extra string to append to the system prompt

        Returns:
            OpenAI-style list of {role, content} dicts.
        """
        # Build workspace summary
        workspace_summary = _summarize_workspace(workspace_cache)

        # Fetch learned facts (exclude system-reserved _tier* keys) and recent runs
        all_facts    = store.get_facts(self.session_id)
        facts        = {k: v for k, v in all_facts.items() if not k.startswith("_tier")}
        recent_runs  = store.get_recent_runs(limit=3)

        # Match relevant skill from the latest user message for Progressive Disclosure
        from app.skill_loader import match_relevant_skill
        last_user_msg = next((m["content"] for m in reversed(store.get_messages(self.session_id)) if m["role"] == "user"), "")
        active_skill = match_relevant_skill(last_user_msg) if last_user_msg else None

        # Build system prompt
        system_prompt = _build_system_prompt(workspace_summary, facts, recent_runs, active_skill=active_skill)
        if extra_context:
            system_prompt += f"\nADDITIONAL CONTEXT:\n{extra_context}\n"

        # ── Squeeze Straw: Build 3-tier context ───────────────────────────────
        tier3_block, tier2_block, tier1_msgs = _build_squeeze_straw_context(self.session_id)

        # Assemble final messages respecting token budget
        messages = [{"role": "system", "content": system_prompt}]

        # Inject tier summaries as system context blocks (not user/assistant roles)
        # so the model treats them as factual background, not live dialogue
        history_prefix = ""
        if tier3_block:
            history_prefix += f"[ARCHIVED CONTEXT — oldest interactions summarized]\n{tier3_block}\n\n"
        if tier2_block:
            history_prefix += f"[RECENT CONTEXT — earlier interactions summarized]\n{tier2_block}\n\n"

        if history_prefix:
            messages.append({"role": "system", "content": history_prefix.strip()})

        # Token-budget check on verbatim Tier 1 messages
        budget_used = int(len(system_prompt.split()) * 1.3)
        if history_prefix:
            budget_used += int(len(history_prefix.split()) * 1.3)

        trimmed_tier1 = []
        for msg in reversed(tier1_msgs):
            msg_tokens = int(len(msg["content"].split()) * 1.3)
            if budget_used + msg_tokens > _TOKEN_BUDGET_MAX:
                break
            trimmed_tier1.insert(0, msg)
            budget_used += msg_tokens

        messages.extend(trimmed_tier1)
        return messages

    # ── Run Tracking ──────────────────────────────────────────────────────────

    def track_run(self, run_id: str, **fields):
        """Creates or updates a run record tied to this session."""
        store.upsert_run(run_id, self.session_id, **fields)

    def get_run(self, run_id: str) -> dict | None:
        return store.get_run(run_id)

    def get_session_runs(self) -> list[dict]:
        return store.get_session_runs(self.session_id)

    # ── Facts ─────────────────────────────────────────────────────────────────

    def set_fact(self, key: str, value: str):
        store.set_fact(self.session_id, key, value)

    def get_facts(self) -> dict[str, str]:
        return store.get_facts(self.session_id)

    # ── Summary ───────────────────────────────────────────────────────────────

    def get_summary(self) -> dict:
        """Returns a compact summary of this session's memory state."""
        session   = store.get_session(self.session_id)
        msg_count = store.get_message_count(self.session_id)
        runs      = store.get_session_runs(self.session_id)
        facts     = store.get_facts(self.session_id)
        return {
            "session_id":    self.session_id,
            "created_at":    session.get("created_at") if session else None,
            "last_active":   session.get("last_active") if session else None,
            "message_count": msg_count,
            "run_count":     len(runs),
            "facts":         facts,
            "recent_runs":   [
                {"run_id": r["run_id"], "status": r["status"],
                 "source": r.get("source_name"), "updated": r.get("updated_at")}
                for r in runs[:5]
            ],
        }



# ── Squeeze Straw Algorithm ───────────────────────────────────────────────────

def _compress_tier(messages: list[dict], tier_label: str) -> str:
    """
    Compresses a list of messages into a single dense paragraph using gpt-oss-20b.
    Only called when a tier boundary is crossed (lazy evaluation).
    Falls back to a structured text summary if the LLM call fails.

    Args:
        messages:   List of {role, content} dicts to compress.
        tier_label: Human label for the tier (e.g., "Tier 2 mid-range", "Tier 3 archive").

    Returns:
        A single paragraph string summarizing the conversations.
    """
    from app.llm_router import chat as llm_chat

    if not messages:
        return ""

    # Build a minimal transcript for the compressor
    transcript_lines = []
    for m in messages:
        prefix = "User" if m["role"] == "user" else "Assistant"
        # Truncate very long messages for the compressor context
        content = m["content"][:1200] + ("..." if len(m["content"]) > 1200 else "")
        transcript_lines.append(f"{prefix}: {content}")

    transcript = "\n".join(transcript_lines)

    compressor_prompt = [
        {
            "role": "system",
            "content": (
                "You are a technical context compressor for a Microsoft Fabric AI Studio. "
                "Compress the provided conversation transcript into a single dense paragraph. "
                "PRESERVE: all named entities (lakehouse names, notebook names, pipeline IDs, table names, "
                "database names, workspace names, schedules, column names). "
                "PRESERVE: all decisions made, constraints set, errors encountered, and architecture choices. "
                "DISCARD: pleasantries, repetition, verbose explanations. "
                "Output ONLY the compressed paragraph, no headers or labels."
            )
        },
        {
            "role": "user",
            "content": f"Compress this {tier_label} conversation history:\n\n{transcript}"
        }
    ]

    try:
        compressed = llm_chat(compressor_prompt, complexity="compress", max_tokens=512)
        return compressed.strip()
    except Exception as e:
        print(f"[SQUEEZE STRAW] Compression failed for {tier_label}: {e}")
        # Graceful fallback: first+last message snippet
        fallback_parts = []
        if messages:
            first = messages[0]["content"][:200]
            fallback_parts.append(f"Early: {first}...")
        if len(messages) > 1:
            last = messages[-1]["content"][:200]
            fallback_parts.append(f"Recent: {last}...")
        return " | ".join(fallback_parts)


def _build_squeeze_straw_context(session_id: str) -> tuple[str, str, list[dict]]:
    """
    Builds the 3-tier Squeeze Straw context for a session.

    Tiers:
      Tier 1 (verbatim)  — Last _TIER1_VERBATIM_MSGS messages, returned as-is.
      Tier 2 (mid)       — Messages _TIER2_COMPRESS_MSGS to _TIER1_VERBATIM_MSGS,
                           compressed to 1 paragraph, cached in SQLite.
      Tier 3 (archive)   — All messages older than _TIER2_COMPRESS_MSGS,
                           compressed to 1 dense paragraph, cached in SQLite.

    Caching: Summaries are stored in learned_facts under _tier2_summary / _tier3_summary.
    Re-compression only fires when new messages have been added past a tier boundary
    since the last compression (checked via compressed_up_to_turn).

    Returns:
        (tier3_block, tier2_block, tier1_msgs)
        tier3_block, tier2_block: str (empty string if tier doesn't apply yet)
        tier1_msgs: list[{role, content}] dicts (ready for LLM)
    """
    all_msgs = store.get_messages_with_index(session_id)

    if not all_msgs:
        return "", "", []

    total = len(all_msgs)

    # Split into tiers by index from the END of the message list
    tier1_raw = all_msgs[max(0, total - _TIER1_VERBATIM_MSGS):]
    tier2_raw = all_msgs[max(0, total - _TIER2_COMPRESS_MSGS):max(0, total - _TIER1_VERBATIM_MSGS)]
    tier3_raw = all_msgs[:max(0, total - _TIER2_COMPRESS_MSGS)]

    # Convert to LLM-friendly format for Tier 1
    tier1_msgs = [{"role": m["role"], "content": m["content"]} for m in tier1_raw
                  if m["role"] in ("user", "assistant")]

    # ── Tier 2 Compression (lazy) ─────────────────────────────────────────────
    tier2_block = ""
    if tier2_raw:
        # Get the max turn_index in tier2 to detect if re-compression is needed
        tier2_max_turn = max(m["turn_index"] for m in tier2_raw)
        cached2 = store.get_tier_summary(session_id, 2)

        if cached2 and cached2.get("compressed_up_to_turn", -1) >= tier2_max_turn:
            # Cache is still valid
            tier2_block = cached2["summary"]
        else:
            # Re-compress
            msgs_for_compress = [{"role": m["role"], "content": m["content"]}
                                  for m in tier2_raw if m["role"] in ("user", "assistant")]
            tier2_block = _compress_tier(msgs_for_compress, "Tier 2 mid-range")
            store.set_tier_summary(session_id, 2, tier2_block, tier2_max_turn)

    # ── Tier 3 Compression (lazy) ─────────────────────────────────────────────
    tier3_block = ""
    if tier3_raw:
        tier3_max_turn = max(m["turn_index"] for m in tier3_raw)
        cached3 = store.get_tier_summary(session_id, 3)

        if cached3 and cached3.get("compressed_up_to_turn", -1) >= tier3_max_turn:
            # Cache is still valid
            tier3_block = cached3["summary"]
        else:
            # Re-compress
            msgs_for_compress = [{"role": m["role"], "content": m["content"]}
                                  for m in tier3_raw if m["role"] in ("user", "assistant")]
            tier3_block = _compress_tier(msgs_for_compress, "Tier 3 archive")
            store.set_tier_summary(session_id, 3, tier3_block, tier3_max_turn)

    return tier3_block, tier2_block, tier1_msgs


# ── Workspace Summarizer ──────────────────────────────────────────────────────

def _summarize_workspace(cache: dict | None) -> str:
    """
    Converts a workspace cache dict into a concise text summary
    for the LLM system prompt.
    """
    if not cache:
        return "  State: Unknown (no cache loaded — call GET /api/workspace/items to refresh)"

    items   = cache.get("items", [])
    folders = cache.get("folders", [])
    synced  = (cache.get("synced_at") or "")[:16]

    # Count by type
    type_counts: dict[str, int] = {}
    for item in items:
        t = item.get("type", "Unknown")
        type_counts[t] = type_counts.get(t, 0) + 1

    type_summary = ", ".join(f"{v} {k}{'s' if v>1 else ''}" for k, v in type_counts.items())
    folder_names = [f.get("displayName", "") for f in folders[:5]]

    lines = [
        f"  Items: {len(items)} total ({type_summary or 'none'})",
        f"  Folders: {len(folders)} ({', '.join(folder_names) or 'none'})",
        f"  Last synced: {synced or 'never'}",
    ]
    return "\n".join(lines)
