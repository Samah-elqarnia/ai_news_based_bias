"""
models.py — Pydantic schemas + SQLAlchemy ORM for News Bias Detector
"""
from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime
from typing import Any, Dict, List, Literal, Optional

from dotenv import load_dotenv
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import Column, DateTime, Float, Integer, String, Text, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

load_dotenv()  # pick up .env for DATABASE_URL

# ─────────────────────────── Database Setup ──────────────────────────────────

DATABASE_URL = os.environ.get("DATABASE_URL", "sqlite:///./bias_detector.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False},
    echo=False,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    pass


# ─────────────────────────── ORM Models ──────────────────────────────────────


class BiasSnapshotORM(Base):
    __tablename__ = "bias_snapshots"

    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow, index=True)
    asset_class = Column(String(64), index=True)   # commodities | currencies | indices | sectors
    asset_key = Column(String(64), index=True)     # e.g. "gold", "sp500"
    signal = Column(String(16))                    # bullish | bearish | neutral
    confidence = Column(Float)
    risk_level = Column(String(16))
    summary = Column(Text)
    key_headlines = Column(Text)                   # JSON array
    signal_numeric = Column(Integer)               # 1 | 0 | -1


class NewsFeedORM(Base):
    __tablename__ = "news_feed"

    id = Column(Integer, primary_key=True, index=True)
    title_hash = Column(String(64), unique=True, index=True)
    title = Column(Text)
    summary = Column(Text)
    source = Column(String(128))
    url = Column(Text)
    published = Column(DateTime)
    ingested_at = Column(DateTime, default=datetime.utcnow)


def create_tables():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# ─────────────────────────── Pydantic Schemas ────────────────────────────────

SignalType = Literal["bullish", "bearish", "neutral"]
RiskType = Literal["low", "medium", "high"]


class AssetBias(BaseModel):
    signal: SignalType
    confidence: float = Field(ge=0.0, le=1.0)
    summary: str
    key_headlines: List[str] = Field(default_factory=list)
    risk_level: RiskType

    @field_validator("key_headlines")
    @classmethod
    def truncate_headlines(cls, v: List[str]) -> List[str]:
        return v[:3]

    @field_validator("confidence")
    @classmethod
    def clamp_confidence(cls, v: float) -> float:
        return round(max(0.0, min(1.0, v)), 3)


class BiasReport(BaseModel):
    commodities: Dict[str, AssetBias]
    currencies: Dict[str, AssetBias]
    indices: Dict[str, AssetBias]
    sectors: Dict[str, AssetBias]

    @field_validator("commodities", "currencies", "indices", "sectors", mode="before")
    @classmethod
    def ensure_dict(cls, v: Any) -> Dict:
        if not isinstance(v, dict):
            return {}
        return v


class NewsArticle(BaseModel):
    title: str
    summary: str
    source: str
    url: str = ""
    published: Optional[datetime] = None

    @property
    def title_hash(self) -> str:
        return hashlib.md5(self.title.lower().strip().encode()).hexdigest()


class SnapshotResponse(BaseModel):
    id: int
    timestamp: datetime
    asset_class: str
    asset_key: str
    signal: str
    confidence: float
    risk_level: str
    summary: str
    key_headlines: List[str]
    signal_numeric: int

    model_config = {"from_attributes": True}

    @field_validator("key_headlines", mode="before")
    @classmethod
    def parse_headlines(cls, v: Any) -> List[str]:
        if isinstance(v, str):
            try:
                return json.loads(v)
            except Exception:
                return []
        return v or []


class LatestResponse(BaseModel):
    timestamp: datetime
    commodities: Dict[str, AssetBias]
    currencies: Dict[str, AssetBias]
    indices: Dict[str, AssetBias]
    sectors: Dict[str, AssetBias]
    news_feed: List[Dict[str, Any]] = Field(default_factory=list)


class HistoryPoint(BaseModel):
    timestamp: datetime
    signal_numeric: int
    signal: str
    confidence: float


class AssetHistoryResponse(BaseModel):
    asset_key: str
    asset_class: str
    history: List[HistoryPoint]


SIGNAL_NUMERIC = {"bullish": 1, "neutral": 0, "bearish": -1}
