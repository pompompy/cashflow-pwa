#!/usr/bin/env python3
"""
Generate anonymized sample Ally checking-account CSV for the cashflow-pwa demo.

Everything is fictional: fictional persona, fictional employer, realistic but
invented merchants, amounts, and dates. Deterministic — re-running with the
same SEED produces the identical file.

The data is designed to exercise the app's headline features:
  * recurring-transaction detection (weekly / bi-weekly / monthly patterns,
    fixed vs variable amounts, and the two-day-cluster split for two autopays
    from the same bank)
  * near-duplicate review on import (one intentional Trader Joe's pair)
  * 90-day forward projection from detected patterns

Usage:
    python3 generate_sample_data.py [output.csv] [--shift-days N]

    --shift-days N shifts every transaction date forward by N days. Useful to
    refresh the sample later: the app's detector only scans the trailing 120
    days, so shifting keeps the demo data "current".
"""

import csv
import random
import calendar
import re
import sys
from datetime import date, timedelta

SEED = 20261009
random.seed(SEED)

START = date(2025, 10, 15)
END = date(2026, 10, 5)

rows = []  # (date, time, amount, type, description)


def rand_time():
    return f"{random.randint(0, 23):02d}:{random.randint(0, 59):02d}:{random.randint(0, 59):02d}"


def add(d, amount, typ, desc, time=None):
    assert START <= d <= END, f"date out of range: {d}"
    # Ally exports debits as negative amounts; the app derives credit/debit
    # from the sign, so store them signed here.
    signed = -abs(amount) if typ == "Debit" else abs(amount)
    rows.append((d, time or rand_time(), round(signed, 2), typ, desc))


def every_n_days(start, n, desc, amount_fn, typ="Debit", j=1):
    """Recurring item every n days with +/-j day jitter."""
    d = start
    while d <= END:
        if d >= START:
            dd = min(max(d + timedelta(days=random.randint(-j, j)), START), END)
            add(dd, amount_fn(), typ, desc)
        d += timedelta(days=n)


def monthly(day, desc, amount_fn, typ="Debit", j=1):
    """Recurring item near `day` of each month with +/-j day jitter."""
    y, m = 2025, 10
    while (y, m) <= (2026, 10):
        last = calendar.monthrange(y, m)[1]
        dd = max(1, min(day + random.randint(-j, j), last))
        d = date(y, m, dd)
        if START <= d <= END:
            add(d, amount_fn(), typ, desc)
        m += 1
        if m == 13:
            m, y = 1, y + 1


def fixed(v):
    return lambda: v


def uniform(a, b):
    return lambda: round(random.uniform(a, b), 2)


# ── Income ──────────────────────────────────────────────────────────────────
every_n_days(date(2025, 10, 17), 14, "ACME CORP PAYROLL PPD",
             fixed(2850.00), typ="Credit", j=1)

# ── Monthly bills ───────────────────────────────────────────────────────────
monthly(1,  "EVERGREEN MORTGAGE SVC WEB", fixed(1489.00))
monthly(14, "GREAT LAKES POWER CCD",     uniform(95, 168), j=2)
monthly(21, "CITY WATER DEPT WEB",       uniform(38, 64), j=2)
monthly(9,  "SPECTRUM INTERNET WEB",     fixed(79.99))
monthly(12, "TMOBILE AUTO PAY WEB",      fixed(85.00), j=2)
monthly(7,  "NETFLIX.COM CCD",           fixed(15.49))
monthly(23, "SPOTIFY USA CCD",           fixed(11.99), j=2)
monthly(4,  "PLANET FITNESS CCD",        fixed(24.99))
monthly(26, "PROGRESSIVE INS PPD",       fixed(142.50), j=2)
monthly(28, "TRANSFER TO SAVINGS",       fixed(900.00))

