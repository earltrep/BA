import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/currency";
import { useSettings } from "../context/SettingsContext";
import { PageHeader, Loader } from "../components/ui-kit";
import Modal, { Field, inputCls, PrimaryBtn } from "../components/Modal";
import { Plus, Pencil, Trash2, PiggyBank } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", target: "", saved: "", color: "#0ea5e9", due_date: "" };

export default function SinkingFunds() {
  const { baseCurrency } = useSettings();
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = () => api.get("/sinking-funds").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (f) => { setForm({ ...f, target: String(f.target), saved: String(f.saved), due_date: f.due_date || "" }); setEditId(f.id); setOpen(true); };
  const save = async (e) => {
    e.preventDefault();
    const payload = { ...form, target: parseFloat(form.target) || 0, saved: parseFloat(form.saved) || 0 };
    if (editId) await api.put(`/sinking-funds/${editId}`, payload);
    else await api.post("/sinking-funds", payload);
    toast.success("Saved"); setOpen(false); load();
  };
  const del = async (id) => { await api.delete(`/sinking-funds/${id}`); toast.success("Deleted"); load(); };

  if (!list) return <Loader />;
  const cur = baseCurrency;
  const totalSaved = list.reduce((s, f) => s + Number(f.saved), 0);
  const totalTarget = list.reduce((s, f) => s + Number(f.target), 0);

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Build your wealth"
        title="Sinking Funds"
        subtitle={`Saving ${money(totalSaved, cur)} toward ${money(totalTarget, cur)} in goals.`}
        action={<button onClick={openNew} data-testid="add-fund-btn" className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors"><Plus className="h-4 w-4" /> Add fund</button>}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {list.map((f) => {
          const pct = f.target ? Math.min(Math.round((f.saved / f.target) * 100), 100) : 0;
          return (
            <div key={f.id} data-testid={`fund-card-${f.id}`} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between">
                <span className="h-10 w-10 grid place-items-center rounded-xl text-white" style={{ background: f.color }}><PiggyBank className="h-5 w-5" /></span>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(f)} data-testid={`edit-fund-${f.id}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(f.id)} data-testid={`delete-fund-${f.id}`} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="font-head font-semibold text-lg mt-4">{f.name}</div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="font-head font-bold text-xl tnum">{money(f.saved, cur)}</span>
                <span className="text-sm text-slate-400">/ {money(f.target, cur)}</span>
              </div>
              <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden mt-3">
                <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: f.color }} />
              </div>
              <div className="text-xs text-slate-400 mt-2">{pct}% funded{f.due_date ? ` · by ${f.due_date}` : ""}</div>
            </div>
          );
        })}
        {list.length === 0 && <div className="text-slate-400">No funds yet — create your first savings goal.</div>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Edit fund" : "Add sinking fund"} testid="fund-modal">
        <form onSubmit={save}>
          <Field label="Goal name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="fund-name" required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target"><input type="number" step="0.01" className={inputCls} value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} data-testid="fund-target" required /></Field>
            <Field label="Saved so far"><input type="number" step="0.01" className={inputCls} value={form.saved} onChange={(e) => setForm({ ...form, saved: e.target.value })} data-testid="fund-saved" /></Field>
          </div>
          <Field label="Target date (optional)"><input type="date" className={inputCls} value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} data-testid="fund-date" /></Field>
          <Field label="Color"><input type="color" className="h-11 w-full rounded-xl border border-slate-200" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} data-testid="fund-color" /></Field>
          <PrimaryBtn type="submit" data-testid="save-fund-btn">{editId ? "Save changes" : "Add fund"}</PrimaryBtn>
        </form>
      </Modal>
    </div>
  );
}
