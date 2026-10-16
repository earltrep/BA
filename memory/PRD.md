# Budgetly — Product Requirements Document

## Original Problem Statement
"Build a web based app with the same features as this: https://www.etsy.com/listing/1807934295/ultimate-annual-budget-spreadsheet-excel"
The Etsy product is the "Ultimate Annual Budget Spreadsheet" (28 tabs, 4 sections). Reimagined as a full-stack web app.

## User Choices
- Auth: JWT email + password
- Scope: all features
- Multi-currency support
- Visual style: clean & light modern fintech
- AI spending insights assistant (Emergent Universal Key, Claude)

## Architecture
- Frontend: React 19 (CRA/craco), react-router-dom, recharts, lucide-react, Shadcn UI, Tailwind. Manrope + IBM Plex Sans.
- Backend: FastAPI (single server.py), JWT Bearer auth (bcrypt), Motor/MongoDB.
- AI: emergentintegrations LlmChat (claude-sonnet-5-5) streaming over /api/ai/insights.
- Multi-currency: per-record currency + static rate table; dashboards convert to base currency.

## User Personas
- Individuals / couples tracking an annual personal budget.
- Demo account: demo@budgetly.app / demo1234 (seeded with a realistic year of data).

## Core Requirements (static)
Transactions (recurring + variable, multi-currency), Bank Accounts, Categories/Setup with 50/30/20 buckets, All-in-one Dashboard, Annual Totals, Monthly Insights (12 months), Automated Calendar, 50/30/20, Expense Distribution, Sinking Funds, Debt Payoff (snowball/avalanche), Net Worth, Investment Forecast, No-Spend Challenge, AI Insights.

## Implemented (2026-06)
- [x] JWT auth: register/login/me/logout; token in localStorage.
- [x] Settings: display name + base currency (15 currencies).
- [x] Accounts CRUD (per-currency balances).
- [x] Categories CRUD (type + 50/30/20 bucket + budget).
- [x] Transactions CRUD + recurring/variable + month filters.
- [x] Dashboard aggregation (KPIs, cash-flow bar, expense donut, savings, debt, recent).
- [x] Annual Totals (composed chart + monthly table).
- [x] Monthly Insights (per-month spend vs budget).
- [x] Automated Calendar (daily income/expense).
- [x] 50/30/20 allocation vs targets.
- [x] Sinking Funds (savings goals, progress).
- [x] Debt Payoff calculator (snowball/avalanche, interest, schedule).
- [x] Net Worth (assets/liabilities + accounts + funds).
- [x] Investment Forecast (compound growth calculator).
- [x] No-Spend Challenge (streak calendar).
- [x] AI Insights (streaming Claude over real budget data, persisted history).
- [x] Demo data seeding on startup.
- Tested: backend 20/20 pytest, frontend E2E 100%.

## Backlog (prioritized)
- P1: Expense Distribution as a dedicated page (currently in Dashboard donut + Monthly).
- P1: Paycheck dashboard (per-paycheck allocation view).
- P2: Live FX rates (currently static table).
- P2: CSV import/export of transactions.
- P2: Split server.py into routers for maintainability.
- P2: Explicit CORS origins (hardening) now that auth is Bearer-based.

## Next Tasks
See Next Action Items in the completion summary.
