import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/currency";
import { PageHeader, Loader } from "../components/ui-kit";
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from "recharts";

const DEF = [
  { key: "needs", label: "Needs", target: 50, color: "#0f172a", desc: "Rent, groceries, utilities, insurance" },
  { key: "wants", label: "Wants", target: 30, color: "#0ea5e9", desc: "Dining, entertainment, shopping" },
  { key: "savings", label: "Savings & Debt", target: 20, color: "#10b981", desc: "Saving, investing, paying down debt" },
];

export default function Budget503020() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/dashboard").then((r) => setData(r.data)); }, []);
  if (!data) return <Loader />;
  const cur = data.base_currency;
  const income = data.total_income || 0;
  const b = data.buckets;
  const total = (b.needs || 0) + (b.wants || 0) + (b.savings || 0);
  const pie = DEF.map((d) => ({ name: d.label, value: b[d.key] || 0, color: d.color }));

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Build your wealth" title="50 / 30 / 20 Rule" subtitle="Balance needs, wants and savings against the classic budgeting framework." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-head font-semibold text-lg mb-2">Allocation</h3>
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pie} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={2}>
                {pie.map((p, i) => <Cell key={i} fill={p.color} />)}
              </Pie>
              <Tooltip formatter={(v) => money(v, cur)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="text-center text-sm text-slate-400 mt-2">Total allocated: <span className="font-medium text-slate-700 tnum">{money(total, cur)}</span></div>
        </div>

        <div className="lg:col-span-2 space-y-4">
          {DEF.map((d) => {
            const spent = b[d.key] || 0;
            const actualPct = total ? Math.round((spent / total) * 100) : 0;
            const idealAmt = income * (d.target / 100);
            const over = actualPct > d.target;
            return (
              <div key={d.key} data-testid={`bucket-${d.key}`} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2.5">
                    <span className="h-3.5 w-3.5 rounded-sm" style={{ background: d.color }} />
                    <h4 className="font-head font-semibold">{d.label}</h4>
                    <span className="text-xs text-slate-400">target {d.target}%</span>
                  </div>
                  <span className={`text-sm font-semibold tnum ${over ? "text-rose-600" : "text-emerald-600"}`}>{actualPct}%</span>
                </div>
                <p className="text-xs text-slate-400 mb-3">{d.desc}</p>
                <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden relative">
                  <div className="h-full rounded-full" style={{ width: `${Math.min(actualPct, 100)}%`, background: d.color }} />
                  <div className="absolute top-0 bottom-0 w-0.5 bg-slate-400" style={{ left: `${d.target}%` }} title="target" />
                </div>
                <div className="flex justify-between text-xs text-slate-500 mt-2 tnum">
                  <span>Spent {money(spent, cur)}</span>
                  <span>Ideal {money(idealAmt, cur)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
