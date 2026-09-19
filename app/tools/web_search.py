"""
app/tools/web_search.py
-----------------------
Fast, resilient web search utility with DuckDuckGo (ddgs) and fallback scraping.
Provides real-time search grounding for news, current events, and documentation.
"""

from __future__ import annotations

import re
from typing import Any

try:
    from ddgs import DDGS
except ImportError:
    DDGS = None  # type: ignore


def search_web(query: str, max_results: int = 4) -> list[dict[str, str]]:
    """
    Searches the live web and returns a list of dictionaries with title, href, and body.
    Zero API key required; executes in < 2 seconds with automatic fallback.
    """
    if not query or not query.strip():
        return []

    clean_query = re.sub(r'[\r\n\t]+', ' ', query).strip()

    # 1. Primary: Use ddgs package (news vs text)
    if DDGS is not None:
        try:
            results: list[dict[str, str]] = []
            is_news_query = any(k in clean_query.lower() for k in ("news", "today", "breaking", "latest"))
            with DDGS() as ddgs:
                raw_hits = []
                if is_news_query:
                    try:
                        raw_hits = list(ddgs.news(clean_query, max_results=max_results))
                    except Exception:
                        raw_hits = []

                if not raw_hits:
                    raw_hits = list(ddgs.text(clean_query, max_results=max_results))

                for hit in raw_hits:
                    title = str(hit.get("title", "")).strip()
                    href = str(hit.get("url") or hit.get("href") or "").strip()
                    body = str(hit.get("body") or hit.get("snippet") or "").strip()
                    date_str = str(hit.get("date", "")).strip()
                    if date_str:
                        body = f"[{date_str}] {body}"
                    if title or body:
                        results.append({
                            "title": title,
                            "href": href,
                            "snippet": body,
                        })
            if results:
                return results
        except Exception as e:
            print(f"[WEB_SEARCH] ddgs primary search warning: {e}")

    # 2. Fallback: DuckDuckGo HTML Lite scraping
    try:
        import requests
        from bs4 import BeautifulSoup

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
        resp = requests.get(
            "https://html.duckduckgo.com/html/",
            params={"q": clean_query},
            headers=headers,
            timeout=8,
        )
        if resp.status_code == 200:
            soup = BeautifulSoup(resp.text, "html.parser")
            results = []
            for r in soup.select(".result")[:max_results]:
                title_elem = r.select_one(".result__title a")
                snippet_elem = r.select_one(".result__snippet")
                if title_elem:
                    title = title_elem.get_text(strip=True)
                    href = title_elem.get("href", "")
                    snippet = snippet_elem.get_text(strip=True) if snippet_elem else ""
                    results.append({
                        "title": title,
                        "href": href,
                        "snippet": snippet,
                    })
            if results:
                return results
    except Exception as e:
        print(f"[WEB_SEARCH] DuckDuckGo HTML fallback warning: {e}")

    return []


def format_search_context(search_results: list[dict[str, str]]) -> str:
    """Formats search results into a clean markdown context block for LLM prompts."""
    if not search_results:
        return ""

    lines = ["\n### Live Web Search Grounding Context:"]
    for i, res in enumerate(search_results, 1):
        title = res.get("title", f"Source {i}")
        href = res.get("href", "")
        snippet = res.get("snippet", "")
        lines.append(f"{i}. **[{title}]({href})**\n   {snippet}")

    lines.append("\nUse the above live web results to answer the user's question accurately with up-to-date information and citations.\n")
    return "\n".join(lines)
