// Local, client-side replacement for the old HTTP API.
// Every handler reads/writes IndexedDB and returns { data } like axios did,
// so existing pages work unchanged. No network, no backend, no secrets.
import {
  dbGetAll, dbGet, dbPut, dbDelete, dbBulkPut, ensureInit, markDirty, patchMeta, uuid,
} from "./db";
import { refreshRates, currenciesPayload, ratesUpdated, hasLive } from "./rates";
import {
  buildSummary, computeAlerts, computePaycheck, computeBreakdown,
  computeCompare, computePayoff, computeGoals, generateRecurring,
} from "./engine";

export function formatApiError(detail) {
  if (detail == null) return "Something went wrong. Please try again.";
  if (typeof detail === "string") return detail;
  return String(detail);
}

const RESOURCE = {
  accounts: "accounts",
  categories: "categories",
  transactions: "transactions",
  "sinking-funds": "sinking_funds",
  debts: "debts",
  networth: "networth",
  "no-spend": "no_spend",
};

async function getSettingsDoc() {
  const { settings } = await ensureInit();
  return settings;
}

async function loadAll() {
  const [settings, transactions, categories, accounts, sinking_funds, debts, networth, no_spend] = await Promise.all([
    getSettingsDoc(),
    dbGetAll("transactions"), dbGetAll("categories"), dbGetAll("accounts"),
    dbGetAll("sinking_funds"), dbGetAll("debts"), dbGetAll("networth"), dbGetAll("no_spend"),
  ]);
  return { settings, transactions, categories, accounts, sinking_funds, debts, networth, no_spend };
}

async function createDoc(store, body) {
  const doc = { id: uuid(), created_at: new Date().toISOString(), ...body };
  await dbPut(store, doc);
  await markDirty();
  return doc;
}

async function updateDoc(store, id, body) {
  const existing = await dbGet(store, id);
  if (!existing) throw new Error("Not found");
  const doc = { ...existing, ...body, id };
  await dbPut(store, doc);
  await markDirty();
  return doc;
}

async function deleteDoc(store, id) {
  await dbDelete(store, id);
  await markDirty();
  return { ok: true };
}

export async function maybeRunAutopilot() {
  const { settings, meta } = await ensureInit();
  if (!settings.autopilot) return 0;
  const month = new Date().toISOString().slice(0, 7);
  if (meta.autopilot_lastrun === month) return 0;
  const txns = await dbGetAll("transactions");
  const docs = generateRecurring(txns, month);
  if (docs.length) {
    await dbBulkPut("transactions", docs);
    await markDirty();
  }
  await patchMeta({ autopilot_lastrun: month });
  return docs.length;
}

async function route(method, path, body) {
  const [clean] = path.split("?");
  const parts = clean.split("/").filter(Boolean);
  const [a, b, c] = parts;

  // ---- settings ----
  if (a === "settings") {
    if (method === "GET") {
      const s = await getSettingsDoc();
      return { ...s, currencies: currenciesPayload(), rates_updated: ratesUpdated() };
    }
    if (method === "PUT") {
      const s = await getSettingsDoc();
      const patch = {};
      ["name", "base_currency", "autopilot", "google_client_id", "backup_reminder_days"].forEach((k) => { if (body[k] !== undefined && body[k] !== null) patch[k] = body[k]; });
      const next = { ...s, ...patch, id: "app" };
      await dbPut("settings", next);
      return next;
    }
  }

  // ---- rates ----
  if (a === "rates") {
    if (b === "refresh" && method === "POST") return await refreshRates();
    return { rates: currenciesPayload(), updated: ratesUpdated(), live: hasLive() };
  }

  // ---- aggregations ----
  if (a === "dashboard" && method === "GET") return buildSummary(await loadAll());
  if (a === "alerts" && method === "GET") {
    const d = await loadAll();
    return computeAlerts(d.categories, d.transactions, d.settings.base_currency || "USD");
  }
  if (a === "paycheck" && method === "GET") {
    const d = await loadAll();
    return computePaycheck(d.transactions, d.categories, d.settings.base_currency || "USD");
  }
  if (a === "expenses" && b === "breakdown" && method === "GET") {
    const d = await loadAll();
    return computeBreakdown(d.transactions, d.categories, d.settings.base_currency || "USD");
  }
  if (a === "compare" && method === "GET") {
    const d = await loadAll();
    return computeCompare(d.transactions, d.settings.base_currency || "USD");
  }
  if (a === "goals" && b === "plan" && method === "GET") {
    const d = await loadAll();
    return computeGoals(d.sinking_funds, d.transactions, d.settings.base_currency || "USD");
  }

  // ---- autopilot ----
  if (a === "autopilot" && b === "run" && method === "POST") {
    const month = new Date().toISOString().slice(0, 7);
    const txns = await dbGetAll("transactions");
    const docs = generateRecurring(txns, month);
    if (docs.length) { await dbBulkPut("transactions", docs); await markDirty(); }
    await patchMeta({ autopilot_lastrun: month });
    return { inserted: docs.length, month };
  }

  // ---- debts payoff ----
  if (a === "debts" && b === "payoff" && method === "POST") {
    const debts = await dbGetAll("debts");
    return computePayoff(debts, body.strategy, Number(body.extra) || 0);
  }

  // ---- transactions bulk ----
  if (a === "transactions" && b === "bulk" && method === "POST") {
    const docs = (body.transactions || []).map((t) => ({ id: uuid(), created_at: new Date().toISOString(), ...t }));
    if (docs.length) { await dbBulkPut("transactions", docs); await markDirty(); }
    return { inserted: docs.length };
  }

  // ---- no-spend upsert ----
  if (a === "no-spend" && method === "POST") {
    const all = await dbGetAll("no_spend");
    const existing = all.find((x) => x.date === body.date);
    if (existing) return await updateDoc("no_spend", existing.id, body);
    return await createDoc("no_spend", body);
  }

  // ---- generic CRUD ----
  const store = RESOURCE[a];
  if (store) {
    if (method === "GET") {
      let rows = await dbGetAll(store);
      if (a === "transactions") rows = rows.sort((x, y) => ((x.date || "") < (y.date || "") ? 1 : -1));
      return rows;
    }
    if (method === "POST") return await createDoc(store, body);
    if (method === "PUT") return await updateDoc(store, b, body);
    if (method === "DELETE") return await deleteDoc(store, b);
  }

  throw new Error(`Unhandled local route: ${method} ${path}`);
}

export const api = {
  get: async (p) => ({ data: await route("GET", p) }),
  post: async (p, b) => ({ data: await route("POST", p, b || {}) }),
  put: async (p, b) => ({ data: await route("PUT", p, b || {}) }),
  delete: async (p) => ({ data: await route("DELETE", p) }),
};
