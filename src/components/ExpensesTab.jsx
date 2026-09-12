import React, { useState } from "react";
import { usePreferences } from "../contexts/PreferencesContext";

const CATEGORIES = ["Achat de marchandises", "Livraison", "Publicité", "Salaires", "Loyer", "Électricité", "Eau", "Transport", "Autre"];

function todayStr() { return new Date().toISOString().slice(0, 10); }

export function ExpensesTab({ expenses, onAdd, onDelete, canEdit }) {
  const { palette, formatMoney, t } = usePreferences();
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    const parsedAmount = Number(amount);
    if (!parsedAmount || parsedAmount <= 0) { setError(t("invalid_amount")); return; }
    setSaving(true);
    try {
      await onAdd({ category, amount: parsedAmount, date: todayStr(), description: description.trim() || undefined });
      setAmount(""); setDescription("");
    } catch (err) {
      setError(err.message || "Impossible d'ajouter cette dépense.");
    } finally { setSaving(false); }
  };

  const card = { backgroundColor: palette.card, border: `1px solid ${palette.line}` };
  const input = { backgroundColor: palette.elevated, borderColor: palette.line, color: palette.ink };

  return (
    <div className="space-y-4">
      {canEdit && (
        <form onSubmit={submit} className="rounded-2xl shadow-sm p-4 space-y-3" style={card}>
          <p className="text-sm font-semibold" style={{ color: palette.ink }}>{t("add_expense")}</p>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm" style={input}>
            {CATEGORIES.map((c) => (<option key={c} value={c}>{c}</option>))}
          </select>
          <input value={amount} onChange={(e) => setAmount(e.target.value)} type="text" inputMode="decimal" placeholder={t("amount")}
            className="w-full rounded-xl border px-3 py-2 text-sm" style={input} />
          <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder={t("note_optional")}
            className="w-full rounded-xl border px-3 py-2 text-sm" style={input} />
          {error && <p className="text-xs text-rose-500">{error}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-xl text-white text-sm font-medium py-2.5 disabled:opacity-50" style={{ backgroundColor: "#7C5CFF" }}>{saving ? t("adding") : t("add")}</button>
        </form>
      )}
      <div className="space-y-2">
        {expenses.map((ex) => (
          <div key={ex.id} className="rounded-xl shadow-sm p-3 flex items-center justify-between" style={card}>
            <div>
              <p className="text-sm font-medium" style={{ color: palette.ink }}>{ex.category}</p>
              <p className="text-xs" style={{ color: palette.muted }}>{ex.expense_date}{ex.description ? ` — ${ex.description}` : ""}</p>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-rose-500">{formatMoney(ex.amount)}</span>
              {canEdit && (<button onClick={() => onDelete(ex)} className="text-xs text-rose-500">{t("delete")}</button>)}
            </div>
          </div>
        ))}
        {expenses.length === 0 && <p className="text-sm text-center py-8" style={{ color: palette.muted }}>{t("no_expenses")}</p>}
      </div>
    </div>
  );
}
