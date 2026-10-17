import React, { useEffect, useRef, useState } from "react";
import { PageHeader, Loader } from "../components/ui-kit";
import Modal, { PrimaryBtn, Field, inputCls } from "../components/Modal";
import { useSettings } from "../context/SettingsContext";
import { buildBackup, backupFilename, downloadJSON, validateBackup, restoreBackup, markBackedUp, resetToBlank } from "../lib/backup";
import { loadSampleData } from "../lib/sampleData";
import { getAccessToken, uploadToDrive } from "../lib/gdrive";
import { getMeta } from "../lib/db";
import { Download, Upload, Database, ShieldAlert, CheckCircle2, Sparkles, Trash2, Cloud } from "lucide-react";
import { toast } from "sonner";

export default function Backup() {
  const { settings, update } = useSettings();
  const [meta, setMeta] = useState(null);
  const [preview, setPreview] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [clientId, setClientId] = useState("");
  const [driveBusy, setDriveBusy] = useState(false);
  const fileRef = useRef(null);

  const loadMeta = () => getMeta().then(setMeta);
  useEffect(() => { loadMeta(); }, []);
  useEffect(() => { if (settings) setClientId(settings.google_client_id || ""); }, [settings]);

  const doDownload = async () => {
    try {
      downloadJSON(await buildBackup(), backupFilename());
      await markBackedUp();
      await loadMeta();
      toast.success("Backup file created and download started");
    } catch { toast.error("Couldn't create the backup. Nothing was saved."); }
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
    try { await loadSampleData(); toast.success("Sample data loaded — reloading…"); setTimeout(() => window.location.reload(), 900); }
    catch { toast.error("Couldn't load sample data."); setBusy(false); }
  };

  const doReset = async () => {
    if (!window.confirm("Reset to a blank budget? This erases everything saved in this browser. Download a backup first if you want to keep it.")) return;
    setBusy(true);
    try { await resetToBlank(); toast.success("Reset to a blank budget — reloading…"); setTimeout(() => window.location.reload(), 900); }
    catch { toast.error("Couldn't reset."); setBusy(false); }
  };

  const saveClientId = async () => {
    try { await update({ google_client_id: clientId.trim() }); toast.success("Google Client ID saved on this device"); }
    catch { toast.error("Couldn't save the Client ID."); }
  };

  const saveToDrive = async () => {
    const id = (clientId || "").trim();
    if (!id) { toast.error("Enter and save your Google OAuth Client ID first."); return; }
    setDriveBusy(true);
    try {
      const backup = await buildBackup();
      const token = await getAccessToken(id);
      const file = await uploadToDrive(token, backupFilename(), JSON.stringify(backup, null, 2));
      await markBackedUp();
      await loadMeta();
      toast.success(`Saved “${file.name}” to your Google Drive`);
      if (file.webViewLink) window.open(file.webViewLink, "_blank", "noopener");
    } catch (e) {
      toast.error(e.message || "Google Drive upload failed.");
    } finally {
      setDriveBusy(false);
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
            {last
              ? <span className="inline-flex items-center gap-1.5 text-emerald-600"><CheckCircle2 className="h-4 w-4" /> Last backup downloaded {last}</span>
              : <span className="text-slate-400">No backup downloaded yet</span>}
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
        <div className="flex items-start gap-3 mb-4">
          <div className="h-10 w-10 grid place-items-center rounded-xl bg-[#1a73e8] text-white shrink-0"><Cloud className="h-5 w-5" /></div>
          <div>
            <h3 className="font-head font-semibold text-lg">Save backup to Google Drive</h3>
            <p className="text-sm text-slate-500 mt-1">Upload your backup straight to your own Google Drive. Nothing is stored by us — it uses your Google account directly from this browser.</p>
          </div>
        </div>
        <Field label="Your Google OAuth Client ID">
          <div className="flex gap-2">
            <input className={inputCls} value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="xxxxxxxx.apps.googleusercontent.com" data-testid="drive-client-id-input" />
            <button onClick={saveClientId} data-testid="save-client-id-btn" className="h-11 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium shrink-0">Save</button>
          </div>
        </Field>
        <button onClick={saveToDrive} disabled={driveBusy} data-testid="drive-upload-btn" className="h-11 px-5 rounded-xl bg-[#1a73e8] hover:bg-[#1765cc] text-white font-medium transition-colors inline-flex items-center gap-2 disabled:opacity-60">
          <Cloud className="h-4 w-4" /> {driveBusy ? "Uploading…" : "Save to Google Drive"}
        </button>
        <p className="text-xs text-slate-400 mt-3">
          One-time setup: in Google Cloud Console create an OAuth <strong>Web</strong> client (scope <code className="bg-slate-100 px-1 rounded">drive.file</code>), add your website address to <strong>Authorized JavaScript origins</strong>, then paste the Client ID above. The Client ID is public and safe to use in a browser; no secret is stored. See Getting Started for details.
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-5 mt-5">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm flex items-start gap-3">
          <div className="h-10 w-10 grid place-items-center rounded-xl bg-violet-100 text-violet-600 shrink-0"><Sparkles className="h-5 w-5" /></div>
          <div className="flex-1">
            <h3 className="font-head font-semibold text-lg">Sample data</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">New here? Load a fully populated example budget to explore every feature.</p>
            <button onClick={doSample} disabled={busy} data-testid="load-sample-btn" className="h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors inline-flex items-center gap-2">
              <Database className="h-4 w-4" /> Load sample data
            </button>
          </div>
        </div>
        <div className="bg-white border border-rose-200 rounded-2xl p-6 shadow-sm flex items-start gap-3">
          <div className="h-10 w-10 grid place-items-center rounded-xl bg-rose-100 text-rose-600 shrink-0"><Trash2 className="h-5 w-5" /></div>
          <div className="flex-1">
            <h3 className="font-head font-semibold text-lg">Reset to blank</h3>
            <p className="text-sm text-slate-500 mt-1 mb-4">Clear everything and start a fresh, empty budget. Download a backup first if you want to keep it.</p>
            <button onClick={doReset} disabled={busy} data-testid="reset-blank-btn" className="h-10 px-4 rounded-xl border border-rose-200 bg-white hover:bg-rose-50 text-rose-600 text-sm font-medium transition-colors inline-flex items-center gap-2">
              <Trash2 className="h-4 w-4" /> Reset to blank
            </button>
          </div>
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
