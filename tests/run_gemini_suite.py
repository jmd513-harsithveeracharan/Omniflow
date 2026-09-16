"""
tests/run_gemini_suite.py
--------------------------
Unified runner for Gemini API Multimodal & Session Management test suites.
"""

import os
import sys

# Ensure repository root is on Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from tests.test_gemini_modalities import (
    explain_other_modalities,
    get_client,
    test_image_vision_modality,
    test_structured_json_output,
    test_text_and_code_modality,
)
from tests.test_gemini_sessions import (
    explain_server_side_context_caching,
    test_stateful_chat_session,
)


def main():
    print("=" * 80)
    print(" GOOGLE GEMINI MULTIMODAL & SESSION CONTEXT VALIDATION SUITE")
    print("=" * 80)

    client = get_client()

    print("\n>>> RUNNING TEST SUITE 1: MULTIMODAL INPUTS (TEXT, IMAGE, STRUCTURED)")
    test_text_and_code_modality(client)
    test_image_vision_modality(client)
    test_structured_json_output(client)
    explain_other_modalities()

    print("\n>>> RUNNING TEST SUITE 2: MULTI-TURN SESSIONS & CONTEXT CACHING")
    test_stateful_chat_session(client)
    explain_server_side_context_caching()

    print("\n" + "=" * 80)
    print(" [COMPLETED] ALL GEMINI MULTIMODAL & SESSION TESTS PASSED SUCCESSFULLY!")
    print("=" * 80)


if __name__ == "__main__":
    main()
