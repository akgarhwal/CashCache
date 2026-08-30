# CashCache

**Know where it goes.** A personal-finance workspace that runs in the browser. Data stays on your device unless you sign in with Google to sync it.

[![Open CashCache](https://img.shields.io/badge/Live%20demo-akgarhwal.github.io-2b7fff?style=for-the-badge)](https://akgarhwal.github.io/CashCache/)

![CashCache dashboard](docs/screenshots/dashboard.png)

Track income and spend in ₹, set category budgets, watch daily cash flow, and keep savings goals in one place. Everything stays on your machine: `localStorage` in the browser, plus an optional JSON file you save and reload yourself.

Screenshots use the bundled sample ledger in [`examples/demo.json`](examples/demo.json).

## Features

- **Dashboard** — net cash, income, spend, savings rate, budget health, top merchants, and a 30-day or calendar-month cash-flow chart
- **Transactions** — search, filter by type/category, and a dated ledger table
- **Budgets** — per-category caps with a donut, typed monthly cap, and over-budget highlighting
- **Goals** — savings targets with on-track / behind / good status, a progress bar, and top-up
- **Reports** — average daily spend, top category, bills, and a six-month income vs spend trend
- **Accounts** — checking, savings, credit, and cash; balances update when you add activity
- **Smart merchants** — Zepto, Swiggy, Uber, Amazon, and similar names are categorized for you
- **Light / dark theme**
- **Google sign-in** — optional; stores the workspace in Firestore under your account so other devices can load it
- **Save file / Reload** — backup and restore the whole workspace as JSON from Profile (File System Access API in Chromium, download fallback elsewhere)

## Screenshots

### Dark theme

![Dashboard in dark theme](docs/screenshots/dashboard-dark.png)

### Transactions

![Transactions table](docs/screenshots/transactions.png)

### Budgets

![Category budgets](docs/screenshots/budgets.png)

### Savings goals

![Savings goals](docs/screenshots/goals.png)

### Reports

![Reports and six-month trend](docs/screenshots/reports.png)

### Accounts

![Linked accounts](docs/screenshots/accounts.png)

### Add a transaction

![Add transaction dialog](docs/screenshots/add-transaction.png)

### Phone layout

<img src="docs/screenshots/mobile.png" alt="CashCache on a phone" width="390" />

## Run locally

Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8765
```

Then visit [http://localhost:8765](http://localhost:8765).

A local server is recommended if you want **Save file** to write back to the same JSON (Chromium). On `file://` the app still runs; save falls back to a download.

### Sample data

Use **Reload** and pick [`examples/demo.json`](examples/demo.json) to load the ledger shown in the screenshots.

## Data and privacy

- No analytics. The app works fully offline on `localStorage` (`ledger.data.v3`)
- **Save file** (in Profile) writes a JSON snapshot you can keep in Drive, a repo, or a USB stick
- **Google sign-in** is optional. When you sign in, the same JSON is written to `users/{yourUid}` in your Firebase project. Firestore rules allow only that signed-in user to read or write it
- Clearing site data wipes the in-browser copy — sign in or export first if you care about it

### Firebase setup (cloud sync)

Web config lives in [`firebase-config.js`](firebase-config.js). Those values are public (they ship to the browser). Do **not** put Firebase Admin / service-account keys in the repo or in Vercel.

1. Firebase console → Authentication → Sign-in method → **Google** → Enable
2. Authentication → Settings → **Authorized domains**: `localhost` and your live host (`*.vercel.app` plus any custom domain)
3. Firestore → create a database, then publish [`firestore.rules`](firestore.rules)
4. Google Cloud → APIs & Services → Credentials → the browser API key → **Application restrictions → HTTP referrers** (your Vercel domain, GitHub Pages, `localhost`)
5. Reload CashCache → Profile → **Sign in with Google**

### Vercel

This app has no build step, so **Vercel Environment Variables are not used** for Firebase. Adding `FIREBASE_*` keys under Vercel → Project → Settings → Environment Variables would not reach the browser.

What to set on Vercel:

- **Settings → Domains** — copy the hostname (for example `cashcache-rho.vercel.app`)
- Paste that hostname into Firebase **Authorized domains** (step 2 above)

Do not upload a service-account JSON to Vercel. Client sign-in uses only the public web config.

## Stack

Vanilla HTML, CSS, and JavaScript. No build step, no frameworks. Optional Firebase Auth + Firestore for Google sign-in.

## License

[MIT](LICENSE) © 2026 Abhinesh
