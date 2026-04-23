// src/utils/recurringDetector.js
// Scans imported transaction history for repeating patterns and projects
// them forward as prospective transaction suggestions.

import { today, addDays, addMonths, daysBetween, generateId } from './dateUtils'

const FREQUENCIES = [
  { label: 'Weekly',       freqKey: 'weekly',      days: 7,   min: 5,   max: 9,   next: d => addDays(d, 7)    },
  { label: 'Bi-weekly',    freqKey: 'biweekly',    days: 14,  min: 11,  max: 17,  next: d => addDays(d, 14)   },
  { label: 'Semi-monthly', freqKey: 'every30',     days: 15,  min: 13,  max: 18,  next: d => addDays(d, 15)   },
  { label: 'Monthly',      freqKey: 'monthly_day', days: 30,  min: 26,  max: 35,  next: d => addMonths(d, 1)  },
  { label: 'Bi-monthly',   freqKey: 'quarterly',   days: 61,  min: 55,  max: 67,  next: d => addMonths(d, 2)  },
  { label: 'Quarterly',    freqKey: 'quarterly',   days: 91,  min: 83,  max: 99,  next: d => addMonths(d, 3)  },
  { label: 'Annual',       freqKey: 'annual',      days: 365, min: 340, max: 390, next: d => addMonths(d, 12) },
]

function classifyFreq(avgDays) {
  return FREQUENCIES.find(f => avgDays >= f.min && avgDays <= f.max) || null
}

function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length }
function stdDev(arr) {
  if (arr.length < 2) return 0
  const m = mean(arr)
  return Math.sqrt(arr.reduce((s, x) => s + (x - m) ** 2, 0) / arr.length)
}

// Levenshtein similarity ratio
function similarity(a, b) {
  const m = a.length, n = b.length
  if (!m || !n) return 0
  const dp = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => i === 0 ? j : j === 0 ? i : 0)
  )
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++)
    dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1])
  return 1 - dp[m][n] / Math.max(m, n)
}

