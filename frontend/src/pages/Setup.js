import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money, CURRENCY_LIST, CURRENCY_SYMBOLS } from "../lib/currency";
import { useSettings } from "../context/SettingsContext";
import { PageHeader, Loader } from "../components/ui-kit";
import Modal, { Field, inputCls, PrimaryBtn } from "../components/Modal";
import { Plus, Pencil, Trash2, Save, RefreshCw, Zap, Play } from "lucide-react";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";

const BUCKETS = ["needs", "wants", "savings", "income"];
const empty = { name: "", type: "expense", bucket: "needs", budget: "", color: "#64748b" };

export default function Setup() {
  const { settings, update, refresh, refreshRates, ratesUpdated, currencies } = useSettings();
  const [cats, setCats] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [name, setName] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [refreshing, setRefreshing] = useState(false);
  const [autopilot, setAutopilot] = useState(false);
  const [running, setRunning] = useState(false);

  const toggleAutopilot = async (v) => {
    setAutopilot(v);
    await update({ autopilot: v });
    toast.success(v ? "Autopilot on — recurring items will be added each month" : "Autopilot off");
  };

  const runAutopilot = async () => {
    setRunning(true);
    try {
      const { data } = await api.post("/autopilot/run");
      toast.success(data.inserted ? `Added ${data.inserted} recurring entries for this month` : "You're already caught up for this month");
    } catch {
      toast.error("Couldn't run autopilot");
    } finally {
      setRunning(false);
    }
  };

  const doRefreshRates = async () => {
    setRefreshing(true);
    try { await refreshRates(); toast.success("Exchange rates updated"); }
    catch { toast.error("Couldn't refresh rates"); }
    finally { setRefreshing(false); }
  };

  const load = () => api.get("/categories").then((r) => setCats(r.data));
  useEffect(() => { load(); }, []);
  useEffect(() => {
    if (settings) { setName(settings.name || ""); setCurrency(settings.base_currency || "USD"); setAutopilot(!!settings.autopilot); }
  }, [settings]);

  const saveSettings = async () => {
    await update({ name, base_currency: currency });
    await refresh();
    toast.success("Settings saved");
  };

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (c) => { setForm({ ...c, budget: String(c.budget) }); setEditId(c.id); setOpen(true); };
  const save = async (e) => {
    e.preventDefault();
    const payload = { ...form, budget: parseFloat(form.budget) || 0 };
    if (editId) await api.put(`/categories/${editId}`, payload);
    else await api.post("/categories", payload);
    toast.success("Saved"); setOpen(false); load();
  };
  const del = async (id) => { await api.delete(`/categories/${id}`); toast.success("Deleted"); load(); };

  if (!cats || !settings) return <Loader />;
  const base = settings.base_currency;

  return (
    <div className="fade-up">
      <PageHeader eyebrow="Easy setup" title="Setup & Budgets" subtitle="Set your base currency and organise spending categories into budget buckets." />

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <h3 className="font-head font-semibold text-lg mb-5">Profile & currency</h3>
        <div className="grid sm:grid-cols-2 gap-4 max-w-2xl">
          <div>
            <label className="text-sm font-medium text-slate-700">Display name</label>
            <input className={inputCls + " mt-1.5"} value={name} onChange={(e) => setName(e.target.value)} data-testid="settings-name" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700">Base currency</label>
            <select className={inputCls + " mt-1.5"} value={currency} onChange={(e) => setCurrency(e.target.value)} data-testid="settings-currency">
              {CURRENCY_LIST.map((c) => <option key={c} value={c}>{c} · {CURRENCY_SYMBOLS[c]}</option>)}
            </select>
          </div>
        </div>
        <p className="text-xs text-slate-400 mt-3">All dashboards convert multi-currency transactions into your base currency.</p>
        <button onClick={saveSettings} data-testid="save-settings-btn" className="mt-5 inline-flex items-center gap-2 h-10 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors">
          <Save className="h-4 w-4" /> Save settings
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="font-head font-semibold text-lg flex items-center gap-2">
              Live exchange rates
              <span className="text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600">Live</span>
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Multi-currency totals are converted using real-time rates{ratesUpdated ? ` · updated ${ratesUpdated}` : ""}.
            </p>
          </div>
          <button onClick={doRefreshRates} disabled={refreshing} data-testid="refresh-rates-btn" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} /> Refresh rates
          </button>
        </div>
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {Object.entries(currencies).slice(0, 10).map(([code, meta]) => (
            <div key={code} data-testid={`rate-${code}`} className="rounded-xl border border-slate-100 bg-slate-50/60 px-3 py-2.5">
              <div className="text-xs text-slate-400">{meta.symbol} {code}</div>
              <div className="font-head font-semibold tnum">{Number(meta.rate).toLocaleString(undefined, { maximumFractionDigits: 4 })}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-400 mt-3">Rates shown per 1 USD.</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm mb-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3">
            <span className="h-10 w-10 grid place-items-center rounded-xl bg-blue-50 text-blue-600 shrink-0"><Zap className="h-5 w-5" /></span>
            <div>
              <h3 className="font-head font-semibold text-lg">Recurring Autopilot</h3>
              <p className="text-sm text-slate-500 mt-1 max-w-md">Automatically add your recurring bills and paychecks at the start of each month, so you never re-enter them.</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={runAutopilot} disabled={running} data-testid="autopilot-run-btn" className="inline-flex items-center gap-2 h-10 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-sm font-medium transition-colors disabled:opacity-60">
              <Play className="h-4 w-4" /> {running ? "Running…" : "Run now"}
            </button>
            <Switch checked={autopilot} onCheckedChange={toggleAutopilot} data-testid="autopilot-toggle" />
          </div>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h3 className="font-head font-semibold text-lg">Categories</h3>
          <button onClick={openNew} data-testid="add-category-btn" className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors">
            <Plus className="h-4 w-4" /> Add category
          </button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <th className="px-6 py-3 font-medium">Category</th>
              <th className="px-6 py-3 font-medium">Type</th>
              <th className="px-6 py-3 font-medium">Bucket</th>
              <th className="px-6 py-3 font-medium text-right">Monthly budget</th>
              <th className="px-6 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id} data-testid={`category-row-${c.id}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-6 py-3 font-medium"><span className="inline-flex items-center gap-2"><span className="h-3 w-3 rounded-full" style={{ background: c.color }} />{c.name}</span></td>
                <td className="px-6 py-3"><span className={`text-xs px-2 py-0.5 rounded-full ${c.type === "income" ? "bg-emerald-50 text-emerald-600" : "bg-slate-100 text-slate-600"}`}>{c.type}</span></td>
                <td className="px-6 py-3 capitalize text-slate-500">{c.bucket}</td>
                <td className="px-6 py-3 text-right tnum">{money(c.budget, base)}</td>
                <td className="px-6 py-3 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(c)} data-testid={`edit-category-${c.id}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(c.id)} data-testid={`delete-category-${c.id}`} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Edit category" : "Add category"} testid="category-modal">
        <form onSubmit={save}>
          <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="cat-name" required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} data-testid="cat-type">
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </Field>
            <Field label="Bucket (50/30/20)">
              <select className={inputCls} value={form.bucket} onChange={(e) => setForm({ ...form, bucket: e.target.value })} data-testid="cat-bucket">
                {BUCKETS.map((b) => <option key={b} value={b} className="capitalize">{b}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Monthly budget"><input type="number" step="0.01" className={inputCls} value={form.budget} onChange={(e) => setForm({ ...form, budget: e.target.value })} data-testid="cat-budget" /></Field>
          <Field label="Color"><input type="color" className="h-11 w-full rounded-xl border border-slate-200" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} data-testid="cat-color" /></Field>
          <PrimaryBtn type="submit" data-testid="save-category-btn">{editId ? "Save changes" : "Add category"}</PrimaryBtn>
        </form>
      </Modal>
    </div>
  );
}
