import React, { useState, useMemo } from "react";
import { usePreferences } from "../contexts/PreferencesContext";

function todayStr() { return new Date().toISOString().slice(0, 10); }

export function SalesTab({ products, sales, onAddBatch, onDelete, canDelete }) {
  const { palette, formatMoney, t } = usePreferences();
  const [cart, setCart] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const addToCart = (productId) => setCart((c) => ({ ...c, [productId]: (c[productId] ?? 0) + 1 }));
  const removeFromCart = (productId) => setCart((c) => { const next = { ...c }; if (next[productId] > 1) next[productId] -= 1; else delete next[productId]; return next; });

  const priceById = useMemo(() => Object.fromEntries(products.map((p) => [p.id, p.price])), [products]);
  const cartTotal = Object.entries(cart).reduce((sum, [id, qty]) => sum + (priceById[id] ?? 0) * qty, 0);
  const cartCount = Object.values(cart).reduce((a, b) => a + b, 0);

  const validateSale = async () => {
    setError(null); setSaving(true);
    try {
      const items = Object.entries(cart).map(([productId, quantity]) => ({ productId, quantity, date: todayStr() }));
      await onAddBatch(items);
      setCart({});
    } catch (err) {
      setError(err.message || "Impossible d'enregistrer la vente.");
    } finally { setSaving(false); }
  };

  const todaySales = sales.filter((s) => s.sale_date === todayStr());
  const card = { backgroundColor: palette.card, border: `1px solid ${palette.line}` };

  return (
    <div className="space-y-4 pb-24">
      <div className="grid grid-cols-2 gap-2">
        {products.map((p) => (
          <button key={p.id} onClick={() => addToCart(p.id)} className="rounded-xl shadow-sm p-3 text-left active:scale-95 transition" style={card}>
            <p className="text-sm font-medium" style={{ color: palette.ink }}>{p.name}</p>
            <p className="text-xs" style={{ color: palette.muted }}>{formatMoney(p.price)}</p>
            {cart[p.id] > 0 && (
              <span onClick={(e) => { e.stopPropagation(); removeFromCart(p.id); }}
                className="inline-flex items-center gap-1 mt-1 text-xs font-bold rounded-full px-2 py-0.5"
                style={{ color: "#7C5CFF", backgroundColor: "rgba(124,92,255,0.2)" }} title={t("tap_to_remove")}>
                × {cart[p.id]} <span className="opacity-60">−</span>
              </span>
            )}
          </button>
        ))}
        {products.length === 0 && (<p className="col-span-2 text-sm text-center py-8" style={{ color: palette.muted }}>{t("add_products_first_short")}</p>)}
      </div>

      <div>
        <p className="text-sm font-semibold mb-2" style={{ color: palette.ink }}>{t("sales_today_title")}</p>
        <div className="space-y-2">
          {todaySales.map((s) => (
            <div key={s.id} className="rounded-xl shadow-sm p-3 flex items-center justify-between" style={card}>
              <p className="text-sm" style={{ color: palette.ink }}>{products.find((p) => p.id === s.product_id)?.name ?? "Produit supprimé"} × {s.quantity}</p>
              {canDelete && (<button onClick={() => onDelete(s)} className="text-xs text-rose-500">{t("remove")}</button>)}
            </div>
          ))}
          {todaySales.length === 0 && <p className="text-xs" style={{ color: palette.muted }}>{t("no_sales_today")}</p>}
        </div>
      </div>

      {cartCount > 0 && (
        <div className="fixed bottom-16 left-0 right-0 px-4">
          <div className="rounded-2xl text-white shadow-lg p-4" style={{ backgroundColor: "#7C5CFF" }}>
            {error && <p className="text-xs text-rose-100 mb-2">{error}</p>}
            <div className="flex items-center justify-between mb-3"><span className="text-sm">{cartCount} {t("items")}</span><span className="font-bold">{formatMoney(cartTotal)}</span></div>
            <button onClick={validateSale} disabled={saving} className="w-full rounded-xl font-semibold py-2.5 disabled:opacity-50" style={{ backgroundColor: palette.card, color: "#7C5CFF" }}>{saving ? t("saving") : t("validate_sale")}</button>
          </div>
        </div>
      )}
    </div>
  );
}
