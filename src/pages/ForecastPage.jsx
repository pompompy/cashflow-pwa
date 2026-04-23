// src/pages/ForecastPage.jsx
import { useState, useEffect, useMemo } from 'react'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, ReferenceDot
} from 'recharts'
import { getActiveProspective, getSetting, setSetting } from '../db/index'
import {
  today, addDays, formatCurrency, formatDateShort, formatDate, getMonthLabel
} from '../utils/dateUtils'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, ArrowDownCircle, Settings2 } from 'lucide-react'

// ── Build dense chart data ─────────────────────────────────────────────────
function buildChartData(seed, prospective, days) {
  const todayStr = today()
  const endDate  = addDays(todayStr, days)

  const changeMap = {}
  for (const tx of prospective) {
    if (tx.date > todayStr && tx.date <= endDate) {
      changeMap[tx.date] = (changeMap[tx.date] || 0) + tx.amount
    }
  }

  const data = []
  let balance = seed
  let d = todayStr

  while (d <= endDate) {
    const hadChange = changeMap[d] !== undefined
    if (hadChange) balance += changeMap[d]
    if (d === todayStr || d === endDate || hadChange) {
      data.push({ date: d, balance: Math.round(balance * 100) / 100 })
    }
    d = addDays(d, 1)
  }
  return data
}

