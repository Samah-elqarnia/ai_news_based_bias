// mockData.js — Realistic fallback data used when the backend is unavailable.
// Encoded: bullish=1, neutral=0, bearish=-1

const genHistory = (baseSignal, hours = 24) => {
  const now = Date.now()
  return Array.from({ length: hours }, (_, i) => {
    const jitter = Math.random() > 0.7 ? (Math.random() > 0.5 ? 1 : -1) : 0
    const clamp = (v) => Math.max(-1, Math.min(1, v))
    const sv = clamp(baseSignal + jitter)
    return {
      timestamp: new Date(now - (hours - i) * 3600000).toISOString(),
      signal_numeric: sv,
      signal: sv > 0 ? 'bullish' : sv < 0 ? 'bearish' : 'neutral',
      confidence: +(0.5 + Math.random() * 0.4).toFixed(2),
    }
  })
}

const asset = (signal, confidence, summary, headlines, risk) => ({
  signal,
  confidence,
  summary,
  key_headlines: headlines,
  risk_level: risk,
})

export const MOCK_DATA = {
  timestamp: new Date().toISOString(),
  commodities: {
    gold: asset('bullish', 0.82, 'Gold surging on safe-haven demand as geopolitical tensions escalate in the Middle East and Eastern Europe. Central bank gold purchases remain at multi-decade highs.', ['Fed signals rate pause — gold jumps 1.2%', 'Middle East tensions drive safe-haven flows', 'Central banks buy record gold in Q3'], 'medium'),
    oil_brent: asset('bearish', 0.71, 'Brent crude under pressure as OPEC+ compliance weakens and US inventory builds exceed expectations. Demand concerns from China compound selling pressure.', ['OPEC+ compliance slips amid production disputes', 'US crude inventories rise unexpectedly', 'China manufacturing PMI disappoints, dampens demand outlook'], 'high'),
    oil_wti: asset('bearish', 0.68, 'WTI tracking Brent lower on soft demand signals from major economies. Strong dollar adds additional headwinds for commodity prices broadly.', ['WTI falls below $75 as demand fears intensify', 'Dollar strength weighs on energy complex', 'Gulf Coast refiners cut run rates on thin margins'], 'high'),
    natural_gas: asset('neutral', 0.51, 'Natural gas balanced between mild weather reducing heating demand and LNG export facility outages constraining supply. Range-bound trading expected.', ['Mild temperatures cut gas demand forecasts', 'LNG export terminal maintenance weighs on prices'], 'low'),
    wheat: asset('bullish', 0.65, 'Wheat rallying on Black Sea export disruptions and drought conditions in key producing regions. Food security concerns elevate risk premium.', ['Black Sea shipping disruptions threaten wheat exports', 'Drought in US Plains reduces winter wheat outlook', 'UN warns of food security risk in import-dependent nations'], 'medium'),
    copper: asset('neutral', 0.44, 'Copper mixed amid conflicting signals — Chinese stimulus hopes are offset by global manufacturing slowdown. Inventories at LME warehouses ticking higher.', ['China unveils new infrastructure stimulus package', 'Global manufacturing PMIs signal contraction'], 'medium'),
    silver: asset('bullish', 0.60, 'Silver following gold higher with additional support from industrial demand in solar panel manufacturing. Gold/silver ratio starting to compress.', ['Solar demand boosts silver industrial outlook', 'Silver outperforms gold as ratio compresses', 'Precious metals rally on Fed rate pause bets'], 'medium'),
  },
  currencies: {
    usd_index: asset('bearish', 0.73, 'Dollar index weakening as Fed rate cut expectations firm up following softer CPI data. Multiple Fed officials signal openness to cutting rates in coming months.', ['CPI print below forecast — dollar slides', 'Fed speakers signal rate cuts coming in H1', 'US trade deficit widens unexpectedly'], 'medium'),
    eur_usd: asset('bullish', 0.67, 'EUR/USD advancing as ECB rhetoric remains hawkish relative to the Fed. Eurozone economic data beating expectations and reducing recession fears.', ['ECB holds rates, signals data-dependent stance', 'Eurozone Q3 GDP beats expectations', 'Euro zone inflation stickier than expected — ECB hawks emerge'], 'medium'),
    gbp_usd: asset('bullish', 0.59, 'Sterling supported by stronger UK labour market data and Bank of England hawkish pivot. Brexit trade frictions easing at the margin.', ['UK unemployment falls to 4.0%, wages surge', 'BoE signals higher-for-longer rate stance', 'UK-EU trade talks progress on financial services'], 'medium'),
    usd_jpy: asset('bearish', 0.78, 'USD/JPY dropping sharply as BoJ moves towards policy normalisation. Intervention speculation intensifies near key resistance levels above 150.', ['BoJ Governor signals end of negative rates approaching', 'Japan MoF warns FX intervention remains option', 'USD/JPY breaks below 148 on BoJ speculation'], 'high'),
    usd_cny: asset('neutral', 0.50, 'Chinese yuan rangebound as PBoC uses fixing mechanism to manage volatility. Capital outflows offset by strong trade surplus.', ["PBoC sets yuan fixing stronger than expected", 'China trade surplus widens on export strength'], 'low'),
    btc_usd: asset('bullish', 0.76, 'Bitcoin surging on spot ETF inflows and halving anticipation. Institutional demand accelerating with BlackRock ETF setting daily inflow records.', ['Bitcoin ETF sees record $500M daily inflows', 'Halving countdown drives retail FOMO', 'MicroStrategy adds 15,000 BTC to treasury'], 'high'),
  },
  indices: {
    sp500: asset('neutral', 0.55, 'S&P 500 consolidating near all-time highs as mixed earnings season creates cross-currents. Tech sector strength offsets weakness in small-caps and regional banks.', ['Q3 earnings season 68% beat rate — in line with history', 'Regional bank stress resurfaces on CRE concerns', 'Magnificent 7 lift index while breadth narrows'], 'medium'),
    nasdaq: asset('bullish', 0.71, 'Nasdaq leading gains as AI infrastructure spending continues to accelerate. Semiconductor stocks at the heart of the rally with strong forward guidance.', ['NVIDIA beats by 20%, raises guidance again', 'AI infrastructure spend to reach $500B by 2026', 'Big Tech buybacks provide floor under valuations'], 'medium'),
    ftse100: asset('neutral', 0.48, 'FTSE 100 range-bound as commodity sector headwinds offset banking strength. Sterling appreciation also creates headwind for the internationally-exposed index.', ['UK FTSE held back by energy and mining drags', 'UK bank profits surge on higher net interest margins'], 'low'),
    dax: asset('bullish', 0.58, 'DAX outperforming on improved German industrial output data and ECB stability. Auto sector recovery and China reopening optimism supporting cyclicals.', ['German factory orders rebound stronger than forecast', 'DAX hits record high on ECB pause and China demand hopes', 'BMW and Mercedes raise full-year guidance'], 'medium'),
    nikkei225: asset('bullish', 0.74, 'Nikkei surging on yen weakness boosting exporter earnings and ongoing corporate governance reforms driving buybacks. Foreign inflows at multi-decade highs.', ['Nikkei breaks 40,000 for first time since 1990', 'Warren Buffett raises Japan trading house stakes', 'Tokyo Exchange corporate reform drive boosts valuations'], 'medium'),
    shanghai_composite: asset('bearish', 0.62, 'Shanghai Composite under pressure as property sector stress continues to drag on broader sentiment. Deflation concerns limit policy upside from stimulus measures.', ['Evergrande liquidation ordered by HK court', 'China CPI falls into negative territory again', 'Foreign investors pull record funds from China equities'], 'high'),
  },
  sectors: {
    tech: asset('bullish', 0.80, 'Tech sector in strong bull mode with AI capex cycle accelerating. Semiconductor supply chain normalising while software margins expanding on AI efficiency tools.', ['AI capex cycle entering next phase — Goldman Sachs', 'Software companies cite AI for 300bps margin expansion', 'Semiconductors lead market with record bookings'], 'medium'),
    energy: asset('bearish', 0.65, 'Energy sector under pressure from oil price weakness and increasing renewable energy competition. ESG fund flows continuining to rotate away from fossil fuels.', ['Oil majors cut capex as crude falls below $75', 'Renewable energy capacity additions break records', 'ESG mandates force pension fund energy underweights'], 'medium'),
    defense: asset('bullish', 0.85, 'Defense sector at cycle highs driven by NATO spending commitments and Middle East conflict escalation. Order backlogs hitting multi-decade highs across major contractors.', ['NATO members raise defense spending targets to 2.5% GDP', 'Lockheed Martin backlog surpasses $160B', 'Ukraine conflict drives European defense procurement surge'], 'high'),
    financials: asset('neutral', 0.52, 'Financials mixed — large bank net interest income benefiting from higher rates while credit quality concerns emerge in consumer and commercial real estate portfolios.', ['JPMorgan beats on NII but raises credit loss provisions', 'Commercial real estate defaults rising — regional banks at risk', 'Fintech competition begins eroding bank deposit franchises'], 'medium'),
    real_estate: asset('bearish', 0.70, 'REITs under pressure as higher-for-longer rates increase cap rates and refinancing costs. Office vacancy rates at post-COVID highs in major metro areas.', ['Office REIT vacancies hit 20% in major US cities', 'REIT refinancing wall approaching — $200B due in 2025', 'Higher cap rates compress commercial property valuations'], 'high'),
    healthcare: asset('neutral', 0.57, 'Healthcare sector balanced between GLP-1 drug euphoria in pharma and regulatory pricing pressure. Biotech showing signs of life on renewed M&A activity.', ['Ozempic maker Novo Nordisk becomes Europe\'s largest company', 'US drug pricing reform bill clears Senate committee', 'Big Pharma M&A wave targets GLP-1 pipeline assets'], 'medium'),
  },
  news_feed: [
    { title: 'Federal Reserve signals rate pause as inflation cools to 3.1%', source: 'Reuters', published: new Date(Date.now() - 900000).toISOString() },
    { title: 'NVIDIA reports record quarterly revenue, raises AI infrastructure forecast', source: 'CNBC', published: new Date(Date.now() - 1800000).toISOString() },
    { title: 'Middle East tensions escalate as conflict spreads to new front', source: 'Al Jazeera', published: new Date(Date.now() - 2700000).toISOString() },
    { title: 'Bitcoin spot ETF records $500M single-day inflows — new record', source: 'MarketWatch', published: new Date(Date.now() - 3600000).toISOString() },
    { title: 'China Evergrande ordered to liquidate by Hong Kong court', source: 'BBC World', published: new Date(Date.now() - 4500000).toISOString() },
    { title: 'NATO members agree to raise defense spending targets', source: 'AP News', published: new Date(Date.now() - 5400000).toISOString() },
    { title: 'Nikkei 225 surpasses 40,000 for first time since Bubble Era', source: 'BBC Business', published: new Date(Date.now() - 6300000).toISOString() },
    { title: 'Gold surges past $2,100 on safe-haven demand and central bank buying', source: 'Reuters', published: new Date(Date.now() - 7200000).toISOString() },
    { title: 'Bank of Japan Governor signals negative rates to end by spring', source: 'Reuters', published: new Date(Date.now() - 8100000).toISOString() },
    { title: 'OPEC+ compliance dips as Iraq and Kazakhstan overproduce', source: 'Reuters', published: new Date(Date.now() - 9000000).toISOString() },
    { title: 'European Central Bank holds rates, signals data-dependent path', source: 'BBC Business', published: new Date(Date.now() - 9900000).toISOString() },
    { title: 'Black Sea grain corridor disrupted — wheat futures spike 4%', source: 'Al Jazeera', published: new Date(Date.now() - 10800000).toISOString() },
    { title: 'US commercial real estate defaults rising — regional banks flagged', source: 'CNBC', published: new Date(Date.now() - 11700000).toISOString() },
    { title: 'Germany factory orders rebound 5.2% in November', source: 'Reuters', published: new Date(Date.now() - 12600000).toISOString() },
    { title: 'Warren Buffett increases Japan trading house stakes to 9%', source: 'MarketWatch', published: new Date(Date.now() - 13500000).toISOString() },
  ],
}

