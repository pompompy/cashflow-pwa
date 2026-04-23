// src/components/AddEditModal.jsx
import { useState, useEffect } from 'react'
import Modal from './Modal'
import { today, addDays, addMonths, generateId, formatDateInput } from '../utils/dateUtils'
import { addProspective, addProspectiveBatch, updateProspective, deleteProspective } from '../db/index'

// Frequency definitions — each has a key, label, group, and a nextDate function
export const FREQ_OPTIONS = [
  { key: 'weekly',       label: 'Weekly',                       group: 'Short',   next: d => addDays(d, 7)    },
  { key: 'biweekly',     label: 'Bi-weekly (every 2 weeks)',    group: 'Short',   next: d => addDays(d, 14)   },
  { key: 'monthly_day',  label: 'Monthly (same calendar day)',  group: 'Monthly', next: d => addMonths(d, 1)  },
  { key: 'every30',      label: 'Every 30 days',                group: 'Monthly', next: d => addDays(d, 30)   },
  { key: 'quarterly',    label: 'Quarterly (every 3 months)',   group: 'Longer',  next: d => addMonths(d, 3)  },
  { key: 'semiannual',   label: 'Semi-annual (every 6 months)', group: 'Longer',  next: d => addMonths(d, 6)  },
  { key: 'annual',       label: 'Annual (yearly)',               group: 'Longer',  next: d => addMonths(d, 12) },
]

export function getFreqOption(key) {
  return FREQ_OPTIONS.find(f => f.key === key) || FREQ_OPTIONS[2]
}

const LEGACY_MAP = {
  'Weekly': 'weekly', 'Bi-weekly': 'biweekly', 'Monthly': 'monthly_day',
  'Quarterly': 'quarterly', 'Annual': 'annual',
  'Semi-monthly': 'every30', 'Bi-monthly': 'quarterly',
}

export function buildFutureDates(startDate, freqKey, forecastDays) {
  const freq    = getFreqOption(freqKey)
  const endDate = addDays(today(), forecastDays)
  const dates   = []
  let d = startDate
  while (d <= endDate && dates.length < 60) {
    dates.push(d)
    d = freq.next(d)
  }
  return dates
}

const BLANK = { description: '', amount: '', direction: 'expense', date: today(), time: '00:01', isRecurring: false, freqKey: 'monthly_day' }

