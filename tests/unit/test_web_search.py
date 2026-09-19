"""
tests/unit/test_web_search.py
-----------------------------
Unit tests for web search utility and context formatter.
"""

from unittest.mock import MagicMock, patch
from app.tools.web_search import format_search_context, search_web


def test_format_search_context_empty():
    assert format_search_context([]) == ""


def test_format_search_context_valid():
    results = [
        {"title": "Fabric Docs", "href": "https://fabric.microsoft.com", "snippet": "Enterprise lakehouse."},
        {"title": "Delta Lake", "href": "https://delta.io", "snippet": "ACID transactions for Spark."},
    ]
    formatted = format_search_context(results)
    assert "Live Web Search Grounding Context" in formatted
    assert "[Fabric Docs](https://fabric.microsoft.com)" in formatted
    assert "Enterprise lakehouse." in formatted
    assert "[Delta Lake](https://delta.io)" in formatted


@patch("app.tools.web_search.DDGS")
def test_search_web_mocked(mock_ddgs_class):
    mock_instance = MagicMock()
    mock_instance.text.return_value = [
        {"title": "Tech News", "href": "https://technews.org", "body": "New AI models released."}
    ]
    mock_ddgs_class.return_value.__enter__.return_value = mock_instance

    results = search_web("AI updates")
    assert len(results) == 1
    assert results[0]["title"] == "Tech News"
    assert results[0]["href"] == "https://technews.org"
    assert results[0]["snippet"] == "New AI models released."

