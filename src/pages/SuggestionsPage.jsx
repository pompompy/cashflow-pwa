// src/pages/SuggestionsPage.jsx
import { useState, useEffect, useMemo } from 'react'
import { Sparkles, Check, X, ChevronDown, ChevronUp, RefreshCw, Pencil, CalendarDays } from 'lucide-react'
import {
  getAllTransactions, getSetting, addProspectiveBatch, dismissSuggestionGroup,
  getSuggestionReviews, saveSuggestionReview, clearSuggestionReviews,
} from '../db/index'
import { detectRecurring, suggestionToProspective } from '../utils/recurringDetector'
import { formatCurrency, formatDateShort, formatDate, addDays, today } from '../utils/dateUtils'
import Modal from '../components/Modal'
import { generateId } from '../utils/dateUtils'
import { FREQ_OPTIONS, getFreqOption } from '../components/AddEditModal'

export default function SuggestionsPage() {
  const [suggestions,  setSuggestions]  = useState([])
  // reviewed: Map of key → 'accepted'|'dismissed'  (persisted in IndexedDB)
  const [reviewed,     setReviewed]     = useState(new Map())
  const [expanded,     setExpanded]     = useState(new Set())
  const [loading,      setLoading]      = useState(true)
  const [txCount,      setTxCount]      = useState(0)
  const [editTarget,   setEditTarget]   = useState(null)
  const [forecastDays, setForecastDays] = useState(90)

  async function runDetection(clearReviews = false) {
    setLoading(true)
    if (clearReviews) {
      await clearSuggestionReviews()
      setReviewed(new Map())
    }
    try {
      const [txns, fd, reviewRows] = await Promise.all([
        getAllTransactions(),
        getSetting('forecastDays', '90'),
        clearReviews ? Promise.resolve([]) : getSuggestionReviews(),
      ])
      setTxCount(txns.length)
      const fd_ = parseInt(fd) || 90
      setForecastDays(fd_)

      // Restore persisted reviews
      const reviewMap = new Map(reviewRows.map(r => [r.key, r.decision]))
      setReviewed(reviewMap)

      if (txns.length < 9) { setSuggestions([]); return }
      const found = detectRecurring(txns, fd_)
      setSuggestions(found)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { runDetection(false) }, [])

  async function handleAccept(suggestion) {
    const txns = suggestionToProspective(suggestion)
    await addProspectiveBatch(txns)
    await saveSuggestionReview(suggestion.key, 'accepted')
    setReviewed(prev => new Map(prev).set(suggestion.key, 'accepted'))
  }

  async function handleDismiss(suggestion) {
    await dismissSuggestionGroup(suggestion.key)
    await saveSuggestionReview(suggestion.key, 'dismissed')
    setReviewed(prev => new Map(prev).set(suggestion.key, 'dismissed'))
  }

  function toggleExpand(key) {
    setExpanded(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const pending    = suggestions.filter(s => !reviewed.has(s.key))
  const acceptedN  = [...reviewed.values()].filter(v => v === 'accepted').length
  const dismissedN = [...reviewed.values()].filter(v => v === 'dismissed').length
  const doneCount  = reviewed.size

  if (loading) return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-slate-400">
      <RefreshCw size={24} className="animate-spin" />
      <p className="text-sm">Scanning transaction history…</p>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-serif text-2xl text-navy-900">Suggestions</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            Recurring patterns detected from {txCount} imported transactions
          </p>
        </div>
        <button
          onClick={() => runDetection(true)}
          className="btn-ghost flex items-center gap-1.5 shrink-0"
        >
          <RefreshCw size={14} /> Re-scan
        </button>
      </div>

      {/* Not enough data */}
      {txCount < 9 && (
        <div className="card p-8 text-center space-y-3">
          <Sparkles size={32} className="mx-auto text-slate-200" />
          <p className="font-semibold text-navy-900">Not enough data yet</p>
          <p className="text-sm text-slate-400">
            Import at least a few months of Ally transactions — the detector needs
            at least 3 occurrences of a pattern to suggest it.
          </p>
        </div>
      )}

      {/* All reviewed */}
      {txCount >= 9 && pending.length === 0 && suggestions.length > 0 && (
        <div className="card p-6 text-center space-y-2">
          <Check size={28} className="mx-auto text-emerald-500" />
          <p className="font-semibold text-navy-900">All suggestions reviewed</p>
          <p className="text-sm text-slate-400">
            {acceptedN} accepted · {dismissedN} dismissed
          </p>
          <p className="text-xs text-slate-300 mt-1">
            Your decisions are remembered. Click Re-scan to start fresh.
          </p>
          <button onClick={() => runDetection(true)} className="btn-ghost text-sm mt-2">
            Re-scan for new patterns
          </button>
        </div>
      )}

      {/* No patterns found */}
      {txCount >= 9 && suggestions.length === 0 && (
        <div className="card p-8 text-center space-y-2">
          <Sparkles size={32} className="mx-auto text-slate-200" />
          <p className="font-semibold text-navy-900">No recurring patterns found</p>
          <p className="text-sm text-slate-400">
            Try importing a longer date range (6–12 months) so the detector has more examples.
          </p>
        </div>
      )}

      {/* Progress bar */}
      {suggestions.length > 0 && pending.length > 0 && (
        <div>
          <div className="flex justify-between text-xs text-slate-400 mb-1.5">
            <span>{pending.length} remaining</span>
            <span>{doneCount} / {suggestions.length} reviewed</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-navy-600 rounded-full transition-all duration-500"
              style={{ width: `${suggestions.length ? (doneCount / suggestions.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}

      {/* Suggestion cards */}
      <div className="space-y-3">
        {pending.map(s => (
          <SuggestionCard
            key={s.key}
            suggestion={s}
            expanded={expanded.has(s.key)}
            onToggle={() => toggleExpand(s.key)}
            onAccept={() => handleAccept(s)}
            onDismiss={() => handleDismiss(s)}
            onEdit={() => setEditTarget(s)}
          />
        ))}
      </div>

      {/* Edit modal */}
      {editTarget && (
        <EditSuggestionModal
          suggestion={editTarget}
          forecastDays={forecastDays}
          onClose={() => setEditTarget(null)}
          onSaved={(updated) => {
            setSuggestions(prev => prev.map(s => s.key === updated.key ? updated : s))
            setEditTarget(null)
          }}
        />
      )}
    </div>
  )
}

// ── Suggestion card ──────────────────────────────────────────────────────────
function SuggestionCard({ suggestion: s, expanded, onToggle, onAccept, onDismiss, onEdit }) {
  const confidenceColor =
    s.confidence >= 85 ? 'text-emerald-600 bg-emerald-50 border-emerald-200' :
    s.confidence >= 65 ? 'text-amber-600  bg-amber-50  border-amber-200'  :
                         'text-slate-500  bg-slate-50  border-slate-200'

  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-4">
        <div className="flex items-start gap-3">
          {/* Confidence badge */}
          <span className={`shrink-0 text-xs font-bold px-2 py-0.5 rounded-full border mt-0.5 ${confidenceColor}`}>
            {s.confidence}%
          </span>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <p className="font-medium text-navy-900 dark:text-slate-100 text-xs leading-snug break-words">{s.description}</p>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
              <span className="text-xs text-slate-500">{s.frequency}</span>
              <span className="text-xs text-slate-300">·</span>
              <span className={`text-xs font-mono font-semibold ${s.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {s.isVariable
                  ? `~${formatCurrency(Math.abs(s.amount))} (varies)`
                  : `${s.amount >= 0 ? '+' : '−'}${formatCurrency(Math.abs(s.amount))}`}
              </span>
              <span className="text-xs text-slate-300">·</span>
              <span className="text-xs text-slate-400">seen {s.sampleCount}×</span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Next: <span className="font-medium text-slate-600">{formatDateShort(s.futureDates[0])}</span>
              {s.futureDates.length > 1 && ` · ${s.futureDates.length} occurrences`}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors" title="Edit">
              <Pencil size={15} />
            </button>
            <button onClick={onToggle} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors" title="Expand">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
        </div>

        {/* Expanded: date list */}
        {expanded && (
          <div className="mt-3 pt-3 border-t border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
              Projected occurrences ({s.futureDates.length})
            </p>
            <div className="flex flex-wrap gap-2">
              {s.futureDates.map(d => (
                <span key={d} className="text-xs bg-navy-50 text-navy-600 border border-navy-100 rounded-lg px-2 py-1">
                  {formatDate(d)}
                </span>
              ))}
            </div>
            {s.isVariable && (
              <p className="text-xs text-amber-600 mt-2">
                ⚠ Amount varies — {formatCurrency(Math.abs(s.amountMin))} – {formatCurrency(Math.abs(s.amountMax))}.
                Average used; edit individual entries afterward.
              </p>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-3">
          <button onClick={onDismiss}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                       text-slate-500 bg-slate-50 hover:bg-slate-100 transition-colors flex-1 justify-center">
            <X size={15} /> Dismiss
          </button>
          <button onClick={onAccept}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium
                       text-white bg-navy-700 hover:bg-navy-800 transition-colors flex-1 justify-center">
            <Check size={15} /> Add to forecast
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Edit suggestion modal ────────────────────────────────────────────────────
function EditSuggestionModal({ suggestion, forecastDays, onClose, onSaved }) {
  const LEGACY_MAP = {
    'Weekly': 'weekly', 'Bi-weekly': 'biweekly', 'Monthly': 'monthly_day',
    'Quarterly': 'quarterly', 'Annual': 'annual',
    'Semi-monthly': 'every30', 'Bi-monthly': 'quarterly',
  }
  const initFreqKey = suggestion.freqKey || LEGACY_MAP[suggestion.frequency] || 'monthly_day'

  const [desc,      setDesc]      = useState(suggestion.description)
  const [amount,    setAmount]    = useState(String(Math.abs(suggestion.amount)))
  const [dir,       setDir]       = useState(suggestion.amount >= 0 ? 'income' : 'expense')
  const [freqKey,   setFreqKey]   = useState(initFreqKey)
  const [dayOffset, setDayOffset] = useState(0)   // ±N day nudge applied to all projected dates

  // Recompute projected dates when frequency, lastDate, or dayOffset changes
  const futureDates = useMemo(() => {
    const freq    = getFreqOption(freqKey)
    const endDate = addDays(today(), forecastDays)
    const dates   = []
    let d = freq.next(suggestion.lastDate)
    for (let guard = 0; d <= endDate && guard < 60; guard++, d = freq.next(d)) {
      // Apply day offset — clamp so we never go before today
      const shifted = addDays(d, dayOffset)
      dates.push(shifted)
    }
    return dates
  }, [freqKey, suggestion.lastDate, forecastDays, dayOffset])

  function handleSave() {
    const rawAmt = parseFloat(amount) || 0
    const signed = dir === 'expense' ? -Math.abs(rawAmt) : Math.abs(rawAmt)
    const freq   = getFreqOption(freqKey)
    onSaved({
      ...suggestion,
      description:   desc.trim() || suggestion.description,
      amount:        signed,
      isVariable:    false,
      freqKey,
      frequency:     freq.label,
      frequencyDays: freq.days,
      futureDates,
    })
  }

  const groups = [...new Set(FREQ_OPTIONS.map(f => f.group))]

  return (
    <Modal open onClose={onClose} title="Edit Suggestion">
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Changes apply before the suggestion is added to your forecast.
        </p>

        <div>
          <label className="label">Description</label>
          <input className="input" value={desc} onChange={e => setDesc(e.target.value)} />
        </div>

        <div>
          <span className="label">Type</span>
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            {['income', 'expense'].map(d => (
              <button key={d} onClick={() => setDir(d)}
                className={`flex-1 py-2 text-sm font-medium capitalize transition-colors ${
                  dir === d
                    ? d === 'income' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'
                    : 'bg-white text-slate-400 hover:bg-slate-50'
                }`}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">Amount ($)</label>
          <input className="input font-mono" type="number" min="0" step="0.01"
            value={amount} onChange={e => setAmount(e.target.value)} />
          {suggestion.isVariable && (
            <p className="text-xs text-amber-600 mt-1">
              Detected range: {formatCurrency(Math.abs(suggestion.amountMin))} – {formatCurrency(Math.abs(suggestion.amountMax))}
            </p>
          )}
        </div>

        <div>
          <label className="label">Frequency</label>
          <select className="input" value={freqKey} onChange={e => setFreqKey(e.target.value)}>
            {groups.map(g => (
              <optgroup key={g} label={g}>
                {FREQ_OPTIONS.filter(f => f.group === g).map(f => (
                  <option key={f.key} value={f.key}>{f.label}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <p className="text-xs text-slate-400 mt-1">
            Auto-detected: <span className="font-medium">{suggestion.frequency}</span>
          </p>
        </div>

        {/* Day-of-occurrence offset */}
        <div>
          <label className="label flex items-center gap-1.5">
            <CalendarDays size={13} className="text-slate-400" />
            Shift occurrence day
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range" min={-6} max={6} step={1}
              value={dayOffset}
              onChange={e => setDayOffset(parseInt(e.target.value))}
              className="flex-1 accent-navy-700"
            />
            <span className="font-mono text-sm w-16 text-center bg-slate-50 border border-slate-200 rounded-lg py-1">
              {dayOffset === 0 ? 'no shift' : `${dayOffset > 0 ? '+' : ''}${dayOffset}d`}
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Nudge the projected dates earlier or later by up to 6 days.
            {dayOffset !== 0 && futureDates.length > 0 && (
              <span className="text-navy-600"> First date: {formatDateShort(futureDates[0])}.</span>
            )}
          </p>
        </div>

        {/* Live date preview */}
        {futureDates.length > 0 && (
          <div className="bg-slate-50 rounded-xl p-3">
            <p className="text-xs font-medium text-slate-500 mb-2">
              {futureDates.length} occurrences over the next {forecastDays} days
            </p>
            <div className="flex flex-wrap gap-1.5">
              {futureDates.slice(0, 8).map(d => (
                <span key={d} className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-mono">{d}</span>
              ))}
              {futureDates.length > 8 && (
                <span className="text-xs text-slate-400 self-center">+{futureDates.length - 8} more</span>
              )}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} className="btn-primary flex-1">Apply &amp; Review</button>
        </div>
      </div>
    </Modal>
  )
}
