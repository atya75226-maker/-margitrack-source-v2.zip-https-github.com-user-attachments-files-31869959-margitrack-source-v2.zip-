import React, { useState, useRef, useEffect } from "react";
import { supabase, callEdgeFunction } from "../lib/supabaseClient";
import { usePreferences } from "../contexts/PreferencesContext";

const PERIODS = [
  { id: "day", label: "Aujourd'hui" },
  { id: "week", label: "7 derniers jours" },
  { id: "month", label: "30 derniers jours" },
];

const SUGGESTIONS = [
  "Comment augmenter mon bénéfice ?",
  "Quel est mon produit le plus rentable ?",
  "Mes dépenses ont-elles augmenté ?",
];

export function AdvisorPage({ restaurantId }) {
  const { palette, t } = usePreferences();
  const [conversation, setConversation] = useState([]);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const [askError, setAskError] = useState(null);

  const [showReport, setShowReport] = useState(false);
  const [period, setPeriod] = useState("week");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation, asking]);

  const generate = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const body = await callEdgeFunction("ai-report", { token, body: { restaurant_id: restaurantId, period } });
      setReport(body.content);
    } catch (err) {
      setError(err.message || "Impossible de générer le rapport.");
    } finally { setLoading(false); }
  };

  const ask = async (q) => {
    const text = (q ?? question).trim();
    if (!text) return;
    setAsking(true);
    setAskError(null);
    setConversation((prev) => [...prev, { role: "user", text }]);
    setQuestion("");
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const body = await callEdgeFunction("ai-ask", { token, body: { restaurant_id: restaurantId, question: text } });
      setConversation((prev) => [...prev, { role: "assistant", text: body.answer }]);
    } catch (err) {
      setAskError(err.message || "Impossible d'obtenir une réponse.");
    } finally { setAsking(false); }
  };

  return (
    <div className="flex flex-col h-full min-h-[420px]">
      <div className="flex-1 overflow-y-auto space-y-3 px-1 pb-3">
        {conversation.length === 0 && (
          <div className="rounded-2xl shadow-sm p-4" style={{ backgroundColor: palette.card, border: `1px solid ${palette.line}` }}>
            <p className="text-sm font-semibold text-gray-300 mb-2">✨ {t("assistant_title")}</p>
            <p className="text-sm text-gray-400 mb-3">{t("assistant_intro")}</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => ask(s)} className="text-xs rounded-full bg-[#7C5CFF]/15 text-[#A78BFA] px-3 py-1.5">{s}</button>
              ))}
            </div>
          </div>
        )}

        {conversation.map((m, i) => (
          <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === "user" ? "bg-[#7C5CFF] text-white rounded-br-sm" : "shadow-sm rounded-bl-sm"
              }`}
              style={m.role === "user" ? undefined : { backgroundColor: palette.card, color: palette.ink }}
            >
              {m.text}
            </div>
          </div>
        ))}

        {asking && (
          <div className="flex justify-start">
            <div className="shadow-sm rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1" style={{ backgroundColor: palette.card }}>
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" />
            </div>
          </div>
        )}

        {askError && <p className="text-xs text-rose-600 text-center">{askError}</p>}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 pt-2" style={{ borderTop: `1px solid ${palette.line}` }}>
        <input
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") ask(); }}
          placeholder={t("write_question")}
          className="flex-1 rounded-full border px-4 py-2.5 text-sm" style={{ backgroundColor: palette.elevated, borderColor: palette.line, color: palette.ink }}
        />
        <button onClick={() => ask()} disabled={asking || !question.trim()} className="rounded-full bg-[#7C5CFF] text-white text-sm font-medium px-5 disabled:opacity-50">
          {asking ? "..." : t("send")}
        </button>
      </div>

      <div className="mt-3">
        <button onClick={() => setShowReport((v) => !v)} className="text-xs text-gray-400 font-medium">
          {showReport ? t("hide") : t("generate_report")}
        </button>
        {showReport && (
          <div className="rounded-2xl shadow-sm p-4 space-y-3 mt-2" style={{ backgroundColor: palette.card, border: `1px solid ${palette.line}` }}>
            <div className="flex gap-2">
              {PERIODS.map((p) => (
                <button key={p.id} onClick={() => setPeriod(p.id)} className={`flex-1 rounded-xl text-xs font-medium py-2 ${period === p.id ? "bg-[#7C5CFF] text-white" : "opacity-70"}`}>{p.label}</button>
              ))}
            </div>
            <button onClick={generate} disabled={loading} className="w-full rounded-xl bg-[#7C5CFF] text-white text-sm font-medium py-2.5 disabled:opacity-50">{loading ? t("analyzing") : t("generate")}</button>
            {error && <p className="text-xs text-rose-600">{error}</p>}
            {report && (<div className="whitespace-pre-wrap text-sm leading-relaxed pt-3" style={{ color: palette.ink, borderTop: `1px solid ${palette.line}` }}>{report}</div>)}
          </div>
        )}
      </div>
    </div>
  );
}
