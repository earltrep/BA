import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/currency";
import { PageHeader, StatCard, Loader } from "../components/ui-kit";
import { TrendingUp, TrendingDown, Scale } from "lucide-react";
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

export default function Annual() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/dashboard").then((r) => setData(r.data)); }, []);
  if (!data) return <Loader />;
  const cur = data.base_currency;
  const rows = data.monthly.map((m) => ({ ...m, net: m.income - m.expense }));

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Dashboards" title="Annual Totals" subtitle={`Your ${new Date().getFullYear()} income, expenses and net savings at a glance.`} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <StatCard testid="annual-income" label="Total income" value={money(data.total_income, cur)} icon={TrendingUp} accent="emerald" />
        <StatCard testid="annual-expense" label="Total expenses" value={money(data.total_expense, cur)} icon={TrendingDown} accent="rose" />
        <StatCard testid="annual-net" label="Net saved" value={money(data.net, cur)} icon={Scale} accent="blue" delta={`${data.savings_rate}% rate`} />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <h3 className="font-head font-semibold text-lg mb-5">Income vs Expense vs Net</h3>
        <ResponsiveContainer width="100%" height={320}>
          <ComposedChart data={rows}>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} tickFormatter={(v) => money(v, cur, { compact: true, decimals: 0 })} width={54} />
            <Tooltip formatter={(v) => money(v, cur)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="income" name="Income" fill="#10b981" radius={[4, 4, 0, 0]} />
            <Bar dataKey="expense" name="Expense" fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            <Line dataKey="net" name="Net" stroke="#0f172a" strokeWidth={2.5} dot={{ r: 3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <th className="px-6 py-3 font-medium">Month</th>
              <th className="px-6 py-3 font-medium text-right">Income</th>
              <th className="px-6 py-3 font-medium text-right">Expense</th>
              <th className="px-6 py-3 font-medium text-right">Net</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m) => (
              <tr key={m.month} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-6 py-3 font-medium">{m.label}</td>
                <td className="px-6 py-3 text-right tnum text-emerald-600">{money(m.income, cur)}</td>
                <td className="px-6 py-3 text-right tnum text-slate-600">{money(m.expense, cur)}</td>
                <td className={`px-6 py-3 text-right tnum font-semibold ${m.net >= 0 ? "text-slate-900" : "text-rose-600"}`}>{money(m.net, cur)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t border-slate-200 font-semibold bg-slate-50/60">
              <td className="px-6 py-3">Total</td>
              <td className="px-6 py-3 text-right tnum text-emerald-600">{money(data.total_income, cur)}</td>
              <td className="px-6 py-3 text-right tnum">{money(data.total_expense, cur)}</td>
              <td className="px-6 py-3 text-right tnum">{money(data.net, cur)}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