function normalize(desc) {
  return desc
    .replace(/#\w+/g, '')
    .replace(/\b\d{4,}\b/g, '')
    .replace(/\b(PPD|CCD|WEB|TEL|ACH|DEBIT|CREDIT)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase()
    .slice(0, 40)
}

// The effective description to group by: prefer the user's display label
// so that renamed transactions (e.g. "Citi Card 1" vs "Citi Card 2") split correctly.
function effectiveDesc(tx) {
  return (tx.displayDescription && tx.displayDescription.trim())
    ? tx.displayDescription.trim()
    : tx.description
}

// Group transactions by similar effective description.
// If a group has two distinct day-of-month clusters (e.g. always the 2nd or the 16th)
// with a gap of at least 7 days between cluster centres, split it into two groups —
// this handles cases like two credit cards from the same bank with similar names.
function groupTransactions(txns) {
  // Step 1: fuzzy description grouping
  const rawGroups = {}
  for (const tx of txns) {
    const norm = normalize(effectiveDesc(tx))
    if (!norm || norm.length < 3) continue
    let matched = false
    for (const key of Object.keys(rawGroups)) {
      if (similarity(norm, key) > 0.72) { rawGroups[key].push(tx); matched = true; break }
    }
    if (!matched) rawGroups[norm] = [tx]
  }

  // Step 2: within each group, try to split by day-of-month clusters
  const finalGroups = {}
  for (const [key, txList] of Object.entries(rawGroups)) {
    const subGroups = splitByDayOfMonth(key, txList)
    for (const [subKey, subList] of Object.entries(subGroups)) {
      finalGroups[subKey] = subList
    }
  }
  return finalGroups
}

// Detect whether a group of transactions clusters around two distinct days-of-month.
// If so, split into two sub-groups. Otherwise return the group as-is.
function splitByDayOfMonth(key, txList) {
  if (txList.length < 4) return { [key]: txList }

  const days = txList.map(tx => new Date(tx.date + 'T12:00:00').getDate())
  const sorted = [...days].sort((a, b) => a - b)

  // Find the largest gap in sorted day-of-month values
  let maxGap = 0, splitAfterIdx = -1
  for (let i = 0; i < sorted.length - 1; i++) {
    const gap = sorted[i + 1] - sorted[i]
    if (gap > maxGap) { maxGap = gap; splitAfterIdx = i }
  }

  // Only split if the gap between the two clusters is at least 7 days
  // and each cluster would have at least 2 members
  if (maxGap < 7 || splitAfterIdx < 1 || splitAfterIdx >= sorted.length - 2) {
    return { [key]: txList }
  }

  const threshold = sorted[splitAfterIdx]
  const groupA = txList.filter(tx => new Date(tx.date + 'T12:00:00').getDate() <= threshold)
  const groupB = txList.filter(tx => new Date(tx.date + 'T12:00:00').getDate() > threshold)

  if (groupA.length < 2 || groupB.length < 2) return { [key]: txList }

  const centreA = Math.round(mean(groupA.map(tx => new Date(tx.date + 'T12:00:00').getDate())))
  const centreB = Math.round(mean(groupB.map(tx => new Date(tx.date + 'T12:00:00').getDate())))
  return {
    [`${key}~day${centreA}`]: groupA,
    [`${key}~day${centreB}`]: groupB,
  }
}

export function detectRecurring(transactions, forecastDays = 90) {
  const endDate     = addDays(today(), forecastDays)
  const windowStart = addDays(today(), -120)   // last 4 months only
  const windowed    = transactions.filter(t => t.date >= windowStart)
  const groups      = groupTransactions(windowed)
  const results     = []

  for (const [key, txs] of Object.entries(groups)) {
    if (txs.length < 3) continue

    const sorted    = [...txs].sort((a, b) => a.date.localeCompare(b.date))
    const intervals = []
    for (let i = 1; i < sorted.length; i++) {
      const d = daysBetween(sorted[i-1].date, sorted[i].date)
      if (d > 2) intervals.push(d)
    }
    if (!intervals.length) continue

    const avg = mean(intervals)
    const sd  = stdDev(intervals)
    const cv  = avg > 0 ? sd / avg : 1
    if (cv > 0.30) continue

    const freq = classifyFreq(avg)
    if (!freq) continue

    const amounts    = sorted.map(t => t.amount)
    const avgAmt     = mean(amounts)
    const amtCV      = Math.abs(avgAmt) > 0 ? stdDev(amounts) / Math.abs(avgAmt) : 0
    const isVariable = amtCV > 0.06

    const lastTx     = sorted[sorted.length - 1]
    const confidence = Math.min(99, Math.round((1 - cv) * 100))

    const futureDates = []
    let next = freq.next(lastTx.date)
    for (let guard = 0; next <= endDate && guard < 26; guard++, next = freq.next(next))
      futureDates.push(next)

    if (!futureDates.length) continue

    // Display name: use effective desc of last tx (honours user rename)
    const displayName = effectiveDesc(lastTx).trim().slice(0, 80)

    results.push({
      id:            generateId(),
      key,
      description:   displayName,
      amount:        Math.round(avgAmt * 100) / 100,
      isVariable,
      amountMin:     Math.round(Math.min(...amounts) * 100) / 100,
      amountMax:     Math.round(Math.max(...amounts) * 100) / 100,
      frequency:     freq.label,
      freqKey:       freq.freqKey,
      frequencyDays: freq.days,
      lastDate:      lastTx.date,
      futureDates,
      confidence,
      sampleCount:   sorted.length,
    })
  }

  return results.sort((a, b) => b.confidence - a.confidence)
}

export function suggestionToProspective(suggestion) {
  return suggestion.futureDates.map(date => ({
    id:                  generateId(),
    date,
    amount:              suggestion.amount,
    description:         suggestion.description,
    isRecurring:         true,
    frequency:           suggestion.frequency,
    freqKey:             suggestion.freqKey,
    parentSuggestionKey: suggestion.key,
  }))
}
