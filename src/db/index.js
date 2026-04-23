// src/db/index.js — All data stays in IndexedDB on-device.

import Dexie from 'dexie'
import { today, daysBetween, makeSortKey, generateId } from '../utils/dateUtils'

export const db = new Dexie('CashflowDB')

// v1 — original schema (no sortKey)
db.version(1).stores({
  transactions: 'id, date, fitId',
  prospective:  'id, date, status, parentSuggestionKey',
  settings: 'key',
})

// v2 — add sortKey index; migrate existing rows with a default sortKey
db.version(2).stores({
  transactions: 'id, date, sortKey, fitId',
  prospective:  'id, date, status, parentSuggestionKey',
  settings: 'key',
}).upgrade(tx => {
  return tx.table('transactions').toCollection().modify(record => {
    if (!record.sortKey) {
      record.time    = record.time || '00:00:00'
      record.sortKey = makeSortKey(record.date, record.time)
    }
  })
})

// v3 — dedicated table for persisted suggestion review decisions
db.version(3).stores({
  transactions:      'id, date, sortKey, fitId',
  prospective:       'id, date, status, parentSuggestionKey',
  settings:          'key',
  suggestionReviews: 'key',   // key = suggestion.key, decision = 'accepted'|'dismissed'
})

// ─── Transactions ─────────────────────────────────────────────────────────────

// Standard import — silently skips exact dupes, returns counts
export async function importTransactions(txList) {
  let inserted = 0, skipped = 0
  for (const tx of txList) {
    try {
      if (tx.fitId) {
        const found = await db.transactions.where('fitId').equals(tx.fitId).first()
        if (found) { skipped++; continue }
      } else {
        const found = await db.transactions.get(tx.id)
        if (found) { skipped++; continue }
      }
      // Ensure sortKey is set
      const record = { ...tx, sortKey: tx.sortKey || makeSortKey(tx.date, tx.time || '00:00:00') }
      await db.transactions.add(record)
      inserted++
    } catch { skipped++ }
  }
  return { inserted, skipped }
}

// Smart import — exact dupes skipped, near-dupes returned for user review
export async function smartImportTransactions(txList) {
  const existing = await db.transactions.toArray()
  const inserted = []
  const skipped  = []
  const needsReview = []   // [{ incoming, existing }]

  for (const tx of txList) {
    // 1. fitId exact dupe
    if (tx.fitId && existing.find(e => e.fitId === tx.fitId)) {
      skipped.push(tx); continue
    }

    // 2. Full exact match: date + time + amount + type + description
    const normDesc = d => (d || '').toLowerCase().replace(/\s+/g,' ').trim()
    const exact = existing.find(e =>
      e.date   === tx.date &&
      (e.time || '00:00:00') === (tx.time || '00:00:00') &&
      Math.abs(e.amount - tx.amount) < 0.005 &&
      (e.type  || '') === (tx.type || '') &&
      normDesc(e.description) === normDesc(tx.description)
    )
    if (exact) { skipped.push(tx); continue }

    // 3. Near-dupe: same amount + description, dates within 2 days
    const near = existing.find(e => {
      if (Math.abs(e.amount - tx.amount) >= 0.005) return false
      if (normDesc(e.description) !== normDesc(tx.description)) return false
      return Math.abs(daysBetween(e.date, tx.date)) <= 2
    })
    if (near) {
      needsReview.push({ incoming: tx, existing: near })
      continue
    }

    // 4. Insert
    try {
      const record = { ...tx, sortKey: tx.sortKey || makeSortKey(tx.date, tx.time || '00:00:00') }
      await db.transactions.add(record)
      inserted.push(tx)
    } catch { skipped.push(tx) }
  }

  return { inserted: inserted.length, skipped: skipped.length, needsReview }
}

// Force-insert a single transaction (used after user confirms a near-dupe)
export async function forceInsertTransaction(tx) {
  const record = { ...tx, sortKey: tx.sortKey || makeSortKey(tx.date, tx.time || '00:00:00') }
  await db.transactions.put(record)
}

export function getAllTransactions() {
  return db.transactions.orderBy('sortKey').reverse().toArray()
}

export function getRecentTransactions(sinceDate) {
  return db.transactions.where('date').aboveOrEqual(sinceDate).sortBy('sortKey')
}

export async function clearTransactions() {
  await db.transactions.clear()
}

export async function updateTransactionDisplay(id, displayDescription) {
  await db.transactions.update(id, { displayDescription: displayDescription.trim() })
}

