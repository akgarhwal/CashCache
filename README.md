# CashCache

**Know where it goes.** A personal-finance workspace that runs in the browser. By default everything stays on this device. Sign in with Google to back the workspace up in the cloud and reload it on another phone or laptop.

[![Vercel](https://img.shields.io/badge/Live-cashcache--rho.vercel.app-2b7fff?style=for-the-badge)](https://cashcache-rho.vercel.app/)
[![GitHub Pages](https://img.shields.io/badge/GitHub%20Pages-akgarhwal.github.io-1b1f23?style=for-the-badge)](https://akgarhwal.github.io/CashCache/)

![CashCache dashboard](docs/screenshots/dashboard.png)

Track income and spend in ₹, set category budgets, watch daily cash flow, and keep savings goals in one place. Local copy: `localStorage` plus optional **Save file**. Cloud backup: **Sign in with Google** in Profile.

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
- **Google sync** — optional sign-in in Profile; backs the workspace up to Firestore under your Google account and restores it on other devices
- **Save file / Reload** — local JSON backup from Profile (File System Access API in Chromium, download fallback elsewhere)

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

- No analytics. Offline use stays in `localStorage` (`ledger.data.v3`)
- **Save file** (in Profile) writes a JSON snapshot you can keep yourself
- **Google sync** is optional. Sign in to back up and restore the same workspace across devices. Copies live in Firestore at `users/{yourUid}`; [rules](firestore.rules) allow only that user to read or write it
- The Firebase web config in [`firebase-config.js`](firebase-config.js) is public by design. Do not put Admin / service-account keys in the repo or in Vercel

## Stack

Vanilla HTML, CSS, and JavaScript. No build step, no frameworks. Optional Firebase Auth + Firestore for Google sign-in.

## License

[MIT](LICENSE) © 2026 Abhinesh
