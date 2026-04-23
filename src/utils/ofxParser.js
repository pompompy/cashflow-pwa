// src/utils/ofxParser.js
// Handles both SGML (OFX 1.x) and XML (OFX 2.x) formats from Ally.
// Times in OFX DTPOSTED are UTC — we convert to ET for storage.

import { generateId, makeSortKey } from './dateUtils'

function tag(block, name) {
  const re = new RegExp(`<${name}>([^<\\n\\r]*)`, 'i')
  const m = block.match(re)
  return m ? m[1].trim() : null
}

// OFX DTPOSTED format: YYYYMMDDHHMMSS[.mmm][+hh:mm or -hh:mm]
// The numeric part after YYYYMMDD is UTC time. We convert to ET.
function ofxDateTime(raw) {
  if (!raw) return { date: null, time: '00:00:00' }
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 8) return { date: null, time: '00:00:00' }

  const year  = parseInt(digits.slice(0, 4))
  const month = parseInt(digits.slice(4, 6)) - 1
  const day   = parseInt(digits.slice(6, 8))
  const hour  = parseInt(digits.slice(8, 10) || '0')
  const min   = parseInt(digits.slice(10, 12) || '0')
  const sec   = parseInt(digits.slice(12, 14) || '0')

  // Build a UTC Date from these components
  const utc = new Date(Date.UTC(year, month, day, hour, min, sec))

  // Convert to ET date
  const etDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(utc)
  // Convert to ET time (24h)
  const etTime = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'America/New_York',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).format(utc)

  return { date: etDate, time: etTime }
}

function dollar(raw) {
  if (raw == null) return null
  const n = parseFloat(String(raw).replace(/[^0-9.\-]/g, ''))
  return isNaN(n) ? null : n
}

export function parseOFX(text) {
  const transactions = []
  let endingBalance = null
  let balanceDate   = null

  const balAmt = tag(text, 'BALAMT')
  if (balAmt !== null) endingBalance = dollar(balAmt)
  const balDt = tag(text, 'DTASOF')
  if (balDt) balanceDate = ofxDateTime(balDt).date

  // Closed-tag format
  const closedRe = /<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi
  let m
  while ((m = closedRe.exec(text)) !== null) {
    const tx = parseTxBlock(m[1])
    if (tx) transactions.push(tx)
  }

  // Open-tag soup fallback
  if (transactions.length === 0) {
    const soupRe = /<STMTTRN>([\s\S]*?)(?=<STMTTRN>|<\/BANKTRNLIST>|$)/gi
    while ((m = soupRe.exec(text)) !== null) {
      const tx = parseTxBlock(m[1])
      if (tx) transactions.push(tx)
    }
  }

  return { transactions, endingBalance, balanceDate }
}

function parseTxBlock(block) {
  const fitId  = tag(block, 'FITID')
  const { date, time } = ofxDateTime(tag(block, 'DTPOSTED'))
  const amtRaw = tag(block, 'TRNAMT')
  const name   = tag(block, 'NAME')  || ''
  const memo   = tag(block, 'MEMO')  || ''
  const type   = (tag(block, 'TRNTYPE') || '').toLowerCase()

  if (!date) return null
  const amount = dollar(amtRaw)
  if (amount === null) return null

  return {
    id:          fitId || generateId(),
    fitId:       fitId || null,
    date,
    time,
    sortKey:     makeSortKey(date, time),
    amount,
    description: (name || memo || type).slice(0, 120),
    memo,
    type,
  }
}
