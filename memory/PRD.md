# Budgetly — Product Requirements

## Overview
Budgetly is a responsive **frontend-only, static** annual budgeting planner (inspired by an Etsy "Ultimate Annual Budget Spreadsheet"). It runs entirely in the browser — no accounts, no backend, no server. All data is stored locally in **IndexedDB**. Designed for Etsy buyers to run on any static host.

## Architecture
- **React** SPA (HashRouter) in `/app/frontend`.
- Local client-side API layer (`src/lib/api.js`) mimics the old axios `{ data }` shape so pages work unchanged. No `/api` network calls.
- IndexedDB wrapper: `src/lib/db.js`. Calc engine: `src/lib/engine.js`. FX: `src/lib/rates.js` (public endpoint, non-blocking). Backup: `src/lib/backup.js`. Sample data: `src/lib/sampleData.js`. Google Drive: `src/lib/gdrive.js` (GIS, `drive.file`, public client ID stored locally).
- Legacy `/app/backend` (FastAPI + Mongo) preserved but NOT used at runtime. Do not delete.
- Build: `yarn build` → `frontend/build`. Static configs: `public/_redirects`, `vercel.json`. Deploy doc: `/app/DEPLOYMENT.md`.

## Core Features (implemented)
- Dashboard, Transactions, Accounts, Setup & Budgets, Annual/Monthly/Calendar, Paycheck Planner, Expense Explorer, Year Compare.
- Wealth tools: 50/30/20, Sinking Funds, Goal Funding Plan, Debt Payoff, Net Worth, Investment Forecast, No-Spend Challenge.
- Multi-currency with live FX refresh.
- Budget Alerts, Recurring Autopilot (runs on app open), CSV import.
- Local backup/restore (JSON), reset-to-blank, sample data.
- Google Drive export (owner pastes public OAuth Client ID).
- Unsaved-changes ("needs backup") badge, backup reminders.
- Getting Started guide page.

## Recent changes (2026-06)
- Moved **Getting Started** into the sidebar **Overview** group, directly under Dashboard.
- **Quick Start Checklist** on Getting Started page: 5-step auto-detecting checklist (name budget, add account, set up categories, log transaction, download backup) with progress bar; each row links to the relevant page. Auto-updates via `budgetly:meta` event. (Guide.js)
- **Load a sample budget** button added on Getting Started page (in addition to Backup page). (Guide.js + sampleData.js)
- **Backup reminder tuning**: Off / Daily / Weekly / Monthly selector on Backup page, stored in settings `backup_reminder_days` (default 7). Layout `shouldRemind` now honors the chosen frequency; Off disables reminders. (Backup.js, Layout.js, api.js, db.js)

## Verification status
- Nav move, checklist auto-detection (4/5 after sample load), reminder persistence across reload, sample load, and reset-to-blank all self-tested via screenshots. Compiles clean.
- Google Drive real upload still requires deployed origin + OAuth client + live Google account (not runtime-verified).

## Backlog / Next
- P1: Real-world Google Drive validation on a deployed host.
- P1: User acceptance testing (persistence, mobile UX, no-backend operation on target static host).
- P2: Legacy cloud → IndexedDB migration path if user wants existing hosted records.
- P2: GitHub export/push (resolve via platform support; no direct push possible).
