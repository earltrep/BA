import React, { useEffect, useState } from "react";
import { api } from "../lib/api";
import { money } from "../lib/currency";
import { useSettings } from "../context/SettingsContext";
import { PageHeader, StatCard, Loader } from "../components/ui-kit";
import Modal, { Field, inputCls, PrimaryBtn } from "../components/Modal";
import { Plus, Pencil, Trash2, Calculator, Clock, Flame } from "lucide-react";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import { toast } from "sonner";

const empty = { name: "", balance: "", apr: "", min_payment: "" };

export default function Debt() {
  const { baseCurrency } = useSettings();
  const [list, setList] = useState(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [strategy, setStrategy] = useState("snowball");
  const [extra, setExtra] = useState(200);
  const [result, setResult] = useState(null);

  const load = () => api.get("/debts").then((r) => setList(r.data));
  useEffect(() => { load(); }, []);

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (d) => { setForm({ name: d.name, balance: String(d.balance), apr: String(d.apr), min_payment: String(d.min_payment) }); setEditId(d.id); setOpen(true); };
  const save = async (e) => {
    e.preventDefault();
    const payload = { name: form.name, balance: parseFloat(form.balance) || 0, apr: parseFloat(form.apr) || 0, min_payment: parseFloat(form.min_payment) || 0 };
    if (editId) await api.put(`/debts/${editId}`, payload);
    else await api.post("/debts", payload);
    toast.success("Saved"); setOpen(false); load();
  };
  const del = async (id) => { await api.delete(`/debts/${id}`); toast.success("Deleted"); load(); };

  const calculate = async () => {
    const { data } = await api.post("/debts/payoff", { strategy, extra: Number(extra) || 0 });
    setResult(data);
    toast.success("Payoff plan ready");
  };

  if (!list) return <Loader />;
  const cur = baseCurrency;
  const totalDebt = list.reduce((s, d) => s + Number(d.balance), 0);
  const totalMin = list.reduce((s, d) => s + Number(d.min_payment), 0);

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Build your wealth"
        title="Debt Payoff Calculator"
        subtitle="Compare snowball vs avalanche and see when you'll be debt-free."
        action={<button onClick={openNew} data-testid="add-debt-btn" className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors"><Plus className="h-4 w-4" /> Add debt</button>}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">
        <StatCard testid="debt-total" label="Total debt" value={money(totalDebt, cur)} icon={Flame} accent="rose" />
        <StatCard testid="debt-min" label="Min. payments / mo" value={money(totalMin, cur)} icon={Clock} accent="amber" />
        <StatCard testid="debt-count" label="Debts tracked" value={list.length} icon={Calculator} accent="slate" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <th className="px-5 py-3 font-medium">Debt</th>
                <th className="px-5 py-3 font-medium text-right">Balance</th>
                <th className="px-5 py-3 font-medium text-right">APR</th>
                <th className="px-5 py-3 font-medium text-right">Min</th>
                <th className="px-5 py-3 font-medium text-right"></th>
              </tr>
            </thead>
            <tbody>
              {list.map((d) => (
                <tr key={d.id} data-testid={`debt-row-${d.id}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                  <td className="px-5 py-3 font-medium">{d.name}</td>
                  <td className="px-5 py-3 text-right tnum">{money(d.balance, cur)}</td>
                  <td className="px-5 py-3 text-right tnum text-slate-500">{d.apr}%</td>
                  <td className="px-5 py-3 text-right tnum text-slate-500">{money(d.min_payment, cur)}</td>
                  <td className="px-5 py-3 text-right whitespace-nowrap">
                    <button onClick={() => openEdit(d)} data-testid={`edit-debt-${d.id}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="h-4 w-4" /></button>
                    <button onClick={() => del(d.id)} data-testid={`delete-debt-${d.id}`} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              ))}
              {list.length === 0 && <tr><td colSpan={5} className="px-5 py-10 text-center text-slate-400">No debts tracked.</td></tr>}
            </tbody>
          </table>
        </div>

        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
          <h3 className="font-head font-semibold text-lg mb-4">Payoff plan</h3>
          <div className="inline-flex p-1 bg-slate-100 rounded-xl mb-4 w-full">
            {["snowball", "avalanche"].map((s) => (
              <button key={s} onClick={() => setStrategy(s)} data-testid={`strategy-${s}`} className={`flex-1 h-9 rounded-lg text-sm font-medium capitalize transition-colors ${strategy === s ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}>{s}</button>
            ))}
          </div>
          <Field label={`Extra monthly payment (${cur})`}>
            <input type="number" className={inputCls} value={extra} onChange={(e) => setExtra(e.target.value)} data-testid="debt-extra" />
          </Field>
          <PrimaryBtn onClick={calculate} data-testid="calculate-payoff-btn">Calculate payoff</PrimaryBtn>

          {result && (
            <div className="mt-5 space-y-3" data-testid="payoff-result">
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-slate-50 rounded-xl p-3">
                  <div className="text-xs text-slate-400">Debt-free in</div>
                  <div className="font-head font-bold text-xl tnum">{result.years} yrs</div>
                </div>
                <div className="bg-rose-50 rounded-xl p-3">
                  <div className="text-xs text-rose-400">Total interest</div>
                  <div className="font-head font-bold text-xl tnum text-rose-600">{money(result.total_interest, cur, { compact: true })}</div>
                </div>
              </div>
              {result.payoff_order.length > 0 && (
                <div className="text-xs text-slate-500">Order: {result.payoff_order.join(" → ")}</div>
              )}
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={result.schedule}>
                  <defs><linearGradient id="dg" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#0f172a" stopOpacity={0.2} /><stop offset="100%" stopColor="#0f172a" stopOpacity={0} /></linearGradient></defs>
                  <CartesianGrid vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: "#94a3b8" }} tickLine={false} axisLine={false} />
                  <YAxis hide />
                  <Tooltip formatter={(v) => money(v, cur)} labelFormatter={(l) => `Month ${l}`} contentStyle={{ borderRadius: 12, border: "1px solid #e2e8f0", fontSize: 12 }} />
                  <Area dataKey="remaining" stroke="#0f172a" fill="url(#dg)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Edit debt" : "Add debt"} testid="debt-modal">
        <form onSubmit={save}>
          <Field label="Name"><input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} data-testid="debt-name" required /></Field>
          <Field label="Balance"><input type="number" step="0.01" className={inputCls} value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} data-testid="debt-balance" required /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="APR %"><input type="number" step="0.01" className={inputCls} value={form.apr} onChange={(e) => setForm({ ...form, apr: e.target.value })} data-testid="debt-apr" /></Field>
            <Field label="Min payment"><input type="number" step="0.01" className={inputCls} value={form.min_payment} onChange={(e) => setForm({ ...form, min_payment: e.target.value })} data-testid="debt-min" /></Field>
          </div>
          <PrimaryBtn type="submit" data-testid="save-debt-btn">{editId ? "Save changes" : "Add debt"}</PrimaryBtn>
        </form>
      </Modal>
    </div>
  );
}
