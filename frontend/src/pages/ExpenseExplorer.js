import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/currency";
import { useSettings } from "../context/SettingsContext";
import { PageHeader, Loader } from "../components/ui-kit";
import { Compass, ChevronRight } from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

export default function ExpenseExplorer() {
  const { convert, baseCurrency } = useSettings();
  const [data, setData] = useState(null);
  const [txns, setTxns] = useState([]);
  const [cats, setCats] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    api.get("/expenses/breakdown").then((r) => { setData(r.data); setSelected(r.data.categories[0]?.name || null); });
    api.get("/transactions").then((r) => setTxns(r.data));
    api.get("/categories").then((r) => setCats(r.data));
  }, []);

  const sel = useMemo(() => data?.categories.find((c) => c.name === selected), [data, selected]);

  const drillTxns = useMemo(() => {
    if (!selected) return [];
    const ids = cats.filter((c) => c.name === selected).map((c) => c.id);
    return txns
      .filter((t) => t.type === "expense" && (ids.includes(t.category_id) || (selected === "Uncategorized" && !t.category_id)))
      .sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [txns, cats, selected]);

  if (!data) return <Loader />;
  const cur = data.base_currency;

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Dashboards" title="Expense Explorer" subtitle="Drill into where your money goes — by category and across every month." />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-head font-semibold text-lg mb-1">Distribution</h3>
          <p className="text-xs text-slate-400 mb-3">Total {money(data.total, cur)}</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie data={data.categories} dataKey="total" nameKey="name" cx="50%" cy="50%" innerRadius={52} outerRadius={82} paddingAngle={2}
                onClick={(e) => setSelected(e?.name)}>
                {data.categories.map((c, i) => <Cell key={i} fill={c.color} opacity={selected && selected !== c.name ? 0.35 : 1} style={{ cursor: "pointer" }} />)}
              </Pie>
              <Tooltip formatter={(v) => money(v, cur)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-head font-semibold text-lg mb-4">Categories</h3>
          <div className="space-y-1.5 max-h-[260px] overflow-y-auto pr-1">
            {data.categories.map((c) => {
              const pct = data.total ? Math.round((c.total / data.total) * 100) : 0;
              const active = selected === c.name;
              return (
                <button
                  key={c.name}
                  onClick={() => setSelected(c.name)}
                  data-testid={`expense-cat-${c.name}`}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${active ? "bg-slate-900 text-white" : "hover:bg-slate-50"}`}
                >
                  <span className="h-3 w-3 rounded-sm shrink-0" style={{ background: c.color }} />
                  <span className="font-medium text-sm flex-1 text-left">{c.name}</span>
                  <span className={`text-xs ${active ? "text-slate-300" : "text-slate-400"}`}>{pct}%</span>
                  <span className="tnum font-semibold text-sm w-24 text-right">{money(c.total, cur)}</span>
                  <ChevronRight className={`h-4 w-4 ${active ? "text-white" : "text-slate-300"}`} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {sel && (
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center gap-2 mb-5">
              <Compass className="h-5 w-5 text-slate-400" />
              <h3 className="font-head font-semibold text-lg">{sel.name} · monthly trend</h3>
            </div>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={sel.monthly}>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#94a3b8" }} tickFormatter={(v) => money(v, cur, { compact: true, decimals: 0 })} width={54} />
                <Tooltip formatter={(v) => money(v, cur)} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                <Bar dataKey="value" fill={sel.color} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-head font-semibold text-lg mb-4">Transactions</h3>
            <div className="space-y-2.5 max-h-[260px] overflow-y-auto">
              {drillTxns.map((t) => (
                <div key={t.id} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2.5">
                  <div><div className="font-medium">{t.description}</div><div className="text-xs text-slate-400">{t.date}</div></div>
                  <span className="font-medium tnum text-slate-700">{money(convert(Number(t.amount), t.currency, baseCurrency), cur)}</span>
                </div>
              ))}
              {drillTxns.length === 0 && <div className="text-slate-400 text-sm">No transactions.</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