export default function AddEditModal({ open, onClose, existing, onSaved, forecastDays = 90 }) {
  const [form,          setForm]          = useState(BLANK)
  const [saving,        setSaving]        = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState(false)

  useEffect(() => {
    if (!open) return
    if (existing) {
      const freqKey = existing.freqKey || LEGACY_MAP[existing.frequency] || 'monthly_day'
      setForm({
        description: existing.description,
        amount:      String(Math.abs(existing.amount)),
        direction:   existing.amount >= 0 ? 'income' : 'expense',
        date:        existing.date,
        time:        existing.time ? existing.time.slice(0,5) : '00:01',
        isRecurring: existing.isRecurring || false,
        freqKey,
      })
    } else {
      setForm({ ...BLANK })
    }
    setDeleteConfirm(false)
  }, [open, existing])

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const freq         = getFreqOption(form.freqKey)
  const previewDates = form.isRecurring && form.date ? buildFutureDates(form.date, form.freqKey, forecastDays) : []
  const groups       = [...new Set(FREQ_OPTIONS.map(f => f.group))]

  async function handleSave() {
    if (!form.description.trim() || !form.amount) return
    setSaving(true)
    try {
      const rawAmount = parseFloat(form.amount) || 0
      const amount    = form.direction === 'expense' ? -Math.abs(rawAmount) : Math.abs(rawAmount)

      const timeStr = (form.time || '00:01').length === 5 ? form.time + ':00' : (form.time || '00:01:00')

      if (existing) {
        await updateProspective(existing.id, {
          description: form.description.trim(), amount, date: form.date, time: timeStr,
          isRecurring: form.isRecurring,
          freqKey:   form.isRecurring ? form.freqKey : null,
          frequency: form.isRecurring ? freq.label   : null,
        })
      } else if (form.isRecurring) {
        const txns = buildFutureDates(form.date, form.freqKey, forecastDays).map(date => ({
          id: generateId(), date, time: timeStr, amount, description: form.description.trim(),
          isRecurring: true, freqKey: form.freqKey, frequency: freq.label, parentSuggestionKey: null,
        }))
        await addProspectiveBatch(txns)
      } else {
        await addProspective({
          id: generateId(), date: form.date, time: timeStr, amount, description: form.description.trim(),
          isRecurring: false, freqKey: null, frequency: null, parentSuggestionKey: null,
        })
      }
      onSaved?.()
      onClose()
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!existing) return
    await deleteProspective(existing.id)
    onSaved?.()
    onClose()
  }

  const valid = form.description.trim().length > 0 && parseFloat(form.amount) > 0

  return (
    <Modal open={open} onClose={onClose} title={existing ? 'Edit Transaction' : 'Add Transaction'}>
      <div className="space-y-4">

        {/* Income / Expense toggle */}
        <div>
          <span className="label">Type</span>
          <div className="flex rounded-lg overflow-hidden border border-slate-200">
            {['income','expense'].map(d => (
              <button key={d} onClick={() => set('direction', d)}
                className={`flex-1 py-2 text-sm font-medium transition-colors ${
                  form.direction === d
                    ? d === 'income' ? 'bg-emerald-600 text-white' : 'bg-red-500 text-white'
                    : 'bg-white text-slate-400 hover:bg-slate-50'
                }`}
              >
                {d === 'income' ? '+ Income / Deposit' : '− Expense / Payment'}
              </button>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="label">Description</label>
          <input className="input" placeholder="e.g. Mortgage Payment" value={form.description}
            onChange={e => set('description', e.target.value)} />
        </div>

        {/* Amount */}
        <div>
          <label className="label">Amount ($)</label>
          <input className="input font-mono" type="number" min="0" step="0.01" placeholder="0.00"
            value={form.amount} onChange={e => set('amount', e.target.value)} />
        </div>

        {/* Date + Time row */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="label">{form.isRecurring ? 'First occurrence' : 'Date'}</label>
            <input className="input" type="date" value={formatDateInput(form.date)}
              onChange={e => set('date', e.target.value)} />
          </div>
          {!form.isRecurring && (
            <div className="w-32">
              <label className="label">Time (ET)</label>
              <input className="input font-mono text-sm" type="time" value={form.time || '00:01'}
                onChange={e => set('time', e.target.value)} />
            </div>
          )}
        </div>

        {/* Recurring toggle */}
        <div>
          <label className="flex items-center gap-2.5 cursor-pointer select-none">
            <div onClick={() => set('isRecurring', !form.isRecurring)}
              className={`w-10 h-6 rounded-full transition-colors relative ${form.isRecurring ? 'bg-navy-700' : 'bg-slate-200'}`}>
              <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isRecurring ? 'translate-x-5' : 'translate-x-1'}`} />
            </div>
            <span className="text-sm font-medium text-slate-700">Recurring</span>
          </label>

          {form.isRecurring && (
            <div className="mt-3 space-y-3">
              <div>
                <label className="label">Frequency</label>
                <select className="input" value={form.freqKey} onChange={e => set('freqKey', e.target.value)}>
                  {groups.map(g => (
                    <optgroup key={g} label={g}>
                      {FREQ_OPTIONS.filter(f => f.group === g).map(f => (
                        <option key={f.key} value={f.key}>{f.label}</option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>

              {previewDates.length > 0 && (
                <div className="bg-slate-50 rounded-xl p-3">
                  <p className="text-xs font-medium text-slate-500 mb-2">
                    {previewDates.length} occurrences over the next {forecastDays} days
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {previewDates.slice(0, 8).map(d => (
                      <span key={d} className="text-xs bg-white border border-slate-200 text-slate-600 px-2 py-0.5 rounded-md font-mono">{d}</span>
                    ))}
                    {previewDates.length > 8 && (
                      <span className="text-xs text-slate-400 self-center">+{previewDates.length - 8} more</span>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          {existing && (
            deleteConfirm
              ? <><button onClick={handleDelete} className="btn-danger flex-1">Confirm Delete</button>
                  <button onClick={() => setDeleteConfirm(false)} className="btn-ghost">Cancel</button></>
              : <button onClick={() => setDeleteConfirm(true)} className="btn-danger">Delete</button>
          )}
          <div className="flex-1" />
          <button onClick={onClose} className="btn-ghost">Cancel</button>
          <button onClick={handleSave} disabled={!valid || saving} className="btn-primary">
            {saving ? 'Saving…' : existing ? 'Save' : form.isRecurring ? `Add ${previewDates.length} entries` : 'Add'}
          </button>
        </div>

      </div>
    </Modal>
  )
}
