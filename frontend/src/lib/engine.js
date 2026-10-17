import { convert } from "./rates";
import { uuid } from "./db";

const LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const r2 = (v) => Math.round(v * 100) / 100;
const r1 = (v) => Math.round(v * 10) / 10;

export function buildSummary(d) {
  const base = d.settings?.base_currency || "USD";
  const year = new Date().getFullYear();
  const keys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const monthly = {};
  keys.forEach((m) => (monthly[m] = { income: 0, expense: 0 }));
  const catMap = Object.fromEntries(d.categories.map((c) => [c.id, c]));
  const byCategory = {};
  const buckets = { needs: 0, wants: 0, savings: 0 };
  let totalIncome = 0, totalExpense = 0;

  for (const t of d.transactions) {
    const mk = (t.date || "").slice(0, 7);
    if (!mk.startsWith(String(year))) continue;
    const amt = convert(Number(t.amount), t.currency || "USD", base);
    if (t.type === "income") {
      totalIncome += amt;
      if (monthly[mk]) monthly[mk].income += amt;
    } else {
      totalExpense += amt;
      if (monthly[mk]) monthly[mk].expense += amt;
      const cat = catMap[t.category_id];
      const cname = cat ? cat.name : "Uncategorized";
      byCategory[cname] = (byCategory[cname] || 0) + amt;
      const bucket = cat && buckets[cat.bucket] !== undefined ? cat.bucket : "needs";
      buckets[bucket] += amt;
    }
  }

  const accountTotal = d.accounts.reduce((s, a) => s + convert(Number(a.balance), a.currency || "USD", base), 0);
  const savingsTotal = d.sinking_funds.reduce((s, f) => s + Number(f.saved || 0), 0);
  const savingsTarget = d.sinking_funds.reduce((s, f) => s + Number(f.target || 0), 0);
  const debtTotal = d.debts.reduce((s, x) => s + Number(x.balance || 0), 0);
  const assets = d.networth.filter((n) => n.type === "asset").reduce((s, n) => s + Number(n.amount), 0);
  const liabilities = d.networth.filter((n) => n.type === "liability").reduce((s, n) => s + Number(n.amount), 0);
  const netWorth = assets + accountTotal + savingsTotal - liabilities - debtTotal;

  return {
    base_currency: base,
    total_income: r2(totalIncome),
    total_expense: r2(totalExpense),
    net: r2(totalIncome - totalExpense),
    savings_rate: totalIncome ? r1(((totalIncome - totalExpense) / totalIncome) * 100) : 0,
    monthly: keys.map((m) => ({ month: m, label: LABELS[Number(m.slice(5, 7)) - 1], income: r2(monthly[m].income), expense: r2(monthly[m].expense) })),
    by_category: Object.entries(byCategory).map(([name, value]) => ({ name, value: r2(value) })).sort((a, b) => b.value - a.value),
    buckets: { needs: r2(buckets.needs), wants: r2(buckets.wants), savings: r2(buckets.savings) },
    account_total: r2(accountTotal),
    accounts: d.accounts,
    savings_total: r2(savingsTotal),
    savings_target: r2(savingsTarget),
    debt_total: r2(debtTotal),
    net_worth: r2(netWorth),
    assets: r2(assets + accountTotal + savingsTotal),
    liabilities: r2(liabilities + debtTotal),
    txn_count: d.transactions.length,
  };
}

export function computeAlerts(categories, transactions, base) {
  const month = new Date().toISOString().slice(0, 7);
  const spent = {};
  for (const t of transactions) {
    if (t.type === "expense" && (t.date || "").slice(0, 7) === month && t.category_id) {
      spent[t.category_id] = (spent[t.category_id] || 0) + convert(Number(t.amount), t.currency || "USD", base);
    }
  }
  const out = [];
  for (const c of categories) {
    if (c.type !== "expense" || !c.budget) continue;
    const sp = r2(spent[c.id] || 0);
    const budget = Number(c.budget);
    const pct = budget ? Math.round((sp / budget) * 100) : 0;
    const level = pct >= 100 ? "over" : pct >= 80 ? "warning" : "ok";
    if (level !== "ok") out.push({ id: c.id, name: c.name, color: c.color, spent: sp, budget, pct, level });
  }
  out.sort((a, b) => b.pct - a.pct);
  return { month, base_currency: base, alerts: out };
}

