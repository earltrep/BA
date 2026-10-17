# Budgetly — Static Deployment Guide

Budgetly is now a **100% client-side app**. No Python, no database, no server functions,
no paid runtime. All customer data lives in the browser (IndexedDB).

## Build

```bash
cd frontend
yarn install
yarn build
```

- **Output directory:** `frontend/build`
- **Node:** 18+ recommended

## Routing (important)

The app uses **HashRouter**, so URLs look like `https://yoursite.com/#/transactions`.
This means **refresh and direct links work on ANY static host with no server config** —
the host only ever serves `index.html` at the root.

For hosts that support SPA rewrites you can optionally use the included files
(not required with HashRouter):
- `frontend/public/_redirects` → Netlify (`/*  /index.html  200`)
- `frontend/vercel.json` → Vercel rewrites

## Deploy (pick any)

| Host | Setting |
|------|---------|
| **Netlify** | Build command `yarn build`, Publish directory `build` (drag-and-drop `build/` also works) |
| **Vercel** | Framework: Create React App, Output `build` |
| **Cloudflare Pages** | Build command `yarn build`, Output `build` |
| **GitHub Pages** | Push the contents of `build/` to the `gh-pages` branch |
| **Amazon S3 / any static host** | Upload the contents of `build/` |

No environment variables or secrets are needed. The only outbound request is an
optional, keyless call to `open.er-api.com` for live exchange rates; if it fails the
app falls back to bundled static rates.

## Recovering the old full-stack version

The previous server-based version is preserved in Emergent's version history — you can
roll back at any time. This conversion did **not** delete the old MongoDB data or shut
down the live site.

## Exporting / migrating your existing cloud data

Your old cloud data is untouched. To move a user's existing cloud budget into the new
local app, produce a backup file in the new format and import it via **Backup & Restore →
Restore backup**. The backup JSON shape is:

```json
{
  "app": "budgetly",
  "format_version": 1,
  "exported_at": "2026-10-17T00:00:00.000Z",
  "data": {
    "settings": { "id": "app", "name": "...", "base_currency": "USD", "autopilot": true },
    "transactions": [ ... ],
    "categories": [ ... ],
    "accounts": [ ... ],
    "sinking_funds": [ ... ],
    "debts": [ ... ],
    "networth": [ ... ],
    "no_spend": [ ... ]
  }
}
```

You can generate this from the old database, e.g.:

```bash
# Example: export each collection from the old MongoDB, then wrap them in the shape above.
mongoexport --uri "$MONGO_URL" --db <db> --collection transactions --jsonArray --out transactions.json
# ...repeat for categories, accounts, sinking_funds, debts, networth, no_spend, settings...
```

Assemble the collections under the `data` key (array fields keep each record's `id`;
`settings` is a single object with `id: "app"`), save as `MyBudget-<date>.json`, then
Restore it in the app. Nothing is overwritten in your cloud database by this process.
