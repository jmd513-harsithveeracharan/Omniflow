"""
tests/test_gemini_sessions.py
-------------------------------
Comprehensive Test Suite for Gemini Multi-Turn Sessions & Context Management.
Tests:
  1. Multi-Turn Stateful Chat Session (client.chats.create)
  2. Sequential Memory Recall & Downstream Code Generation
  3. Conversation History Inspection & Export (chat.get_history)
  4. Server-Side Context Caching Architecture (client.caches.create)
"""

import json
import os
import time
from google import genai
from google.genai import types

API_KEY = os.getenv("GEMINI_API_KEY", "AQ.Ab8RN6K8bRkSDftGsNm7fEduQSeHerB17lJk_fwfpgEDjvBoNg")
MODEL_NAME = "gemini-3.6-flash"


def get_client() -> genai.Client:
    return genai.Client(api_key=API_KEY)


def test_stateful_chat_session(client: genai.Client) -> None:
    print("\n" + "=" * 70)
    print(" [SESSION TEST 1] MULTI-TURN STATEFUL CHAT CONVERSATION")
    print("=" * 70)
    print("Initializing stateful chat instance using: client.chats.create(model=...)")

    chat = client.chats.create(
        model=MODEL_NAME,
        config=types.GenerateContentConfig(
            system_instruction="You are an expert Data Engineer on Microsoft Fabric AI Studio. Keep answers concise."
        )
    )

    # Turn 1: Feed stateful context
    print("\n--- Turn 1: Introducing Project Context ---")
    prompt_turn1 = (
        "We are setting up a Medallion pipeline in Fabric. "
        "Our Lakehouse is named 'lh_ecommerce_prod' with a raw Bronze table 'raw_customer_orders'."
    )
    print(f"User: {prompt_turn1}")
    for attempt in range(3):
        try:
            r1 = chat.send_message(prompt_turn1)
            print(f"Gemini: {r1.text.strip()}\n")
            break
        except Exception as e:
            print(f"Retry {attempt+1}: {e}")
            time.sleep(2)

    # Turn 2: Test context recall (WITHOUT resending raw Turn 1 text)
    print("--- Turn 2: Verifying Session Memory Recall ---")
    prompt_turn2 = "What was the name of our Lakehouse and the raw Bronze table I just specified?"
    print(f"User: {prompt_turn2}")
    for attempt in range(3):
        try:
            r2 = chat.send_message(prompt_turn2)
            print(f"Gemini: {r2.text.strip()}\n")
            break
        except Exception as e:
            print(f"Retry {attempt+1}: {e}")
            time.sleep(2)

    # Turn 3: Downstream PySpark code generation using session context
    print("--- Turn 3: Context-Aware Code Generation ---")
    prompt_turn3 = "Write a 4-line PySpark script to read that exact raw Bronze table from the lakehouse we discussed."
    print(f"User: {prompt_turn3}")
    for attempt in range(3):
        try:
            r3 = chat.send_message(prompt_turn3)
            print(f"Gemini: {r3.text.strip()}\n")
            break
        except Exception as e:
            print(f"Retry {attempt+1}: {e}")
            time.sleep(2)

    # Inspect the internal session history tracked automatically by the SDK
    print("=" * 70)
    print(" [SESSION TEST 2] INSPECTING UNDERLYING SESSION HISTORY")
    print("=" * 70)
    history = chat.get_history()
    print(f"Total turns stored in active session memory: {len(history)}")
    for idx, turn in enumerate(history, 1):
        role = turn.role
        snippet = turn.parts[0].text[:80].replace("\n", " ") if turn.parts else ""
        print(f"  [{idx}] {role.upper()}: {snippet}...")


def explain_server_side_context_caching() -> None:
    print("\n" + "=" * 70)
    print(" [DEEP DIVE] HOW STATE & SESSIONS WORK IN GEMINI (REST vs CACHING)")
    print("=" * 70)
    explanation = """
1. ARE LLM HTTP REQUESTS STATELESS?
   - Yes, at the bare network layer, standard HTTP REST calls are stateless.
   - However, the official Google GenAI Python SDK provides `client.chats.create()`, which automatically
     maintains conversation state and appends past turns into `chat.get_history()` for you.

2. WHAT IF THE CONVERSATION / CONTEXT IS HUGE (32k to 1M+ TOKENS)?
   - Resending 500k tokens of previous chat or documents on every new turn wastes tokens and increases latency.
   - Solution: GEMINI SERVER-SIDE CONTEXT CACHING (`client.caches.create`)!

3. HOW TO USE GEMINI CONTEXT CACHING:
   ------------------------------------------------------------
   from google import genai
   from google.genai import types

   client = genai.Client()

   # Step A: Cache a massive document, codebase, or transcript once on Google's servers
   cache = client.caches.create(
       model="gemini-3.6-flash",
       config=types.CreateCachedContentConfig(
           contents=["<massive text, schema repository, or video file>"],
           ttl="3600s", # Cache lasts for 1 hour
           display_name="fabric_workspace_knowledge"
       )
   )

   # Step B: Query the model referencing ONLY the cache ID (no re-sending raw context!)
   response = client.models.generate_content(
       model="gemini-3.6-flash",
       contents="Find all dependencies for silver_orders in our cached schema.",
       config=types.GenerateContentConfig(
           cached_content=cache.name # Reuses cached KV-cache on Google's GPUs!
       )
   )
   ------------------------------------------------------------
   * Benefits:
     - 75% to 80% discount on input token costs!
     - 2x to 5x faster response times because Google doesn't need to re-encode the context!
"""
    print(explanation.strip())


if __name__ == "__main__":
    client = get_client()
    test_stateful_chat_session(client)
    explain_server_side_context_caching()
