import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/currency";
import { useSettings } from "../context/SettingsContext";
import { PageHeader, StatCard, Loader } from "../components/ui-kit";
import Modal, { Field, inputCls, PrimaryBtn } from "../components/Modal";
import { Plus, Pencil, Trash2, Landmark, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

const empty = { name: "", type: "asset", amount: "" };

export default function NetWorth() {
  const { baseCurrency } = useSettings();
  const [list, setList] = useState(null);
  const [dash, setDash] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);

  const load = () => {
    api.get("/networth").then((r) => setList(r.data));
    api.get("/dashboard").then((r) => setDash(r.data));
  };
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (n) => { setForm({ name: n.name, type: n.type, amount: String(n.amount) }); setEditId(n.id); setOpen(true); };
  const save = async (e) => {
    e.preventDefault();
    const payload = { name: form.name, type: form.type, amount: parseFloat(form.amount) || 0 };
    if (editId) await api.put(`/networth/${editId}`, payload);
    else await api.post("/networth", payload);
    toast.success("Saved"); setOpen(false); load();
  };
  const del = async (id) => { await api.delete(`/networth/${id}`); toast.success("Deleted"); load(); };

  if (!list || !dash) return <Loader />;
  const cur = baseCurrency;
  const assets = list.filter((n) => n.type === "asset");
  const liabilities = list.filter((n) => n.type === "liability");

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Build your wealth"
        title="Net Worth"
        subtitle="Everything you own minus everything you owe — including account balances and savings."
        action={<button onClick={openNew} data-testid="add-networth-btn" className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors"><Plus className="h-4 w-4" /> Add item</button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <StatCard testid="nw-assets" label="Total assets" value={money(dash.assets, cur)} icon={TrendingUp} accent="emerald" />
        <StatCard testid="nw-liabilities" label="Total liabilities" value={money(dash.liabilities, cur)} icon={TrendingDown} accent="rose" />
        <StatCard testid="nw-total" label="Net worth" value={money(dash.net_worth, cur)} icon={Landmark} accent="blue" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {[{ title: "Assets", rows: assets, color: "text-emerald-600" }, { title: "Liabilities", rows: liabilities, color: "text-rose-600" }].map((grp) => (
          <div key={grp.title} className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 font-head font-semibold text-lg">{grp.title}</div>
            <table className="w-full text-sm">
              <tbody>
                {grp.rows.map((n) => (
                  <tr key={n.id} data-testid={`networth-row-${n.id}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                    <td className="px-6 py-3 font-medium">{n.name}</td>
                    <td className={`px-6 py-3 text-right tnum font-medium ${grp.color}`}>{money(n.amount, cur)}</td>
                    <td className="px-6 py-3 text-right whitespace-nowrap w-24">
                      <button onClick={() => openEdit(n)} data-testid={`edit-networth-${n.id}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="h-4 w-4" /></button>
                      <button onClick={() => del(n.id)} data-testid={`delete-networth-${n.id}`} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"><Trash2 className="h-4 w-4" /></button>
                    </td>
                  </tr>
                ))}
                {grp.rows.length === 0 && <tr><td className="px-6 py-8 text-center text-slate-400" colSpan={3}>Nothing added yet.</td></tr>}
              </tbody>
            </table>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-400 mt-4">Net worth also includes {money(dash.account_total, cur)} in account balances and {money(dash.savings_total, cur)} in sinking funds, plus {money(dash.debt_total, cur)} of tracked debt.</p>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Edit item" : "Add item"} testid="networth-modal">
        <form onSubmit={save}>
          <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="nw-name" required /></Field>
          <Field label="Type">
            <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} data-testid="nw-type">
              <option value="asset">Asset</option>
              <option value="liability">Liability</option>
            </select>
          </Field>
          <Field label="Amount"><input type="number" step="0.01" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="nw-amount" required /></Field>
          <PrimaryBtn type="submit" data-testid="save-networth-btn">{editId ? "Save changes" : "Add item"}</PrimaryBtn>
        </form>
      </Modal>
    </div>
  );
}
