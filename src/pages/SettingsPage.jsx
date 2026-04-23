// src/pages/SettingsPage.jsx
import { useState, useEffect, useRef } from 'react'
import { Save, Download, Upload, Trash2, CheckCircle2, AlertCircle, Info, Sun, Moon } from 'lucide-react'
import {
  getSetting, setSetting, exportBackup, importBackup,
  clearTransactions, getDateRange, getAllTransactions, getActiveProspective,
} from '../db/index'
import { formatDate } from '../utils/dateUtils'
import { useTheme } from '../context/ThemeContext'

export default function SettingsPage() {
  const { theme, toggleTheme } = useTheme()

  const [seedBalance,  setSeedBalanceUI]  = useState('')
  const [forecastDays, setForecastDaysUI] = useState('90')
  const [balanceDate,  setBalanceDateUI]  = useState('')
  const [saved,        setSaved]          = useState(false)
  const [stats,        setStats]          = useState(null)
  const [restoreMsg,   setRestoreMsg]     = useState(null)
  const [clearConfirm, setClearConfirm]   = useState(false)
  const fileRef = useRef()

  async function loadSettings() {
    const [seed, fd, bd, txns, pros, range] = await Promise.all([
      getSetting('seedBalance', '0'),
      getSetting('forecastDays', '90'),
      getSetting('balanceDate', ''),
      getAllTransactions(),
      getActiveProspective(),
      getDateRange(),
    ])
    setSeedBalanceUI(seed)
    setForecastDaysUI(fd)
    setBalanceDateUI(bd)
    setStats({
      txCount:   txns.length,
      prosCount: pros.length,
      earliest:  range.earliest,
      latest:    range.latest,
    })
  }

  useEffect(() => { loadSettings() }, [])

  async function handleSave() {
    const bal = parseFloat(seedBalance.replace(/[^0-9.\-]/g, ''))
    const fd  = Math.max(7, Math.min(365, parseInt(forecastDays) || 90))
    await Promise.all([
      setSetting('seedBalance',  isNaN(bal) ? '0' : String(bal)),
      setSetting('forecastDays', String(fd)),
    ])
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  async function handleExport() {
    const json   = await exportBackup()
    const blob   = new Blob([json], { type: 'application/json' })
    const url    = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href  = url
    anchor.download = `cashflow-backup-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  async function handleRestore(file) {
    if (!file) return
    try {
      const text   = await file.text()
      const result = await importBackup(text)
      setRestoreMsg({ ok: true, text: `Restored ${result.transactions} transactions and ${result.prospective} upcoming entries.` })
      loadSettings()
    } catch {
      setRestoreMsg({ ok: false, text: 'Could not read the backup file. Make sure it is a CashFlow backup JSON.' })
    }
    fileRef.current.value = ''
  }

  async function handleClearAll() {
    await clearTransactions()
    setClearConfirm(false)
    loadSettings()
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-5 space-y-5">

      <div>
        <h1 className="font-serif text-2xl" style={{ color: 'var(--text-heading)' }}>Settings</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-faint)' }}>
          Configure your balance, forecast, and data sync.
        </p>
      </div>

      {/* ── Appearance ─────────────────────────────────────── */}
      <Section title="Appearance">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--text-body)' }}>Theme</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
              {theme === 'dark' ? 'Dark mode is on' : 'Light mode is on'}
            </p>
          </div>
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                       transition-all active:scale-95"
            style={{
              background: theme === 'dark' ? '#1e293b' : '#f1f5f9',
              color:      theme === 'dark' ? '#e2e8f0' : '#334155',
              border:     `1px solid ${theme === 'dark' ? '#334155' : '#e2e8f0'}`,
            }}
          >
            {theme === 'dark'
              ? <><Sun size={15} /> Light mode</>
              : <><Moon size={15} /> Dark mode</>
            }
          </button>
        </div>
      </Section>

      {/* ── Balance & Forecast ─────────────────────────────── */}
      <Section title="Balance &amp; Forecast">
        <div className="space-y-4">
          <div>
            <label className="label">Current checking balance ($)</label>
            <input
              className="input font-mono"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={seedBalance}
              onChange={e => setSeedBalanceUI(e.target.value)}
            />
            {balanceDate && (
              <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                Last updated from import: {formatDate(balanceDate)}
              </p>
            )}
            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
              This is your "seed" — all future projections calculate from here.
            </p>
          </div>

          <div>
            <label className="label">Forecast horizon (days)</label>
            <div className="flex gap-2 flex-wrap">
              {['30','60','90','120','180'].map(d => (
                <button
                  key={d}
                  onClick={() => setForecastDaysUI(d)}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium transition-colors"
                  style={{
                    background: forecastDays === d ? '#124174' : 'var(--bg-subtle)',
                    color:      forecastDays === d ? '#ffffff' : 'var(--text-muted)',
                    border:     `1px solid ${forecastDays === d ? '#124174' : 'var(--border-input)'}`,
                  }}
                >
                  {d}d
                </button>
              ))}
            </div>
            <p className="text-xs mt-2" style={{ color: 'var(--text-faint)' }}>
              How far ahead suggestions and the forecast chart project.
            </p>
          </div>

          <button
            onClick={handleSave}
            className={`btn-primary flex items-center gap-2 transition-all ${saved ? '!bg-emerald-600 hover:!bg-emerald-700' : ''}`}
          >
            {saved ? <><CheckCircle2 size={15} /> Saved!</> : <><Save size={15} /> Save settings</>}
          </button>
        </div>
      </Section>

      {/* ── Your data ──────────────────────────────────────── */}
      {stats && (
        <Section title="Your data">
          <div className="grid grid-cols-2 gap-3">
            <StatTile label="Imported transactions" value={stats.txCount} />
            <StatTile label="Upcoming transactions" value={stats.prosCount} />
            {stats.earliest && <StatTile label="Oldest transaction" value={formatDate(stats.earliest)} />}
            {stats.latest   && <StatTile label="Most recent"        value={formatDate(stats.latest)} />}
          </div>
          <p className="text-xs mt-3 flex items-start gap-1.5" style={{ color: 'var(--text-faint)' }}>
            <Info size={13} className="shrink-0 mt-0.5" />
            All data is stored locally in your browser and never sent anywhere.
          </p>
        </Section>
      )}

      {/* ── Backup & Sync ──────────────────────────────────── */}
      <Section title="Backup &amp; Sync">
        <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
          Export a JSON backup to copy your data to another device or iCloud Drive.
        </p>

        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={handleExport} className="btn-primary flex items-center justify-center gap-2 flex-1">
            <Download size={15} /> Export backup
          </button>
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center justify-center gap-2 flex-1 px-4 py-2 rounded-lg
                       font-medium text-sm active:scale-95 transition-all"
            style={{
              border:     '1px solid var(--border-input)',
              background: 'var(--bg-card)',
              color:      'var(--text-muted)',
            }}
          >
            <Upload size={15} /> Restore from backup
          </button>
          <input ref={fileRef} type="file" accept=".json" className="hidden"
            onChange={e => handleRestore(e.target.files[0])} />
        </div>

        {restoreMsg && (
          <div className={`flex gap-2 mt-3 p-3 rounded-xl text-sm ${
            restoreMsg.ok
              ? 'bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800'
              : 'bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 border border-red-100 dark:border-red-800'
          }`}>
            {restoreMsg.ok
              ? <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              : <AlertCircle  size={16} className="shrink-0 mt-0.5" />
            }
            {restoreMsg.text}
          </div>
        )}

        <div className="mt-4 rounded-xl p-4 space-y-1.5" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-card)' }}>
          <p className="text-xs font-semibold" style={{ color: 'var(--text-body)' }}>Sync tip: iCloud Drive</p>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            Save your export to <strong>iCloud Drive → CashFlow</strong>. Both devices share the same backup file.
          </p>
        </div>
      </Section>

      {/* ── Danger zone ────────────────────────────────────── */}
      <Section title="Danger zone">
        {clearConfirm ? (
          <div className="space-y-3">
            <p className="text-sm text-red-600 dark:text-red-400 font-medium">
              This will permanently delete all imported transactions. Upcoming transactions are kept. Are you sure?
            </p>
            <div className="flex gap-2">
              <button onClick={handleClearAll} className="btn-danger flex-1">Yes, clear history</button>
              <button onClick={() => setClearConfirm(false)} className="btn-ghost">Cancel</button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <button
              onClick={() => setClearConfirm(true)}
              className="flex items-center gap-2 text-sm font-medium text-red-500 hover:text-red-600 transition-colors"
            >
              <Trash2 size={15} /> Clear imported transaction history
            </button>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
              Use this before re-importing a full fresh export to avoid duplicates.
            </p>
          </div>
        )}
      </Section>

      <p className="text-xs text-center pb-4" style={{ color: 'var(--border-input)' }}>
        CashFlow · v1.0 · All data local
      </p>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="card p-5">
      <h2
        className="font-semibold text-sm mb-3"
        style={{ color: 'var(--text-heading)' }}
        dangerouslySetInnerHTML={{ __html: title }}
      />
      {children}
    </div>
  )
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-xl px-3 py-3" style={{ background: 'var(--bg-subtle)', border: '1px solid var(--border-card)' }}>
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{label}</p>
      <p className="font-semibold text-sm mt-0.5 font-mono" style={{ color: 'var(--text-heading)' }}>{value}</p>
    </div>
  )
}