# Two autopays from the same (fictional) bank on different days of the month.
# The app's detector splits these into two groups by day-of-month cluster.
monthly(4,  "FIRST NATIONAL CARD AUTOPAY WEB", uniform(900, 1150))
monthly(19, "FIRST NATIONAL CARD AUTOPAY WEB", uniform(480, 660))

# ── Groceries & gas ─────────────────────────────────────────────────────────
every_n_days(date(2025, 10, 16), 7,  "TRADER JOES #4521", uniform(105, 180))
every_n_days(date(2025, 10, 20), 7,  "SHELL #5742",        uniform(38, 58))

# ── Quarterly / annual (realistic history; too sparse to trigger detection) ──
every_n_days(date(2025, 11, 9), 91, "COSTCO WHOLESALE #1102", uniform(120, 240), j=3)
add(date(2026, 3, 12), 139.00, "Debit", "AMAZON PRIME*PM3XK9")

# ── One-offs: irregular on purpose so they do NOT read as recurring ──────────
one_offs = [
    # (date, amount, description)
    (date(2025, 10, 18), 42.18,  "CHIPOTLE #8834"),
    (date(2025, 10, 25), 67.90,  "PANERA BREAD #2210"),
    (date(2025, 11, 2),  112.44, "AMAZON.COM*7H2KD9Q1"),
    (date(2025, 11, 14), 5.75,   "STARBUCKS #77120"),
    (date(2025, 11, 29), 214.07, "BEST BUY #42"),
    (date(2025, 12, 6),  88.30,  "MEIJER #88"),
    (date(2025, 12, 13), 6.25,   "STARBUCKS #77120"),
    (date(2025, 12, 20), 156.99, "AMAZON.COM*3M9XD2P4"),
    (date(2026, 1, 9),   74.52,  "CVS PHARMACY #8821"),
    (date(2026, 1, 17),  38.40,  "DOMINOS #114"),
    (date(2026, 1, 30),  5.95,   "STARBUCKS #77120"),
    (date(2026, 2, 8),   96.12,  "TARGET #T0932"),
    (date(2026, 2, 21),  143.66, "HOME DEPOT #4410"),
    (date(2026, 3, 5),   289.00, "DELTA AIR 0068192"),
    (date(2026, 3, 19),  412.55, "AIRBNB *HM84K2"),
    (date(2026, 4, 2),   2400.00,"IRS TREASURY 310 TAX PAYMENT"),
    (date(2026, 4, 11),  6.10,   "STARBUCKS #77120"),
    (date(2026, 4, 18),  178.23, "AMAZON.COM*9Q1ZZ7T2"),
    (date(2026, 4, 25),  45.00,  "CITY MEDICAL CTR"),
    (date(2026, 5, 7),   52.77,  "CHIPOTLE #8834"),
    (date(2026, 5, 16),  18.40,  "UBER *TRIP HELP"),
    (date(2026, 5, 30),  134.89, "TARGET #T0932"),
    (date(2026, 6, 13),  71.20,  "PANERA BREAD #2210"),
    (date(2026, 6, 27),  199.99, "AMAZON.COM*2W8NP5R6"),
    (date(2026, 7, 4),   86.45,  "MEIJER #88"),
    (date(2026, 7, 18),  45.00,  "CITY MEDICAL CTR"),
    (date(2026, 7, 25),  6.35,   "STARBUCKS #77120"),
    (date(2026, 8, 1),   165.40, "HOME DEPOT #4410"),
    (date(2026, 8, 15),  58.19,  "DOMINOS #114"),
    (date(2026, 8, 22),  121.77, "AMAZON.COM*5K3DM8W1"),
    (date(2026, 8, 29),  152.00, "STATE OF MICHIGAN SOS VEH REG"),
    (date(2026, 9, 6),   22.75,  "UBER *TRIP HELP"),
    (date(2026, 9, 20),  94.60,  "CHIPOTLE #8834"),
    (date(2026, 9, 26),  187.34, "AMAZON.COM*8T4BN2K7"),
    (date(2026, 10, 2),  63.28,  "CVS PHARMACY #8821"),
]
for d, amt, desc in one_offs:
    add(d, amt, "Debit", desc)