// ── Custom tooltip ─────────────────────────────────────────────────────────
const CustomTooltip = ({ active, payload }) => {
  if (!active || !payload?.length) return null
  const { date, balance } = payload[0].payload
  return (
    <div className="bg-white border border-slate-200 rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="text-slate-500 text-xs">{formatDate(date)}</p>
      <p className={`font-mono font-semibold ${balance >= 0 ? 'text-navy-800' : 'text-red-600'}`}>
        {formatCurrency(balance)}
      </p>
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────
export default function ForecastPage() {
  const [prospective,   setProspective]   = useState([])
  const [seedBalance,   setSeedBalance]   = useState(0)
  const [forecastDays,  setForecastDays]  = useState(90)
  const [horizon,       setHorizon]       = useState(90)
  const [cushion,       setCushion]       = useState(500)      // minimum safe balance
  const [showCushion,   setShowCushion]   = useState(false)

  useEffect(() => {
    async function load() {
      const [pros, seed, fd, cush] = await Promise.all([
        getActiveProspective(),
        getSetting('seedBalance', '0'),
        getSetting('forecastDays', '90'),
        getSetting('cushionAmount', '500'),
      ])
      setProspective(pros)
      setSeedBalance(parseFloat(seed) || 0)
      setForecastDays(parseInt(fd) || 90)
      setHorizon(parseInt(fd) || 90)
      setCushion(parseFloat(cush) || 500)
    }
    load()
  }, [])

  async function saveCushion(val) {
    const n = Math.max(0, parseFloat(val) || 0)
    setCushion(n)
    await setSetting('cushionAmount', String(n))
  }

  const chartData = useMemo(
    () => buildChartData(seedBalance, prospective, horizon),
    [seedBalance, prospective, horizon]
  )

  // ── Analytics ─────────────────────────────────────────────────────────────
  const analytics = useMemo(() => {
    if (!chartData.length) return { min: seedBalance, minDate: null, transferNeeded: 0, dips: [] }

    let min = Infinity, minDate = null
    for (const pt of chartData) {
      if (pt.balance < min) { min = pt.balance; minDate = pt.date }
    }

    // Transfer needed = amount required so the minimum never drops below cushion
    const transferNeeded = Math.max(0, cushion - min)

    // Find all dip-below-cushion windows
    const dips = []
    let inDip = false, dipStart = null
    for (const pt of chartData) {
      if (pt.balance < cushion && !inDip) { inDip = true; dipStart = pt.date }
      if (pt.balance >= cushion && inDip)  { inDip = false; dips.push({ start: dipStart, end: pt.date, low: min }) }
    }
    if (inDip) dips.push({ start: dipStart, end: null, low: min })

    return { min, minDate, transferNeeded, dips }
  }, [chartData, cushion, seedBalance])

  const milestones = useMemo(() => {
    const ms = [30, 60, 90].filter(d => d <= horizon + 5)
    return ms.map(d => {
      const targetDate = addDays(today(), d)
      const pt = chartData.reduce((prev, cur) =>
        Math.abs(cur.date.localeCompare(targetDate)) < Math.abs(prev.date.localeCompare(targetDate)) ? cur : prev,
        chartData[0] || { balance: seedBalance }
      )
      return { days: d, balance: pt?.balance ?? seedBalance }
    })
  }, [chartData, horizon, seedBalance])

  const upcomingByMonth = useMemo(() => {
    const todayStr = today()
    const endDate  = addDays(todayStr, horizon)
    const sorted   = prospective
      .filter(t => t.date > todayStr && t.date <= endDate)
      .sort((a, b) => a.date.localeCompare(b.date))

    // Add running balance to each
    let running = seedBalance
    const withBal = sorted.map(tx => {
      running += tx.amount
      return { ...tx, projectedBalance: running }
    })

    const groups = {}
    for (const tx of withBal) {
      const month = getMonthLabel(tx.date)
      if (!groups[month]) groups[month] = []
      groups[month].push(tx)
    }
    return Object.entries(groups)
  }, [prospective, horizon, seedBalance])

  const minBalance  = chartData.length ? Math.min(...chartData.map(d => d.balance)) : seedBalance
  const maxBalance  = chartData.length ? Math.max(...chartData.map(d => d.balance)) : seedBalance
  const hasShortfall = analytics.transferNeeded > 0
  const yDomain = [
    Math.min(0, minBalance - Math.abs(minBalance * 0.08), cushion - Math.abs(cushion * 0.1)),
    Math.max(maxBalance * 1.05, cushion * 1.1),
  ]
  const fillColor   = hasShortfall ? '#ef4444' : '#1e6dac'
  const strokeColor = hasShortfall ? '#dc2626' : '#124174'

  return (
    <div className="max-w-3xl mx-auto px-4 py-5 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-serif text-2xl text-navy-900">Cash Flow Forecast</h1>
          <p className="text-slate-400 text-sm mt-0.5">Projected balance based on scheduled transactions</p>
        </div>
        <button onClick={() => setShowCushion(s => !s)}
          className={`p-2 rounded-lg transition-colors ${showCushion ? 'bg-navy-100 text-navy-700' : 'text-slate-400 hover:bg-slate-100'}`}
          title="Cushion settings"
        >
          <Settings2 size={18} />
        </button>
      </div>

      {/* Cushion configurator */}
      {showCushion && (
        <div className="card p-4 space-y-2">
          <p className="text-sm font-medium text-navy-900">Safety cushion amount</p>
          <p className="text-xs text-slate-400">
            The minimum balance you want to keep in checking at all times.
            The transfer calculator uses this to tell you exactly how much to move from savings.
          </p>
          <div className="flex gap-2 items-center">
            <span className="text-slate-400 text-sm">$</span>
            <input
              className="input font-mono w-36"
              type="number"
              min="0"
              step="100"
              value={cushion}
              onChange={e => saveCushion(e.target.value)}
            />
            <div className="flex gap-1.5">
              {[0, 250, 500, 1000, 2000].map(v => (
                <button key={v} onClick={() => saveCushion(v)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                    cushion === v ? 'bg-navy-700 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                  }`}>
                  ${v >= 1000 ? v/1000+'k' : v}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Horizon selector */}
      <div className="flex gap-2">
        {[30, 60, 90].map(d => (
          <button key={d} onClick={() => setHorizon(d)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              horizon === d ? 'bg-navy-800 text-white' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
            }`}
          >
            {d}d
          </button>
        ))}
      </div>

      {/* ── Transfer from savings calculator ────────────────── */}
      {hasShortfall && (
        <div className="card border-amber-200 bg-amber-50 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <ArrowDownCircle size={22} className="text-amber-500 shrink-0 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-amber-900 text-sm">Savings transfer recommended</p>
              <p className="text-amber-700 text-xs mt-0.5">
                Balance dips to <span className="font-mono font-bold">{formatCurrency(analytics.min)}</span> on{' '}
                {formatDate(analytics.minDate)} — below your ${cushion.toLocaleString()} cushion.
              </p>
            </div>
          </div>

          <div className="bg-white rounded-xl p-3 flex items-center justify-between">
            <div>
              <p className="text-xs text-slate-500">Transfer needed from savings</p>
              <p className="font-mono text-2xl font-bold text-amber-700 mt-0.5">
                {formatCurrency(analytics.transferNeeded)}
              </p>
            </div>
            <div className="text-right text-xs text-slate-400 space-y-0.5">
              <p>Before <span className="font-medium text-slate-600">{formatDateShort(analytics.minDate)}</span></p>
              <p>Keeps min at <span className="font-mono font-medium text-slate-600">{formatCurrency(cushion)}</span></p>
            </div>
          </div>

          {analytics.dips.length > 1 && (
            <p className="text-xs text-amber-600">
              {analytics.dips.length} separate shortfall windows in this period.
            </p>
          )}
        </div>
      )}

      {/* All-clear */}
      {!hasShortfall && chartData.length > 1 && (
        <div className="card border-emerald-100 bg-emerald-50 px-4 py-3 flex items-center gap-3">
          <TrendingUp size={18} className="text-emerald-500 shrink-0" />
          <p className="text-sm text-emerald-700">
            Balance stays above your ${cushion.toLocaleString()} cushion throughout this period.
            No transfer needed.
          </p>
        </div>
      )}

      {/* Milestone cards */}
      <div className="grid grid-cols-3 gap-3">
        {milestones.map(({ days, balance }) => {
          const delta = balance - seedBalance
          const Icon  = delta > 0 ? TrendingUp : delta < 0 ? TrendingDown : Minus
          const color = delta > 0 ? 'text-emerald-600' : delta < 0 ? 'text-red-500' : 'text-slate-400'
          return (
            <div key={days} className={`card px-3 py-3 ${balance < cushion ? 'border-amber-200' : ''}`}>
              <p className="text-xs text-slate-400 font-medium">{days} days</p>
              <p className={`font-mono font-semibold text-base mt-0.5 ${balance < 0 ? 'text-red-600' : balance < cushion ? 'text-amber-600' : 'text-navy-900'}`}>
                {formatCurrency(balance)}
              </p>
              <div className={`flex items-center gap-1 mt-1 text-xs ${color}`}>
                <Icon size={12} />
                <span>{delta >= 0 ? '+' : ''}{formatCurrency(delta)}</span>
              </div>
            </div>
          )
        })}
      </div>

      {/* Chart */}
      <div className="card p-4">
        {chartData.length < 2 ? (
          <p className="text-slate-400 text-sm text-center py-10">
            Add upcoming transactions to see the forecast chart.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={chartData} margin={{ top: 8, right: 4, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={fillColor} stopOpacity={0.18} />
                  <stop offset="95%" stopColor={fillColor} stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={d => formatDateShort(d)} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#94a3b8' }}
                tickFormatter={v => v >= 1000 || v <= -1000 ? `$${Math.round(v/1000)}k` : `$${v}`}
                domain={yDomain} width={48} />
              <Tooltip content={<CustomTooltip />} />
              {/* Zero line */}
              <ReferenceLine y={0} stroke="#e2e8f0" strokeWidth={1} />
              {/* Cushion line */}
              {cushion > 0 && (
                <ReferenceLine y={cushion} stroke="#f59e0b" strokeWidth={1.5}
                  strokeDasharray="5 3" label={{ value: `$${cushion/1000 >= 1 ? (cushion/1000)+'k' : cushion} cushion`, position: 'insideTopRight', fontSize: 10, fill: '#d97706' }} />
              )}
              {/* Minimum balance dot */}
              {analytics.minDate && analytics.min < cushion && (
                <ReferenceDot x={analytics.minDate} y={analytics.min} r={5}
                  fill="#ef4444" stroke="white" strokeWidth={2} />
              )}
              <Area type="stepAfter" dataKey="balance"
                stroke={strokeColor} strokeWidth={2}
                fill="url(#balGrad)" dot={false}
                activeDot={{ r: 4, fill: strokeColor }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Monthly transaction breakdown */}
      {upcomingByMonth.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-semibold text-navy-900 text-base">Scheduled Transactions</h2>
          {upcomingByMonth.map(([month, txns]) => {
            const net     = txns.reduce((s,t) => s + t.amount, 0)
            const monthLow = Math.min(...txns.map(t => t.projectedBalance))
            return (
              <div key={month} className={`card overflow-hidden ${monthLow < cushion ? 'border-amber-200' : ''}`}>
                <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{month}</p>
                  {monthLow < cushion && (
                    <span className="flex items-center gap-1 text-xs text-amber-600 font-medium">
                      <AlertTriangle size={11} /> below cushion
                    </span>
                  )}
                </div>
                <div className="divide-y divide-slate-100">
                  {txns.map(tx => (
                    <div key={tx.id} className="flex items-center gap-3 px-4 py-2.5">
                      <span className="text-xs text-slate-400 w-12 shrink-0">{formatDateShort(tx.date)}</span>
                      <span className="flex-1 text-sm text-slate-700 truncate">{tx.description}</span>
                      <span className={`font-mono text-sm shrink-0 w-20 text-right ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                        {tx.amount >= 0 ? '+' : '−'}{formatCurrency(Math.abs(tx.amount))}
                      </span>
                      <span className={`font-mono text-xs w-20 text-right shrink-0 ${tx.projectedBalance < cushion ? 'text-amber-600 font-semibold' : 'text-slate-400'}`}>
                        {formatCurrency(tx.projectedBalance)}
                      </span>
                    </div>
                  ))}
                </div>
                <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 flex justify-between">
                  <span className="text-xs text-slate-400">{txns.length} transactions</span>
                  <span className={`font-mono text-xs font-semibold ${net >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    Net {formatCurrency(net, true)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

    </div>
  )
}
