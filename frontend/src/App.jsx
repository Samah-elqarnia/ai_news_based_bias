import { useState, useEffect, useCallback, useRef } from 'react'
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts'
import {
  TrendingUp, TrendingDown, Minus, Activity, RefreshCw, Wifi, WifiOff,
  ChevronDown, ChevronUp, Clock, BarChart2, Globe, Zap, AlertTriangle,
} from 'lucide-react'
import { MOCK_DATA, MOCK_HISTORY } from './mockData'

// ─── Constants ────────────────────────────────────────────────────────────────

const API_BASE = '/api'
const POLL_INTERVAL_MS = 60_000

const TABS = [
  { key: 'commodities', label: 'Commodities', icon: '' },
  { key: 'currencies',  label: 'Currencies',  icon: '' },
  { key: 'indices',     label: 'Indices',      icon: '' },
  { key: 'sectors',     label: 'Sectors',      icon: '' },
]

const ASSET_LABELS = {
  gold: 'Gold', oil_brent: 'Brent Crude', oil_wti: 'WTI Crude',
  natural_gas: 'Natural Gas', wheat: 'Wheat', copper: 'Copper', silver: 'Silver',
  usd_index: 'USD Index', eur_usd: 'EUR/USD', gbp_usd: 'GBP/USD',
  usd_jpy: 'USD/JPY', usd_cny: 'USD/CNY', btc_usd: 'BTC/USD',
  sp500: 'S&P 500', nasdaq: 'NASDAQ', ftse100: 'FTSE 100',
  dax: 'DAX', nikkei225: 'Nikkei 225', shanghai_composite: 'Shanghai Comp.',
  tech: 'Technology', energy: 'Energy', defense: 'Defense',
  financials: 'Financials', real_estate: 'Real Estate', healthcare: 'Healthcare',
}

const ASSET_EMOJI = {
  usd_index: '🇺🇸', eur_usd: '🇪🇺', gbp_usd: '🇬🇧',
  usd_jpy: '🇯🇵', usd_cny: '🇨🇳', btc_usd: '₿'
}

// ─── Utility helpers ──────────────────────────────────────────────────────────

const fmtTime = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

const fmtDate = (iso) => {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}

const isStale = (iso) => {
  if (!iso) return true
  return Date.now() - new Date(iso).getTime() > 90 * 60 * 1000
}

const signalColor = (s) =>
  s === 'bullish' ? 'text-accent-green' : s === 'bearish' ? 'text-accent-red' : 'text-text-secondary'

const signalChartColor = (v) =>
  v > 0 ? '#00d4aa' : v < 0 ? '#ff4d6d' : '#8b91a8'

// ─── Sub-components ───────────────────────────────────────────────────────────

function SignalBadge({ signal }) {
  const cfg = {
    bullish: { cls: 'badge-bullish', icon: <TrendingUp size={11} />, label: 'Bullish' },
    bearish: { cls: 'badge-bearish', icon: <TrendingDown size={11} />, label: 'Bearish' },
    neutral: { cls: 'badge-neutral', icon: <Minus size={11} />, label: 'Neutral' },
  }
  const { cls, icon, label } = cfg[signal] || cfg.neutral
  return (
    <span className={cls}>
      {icon}
      {label}
    </span>
  )
}

