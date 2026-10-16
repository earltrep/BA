import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/currency";
import { PageHeader, StatCard, Loader } from "../components/ui-kit";
import { Target, Wallet, CalendarClock } from "lucide-react";

export default function FundingPlan() {
  const [data, setData] = useState(null);
  useEffect(() => { api.get("/goals/plan").then((r) => setData(r.data)); }, []);
  if (!data) return <Loader />;
  const cur = data.base_currency;
  const leftover = Math.max(data.avg_monthly_income - data.total_monthly, 0);

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Build your wealth" title="Goal Funding Plan" subtitle="How much to set aside from each month's income to hit every savings goal on time." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <StatCard testid="fund-income" label="Avg monthly income" value={money(data.avg_monthly_income, cur)} icon={Wallet} accent="emerald" />
        <StatCard testid="fund-needed" label="Needed for goals / mo" value={money(data.total_monthly, cur)} icon={Target} accent="blue" delta={`${data.pct_income}% of income`} />
        <StatCard testid="fund-leftover" label="Left after goals" value={money(leftover, cur)} icon={CalendarClock} accent="amber" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-head font-semibold text-lg">Suggested monthly allocation</h3>
          <span className="text-sm text-slate-400 tnum">{money(data.total_monthly, cur)} / mo total</span>
        </div>
        <div className="h-4 rounded-full bg-slate-100 overflow-hidden flex">
          {data.plan.map((p) => {
            const w = data.total_monthly ? (p.monthly / data.total_monthly) * 100 : 0;
            return <div key={p.id} style={{ width: `${w}%`, background: p.color }} title={`${p.name}: ${money(p.monthly, cur)}`} />;
          })}
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-4">
          {data.plan.map((p) => (
            <span key={p.id} className="inline-flex items-center gap-2 text-xs text-slate-500">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: p.color }} />{p.name}
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {data.plan.map((p) => {
          const pct = p.target ? Math.min(Math.round((p.saved / p.target) * 100), 100) : 0;
          return (
            <div key={p.id} data-testid={`funding-${p.id}`} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2.5 mb-1">
                <span className="h-3.5 w-3.5 rounded-sm" style={{ background: p.color }} />
                <h4 className="font-head font-semibold">{p.name}</h4>
              </div>
              <div className="text-xs text-slate-400 mb-4">{p.months_left} month{p.months_left === 1 ? "" : "s"} left{p.due_date ? ` · by ${p.due_date}` : ""}</div>
              <div className="rounded-xl bg-slate-900 text-white p-4 text-center mb-4">
                <div className="text-[11px] uppercase tracking-wider text-slate-400">Set aside monthly</div>
                <div className="font-head font-bold text-2xl tnum mt-1">{money(p.monthly, cur)}</div>
              </div>
              <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${pct}%`, background: p.color }} />
              </div>
              <div className="flex justify-between text-xs text-slate-500 mt-2 tnum">
                <span>{money(p.saved, cur)} saved</span>
                <span>{money(p.remaining, cur)} to go</span>
              </div>
            </div>
          );
        })}
        {data.plan.length === 0 && <div className="text-slate-400">Add savings goals on the Sinking Funds page to build a plan.</div>}
      </div>
    </div>
  );
}
