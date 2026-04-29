"""
main.py — FastAPI application with APScheduler hourly pipeline.
Run: uvicorn main:app --reload --host 0.0.0.0 --port 8000
"""
from __future__ import annotations

# Load .env before anything else reads os.environ
from dotenv import load_dotenv
load_dotenv()

import json
import logging
import os
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from analyzer import analyze_news_batch, _build_mock_report
from models import (
    SIGNAL_NUMERIC,
    AssetBias,
    BiasReport,
    BiasSnapshotORM,
    LatestResponse,
    NewsFeedORM,
    NewsArticle,
    SnapshotResponse,
    AssetHistoryResponse,
    HistoryPoint,
    create_tables,
    get_db,
)
from scraper import format_articles_for_ai, scrape_all_feeds

# ─────────────────────────── Logging ─────────────────────────────────────────

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ─────────────────────────── App Setup ───────────────────────────────────────

app = FastAPI(
    title="News Bias Detector API",
    description="Hourly AI-powered financial news bias signals",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

scheduler = AsyncIOScheduler()

# ─────────────────────────── Pipeline ────────────────────────────────────────


async def scrape_and_analyze():
    """Core hourly pipeline: scrape → deduplicate → AI analysis → store."""
    logger.info("=== Pipeline START ===")
    db: Session = next(get_db())

    try:
        # 1. Scrape all feeds
        articles = await scrape_all_feeds()
        logger.info(f"Scraped {len(articles)} unique articles")

        # 2. Store new articles in DB (skip existing hashes)
        for art in articles:
            exists = db.query(NewsFeedORM).filter_by(title_hash=art["hash"]).first()
            if not exists:
                db.add(
                    NewsFeedORM(
                        title_hash=art["hash"],
                        title=art["title"],
                        summary=art["summary"],
                        source=art["source"],
                        url=art["url"],
                        published=art["published"],
                    )
                )
        db.commit()

        # 3. Format for AI
        formatted = format_articles_for_ai(articles)

        # 4. Call Mistral AI
        report: Optional[BiasReport] = await analyze_news_batch(formatted, len(articles))

        if report is None:
            logger.warning("AI analysis failed — using mock report")
            report = _build_mock_report()

        # 5. Store snapshot rows
        ts = datetime.utcnow()
        _store_report(db, report, ts)

        logger.info("=== Pipeline DONE ===")

    except Exception as e:
        logger.error(f"Pipeline error: {e}", exc_info=True)
        db.rollback()
    finally:
        db.close()


def _store_report(db: Session, report: BiasReport, ts: datetime):
    """Write all AssetBias entries from a BiasReport into bias_snapshots."""
    groups = {
        "commodities": report.commodities,
        "currencies": report.currencies,
        "indices": report.indices,
        "sectors": report.sectors,
    }
    for asset_class, assets in groups.items():
        for asset_key, bias in assets.items():
            db.add(
                BiasSnapshotORM(
                    timestamp=ts,
                    asset_class=asset_class,
                    asset_key=asset_key,
                    signal=bias.signal,
                    confidence=bias.confidence,
                    risk_level=bias.risk_level,
                    summary=bias.summary,
                    key_headlines=json.dumps(bias.key_headlines),
                    signal_numeric=SIGNAL_NUMERIC.get(bias.signal, 0),
                )
            )
    db.commit()
    logger.info(f"Stored snapshot @ {ts.isoformat()}")


# ─────────────────────────── Lifecycle ───────────────────────────────────────


@app.on_event("startup")
async def startup():
    create_tables()
    logger.info("Database tables created/verified")

    # Run pipeline immediately on start if DB is empty
    db: Session = next(get_db())
    count = db.query(BiasSnapshotORM).count()
    db.close()

    if count == 0:
        logger.info("Empty DB — running initial pipeline")
        await scrape_and_analyze()

    # Schedule hourly runs
    interval_minutes = int(os.environ.get("SCRAPE_INTERVAL_MINUTES", "60"))
    scheduler.add_job(
        scrape_and_analyze,
        trigger=IntervalTrigger(minutes=interval_minutes),
        id="scrape_and_analyze",
        replace_existing=True,
    )
    scheduler.start()
    logger.info(f"Scheduler started — interval: {interval_minutes}m")


@app.on_event("shutdown")
async def shutdown():
    scheduler.shutdown(wait=False)


# ─────────────────────────── Helper: latest snapshot ─────────────────────────


def _get_latest_ts(db: Session) -> Optional[datetime]:
    """Return the most recent snapshot timestamp."""
    row = (
        db.query(BiasSnapshotORM.timestamp)
        .order_by(BiasSnapshotORM.timestamp.desc())
        .first()
    )
    return row[0] if row else None


def _build_asset_bias(row: BiasSnapshotORM) -> AssetBias:
    headlines = []
    try:
        headlines = json.loads(row.key_headlines or "[]")
    except Exception:
        pass
    return AssetBias(
        signal=row.signal,  # type: ignore
        confidence=row.confidence,
        summary=row.summary,
        key_headlines=headlines,
        risk_level=row.risk_level,  # type: ignore
    )


# ─────────────────────────── API Endpoints ───────────────────────────────────


@app.get("/api/health")
def health():
    return {"status": "ok", "time": datetime.utcnow().isoformat()}


@app.get("/api/latest", response_model=LatestResponse)
def get_latest(db: Session = Depends(get_db)):
    """Return the most recent bias snapshot for all assets + recent news feed."""
    ts = _get_latest_ts(db)
    if ts is None:
        raise HTTPException(status_code=503, detail="No data yet — pipeline hasn't run")

    rows = db.query(BiasSnapshotORM).filter(BiasSnapshotORM.timestamp == ts).all()

    groups: Dict[str, Dict[str, AssetBias]] = {
        "commodities": {},
        "currencies": {},
        "indices": {},
        "sectors": {},
    }
    for row in rows:
        if row.asset_class in groups:
            groups[row.asset_class][row.asset_key] = _build_asset_bias(row)

    # Recent news feed (last 50 articles)
    feed_rows = (
        db.query(NewsFeedORM)
        .order_by(NewsFeedORM.ingested_at.desc())
        .limit(50)
        .all()
    )
    news_feed = [
        {
            "title": r.title,
            "source": r.source,
            "url": r.url,
            "published": r.published.isoformat() if r.published else None,
        }
        for r in feed_rows
    ]

    return LatestResponse(
        timestamp=ts,
        commodities=groups["commodities"],
        currencies=groups["currencies"],
        indices=groups["indices"],
        sectors=groups["sectors"],
        news_feed=news_feed,
    )


@app.get("/api/history")
def get_history(
    hours: int = Query(default=24, ge=1, le=168),
    asset_class: Optional[str] = Query(default=None),
    asset_key: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
):
    """
    Return hourly bias history.
    Query params:
      - hours: how many hours back (default 24, max 168 / 1 week)
      - asset_class: filter by asset class (commodities|currencies|indices|sectors)
      - asset_key: filter by specific asset (e.g. gold, sp500)
    """
    since = datetime.utcnow() - timedelta(hours=hours)
    q = db.query(BiasSnapshotORM).filter(BiasSnapshotORM.timestamp >= since)

    if asset_class:
        q = q.filter(BiasSnapshotORM.asset_class == asset_class)
    if asset_key:
        q = q.filter(BiasSnapshotORM.asset_key == asset_key)

    rows = q.order_by(BiasSnapshotORM.timestamp.asc()).all()

    # Group by asset_key
    grouped: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        key = f"{row.asset_class}::{row.asset_key}"
        if key not in grouped:
            grouped[key] = {
                "asset_key": row.asset_key,
                "asset_class": row.asset_class,
                "history": [],
            }
        grouped[key]["history"].append(
            {
                "timestamp": row.timestamp.isoformat(),
                "signal_numeric": row.signal_numeric,
                "signal": row.signal,
                "confidence": row.confidence,
            }
        )

    return {"hours": hours, "assets": list(grouped.values())}


@app.get("/api/news-feed")
def get_news_feed(
    limit: int = Query(default=50, ge=1, le=200),
    db: Session = Depends(get_db),
):
    """Return the most recently ingested news articles."""
    rows = (
        db.query(NewsFeedORM)
        .order_by(NewsFeedORM.ingested_at.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": r.id,
            "title": r.title,
            "summary": r.summary,
            "source": r.source,
            "url": r.url,
            "published": r.published.isoformat() if r.published else None,
            "ingested_at": r.ingested_at.isoformat() if r.ingested_at else None,
        }
        for r in rows
    ]


@app.post("/api/trigger", status_code=202)
async def trigger_pipeline():
    """Manually trigger the scrape-and-analyze pipeline (for testing)."""
    import asyncio
    asyncio.create_task(scrape_and_analyze())
    return {"status": "pipeline triggered", "time": datetime.utcnow().isoformat()}


@app.get("/api/stats")
def get_stats(db: Session = Depends(get_db)):
    """Return basic DB statistics."""
    snapshot_count = db.query(BiasSnapshotORM).count()
    article_count = db.query(NewsFeedORM).count()
    latest_ts = _get_latest_ts(db)
    next_run = None
    job = scheduler.get_job("scrape_and_analyze")
    if job and job.next_run_time:
        next_run = job.next_run_time.isoformat()

    return {
        "snapshot_count": snapshot_count,
        "article_count": article_count,
        "latest_snapshot": latest_ts.isoformat() if latest_ts else None,
        "next_scheduled_run": next_run,
    }
