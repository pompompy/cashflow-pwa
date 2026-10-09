# CashFlow

A personal cash-flow planner: import your checking-account transactions, automatically detect recurring bills and income, and project your running balance forward so you can see trouble coming and plan savings transfers before you need them.

**Live demo:** https://pompompy.github.io/cashflow-pwa

## Features

- **Ally Bank CSV import** — drop in a checking-account CSV export; duplicates are flagged for review before anything is saved.
- **Recurring-transaction detection** — finds repeating bills, subscriptions, and paychecks by merchant and cadence, including tricky cases like same-merchant autopays on different days of the month.
- **Balance projection** — projects your running balance forward from recurring items, so you can see the weeks your checking account would go negative.
- **Per-transaction notes** — annotate anything (e.g. "pause this subscription in January").
- **Transfer guidance** — recommends when and how much to move from savings to stay cash-flow positive.
- **Installable PWA** — works offline and can be added to your phone's home screen like a native app.

## Privacy

CashFlow is **local-first**. Your transaction data is stored in your browser's IndexedDB (via Dexie) and never sent to any server — there is no backend. The repository contains no real financial data; the `sample-data/` folder is entirely fictional.

## Quick start

Prerequisites: **Node.js 18+** and npm.

```bash
git clone https://github.com/pompompy/cashflow-pwa.git
cd cashflow-pwa
npm install
npm run dev
```

Then open **http://localhost:5173/cashflow-pwa/** in your browser.

> Note the `/cashflow-pwa/` path: the app is configured with that base path (see `vite.config.js`), so the dev server serves it there, not at the domain root.

## Try it with sample data

Don't want to import your real bank data just to kick the tires? The [`sample-data/`](sample-data/) folder has you covered:

- `ally-checking-sample-2025-10-to-2026-10.csv` — 311 fictional Ally-format checking transactions spanning a full year.
- `generate_sample_data.py` — the deterministic generator script that produced the CSV (run it with `--help` for options like shifting all dates).
- `sample-data/README.md` — full documentation of what's in the dataset.

To try it: open the app, import the CSV through the Ally import flow, and when asked for a starting balance use **$2,000** (the dataset's suggested seed). You'll see ~15 detected recurring groups — including two same-bank card autopays the detector splits by day-of-month — plus one intentional near-duplicate transaction pair so you can see the import-review flow in action.

## Build and preview

```bash
npm run build     # production build into dist/
npm run preview   # serve the production build locally
```

## Deploy your own copy

The repo is set up for GitHub Pages via the `gh-pages` package:

```bash
npm run deploy
```

This builds the app and pushes `dist/` to the `gh-pages` branch, served at `https://<your-username>.github.io/cashflow-pwa/`. See [SETUP.md](SETUP.md) for the full walkthrough, including adding it to your iPhone home screen.

> **Hosting somewhere else?** If you deploy to a different subpath (or a domain root), update the `base` option in `vite.config.js` to match — otherwise the app's asset paths won't resolve. The PWA manifest's `start_url` and icon paths are root-absolute, so double-check those too if you change hosting.

## Tech stack

| Layer      | Choice                                                              |
|------------|---------------------------------------------------------------------|
| UI         | React 18, React Router, Tailwind CSS, Recharts, lucide-react icons   |
| Storage    | Dexie.js (IndexedDB) — all data stays in the browser                |
| Build      | Vite 5                                                              |
| PWA        | vite-plugin-pwa (auto-update service worker, offline support)       |
| Deployment | GitHub Pages via `gh-pages`                                         |

## Project structure

```
├── src/
│   ├── components/   # reusable UI components
│   ├── pages/        # routed views
│   ├── context/      # React context providers
│   ├── db/           # Dexie database layer
│   ├── utils/        # CSV parsing, recurring-transaction detection, projections
│   ├── App.jsx
│   └── main.jsx
├── public/           # PWA icons, favicon
├── sample-data/      # fictional Ally CSV + generator for trying the app
├── vite.config.js
└── SETUP.md          # GitHub Pages deploy + iPhone install walkthrough
```

## Notes

- This started as a personal project to test out claude and became a tool for navigating a job transition on a tight budget — it's built for one checking account (Ally) and a "will I stay positive?" workflow, not as a general budgeting app.
- Issues and forks welcome. If you add support for another bank's CSV format, the parsing logic lives in `src/utils/`.
