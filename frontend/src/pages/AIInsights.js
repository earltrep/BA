import React, { useEffect, useRef, useState } from "react";
import { api, API } from "../lib/api";
import { PageHeader } from "../components/ui-kit";
import { Sparkles, Send, User } from "lucide-react";

const SUGGESTIONS = [
  "How am I doing with my budget this year?",
  "Where can I cut back to save more?",
  "Am I following the 50/30/20 rule?",
  "What's the smartest way to tackle my debt?",
];

export default function AIInsights() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { api.get("/ai/history").then((r) => setMessages(r.data)); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, streaming]);

  const send = async (text) => {
    const q = (text || input).trim();
    if (!q || streaming) return;
    setInput("");
    setMessages((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "" }]);
    setStreaming(true);
    try {
      const res = await fetch(`${API}/ai/insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ message: q }),
      });
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = dec.decode(value, { stream: true });
        setMessages((m) => {
          const copy = [...m];
          copy[copy.length - 1] = { role: "assistant", content: copy[copy.length - 1].content + chunk };
          return copy;
        });
      }
    } catch (e) {
      setMessages((m) => {
        const copy = [...m];
        copy[copy.length - 1] = { role: "assistant", content: "Sorry, I couldn't reach the assistant. Please try again." };
        return copy;
      });
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="fade-up max-w-3xl mx-auto">
      <PageHeader eyebrow="Assistant" title="AI Insights" subtitle="Ask about your real budget data and get tailored, friendly money advice." />

      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm flex flex-col" style={{ minHeight: "60vh" }}>
        <div className="flex-1 overflow-y-auto p-6 space-y-5" style={{ maxHeight: "60vh" }} data-testid="ai-messages">
          {messages.length === 0 && (
            <div className="text-center py-10">
              <div className="h-12 w-12 rounded-2xl bg-blue-50 text-blue-600 grid place-items-center mx-auto mb-4"><Sparkles className="h-6 w-6" /></div>
              <p className="font-head font-semibold text-lg">Your personal finance coach</p>
              <p className="text-slate-500 text-sm mt-1 mb-6">Pick a question to get started.</p>
              <div className="grid sm:grid-cols-2 gap-3">
                {SUGGESTIONS.map((s) => (
                  <button key={s} onClick={() => send(s)} data-testid="ai-suggestion" className="text-left text-sm p-3 rounded-xl border border-slate-200 hover:border-slate-400 hover:bg-slate-50 transition-colors">{s}</button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}>
              {m.role === "assistant" && <div className="h-8 w-8 shrink-0 rounded-xl bg-blue-600 text-white grid place-items-center"><Sparkles className="h-4 w-4" /></div>}
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm whitespace-pre-wrap leading-relaxed ${m.role === "user" ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-800 border border-slate-100"}`}>
                {m.content || (streaming && i === messages.length - 1 ? <span className="text-slate-400">Thinking…</span> : "")}
              </div>
              {m.role === "user" && <div className="h-8 w-8 shrink-0 rounded-xl bg-slate-200 grid place-items-center"><User className="h-4 w-4 text-slate-600" /></div>}
            </div>
          ))}
          <div ref={endRef} />
        </div>

        <div className="border-t border-slate-100 p-4">
          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your spending, savings, debt…"
              data-testid="ai-input"
              className="flex-1 h-11 px-4 rounded-xl border border-slate-200 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/10"
            />
            <button type="submit" disabled={streaming} data-testid="ai-send" className="h-11 w-11 grid place-items-center rounded-xl bg-blue-600 hover:bg-blue-700 text-white transition-colors disabled:opacity-60">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