export const MOCK_HISTORY = (() => {
  const assets = {
    commodities: ['gold', 'oil_brent', 'oil_wti', 'natural_gas', 'wheat', 'copper', 'silver'],
    currencies: ['usd_index', 'eur_usd', 'gbp_usd', 'usd_jpy', 'usd_cny', 'btc_usd'],
    indices: ['sp500', 'nasdaq', 'ftse100', 'dax', 'nikkei225', 'shanghai_composite'],
    sectors: ['tech', 'energy', 'defense', 'financials', 'real_estate', 'healthcare'],
  }
  const baseSignals = {
    gold: 1, oil_brent: -1, oil_wti: -1, natural_gas: 0, wheat: 1, copper: 0, silver: 1,
    usd_index: -1, eur_usd: 1, gbp_usd: 1, usd_jpy: -1, usd_cny: 0, btc_usd: 1,
    sp500: 0, nasdaq: 1, ftse100: 0, dax: 1, nikkei225: 1, shanghai_composite: -1,
    tech: 1, energy: -1, defense: 1, financials: 0, real_estate: -1, healthcare: 0,
  }
  const result = []
  Object.entries(assets).forEach(([cls, keys]) => {
    keys.forEach((key) => {
      result.push({ asset_key: key, asset_class: cls, history: genHistory(baseSignals[key] || 0) })
    })
  })
  return { hours: 24, assets: result }
})()
