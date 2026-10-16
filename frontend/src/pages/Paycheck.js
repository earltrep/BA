import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/currency";
import { PageHeader, StatCard, Loader } from "../components/ui-kit";
import { Receipt, Home, PiggyBank, Wallet } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

export default function Paycheck() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/paycheck").then((r) => setData(r.data)); }, []);
  if (!data) return <Loader />;
  const cur = data.base_currency;
  const t = data.totals;
  const chart = data.paychecks.slice(0, 10).reverse().map((p) => ({
    label: p.date.slice(5),
    Bills: p.bills, Savings: p.savings, Spending: p.spending,
  }));

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Dashboards" title="Paycheck Planner" subtitle="Every paycheck split into bills, savings and spending money — so each dollar has a job." />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-6">
        <StatCard testid="pay-total" label="Total income (YTD)" value={money(t.amount, cur, { compact: true })} icon={Receipt} accent="emerald" />
        <StatCard testid="pay-bills" label="To bills & needs" value={money(t.bills, cur, { compact: true })} icon={Home} accent="rose" />
        <StatCard testid="pay-savings" label="To savings" value={money(t.savings, cur, { compact: true })} icon={PiggyBank} accent="blue" />
        <StatCard testid="pay-spending" label="Free to spend" value={money(t.spending, cur, { compact: true })} icon={Wallet} accent="amber" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <h3 className="font-head font-semibold text-lg mb-5">Allocation per paycheck</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart}>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} tickFormatter={(v) => money(v, cur, { compact: true, decimals: 0 })} width={54} />
            <Tooltip formatter={(v) => money(v, cur)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="Bills" stackId="a" fill="#f43f5e" radius={[0, 0, 0, 0]} />
            <Bar dataKey="Savings" stackId="a" fill="#0ea5e9" />
            <Bar dataKey="Spending" stackId="a" fill="#10b981" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Paycheck</th>
              <th className="px-5 py-3 font-medium text-right">Amount</th>
              <th className="px-5 py-3 font-medium text-right">Bills</th>
              <th className="px-5 py-3 font-medium text-right">Savings</th>
              <th className="px-5 py-3 font-medium text-right">Spending</th>
            </tr>
          </thead>
          <tbody>
            {data.paychecks.map((p) => (
              <tr key={p.id} data-testid={`paycheck-row-${p.id}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-5 py-3 text-slate-500 tnum whitespace-nowrap">{p.date}</td>
                <td className="px-5 py-3 font-medium">{p.description}</td>
                <td className="px-5 py-3 text-right tnum font-semibold text-emerald-600">{money(p.amount, cur)}</td>
                <td className="px-5 py-3 text-right tnum text-rose-500">{money(p.bills, cur)}</td>
                <td className="px-5 py-3 text-right tnum text-sky-600">{money(p.savings, cur)}</td>
                <td className="px-5 py-3 text-right tnum text-slate-700">{money(p.spending, cur)}</td>
              </tr>
            ))}
            {data.paychecks.length === 0 && <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">No income transactions yet — add a paycheck on the Transactions page.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400 mt-4">Bills = recurring &amp; needs spending, Savings = savings-bucket spending, Spending = whatever's left. Allocated proportionally within each month.</p>
    </div>
  );
}
