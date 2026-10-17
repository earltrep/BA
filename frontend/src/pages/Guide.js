import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import confetti from "canvas-confetti";
import { PageHeader } from "../components/ui-kit";
import Modal, { PrimaryBtn } from "../components/Modal";
import { useSettings } from "../context/SettingsContext";
import { dbGetAll, getMeta } from "../lib/db";
import { loadSampleData } from "../lib/sampleData";
import { toast } from "sonner";
import {
  HardDrive, Download, Upload, Smartphone, RefreshCw, Repeat, Cloud,
  CheckCircle2, Circle, ArrowRight, Sparkles, Tag, Wallet, SlidersHorizontal,
  ArrowLeftRight, Wand2, PartyPopper,
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

const WIZARD_SEEN_KEY = "budgetly:wizard_seen";

function fireCelebration() {
  const end = Date.now() + 900;
  const colors = ["#10b981", "#0ea5e9", "#f59e0b", "#8b5cf6", "#ec4899"];
  (function frame() {
    confetti({ particleCount: 5, angle: 60, spread: 60, startVelocity: 55, origin: { x: 0, y: 0.7 }, colors });
    confetti({ particleCount: 5, angle: 120, spread: 60, startVelocity: 55, origin: { x: 1, y: 0.7 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
  confetti({ particleCount: 120, spread: 90, startVelocity: 45, origin: { y: 0.6 }, colors });
}

export default function Guide() {
  const navigate = useNavigate();
  const { settings } = useSettings();
  const [counts, setCounts] = useState(null);
  const [meta, setMeta] = useState(null);
  const [loadingSample, setLoadingSample] = useState(false);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState(0);
  const celebrated = useRef(false);
  const booted = useRef(false);

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
    { key: "name", icon: Tag, label: "Name your budget", help: "Give your plan a name in Setup & Budgets so it feels like yours.", to: "/setup", done: !!(settings?.name && settings.name.trim()) },
    { key: "account", icon: Wallet, label: "Add a bank account", help: "Add your checking, savings or card accounts to track balances.", to: "/accounts", done: !!(counts && counts.accounts > 0) },
    { key: "categories", icon: SlidersHorizontal, label: "Set up budget categories", help: "Create income & spending categories and set monthly limits.", to: "/setup", done: !!(counts && counts.categories > 0) },
    { key: "transaction", icon: ArrowLeftRight, label: "Log your first transaction", help: "Add an income or expense entry to see your dashboard come alive.", to: "/transactions", done: !!(counts && counts.transactions > 0) },
    { key: "backup", icon: Download, label: "Download your first backup", help: "Save a backup file so your budget is safe and portable.", to: "/backup", done: !!(meta && meta.last_backup_at) },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const pct = Math.round((doneCount / steps.length) * 100);
  const allDone = doneCount === steps.length;

  // Celebrate when everything is complete
  useEffect(() => {
    if (counts === null || meta === null) return;
    if (allDone && !celebrated.current) { celebrated.current = true; fireCelebration(); }
    if (!allDone) celebrated.current = false;
  }, [allDone, counts, meta]);

  // Auto-open the setup wizard once for brand-new users
  useEffect(() => {
    if (booted.current || counts === null || meta === null) return;
    booted.current = true;
    if (doneCount === 0 && !localStorage.getItem(WIZARD_SEEN_KEY)) {
      setWizardStep(0);
      setWizardOpen(true);
    }
  }, [counts, meta, doneCount]);

  const openWizard = () => {
    const firstUndone = steps.findIndex((s) => !s.done);
    setWizardStep(firstUndone === -1 ? 0 : firstUndone);
    setWizardOpen(true);
  };
  const closeWizard = () => { localStorage.setItem(WIZARD_SEEN_KEY, "1"); setWizardOpen(false); };
  const goToStep = (to) => { closeWizard(); navigate(to); };

  const WizStep = steps[wizardStep] || steps[0];

  return (
    <div className="fade-up max-w-3xl">
      <PageHeader eyebrow="Help" title="Getting Started & Backups" subtitle="A quick guide to how your planner saves data and how to keep it safe." />

      {/* Quick Start Checklist / Celebration */}
      <div data-testid="quick-start-checklist" className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-5">
        {allDone ? (
          <div data-testid="checklist-celebration" className="text-center py-4">
            <div className="h-16 w-16 mx-auto grid place-items-center rounded-2xl bg-emerald-100 text-emerald-600 mb-4 pop-in">
              <PartyPopper className="h-8 w-8" />
            </div>
            <h3 className="font-head font-bold text-2xl">You're all set! 🎉</h3>
            <p className="text-sm text-slate-500 mt-2 max-w-md mx-auto">
              Every setup step is done. Your planner is ready — keep logging transactions and remember to download backups regularly.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
              <Link to="/" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors">
                Go to dashboard <ArrowRight className="h-4 w-4" />
              </Link>
              <button onClick={fireCelebration} data-testid="replay-celebration-btn" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors">
                <Sparkles className="h-4 w-4" /> Celebrate again
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4 mb-5">
              <div>
                <h3 className="font-head font-semibold text-lg">Quick start checklist</h3>
                <p className="text-sm text-slate-500 mt-1">A few quick steps to get your planner up and running.</p>
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
              <button onClick={openWizard} data-testid="start-wizard-btn" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors">
                <Wand2 className="h-4 w-4" /> Start guided setup
              </button>
              <button onClick={doSample} disabled={loadingSample} data-testid="guide-load-sample-btn" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-sm font-medium transition-colors disabled:opacity-60">
                <Sparkles className="h-4 w-4" /> {loadingSample ? "Loading…" : "Load a sample budget"}
              </button>
            </div>
          </>
        )}
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

      {/* Guided Setup Wizard */}
      <Modal open={wizardOpen} onClose={closeWizard} title="Guided setup" testid="setup-wizard-modal">
        <div>
          <div className="flex items-center gap-2 mb-5" data-testid="wizard-progress">
            {steps.map((s, i) => (
              <div key={s.key} className={`h-1.5 flex-1 rounded-full transition-colors ${i < wizardStep ? "bg-emerald-500" : i === wizardStep ? "bg-slate-900" : "bg-slate-200"}`} />
            ))}
          </div>

          <div className="text-center">
            <div className={`h-14 w-14 mx-auto grid place-items-center rounded-2xl mb-4 ${WizStep.done ? "bg-emerald-100 text-emerald-600" : "bg-slate-900 text-white"}`}>
              {WizStep.done ? <CheckCircle2 className="h-7 w-7" /> : <WizStep.icon className="h-7 w-7" />}
            </div>
            <div className="text-xs uppercase tracking-wide text-slate-400 mb-1">Step {wizardStep + 1} of {steps.length}{WizStep.done ? " · done" : ""}</div>
            <h4 className="font-head font-semibold text-xl" data-testid="wizard-step-title">{WizStep.label}</h4>
            <p className="text-sm text-slate-500 mt-2 leading-relaxed">{WizStep.help}</p>
          </div>

          <div className="mt-6 space-y-2">
            <PrimaryBtn onClick={() => goToStep(WizStep.to)} data-testid="wizard-take-me-there">
              {WizStep.done ? "Review this step" : "Take me there"}
            </PrimaryBtn>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setWizardStep((n) => Math.max(0, n - 1))}
                disabled={wizardStep === 0}
                data-testid="wizard-prev"
                className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors disabled:opacity-40"
              >
                Back
              </button>
              {wizardStep < steps.length - 1 ? (
                <button onClick={() => setWizardStep((n) => Math.min(steps.length - 1, n + 1))} data-testid="wizard-next" className="flex-1 h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors inline-flex items-center justify-center gap-1.5">
                  Next step <ArrowRight className="h-4 w-4" />
                </button>
              ) : (
                <button onClick={closeWizard} data-testid="wizard-finish" className="flex-1 h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors">
                  Finish
                </button>
              )}
            </div>
            <button onClick={closeWizard} data-testid="wizard-skip" className="w-full text-center text-xs text-slate-400 hover:text-slate-600 pt-1">Skip for now</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