function RiskBadge({ level }) {
  const colors = {
    low:    'text-accent-green bg-green-950/40 border-green-900/40',
    medium: 'text-accent-yellow bg-yellow-950/40 border-yellow-900/40',
    high:   'text-accent-red bg-red-950/40 border-red-900/40',
  }
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium border ${colors[level] || colors.low}`}>
      <AlertTriangle size={10} />
      {level}
    </span>
  )
}

function ConfidenceBar({ value, signal }) {
  const color = signal === 'bullish' ? '#00d4aa' : signal === 'bearish' ? '#ff4d6d' : '#8b91a8'
  const pct = Math.round((value || 0) * 100)
  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-text-muted font-medium">Confidence</span>
        <span className="text-xs font-mono font-semibold" style={{ color }}>{pct}%</span>
      </div>
      <div className="confidence-bar-track">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color, boxShadow: `0 0 8px ${color}60` }}
        />
      </div>
    </div>
  )
}

function MiniSparkline({ data, assetKey }) {
  if (!data || data.length < 2) {
    return <div className="h-16 flex items-center justify-center text-xs text-text-muted">No history</div>
  }
  const chartData = data.map((d) => ({ t: fmtTime(d.timestamp), v: d.signal_numeric }))
  const lastVal = chartData[chartData.length - 1]?.v ?? 0

  return (
    <div className="h-16 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, left: -32, bottom: 0 }}>
          <XAxis dataKey="t" hide />
          <YAxis domain={[-1.2, 1.2]} hide />
          <ReferenceLine y={0} stroke="#1f2333" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{
              background: '#16181f', border: '1px solid #1f2333',
              borderRadius: '6px', fontSize: '11px', color: '#e8eaf0',
            }}
            formatter={(v) => [v > 0 ? 'Bullish' : v < 0 ? 'Bearish' : 'Neutral', '']}
            labelFormatter={(l) => `${l}`}
          />
          <Line
            type="monotone"
            dataKey="v"
            stroke={signalChartColor(lastVal)}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, fill: signalChartColor(lastVal) }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

function HeadlineChips({ headlines }) {
  const [open, setOpen] = useState(false)
  if (!headlines || headlines.length === 0) return null
  return (
    <div>
      <button
        onClick={() => setOpen((p) => !p)}
        className="flex items-center gap-1.5 text-xs text-text-secondary hover:text-text-primary transition-colors mt-2"
      >
        {open ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        {headlines.length} key headline{headlines.length !== 1 ? 's' : ''}
      </button>
      {open && (
        <ul className="mt-2 space-y-1.5 animate-fade-in">
          {headlines.map((h, i) => (
            <li
              key={i}
              className="flex items-start gap-2 px-2.5 py-1.5 rounded-lg text-xs text-text-secondary leading-relaxed"
              style={{ background: 'rgba(255,255,255,0.04)', borderLeft: '2px solid #1f2333' }}
            >
              <span className="text-text-muted shrink-0 font-mono mt-0.5">{i + 1}.</span>
              {h}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function AssetCard({ assetKey, bias, historyData }) {
  const label = ASSET_LABELS[assetKey] || assetKey
  const emoji = ASSET_EMOJI[assetKey] || ''
  const glowClass = bias.signal === 'bullish' ? 'hover:glow-green' : bias.signal === 'bearish' ? 'hover:glow-red' : ''

  return (
    <div className={`card-hover p-4 flex flex-col gap-3 animate-slide-up ${glowClass} transition-all duration-300`}>
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="text-lg leading-none shrink-0">{emoji}</span>
          <div className="min-w-0">
            <div className="text-sm font-semibold text-text-primary truncate">{label}</div>
            <div className="text-xs text-text-muted font-mono uppercase tracking-wide">{assetKey}</div>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <SignalBadge signal={bias.signal} />
          <RiskBadge level={bias.risk_level} />
        </div>
      </div>

      {/* Confidence bar */}
      <ConfidenceBar value={bias.confidence} signal={bias.signal} />

      {/* Summary */}
      <p className="text-xs text-text-secondary leading-relaxed line-clamp-3">
        {bias.summary}
      </p>

      {/* Sparkline */}
      <div>
        <div className="text-xs text-text-muted mb-1 flex items-center gap-1">
          <BarChart2 size={10} /> 24h signal
        </div>
        <MiniSparkline data={historyData} assetKey={assetKey} />
      </div>

      {/* Collapsible headlines */}
      <HeadlineChips headlines={bias.key_headlines} />
    </div>
  )
}

function NewsFeedSidebar({ articles }) {
  const sourceColors = {
    Reuters: '#ff8800', 'BBC World': '#bb1919', 'BBC Business': '#bb1919',
    'Al Jazeera': '#c0872a', CNBC: '#0053cf', MarketWatch: '#0c9b50',
    'AP News': '#c00', 'FT Markets': '#fff1e0', 'Yahoo Finance': '#7b0099',
    'Investing.com': '#e0401b', 'Investing.com Economy': '#e0401b',
  }
  const getColor = (src) => sourceColors[src] || '#3b82f6'

  const sortedArticles = [...articles].reverse()

  return (
    <aside className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-bg-border sticky top-0 bg-bg-secondary z-10">
        <Globe size={14} className="text-accent-blue" />
        <span className="text-sm font-semibold text-text-primary">Live News Feed</span>
        <span className="ml-auto text-xs text-text-muted font-mono">{articles.length}</span>
      </div>
      <div className="flex-1 overflow-y-auto scroll-smooth scrollbar-thin scrollbar-thumb-bg-border scrollbar-track-transparent">
        {sortedArticles.map((art, i) => (
          <div
            key={i}
            className="px-4 py-3 border-b border-bg-border hover:bg-bg-hover transition-colors cursor-pointer group"
          >
            <div className="flex items-center gap-2 mb-1.5">
              <span
                className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: getColor(art.source) }}
              />
              <span className="text-xs font-medium" style={{ color: getColor(art.source) }}>
                {art.source}
              </span>
              <span className="ml-auto text-xs text-text-muted font-mono shrink-0">
                {fmtTime(art.published)}
              </span>
            </div>
            <p className="text-xs text-text-secondary leading-relaxed group-hover:text-text-primary transition-colors line-clamp-2">
              {art.title}
            </p>
          </div>
        ))}
      </div>
    </aside>
  )
}

function StatsBar({ data, isMock }) {
  const allAssets = [
    ...Object.values(data.commodities || {}),
    ...Object.values(data.currencies || {}),
    ...Object.values(data.indices || {}),
    ...Object.values(data.sectors || {}),
  ]
  const bullish = allAssets.filter((a) => a.signal === 'bullish').length
  const bearish = allAssets.filter((a) => a.signal === 'bearish').length
  const neutral = allAssets.filter((a) => a.signal === 'neutral').length
  const avgConf = allAssets.length
    ? (allAssets.reduce((s, a) => s + a.confidence, 0) / allAssets.length * 100).toFixed(0)
    : 0

  return (
    <div className="grid grid-cols-4 gap-3 mb-5">
      {[
        { label: 'Bullish', value: bullish, color: 'text-accent-green', bg: 'bg-green-950/30', icon: <TrendingUp size={14} /> },
        { label: 'Bearish', value: bearish, color: 'text-accent-red',   bg: 'bg-red-950/30',   icon: <TrendingDown size={14} /> },
        { label: 'Neutral', value: neutral, color: 'text-text-secondary',bg: 'bg-bg-card',      icon: <Minus size={14} /> },
        { label: 'Avg Conf', value: `${avgConf}%`, color: 'text-accent-blue', bg: 'bg-blue-950/30', icon: <Activity size={14} /> },
      ].map(({ label, value, color, bg, icon }) => (
        <div key={label} className={`card ${bg} px-4 py-3 flex flex-col gap-1`}>
          <div className={`flex items-center gap-1.5 text-xs ${color} font-medium`}>
            {icon} {label}
          </div>
          <div className={`text-2xl font-bold font-mono ${color}`}>{value}</div>
        </div>
      ))}
    </div>
  )
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const [activeTab, setActiveTab] = useState('commodities')
  const [data, setData] = useState(null)
  const [history, setHistory] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [isMock, setIsMock] = useState(false)
  const [lastPoll, setLastPoll] = useState(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const intervalRef = useRef(null)

  const fetchData = useCallback(async (showRefresh = false) => {
    if (showRefresh) setIsRefreshing(true)
    try {
      const [latestRes, histRes] = await Promise.all([
        fetch(`${API_BASE}/latest`),
        fetch(`${API_BASE}/history?hours=24`),
      ])
      if (!latestRes.ok) throw new Error(`API ${latestRes.status}`)
      const latestJson = await latestRes.json()
      const histJson   = histRes.ok ? await histRes.json() : MOCK_HISTORY

      // Merge with localStorage cache
      localStorage.setItem('nbd_latest', JSON.stringify(latestJson))
      localStorage.setItem('nbd_history', JSON.stringify(histJson))
      setData(latestJson)
      setHistory(histJson)
      setIsMock(false)
      setError(null)
    } catch (err) {
      // Try localStorage cache
      const cached = localStorage.getItem('nbd_latest')
      const cachedHist = localStorage.getItem('nbd_history')
      if (cached) {
        setData(JSON.parse(cached))
        setHistory(cachedHist ? JSON.parse(cachedHist) : MOCK_HISTORY)
        setError('Using cached data — backend unreachable')
        setIsMock(false)
      } else {
        setData(MOCK_DATA)
        setHistory(MOCK_HISTORY)
        setIsMock(true)
        setError('Backend unavailable — showing demo data')
      }
    } finally {
      setLoading(false)
      setIsRefreshing(false)
      setLastPoll(new Date().toISOString())
    }
  }, [])

  // Initial load + polling
  useEffect(() => {
    fetchData()
    intervalRef.current = setInterval(() => fetchData(false), POLL_INTERVAL_MS)
    return () => clearInterval(intervalRef.current)
  }, [fetchData])

  // Build history lookup: asset_key → history[]
  const historyMap = {}
  if (history?.assets) {
    history.assets.forEach((a) => { historyMap[a.asset_key] = a.history })
  }

  const currentGroup = data?.[activeTab] || {}

  // ── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4" style={{ background: '#0a0b0e' }}>
        <div className="relative">
          <div className="w-16 h-16 rounded-full border-2 border-bg-border" />
          <div className="absolute inset-0 w-16 h-16 rounded-full border-t-2 border-accent-green animate-spin" />
        </div>
        <div className="text-text-secondary text-sm font-medium animate-pulse">
          Initialising AI pipeline…
        </div>
      </div>
    )
  }

  const stale = isStale(data?.timestamp)

  return (
    <div className="relative z-10 min-h-screen flex flex-col" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 border-b border-bg-border backdrop-blur-xl"
        style={{ background: 'rgba(10,11,14,0.92)' }}>
        <div className="max-w-[1800px] mx-auto px-4 py-3 flex items-center gap-4 flex-wrap">
          {/* Brand */}
          <div className="flex items-center gap-3 mr-4">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm"
              style={{ background: 'linear-gradient(135deg,#00d4aa22,#3b82f622)', border: '1px solid #00d4aa33' }}>
              <Zap size={16} className="text-accent-green" />
            </div>
            <div>
              <div className="text-sm font-bold text-text-primary leading-none">News Bias generator</div>
              <div className="text-xs text-text-muted leading-none mt-0.5">AI based Financial Intelligence</div>
            </div>
          </div>

          {/* Status bar */}
          <div className="flex items-center gap-3 flex-1 flex-wrap">
            {/* Live/Stale indicator */}
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-medium ${
              stale || isMock
                ? 'border-accent-red/30 bg-red-950/20 text-accent-red'
                : 'border-accent-green/30 bg-green-950/20 text-accent-green'
            }`}>
              {stale || isMock
                ? <WifiOff size={11} />
                : <span className="live-dot w-2 h-2 rounded-full bg-accent-green inline-block" />
              }
              {stale || isMock ? (isMock ? 'Demo Mode' : 'Stale') : 'Live'}
            </div>

            {/* Last update */}
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <Clock size={11} />
              Updated {fmtDate(data?.timestamp)}
            </div>

            {/* Next poll */}
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <RefreshCw size={11} />
              Polls every 60 min 
            </div>

            {/* Error banner */}
            {error && (
              <span className="px-2.5 py-1 rounded-md text-xs font-medium border border-accent-yellow/30 bg-yellow-950/20 text-accent-yellow">
                ⚠ {error}
              </span>
            )}
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen((p) => !p)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary border border-bg-border hover:border-bg-hover hover:text-text-primary transition-all"
            >
              {sidebarOpen ? 'Hide Feed' : 'Show Feed'}
            </button>
            <button
              onClick={() => fetchData(true)}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all"
              style={{
                background: 'rgba(0,212,170,0.08)',
                borderColor: 'rgba(0,212,170,0.3)',
                color: '#00d4aa',
              }}
            >
              <RefreshCw size={11} className={isRefreshing ? 'animate-spin' : ''} />
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div className="flex flex-1 max-w-[1800px] w-full mx-auto divide-x divide-bg-border">

        {/* ── Main content ── */}
        <main className="flex-1 min-w-0 px-5 py-5">
          {/* Stats bar */}
          {data && <StatsBar data={data} isMock={isMock} />}

          {/* Tabs */}
          <div className="flex gap-0 border-b border-bg-border mb-5">
            {TABS.map((tab) => {
              const active = activeTab === tab.key
              const group = data?.[tab.key] || {}
              const bullCount = Object.values(group).filter((a) => a.signal === 'bullish').length
              const bearCount = Object.values(group).filter((a) => a.signal === 'bearish').length
              return (
                <button
                  key={tab.key}
                  id={`tab-${tab.key}`}
                  onClick={() => setActiveTab(tab.key)}
                  className={`relative flex items-center gap-2 px-5 py-3 text-sm font-semibold transition-all ${
                    active ? 'tab-active' : 'tab-inactive'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                  {/* mini signal pills */}
                  <span className="flex items-center gap-1 ml-1">
                    {bullCount > 0 && (
                      <span className="text-xs font-mono text-accent-green">{bullCount}↑</span>
                    )}
                    {bearCount > 0 && (
                      <span className="text-xs font-mono text-accent-red">{bearCount}↓</span>
                    )}
                  </span>
                </button>
              )
            })}
          </div>

          {/* Asset grid */}
          <div className="grid-assets">
            {Object.entries(currentGroup).map(([key, bias]) => (
              <AssetCard
                key={key}
                assetKey={key}
                bias={bias}
                historyData={historyMap[key] || []}
              />
            ))}
            {Object.keys(currentGroup).length === 0 && (
              <div className="col-span-full py-20 text-center text-text-muted">
                <Activity size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">No data for this category yet.</p>
              </div>
            )}
          </div>

          {/* 24h overview sparkline row */}
          {history?.assets && (
            <div className="mt-8">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 size={14} className="text-accent-blue" />
                <span className="text-sm font-semibold text-text-primary">24-Hour Signal Overview</span>
                <span className="text-xs text-text-muted">— {activeTab}</span>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {history.assets
                  .filter((a) => a.asset_class === activeTab)
                  .map((a) => {
                    const lastP = a.history[a.history.length - 1]
                    const sig = lastP?.signal || 'neutral'
                    return (
                      <div key={a.asset_key} className="card p-3">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-xs font-semibold text-text-primary">
                            {ASSET_EMOJI[a.asset_key]} {ASSET_LABELS[a.asset_key] || a.asset_key}
                          </span>
                          <SignalBadge signal={sig} />
                        </div>
                        <MiniSparkline data={a.history} assetKey={a.asset_key} />
                      </div>
                    )
                  })}
              </div>
            </div>
          )}
        </main>

        {/* ── News sidebar ── */}
        {sidebarOpen && (
          <aside
            className="w-72 xl:w-80 shrink-0 flex flex-col bg-bg-secondary overflow-hidden"
            style={{ maxHeight: 'calc(100vh - 57px)', position: 'sticky', top: '57px', alignSelf: 'flex-start' }}
          >
            <NewsFeedSidebar articles={data?.news_feed || []} />
          </aside>
        )}
      </div>

      {/* ── Footer ── */}
      <footer className="border-t border-bg-border py-3 px-5 text-center text-xs text-text-muted">
         Data updates every hour ·{' '}
        {isMock ? (
          <span className="text-accent-yellow">Demo mode — connect a backend for live signals</span>
        ) : (
          <span className="text-accent-green">✓ Live data</span>
        )}
      </footer>
    </div>
  )
}
