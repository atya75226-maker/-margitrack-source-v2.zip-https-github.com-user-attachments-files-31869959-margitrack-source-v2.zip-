import React, { useState, useMemo } from "react";
import { supabase, callEdgeFunction } from "../lib/supabaseClient";
import { usePreferences } from "../contexts/PreferencesContext";

const PERIODS = [
  { id: "day", label: "Aujourd'hui", days: 1, aiPeriod: "day" },
  { id: "3days", label: "3 derniers jours", days: 3, aiPeriod: "week" },
  { id: "week", label: "7 derniers jours", days: 7, aiPeriod: "week" },
  { id: "month", label: "30 derniers jours", days: 30, aiPeriod: "month" },
];

function pctLabel(current, previous) {
  if (!previous || previous <= 0) return current > 0 ? "nouveau" : null;
  const pct = ((current - previous) / previous) * 100;
  const rounded = Math.round(pct);
  if (rounded === 0) return null;
  return `${rounded >= 0 ? "+" : ""}${rounded}%`;
}

function dateNDaysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function ReceiptModal({ restaurantName, restaurantId, products, sales, expenses, onClose }) {
  const { palette, formatMoney } = usePreferences();
  const fcfa = formatMoney;
  const [periodId, setPeriodId] = useState("day");
  const [aiLine, setAiLine] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [shareState, setShareState] = useState(null);

  const period = PERIODS.find((p) => p.id === periodId);

  const stats = useMemo(() => {
    const priceById = Object.fromEntries(products.map((p) => [p.id, p.price]));
    const since = dateNDaysAgo(period.days - 1);
    const prevSince = dateNDaysAgo(period.days * 2 - 1);
    const prevUntil = dateNDaysAgo(period.days);

    const inRange = (dateStr, from, to) => dateStr >= from && (to ? dateStr <= to : true);

    const curSales = sales.filter((s) => inRange(s.sale_date, since));
    const prevSales = sales.filter((s) => inRange(s.sale_date, prevSince, prevUntil));
    const curExpenses = expenses.filter((e) => inRange(e.expense_date, since));
    const prevExpenses = expenses.filter((e) => inRange(e.expense_date, prevSince, prevUntil));

    const revenueOf = (list) => list.reduce((sum, s) => sum + (priceById[s.product_id] ?? 0) * s.quantity, 0);
    const expenseOf = (list) => list.reduce((sum, e) => sum + Number(e.amount), 0);

    const revenue = revenueOf(curSales);
    const prevRevenue = revenueOf(prevSales);
    const expenseTotal = expenseOf(curExpenses);
    const prevExpenseTotal = expenseOf(prevExpenses);
    const profit = revenue - expenseTotal;
    const prevProfit = prevRevenue - prevExpenseTotal;

    const salesCount = curSales.reduce((n, s) => n + s.quantity, 0);

    const byCategory = (list) => {
      const m = {};
      for (const e of list) m[e.category] = (m[e.category] ?? 0) + Number(e.amount);
      return m;
    };
    const curByCat = byCategory(curExpenses);
    const prevByCat = byCategory(prevExpenses);
    const categoryChanges = Object.keys(curByCat)
      .map((cat) => ({ cat, current: curByCat[cat], pct: pctLabel(curByCat[cat], prevByCat[cat] ?? 0) }))
      .filter((c) => c.pct);

    const nameById = Object.fromEntries(products.map((p) => [p.id, p.name]));
    const qtyByProduct = {};
    for (const s of curSales) qtyByProduct[s.product_id] = (qtyByProduct[s.product_id] ?? 0) + s.quantity;
    const topProduct = Object.entries(qtyByProduct).sort((a, b) => b[1] - a[1])[0];

    return {
      revenue, expenseTotal, profit, salesCount,
      revenuePct: pctLabel(revenue, prevRevenue),
      expensePct: pctLabel(expenseTotal, prevExpenseTotal),
      profitPct: pctLabel(profit, prevProfit),
      categoryChanges,
      topProductName: topProduct ? nameById[topProduct[0]] ?? "Produit supprimé" : null,
      topProductQty: topProduct ? topProduct[1] : 0,
    };
  }, [products, sales, expenses, period]);

  const receiptText = useMemo(() => {
    const lines = [];
    lines.push(`📊 Reçu Margitrack — ${restaurantName}`);
    lines.push(`Période : ${period.label}`);
    lines.push("");
    lines.push(`Chiffre d'affaires : ${fcfa(stats.revenue)}${stats.revenuePct ? ` (${stats.revenuePct})` : ""}`);
    lines.push(`Dépenses : ${fcfa(stats.expenseTotal)}${stats.expensePct ? ` (${stats.expensePct})` : ""}`);
    lines.push(`Bénéfice : ${fcfa(stats.profit)}${stats.profitPct ? ` (${stats.profitPct})` : ""}`);
    lines.push(`Ventes : ${stats.salesCount} article(s)`);
    if (stats.topProductName) lines.push(`Produit le plus vendu : ${stats.topProductName} (${stats.topProductQty})`);
    if (stats.categoryChanges.length > 0) {
      lines.push("");
      for (const c of stats.categoryChanges) {
        lines.push(`${c.cat} : ${fcfa(c.current)} (${c.pct})`);
      }
    }
    if (aiLine) {
      lines.push("");
      lines.push("✨ Analyse Margitrack");
      lines.push(aiLine);
    }
    lines.push("");
    lines.push("Généré par Margitrack");
    return lines.join("\n");
  }, [stats, period, restaurantName, aiLine, fcfa]);

  const generateAiLine = async () => {
    setAiLoading(true);
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData?.session?.access_token;
      const body = await callEdgeFunction("ai-report", { token, body: { restaurant_id: restaurantId, period: period.aiPeriod } });
      const short = body.content.split("\n").filter(Boolean).slice(0, 3).join(" ");
      setAiLine(short);
    } catch (err) {
      setAiLine(`Analyse indisponible (${err.message}).`);
    } finally { setAiLoading(false); }
  };

  const download = () => {
    const blob = new Blob([receiptText], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `margitrack-recu-${period.id}-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setShareState("downloaded");
  };

  const share = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `Reçu Margitrack — ${restaurantName}`, text: receiptText });
        setShareState("shared");
      } catch (err) {
        if (err.name !== "AbortError") setShareState(`Partage impossible : ${err.message}`);
      }
    } else {
      try {
        await navigator.clipboard.writeText(receiptText);
        setShareState("copied");
      } catch {
        setShareState("Copie impossible sur cet appareil — utilisez Télécharger.");
      }
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center bg-black/40" onClick={onClose}>
      <div className="w-full sm:max-w-md sm:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto p-4" style={{ backgroundColor: palette.card }} onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold" style={{ color: palette.ink }}>Reçu de performance</p>
          <button onClick={onClose} className="text-gray-400 text-xl leading-none px-2">×</button>
        </div>

        <div className="flex gap-2 mb-3 flex-wrap">
          {PERIODS.map((p) => (
            <button key={p.id} onClick={() => { setPeriodId(p.id); setAiLine(null); }} className={`rounded-full text-xs font-medium px-3 py-1.5 ${periodId === p.id ? "bg-[#7C5CFF] text-white" : "bg-[#1B1F2E] text-gray-400"}`}>
              {p.label}
            </button>
          ))}
        </div>

        <pre className="whitespace-pre-wrap text-sm rounded-2xl p-4 leading-relaxed font-sans" style={{ backgroundColor: palette.bg, color: palette.ink }}>{receiptText}</pre>

        {!aiLine && (
          <button onClick={generateAiLine} disabled={aiLoading} className="mt-3 w-full rounded-xl bg-[#7C5CFF]/15 text-[#A78BFA] text-sm font-medium py-2.5 disabled:opacity-50">
            {aiLoading ? "Analyse en cours..." : "✨ Ajouter l'analyse Margitrack"}
          </button>
        )}

        <div className="grid grid-cols-2 gap-2 mt-4">
          <button onClick={download} className="rounded-xl border border-[#2A2F45] text-gray-300 text-sm font-medium py-2.5">Télécharger</button>
          <button onClick={share} className="rounded-xl bg-[#7C5CFF] text-white text-sm font-medium py-2.5">Partager</button>
        </div>

        {shareState === "shared" && <p className="text-xs text-emerald-600 mt-2 text-center">Partagé.</p>}
        {shareState === "downloaded" && <p className="text-xs text-emerald-600 mt-2 text-center">Téléchargé.</p>}
        {shareState === "copied" && <p className="text-xs text-emerald-600 mt-2 text-center">Copié — collez-le dans WhatsApp, SMS ou un autre message.</p>}
        {shareState && !["shared", "downloaded", "copied"].includes(shareState) && <p className="text-xs text-rose-600 mt-2 text-center">{shareState}</p>}
      </div>
    </div>
  );
}
