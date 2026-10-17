import "./App.css";
import React, { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { SettingsProvider } from "./context/SettingsContext";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { ensureInit } from "./lib/db";
import { maybeRunAutopilot } from "./lib/api";
import { refreshRates } from "./lib/rates";
import { Loader } from "./components/ui-kit";
import Layout from "./components/Layout";

import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Accounts from "./pages/Accounts";
import Setup from "./pages/Setup";
import Annual from "./pages/Annual";
import Monthly from "./pages/Monthly";
import Paycheck from "./pages/Paycheck";
import ExpenseExplorer from "./pages/ExpenseExplorer";
import Compare from "./pages/Compare";
import CalendarView from "./pages/CalendarView";
import Budget503020 from "./pages/Budget503020";
import SinkingFunds from "./pages/SinkingFunds";
import FundingPlan from "./pages/FundingPlan";
import Debt from "./pages/Debt";
import NetWorth from "./pages/NetWorth";
import Investment from "./pages/Investment";
import NoSpend from "./pages/NoSpend";
import Backup from "./pages/Backup";
import Guide from "./pages/Guide";

function Boot({ children }) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const onRej = (e) => {
      const msg = (e?.reason?.message || "").toLowerCase();
      if (msg.includes("save") || msg.includes("storage") || msg.includes("aborted") || msg.includes("quota")) {
        toast.error("Couldn't save your change locally. It may be lost — try freeing up space or disabling private mode.");
      }
    };
    window.addEventListener("unhandledrejection", onRej);
    (async () => {
      try {
        await ensureInit();
        refreshRates().catch(() => {});
        try { await maybeRunAutopilot(); } catch (_) {}
        setReady(true);
      } catch (e) {
        setFailed(true);
      }
    })();
    return () => window.removeEventListener("unhandledrejection", onRej);
  }, []);

  if (failed) {
    return (
      <div className="min-h-screen grid place-items-center p-6 text-center">
        <div className="max-w-sm">
          <h1 className="font-head font-bold text-2xl mb-2">Local storage unavailable</h1>
          <p className="text-slate-500 text-sm">This planner needs browser storage (IndexedDB) to save your budget. It looks blocked — please disable private/incognito mode or allow site data, then reload.</p>
        </div>
      </div>
    );
  }
  if (!ready) return <div className="min-h-screen grid place-items-center"><Loader label="Loading your planner…" /></div>;
  return children;
}

function App() {
  return (
    <div className="App">
      <HashRouter>
        <Boot>
          <SettingsProvider>
            <Routes>
              <Route element={<Layout />}>
                <Route path="/" element={<Dashboard />} />
                <Route path="/transactions" element={<Transactions />} />
                <Route path="/accounts" element={<Accounts />} />
                <Route path="/setup" element={<Setup />} />
                <Route path="/annual" element={<Annual />} />
                <Route path="/monthly" element={<Monthly />} />
                <Route path="/paycheck" element={<Paycheck />} />
                <Route path="/expenses" element={<ExpenseExplorer />} />
                <Route path="/compare" element={<Compare />} />
                <Route path="/calendar" element={<CalendarView />} />
                <Route path="/budget" element={<Budget503020 />} />
                <Route path="/funds" element={<SinkingFunds />} />
                <Route path="/funding" element={<FundingPlan />} />
                <Route path="/debt" element={<Debt />} />
                <Route path="/networth" element={<NetWorth />} />
                <Route path="/invest" element={<Investment />} />
                <Route path="/nospend" element={<NoSpend />} />
                <Route path="/backup" element={<Backup />} />
                <Route path="/guide" element={<Guide />} />
              </Route>
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </SettingsProvider>
        </Boot>
      </HashRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
