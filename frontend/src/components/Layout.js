import React, { useEffect, useState } from "react";
import { NavLink, Outlet, Link } from "react-router-dom";
import { useSettings } from "../context/SettingsContext";
import { getMeta } from "../lib/db";
import { buildBackup, backupFilename, downloadJSON, markBackedUp } from "../lib/backup";
import { toast } from "sonner";
import {
  LayoutDashboard, ArrowLeftRight, Wallet, SlidersHorizontal, BarChart3,
  CalendarRange, CalendarDays, PieChart, PiggyBank, TrendingDown, Landmark,
  LineChart, CalendarCheck, Menu, X, Coins, Receipt, Compass,
  GitCompareArrows, Target, Download, HelpCircle, HardDrive, ShieldCheck,
} from "lucide-react";

const NAV = [
  { group: "Overview", items: [{ to: "/", label: "Dashboard", icon: LayoutDashboard }] },
  {
    group: "Money In & Out",
    items: [
      { to: "/transactions", label: "Transactions", icon: ArrowLeftRight },
      { to: "/accounts", label: "Bank Accounts", icon: Wallet },
      { to: "/setup", label: "Setup & Budgets", icon: SlidersHorizontal },
    ],
  },
  {
    group: "Dashboards",
    items: [
      { to: "/annual", label: "Annual Totals", icon: BarChart3 },
      { to: "/monthly", label: "Monthly Insights", icon: CalendarRange },
      { to: "/paycheck", label: "Paycheck Planner", icon: Receipt },
      { to: "/expenses", label: "Expense Explorer", icon: Compass },
      { to: "/compare", label: "Year Compare", icon: GitCompareArrows },
      { to: "/calendar", label: "Calendar", icon: CalendarDays },
    ],
  },
  {
    group: "Build Your Wealth",
    items: [
      { to: "/budget", label: "50 / 30 / 20", icon: PieChart },
      { to: "/funds", label: "Sinking Funds", icon: PiggyBank },
      { to: "/funding", label: "Goal Funding Plan", icon: Target },
      { to: "/debt", label: "Debt Payoff", icon: TrendingDown },
      { to: "/networth", label: "Net Worth", icon: Landmark },
      { to: "/invest", label: "Investment Forecast", icon: LineChart },
      { to: "/nospend", label: "No-Spend Challenge", icon: CalendarCheck },
    ],
  },
  {
    group: "Your Data",
    items: [
      { to: "/backup", label: "Backup & Restore", icon: Download },
      { to: "/guide", label: "Getting Started", icon: HelpCircle },
    ],
  },
];

function shouldRemind(meta) {
  if (!meta || !meta.dirty) return false;
  const now = Date.now();
  const WEEK = 7 * 24 * 60 * 60 * 1000;
  if (meta.last_backup_at) return now - new Date(meta.last_backup_at).getTime() > WEEK;
  if (meta.first_use_at) return now - new Date(meta.first_use_at).getTime() > WEEK;
  return false;
}

export default function Layout() {
  const { baseCurrency } = useSettings();
  const [open, setOpen] = useState(false);
  const [remind, setRemind] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem("backup_reminder_dismissed")) return;
    getMeta().then((m) => setRemind(shouldRemind(m)));
  }, []);

  const dismiss = () => { sessionStorage.setItem("backup_reminder_dismissed", "1"); setRemind(false); };
  const quickBackup = async () => {
    try {
      downloadJSON(await buildBackup(), backupFilename());
      await markBackedUp();
      toast.success("Backup downloaded");
      dismiss();
    } catch { toast.error("Couldn't create the backup."); }
  };

  const SidebarInner = () => (
    <div className="flex flex-col h-full">
      <div className="px-6 py-6 flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-items-center"><Coins className="h-5 w-5" /></div>
        <div>
          <div className="font-head font-bold text-lg leading-none tracking-tight">Budgetly</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Annual Budget Planner</div>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 pb-6 space-y-6">
        {NAV.map((sec) => (
          <div key={sec.group}>
            <div className="px-3 mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-slate-400">{sec.group}</div>
            <div className="space-y-0.5">
              {sec.items.map((it) => (
                <NavLink key={it.to} to={it.to} end={it.to === "/"} onClick={() => setOpen(false)}
                  data-testid={`nav-${it.to === "/" ? "dashboard" : it.to.slice(1)}`}
                  className={({ isActive }) => `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${isActive ? "bg-slate-900 text-white font-medium" : "text-slate-600 hover:bg-slate-100"}`}>
                  <it.icon className="h-[18px] w-[18px]" />{it.label}
                </NavLink>
              ))}
            </div>
          </div>
        ))}
      </nav>
      <div className="px-4 py-4 border-t border-slate-200">
        <div className="flex items-center gap-2.5 text-slate-500">
          <HardDrive className="h-4 w-4 shrink-0" />
          <span className="text-xs leading-tight">Saved privately in this browser · {baseCurrency}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex bg-slate-50">
      <aside className="hidden lg:flex w-[264px] shrink-0 border-r border-slate-200 bg-white flex-col fixed inset-y-0"><SidebarInner /></aside>

      {open && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="w-[280px] bg-white h-full shadow-xl"><SidebarInner /></div>
          <div className="flex-1 bg-slate-900/40" onClick={() => setOpen(false)} />
        </div>
      )}

      <div className="flex-1 lg:ml-[264px] min-w-0">
        <header className="lg:hidden sticky top-0 z-40 bg-white/80 backdrop-blur-xl border-b border-slate-200 px-4 h-14 flex items-center justify-between">
          <button onClick={() => setOpen(true)} data-testid="mobile-menu-btn" className="p-2">{open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}</button>
          <div className="font-head font-bold">Budgetly</div>
          <Link to="/backup" className="p-2 text-slate-600"><Download className="h-5 w-5" /></Link>
        </header>

        {remind && (
          <div data-testid="backup-reminder" className="bg-amber-50 border-b border-amber-200 px-5 sm:px-8 py-3 flex items-center gap-3">
            <ShieldCheck className="h-5 w-5 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-900 flex-1">You have unsaved-to-file changes and haven't backed up in a while. Keep your budget safe.</p>
            <button onClick={quickBackup} data-testid="reminder-backup-btn" className="h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium inline-flex items-center gap-1.5"><Download className="h-4 w-4" /> Download backup</button>
            <button onClick={dismiss} data-testid="reminder-dismiss-btn" className="p-1.5 rounded-lg hover:bg-amber-100 text-amber-700"><X className="h-4 w-4" /></button>
          </div>
        )}

        <main className="p-5 sm:p-8 max-w-[1400px] mx-auto"><Outlet /></main>
      </div>
    </div>
  );
}
