import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/currency";
import { useSettings } from "../context/SettingsContext";
import { PageHeader, Loader } from "../components/ui-kit";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function CalendarView() {
  const { baseCurrency } = useSettings();
  const [txns, setTxns] = useState(null);
  const now = new Date();
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });

  useEffect(() => { api.get("/transactions").then((r) => setTxns(r.data)); }, []);

  const byDay = useMemo(() => {
    const map = {};
    (txns || []).forEach((t) => {
      const [y, m, d] = t.date.split("-").map(Number);
      if (y === cur.y && m - 1 === cur.m) {
        if (!map[d]) map[d] = { income: 0, expense: 0, items: [] };
        if (t.type === "income") map[d].income += Number(t.amount);
        else map[d].expense += Number(t.amount);
        map[d].items.push(t);
      }
    });
    return map;
  }, [txns, cur]);

  if (!txns) return <Loader />;

  const first = new Date(cur.y, cur.m, 1).getDay();
  const days = new Date(cur.y, cur.m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const shift = (d) => setCur((c) => {
    let m = c.m + d, y = c.y;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    return { y, m };
  });

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Dashboards" title="Automated Calendar" subtitle="See income and spending land day by day." />

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => shift(-1)} data-testid="cal-prev" className="h-9 w-9 grid place-items-center rounded-lg border border-slate-200 hover:bg-slate-50"><ChevronLeft className="h-4 w-4" /></button>
          <h3 className="font-head font-semibold text-xl">{MONTHS[cur.m]} {cur.y}</h3>
          <button onClick={() => shift(1)} data-testid="cal-next" className="h-9 w-9 grid place-items-center rounded-lg border border-slate-200 hover:bg-slate-50"><ChevronRight className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-7 gap-2 mb-2">
          {DOW.map((d) => <div key={d} className="text-center text-xs font-medium uppercase tracking-wider text-slate-400">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const info = byDay[d];
            const isToday = d === now.getDate() && cur.m === now.getMonth() && cur.y === now.getFullYear();
            return (
              <div key={i} data-testid={`cal-day-${d}`} className={`min-h-[84px] rounded-xl border p-2 ${isToday ? "border-slate-900 bg-slate-50" : "border-slate-100"}`}>
                <div className="text-xs font-medium text-slate-400">{d}</div>
                {info && (
                  <div className="mt-1 space-y-0.5">
                    {info.income > 0 && <div className="text-[11px] font-medium text-emerald-600 tnum">+{money(info.income, baseCurrency, { compact: true, decimals: 0 })}</div>}
                    {info.expense > 0 && <div className="text-[11px] font-medium text-rose-500 tnum">-{money(info.expense, baseCurrency, { compact: true, decimals: 0 })}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
