export const CURRENCY_SYMBOLS = {
  USD: "$", EUR: "\u20ac", GBP: "\u00a3", INR: "\u20b9", CAD: "C$", AUD: "A$",
  JPY: "\u00a5", CNY: "\u00a5", CHF: "Fr", SGD: "S$", AED: "\u062f.\u0625",
  BRL: "R$", ZAR: "R", MXN: "Mex$", NZD: "NZ$",
};

export const CURRENCY_LIST = Object.keys(CURRENCY_SYMBOLS);

export function money(value, code = "USD", { compact = false, decimals = 2 } = {}) {
  const sym = CURRENCY_SYMBOLS[code] || "";
  const v = Number(value || 0);
  const neg = v < 0;
  const abs = Math.abs(v);
  let num;
  if (compact && abs >= 1000) {
    num = abs.toLocaleString(undefined, { notation: "compact", maximumFractionDigits: 1 });
  } else {
    num = abs.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  return `${neg ? "-" : ""}${sym}${num}`;
}
