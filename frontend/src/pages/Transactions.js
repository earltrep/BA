import React, { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
import { money, CURRENCY_LIST } from "../lib/currency";
import { useSettings } from "../context/SettingsContext";
import { PageHeader, Loader } from "../components/ui-kit";
import Modal, { Field, inputCls, PrimaryBtn } from "../components/Modal";
import { Plus, Pencil, Trash2, Repeat, Shuffle, Upload } from "lucide-react";
import { toast } from "sonner";

const empty = {
  date: new Date().toISOString().slice(0, 10),
  description: "",
  amount: "",
  currency: "USD",
  type: "expense",
  kind: "variable",
  category_id: "",
  account_id: "",
};

export default function Transactions() {
  const { baseCurrency } = useSettings();
  const [txns, setTxns] = useState(null);
  const [cats, setCats] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [tab, setTab] = useState("all");
  const [month, setMonth] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [editId, setEditId] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [rows, setRows] = useState([]);
  const [importing, setImporting] = useState(false);

  const load = () => api.get("/transactions").then((r) => setTxns(r.data));
  useEffect(() => {
    load();
    api.get("/categories").then((r) => setCats(r.data));
    api.get("/accounts").then((r) => setAccounts(r.data));
  }, []);

  const months = useMemo(() => {
    const set = new Set((txns || []).map((t) => t.date.slice(0, 7)));
    return Array.from(set).sort().reverse();
  }, [txns]);

  const filtered = useMemo(() => {
    let list = txns || [];
    if (tab !== "all") list = list.filter((t) => t.kind === tab);
    if (month) list = list.filter((t) => t.date.startsWith(month));
    return list;
  }, [txns, tab, month]);

  const catName = (id) => cats.find((c) => c.id === id)?.name || "—";
  const accName = (id) => accounts.find((a) => a.id === id)?.name || "—";

  const openNew = () => { setForm(empty); setEditId(null); setOpen(true); };
  const openEdit = (t) => {
    setForm({ ...t, amount: String(t.amount) });
    setEditId(t.id);
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    const payload = { ...form, amount: parseFloat(form.amount) || 0 };
    try {
      if (editId) await api.put(`/transactions/${editId}`, payload);
      else await api.post("/transactions", payload);
      toast.success(editId ? "Transaction updated" : "Transaction added");
      setOpen(false);
      load();
    } catch (err) {
      toast.error("Could not save transaction");
    }
  };

  const del = async (id) => {
    await api.delete(`/transactions/${id}`);
    toast.success("Deleted");
    load();
  };

  const parseCsv = (text) => {
    const lines = text.trim().split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return [];
    const split = (line) => {
      const out = []; let c = ""; let q = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') q = !q;
        else if (ch === "," && !q) { out.push(c); c = ""; }
        else c += ch;
      }
      out.push(c);
      return out.map((s) => s.trim().replace(/^"|"$/g, ""));
    };
    const header = split(lines[0]).map((h) => h.toLowerCase());
    const idx = (names) => { for (const n of names) { const i = header.indexOf(n); if (i >= 0) return i; } return -1; };
    const di = idx(["date"]); const de = idx(["description", "desc", "name", "memo", "details", "payee"]);
    const am = idx(["amount", "value", "amt", "debit"]); const ty = idx(["type"]); const cu = idx(["currency", "cur"]); const ki = idx(["kind"]);
    const parsed = [];
    for (let r = 1; r < lines.length; r++) {
      const cols = split(lines[r]);
      if (am >= 0 && !cols[am] && di >= 0 && !cols[di]) continue;
      const amt = parseFloat((cols[am] || "0").replace(/[^0-9.-]/g, "")) || 0;
      let type = ty >= 0 && cols[ty] ? cols[ty].toLowerCase() : amt < 0 ? "expense" : "income";
      if (type !== "income" && type !== "expense") type = amt < 0 ? "expense" : "income";
      parsed.push({
        date: (cols[di] || new Date().toISOString().slice(0, 10)).slice(0, 10),
        description: cols[de] || "Imported",
        amount: Math.abs(amt),
        currency: cu >= 0 && cols[cu] ? cols[cu].toUpperCase() : "USD",
        type,
        kind: ki >= 0 && cols[ki] ? cols[ki].toLowerCase() : "variable",
        category_id: "", account_id: "",
      });
    }
    return parsed;
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      const p = parseCsv(String(reader.result));
      setRows(p);
      if (p.length === 0) toast.error("Couldn't parse rows. Need date, description and amount columns.");
    };
    reader.readAsText(f);
  };

  const doImport = async () => {
    if (rows.length === 0) return;
    setImporting(true);
    try {
      const { data } = await api.post("/transactions/bulk", { transactions: rows });
      toast.success(`Imported ${data.inserted} transactions`);
      setImportOpen(false); setRows([]); load();
    } catch (e) {
      toast.error("Import failed");
    } finally {
      setImporting(false);
    }
  };

  if (!txns) return <Loader />;

  const totalIn = filtered.filter((t) => t.type === "income").length;

  return (
    <div className="fade-up">
      <PageHeader
        eyebrow="Money in & out"
        title="Transactions"
        subtitle="Log recurring bills and variable spending. Amounts can be in any currency."
        action={
          <div className="flex gap-2">
            <button onClick={() => { setRows([]); setImportOpen(true); }} data-testid="import-csv-btn" className="inline-flex items-center gap-2 h-11 px-5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 font-medium transition-colors">
              <Upload className="h-4 w-4" /> Import CSV
            </button>
            <button onClick={openNew} data-testid="add-transaction-btn" className="inline-flex items-center gap-2 h-11 px-5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors">
              <Plus className="h-4 w-4" /> Add transaction
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="inline-flex p-1 bg-slate-100 rounded-xl">
          {[
            { k: "all", label: "All", icon: null },
            { k: "recurring", label: "Recurring", icon: Repeat },
            { k: "variable", label: "Variable", icon: Shuffle },
          ].map((t) => (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              data-testid={`txn-tab-${t.k}`}
              className={`inline-flex items-center gap-1.5 px-4 h-9 rounded-lg text-sm font-medium transition-colors ${tab === t.k ? "bg-white shadow-sm text-slate-900" : "text-slate-500"}`}
            >
              {t.icon && <t.icon className="h-3.5 w-3.5" />} {t.label}
            </button>
          ))}
        </div>
        <select value={month} onChange={(e) => setMonth(e.target.value)} data-testid="txn-month-filter" className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-sm">
          <option value="">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        <span className="text-sm text-slate-400 ml-auto">{filtered.length} entries · {totalIn} income</span>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wider text-slate-400 border-b border-slate-100">
              <th className="px-5 py-3 font-medium">Date</th>
              <th className="px-5 py-3 font-medium">Description</th>
              <th className="px-5 py-3 font-medium hidden md:table-cell">Category</th>
              <th className="px-5 py-3 font-medium hidden lg:table-cell">Account</th>
              <th className="px-5 py-3 font-medium text-right">Amount</th>
              <th className="px-5 py-3 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((t) => (
              <tr key={t.id} data-testid={`txn-row-${t.id}`} className="border-b border-slate-50 hover:bg-slate-50/60">
                <td className="px-5 py-3 text-slate-500 tnum whitespace-nowrap">{t.date}</td>
                <td className="px-5 py-3 font-medium text-slate-800">
                  {t.description}
                  <span className={`ml-2 text-[10px] px-1.5 py-0.5 rounded-full ${t.kind === "recurring" ? "bg-blue-50 text-blue-600" : "bg-slate-100 text-slate-500"}`}>{t.kind}</span>
                </td>
                <td className="px-5 py-3 text-slate-500 hidden md:table-cell">{catName(t.category_id)}</td>
                <td className="px-5 py-3 text-slate-500 hidden lg:table-cell">{accName(t.account_id)}</td>
                <td className={`px-5 py-3 text-right font-semibold tnum ${t.type === "income" ? "text-emerald-600" : "text-slate-800"}`}>
                  {t.type === "income" ? "+" : "-"}{money(t.amount, t.currency)}
                </td>
                <td className="px-5 py-3 text-right whitespace-nowrap">
                  <button onClick={() => openEdit(t)} data-testid={`edit-txn-${t.id}`} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500"><Pencil className="h-4 w-4" /></button>
                  <button onClick={() => del(t.id)} data-testid={`delete-txn-${t.id}`} className="p-1.5 rounded-lg hover:bg-rose-50 text-rose-500"><Trash2 className="h-4 w-4" /></button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="px-5 py-12 text-center text-slate-400">No transactions match this filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <Modal open={open} onClose={() => setOpen(false)} title={editId ? "Edit transaction" : "Add transaction"} testid="transaction-modal">
        <form onSubmit={save}>
          <Field label="Description">
            <input className={inputCls} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} data-testid="txn-description" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount">
              <input type="number" step="0.01" className={inputCls} value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} data-testid="txn-amount" required />
            </Field>
            <Field label="Currency">
              <select className={inputCls} value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} data-testid="txn-currency">
                {CURRENCY_LIST.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type">
              <select className={inputCls} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} data-testid="txn-type">
                <option value="expense">Expense</option>
                <option value="income">Income</option>
              </select>
            </Field>
            <Field label="Kind">
              <select className={inputCls} value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value })} data-testid="txn-kind">
                <option value="variable">Variable</option>
                <option value="recurring">Recurring</option>
              </select>
            </Field>
          </div>
          <Field label="Date">
            <input type="date" className={inputCls} value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} data-testid="txn-date" required />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select className={inputCls} value={form.category_id || ""} onChange={(e) => setForm({ ...form, category_id: e.target.value })} data-testid="txn-category">
                <option value="">None</option>
                {cats.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </Field>
            <Field label="Account">
              <select className={inputCls} value={form.account_id || ""} onChange={(e) => setForm({ ...form, account_id: e.target.value })} data-testid="txn-account">
                <option value="">None</option>
                {accounts.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
            </Field>
          </div>
          <PrimaryBtn type="submit" data-testid="save-txn-btn">{editId ? "Save changes" : "Add transaction"}</PrimaryBtn>
        </form>
      </Modal>

      <Modal open={importOpen} onClose={() => { setImportOpen(false); setRows([]); }} title="Import from CSV" testid="import-modal">
        <p className="text-sm text-slate-500 mb-4">
          Upload a bank CSV with columns like <span className="font-medium text-slate-700">date, description, amount</span> (optional: type, currency, kind). Negative amounts become expenses.
        </p>
        <input type="file" accept=".csv,text/csv" onChange={onFile} data-testid="csv-file-input" className="block w-full text-sm mb-4 file:mr-3 file:py-2.5 file:px-4 file:rounded-lg file:border-0 file:bg-slate-900 file:text-white file:text-sm file:font-medium file:cursor-pointer" />
        {rows.length > 0 && (
          <div className="mb-4">
            <div className="text-xs text-slate-400 mb-2">{rows.length} rows detected · preview</div>
            <div className="max-h-48 overflow-y-auto border border-slate-100 rounded-xl divide-y divide-slate-50">
              {rows.slice(0, 8).map((r, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 text-sm">
                  <span className="truncate text-slate-600">{r.date} · {r.description}</span>
                  <span className={`tnum font-medium ${r.type === "income" ? "text-emerald-600" : "text-slate-700"}`}>{r.type === "income" ? "+" : "-"}{money(r.amount, r.currency)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        <PrimaryBtn onClick={doImport} disabled={importing || rows.length === 0} data-testid="confirm-import-btn">
          {importing ? "Importing…" : `Import ${rows.length || ""} transactions`}
        </PrimaryBtn>
      </Modal>
    </div>
  );
}
