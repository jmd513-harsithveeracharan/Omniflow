"""
tests/test_streaming.py
-----------------------
Tests for real-time token streaming and multi-provider fallback.
"""

from unittest.mock import MagicMock, patch
from app.domain.llm.streaming_router import chat_stream, stream_claude_cli, stream_gemini, stream_groq
from app.chat_service import process_chat_turn_stream


def test_stream_gemini_mocked():
    messages = [{"role": "user", "content": "Ping"}]
    mock_resp = MagicMock()
    mock_resp.iter_lines.return_value = [
        b'data: {"candidates": [{"content": {"parts": [{"text": "Hello"}]}}]}',
        b'data: {"candidates": [{"content": {"parts": [{"text": " World"}]}}]}',
    ]
    with patch("app.domain.llm.streaming_router._SESSION.post", return_value=mock_resp), \
         patch("app.domain.llm.streaming_router.GEMINI_KEY", "mock_key"):
        chunks = list(stream_gemini(messages, "gemini-3.6-flash"))
        assert chunks == ["Hello", " World"]


def test_stream_groq_mocked():
    messages = [{"role": "user", "content": "Ping"}]
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.iter_lines.return_value = [
        b'data: {"choices": [{"delta": {"content": "Fabric"}}]}',
        b'data: {"choices": [{"delta": {"content": " AI"}}]}',
        b'data: [DONE]',
    ]
    with patch("app.domain.llm.streaming_router._SESSION.post", return_value=mock_resp), \
         patch("app.domain.llm.streaming_router.GROQ_KEYS", ["mock_groq_key"]):
        chunks = list(stream_groq(messages, "openai/gpt-oss-20b"))
        assert chunks == ["Fabric", " AI"]


def test_chat_stream_waterfall():
    messages = [{"role": "user", "content": "Hello"}]
    mock_resp = MagicMock()
    mock_resp.iter_lines.return_value = [
        b'data: {"candidates": [{"content": {"parts": [{"text": "Streamed response"}]}}]}',
    ]
    with patch("app.domain.llm.streaming_router._get_claude_cli_binary", return_value=None), \
         patch("app.domain.llm.streaming_router.GEMINI_KEY", "mock_gemini_key"), \
         patch("app.domain.llm.streaming_router._SESSION.post", return_value=mock_resp), \
         patch("app.domain.llm.streaming_router.record_token_usage"):
        chunks = list(chat_stream(messages, target_model="gemini-3.6-flash"))
        assert "".join(chunks) == "Streamed response"


def test_process_chat_turn_stream_conversational():
    prompt = "What is OneLake?"
    mock_resp = MagicMock()
    mock_resp.iter_lines.return_value = [
        b'data: {"candidates": [{"content": {"parts": [{"text": "OneLake is a unified data lake."}]}}]}',
    ]
    with patch("app.domain.llm.streaming_router._get_claude_cli_binary", return_value=None), \
         patch("app.domain.llm.streaming_router.GEMINI_KEY", "mock_gemini_key"), \
         patch("app.domain.llm.streaming_router._SESSION.post", return_value=mock_resp), \
         patch("app.domain.llm.streaming_router.record_token_usage"):
        events = list(process_chat_turn_stream(prompt, session_id="test-session-stream"))
        types = [e[0] for e in events]
        assert "chunk" in types
        assert "done" in types