export function computePaycheck(transactions, categories, base) {
  const year = new Date().getFullYear();
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const mInc = {}, mBills = {}, mSav = {};
  const incomes = [];
  for (const t of transactions) {
    const mk = (t.date || "").slice(0, 7);
    if (!mk.startsWith(String(year))) continue;
    const amt = convert(Number(t.amount), t.currency || "USD", base);
    if (t.type === "income") { mInc[mk] = (mInc[mk] || 0) + amt; incomes.push({ t, amt, mk }); }
    else {
      const cat = catMap[t.category_id];
      const bucket = cat ? cat.bucket : "needs";
      if (bucket === "savings") mSav[mk] = (mSav[mk] || 0) + amt;
      else if (t.kind === "recurring" || bucket === "needs") mBills[mk] = (mBills[mk] || 0) + amt;
    }
  }
  const paychecks = incomes.map(({ t, amt, mk }) => {
    const inc = mInc[mk] || amt;
    const share = inc ? amt / inc : 1;
    const bills = r2((mBills[mk] || 0) * share);
    const savings = r2((mSav[mk] || 0) * share);
    const spending = r2(Math.max(amt - bills - savings, 0));
    return { id: t.id, date: t.date, description: t.description, amount: r2(amt), bills, savings, spending };
  }).sort((a, b) => (a.date < b.date ? 1 : -1));
  return {
    base_currency: base, paychecks,
    totals: {
      amount: r2(paychecks.reduce((s, p) => s + p.amount, 0)),
      bills: r2(paychecks.reduce((s, p) => s + p.bills, 0)),
      savings: r2(paychecks.reduce((s, p) => s + p.savings, 0)),
      spending: r2(paychecks.reduce((s, p) => s + p.spending, 0)),
    },
  };
}

