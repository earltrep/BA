import React from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/ui-kit";
import { HardDrive, Download, Upload, Smartphone, RefreshCw, Repeat } from "lucide-react";

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
    icon: Repeat,
    title: "Recurring entries",
    body: "Recurring bills and paychecks are added when you OPEN the planner, not while the site is closed. If you skip a month, they'll be created the next time you open it. Opening in multiple tabs will not create duplicates.",
  },
];

export default function Guide() {
  return (
    <div className="fade-up max-w-3xl">
      <PageHeader eyebrow="Help" title="Getting Started & Backups" subtitle="A quick guide to how your planner saves data and how to keep it safe." />

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