export async function getDateRange() {
  const all = await db.transactions.orderBy('sortKey').keys()
  if (!all.length) return { earliest: null, latest: null }
  // sortKey is YYYY-MM-DDTHH:MM:SS, first 10 chars = date
  return { earliest: all[0].slice(0, 10), latest: all[all.length - 1].slice(0, 10) }
}

// Returns the most recent transaction record (for balance-as-of display)
export async function getLatestTransaction() {
  const all = await db.transactions.orderBy('sortKey').last()
  return all || null
}

// ─── Prospective ──────────────────────────────────────────────────────────────

export function getActiveProspective() {
  return db.prospective
    .where('status').equals('active')
    .sortBy('date')
}

export async function addProspective(tx) {
  await db.prospective.add({
    ...tx,
    time:      tx.time || '00:01:00',
    status:    'active',
    createdAt: new Date().toISOString(),
  })
}

export async function addProspectiveBatch(txList) {
  await db.prospective.bulkAdd(
    txList.map(tx => ({
      ...tx,
      time:      tx.time || '00:01:00',
      status:    'active',
      createdAt: new Date().toISOString(),
    })),
    { allKeys: true }
  )
}

export async function updateProspective(id, fields) {
  await db.prospective.update(id, fields)
}

export async function deleteProspective(id) {
  await db.prospective.delete(id)
}

export async function dismissSuggestionGroup(key) {
  await db.prospective
    .where('parentSuggestionKey').equals(key)
    .and(tx => tx.status === 'active')
    .delete()
}

// Prospective dated strictly before today (past-dated, not including today)
export function getPastDatedProspective() {
  return db.prospective
    .where('status').equals('active')
    .and(tx => tx.date < today())
    .toArray()
}

export async function clearProspectiveBatch(ids) {
  await db.prospective.bulkDelete(ids)
}

// Discard prospective entries entirely without committing (orphaned/wrong entries)
export async function discardProspectiveBatch(ids) {
  await db.prospective.bulkDelete(ids)
}

// Commit a list of prospective transactions into transaction history.
// Moves each record to the transactions table and adjusts seedBalance.
export async function commitProspectiveToHistory(ids) {
  const records = await Promise.all(ids.map(id => db.prospective.get(id)))
  const valid   = records.filter(Boolean)

  // Read current seed balance
  const seedRow  = await db.settings.get('seedBalance')
  let   seed     = parseFloat(seedRow?.value || '0') || 0

  for (const tx of valid) {
    const record = {
      id:          tx.id,
      fitId:       null,
      date:        tx.date,
      time:        tx.time || '00:01:00',
      sortKey:     makeSortKey(tx.date, tx.time || '00:01:00'),
      amount:      tx.amount,
      description: tx.description,
      memo:        '',
      type:        tx.amount >= 0 ? 'credit' : 'debit',
      displayDescription: tx.displayDescription || null,
      committedFromProspective: true,
    }
    // put() overwrites if id already exists (idempotent)
    await db.transactions.put(record)
    await db.prospective.delete(tx.id)
    // Balance adjusts: committed transaction is now "cleared"
    seed += tx.amount
  }

  await db.settings.put({ key: 'seedBalance', value: String(Math.round(seed * 100) / 100) })
  return { committed: valid.length }
}

// ─── Suggestion reviews (persisted accept/dismiss) ────────────────────────────

export async function getSuggestionReviews() {
  return db.suggestionReviews.toArray()          // [{key, decision}]
}

export async function saveSuggestionReview(key, decision) {
  await db.suggestionReviews.put({ key, decision })
}

export async function clearSuggestionReviews() {
  await db.suggestionReviews.clear()
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export async function getSetting(key, fallback = null) {
  const row = await db.settings.get(key)
  return row ? row.value : fallback
}

export async function setSetting(key, value) {
  await db.settings.put({ key, value: String(value) })
}

// ─── Backup / Restore ─────────────────────────────────────────────────────────

export async function exportBackup() {
  const [transactions, prospective, settingsRows] = await Promise.all([
    db.transactions.toArray(),
    db.prospective.toArray(),
    db.settings.toArray(),
  ])
  return JSON.stringify({
    version: 2, exportedAt: new Date().toISOString(),
    transactions, prospective, settingsRows,
  }, null, 2)
}

export async function importBackup(jsonString) {
  const data = JSON.parse(jsonString)
  if (!data.version || !Array.isArray(data.transactions)) throw new Error('Invalid backup file')
  await db.transaction('rw', db.transactions, db.prospective, db.settings, async () => {
    await db.transactions.bulkPut(data.transactions)
    await db.prospective.bulkPut(data.prospective || [])
    for (const row of (data.settingsRows || [])) await db.settings.put(row)
  })
  return { transactions: data.transactions.length, prospective: (data.prospective || []).length }
}
