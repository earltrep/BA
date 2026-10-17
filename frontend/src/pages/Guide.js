import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { PageHeader } from "../components/ui-kit";
import { useSettings } from "../context/SettingsContext";
import { dbGetAll, getMeta } from "../lib/db";
import { loadSampleData } from "../lib/sampleData";
import { toast } from "sonner";
import {
  HardDrive, Download, Upload, Smartphone, RefreshCw, Repeat, Cloud,
  CheckCircle2, Circle, ArrowRight, Sparkles,
} from "lucide-react";

const items = [
  {
    icon: HardDrive,
    title: "Where your data lives",
    body: "Everything you enter is saved automatically in this browser on this device using local storage (IndexedDB). There are no accounts and nothing is sent to a server. Only you, on this browser, can see it.",
  },
  {
    icon: RefreshCw,
    title: "No automatic syncing",
    body: "Your budget does not sync between devices or browsers. If you open the site on your phone and your laptop, each keeps its own separate budget. Clearing your browser data, or using private/incognito mode, can erase it.",
  },
  {
    icon: Download,
    title: "Download backups often",
    body: "Go to Backup & Restore and press Download backup. You'll get a dated file (e.g. MyBudget-2026-10-17.json). Keep it somewhere safe such as your computer, Google Drive, iCloud or OneDrive. The file is not encrypted, so store it privately.",
  },
  {
    icon: Smartphone,
    title: "Moving to another device",
    body: "Download a backup on the first device, transfer the file to the second device (email it to yourself or use cloud storage), then on the second device open Backup & Restore and choose Restore backup. Restoring replaces whatever is on that device, so download its current budget first if needed.",
  },
  {
    icon: Upload,
    title: "Restoring a backup",
    body: "Pick your backup file, review the preview (date and record counts), and confirm. If a file is invalid or incompatible, nothing changes — your current budget stays intact.",
  },
  {
    icon: Cloud,
    title: "Saving to Google Drive (optional)",
    body: "You can upload a backup straight to your own Google Drive. One-time setup: in Google Cloud Console create an OAuth Web client with the drive.file scope, add your website address under Authorized JavaScript origins, then paste the Client ID on the Backup & Restore page. The Client ID is public and safe in a browser — no password or secret is stored, and the file goes only to your Drive.",
  },
  {
    icon: Repeat,
    title: "Recurring entries",
    body: "Recurring bills and paychecks are added when you OPEN the planner, not while the site is closed. If you skip a month, they'll be created the next time you open it. Opening in multiple tabs will not create duplicates.",
  },
];

export default function Guide() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [counts, setCounts] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loadingSample, setLoadingSample] = useState(false);

  const load = useCallback(async () => {
    const [accounts, categories, transactions, m] = await Promise.all([
      dbGetAll("accounts"), dbGetAll("categories"), dbGetAll("transactions"), getMeta(),
    ]);
    setCounts({ accounts: accounts.length, categories: categories.length, transactions: transactions.length });
    setMeta(m);
  }, []);

  useEffect(() => {
    load();
    const h = () => load();
    window.addEventListener("budgetly:meta", h);
    return () => window.removeEventListener("budgetly:meta", h);
  }, [load]);

  const doSample = async () => {
    if (!window.confirm("Load the sample budget? This replaces whatever is currently saved in this browser.")) return;
    setLoadingSample(true);
    try {
      await loadSampleData();
      toast.success("Sample budget loaded — reloading…");
      setTimeout(() => window.location.reload(), 900);
    } catch {
      toast.error("Couldn't load the sample budget.");
      setLoadingSample(false);
    }
  };

  const steps = [
    { key: "name", label: "Name your budget", help: "Give your plan a name in Setup & Budgets.", to: "/setup", done: !!(settings?.name && settings.name.trim()) },
    { key: "account", label: "Add a bank account", help: "Track balances across your accounts.", to: "/accounts", done: !!(counts && counts.accounts > 0) },
    { key: "categories", label: "Set up budget categories", help: "Create income & spending categories with limits.", to: "/setup", done: !!(counts && counts.categories > 0) },
    { key: "transaction", label: "Log your first transaction", help: "Add income or an expense to see it on your dashboard.", to: "/transactions", done: !!(counts && counts.transactions > 0) },
    { key: "backup", label: "Download your first backup", help: "Keep your budget safe with a saved file.", to: "/backup", done: !!(meta && meta.last_backup_at) },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const allDone = doneCount === steps.length;

  return (
    <div className="fade-up max-w-3xl">
      <PageHeader eyebrow="Help" title="Getting Started & Backups" subtitle="A quick guide to how your planner saves data and how to keep it safe." />

      {/* Quick Start Checklist */}
      <div data-testid="quick-start-checklist" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-5">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h3 className="font-head font-semibold text-lg">Quick start checklist</h3>
            <p className="text-sm text-slate-500 mt-1">
              {allDone ? "You're all set — nice work! 🎉" : "A few quick steps to get your planner up and running."}
            </p>
          </div>
          <div className="text-right shrink-0">
            <div data-testid="checklist-progress" className="font-head font-bold text-2xl tabular-nums">{doneCount}/{steps.length}</div>
            <div className="text-[11px] uppercase tracking-wide text-slate-400">done</div>
          </div>
        </div>

        <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden mb-5">
          <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${pct}%` }} data-testid="checklist-bar" />
        </div>

        <div className="space-y-2">
          {steps.map((s) => (
            <button
              key={s.key}
              onClick={() => navigate(s.to)}
              data-testid={`checklist-step-${s.key}`}
              className={`w-full flex items-center gap-3 text-left rounded-xl border px-4 py-3 transition-colors ${s.done ? "border-emerald-200 bg-emerald-50/50" : "border-slate-200 bg-white hover:bg-slate-50"}`}
            >
              {s.done
                ? <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0" data-testid={`checklist-done-${s.key}`} />
                : <Circle className="h-5 w-5 text-slate-300 shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className={`text-sm font-medium ${s.done ? "text-emerald-800 line-through decoration-emerald-400/60" : "text-slate-800"}`}>{s.label}</div>
                <div className="text-xs text-slate-500 mt-0.5">{s.help}</div>
              </div>
              {!s.done && <ArrowRight className="h-4 w-4 text-slate-400 shrink-0" />}
            </button>
          ))}
        </div>

        <div className="mt-5 pt-5 border-t border-slate-100 flex flex-wrap items-center gap-3">
          <button onClick={doSample} disabled={loadingSample} data-testid="guide-load-sample-btn" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-60">
            <Sparkles className="h-4 w-4" /> {loadingSample ? "Loading…" : "Load a sample budget"}
          </button>
          <span className="text-xs text-slate-400">See every feature filled in with example data. Replaces anything currently in this browser.</span>
        </div>
      </div>

      <div className="space-y-4">
        {items.map((it) => (
          <div key={it.title} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex gap-4">
            <div className="h-10 w-10 grid place-items-center rounded-xl bg-slate-900 text-white shrink-0"><it.icon className="h-5 w-5" /></div>
            <div>
              <h3 className="font-head font-semibold text-lg">{it.title}</h3>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">{it.body}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link to="/backup" data-testid="guide-backup-link" className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors">
          <Download className="h-4 w-4" /> Go to Backup & Restore
        </Link>
        <Link to="/" className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors">
          Start budgeting
        </Link>
      </div>
    </div>
  );
}
