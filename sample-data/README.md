# Sample data for cashflow-pwa

Fictional Ally checking-account history you can import into
[cashflow-pwa](https://github.com/pompompy/cashflow-pwa) to try the app
without connecting real bank data.

**100% fictional.** The persona, employer, merchants, amounts, and dates are
invented. No real personal or financial data.

## Files

- `ally-checking-sample-2025-10-to-2026-10.csv` — 311 transactions,
  2025-10-16 to 2026-10-04, in Ally's CSV export format
  (`Date,Time,Amount,Type,Description`).
- `generate_sample_data.py` — deterministic generator (seed `20261009`).
  Re-running it reproduces this exact file:
  `python3 generate_sample_data.py [output.csv] [--shift-days N]`

## Try it

1. Clone and run the app: `git clone https://github.com/pompompy/cashflow-pwa.git`
   then `npm run dev` (see the repo's `SETUP.md`).
2. Open the **Import** page and drop in the CSV.
3. Set the seed balance to **$2,000 as of 2025-10-15** (the app's balance
   settings). Net of all transactions is +$3,999.50, so the running balance
   lands around $6,000 at the end of the history.
4. Run **recurring detection**. You should get 15 suggestions:
   - Biweekly paycheck (`ACME CORP PAYROLL`), biweekly gas (`SHELL`)
   - Weekly groceries (`TRADER JOES`)
   - Monthly: mortgage, power, water, internet, phone, Netflix, Spotify, gym,
     car insurance, savings transfer
   - **Two** monthly `FIRST NATIONAL CARD AUTOPAY` groups — the detector
     splits them by day-of-month cluster (4th vs 19th), which is the point
   - Amounts flagged *fixed* vs *variable* where appropriate
5. Accept the suggestions to project ~90 days forward and watch the
   running-balance forecast.

Two extra things to poke at:

- **Near-dupe review:** the file contains one intentional near-duplicate —
  two identical $112.47 `TRADER JOES #4521` charges one day apart
  (2026-09-11/12). Import flags the second for your review instead of
  silently inserting it.
- **Re-import safety:** import the same file twice. Exact duplicates are
  skipped, so the second import inserts nothing.

## Keeping the demo fresh

The detector only scans the trailing 120 days from today. If you're trying
this months from now and detection looks thin, shift every date forward:

```
python3 generate_sample_data.py fresh-sample.csv --shift-days 90
```

Intervals are preserved, so detection results stay the same.

## What's in the data

A fictional household: biweekly $2,850 payroll, $1,489 mortgage, utilities,
subscriptions, two credit-card autopays from the same bank, weekly groceries,
weekly gas, a $900/mo savings transfer, plus realistic one-offs (Amazon,
restaurants, travel, a $2,400 tax payment, car registration…). Quarterly
Costco runs and an annual Prime fee are in there as history, though they're
too sparse for the detector to pick up — same as real life.
