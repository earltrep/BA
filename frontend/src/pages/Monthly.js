import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/currency";
import { useSettings } from "../context/SettingsContext";
import { PageHeader, StatCard, Loader } from "../components/ui-kit";
import { TrendingUp, TrendingDown, Wallet } from "lucide-react";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function Monthly() {
  const { baseCurrency, convert } = useSettings();
  const [txns, setTxns] = useState(null);
  const [cats, setCats] = useState([]);
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth());
  const year = now.getFullYear();

  useEffect(() => {
    api.get("/transactions").then((r) => setTxns(r.data));
    api.get("/categories").then((r) => setCats(r.data));
  }, []);

  const key = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthTxns = useMemo(() => (txns || []).filter((t) => t.date.startsWith(key)), [txns, key]);

  const { income, expense, byCat } = useMemo(() => {
    let income = 0, expense = 0;
    const byCat = {};
    monthTxns.forEach((t) => {
      const amt = convert(Number(t.amount), t.currency || "USD", baseCurrency);
      if (t.type === "income") income += amt;
      else {
        expense += amt;
        const c = cats.find((x) => x.id === t.category_id);
        const name = c?.name || "Uncategorized";
        if (!byCat[name]) byCat[name] = { spent: 0, budget: c?.budget || 0, color: c?.color || "#94a3b8" };
        byCat[name].spent += amt;
      }
    });
    return { income, expense, byCat };
  }, [monthTxns, cats, baseCurrency, convert]);

  if (!txns) return <Loader />;
  const cur = baseCurrency;
  const catRows = Object.entries(byCat).sort((a, b) => b[1].spent - a[1].spent);

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Dashboards" title="Monthly Insights" subtitle="Drill into any month — start your budget at any time of the year." />

      <div className="flex flex-wrap gap-1.5 mb-6">
        {MONTHS.map((m, i) => (
          <button
            key={m}
            onClick={() => setMonth(i)}
            data-testid={`month-btn-${i}`}
            className={`px-4 h-9 rounded-lg text-sm font-medium transition-colors ${i === month ? "bg-slate-900 text-white" : "bg-white border border-slate-200 text-slate-500 hover:bg-slate-50"}`}
          >
            {m}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <StatCard testid="month-income" label={`${MONTHS[month]} income`} value={money(income, cur)} icon={TrendingUp} accent="emerald" />
        <StatCard testid="month-expense" label={`${MONTHS[month]} expenses`} value={money(expense, cur)} icon={TrendingDown} accent="rose" />
        <StatCard testid="month-net" label="Net this month" value={money(income - expense, cur)} icon={Wallet} accent="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-head font-semibold text-lg mb-5">Spend vs budget</h3>
          {catRows.length === 0 && <div className="text-slate-400 text-sm">No spending recorded this month.</div>}
          <div className="space-y-4">
            {catRows.map(([name, d]) => {
              const pct = d.budget ? Math.round((d.spent / d.budget) * 100) : 100;
              const over = d.budget && d.spent > d.budget;
              return (
                <div key={name}>
                  <div className="flex items-center justify-between text-sm mb-1.5">
                    <span className="flex items-center gap-2 font-medium"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: d.color }} />{name}</span>
                    <span className="tnum text-slate-500">{money(d.spent, cur)}{d.budget ? ` / ${money(d.budget, cur)}` : ""}</span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                    <div className={`h-full rounded-full ${over ? "bg-rose-500" : "bg-slate-800"}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-head font-semibold text-lg mb-4">Transactions · {MONTHS[month]}</h3>
          <div className="space-y-2.5 max-h-[420px] overflow-y-auto">
            {monthTxns.map((t) => (
              <div key={t.id} className="flex items-center justify-between text-sm border-b border-slate-50 pb-2.5">
                <div><div className="font-medium">{t.description}</div><div className="text-xs text-slate-400">{t.date}</div></div>
                <span className={`font-medium tnum ${t.type === "income" ? "text-emerald-600" : "text-slate-700"}`}>{t.type === "income" ? "+" : "-"}{money(t.amount, t.currency)}</span>
              </div>
            ))}
            {monthTxns.length === 0 && <div className="text-slate-400 text-sm">Nothing logged yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
