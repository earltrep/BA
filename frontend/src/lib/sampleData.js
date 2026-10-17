import { dbReplaceAll, patchMeta, uuid } from "./db";

// Builds a realistic sample budget (current year + last year for Year Compare)
// and writes it in one atomic transaction. Used only when the customer opts in.
export async function loadSampleData() {
  const now = new Date();
  const year = now.getFullYear();
  const curMonth = now.getMonth() + 1;
  let seed = 42;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const ri = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
  const iso = () => new Date().toISOString();

  const accounts = [
    { id: uuid(), created_at: iso(), name: "Everyday Checking", type: "checking", balance: 4820.5, currency: "USD", color: "#0f172a" },
    { id: uuid(), created_at: iso(), name: "High-Yield Savings", type: "savings", balance: 15230, currency: "USD", color: "#0ea5e9" },
    { id: uuid(), created_at: iso(), name: "Travel Card", type: "credit", balance: -1240.75, currency: "EUR", color: "#f59e0b" },
    { id: uuid(), created_at: iso(), name: "Brokerage", type: "investment", balance: 28750, currency: "USD", color: "#10b981" },
  ];
  const accId = Object.fromEntries(accounts.map((a) => [a.name, a.id]));

  const catDefs = [
    ["Salary", "income", "income", 5200, "#10b981"],
    ["Freelance", "income", "income", 600, "#22c55e"],
    ["Rent", "expense", "needs", 1600, "#ef4444"],
    ["Groceries", "expense", "needs", 550, "#f97316"],
    ["Utilities", "expense", "needs", 220, "#eab308"],
    ["Transport", "expense", "needs", 180, "#84cc16"],
    ["Insurance", "expense", "needs", 150, "#06b6d4"],
    ["Dining Out", "expense", "wants", 300, "#8b5cf6"],
    ["Entertainment", "expense", "wants", 120, "#ec4899"],
    ["Shopping", "expense", "wants", 200, "#f43f5e"],
    ["Subscriptions", "expense", "wants", 60, "#a855f7"],
    ["Savings Transfer", "expense", "savings", 700, "#0ea5e9"],
  ];
  const categories = catDefs.map(([name, type, bucket, budget, color]) => ({ id: uuid(), created_at: iso(), name, type, bucket, budget, color }));
  const catId = Object.fromEntries(categories.map((c) => [c.name, c.id]));

  const transactions = [];
  const add = (date, description, amount, type, kind, cat, acc = "Everyday Checking", ccy = "USD") =>
    transactions.push({ id: uuid(), created_at: iso(), date, description, amount, currency: ccy, type, kind, category_id: catId[cat], account_id: accId[acc] });

  const recurring = [
    ["Salary", "income", "Monthly Salary", 5200, 1, "Everyday Checking"],
    ["Freelance", "income", "Design retainer", 600, 15, "Everyday Checking"],
    ["Rent", "expense", "Apartment rent", 1600, 2, "Everyday Checking"],
    ["Utilities", "expense", "Electricity & water", 210, 5, "Everyday Checking"],
    ["Insurance", "expense", "Health insurance", 150, 8, "Everyday Checking"],
    ["Subscriptions", "expense", "Streaming + cloud", 55, 10, "Everyday Checking"],
    ["Savings Transfer", "expense", "Auto-save to savings", 700, 3, "High-Yield Savings"],
  ];
  const variable = [
    ["Groceries", 40, 140, "Everyday Checking", 4],
    ["Dining Out", 18, 75, "Travel Card", 4],
    ["Transport", 10, 45, "Everyday Checking", 3],
    ["Entertainment", 15, 60, "Travel Card", 2],
    ["Shopping", 25, 160, "Travel Card", 2],
  ];
  const mm = (m) => String(m).padStart(2, "0");
  for (let m = 1; m <= curMonth; m++) {
    for (const [cat, type, desc, amount, day, acc] of recurring) {
      add(`${year}-${mm(m)}-${mm(day)}`, desc, amount + (type === "expense" ? ri(-20, 20) : 0), type, "recurring", cat, acc);
    }
    for (const [cat, lo, hi, acc, times] of variable) {
      for (let k = 0; k < times; k++) {
        const ccy = acc === "Travel Card" ? "EUR" : "USD";
        add(`${year}-${mm(m)}-${mm(ri(1, 27))}`, `${cat} purchase`, ri(lo, hi), "expense", "variable", cat, acc, ccy);
      }
    }
  }
  // Prior year (for Year Compare)
  const py = year - 1;
  for (let m = 1; m <= 12; m++) {
    add(`${py}-${mm(m)}-01`, "Monthly Salary", 4900, "income", "recurring", "Salary");
    add(`${py}-${mm(m)}-02`, "Apartment rent", 1550, "expense", "recurring", "Rent");
    add(`${py}-${mm(m)}-05`, "Electricity & water", ri(190, 230), "expense", "recurring", "Utilities");
    add(`${py}-${mm(m)}-03`, "Auto-save to savings", 600, "expense", "recurring", "Savings Transfer", "High-Yield Savings");
    for (let k = 0; k < 4; k++) add(`${py}-${mm(m)}-${mm(ri(6, 27))}`, "Groceries purchase", ri(45, 150), "expense", "variable", "Groceries");
    for (let k = 0; k < 3; k++) add(`${py}-${mm(m)}-${mm(ri(6, 27))}`, "Dining purchase", ri(20, 80), "expense", "variable", "Dining Out");
  }

  const sinking_funds = [
    { id: uuid(), created_at: iso(), name: "Emergency Fund", target: 10000, saved: 6500, color: "#0ea5e9", due_date: null },
    { id: uuid(), created_at: iso(), name: "Japan Trip", target: 4000, saved: 1450, color: "#f59e0b", due_date: `${year}-12-01` },
    { id: uuid(), created_at: iso(), name: "New Laptop", target: 2200, saved: 900, color: "#8b5cf6", due_date: null },
    { id: uuid(), created_at: iso(), name: "Car Maintenance", target: 1500, saved: 1200, color: "#10b981", due_date: null },
  ];
  const debts = [
    { id: uuid(), created_at: iso(), name: "Student Loan", balance: 12400, apr: 4.5, min_payment: 220 },
    { id: uuid(), created_at: iso(), name: "Credit Card", balance: 3200, apr: 19.99, min_payment: 110 },
    { id: uuid(), created_at: iso(), name: "Car Loan", balance: 8600, apr: 6.2, min_payment: 265 },
  ];
  const networth = [
    { id: uuid(), created_at: iso(), name: "Home Equity", type: "asset", amount: 85000 },
    { id: uuid(), created_at: iso(), name: "401(k)", type: "asset", amount: 42000 },
    { id: uuid(), created_at: iso(), name: "Mortgage", type: "liability", amount: 210000 },
  ];
  const no_spend = [];
  for (let i = 0; i < 20; i++) {
    const d = new Date(year, curMonth - 1, 1 + i);
    if (d.getMonth() + 1 !== curMonth) break;
    no_spend.push({ id: uuid(), created_at: iso(), date: d.toISOString().slice(0, 10), status: rnd() > 0.3 ? "success" : "fail", note: "" });
  }

  const settings = { id: "app", name: "Sample Budget", base_currency: "USD", autopilot: true };

  await dbReplaceAll({ settings, transactions, categories, accounts, sinking_funds, debts, networth, no_spend });
  await patchMeta({ dirty: true });
  return { transactions: transactions.length };
}
