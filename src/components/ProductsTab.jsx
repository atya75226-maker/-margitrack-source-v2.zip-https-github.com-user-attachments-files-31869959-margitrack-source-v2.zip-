import React, { useState } from "react";
import { usePreferences } from "../contexts/PreferencesContext";

export function ProductsTab({ products, onAdd, onDelete, canEdit }) {
  const { palette, formatMoney, t } = usePreferences();
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setFormError(null);
    const parsedPrice = Number(price);
    if (!name.trim() || !parsedPrice || parsedPrice <= 0) { setFormError(t("name_price_required")); return; }
    setSaving(true);
    try {
      await onAdd({ name: name.trim(), price: parsedPrice });
      setName(""); setPrice("");
    } catch (err) {
      setFormError(err.message || "Impossible d'ajouter ce produit.");
    } finally { setSaving(false); }
  };

  const card = { backgroundColor: palette.card, border: `1px solid ${palette.line}` };
  const input = { backgroundColor: palette.elevated, borderColor: palette.line, color: palette.ink };

  return (
    <div className="space-y-4">
      {canEdit && (
        <form onSubmit={submit} className="rounded-2xl shadow-sm p-4 space-y-3" style={card}>
          <p className="text-sm font-semibold" style={{ color: palette.ink }}>{t("add_product")}</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("product_name")}
            className="w-full rounded-xl border px-3 py-2 text-sm" style={input} />
          <input value={price} onChange={(e) => setPrice(e.target.value)} type="text" inputMode="decimal" placeholder={t("price")}
            className="w-full rounded-xl border px-3 py-2 text-sm" style={input} />
          {formError && <p className="text-xs text-rose-500">{formError}</p>}
          <button type="submit" disabled={saving} className="w-full rounded-xl text-white text-sm font-medium py-2.5 disabled:opacity-50" style={{ backgroundColor: "#7C5CFF" }}>{saving ? t("adding") : t("add")}</button>
        </form>
      )}
      <div className="space-y-2">
        {products.map((p) => (
          <div key={p.id} className="rounded-xl shadow-sm p-3 flex items-center justify-between" style={card}>
            <div>
              <p className="text-sm font-medium" style={{ color: palette.ink }}>{p.name}</p>
              <p className="text-xs" style={{ color: palette.muted }}>{formatMoney(p.price)}</p>
            </div>
            {canEdit && (<button onClick={() => onDelete(p)} className="text-xs text-rose-500 font-medium px-3 py-1.5 rounded-lg">{t("delete")}</button>)}
          </div>
        ))}
        {products.length === 0 && <p className="text-sm text-center py-8" style={{ color: palette.muted }}>{t("no_products")}</p>}
      </div>
    </div>
  );
}
