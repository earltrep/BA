import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { money } from "../lib/currency";
import { StatCard, Loader } from "../components/ui-kit";
import {
  Wallet, TrendingUp, TrendingDown, PiggyBank, ArrowRight, Sparkles, Landmark, AlertTriangle,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, PieChart, Pie, Cell,
  Area, AreaChart, CartesianGrid,
} from "recharts";

const PIE_COLORS = ["#0f172a", "#0ea5e9", "#f59e0b", "#10b981", "#8b5cf6", "#ef4444", "#ec4899", "#84cc16"];

export default function Dashboard() {
  const [data, setData] = useState(null);
  const [recent, setRecent] = useState([]);
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    api.get("/dashboard").then((r) => setData(r.data));
    api.get("/transactions").then((r) => setRecent(r.data.slice(0, 7)));
    api.get("/alerts").then((r) => setAlerts(r.data.alerts));
  }, []);

  if (!data) return <Loader label="Crunching your numbers…" />;
  const cur = data.base_currency;
  const savingsPct = data.savings_target ? Math.round((data.savings_total / data.savings_target) * 100) : 0;

  return (
    <div className="fade-up">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 mb-2">
            All-in-one dashboard · {new Date().getFullYear()}
          </div>
          <h1 className="font-head font-bold text-3xl sm:text-4xl tracking-tight">Financial Overview</h1>
        </div>
        <Link
          to="/ai"
          data-testid="dashboard-ai-link"
          className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
        >
          <Sparkles className="h-4 w-4" /> Ask AI about my money
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5 mb-5">
        <StatCard testid="stat-income" label="Income (YTD)" value={money(data.total_income, cur, { compact: true })} icon={TrendingUp} accent="emerald" delta={`${data.savings_rate}% saved`} />
        <StatCard testid="stat-expense" label="Expenses (YTD)" value={money(data.total_expense, cur, { compact: true })} icon={TrendingDown} accent="rose" />
        <StatCard testid="stat-balance" label="Accounts Balance" value={money(data.account_total, cur, { compact: true })} icon={Wallet} accent="blue" />
        <StatCard testid="stat-networth" label="Net Worth" value={money(data.net_worth, cur, { compact: true })} icon={Landmark} accent="slate" />
      </div>

      {alerts.length > 0 && (
        <div data-testid="budget-alerts" className="bg-white border border-amber-200 rounded-2xl p-6 shadow-sm mb-5">
          <div className="flex items-center gap-2 mb-4">
            <span className="h-8 w-8 grid place-items-center rounded-xl bg-amber-50 text-amber-600"><AlertTriangle className="h-4 w-4" /></span>
            <h3 className="font-head font-semibold text-lg">Budget alerts</h3>
            <span className="text-xs text-slate-400">· categories nearing or over budget this month</span>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {alerts.map((a) => (
              <div key={a.id} data-testid={`alert-${a.id}`} className={`rounded-xl border p-3 ${a.level === "over" ? "border-rose-200 bg-rose-50/50" : "border-amber-200 bg-amber-50/40"}`}>
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: a.color }} />{a.name}</span>
                  <span className={`text-xs font-semibold ${a.level === "over" ? "text-rose-600" : "text-amber-600"}`}>{a.pct}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-white mt-2 overflow-hidden">
                  <div className={`h-full rounded-full ${a.level === "over" ? "bg-rose-500" : "bg-amber-500"}`} style={{ width: `${Math.min(a.pct, 100)}%` }} />
                </div>
                <div className="text-xs text-slate-500 mt-1.5 tnum">{money(a.spent, cur)} of {money(a.budget, cur)}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-head font-semibold text-lg">Cash flow by month</h3>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Income</span>
              <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />Expense</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.monthly} barGap={4}>
              <CartesianGrid vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} tickFormatter={(v) => money(v, cur, { compact: true, decimals: 0 })} width={54} />
              <Tooltip formatter={(v) => money(v, cur)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
              <Bar dataKey="income" fill="#10b981" radius={[4, 4, 0, 0]} />
              <Bar dataKey="expense" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-head font-semibold text-lg mb-2">Where money goes</h3>
          <p className="text-xs text-slate-400 mb-4">Expense distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.by_category.slice(0, 7)} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={2}>
                {data.by_category.slice(0, 7).map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v) => money(v, cur)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="mt-4 space-y-2">
            {data.by_category.slice(0, 5).map((c, i) => (
              <div key={c.name} className="flex items-center justify-between text-sm">
                <span className="flex items-center gap-2 text-slate-600">
                  <span className="h-2.5 w-2.5 rounded-sm" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {c.name}
                </span>
                <span className="font-medium tnum">{money(c.value, cur)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-head font-semibold text-lg">Savings goals</h3>
            <PiggyBank className="h-5 w-5 text-sky-500" />
          </div>
          <div className="font-head font-bold text-2xl tnum mt-2">{money(data.savings_total, cur)}</div>
          <div className="text-sm text-slate-400 mb-4">of {money(data.savings_target, cur)} target</div>
          <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
            <div className="h-full bg-sky-500 rounded-full transition-all" style={{ width: `${Math.min(savingsPct, 100)}%` }} />
          </div>
          <Link to="/funds" className="mt-4 inline-flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline">
            Manage funds <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-1">
            <h3 className="font-head font-semibold text-lg">Debt remaining</h3>
            <TrendingDown className="h-5 w-5 text-rose-500" />
          </div>
          <div className="font-head font-bold text-2xl tnum mt-2 text-rose-600">{money(data.debt_total, cur)}</div>
          <div className="text-sm text-slate-400 mb-4">across all tracked debts</div>
          <ResponsiveContainer width="100%" height={70}>
            <AreaChart data={data.monthly}>
              <defs>
                <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f43f5e" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey="expense" stroke="#f43f5e" fill="url(#g1)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
          <Link to="/debt" className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 font-medium hover:underline">
            Build payoff plan <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-head font-semibold text-lg">Recent activity</h3>
            <Link to="/transactions" className="text-xs text-blue-600 font-medium hover:underline">View all</Link>
          </div>
          <div className="space-y-3">
            {recent.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">{t.description}</div>
                  <div className="text-xs text-slate-400">{t.date}</div>
                </div>
                <span className={`font-medium tnum ${t.type === "income" ? "text-emerald-600" : "text-slate-700"}`}>
                  {t.type === "income" ? "+" : "-"}{money(t.amount, t.currency)}
                </span>
              </div>
            ))}
            {recent.length === 0 && <div className="text-sm text-slate-400">No transactions yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
