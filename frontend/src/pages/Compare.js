import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/currency";
import { PageHeader, Loader } from "../components/ui-kit";
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from "recharts";

function Delta({ cur, prev }) {
  const diff = cur - prev;
  if (Math.abs(diff) < 0.5) return <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Minus className="h-3 w-3" /> flat</span>;
  const up = diff > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${up ? "text-emerald-600" : "text-rose-600"}`}>
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {prev ? Math.abs(Math.round((diff / prev) * 100)) : 100}%
    </span>
  );
}

export default function Compare() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/compare").then((r) => setData(r.data)); }, []);
  if (!data) return <Loader />;
  const cur = data.base_currency;
  const C = data.totals.current, P = data.totals.previous;
  const chart = data.rows.map((r) => ({ label: r.label, [`${data.previous_year}`]: r.prev_net, [`${data.current_year}`]: r.cur_net }));

  const cards = [
    { label: "Income", c: C.income, p: P.income },
    { label: "Expenses", c: C.expense, p: P.expense, invert: true },
    { label: "Net saved", c: C.net, p: P.net },
  ];

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Dashboards" title="Year Compare" subtitle={`${data.current_year} vs ${data.previous_year} — see whether your money habits are improving.`} />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        {cards.map((k) => (
          <div key={k.label} data-testid={`compare-${k.label.toLowerCase().split(" ")[0]}`} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{k.label}</div>
            <div className="mt-3 flex items-end justify-between">
              <div>
                <div className="font-head font-bold text-2xl tnum">{money(k.c, cur, { compact: true })}</div>
                <div className="text-xs text-slate-400 mt-0.5">{data.current_year}</div>
              </div>
              <div className="text-right">
                <div className="font-head font-medium text-lg tnum text-slate-400">{money(k.p, cur, { compact: true })}</div>
                <div className="text-xs text-slate-400 mt-0.5">{data.previous_year}</div>
              </div>
            </div>
            <div className="mt-3 pt-3 border-t border-slate-100">
              <Delta cur={k.invert ? k.p : k.c} prev={k.invert ? k.c : k.p} />
              <span className="text-xs text-slate-400 ml-2">vs last year</span>
            </div>
          </div>
        ))}
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <h3 className="font-head font-semibold text-lg mb-5">Net savings by month</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chart} barGap={4}>
            <CartesianGrid vertical={false} stroke="#f1f5f9" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} tickFormatter={(v) => money(v, cur, { compact: true, decimals: 0 })} width={54} />
            <Tooltip formatter={(v) => money(v, cur)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey={`${data.previous_year}`} fill="#cbd5e1" radius={[4, 4, 0, 0]} />
            <Bar dataKey={`${data.current_year}`} fill="#0f172a" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">Month</th>
              <th className="px-5 py-3 font-medium text-right">{data.previous_year} net</th>
              <th className="px-5 py-3 font-medium text-right">{data.current_year} net</th>
              <th className="px-5 py-3 font-medium text-right">Change</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={r.label} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-5 py-3 font-medium">{r.label}</td>
                <td className="px-5 py-3 text-right tnum text-slate-400">{money(r.prev_net, cur)}</td>
                <td className="px-5 py-3 text-right tnum font-semibold">{money(r.cur_net, cur)}</td>
                <td className="px-5 py-3 text-right"><Delta cur={r.cur_net} prev={r.prev_net} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
