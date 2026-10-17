// Currency rates — bundled static table + best-effort live refresh (public API, no key).
export const CURRENCIES = {
  USD: { symbol: "$", rate: 1.0, name: "US Dollar" },
  EUR: { symbol: "\u20ac", rate: 0.92, name: "Euro" },
  GBP: { symbol: "\u00a3", rate: 0.79, name: "British Pound" },
  INR: { symbol: "\u20b9", rate: 83.2, name: "Indian Rupee" },
  CAD: { symbol: "C$", rate: 1.36, name: "Canadian Dollar" },
  AUD: { symbol: "A$", rate: 1.52, name: "Australian Dollar" },
  JPY: { symbol: "\u00a5", rate: 157.0, name: "Japanese Yen" },
  CNY: { symbol: "\u00a5", rate: 7.24, name: "Chinese Yuan" },
  CHF: { symbol: "Fr", rate: 0.88, name: "Swiss Franc" },
  SGD: { symbol: "S$", rate: 1.35, name: "Singapore Dollar" },
  AED: { symbol: "\u062f.\u0625", rate: 3.67, name: "UAE Dirham" },
  BRL: { symbol: "R$", rate: 5.0, name: "Brazilian Real" },
  ZAR: { symbol: "R", rate: 18.5, name: "South African Rand" },
  MXN: { symbol: "Mex$", rate: 17.0, name: "Mexican Peso" },
  NZD: { symbol: "NZ$", rate: 1.65, name: "New Zealand Dollar" },
};

let LIVE = {};
let UPDATED = null;

export function getRate(c) {
  if (LIVE[c] != null) return LIVE[c];
  return CURRENCIES[c] ? CURRENCIES[c].rate : 1;
}

export function convert(amount, frm, to) {
  frm = CURRENCIES[frm] ? frm : "USD";
  to = CURRENCIES[to] ? to : "USD";
  const usd = Number(amount || 0) / getRate(frm);
  return Math.round(usd * getRate(to) * 100) / 100;
}

export function currenciesPayload() {
  const out = {};
  for (const [c, m] of Object.entries(CURRENCIES)) {
    out[c] = { symbol: m.symbol, name: m.name, rate: Number(getRate(c).toFixed(6)) };
  }
  return out;
}

export function ratesUpdated() { return UPDATED; }
export function hasLive() { return Object.keys(LIVE).length > 0; }

export async function refreshRates() {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 8000);
    const r = await fetch("https://open.er-api.com/v6/latest/USD", { signal: ctrl.signal });
    clearTimeout(timer);
    const d = await r.json();
    if (d && d.result === "success") {
      const rates = d.rates || {};
      const next = {};
      Object.keys(CURRENCIES).forEach((c) => { if (rates[c] != null) next[c] = rates[c]; });
      LIVE = next;
      UPDATED = d.time_last_update_utc || new Date().toUTCString();
    }
  } catch (_) {
    // Offline or blocked — silently fall back to the bundled static rates.
  }
  return { rates: currenciesPayload(), updated: UPDATED, live: hasLive() };
}
