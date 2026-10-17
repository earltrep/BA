import React, { useEffect, useRef, useState } from "react";
import { PageHeader, Loader } from "../components/ui-kit";
import Modal, { PrimaryBtn } from "../components/Modal";
import { buildBackup, backupFilename, downloadJSON, validateBackup, restoreBackup, markBackedUp } from "../lib/backup";
import { loadSampleData } from "../lib/sampleData";
import { getMeta } from "../lib/db";
import { Download, Upload, Database, ShieldAlert, CheckCircle2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export default function Backup() {
  const [meta, setMeta] = useState(null);
  const [preview, setPreview] = useState(null); // { obj, counts, exported_at }
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  const loadMeta = () => getMeta().then(setMeta);
  useEffect(() => { loadMeta(); }, []);

  const doDownload = async () => {
    try {
      const backup = await buildBackup();
      downloadJSON(backup, backupFilename());
      await markBackedUp();
      await loadMeta();
      toast.success("Backup file created and download started");
    } catch (e) {
      toast.error("Couldn't create the backup. Nothing was saved.");
    }
  };

  const onPickFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      let obj;
      try { obj = JSON.parse(String(reader.result)); }
      catch { toast.error("That file isn't valid JSON."); return; }
      const check = validateBackup(obj);
      if (!check.ok) { toast.error(check.error); return; }
      setPreview({ obj, counts: check.counts, exported_at: check.exported_at });
      setConfirmOpen(true);
    };
    reader.onerror = () => toast.error("Couldn't read that file.");
    reader.readAsText(f);
    e.target.value = "";
  };

  const doRestore = async () => {
    if (!preview) return;
    setBusy(true);
    try {
      await restoreBackup(preview.obj);
      toast.success("Backup restored — reloading your planner…");
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      toast.error(`Restore failed: ${e.message}. Your current budget is unchanged.`);
      setBusy(false);
    }
  };

  const doSample = async () => {
    if (!window.confirm("Load the sample budget? This replaces whatever is currently saved in this browser.")) return;
    setBusy(true);
    try {
      await loadSampleData();
      toast.success("Sample data loaded — reloading…");
      setTimeout(() => window.location.reload(), 900);
    } catch (e) {
      toast.error("Couldn't load sample data.");
      setBusy(false);
    }
  };

  if (!meta) return <Loader />;
  const last = meta.last_backup_at ? new Date(meta.last_backup_at).toLocaleString() : null;

  return (
    <div className="fade-up max-w-4xl">
      <PageHeader eyebrow="Your data" title="Backup & Restore" subtitle="Your budget lives only in this browser. Download a backup to keep it safe or move it to another device." />

      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 mb-6 flex gap-3">
        <ShieldAlert className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-900">
          Data is stored locally on <strong>this browser on this device</strong>. It does <strong>not</strong> sync across devices and can be
          <strong> lost if you clear your browser data</strong> or use private/incognito mode. Download backups regularly.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="h-10 w-10 grid place-items-center rounded-xl bg-slate-900 text-white mb-4"><Download className="h-5 w-5" /></div>
          <h3 className="font-head font-semibold text-lg">Download backup</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">Saves every transaction, budget, account, goal, debt and setting into one JSON file named like <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">{backupFilename()}</code>.</p>
          <PrimaryBtn onClick={doDownload} data-testid="download-backup-btn"><span className="inline-flex items-center justify-center gap-2"><Download className="h-4 w-4" /> Download backup</span></PrimaryBtn>
          <div className="mt-4 text-sm" data-testid="last-backup">
            {last ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Last backup downloaded {last}</span>
            ) : (
              <span className="text-slate-400">No backup downloaded yet</span>
            )}
          </div>
          <p className="text-xs text-slate-400 mt-3">We can't confirm where you kept the file. Store it on your computer or in Google Drive, iCloud or OneDrive. The file contains your budget details and is <strong>not encrypted</strong>.</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <div className="h-10 w-10 grid place-items-center rounded-xl bg-blue-600 text-white mb-4"><Upload className="h-5 w-5" /></div>
          <h3 className="font-head font-semibold text-lg">Restore backup</h3>
          <p className="text-sm text-slate-500 mt-1 mb-4">Load a previously downloaded backup file. You'll see a preview and confirm before anything is replaced.</p>
          <input ref={fileRef} type="file" accept=".json,application/json" onChange={onPickFile} className="hidden" data-testid="restore-file-input" />
          <button onClick={() => fileRef.current?.click()} data-testid="restore-backup-btn" className="w-full h-11 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 font-medium transition-colors inline-flex items-center justify-center gap-2">
            <Upload className="h-4 w-4" /> Choose backup file
          </button>
          <p className="text-xs text-slate-400 mt-3">Restoring <strong>replaces</strong> the budget currently in this browser. We'll offer to download your current budget first.</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mt-5">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 grid place-items-center rounded-xl bg-violet-100 text-violet-600 shrink-0"><Sparkles className="h-5 w-5" /></div>
          <div className="flex-1">
            <h3 className="font-head font-semibold text-lg">Sample data (optional)</h3>
            <p className="text-sm text-slate-500 mt-1">New here? Load a fully populated example budget to explore every feature. You start with a blank budget by default.</p>
          </div>
          <button onClick={doSample} disabled={busy} data-testid="load-sample-btn" className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors inline-flex items-center gap-2 shrink-0">
            <Database className="h-4 w-4" /> Load sample data
          </button>
        </div>
      </div>

      <Modal open={confirmOpen} onClose={() => !busy && setConfirmOpen(false)} title="Restore this backup?" testid="restore-confirm-modal">
        {preview && (
          <div>
            <p className="text-sm text-slate-500 mb-4">
              Backup from <strong>{preview.exported_at ? new Date(preview.exported_at).toLocaleString() : "unknown date"}</strong>. This will <strong className="text-rose-600">replace</strong> the budget currently saved in this browser.
            </p>
            <div className="grid grid-cols-2 gap-2 mb-5" data-testid="restore-preview">
              {Object.entries(preview.counts).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                  <span className="capitalize text-slate-500">{k.replace("_", " ")}</span>
                  <span className="font-semibold tnum">{v}</span>
                </div>
              ))}
            </div>
            <button onClick={doDownload} className="w-full h-10 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium mb-3 inline-flex items-center justify-center gap-2" data-testid="download-before-restore-btn">
              <Download className="h-4 w-4" /> Download my current budget first
            </button>
            <PrimaryBtn onClick={doRestore} disabled={busy} data-testid="confirm-restore-btn">{busy ? "Restoring…" : "Replace & restore"}</PrimaryBtn>
          </div>
        )}
      </Modal>
    </div>
  );
}