# ── Intentional near-duplicate pair (same amount + description, 1 day apart)
#     Lets users try the app's near-dupe review flow on import. ──────────────
add(date(2026, 9, 11), 112.47, "Debit", "TRADER JOES #4521", time="18:42:10")
add(date(2026, 9, 12), 112.47, "Debit", "TRADER JOES #4521", time="09:15:44")


def main():
    args = sys.argv[1:]
    shift = 0
    if "--shift-days" in args:
        i = args.index("--shift-days")
        shift = int(args[i + 1])
        del args[i:i + 2]
    out = args[0] if args else "ally-checking-sample.csv"

    global rows
    first_day = START + timedelta(days=shift)
    if shift:
        rows = [(d + timedelta(days=shift), t, a, ty, de) for d, t, a, ty, de in rows]

    ordered = sorted(rows, key=lambda r: (r[0], r[1]))
    with open(out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["Date", "Time", "Amount", "Type", "Description"])
        for d, t, amt, typ, desc in ordered:
            w.writerow([d.strftime("%m/%d/%Y"), t, f"{amt:.2f}", typ, desc])
    total = sum(r[2] for r in ordered)  # credits positive, debits negative
    print(f"wrote {out}: {len(ordered)} rows, {ordered[0][0]} to {ordered[-1][0]}")
    print(f"net total of transactions: ${total:,.2f}")
    print(f"suggested seed balance as of {first_day} for ~$6,000 ending: "
          f"${round(6000 - total):,}")


# ── Validation: mimic the app's recurring detector ──────────────────────────
def _normalize(desc):
    d = re.sub(r"#\w+", "", desc)
    d = re.sub(r"\b\d{4,}\b", "", d)
    d = re.sub(r"\b(PPD|CCD|WEB|TEL|ACH|DEBIT|CREDIT)\b", "", d, flags=re.I)
    return re.sub(r"\s+", " ", d).strip().upper()[:40]


