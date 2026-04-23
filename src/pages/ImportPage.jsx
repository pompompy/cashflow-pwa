// src/pages/ImportPage.jsx
import { useState, useRef } from 'react'
import { Upload, FileText, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, GitMerge } from 'lucide-react'
import { parseOFX } from '../utils/ofxParser'
import { parseAllyCSV } from '../utils/csvParser'
import { smartImportTransactions, forceInsertTransaction, setSetting, getPastDatedProspective } from '../db/index'
import { formatDate, formatCurrency, formatTime, today } from '../utils/dateUtils'
import Modal from '../components/Modal'

const STEPS = [
  { n: 1, text: 'Log into Ally Bank and select your Checking account.' },
  { n: 2, text: 'Click "Statements & docs" in the account menu.' },
  { n: 3, text: 'Choose "Download transactions" and set a date range (6–12 months recommended for best recurring detection).' },
  { n: 4, text: 'Select OFX format (preferred) or CSV, then download the file.' },
  { n: 5, text: 'Come back here and drop the file below (or tap to browse).' },
]

export default function ImportPage() {
  const [dragOver,      setDragOver]      = useState(false)
  const [parsed,        setParsed]        = useState(null)
  const [result,        setResult]        = useState(null)
  const [error,         setError]         = useState(null)
  const [importing,     setImporting]     = useState(false)
  const [showSteps,     setShowSteps]     = useState(true)
  // Near-dupe review state
  const [dupeQueue,     setDupeQueue]     = useState([])   // [{incoming, existing}]
  const [dupeIdx,       setDupeIdx]       = useState(0)
  const [dupeResults,   setDupeResults]   = useState({ accepted: 0, rejected: 0 })
  const [dupeDone,      setDupeDone]      = useState(false)
  const fileRef = useRef()

  function reset() {
    setParsed(null); setResult(null); setError(null)
    setDupeQueue([]); setDupeIdx(0)
    setDupeResults({ accepted: 0, rejected: 0 }); setDupeDone(false)
  }

  async function processFile(file) {
    reset()
    if (!file) return
    const name = file.name.toLowerCase()
    if (!name.endsWith('.ofx') && !name.endsWith('.qfx') && !name.endsWith('.csv')) {
      setError('Please choose an OFX, QFX, or CSV file exported from Ally Bank.')
      return
    }
    try {
      const text = await file.text()
      const res  = name.endsWith('.csv') ? parseAllyCSV(text) : parseOFX(text)
      if (!res.transactions.length) {
        setError('No transactions found. Make sure this is an Ally Bank OFX or CSV export.')
        return
      }
      // Sort by sortKey before preview
      res.transactions.sort((a, b) => (a.sortKey || a.date).localeCompare(b.sortKey || b.date))
      setParsed({ ...res, filename: file.name })
    } catch (e) {
      console.error(e)
      setError('Could not parse the file. ' + e.message)
    }
  }

  function onDrop(e) {
    e.preventDefault(); setDragOver(false)
    processFile(e.dataTransfer.files[0])
  }

  async function handleImport() {
    if (!parsed) return
    setImporting(true)
    try {
      const { inserted, skipped, needsReview } = await smartImportTransactions(parsed.transactions)

      if (parsed.endingBalance !== null) {
        await setSetting('seedBalance', String(parsed.endingBalance))
        await setSetting('balanceDate', parsed.balanceDate || today())
      }

      const pastDated = await getPastDatedProspective()

      if (needsReview.length > 0) {
        // Hand off to the dupe review flow
        setDupeQueue(needsReview)
        setDupeIdx(0)
        setDupeResults({ accepted: inserted, rejected: skipped, pastDatedCount: pastDated.length, balanceUpdated: parsed.endingBalance !== null })
        setParsed(null)
      } else {
        setResult({ inserted, skipped, balanceUpdated: parsed.endingBalance !== null, pastDatedCount: pastDated.length })
        setParsed(null)
      }
    } finally {
      setImporting(false)
    }
  }

  // User accepts a near-dupe — force-insert the incoming record
  async function handleDupeAccept() {
    const pair = dupeQueue[dupeIdx]
    await forceInsertTransaction(pair.incoming)
    setDupeResults(r => ({ ...r, accepted: r.accepted + 1 }))
    advanceDupe()
  }

  // User rejects — skip the incoming record
  function handleDupeReject() {
    setDupeResults(r => ({ ...r, rejected: r.rejected + 1 }))
    advanceDupe()
  }

  function advanceDupe() {
    const next = dupeIdx + 1
    if (next >= dupeQueue.length) {
      setDupeDone(true)
    } else {
      setDupeIdx(next)
    }
  }

  const dateRange = parsed?.transactions?.length
    ? `${formatDate(parsed.transactions[0].date)} → ${formatDate(parsed.transactions[parsed.transactions.length - 1].date)}`
    : ''

  // ── Near-dupe review flow ──────────────────────────────────────────────────
  if (dupeQueue.length > 0 && !dupeDone) {
    const pair    = dupeQueue[dupeIdx]
    const inc     = pair.incoming
    const ext     = pair.existing
    const progress = `${dupeIdx + 1} of ${dupeQueue.length}`

    return (
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        <div>
          <h1 className="font-serif text-2xl text-navy-900">Possible Duplicate</h1>
          <p className="text-slate-400 text-sm mt-0.5">{progress} — review each near-match before importing</p>
        </div>

        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2 text-xs text-amber-600 font-medium">
            <GitMerge size={15} />
            Same amount and description, dates within 2 days
          </div>

          {/* Side-by-side comparison */}
          <div className="grid grid-cols-2 gap-3">
            {[
              { label: 'Already in ledger', tx: ext, tag: 'Existing' },
              { label: 'From this import',  tx: inc, tag: 'Incoming' },
            ].map(({ label, tx, tag }) => (
              <div key={tag} className="bg-slate-50 rounded-xl p-3 space-y-2">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
                <p className="text-sm font-medium text-navy-900 leading-snug">{tx.description}</p>
                <div className="space-y-1 text-xs text-slate-500">
                  <div className="flex justify-between">
                    <span>Date</span>
                    <span className="font-medium text-slate-700">{formatDate(tx.date)}</span>
                  </div>
                  {tx.time && tx.time !== '00:00:00' && (
                    <div className="flex justify-between">
                      <span>Time</span>
                      <span className="font-medium text-slate-700">{formatTime(tx.time)} ET</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>Amount</span>
                    <span className={`font-mono font-semibold ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                      {tx.amount >= 0 ? '+' : '−'}{formatCurrency(Math.abs(tx.amount))}
                    </span>
                  </div>
                  {tx.type && (
                    <div className="flex justify-between">
                      <span>Type</span>
                      <span className="font-medium text-slate-700 capitalize">{tx.type}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-xs text-slate-400">
            This often happens when a transaction was pending during your last export and
            the time or date shifted when it fully posted. If these are the same real transaction,
            reject the import to avoid a duplicate.
          </p>

          <div className="flex gap-2">
            <button
              onClick={handleDupeReject}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors"
            >
              ✕ Reject — it is a duplicate
            </button>
            <button
              onClick={handleDupeAccept}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium bg-navy-700 text-white hover:bg-navy-800 transition-colors"
            >
              ✓ Accept — it is different
            </button>
          </div>

          {/* Progress dots */}
          {dupeQueue.length > 1 && (
            <div className="flex justify-center gap-1.5">
              {dupeQueue.map((_, i) => (
                <div key={i} className={`w-1.5 h-1.5 rounded-full ${
                  i < dupeIdx ? 'bg-slate-300' : i === dupeIdx ? 'bg-navy-600' : 'bg-slate-200'
                }`} />
              ))}
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Post-dupe-review result ────────────────────────────────────────────────
  if (dupeDone) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
        <div>
          <h1 className="font-serif text-2xl text-navy-900">Import complete</h1>
        </div>
        <div className="card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={22} className="text-emerald-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-navy-900">All duplicates reviewed</p>
              <p className="text-sm text-slate-500">
                {dupeResults.accepted} transaction{dupeResults.accepted !== 1 ? 's' : ''} added
                {dupeResults.rejected > 0 && `, ${dupeResults.rejected} skipped as duplicates`}.
              </p>
              {dupeResults.balanceUpdated && (
                <p className="text-sm text-emerald-600">✓ Current balance updated from file.</p>
              )}
            </div>
          </div>
          {(dupeResults.pastDatedCount || 0) > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800">
                {dupeResults.pastDatedCount} scheduled transaction{dupeResults.pastDatedCount > 1 ? 's' : ''} may have cleared — head to Ledger to reconcile.
              </p>
            </div>
          )}
          <button onClick={reset} className="btn-primary w-full">Import another file</button>
        </div>
      </div>
    )
  }

  // ── Main import UI ─────────────────────────────────────────────────────────
  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">
      <div>
        <h1 className="font-serif text-2xl text-navy-900">Import from Ally</h1>
        <p className="text-slate-400 text-sm mt-0.5">Import your transaction history to enable recurring detection.</p>
      </div>

      {/* Instructions (collapsible) */}
      <div className="card overflow-hidden">
        <button
          className="w-full flex items-center justify-between px-5 py-4 text-left"
          onClick={() => setShowSteps(s => !s)}
        >
          <span className="font-semibold text-navy-900 text-sm">How to export from Ally Bank</span>
          {showSteps ? <ChevronUp size={16} className="text-slate-400" /> : <ChevronDown size={16} className="text-slate-400" />}
        </button>
        {showSteps && (
          <div className="px-5 pb-5 border-t border-slate-100">
            <ol className="space-y-3 mt-4">
              {STEPS.map(({ n, text }) => (
                <li key={n} className="flex gap-3">
                  <span className="shrink-0 w-6 h-6 rounded-full bg-navy-100 text-navy-700 text-xs font-bold flex items-center justify-center">{n}</span>
                  <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-xs text-slate-400 bg-slate-50 rounded-lg p-3">
              <strong className="text-slate-600">Privacy note:</strong> Your file is parsed entirely in your browser.
              Nothing is uploaded to any server. Your financial data never leaves your device.
            </p>
          </div>
        )}
      </div>

      {/* Drop zone */}
      {!parsed && !result && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-10 text-center cursor-pointer transition-all ${
            dragOver ? 'border-navy-500 bg-navy-50' : 'border-slate-200 hover:border-navy-300 hover:bg-slate-50'
          }`}
        >
          <Upload size={32} className={`mx-auto mb-3 ${dragOver ? 'text-navy-500' : 'text-slate-300'}`} />
          <p className="font-medium text-slate-600">Drop your OFX or CSV file here</p>
          <p className="text-slate-400 text-sm mt-1">or tap to browse</p>
          <p className="text-xs text-slate-300 mt-3">Supports .ofx · .qfx · .csv</p>
          <input ref={fileRef} type="file" accept=".ofx,.qfx,.csv" className="hidden"
            onChange={e => processFile(e.target.files[0])} />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex gap-3 bg-red-50 border border-red-100 rounded-xl p-4">
          <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-700">Import failed</p>
            <p className="text-sm text-red-600 mt-0.5">{error}</p>
            <button onClick={reset} className="text-xs text-red-500 underline mt-2">Try again</button>
          </div>
        </div>
      )}

      {/* Preview */}
      {parsed && (
        <div className="card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <FileText size={20} className="text-navy-500 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-navy-900 truncate">{parsed.filename}</p>
              <p className="text-sm text-slate-500 mt-0.5">{dateRange}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Stat label="Transactions" value={parsed.transactions.length} />
            <Stat label="Date span" value={(() => {
              const txns = parsed.transactions
              if (!txns.length) return '0 days'
              const days = Math.round((new Date(txns[txns.length-1].date) - new Date(txns[0].date)) / 86_400_000)
              return `${days} days`
            })()} />
            {parsed.endingBalance !== null && (
              <Stat label="Closing balance" value={formatCurrency(parsed.endingBalance)} highlight />
            )}
            <Stat label="Deposits" value={`${parsed.transactions.filter(t => t.amount > 0).length} txns`} />
          </div>

          {parsed.endingBalance !== null && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg px-3 py-2 text-xs text-emerald-700">
              The closing balance ({formatCurrency(parsed.endingBalance)}) will be set as your current balance.
            </div>
          )}

          {/* Preview of most recent rows */}
          <div className="border border-slate-100 rounded-xl overflow-hidden">
            <div className="px-3 py-2 bg-slate-50 text-xs font-medium text-slate-400 uppercase tracking-wide">
              Preview (most recent)
            </div>
            {parsed.transactions.slice(-5).reverse().map((tx, i) => (
              <div key={i} className="flex gap-3 px-3 py-2.5 border-t border-slate-100">
                <div className="shrink-0 w-24">
                  <p className="text-xs text-slate-400">{formatDate(tx.date)}</p>
                  {tx.time && tx.time !== '00:00:00' && (
                    <p className="text-[10px] text-slate-300">{formatTime(tx.time)} ET</p>
                  )}
                </div>
                <span className="flex-1 text-sm text-slate-600 truncate">{tx.description}</span>
                <span className={`font-mono text-sm shrink-0 ${tx.amount >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  {tx.amount >= 0 ? '+' : '−'}{formatCurrency(Math.abs(tx.amount))}
                </span>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <button onClick={reset} className="btn-ghost">Cancel</button>
            <button onClick={handleImport} disabled={importing} className="btn-primary flex-1">
              {importing ? 'Importing…' : `Import ${parsed.transactions.length} transactions`}
            </button>
          </div>
        </div>
      )}

      {/* Success */}
      {result && (
        <div className="card p-5 space-y-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 size={22} className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-navy-900">Import complete</p>
              <p className="text-sm text-slate-500 mt-0.5">
                {result.inserted} new transaction{result.inserted !== 1 ? 's' : ''} added
                {result.skipped > 0 && `, ${result.skipped} exact duplicates skipped`}.
              </p>
              {result.balanceUpdated && (
                <p className="text-sm text-emerald-600 mt-1">✓ Current balance updated from file.</p>
              )}
            </div>
          </div>
          {result.pastDatedCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-amber-500 shrink-0 mt-0.5" />
              <div className="text-sm text-amber-800">
                <p className="font-medium">{result.pastDatedCount} scheduled transaction{result.pastDatedCount > 1 ? 's' : ''} may have cleared.</p>
                <p className="text-amber-700 text-xs mt-0.5">Go to Ledger to reconcile them.</p>
              </div>
            </div>
          )}
          <button onClick={reset} className="btn-primary w-full">Import another file</button>
          <p className="text-xs text-slate-400 text-center">
            Head to <strong>Suggestions</strong> to review detected recurring transactions.
          </p>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, highlight }) {
  return (
    <div className={`rounded-xl px-3 py-3 ${highlight ? 'bg-navy-50 border border-navy-100' : 'bg-slate-50'}`}>
      <p className="text-xs text-slate-400 font-medium">{label}</p>
      <p className={`font-mono font-semibold text-sm mt-0.5 ${highlight ? 'text-navy-700' : 'text-slate-700'}`}>{value}</p>
    </div>
  )
}
