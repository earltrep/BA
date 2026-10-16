import "./App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";
import { SettingsProvider } from "./context/SettingsContext";
import { Toaster } from "./components/ui/sonner";
import Layout from "./components/Layout";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Dashboard from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Accounts from "./pages/Accounts";
import Setup from "./pages/Setup";
import Annual from "./pages/Annual";
import Monthly from "./pages/Monthly";
import CalendarView from "./pages/CalendarView";
import Budget503020 from "./pages/Budget503020";
import SinkingFunds from "./pages/SinkingFunds";
import Debt from "./pages/Debt";
import NetWorth from "./pages/NetWorth";
import Investment from "./pages/Investment";
import NoSpend from "./pages/NoSpend";
import AIInsights from "./pages/AIInsights";

function Protected({ children }) {
  const { user } = useAuth();
  if (user === null)
    return (
      <div className="min-h-screen flex items-center justify-center text-slate-400 font-head">
        Loading your budget…
      </div>
    );
  if (!user) return <Navigate to="/login" replace />;
  return <SettingsProvider>{children}</SettingsProvider>;
}

function App() {
  return (
    <div className="App">
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            <Route
              element={
                <Protected>
                  <Layout />
                </Protected>
              }
            >
              <Route path="/" element={<Dashboard />} />
              <Route path="/transactions" element={<Transactions />} />
              <Route path="/accounts" element={<Accounts />} />
              <Route path="/setup" element={<Setup />} />
              <Route path="/annual" element={<Annual />} />
              <Route path="/monthly" element={<Monthly />} />
              <Route path="/calendar" element={<CalendarView />} />
              <Route path="/budget" element={<Budget503020 />} />
              <Route path="/funds" element={<SinkingFunds />} />
              <Route path="/debt" element={<Debt />} />
              <Route path="/networth" element={<NetWorth />} />
              <Route path="/invest" element={<Investment />} />
              <Route path="/nospend" element={<NoSpend />} />
              <Route path="/ai" element={<AIInsights />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default App;
