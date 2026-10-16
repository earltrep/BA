import React from "react";

export function PageHeader({ eyebrow, title, subtitle, action }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div>
        {eyebrow && (
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-400 mb-2">
            {eyebrow}
          </div>
        )}
        <h1 className="font-head font-bold text-3xl sm:text-4xl tracking-tight text-slate-900">
          {title}
        </h1>
        {subtitle && <p className="text-slate-500 mt-2 max-w-2xl">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function StatCard({ label, value, delta, deltaType = "up", icon: Icon, accent = "slate", testid }) {
  const accents = {
    slate: "bg-slate-100 text-slate-700",
    emerald: "bg-emerald-50 text-emerald-600",
    rose: "bg-rose-50 text-rose-600",
    blue: "bg-blue-50 text-blue-600",
    amber: "bg-amber-50 text-amber-600",
  };
  return (
    <div
      data-testid={testid}
      className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:-translate-y-0.5 transition-transform"
    >
      <div className="flex items-start justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.16em] text-slate-400">{label}</span>
        {Icon && (
          <span className={`h-9 w-9 grid place-items-center rounded-xl ${accents[accent]}`}>
            <Icon className="h-[18px] w-[18px]" />
          </span>
        )}
      </div>
      <div className="mt-4 font-head font-bold text-2xl sm:text-3xl tracking-tight text-slate-900 tnum">
        {value}
      </div>
      {delta && (
        <div
          className={`mt-2 inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
            deltaType === "up" ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
          }`}
        >
          {delta}
        </div>
      )}
    </div>
  );
}

export function Loader({ label = "Loading…" }) {
  return (
    <div className="py-24 text-center text-slate-400 font-head animate-pulse">{label}</div>
  );
}
