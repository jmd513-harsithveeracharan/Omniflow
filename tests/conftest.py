"""
tests/conftest.py
-----------------
Pytest configuration and shared fixtures for Fabric AI Studio.
"""

import os
import pytest
from google import genai


@pytest.fixture(scope="session")
def client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY", "AQ.Ab8RN6K8bRkSDftGsNm7fEduQSeHerB17lJk_fwfpgEDjvBoNg")
    return genai.Client(api_key=api_key)
