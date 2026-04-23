// src/utils/csvParser.js
// Ally CSV columns: Date, Time, Amount, Type, Description
// Time column is in Eastern Time (ET), which is what we store everywhere.

import { deterministicId, makeSortKey } from './dateUtils'

function splitCSV(line) {
  const cols = []
  let cur = '', inQ = false
  for (const ch of line) {
    if (ch === '"') { inQ = !inQ }
    else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = '' }
    else { cur += ch }
  }
  cols.push(cur.trim())
  return cols.map(c => c.replace(/^"|"$/g, '').trim())
}

// MM/DD/YYYY → YYYY-MM-DD
function allyDate(raw) {
  if (!raw) return null
  const p = raw.split('/')
  if (p.length === 3) return `${p[2]}-${p[0].padStart(2,'0')}-${p[1].padStart(2,'0')}`
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw
  return null
}

// Parse Ally time string — they export as "HH:MM:SS" or "H:MM:SS AM/PM"
// We store everything as 24-hour HH:MM:SS (ET wall clock)
function allyTime(raw) {
  if (!raw) return '00:00:00'
  const clean = raw.trim()

  // Already 24-hour: HH:MM:SS
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(clean)) {
    const [h, m, s] = clean.split(':').map(Number)
    return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`
  }

  // 12-hour with AM/PM: "2:30:00 PM"
  const ampmMatch = clean.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i)
  if (ampmMatch) {
    let h = parseInt(ampmMatch[1], 10)
    const m = ampmMatch[2]
    const s = ampmMatch[3] || '00'
    const ampm = ampmMatch[4].toUpperCase()
    if (ampm === 'PM' && h !== 12) h += 12
    if (ampm === 'AM' && h === 12) h = 0
    return `${String(h).padStart(2,'0')}:${m}:${s}`
  }

  return '00:00:00'
}

function parseDollar(raw) {
  if (!raw) return null
  const n = parseFloat(raw.replace(/[$,\s]/g, ''))
  return isNaN(n) ? null : n
}

export function parseAllyCSV(text) {
  const lines = text.split('\n').map(l => l.replace(/\r/g, '').trim()).filter(Boolean)
  if (lines.length < 2) return { transactions: [], endingBalance: null }

  // Find header row (contains "date" and "amount")
  let hi = -1
  for (let i = 0; i < Math.min(lines.length, 8); i++) {
    if (lines[i].toLowerCase().includes('date') && lines[i].toLowerCase().includes('amount')) {
      hi = i; break
    }
  }
  if (hi === -1) return { transactions: [], endingBalance: null }

  const headers = splitCSV(lines[hi]).map(h => h.toLowerCase())
  const col = (...names) => {
    for (const n of names) {
      const i = headers.findIndex(h => h.includes(n))
      if (i >= 0) return i
    }
    return -1
  }

  const dateIdx = col('date')
  const timeIdx = col('time')
  const amtIdx  = col('amount')
  const typeIdx = col('type')
  const descIdx = col('description', 'memo', 'name')

  const transactions = []

  for (let i = hi + 1; i < lines.length; i++) {
    const cols   = splitCSV(lines[i])
    const date   = allyDate(cols[dateIdx])
    const amount = parseDollar(cols[amtIdx])
    if (!date || amount == null) continue

    const time = timeIdx >= 0 ? allyTime(cols[timeIdx]) : '00:00:00'
    const desc = (descIdx >= 0 ? cols[descIdx] : '') ||
                 (typeIdx  >= 0 ? cols[typeIdx]  : '') || 'Transaction'
    const type = typeIdx >= 0 ? cols[typeIdx].toLowerCase() : ''

    transactions.push({
      id:          deterministicId(date, time, amount, desc),
      fitId:       null,
      date,
      time,
      sortKey:     makeSortKey(date, time),
      amount,
      description: desc.slice(0, 120),
      memo:        '',
      type,
    })
  }

  return { transactions, endingBalance: null }
}
