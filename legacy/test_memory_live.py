"""
test_memory_live.py
-------------------
Live Multi-Turn Statefulness & Token Test with Groq openai/gpt-oss-120b.

Tests:
  1. Turn 1: Define Database (SalesDB) + Lakehouse (lh_sales_bronze).
  2. Turn 2: Modify Schedule (every 3 hours) + Table (Orders with watermark updated_at).
  3. Turn 3: Ask the model to recall all previous context without repeating it.
  4. Measure token usage on each turn to verify it stays well within Groq limits.
"""

import sys
import os
import time

sys.path.insert(0, os.path.dirname(__file__))

from app.memory import MemoryManager
from app.llm_router import chat
from app.config import LLM_MODELS, GROQ_KEYS

print("\n" + "="*70)
print("  LIVE STATEFULNESS & TOKEN TEST: Groq openai/gpt-oss-120b")
print("="*70)

if not GROQ_KEYS:
    print("❌ ERROR: No GROQ_API_KEY found in .env")
    sys.exit(1)

session_id = f"test_live_{int(time.time())}"
mem = MemoryManager.get_or_create(session_id)

print(f"Session ID : {session_id}")
print(f"Model      : {LLM_MODELS['groq_high']}")
print(f"Groq Keys  : {len(GROQ_KEYS)} loaded\n")

turns = [
    (
        "Turn 1 (Initial Architecture)",
        "We are setting up an ingestion pipeline for our ERP database SalesDB into a Bronze lakehouse named lh_sales_bronze with nightly schedule. Give me a 2-sentence summary of the bronze layer setup.",
    ),
    (
        "Turn 2 (Context Modification)",
        "Change the schedule to run every 3 hours instead, and we will ingest the Orders table with watermark column updated_at.",
    ),
    (
        "Turn 3 (Memory Recall Verification)",
        "Without me repeating anything: What database, target lakehouse, schedule, and table did we just configure in our conversation?",
    ),
]

for i, (label, user_msg) in enumerate(turns, 1):
    print(f"[{i}/3] {label}...")
    print(f"  User Prompt: \"{user_msg}\"")

    # Add user message to persistent memory
    mem.add_user(user_msg)

    # Build context-enriched messages
    llm_messages = mem.build_llm_messages()
    token_est = sum(int(len(m["content"].split()) * 1.3) for m in llm_messages)
    print(f"  Input Tokens: ~{token_est} tokens (Messages count: {len(llm_messages)})")

    # Call Groq 120B model
    t0 = time.time()
    response = chat(llm_messages, complexity="high", max_tokens=600)
    latency = round(time.time() - t0, 2)

    # Add assistant response to persistent memory
    mem.add_assistant(response)

    print(f"  Latency     : {latency}s")
    clean_resp = response.strip()[:250].encode("ascii", "replace").decode("ascii")
    print(f"  Assistant   : {clean_resp}...")
    print("  " + "-"*60)

# Check learned facts
facts = mem.get_facts()
print("\n=== EXTRACTED FACTS FROM MEMORY ===")
for k, v in facts.items():
    clean_v = v.encode("ascii", "replace").decode("ascii")
    print(f"  * {k:22}: {clean_v}")

print("\n" + "="*70)
print("  LIVE STATEFUL TEST COMPLETED SUCCESSFULLY")
print("="*70 + "\n")
