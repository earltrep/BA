// IndexedDB wrapper — fully local, no server.
const DB_NAME = "budgetly_db";
const DB_VERSION = 1;

export const DATA_STORES = [
  "settings", "transactions", "categories", "accounts",
  "sinking_funds", "debts", "networth", "no_spend",
];
export const ALL_STORES = [...DATA_STORES, "meta"];

export function uuid() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "id-" + Date.now().toString(16) + "-" + Math.random().toString(16).slice(2);
}

let _db = null;

function openDB() {
  return new Promise((resolve, reject) => {
    if (_db) return resolve(_db);
    if (typeof indexedDB === "undefined") return reject(new Error("IndexedDB is not available in this browser."));
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      ALL_STORES.forEach((s) => {
        if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: "id" });
      });
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error || new Error("Could not open local storage."));
    req.onblocked = () => reject(new Error("Local storage is blocked by another tab."));
  });
}

export async function dbGetAll(store) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(store, "readonly").objectStore(store).getAll();
    r.onsuccess = () => res(r.result || []);
    r.onerror = () => rej(r.error || new Error("Read failed."));
  });
}

export async function dbGet(store, id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const r = db.transaction(store, "readonly").objectStore(store).get(id);
    r.onsuccess = () => res(r.result || null);
    r.onerror = () => rej(r.error || new Error("Read failed."));
  });
}

export async function dbPut(store, obj) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction(store, "readwrite");
    t.objectStore(store).put(obj);
    t.oncomplete = () => res(obj);
    t.onerror = () => rej(t.error || new Error("Save failed."));
    t.onabort = () => rej(t.error || new Error("Save was aborted (storage may be full)."));
  });
}

export async function dbDelete(store, id) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction(store, "readwrite");
    t.objectStore(store).delete(id);
    t.oncomplete = () => res(true);
    t.onerror = () => rej(t.error || new Error("Delete failed."));
  });
}

export async function dbBulkPut(store, arr) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction(store, "readwrite");
    const os = t.objectStore(store);
    (arr || []).forEach((o) => os.put(o));
    t.oncomplete = () => res((arr || []).length);
    t.onerror = () => rej(t.error || new Error("Save failed."));
    t.onabort = () => rej(t.error || new Error("Save was aborted (storage may be full)."));
  });
}

// Atomic replace of all planner data in a single transaction.
// If anything fails the transaction aborts and existing data is untouched.
export async function dbReplaceAll(dataObj) {
  const db = await openDB();
  return new Promise((res, rej) => {
    const t = db.transaction(DATA_STORES, "readwrite");
    t.oncomplete = () => res(true);
    t.onerror = () => rej(t.error || new Error("Restore failed."));
    t.onabort = () => rej(t.error || new Error("Restore was aborted; your data is unchanged."));
    try {
      DATA_STORES.forEach((s) => {
        const os = t.objectStore(s);
        os.clear();
        const val = dataObj[s];
        if (s === "settings") {
          if (val && typeof val === "object") os.put({ ...val, id: "app" });
        } else if (Array.isArray(val)) {
          val.forEach((o) => { if (o && o.id) os.put(o); });
        }
      });
    } catch (e) {
      try { t.abort(); } catch (_) {}
      rej(e);
    }
  });
}

export async function ensureInit() {
  let settings = await dbGet("settings", "app");
  if (!settings) {
    settings = { id: "app", name: "", base_currency: "USD", autopilot: true, backup_reminder_days: 7 };
    await dbPut("settings", settings);
  }
  let meta = await dbGet("meta", "meta");
  if (!meta) {
    meta = { id: "meta", first_use_at: new Date().toISOString(), last_backup_at: null, dirty: false, autopilot_lastrun: null };
    await dbPut("meta", meta);
  }
  return { settings, meta };
}

export async function getMeta() {
  return (await dbGet("meta", "meta")) || null;
}

export async function patchMeta(patch) {
  const m = (await dbGet("meta", "meta")) || { id: "meta", first_use_at: new Date().toISOString(), last_backup_at: null, dirty: false, autopilot_lastrun: null };
  const next = { ...m, ...patch, id: "meta" };
  await dbPut("meta", next);
  if (typeof window !== "undefined") {
    try { window.dispatchEvent(new CustomEvent("budgetly:meta", { detail: next })); } catch (_) {}
  }
  return next;
}

export async function markDirty() {
  try { await patchMeta({ dirty: true }); } catch (_) {}
}
