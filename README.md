# News Bias Detector

> AI-powered financial news bias dashboard — real-time bullish/bearish signals for commodities, currencies, indices, and sectors.

## Architecture
![alt text](<Capture d’écran 2026-04-27 192722.png>)

## Quick Start — Docker 

```bash
# 1. Copy and fill in your Anthropic API key
cp backend/.env.example backend/.env

# 2. Start everything
docker-compose up --build
```

- **Dashboard:** http://localhost:3000  
- **API docs:** http://localhost:8000/docs  
- **Health:** http://localhost:8000/api/health

---

## Local Development

### Backend

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac

# Install deps
pip install -r requirements.txt

# Copy env and add your API key
copy .env.example .env

# Start FastAPI server (auto-runs pipeline on startup)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend

```bash
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

> The Vite dev server proxies `/api/*` to `http://localhost:8000`.  
> If the backend is unreachable, the dashboard automatically shows realistic demo data.

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/latest` | Latest bias snapshot for all assets + news feed |
| `GET` | `/api/history?hours=24` | Historical snapshots (max 168h) |
| `GET` | `/api/news-feed?limit=50` | Recently ingested articles |
| `GET` | `/api/stats` | DB stats + next scheduler run |
| `POST` | `/api/trigger` | Manually fire the pipeline |
| `GET` | `/api/health` | Health check |
| `GET` | `/docs` | Swagger UI |

### `/api/latest` response shape

```json
{
  "timestamp": "2024-01-15T14:00:00",
  "commodities": {
    "gold": {
      "signal": "bullish",
      "confidence": 0.82,
      "summary": "Gold surging on safe-haven demand...",
      "key_headlines": ["Fed signals rate pause...", "..."],
      "risk_level": "medium"
    }
  },
  "currencies": { ... },
  "indices": { ... },
  "sectors": { ... },
  "news_feed": [
    { "title": "...", "source": "Reuters", "published": "..." }
  ]
}
```

---

## Configuration

| Variable | Default | Description |
|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | — | **Required** for live AI signals |
| `SCRAPE_INTERVAL_MINUTES` | `60` | How often to scrape (minutes) |
| `DATABASE_URL` | `sqlite:///./bias_detector.db` | DB connection string |

---

## News Sources

| Source | Feed |
|--------|------|
| Al Jazeera | `aljazeera.com/xml/rss/all.xml` |
| BBC World | `feeds.bbci.co.uk/news/world/rss.xml` |
| BBC Business | `feeds.bbci.co.uk/news/business/rss.xml` |
| Reuters Business | `feeds.reuters.com/reuters/businessNews` |
| Reuters World | `feeds.reuters.com/Reuters/worldNews` |
| AP News | Via RSSHub |
| CNBC Top News | `cnbc.com/id/100003114/device/rss/rss.html` |
| CNBC Economy | `cnbc.com/id/20910258/device/rss/rss.html` |
| MarketWatch | `feeds.marketwatch.com/marketwatch/topstories/` |
| Yahoo Finance | `finance.yahoo.com/news/rssindex` |

---


## Project Structure

```
news_bias_detector/
├── backend/
│   ├── main.py          # FastAPI app + APScheduler
│   ├── models.py        # Pydantic schemas + SQLAlchemy ORM
│   ├── scraper.py       # Async RSS scraper (12 feeds)
│   ├── analyzer.py      # Claude API integration
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── App.jsx      # Full dashboard UI
│   │   ├── mockData.js  # Demo data fallback
│   │   ├── index.css    # Dark finance theme
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── nginx.conf
│   └── Dockerfile
└── docker-compose.yml
```
