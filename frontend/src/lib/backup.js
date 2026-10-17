import { DATA_STORES, dbGetAll, dbGet, dbReplaceAll, patchMeta } from "./db";

export const APP_ID = "budgetly";
export const BACKUP_VERSION = 1;

export async function collectData() {
  const settings = await dbGet("settings", "app");
  const [transactions, categories, accounts, sinking_funds, debts, networth, no_spend] = await Promise.all([
    dbGetAll("transactions"), dbGetAll("categories"), dbGetAll("accounts"),
    dbGetAll("sinking_funds"), dbGetAll("debts"), dbGetAll("networth"), dbGetAll("no_spend"),
  ]);
  return { settings: settings || { id: "app", base_currency: "USD" }, transactions, categories, accounts, sinking_funds, debts, networth, no_spend };
}

export async function buildBackup() {
  return {
    app: APP_ID,
    format_version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    data: await collectData(),
  };
}

export function backupFilename(d = new Date()) {
  const p = (n) => String(n).padStart(2, "0");
  return `MyBudget-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

export function downloadJSON(obj, filename) {
  const blob = new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const ARRAY_STORES = DATA_STORES.filter((s) => s !== "settings");

export function validateBackup(obj) {
  if (!obj || typeof obj !== "object") return { ok: false, error: "This file isn't valid JSON." };
  if (obj.app !== APP_ID) return { ok: false, error: "This file isn't a Budgetly backup." };
  if (typeof obj.format_version !== "number" || obj.format_version > BACKUP_VERSION) {
    return { ok: false, error: `Unsupported backup version (${obj.format_version}). Please update the app.` };
  }
  if (!obj.data || typeof obj.data !== "object") return { ok: false, error: "The backup is missing its data." };
  for (const s of ARRAY_STORES) {
    if (obj.data[s] !== undefined && !Array.isArray(obj.data[s])) {
      return { ok: false, error: `The "${s}" section is corrupted.` };
    }
  }
  if (obj.data.settings !== undefined && (typeof obj.data.settings !== "object" || obj.data.settings === null)) {
    return { ok: false, error: "The settings section is corrupted." };
  }
  const counts = {};
  ARRAY_STORES.forEach((s) => (counts[s] = Array.isArray(obj.data[s]) ? obj.data[s].length : 0));
  return { ok: true, counts, exported_at: obj.exported_at || null };
}

// Safe atomic restore. On any failure the existing data is left intact.
export async function restoreBackup(obj) {
  const check = validateBackup(obj);
  if (!check.ok) throw new Error(check.error);
  await dbReplaceAll(obj.data);
  await patchMeta({ dirty: true });
  return check;
}

export async function markBackedUp() {
  await patchMeta({ last_backup_at: new Date().toISOString(), dirty: false });
}

// One-click reset: wipe all planner data back to a blank budget (atomic).
export async function resetToBlank() {
  await dbReplaceAll({
    settings: { id: "app", name: "", base_currency: "USD", autopilot: true },
    transactions: [], categories: [], accounts: [],
    sinking_funds: [], debts: [], networth: [], no_spend: [],
  });
  await patchMeta({ dirty: false });
}
