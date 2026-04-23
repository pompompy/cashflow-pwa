# CashFlow — Setup & Deployment Guide

A personal cash flow forecasting PWA that connects to Ally Bank via file export.
All data stays in your browser. No accounts, no servers, no cost.

---

## Prerequisites (one-time, ~5 minutes)

1. **Node.js 18+** — check with `node -v`. If missing:
   - Visit https://nodejs.org and download the LTS installer for macOS.

2. **A code editor** (optional but nice) — VS Code works well.

3. **A GitHub account** (free) for hosting — https://github.com

---

## Step 1 — Install dependencies

Open Terminal, navigate to this folder, and run:

```bash
cd cashflow-pwa
npm install
```

This downloads all packages into `node_modules/` (~300 MB). One-time only.

---

## Step 2 — Run locally (laptop)

```bash
npm run dev
```

Open http://localhost:5173 in your browser. The app is live. Changes to source
files reload instantly.

---

## Step 3 — Deploy to GitHub Pages (free HTTPS hosting)

### 3a. Create a GitHub repo

1. Go to https://github.com/new
2. Name it `cashflow-pwa` (or anything you like)
3. Set it to **Private** (recommended — only you can see the code)
4. Click **Create repository**

### 3b. Configure Vite for GitHub Pages

In `vite.config.js`, add your repo name as the base path.
If your repo is `github.com/yourusername/cashflow-pwa`, add:

```js
export default defineConfig({
  base: '/cashflow-pwa/',   // ← add this line
  plugins: [ ... ]
})
```

### 3c. Push the code

In Terminal (inside the `cashflow-pwa` folder):

```bash
git init
git add .
git commit -m "Initial CashFlow PWA"
git branch -M main
git remote add origin https://github.com/YOURUSERNAME/cashflow-pwa.git
git push -u origin main
```

### 3d. Enable GitHub Pages with gh-pages

Install the deploy tool (one-time):

```bash
npm install --save-dev gh-pages
```

Add this to the `scripts` section of `package.json`:

```json
"predeploy": "npm run build",
"deploy": "gh-pages -d dist"
```

Then deploy:

```bash
npm run deploy
```

Wait ~60 seconds, then visit:
**https://YOURUSERNAME.github.io/cashflow-pwa/**

Every time you want to push an update:
```bash
npm run deploy
```

---

## Step 4 — Add to iPhone Home Screen

1. Open Safari on your iPhone (must be Safari — Chrome won't install PWAs on iOS)
2. Navigate to your GitHub Pages URL
3. Tap the **Share** button (box with arrow at the bottom)
4. Scroll down and tap **"Add to Home Screen"**
5. Name it **CashFlow** → tap **Add**

It now behaves like a native app — full screen, no browser chrome, app icon.

---

## Step 5 — First use workflow

### Import your Ally history

1. Log into Ally Bank → select your Checking account
2. Click **Transactions** → **Download transactions**
3. Set date range: **last 12 months** (more history = better recurring detection)
4. Choose **OFX** format (preferred) or CSV
5. Open CashFlow → **Import** tab → drop the file
6. Review the preview and tap **Import**

### Set your current balance

The OFX file includes your closing balance and sets it automatically.
If you used CSV, go to **Settings** and enter your current balance manually.

### Review suggestions

Go to **Suggestions** — the app will have scanned your history for recurring
patterns (mortgage, car payment, paycheck, subscriptions, etc.).

For each one:
- **Add to forecast** — accepts it and adds all projected dates to your ledger
- **Edit** (pencil icon) — adjust description or amount before accepting
- **Dismiss** — skip it (won't appear again until you re-scan)

### Add one-off future transactions

Tap the **+** button on the Ledger page to add any transaction manually —
one-time or recurring.

---

## Keeping it up to date

**Weekly or after any major transactions:**

1. Download a fresh Ally OFX export (last 30–60 days is enough for reconciliation)
2. Import it — duplicates are automatically skipped via transaction IDs
3. The closing balance from the OFX updates your seed balance automatically
4. Check Suggestions for any new recurring patterns

---

## Syncing between laptop and iPhone

Since both devices have separate local databases, use the backup feature:

**Laptop → iPhone:**
1. Settings → **Export backup** (downloads `cashflow-backup-YYYY-MM-DD.json`)
2. Save it to iCloud Drive
3. On iPhone: Settings → **Restore from backup** → pick the file from iCloud Drive

**Tip:** Keep a `CashFlow` folder in iCloud Drive and always export/restore there.
Takes ~10 seconds and keeps both devices in sync.

---

## Alternative: Netlify (even easier deploy)

1. Run `npm run build` — creates a `dist/` folder
2. Go to https://app.netlify.com/drop
3. Drag the entire `dist/` folder onto the page
4. Netlify gives you a free HTTPS URL instantly
5. For custom deploys: connect your GitHub repo for auto-deploy on push

---

## Updating the app

Pull the latest source files, then:

```bash
npm run deploy        # GitHub Pages
# or
npm run build         # then re-drag dist/ to Netlify
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| `node: command not found` | Install Node.js from nodejs.org |
| Blank screen on GitHub Pages | Check `base` in vite.config.js matches your repo name |
| OFX shows 0 transactions | Try CSV format instead — Ally occasionally changes their OFX layout |
| Balance looks wrong | Go to Settings and manually correct the seed balance |
| Suggestions not appearing | Need 3+ occurrences of a pattern; import a longer date range |
| PWA not installing on iPhone | Must use Safari, not Chrome |

---

## Security notes

- No credentials are ever entered in this app
- Transaction data never leaves your browser
- File parsing happens entirely client-side
- The only network request the app ever makes is loading Google Fonts
- Source code on GitHub can be (and should be) a **private** repo

---

*Built with React, Vite, Tailwind CSS, Dexie (IndexedDB), and Recharts.*
