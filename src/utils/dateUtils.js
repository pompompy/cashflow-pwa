// src/utils/dateUtils.js
// All "today" and "now" values are in America/New_York (ET, DST-aware).

// ── ET date/time helpers ──────────────────────────────────────────────────────

// Returns YYYY-MM-DD in Eastern Time
export const today = () =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())

// Returns HH:MM:SS in Eastern Time
export function nowTimeET() {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(new Date())
}

// YYYY-MM-DDTHH:MM:SS sort key in ET — use for stable chronological ordering
export function nowSortKeyET() {
  return today() + 'T' + nowTimeET()
}

// Build a sortKey from a date string and an optional time string
export function makeSortKey(dateStr, timeStr = '00:00:00') {
  return (dateStr || today()) + 'T' + (timeStr || '00:00:00')
}

// ── Date arithmetic ───────────────────────────────────────────────────────────

export function addDays(dateStr, days) {
  // Noon local avoids DST edge cases for pure date arithmetic
  const d = new Date(dateStr + 'T12:00:00')
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

export function daysBetween(d1, d2) {
  const t1 = new Date(d1 + 'T12:00:00').getTime()
  const t2 = new Date(d2 + 'T12:00:00').getTime()
  return Math.round((t2 - t1) / 86_400_000)
}

// Advance by N calendar months, keeping same day-of-month (clamped to month end)
export function addMonths(dateStr, months) {
  const d = new Date(dateStr + 'T12:00:00')
  const targetMonth = d.getMonth() + months
  const year  = d.getFullYear() + Math.floor(targetMonth / 12)
  const month = ((targetMonth % 12) + 12) % 12
  const day   = d.getDate()
  const maxDay = new Date(year, month + 1, 0).getDate()
  return new Date(year, month, Math.min(day, maxDay)).toISOString().split('T')[0]
}

// ── Formatting ────────────────────────────────────────────────────────────────

export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function formatDateShort(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatDateInput(dateStr) {
  return dateStr ? dateStr.slice(0, 10) : today()
}

// Display a stored HH:MM:SS time string as "2:30 PM"
export function formatTime(timeStr) {
  if (!timeStr) return ''
  const [hStr, mStr] = timeStr.split(':')
  const h = parseInt(hStr, 10)
  const m = mStr || '00'
  const ampm = h >= 12 ? 'PM' : 'AM'
  const hour = h % 12 || 12
  return `${hour}:${m} ${ampm}`
}

export function formatCurrency(amount, showSign = false) {
  const abs = Math.abs(amount)
  const str = abs.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
  if (showSign && amount > 0) return '+' + str
  if (amount < 0) return '−' + str
  return str
}

export function formatCurrencyCompact(amount) {
  const abs = Math.abs(amount)
  const str = abs >= 1000 ? '$' + (abs / 1000).toFixed(1) + 'k' : '$' + abs.toFixed(0)
  return amount < 0 ? '−' + str : str
}

export function isFuture(dateStr)  { return dateStr >  today() }
export function isToday(dateStr)   { return dateStr === today() }
export function isPast(dateStr)    { return dateStr <  today() }

export function getMonthLabel(dateStr) {
  const d = new Date(dateStr + 'T12:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

// ── ID generation ─────────────────────────────────────────────────────────────

export function deterministicId(...parts) {
  const str = parts.join('|').toLowerCase().trim()
  let h = 0
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(31, h) + str.charCodeAt(i) | 0
  }
  return 'csv_' + Math.abs(h).toString(36) + str.length.toString(36)
}

export function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 9)
}
