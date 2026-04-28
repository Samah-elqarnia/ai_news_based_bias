"""
scraper.py — Async RSS/JSON news scraper with deduplication by title hash.
"""
from __future__ import annotations

import asyncio
import hashlib
import logging
from datetime import datetime, timezone
from typing import List, Optional

import feedparser
import httpx

logger = logging.getLogger(__name__)

# ─────────────────────────── Feed Registry ───────────────────────────────────

RSS_FEEDS = [
    {
        "source": "Al Jazeera",
        "url": "https://www.aljazeera.com/xml/rss/all.xml",
    },
    {
        "source": "BBC World",
        "url": "http://feeds.bbci.co.uk/news/world/rss.xml",
    },
    {
        "source": "BBC Business",
        "url": "http://feeds.bbci.co.uk/news/business/rss.xml",
    },
    {
        "source": "Reuters",
        "url": "https://feeds.reuters.com/reuters/businessNews",
    },
    {
        "source": "Reuters World",
        "url": "https://feeds.reuters.com/Reuters/worldNews",
    },
    {
        "source": "AP News",
        "url": "https://rsshub.app/apnews/topics/apf-business",
    },
    {
        "source": "CNBC Top News",
        "url": "https://www.cnbc.com/id/100003114/device/rss/rss.html",
    },
    {
        "source": "CNBC Economy",
        "url": "https://www.cnbc.com/id/20910258/device/rss/rss.html",
    },
    {
        "source": "MarketWatch",
        "url": "https://feeds.marketwatch.com/marketwatch/topstories/",
    },
    {
        "source": "Investing.com",
        "url": "https://www.investing.com/rss/news.rss",
    },
    {
        "source": "Yahoo Finance",
        "url": "https://finance.yahoo.com/news/rssindex",
    },
    {
        "source": "FT Markets",
        "url": "https://www.ft.com/markets?format=rss",
    },
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (compatible; NewsBiasBot/1.0; "
        "+https://github.com/news-bias-detector)"
    )
}

MAX_ARTICLES_TOTAL = 60
TOP_ARTICLES_FOR_AI = 40


# ─────────────────────────── Core Scraper ────────────────────────────────────


def parse_published(entry: feedparser.FeedParserDict) -> Optional[datetime]:
    """Parse the published_parsed struct from feedparser into a UTC datetime."""
    try:
        if entry.get("published_parsed"):
            import time

            ts = time.mktime(entry.published_parsed)
            return datetime.fromtimestamp(ts, tz=timezone.utc).replace(tzinfo=None)
    except Exception:
        pass
    return datetime.utcnow()


def title_hash(title: str) -> str:
    return hashlib.md5(title.lower().strip().encode()).hexdigest()


async def fetch_feed(
    client: httpx.AsyncClient, source: str, url: str
) -> List[dict]:
    """Fetch and parse a single RSS feed. Returns list of article dicts."""
    articles: List[dict] = []
    try:
        resp = await client.get(url, timeout=12.0, headers=HEADERS, follow_redirects=True)
        resp.raise_for_status()
        feed = feedparser.parse(resp.text)
        for entry in feed.entries[:25]:
            title = (entry.get("title") or "").strip()
            if not title:
                continue
            summary = (
                entry.get("summary")
                or entry.get("description")
                or entry.get("content", [{}])[0].get("value", "")
                or ""
            )
            # Strip HTML tags from summary with a simple approach
            import re
            summary = re.sub(r"<[^>]+>", " ", summary).strip()
            summary = " ".join(summary.split())[:500]

            articles.append(
                {
                    "title": title,
                    "summary": summary,
                    "source": source,
                    "url": entry.get("link", ""),
                    "published": parse_published(entry),
                    "hash": title_hash(title),
                }
            )
        logger.info(f"[{source}] fetched {len(articles)} articles")
    except Exception as e:
        logger.warning(f"[{source}] feed error: {e}")
    return articles


async def scrape_all_feeds() -> List[dict]:
    """
    Fetch all RSS feeds in parallel, deduplicate by title hash,
    sort by recency, and return the top MAX_ARTICLES_TOTAL articles.
    """
    async with httpx.AsyncClient() as client:
        tasks = [
            fetch_feed(client, feed["source"], feed["url"]) for feed in RSS_FEEDS
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    seen_hashes: set[str] = set()
    combined: List[dict] = []

    for result in results:
        if isinstance(result, Exception):
            logger.error(f"Feed gather error: {result}")
            continue
        for article in result:
            h = article["hash"]
            if h not in seen_hashes:
                seen_hashes.add(h)
                combined.append(article)

    # Sort by published date descending (most recent first)
    combined.sort(key=lambda a: a["published"] or datetime.min, reverse=True)

    logger.info(
        f"Scraper: {len(combined)} unique articles from {len(RSS_FEEDS)} feeds"
    )
    return combined[:MAX_ARTICLES_TOTAL]


def format_articles_for_ai(articles: List[dict]) -> str:
    """
    Format deduplicated articles into a clean text batch for sending to Claude.
    Picks top TOP_ARTICLES_FOR_AI articles.
    """
    batch = articles[:TOP_ARTICLES_FOR_AI]
    lines = []
    for i, art in enumerate(batch, 1):
        lines.append(f"[{i}] SOURCE: {art['source']}")
        lines.append(f"    HEADLINE: {art['title']}")
        if art["summary"]:
            lines.append(f"    SUMMARY: {art['summary'][:300]}")
        lines.append("")
    return "\n".join(lines)
