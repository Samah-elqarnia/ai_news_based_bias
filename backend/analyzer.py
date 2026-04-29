"""
analyzer.py — Mistral AI API integration for bias signal generation.
"""
from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, Optional

from openai import OpenAI
from pydantic import ValidationError

from models import AssetBias, BiasReport, SIGNAL_NUMERIC

logger = logging.getLogger(__name__)

# ─────────────────────────── System Prompt ───────────────────────────────────

SYSTEM_PROMPT = """You are a financial markets analyst AI. You receive a batch of news headlines and summaries from the past hour. Your job is to analyze the collective sentiment and geopolitical/economic implications and output a structured JSON bias report for each asset class.

For each asset, return:
- "signal": "bullish" | "bearish" | "neutral"
- "confidence": 0.0 to 1.0
- "summary": 2-3 sentence explanation of WHY
- "key_headlines": array of up to 3 headline strings that drove this signal
- "risk_level": "low" | "medium" | "high"

Asset classes to always evaluate:
COMMODITIES: gold, oil_brent, oil_wti, natural_gas, wheat, copper, silver
CURRENCIES: usd_index, eur_usd, gbp_usd, usd_jpy, usd_cny, btc_usd
INDICES: sp500, nasdaq, ftse100, dax, nikkei225, shanghai_composite
SECTORS: tech, energy, defense, financials, real_estate, healthcare

Output ONLY valid JSON with this exact structure:
{
  "commodities": {
    "gold": {"signal": "...", "confidence": 0.0, "summary": "...", "key_headlines": [], "risk_level": "..."},
    ...
  },
  "currencies": { ... },
  "indices": { ... },
  "sectors": { ... }
}

No markdown, no preamble, no explanation outside the JSON."""

USER_PROMPT_TEMPLATE = """Analyze the following {count} news articles from the past hour and generate the bias report JSON:

{articles}

Remember: output ONLY valid JSON following the exact schema specified."""

# ─────────────────────────── Claude Client ───────────────────────────────────

# Expected keys in each asset group
EXPECTED_ASSETS = {
    "commodities": [
        "gold", "oil_brent", "oil_wti", "natural_gas", "wheat", "copper", "silver"
    ],
    "currencies": [
        "usd_index", "eur_usd", "gbp_usd", "usd_jpy", "usd_cny", "btc_usd"
    ],
    "indices": [
        "sp500", "nasdaq", "ftse100", "dax", "nikkei225", "shanghai_composite"
    ],
    "sectors": [
        "tech", "energy", "defense", "financials", "real_estate", "healthcare"
    ],
}

NEUTRAL_FALLBACK = AssetBias(
    signal="neutral",
    confidence=0.0,
    summary="Insufficient data to form a bias signal for this asset.",
    key_headlines=[],
    risk_level="low",
)


def _build_client() -> OpenAI:
    api_key = os.environ.get("MISTRAL_API_KEY", "")
    return OpenAI(api_key=api_key, base_url="https://api.mistral.ai/v1")


def _ensure_all_assets(report: BiasReport) -> BiasReport:
    """Fill in any missing assets with a neutral fallback."""
    for asset_class, keys in EXPECTED_ASSETS.items():
        group: Dict[str, AssetBias] = getattr(report, asset_class)
        for key in keys:
            if key not in group:
                group[key] = NEUTRAL_FALLBACK
    return report


def _parse_response(raw: str) -> Optional[BiasReport]:
    """Attempt to parse Mistral AI's response as a BiasReport."""
    try:
        # Strip potential markdown fences
        text = raw.strip()
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        data: Dict[str, Any] = json.loads(text)
        return BiasReport(**data)
    except (json.JSONDecodeError, ValidationError, Exception) as e:
        logger.error(f"Failed to parse Mistral AI response: {e}\nRaw: {raw[:400]}")
        return None


async def analyze_news_batch(formatted_articles: str, article_count: int) -> Optional[BiasReport]:
    """
    Send the news batch to Mistral AI and return a validated BiasReport.
    Returns None on failure so the caller can fall back to the previous snapshot.
    """
    api_key = os.environ.get("MISTRAL_API_KEY", "")
    if not api_key:
        logger.warning("MISTRAL_API_KEY not set — returning mock report")
        return _build_mock_report()

    client = _build_client()
    user_message = USER_PROMPT_TEMPLATE.format(
        count=article_count,
        articles=formatted_articles,
    )

    try:
        # Run synchronous Mistral AI call in default event loop executor
        import asyncio

        loop = asyncio.get_event_loop()
        response = await loop.run_in_executor(
            None,
            lambda: client.chat.completions.create(
                model="mistral-large-latest",
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": user_message}
                ],
                temperature=0.0
            ),
        )
        raw = response.choices[0].message.content
        logger.info(f"Mistral AI responded with {len(raw)} chars")
    except Exception as e:
        logger.error(f"Mistral AI API error: {e}")
        return None

    report = _parse_response(raw)
    if report is None:
        return None

    return _ensure_all_assets(report)


# ─────────────────────────── Mock Report (no API key) ────────────────────────


import random


def _signal() -> str:
    return random.choice(["bullish", "bearish", "neutral", "bullish", "bearish"])


def _risk() -> str:
    return random.choice(["low", "medium", "high"])


def _mock_asset(name: str) -> AssetBias:
    sig = _signal()
    return AssetBias(
        signal=sig,  # type: ignore
        confidence=round(random.uniform(0.45, 0.92), 2),
        summary=f"Simulated {sig} signal for {name} based on mock news data. This is placeholder content generated when no API key is present. Real data requires a valid Grok API key.",
        key_headlines=[
            f"Markets react to global uncertainty | {name.upper()} in focus",
            f"Analysts weigh in on {name} outlook amid economic shifts",
            f"Central bank policy shifts create volatility in {name}",
        ],
        risk_level=_risk(),  # type: ignore
    )


def _build_mock_report() -> BiasReport:
    return BiasReport(
        commodities={k: _mock_asset(k) for k in EXPECTED_ASSETS["commodities"]},
        currencies={k: _mock_asset(k) for k in EXPECTED_ASSETS["currencies"]},
        indices={k: _mock_asset(k) for k in EXPECTED_ASSETS["indices"]},
        sectors={k: _mock_asset(k) for k in EXPECTED_ASSETS["sectors"]},
    )
