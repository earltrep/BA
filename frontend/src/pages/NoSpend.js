import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { PageHeader, StatCard, Loader } from "../components/ui-kit";
import { CalendarCheck, Flame, Target } from "lucide-react";
import { toast } from "sonner";

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function NoSpend() {
  const [entries, setEntries] = useState(null);
  const now = new Date();
  const [cur, setCur] = useState({ y: now.getFullYear(), m: now.getMonth() });

  const load = () => api.get("/no-spend").then((r) => setEntries(r.data));
  useEffect(() => { load(); }, []);

  const map = useMemo(() => {
    const o = {};
    (entries || []).forEach((e) => { o[e.date] = e.status; });
    return o;
  }, [entries]);

  const toggle = async (dateStr) => {
    const current = map[dateStr];
    const next = current === "success" ? "fail" : current === "fail" ? null : "success";
    if (next === null) {
      const entry = (entries || []).find((e) => e.date === dateStr);
      if (entry) await api.delete(`/no-spend/${entry.id}`);
    } else {
      await api.post("/no-spend", { date: dateStr, status: next, note: "" });
    }
    load();
  };

  if (!entries) return <Loader />;

  const first = new Date(cur.y, cur.m, 1).getDay();
  const days = new Date(cur.y, cur.m + 1, 0).getDate();
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)];
  const monthEntries = entries.filter((e) => {
    const [y, m] = e.date.split("-").map(Number);
    return y === cur.y && m - 1 === cur.m;
  });
  const success = monthEntries.filter((e) => e.status === "success").length;
  const fail = monthEntries.filter((e) => e.status === "fail").length;

  // current streak
  let streak = 0;
  const sorted = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const e of sorted) { if (e.status === "success") streak++; else break; }

  const shift = (d) => setCur((c) => {
    let m = c.m + d, y = c.y;
    if (m < 0) { m = 11; y--; } if (m > 11) { m = 0; y++; }
    return { y, m };
  });

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Build your wealth" title="No-Spending Challenge" subtitle="Tap a day to log a no-spend win. Build streaks and watch the savings add up." />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <StatCard testid="ns-success" label="No-spend days" value={success} icon={Target} accent="emerald" />
        <StatCard testid="ns-fail" label="Spend days" value={fail} icon={CalendarCheck} accent="rose" />
        <StatCard testid="ns-streak" label="Current streak" value={`${streak} days`} icon={Flame} accent="amber" />
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => shift(-1)} data-testid="ns-prev" className="h-9 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">Prev</button>
          <h3 className="font-head font-semibold text-xl">{MONTHS[cur.m]} {cur.y}</h3>
          <button onClick={() => shift(1)} data-testid="ns-next" className="h-9 px-3 rounded-lg border border-slate-200 hover:bg-slate-50 text-sm">Next</button>
        </div>
        <div className="grid grid-cols-7 gap-2 mb-2">
          {DOW.map((d) => <div key={d} className="text-center text-xs font-medium uppercase tracking-wider text-slate-400">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {cells.map((d, i) => {
            if (!d) return <div key={i} />;
            const dateStr = `${cur.y}-${String(cur.m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
            const status = map[dateStr];
            const cls = status === "success" ? "bg-emerald-500 text-white border-emerald-500" : status === "fail" ? "bg-rose-100 text-rose-600 border-rose-200" : "border-slate-100 hover:bg-slate-50 text-slate-500";
            return (
              <button key={i} onClick={() => toggle(dateStr)} data-testid={`ns-day-${d}`} className={`h-14 rounded-xl border text-sm font-medium transition-colors ${cls}`}>
                {d}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 mt-4">Tap once for a no-spend win (green), twice to mark a spend day (red), a third time to clear.</p>
      </div>
    </div>
  );
}
