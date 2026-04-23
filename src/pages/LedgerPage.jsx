// src/pages/LedgerPage.jsx
import { useState, useEffect, useMemo } from 'react'
import { Plus, ChevronDown, ChevronUp, RefreshCw, Pencil, Search, X, AlertCircle, ArrowDownToLine } from 'lucide-react'
import {
  getAllTransactions, getActiveProspective, getSetting,
  updateTransactionDisplay, updateProspective,
  getPastDatedProspective, commitProspectiveToHistory,
  discardProspectiveBatch, getLatestTransaction,
} from '../db/index'
import { formatCurrency, formatDateShort, formatDate, formatTime, today } from '../utils/dateUtils'
import AddEditModal from '../components/AddEditModal'
import Modal from '../components/Modal'

const SECTION_SIZE = 40

export default function LedgerPage() {
  const [transactions,  setTransactions]  = useState([])
  const [prospective,   setProspective]   = useState([])
  const [seedBalance,   setSeedBalance]   = useState(0)
  const [forecastDays,  setForecastDays]  = useState(90)
  const [balanceAsOf,   setBalanceAsOf]   = useState(null)   // { date, time }
  const [loading,       setLoading]       = useState(true)
  const [showAllPast,   setShowAllPast]   = useState(false)
  const [search,        setSearch]        = useState('')
  const [addOpen,       setAddOpen]       = useState(false)
  const [editTarget,    setEditTarget]    = useState(null)
  const [renameTarget,  setRenameTarget]  = useState(null)
  const [reconcileOpen, setReconcileOpen] = useState(false)
  const [pastDated,     setPastDated]     = useState([])

  async function load() {
    setLoading(true)
    const [txns, pros, seed, fd, past, latestTx] = await Promise.all([
      getAllTransactions(),
      getActiveProspective(),
      getSetting('seedBalance', '0'),
      getSetting('forecastDays', '90'),
      getPastDatedProspective(),
      getLatestTransaction(),
    ])
    setTransactions(txns)
    setProspective(pros)
    setSeedBalance(parseFloat(seed) || 0)
    setForecastDays(parseInt(fd) || 90)
    setPastDated(past)
    // Balance "as of" comes from the most recent historical transaction
    setBalanceAsOf(latestTx ? { date: latestTx.date, time: latestTx.time || null } : null)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const { pastItems, futureItems, projectedFinal } = useMemo(() => {
    const todayStr = today()

    // Past: sorted by sortKey newest-first (already sorted desc by db)
    // filter: date <= today
    const past = transactions
      .filter(t => t.date <= todayStr)
      .sort((a, b) => (b.sortKey || b.date).localeCompare(a.sortKey || a.date))

    // Running balance newest→oldest: each row's balance = balance AFTER that tx
    let runningPast = seedBalance
    const pastWithBal = past.map(tx => {
      const bal = runningPast
      runningPast -= tx.amount
      return { ...tx, balance: bal }
    })

    // Future: include today's prospective too (date >= today)
    // Compute oldest→newest for correct running balance, then reverse for display
    const futureChron = prospective
      .filter(t => t.date >= todayStr)                             // ← fixed: >= not >
      .sort((a, b) => a.date.localeCompare(b.date) ||
                      (a.time || '00:01').localeCompare(b.time || '00:01'))

    let runningFuture = seedBalance
    const futureWithBal = futureChron.map(tx => {
      runningFuture += tx.amount
      return { ...tx, projectedBalance: runningFuture }
    })

    return {
      pastItems:      pastWithBal,
      futureItems:    [...futureWithBal].reverse(),
      projectedFinal: runningFuture,
    }
  }, [transactions, prospective, seedBalance])

  const q             = search.trim().toLowerCase()
  const visibleFuture = q ? futureItems.filter(t => (t.description||'').toLowerCase().includes(q)) : futureItems
  const filteredPast  = q ? pastItems.filter(t => (t.displayDescription||t.description||'').toLowerCase().includes(q)) : pastItems
  const visiblePast   = showAllPast ? filteredPast : filteredPast.slice(0, SECTION_SIZE)

  if (loading) return (
    <div className="flex items-center justify-center h-full text-slate-400">
      <RefreshCw size={24} className="animate-spin" />
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-0 md:px-4 md:py-6">

      {/* ── Balance header ─────────────────────────────────── */}
      <div className="bg-navy-900 text-white px-5 py-5 md:rounded-2xl md:mb-4 sticky top-0 z-10 md:relative">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-navy-300 text-xs font-medium tracking-wide uppercase">Current Balance</p>
            <p className="font-mono text-3xl font-medium mt-0.5 tracking-tight">
              {formatCurrency(seedBalance)}
            </p>
            {/* Item 5: as-of timestamp from latest imported transaction */}
            {balanceAsOf && (
              <p className="text-navy-400 text-[11px] mt-1">
                as of {formatDate(balanceAsOf.date)}
                {balanceAsOf.time && balanceAsOf.time !== '00:00:00'
                  ? ` · ${formatTime(balanceAsOf.time)} ET`
                  : ''}
              </p>
            )}
          </div>
          <div className="text-right space-y-1.5">
            {futureItems.length > 0 && (
              <div>
                <p className="text-navy-300 text-xs font-medium tracking-wide uppercase">{forecastDays}d Projected</p>
                <p className={`font-mono text-xl ${projectedFinal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {formatCurrency(projectedFinal)}
                </p>
              </div>
            )}
            {pastDated.length > 0 && (
              <button
                onClick={() => setReconcileOpen(true)}
                className="flex items-center gap-1.5 bg-amber-500/20 border border-amber-400/40
                           text-amber-300 text-xs px-2.5 py-1 rounded-full hover:bg-amber-500/30 transition-colors"
              >
                <AlertCircle size={12} />
                {pastDated.length} to reconcile
              </button>
            )}
          </div>
        </div>
        {transactions.length === 0 && (
          <p className="text-navy-400 text-xs mt-2">
            No transactions imported yet — go to Import to load your Ally history.
          </p>
        )}
      </div>

      {/* ── Search bar ─────────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 sticky top-[calc(env(safe-area-inset-top,0px)+5.5rem)] md:static z-[9] md:bg-transparent dark:md:bg-transparent md:border-none md:pt-0">
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 pointer-events-none" />
          <input
            className="input pl-8 pr-8 text-sm"
            style={{ background: 'var(--bg-subtle)' }}
            placeholder="Search transactions…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 hover:text-slate-500">
              <X size={15} />
            </button>
          )}
        </div>
      </div>

      {/* ── Column headers (desktop) ───────────────────────── */}
      <div className="hidden md:flex items-center gap-3 px-5 py-2 text-[10px] font-semibold uppercase tracking-wider border-b border-slate-100 dark:border-slate-800"
        style={{ color: 'var(--text-faint)' }}>
        <span className="w-28 shrink-0">Date · Time</span>
        <span className="flex-1">Description</span>
        <span className="w-24 text-right shrink-0">Amount</span>
        <span className="w-24 text-right shrink-0">Balance</span>
      </div>

      {/* ── UPCOMING ───────────────────────────────────────── */}
      {visibleFuture.length > 0 && (
        <section className="mb-2">
          <div className="px-5 pt-4 pb-1">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
              Upcoming {q && `(${visibleFuture.length} match)`}
            </h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {visibleFuture.map(tx => (
              <TxRow key={tx.id} tx={tx} isFuture onClick={() => setEditTarget(tx)} />
            ))}
          </div>
        </section>
      )}
      {futureItems.length === 0 && !q && (
        <div className="px-5 py-4 text-sm text-slate-400">
          No upcoming transactions — tap + to add one, or visit Suggestions.
        </div>
      )}

      {/* ── TODAY divider ──────────────────────────────────── */}
      <div className="today-divider my-3">
        <span className="text-xs font-semibold text-navy-600 bg-navy-50 px-3 py-1 rounded-full border border-navy-200">
          TODAY · {formatDateShort(today())}
        </span>
      </div>

      {/* ── HISTORY ────────────────────────────────────────── */}
      <section>
        <div className="px-5 pb-1 flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-faint)' }}>
            History ({filteredPast.length}{q ? ` of ${pastItems.length}` : ''})
          </h2>
          {filteredPast.length > SECTION_SIZE && (
            <button onClick={() => setShowAllPast(s => !s)}
              className="text-xs text-navy-500 flex items-center gap-1">
              {showAllPast ? <><ChevronUp size={12}/> Show less</> : <><ChevronDown size={12}/> Show all</>}
            </button>
          )}
        </div>

        {filteredPast.length === 0 ? (
          <p className="px-5 py-3 text-sm text-slate-400">
            {q ? 'No matching transactions.' : 'No imported transactions yet.'}
          </p>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {visiblePast.map(tx => (
              <TxRow key={tx.id} tx={tx} isFuture={false} onClick={() => setRenameTarget(tx)} />
            ))}
          </div>
        )}

        {!showAllPast && filteredPast.length > SECTION_SIZE && (
          <button onClick={() => setShowAllPast(true)}
            className="w-full py-3 text-sm text-navy-500 hover:bg-slate-50 transition-colors">
            Show {filteredPast.length - SECTION_SIZE} more…
          </button>
        )}
      </section>

      <div className="h-6" />

      {/* ── FAB ────────────────────────────────────────────── */}
      <button
        onClick={() => setAddOpen(true)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 w-14 h-14 bg-navy-800 text-white
                   rounded-full shadow-lg flex items-center justify-center hover:bg-navy-700
                   active:scale-95 transition-all z-30"
        aria-label="Add transaction"
      >
        <Plus size={26} />
      </button>

      {/* ── Modals ─────────────────────────────────────────── */}
      <AddEditModal open={addOpen} onClose={() => setAddOpen(false)}
        existing={null} onSaved={load} forecastDays={forecastDays} />

      <AddEditModal open={!!editTarget} onClose={() => setEditTarget(null)}
        existing={editTarget} onSaved={() => { setEditTarget(null); load() }} forecastDays={forecastDays} />

      <RenameModal tx={renameTarget} onClose={() => setRenameTarget(null)}
        onSaved={() => { setRenameTarget(null); load() }} />

      <ReconcileModal
        open={reconcileOpen}
        items={pastDated}
        onClose={() => setReconcileOpen(false)}
        onDone={() => { setReconcileOpen(false); load() }}
      />
    </div>
  )
}

// ── Transaction row ─────────────────────────────────────────────────────────
function TxRow({ tx, isFuture, onClick }) {
  const positive = tx.amount >= 0
  const label    = tx.displayDescription || tx.description
  const balance  = isFuture ? tx.projectedBalance : tx.balance
  const timeStr  = tx.time && tx.time !== '00:00:00' && tx.time !== '00:01:00'
    ? formatTime(tx.time)
    : null

  return (
    <div
      onClick={onClick}
      className="flex items-start gap-3 px-5 py-3 group cursor-pointer transition-colors
                 hover:bg-slate-50 dark:hover:bg-slate-800/60
                 active:bg-slate-100 dark:active:bg-slate-800"
    >
      {/* Date + Time stacked */}
      <div className="w-28 shrink-0 pt-0.5">
        <span className={`text-xs font-medium block ${isFuture ? 'text-slate-500 dark:text-slate-400' : 'text-slate-400 dark:text-slate-500'}`}>
          {formatDateShort(tx.date)}
        </span>
        {timeStr && (
          <span className="text-[10px] text-slate-300 dark:text-slate-600 block">{timeStr} ET</span>
        )}
      </div>

      {/* Description — wraps, smaller font, badge flows with text */}
      <div className="flex-1 min-w-0">
        <p className={`text-xs leading-snug break-words ${isFuture ? 'text-slate-800 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
          {label}
          {tx.isRecurring && (
            <span className="ml-1.5 text-[10px] text-navy-400 dark:text-navy-300
                             bg-navy-50 dark:bg-navy-900/60
                             border border-navy-100 dark:border-navy-800
                             px-1.5 py-0.5 rounded-full font-medium
                             whitespace-nowrap inline-block align-middle">
              {tx.frequency || tx.freqKey}
            </span>
          )}
        </p>
      </div>

      {/* Pencil on hover for historical */}
      {!isFuture && (
        <Pencil size={13} className="shrink-0 text-slate-300 dark:text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity mt-0.5" />
      )}

      {/* Amount */}
      <span className={`font-mono text-xs shrink-0 w-24 text-right pt-0.5 ${
        positive ? 'text-emerald-600 dark:text-emerald-500' : 'text-red-500 dark:text-red-400'
      } ${!isFuture ? 'opacity-70' : ''}`}>
        {positive ? '+' : '−'}{formatCurrency(Math.abs(tx.amount))}
      </span>

      {/* Running balance */}
      {balance !== undefined && (
        <span className={`font-mono text-xs w-24 text-right shrink-0 pt-0.5 ${
          balance >= 0
            ? isFuture
              ? 'text-slate-600 dark:text-slate-300'
              : 'text-slate-400 dark:text-slate-500'
            : 'text-red-600 dark:text-red-400 font-semibold'
        } ${!isFuture ? 'opacity-60' : ''}`}>
          {formatCurrency(balance)}
        </span>
      )}
    </div>
  )
}

// ── Rename historical transaction ───────────────────────────────────────────
function RenameModal({ tx, onClose, onSaved }) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    if (tx) setLabel(tx.displayDescription || tx.description || '')
  }, [tx])

  async function handleSave() {
    if (!tx) return
    await updateTransactionDisplay(tx.id, label.trim() || tx.description)
    onSaved()
  }

  async function handleReset() {
    if (!tx) return
    await updateTransactionDisplay(tx.id, '')
    onSaved()
  }

  if (!tx) return null

  return (
    <Modal open={!!tx} onClose={onClose} title="Edit Label">
      <div className="space-y-4">
        <p className="text-xs text-slate-400">
          Set a custom display label. The original bank description is always preserved.
        </p>
        <div>
          <label className="label">Display label</label>
          <input className="input" value={label} onChange={e => setLabel(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSave()} autoFocus />
          {tx.displayDescription && (
            <p className="text-xs text-slate-400 mt-1.5">
              Original: <span className="font-mono">{tx.description}</span>
            </p>
          )}
        </div>
        <div className="bg-slate-50 rounded-xl px-3 py-2.5 text-xs text-slate-500 space-y-1">
          <div className="flex justify-between">
            <span>Date</span>
            <span className="font-medium">
              {formatDateShort(tx.date)}
              {tx.time && tx.time !== '00:00:00' ? ` · ${formatTime(tx.time)} ET` : ''}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Amount</span>
            <span className={`font-mono font-medium ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {tx.amount >= 0 ? '+' : '−'}{formatCurrency(Math.abs(tx.amount))}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {tx.displayDescription && (
            <button onClick={handleReset} className="btn-ghost text-xs text-slate-400">Reset to original</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} className="btn-primary">Save label</button>
        </div>
      </div>
    </Modal>
  )
}

// ── Reconcile past-dated prospective transactions ────────────────────────────
// Item 6: "Commit to history" moves the record into the transactions table
// and adjusts seedBalance, so you don't need to re-import just to advance the ledger.
function ReconcileModal({ open, items, onClose, onDone }) {
  const [decisions, setDecisions] = useState({})
  const [applying,  setApplying]  = useState(false)

  useEffect(() => {
    if (!open) return
    const init = {}
    // Default: commit (assume it cleared — safest for cash-flow tracking)
    items.forEach(t => { init[t.id] = 'commit' })
    setDecisions(init)
  }, [open, items])

  const decide = (id, val) => setDecisions(prev => ({ ...prev, [id]: val }))

  async function handleApply() {
    setApplying(true)
    try {
      const toCommit  = items.filter(t => decisions[t.id] === 'commit').map(t => t.id)
      const toSnooze  = items.filter(t => decisions[t.id] === 'snooze')
      const toDiscard = items.filter(t => decisions[t.id] === 'discard').map(t => t.id)

      if (toCommit.length)  await commitProspectiveToHistory(toCommit)
      if (toDiscard.length) await discardProspectiveBatch(toDiscard)
      for (const tx of toSnooze) {
        const newDate = new Date(tx.date + 'T12:00:00')
        newDate.setDate(newDate.getDate() + 7)
        await updateProspective(tx.id, { date: newDate.toISOString().split('T')[0] })
      }
      onDone()
    } finally {
      setApplying(false)
    }
  }

  const counts = {
    commit:  Object.values(decisions).filter(v => v === 'commit').length,
    snooze:  Object.values(decisions).filter(v => v === 'snooze').length,
    discard: Object.values(decisions).filter(v => v === 'discard').length,
    keep:    Object.values(decisions).filter(v => v === 'keep').length,
  }

  const ACTIONS = [
    {
      val:    'commit',
      label:  '✓ Commit to history',
      hint:   'Moves to ledger history, updates balance',
      active: 'bg-emerald-600 text-white',
      base:   'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200',
    },
    {
      val:    'snooze',
      label:  '⏱ Push +7 days',
      hint:   'Not cleared yet — reschedule',
      active: 'bg-amber-500 text-white',
      base:   'text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-200',
    },
    {
      val:    'discard',
      label:  '🗑 Discard',
      hint:   'Remove entirely — was never real',
      active: 'bg-red-500 text-white',
      base:   'text-red-600 bg-red-50 hover:bg-red-100 border border-red-200',
    },
    {
      val:    'keep',
      label:  '— Leave as-is',
      hint:   'Keep in upcoming, do nothing',
      active: 'bg-slate-500 text-white',
      base:   'text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-200',
    },
  ]

  return (
    <Modal open={open} onClose={onClose} title="Reconcile Scheduled Transactions" maxWidth="max-w-xl">
      <div className="space-y-4">
        <div className="bg-navy-50 border border-navy-100 rounded-xl px-4 py-3 text-xs text-navy-700 space-y-1">
          <p className="font-semibold">How reconciliation works</p>
          <p><strong>Commit to history</strong> — moves the entry into your ledger and adds its amount to your current balance. Use this when you know it cleared.</p>
          <p><strong>Push +7 days</strong> — reschedules it. Use when it is pending but not yet posted.</p>
          <p><strong>Leave as-is</strong> — no change.</p>
        </div>

        <div className="space-y-3">
          {items.map(tx => (
            <div key={tx.id} className="border border-slate-100 rounded-xl p-3 space-y-2.5">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-navy-900 truncate">{tx.description}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {formatDate(tx.date)}
                    {tx.time && tx.time !== '00:01:00' ? ` · ${formatTime(tx.time)} ET` : ''} ·{' '}
                    <span className={`font-mono font-semibold ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {tx.amount >= 0 ? '+' : '−'}{formatCurrency(Math.abs(tx.amount))}
                    </span>
                  </p>
                </div>
                {tx.isRecurring && (
                  <span className="text-[10px] text-navy-400 bg-navy-50 border border-navy-100 px-1.5 py-0.5 rounded-full shrink-0">
                    {tx.frequency}
                  </span>
                )}
              </div>

              <div className="flex flex-col gap-1.5">
                {ACTIONS.map(({ val, label, hint, active, base }) => (
                  <button
                    key={val}
                    onClick={() => decide(tx.id, val)}
                    className={`w-full py-2 px-3 rounded-lg text-xs font-medium transition-colors text-left flex items-center justify-between ${
                      decisions[tx.id] === val ? active : base
                    }`}
                  >
                    <span>{label}</span>
                    <span className={`text-[10px] ${decisions[tx.id] === val ? 'opacity-75' : 'opacity-50'}`}>{hint}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Summary */}
        <div className="bg-slate-50 rounded-xl px-4 py-3 text-xs text-slate-500 flex flex-wrap gap-3">
          {counts.commit  > 0 && <span className="text-emerald-600 font-medium flex items-center gap-1"><ArrowDownToLine size={11}/> {counts.commit} to commit</span>}
          {counts.snooze  > 0 && <span className="text-amber-600 font-medium">{counts.snooze} to reschedule</span>}
          {counts.discard > 0 && <span className="text-red-500 font-medium">{counts.discard} to discard</span>}
          {counts.keep    > 0 && <span className="text-slate-400">{counts.keep} unchanged</span>}
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost" disabled={applying}>Cancel</button>
          <button onClick={handleApply} disabled={applying || counts.commit + counts.snooze + counts.discard === 0}
            className="btn-primary flex-1">
            {applying ? 'Applying…' : `Apply (${counts.commit + counts.snooze + counts.discard} changes)`}
          </button>
        </div>
      </div>
    </Modal>
  )
}