export function computeBreakdown(transactions, categories, base) {
  const year = new Date().getFullYear();
  const catMap = Object.fromEntries(categories.map((c) => [c.id, c]));
  const keys = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`);
  const data = {};
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const mk = (t.date || "").slice(0, 7);
    if (!mk.startsWith(String(year))) continue;
    const amt = convert(Number(t.amount), t.currency || "USD", base);
    const cat = catMap[t.category_id];
    const name = cat ? cat.name : "Uncategorized";
    const color = cat ? cat.color : "#94a3b8";
    if (!data[name]) data[name] = { name, color, total: 0, monthly: Object.fromEntries(keys.map((m) => [m, 0])) };
    data[name].total += amt;
    if (data[name].monthly[mk] !== undefined) data[name].monthly[mk] += amt;
  }
  const cats = Object.values(data).sort((a, b) => b.total - a.total).map((c) => ({
    name: c.name, color: c.color, total: r2(c.total),
    monthly: keys.map((m, i) => ({ month: m, label: LABELS[i], value: r2(c.monthly[m]) })),
  }));
  return { base_currency: base, categories: cats, months: LABELS, total: r2(cats.reduce((s, c) => s + c.total, 0)) };
}

export function computeCompare(transactions, base) {
  const cy = new Date().getFullYear();
  const py = cy - 1;
  const build = (year) => {
    const months = {};
    for (let m = 1; m <= 12; m++) months[`${year}-${String(m).padStart(2, "0")}`] = { income: 0, expense: 0 };
    for (const t of transactions) {
      const mk = (t.date || "").slice(0, 7);
      if (months[mk]) {
        const amt = convert(Number(t.amount), t.currency || "USD", base);
        months[mk][t.type === "income" ? "income" : "expense"] += amt;
      }
    }
    return months;
  };
  const C = build(cy), P = build(py);
  const rows = [];
  for (let i = 0; i < 12; i++) {
    const m = String(i + 1).padStart(2, "0");
    const ck = `${cy}-${m}`, pk = `${py}-${m}`;
    rows.push({
      label: LABELS[i],
      cur_income: r2(C[ck].income), cur_expense: r2(C[ck].expense),
      prev_income: r2(P[pk].income), prev_expense: r2(P[pk].expense),
      cur_net: r2(C[ck].income - C[ck].expense), prev_net: r2(P[pk].income - P[pk].expense),
    });
  }
  const tot = (d) => {
    const inc = Object.values(d).reduce((s, v) => s + v.income, 0);
    const exp = Object.values(d).reduce((s, v) => s + v.expense, 0);
    return { income: r2(inc), expense: r2(exp), net: r2(inc - exp) };
  };
  return { base_currency: base, current_year: cy, previous_year: py, rows, totals: { current: tot(C), previous: tot(P) } };
}

export function computePayoff(debts, strategy = "snowball", extra = 0) {
  let working = debts.filter((d) => Number(d.balance) > 0).map((d) => ({ name: d.name, balance: Number(d.balance), apr: Number(d.apr || 0), min: Number(d.min_payment || 0) }));
  if (!working.length) return { months: 0, years: 0, total_interest: 0, total_paid: 0, schedule: [], payoff_order: [] };
  if (strategy === "avalanche") working.sort((a, b) => b.apr - a.apr);
  else working.sort((a, b) => a.balance - b.balance);
  const budget = working.reduce((s, d) => s + d.min, 0) + Math.max(0, extra);
  let totalInterest = 0, totalPaid = 0, month = 0;
  const schedule = [], order = [];
  while (working.some((d) => d.balance > 0) && month < 600) {
    month++;
    let avail = budget;
    for (const d of working) if (d.balance > 0) { const i = (d.balance * (d.apr / 100)) / 12; d.balance += i; totalInterest += i; }
    for (const d of working) if (d.balance > 0) { const pay = Math.min(d.min, d.balance, avail); d.balance -= pay; avail -= pay; totalPaid += pay; }
    for (const d of working) if (d.balance > 0 && avail > 0) { const pay = Math.min(avail, d.balance); d.balance -= pay; avail -= pay; totalPaid += pay; }
    for (const d of working) if (d.balance <= 0.01 && !order.includes(d.name)) order.push(d.name);
    if (month <= 120) schedule.push({ month, remaining: r2(working.reduce((s, d) => s + Math.max(0, d.balance), 0)) });
  }
  return { months: month, years: Math.round((month / 12) * 10) / 10, total_interest: r2(totalInterest), total_paid: r2(totalPaid), schedule, payoff_order: order };
}

export function computeGoals(funds, transactions, base) {
  const year = new Date().getFullYear();
  const monthNow = new Date().getMonth() + 1;
  const incomeTotal = transactions.filter((t) => t.type === "income" && (t.date || "").slice(0, 4) === String(year))
    .reduce((s, t) => s + convert(Number(t.amount), t.currency || "USD", base), 0);
  const avgIncome = monthNow ? r2(incomeTotal / monthNow) : 0;
  const today = new Date();
  let totalMonthly = 0;
  const plan = [];
  for (const f of funds) {
    const remaining = Math.max(Number(f.target) - Number(f.saved || 0), 0);
    let monthsLeft = 12;
    if (f.due_date) {
      const due = new Date(f.due_date);
      if (!isNaN(due)) monthsLeft = Math.max((due.getFullYear() - today.getFullYear()) * 12 + (due.getMonth() - today.getMonth()), 1);
    }
    const monthly = monthsLeft ? r2(remaining / monthsLeft) : remaining;
    totalMonthly += monthly;
    plan.push({ id: f.id, name: f.name, color: f.color, target: Number(f.target), saved: Number(f.saved || 0), remaining: r2(remaining), months_left: monthsLeft, monthly, due_date: f.due_date || null });
  }
  plan.sort((a, b) => b.monthly - a.monthly);
  return { base_currency: base, avg_monthly_income: avgIncome, total_monthly: r2(totalMonthly), pct_income: avgIncome ? r1((totalMonthly / avgIncome) * 100) : 0, plan };
}

// Returns an array of NEW recurring docs to insert for targetMonth (YYYY-MM), deduped.
export function generateRecurring(transactions, targetMonth) {
  const rec = transactions.filter((t) => t.kind === "recurring");
  if (!rec.length) return [];
  const prior = [...new Set(rec.filter((t) => t.date.slice(0, 7) < targetMonth).map((t) => t.date.slice(0, 7)))].sort().reverse();
  if (!prior.length) return [];
  const src = prior[0];
  const existing = new Set(rec.filter((t) => t.date.slice(0, 7) === targetMonth).map((t) => `${t.description}|${t.category_id}|${t.date.slice(8, 10)}`));
  const docs = [];
  for (const t of rec) {
    if (t.date.slice(0, 7) !== src) continue;
    const day = t.date.slice(8, 10);
    const key = `${t.description}|${t.category_id}|${day}`;
    if (existing.has(key)) continue;
    existing.add(key);
    docs.push({
      id: uuid(), created_at: new Date().toISOString(), date: `${targetMonth}-${day}`,
      description: t.description, amount: t.amount, currency: t.currency || "USD",
      type: t.type, kind: "recurring", category_id: t.category_id, account_id: t.account_id,
    });
  }
  return docs;
}
