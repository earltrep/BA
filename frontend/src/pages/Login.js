import React, { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { formatApiError } from "../lib/api";
import { Coins, TrendingUp, ArrowRight } from "lucide-react";
import { toast } from "sonner";

const BG =
  "https://images.unsplash.com/photo-1671716784499-a3d26826d844?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA2MDV8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMGNhbG0lMjBzb2Z0JTIwYmFja2dyb3VuZHxlbnwwfHx8fDE3OTIxNzAxNjV8MA&ixlib=rb-4.1.0&q=85";

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState("demo@budgetly.app");
  const [password, setPassword] = useState("demo1234");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email, password);
      toast.success("Welcome back!");
      nav("/");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-slate-50">
      <div className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-sm fade-up">
          <div className="flex items-center gap-2.5 mb-10">
            <div className="h-9 w-9 rounded-xl bg-slate-900 text-white grid place-items-center">
              <Coins className="h-5 w-5" />
            </div>
            <span className="font-head font-bold text-xl tracking-tight">Budgetly</span>
          </div>

          <h1 className="font-head font-bold text-3xl tracking-tight">Welcome back</h1>
          <p className="text-slate-500 mt-2 mb-8">Sign in to manage your annual budget.</p>

          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="text-sm font-medium text-slate-700">Email</label>
              <input
                data-testid="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1.5 w-full h-11 px-4 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                required
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700">Password</label>
              <input
                data-testid="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1.5 w-full h-11 px-4 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10 focus:border-slate-400"
                required
              />
            </div>
            <button
              data-testid="login-submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? "Signing in…" : "Sign in"}
              {!loading && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <div className="mt-6 text-sm text-slate-500">
            No account?{" "}
            <Link to="/register" className="text-blue-600 font-medium hover:underline" data-testid="goto-register">
              Create one
            </Link>
          </div>
          <div className="mt-6 text-xs text-slate-400 bg-slate-100 rounded-lg px-3 py-2">
            Demo login prefilled — just press <span className="font-medium text-slate-600">Sign in</span>.
          </div>
        </div>
      </div>

      <div className="hidden lg:block relative overflow-hidden">
        <img src={BG} alt="" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-slate-900/10" />
        <div className="absolute bottom-10 left-10 right-10 bg-white/70 backdrop-blur-xl rounded-2xl p-6 border border-white/60">
          <TrendingUp className="h-6 w-6 text-emerald-600 mb-3" />
          <p className="font-head font-semibold text-lg text-slate-900 leading-snug">
            Track income, expenses, savings & debt — all in one calm, annual view.
          </p>
          <p className="text-sm text-slate-600 mt-2">
            28 budgeting tools reimagined for the web, with AI insights built in.
          </p>
        </div>
      </div>
    </div>
  );
}