def _similarity(a, b):
    m, n = len(a), len(b)
    if not m or not n:
        return 0
    dp = [[0] * (n + 1) for _ in range(m + 1)]
    for i in range(m + 1):
        dp[i][0] = i
    for j in range(n + 1):
        dp[0][j] = j
    for i in range(1, m + 1):
        for j in range(1, n + 1):
            dp[i][j] = dp[i - 1][j - 1] if a[i - 1] == b[j - 1] else 1 + min(
                dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    return 1 - dp[m][n] / max(m, n)


def _mean(xs):
    return sum(xs) / len(xs)


def _sd(xs):
    m = _mean(xs)
    return (sum((x - m) ** 2 for x in xs) / len(xs)) ** 0.5 if len(xs) > 1 else 0


def _split_day(key, txs):
    if len(txs) < 4:
        return {key: txs}
    days = sorted(r[0].day for r in txs)
    gaps = [(days[i + 1] - days[i], i) for i in range(len(days) - 1)]
    max_gap, idx = max(gaps)
    if max_gap < 7 or idx < 1 or idx >= len(days) - 2:
        return {key: txs}
    thr = days[idx]
    a = [r for r in txs if r[0].day <= thr]
    b = [r for r in txs if r[0].day > thr]
    if len(a) < 2 or len(b) < 2:
        return {key: txs}
    ca = round(_mean([r[0].day for r in a]))
    cb = round(_mean([r[0].day for r in b]))
    return {f"{key}~day{ca}": a, f"{key}~day{cb}": b}


def validate():
    """Replicates src/utils/recurringDetector.js against the generated rows."""
    as_of = date(2026, 10, 9)  # pretend "today" is real today
    window_start = as_of - timedelta(days=120)
    txs = [r for r in rows if r[0] >= window_start]

    groups = {}
    for r in txs:
        norm = _normalize(r[4])
        if not norm or len(norm) < 3:
            continue
        hit = next((k for k in groups if _similarity(norm, k) > 0.72), None)
        (groups[hit] if hit else groups.setdefault(norm, [])).append(r)

    final = {}
    for k, v in groups.items():
        final.update(_split_day(k, v))

    buckets = [(5, 9, "weekly"), (11, 17, "biweekly"), (13, 18, "semi-monthly"),
               (26, 35, "monthly"), (55, 67, "bimonthly"), (83, 99, "quarterly"),
               (340, 390, "annual")]
    detected = {}
    for key, txs in final.items():
        if len(txs) < 3:
            continue
        srt = sorted(txs, key=lambda r: r[0])
        iv = [(srt[i][0] - srt[i - 1][0]).days for i in range(1, len(srt))]
        iv = [d for d in iv if d > 2]
        if not iv:
            continue
        avg, sd = _mean(iv), _sd(iv)
        if avg == 0 or sd / avg > 0.30:
            continue
        bkt = next((n for lo, hi, n in buckets if lo <= avg <= hi), None)
        if not bkt:
            continue
        amts = [r[2] for r in srt]
        variable = (_sd(amts) / abs(_mean(amts)) > 0.06) if _mean(amts) else False
        detected[key] = (bkt, len(srt), "variable" if variable else "fixed")

    print("\nDetected recurring groups (mimicking the app's detector):")
    for k in sorted(detected):
        print(f"  {k:45s} {detected[k][0]:12s} n={detected[k][1]:2d} {detected[k][2]}")

    base = {k.split("~")[0] for k in detected}
    expected = {"ACME CORP PAYROLL", "EVERGREEN MORTGAGE SVC", "GREAT LAKES POWER",
                "CITY WATER DEPT", "SPECTRUM INTERNET", "TMOBILE AUTO PAY",
                "NETFLIX.COM", "SPOTIFY USA", "PLANET FITNESS",
                "FIRST NATIONAL CARD AUTOPAY", "PROGRESSIVE INS", "TRADER JOES",
                "SHELL", "TRANSFER TO SAVINGS"}
    missing = expected - base
    extra = base - expected
    split_ok = sum(1 for k in detected if k.startswith("FIRST NATIONAL CARD AUTOPAY")) == 2
    ok = not missing and not extra and split_ok
    print(f"\nmissing: {sorted(missing) or 'none'}")
    print(f"unexpected: {sorted(extra) or 'none'}")
    print(f"autopay day-cluster split into 2 groups: {split_ok}")
    print("VALIDATION:", "PASS" if ok else "FAIL")
    return ok


def check_near_dupes():
    """Mimic smartImportTransactions' near-dupe rule: same amount (+/-$0.005)
    and same normalized description with dates within 2 days. The file should
    contain exactly one such pair: the intentional Trader Joe's demo pair."""
    def norm(d):
        return re.sub(r"\s+", " ", (d or "").lower()).strip()
    ordered = sorted(rows, key=lambda r: (r[0], r[1]))
    pairs = []
    for i in range(len(ordered)):
        for j in range(i + 1, len(ordered)):
            a, b = ordered[i], ordered[j]
            if (b[0] - a[0]).days > 2:
                break
            if abs(a[2] - b[2]) < 0.005 and norm(a[4]) == norm(b[4]):
                pairs.append((a[0], b[0], a[4], a[2]))
    print("\nNear-dupe pairs in file (expect exactly 1 intentional pair):")
    for d1, d2, desc, amt in pairs:
        print(f"  {d1} + {d2}: {desc} ${amt:.2f}")
    ok = len(pairs) == 1 and pairs[0][2].startswith("TRADER JOES")
    print("NEAR-DUPE CHECK:", "PASS" if ok else "FAIL")
    return ok


if __name__ == "__main__":
    main()
    ok = validate()
    ok = check_near_dupes() and ok
    if not ok:
        sys.exit(1)
