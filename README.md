# News Bias Detector

> AI-powered financial news bias dashboard — bullish/bearish signals for commodities, currencies, indices, and sectors based on geopolitical and sentiment view .

## What It Does

The News Bias generator is an AI-driven web application that analyzes financial news articles in real-time to generate market sentiment signals. It scrapes news from major financial sources (Reuters, BBC, CNBC, etc.), processes the content with Mistral AI, and provides bullish/bearish/neutral signals for various asset classes including:

- **Commodities**: Gold, Oil (Brent & WTI), Natural Gas, Wheat, Copper, Silver
- **Currencies**: USD Index, EUR/USD, GBP/USD, USD/JPY, USD/CNY, BTC/USD
- **Indices**: S&P 500, NASDAQ, FTSE 100, DAX, Nikkei 225, Shanghai Composite
- **Sectors**: Technology, Energy, Defense, Financials, Real Estate, Healthcare

The system runs hourly pipelines to fetch fresh news, analyze sentiment, and update the dashboard with confidence scores and key headlines driving each signal.

## Tech Stack

### Backend
- **Python 3.13** with FastAPI
- **Mistral AI** for LLM-powered sentiment analysis
- **SQLAlchemy** with SQLite for data persistence
- **APScheduler** for automated hourly pipelines
- **httpx** and **feedparser** for news scraping
- **Pydantic** for data validation

### Frontend
- **React 18** with Vite
- **Tailwind CSS** for styling
- **Recharts** for data visualization
- **Lucide React** for icons

### Infrastructure
- **Docker & Docker Compose** for containerization
- **Nginx** for frontend serving 

## Features

- **Real-time Updates**: Hourly automated news scraping and analysis
- **AI-Powered Analysis**: Mistral AI generates accurate market signals with confidence scores
- **Interactive Dashboard**: Modern UI with sparklines, confidence bars, and signal badges
- **Live News Feed**: Scrollable news feed with source attribution and timestamps
- **Historical Data**: 24-hour signal history with trend visualization
- **Docker Ready**: One-command deployment with docker-compose
- **Fast API**: RESTful endpoints with automatic documentation

## Quick Start — Docker

```bash
# 1. Clone the repository
git clone <repository-url>
cd news_bias_detector

# 2. Copy and fill in your Mistral AI API key
cp backend/.env.example backend/.env
# Edit backend/.env and add: MISTRAL_API_KEY=your_api_key_here

# 3. Start everything
docker-compose up --build
```

- **Dashboard:** http://localhost:3000
- **API docs:** http://localhost:8000/docs
- **Health check:** http://localhost:8000/api/health

---

## Local Development

### Prerequisites
- Python 3.13+
- Node.js 18+
- Docker (optional)

### Backend Setup

```bash
cd backend

# Create virtual environment
python -m venv .venv
.venv\Scripts\activate        # Windows
# source .venv/bin/activate   # Linux/Mac

# Install dependencies
pip install -r requirements.txt

# Copy environment file and add your API key
cp .env.example .env
# Edit .env and add: MISTRAL_API_KEY=your_mistral_api_key

# Start FastAPI server (auto-runs pipeline on startup)
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

Open http://localhost:5173 for the frontend (Vite dev server).

## API Endpoints

- `GET /api/health` - Health check
- `GET /api/latest` - Latest bias signals and news feed
- `GET /api/history?hours=24` - Historical signal data
- `GET /api/news-feed?limit=50` - Recent news articles
- `POST /api/trigger` - Manually trigger analysis pipeline
- `GET /api/stats` - Database statistics

## Configuration

### Environment Variables

Create `backend/.env` with:

```env
# Mistral AI API Key (required)
MISTRAL_API_KEY=your_api_key_here

# Scraping interval in minutes (default: 60)
SCRAPE_INTERVAL_MINUTES=60

# Database URL (SQLite for dev, PostgreSQL for prod)
DATABASE_URL=sqlite:///./bias_detector.db
```

### Getting a Mistral AI API Key

1. Visit [Mistral AI Console](https://console.mistral.ai/)
2. Create an account and generate an API key
3. Add the key to your `.env` file as `MISTRAL_API_KEY`

## Architecture

The system consists of:

1. **News Scraper**: Fetches RSS feeds from financial news sources
2. **AI Analyzer**: Uses Mistral AI to analyze news sentiment and generate signals
3. **Database**: Stores historical signals and news articles
4. **API**: FastAPI backend serving data to the frontend
5. **Dashboard**: React frontend displaying signals and news

The hourly pipeline:
1. Scrapes news from RSS feeds
2. Deduplicates articles by title hash
3. Sends batch to Mistral AI for analysis
4. Stores results in database
5. Updates dashboard in real-time


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
