import React, { useMemo, useState } from "react";
import { money } from "../lib/currency";
import { useSettings } from "../context/SettingsContext";
import { PageHeader, StatCard } from "../components/ui-kit";
import { inputCls } from "../components/Modal";
import { LineChart as LineIcon, Coins, TrendingUp } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";

export default function Investment() {
  const { baseCurrency } = useSettings();
  const cur = baseCurrency;
  const [initial, setInitial] = useState(5000);
  const [monthly, setMonthly] = useState(500);
  const [rate, setRate] = useState(7);
  const [years, setYears] = useState(20);

  const { series, finalValue, contributed, growth } = useMemo(() => {
    const r = Number(rate) / 100 / 12;
    const n = Number(years) * 12;
    let bal = Number(initial) || 0;
    const m = Number(monthly) || 0;
    const series = [];
    let contributed = Number(initial) || 0;
    for (let i = 1; i <= n; i++) {
      bal = bal * (1 + r) + m;
      contributed += m;
      if (i % 12 === 0) series.push({ year: i / 12, value: Math.round(bal), contributed: Math.round(contributed) });
    }
    return { series, finalValue: Math.round(bal), contributed: Math.round(contributed), growth: Math.round(bal - contributed) };
  }, [initial, monthly, rate, years]);

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Build your wealth" title="Investment Forecast" subtitle="Project the power of compound growth on your investments." />

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-5 mb-6">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700">Initial amount ({cur})</label>
            <input type="number" className={inputCls + " mt-1.5"} value={initial} onChange={(e) => setInitial(e.target.value)} data-testid="inv-initial" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Monthly contribution</label>
            <input type="number" className={inputCls + " mt-1.5"} value={monthly} onChange={(e) => setMonthly(e.target.value)} data-testid="inv-monthly" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Annual return: {rate}%</label>
            <input type="range" min="1" max="15" step="0.5" value={rate} onChange={(e) => setRate(e.target.value)} data-testid="inv-rate" className="w-full mt-2 accent-slate-900" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Years: {years}</label>
            <input type="range" min="1" max="40" value={years} onChange={(e) => setYears(e.target.value)} data-testid="inv-years" className="w-full mt-2 accent-slate-900" />
          </div>
        </div>

        <div className="lg:col-span-3 grid grid-cols-1 gap-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <StatCard testid="inv-final" label="Future value" value={money(finalValue, cur, { compact: true })} icon={Coins} accent="emerald" />
            <StatCard testid="inv-contributed" label="You invest" value={money(contributed, cur, { compact: true })} icon={LineIcon} accent="slate" />
            <StatCard testid="inv-growth" label="Market growth" value={money(growth, cur, { compact: true })} icon={TrendingUp} accent="blue" />
          </div>
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-head font-semibold text-lg mb-4">Projected growth</h3>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={series}>
                <defs>
                  <linearGradient id="iv" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10b981" stopOpacity={0.25} /><stop offset="100%" stopColor="#10b981" stopOpacity={0} /></linearGradient>
                  <linearGradient id="ic" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#94a3b8" stopOpacity={0.2} /><stop offset="100%" stopColor="#94a3b8" stopOpacity={0} /></linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v) => `${v}y`} />
                <YAxis tick={{ fontSize: 12, fill: "#94a3b8" }} tickLine={false} axisLine={false} tickFormatter={(v) => money(v, cur, { compact: true, decimals: 0 })} width={54} />
                <Tooltip formatter={(v) => money(v, cur)} labelFormatter={(l) => `Year ${l}`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 13 }} />
                <Area dataKey="contributed" name="Contributed" stroke="#94a3b8" fill="url(#ic)" strokeWidth={2} />
                <Area dataKey="value" name="Value" stroke="#10b981" fill="url(#iv)" strokeWidth={2.5} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
