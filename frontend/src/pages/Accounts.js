import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money, CURRENCY_LIST } from "../lib/currency";
import { useSettings } from "../context/SettingsContext";
import { PageHeader, Loader } from "../components/ui-kit";
import Modal, { Field, inputCls, PrimaryBtn } from "../components/Modal";
import { Plus, Pencil, Trash2, Wallet, CreditCard, PiggyBank, Banknote, LineChart } from "lucide-react";
import { toast } from "sonner";

const TYPES = [
  { k: "checking", label: "Checking", icon: Wallet },
  { k: "savings", label: "Savings", icon: PiggyBank },
  { k: "credit", label: "Credit", icon: CreditCard },
  { k: "cash", label: "Cash", icon: Banknote },
  { k: "investment", label: "Investment", icon: LineChart },
];
const empty = { name: "", type: "checking", balance: "", currency: "USD", color: "#0f172a" };

export default function Accounts() {
  const { baseCurrency } = useSettings();
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = () => api.get("/accounts").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (a) => { setForm({ ...a, balance: String(a.balance) }); setEditId(a.id); setOpen(true); };

  const save = async (e) => {
    e.preventDefault();
    const payload = { ...form, balance: parseFloat(form.balance) || 0 };
    if (editId) await api.put(`/accounts/${editId}`, payload);
    else await api.post("/accounts", payload);
    toast.success(editId ? "Account updated" : "Account added");
    setOpen(false); load();
  };
  const del = async (id) => { await api.delete(`/accounts/${id}`); toast.success("Deleted"); load(); };

  if (!list) return <Loader />;
  const Icon = (type) => (TYPES.find((t) => t.k === type)?.icon || Wallet);

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Money in & out"
        title="Bank Accounts"
        subtitle="Keep tabs on every account and card in its own currency."
        action={
          <button onClick={openNew} data-testid="add-account-btn" className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors">
            <Plus className="h-4 w-4" /> Add account
          </button>
        }
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {list.map((a) => {
          const I = Icon(a.type);
          return (
            <div key={a.id} data-testid={`account-card-${a.id}`} className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm hover:-translate-y-0.5 transition-transform">
              <div className="flex items-start justify-between">
                <span className="h-10 w-10 grid place-items-center rounded-xl text-white" style={{ background: a.color }}>
                  <I className="h-5 w-5" />
                </span>
                <div className="flex gap-1">
                  <button onClick={() => openEdit(a)} data-testid={`edit-account-${a.id}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(a.id)} data-testid={`delete-account-${a.id}`} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="mt-4 text-xs uppercase tracking-wider text-slate-400">{a.type} · {a.currency}</div>
              <div className="font-head font-semibold text-lg">{a.name}</div>
              <div className={`mt-2 font-head font-bold text-2xl tnum ${a.balance < 0 ? "text-rose-600" : "text-slate-900"}`}>{money(a.balance, a.currency)}</div>
            </div>
          );
        })}
        {list.length === 0 && <div className="text-slate-400">No accounts yet — add your first one.</div>}
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Edit account" : "Add account"} testid="account-modal">
        <form onSubmit={save}>
          <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="acc-name" required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} data-testid="acc-type">
                {TYPES.map((t) => <option key={t.k} value={t.k}>{t.label}</option>)}
              </select>
            </Field>
            <Field label="Currency">
              <select className={inputCls} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} data-testid="acc-currency">
                {CURRENCY_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <Field label="Balance"><input type="number" step="0.01" className={inputCls} value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} data-testid="acc-balance" required /></Field>
          <Field label="Color"><input type="color" className="h-11 w-full rounded-xl border border-slate-200" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} data-testid="acc-color" /></Field>
          <PrimaryBtn type="submit" data-testid="save-account-btn">{editId ? "Save changes" : "Add account"}</PrimaryBtn>
        </form>
      </Modal>
    </div>
  );
}
