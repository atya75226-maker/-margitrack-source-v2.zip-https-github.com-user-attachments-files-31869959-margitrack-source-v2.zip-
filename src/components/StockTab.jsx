import React, { useMemo, useState } from "react";
import { usePreferences } from "../contexts/PreferencesContext";
import {
  BASE_UNITS,
  PURCHASE_UNITS,
  MOVEMENT_KINDS,
  PARTIAL_FRACTIONS,
} from "../hooks/useStock";
import { StockItemDetail } from "./StockItemDetail";

const emptyItem = {
  name: "",
  kind: "boisson",
  baseUnit: "bouteille",
  purchaseUnit: "casier",
  unitsPerPurchase: "12",
  unitCost: "",
  unitPrice: "",
  lowStockThreshold: "",
  supplier: "",
};

export function StockTab({ stock, products = [], canEdit }) {
  const { palette, formatMoney } = usePreferences();
  const { items, movements, links, stats, loading, addItem, deleteItem, addMovement, recordPurchase } =
    stock;

  const [tab, setTab] = useState("boisson");
  const [form, setForm] = useState(emptyItem);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const [detailItemId, setDetailItemId] = useState(null);
  const [moveItemId, setMoveItemId] = useState(null);
  const today = new Date().toISOString().slice(0, 10);
  const emptyMove = {
    kind: "achat",
    quantity: "",
    inPurchaseUnit: true,
    totalCost: "",
    supplier: "",
    date: today,
  };
  const [move, setMove] = useState(emptyMove);

  const card = { backgroundColor: palette.card, border: `1px solid ${palette.line}` };
  const input = { backgroundColor: palette.elevated, borderColor: palette.line, color: palette.ink };

  const visible = useMemo(() => items.filter((i) => i.kind === tab), [items, tab]);
  const moveItem = items.find((i) => i.id === moveItemId);

  const submitItem = async (e) => {
    e.preventDefault();
    setError(null);
    if (!form.name.trim()) {
      setError("Le nom de l'article est requis.");
      return;
    }
    setSaving(true);
    try {
      await addItem({ ...form, name: form.name.trim(), kind: tab });
      setForm(emptyItem);
      setShowForm(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const submitMove = async (e) => {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      if (move.kind === "achat") {
        await recordPurchase({
          itemId: moveItemId,
          quantity: move.quantity,
          inPurchaseUnit: move.inPurchaseUnit,
          totalCost: move.totalCost,
          supplier: move.supplier,
          date: move.date || today,
        });
      } else {
        await addMovement({
          itemId: moveItemId,
          kind: move.kind,
          quantity: move.quantity,
          inPurchaseUnit: move.inPurchaseUnit,
          totalCost: null,
          date: move.date || today,
        });
      }
      setMoveItemId(null);
      setMove(emptyMove);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const levelOf = (item) => {
    const qty = Number(item.quantity);
    if (qty <= 0) return { label: "Rupture", color: "#F43F5E" };
    const threshold = Number(item.low_stock_threshold);
    if (threshold > 0 && qty <= threshold) return { label: "Bientôt épuisé", color: "#F59E08" };
    return { label: "En stock", color: "#10B981" };
  };

  if (loading) {
    return (
      <p className="text-sm text-center py-8" style={{ color: palette.muted }}>
        Chargement du stock...
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {/* Valeur du stock */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4" style={card}>
          <p className="text-xs" style={{ color: palette.muted }}>Valeur boissons</p>
          <p className="text-lg font-bold font-display mt-1" style={{ color: palette.ink }}>
            {formatMoney(stats.drinksValue)}
          </p>
        </div>
        <div className="rounded-2xl p-4" style={card}>
          <p className="text-xs" style={{ color: palette.muted }}>Valeur ingrédients</p>
          <p className="text-lg font-bold font-display mt-1" style={{ color: palette.ink }}>
            {formatMoney(stats.ingredientsValue)}
          </p>
        </div>
      </div>

      {/* Alertes */}
      {(stats.outOfStock.length > 0 || stats.lowStock.length > 0) && (
        <div className="rounded-2xl p-4 space-y-1.5" style={{ backgroundColor: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.3)" }}>
          <p className="text-sm font-semibold" style={{ color: "#F43F5E" }}>
            ⚠️ Réapprovisionnement nécessaire
          </p>
          {stats.outOfStock.map((i) => (
            <p key={i.id} className="text-xs" style={{ color: palette.ink }}>
              {i.name} — en rupture
            </p>
          ))}
          {stats.lowStock.map((i) => (
            <p key={i.id} className="text-xs" style={{ color: palette.ink }}>
              {i.name} — {Number(i.quantity)} {i.base_unit} restant(s)
            </p>
          ))}
        </div>
      )}

      {/* Onglets boissons / ingrédients */}
      <div className="grid grid-cols-2 gap-2">
        {[
          { id: "boisson", label: "🥤 Boissons" },
          { id: "ingredient", label: "🥘 Ingrédients" },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="rounded-xl text-sm font-medium py-2.5 border transition"
            style={
              tab === t.id
                ? { backgroundColor: "#7C5CFF", color: "#FFFFFF", borderColor: "#7C5CFF" }
                : { backgroundColor: palette.elevated, color: palette.ink, borderColor: palette.line }
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-rose-500">{error}</p>}

      {/* Ajout d'article */}
      {canEdit && !showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full rounded-xl text-white text-sm font-medium py-2.5"
          style={{ backgroundColor: "#7C5CFF" }}
        >
          Ajouter un article
        </button>
      )}

      {canEdit && showForm && (
        <form onSubmit={submitItem} className="rounded-2xl p-4 space-y-3" style={card}>
          <p className="text-sm font-semibold" style={{ color: palette.ink }}>
            Nouvel article — {tab === "boisson" ? "boisson" : "ingrédient"}
          </p>
          <input
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder={tab === "boisson" ? "Nom (ex : Coca-Cola)" : "Nom (ex : Riz)"}
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={input}
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs" style={{ color: palette.muted }}>Unité de comptage</label>
              <select
                value={form.baseUnit}
                onChange={(e) => setForm((f) => ({ ...f, baseUnit: e.target.value }))}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                style={input}
              >
                {BASE_UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
              </select>
            </div>
            <div>
              <label className="text-xs" style={{ color: palette.muted }}>Unité d'achat</label>
              <select
                value={form.purchaseUnit}
                onChange={(e) => setForm((f) => ({ ...f, purchaseUnit: e.target.value }))}
                className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
                style={input}
              >
                {PURCHASE_UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs" style={{ color: palette.muted }}>
              Conversion : 1 {form.purchaseUnit} = ? {form.baseUnit}
            </label>
            <input
              value={form.unitsPerPurchase}
              onChange={(e) => setForm((f) => ({ ...f, unitsPerPurchase: e.target.value }))}
              type="text"
              inputMode="decimal"
              className="mt-1 w-full rounded-xl border px-3 py-2 text-sm"
              style={input}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input
              value={form.unitPrice}
              onChange={(e) => setForm((f) => ({ ...f, unitPrice: e.target.value }))}
              type="text"
              inputMode="decimal"
              placeholder={`Prix de vente / ${form.baseUnit}`}
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={input}
            />
            <input
              value={form.lowStockThreshold}
              onChange={(e) => setForm((f) => ({ ...f, lowStockThreshold: e.target.value }))}
              type="text"
              inputMode="decimal"
              placeholder="Seuil d'alerte"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              style={input}
            />
          </div>

          <input
            value={form.supplier}
            onChange={(e) => setForm((f) => ({ ...f, supplier: e.target.value }))}
            placeholder="Fournisseur (facultatif)"
            className="w-full rounded-xl border px-3 py-2 text-sm"
            style={input}
          />

          <p className="text-xs" style={{ color: palette.muted }}>
            Le coût d'achat se calcule automatiquement à partir de vos achats réels.
          </p>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 rounded-xl text-white text-sm font-medium py-2.5 disabled:opacity-50"
              style={{ backgroundColor: "#7C5CFF" }}
            >
              {saving ? "Ajout..." : "Ajouter"}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(emptyItem); }}
              className="flex-1 rounded-xl border text-sm font-medium py-2.5"
              style={{ borderColor: palette.line, color: palette.ink }}
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      {/* Liste */}
      <div className="space-y-2">
        {visible.map((item) => {
          const level = levelOf(item);
          const inPurchase = Number(item.units_per_purchase) > 1;
          const linkCount = links.filter((l) => l.stock_item_id === item.id).length;
          return (
            <div key={item.id} className="rounded-xl p-3" style={card}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate" style={{ color: palette.ink }}>
                      {item.name}
                    </p>
                    <span
                      className="text-[10px] font-semibold rounded-full px-2 py-0.5 shrink-0"
                      style={{ color: level.color, backgroundColor: `${level.color}22` }}
                    >
                      {level.label}
                    </span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: palette.muted }}>
                    {Number(item.quantity).toLocaleString("fr-FR")} {item.base_unit}
                    {inPurchase && (
                      <> · {(Number(item.quantity) / Number(item.units_per_purchase)).toFixed(1)} {item.purchase_unit}</>
                    )}
                  </p>
                  <p className="text-xs" style={{ color: palette.muted }}>
                    Coût moyen {formatMoney(item.unit_cost)} / {item.base_unit} · Valeur{" "}
                    {formatMoney(Math.max(Number(item.quantity), 0) * Number(item.unit_cost))}
                  </p>
                  {item.unit_price != null && (
                    <p className="text-xs" style={{ color: palette.muted }}>
                      Vente {formatMoney(item.unit_price)} · Bénéfice{" "}
                      <span
                        style={{
                          color:
                            Number(item.unit_price) - Number(item.unit_cost) >= 0
                              ? "#10B981"
                              : "#F43F5E",
                        }}
                      >
                        {formatMoney(Number(item.unit_price) - Number(item.unit_cost))}
                      </span>{" "}
                      / {item.base_unit}
                    </p>
                  )}
                  {item.supplier && (
                    <p className="text-xs" style={{ color: palette.muted }}>
                      Fournisseur : {item.supplier}
                    </p>
                  )}
                  {linkCount === 0 && (
                    <p className="text-xs" style={{ color: "#F59E08" }}>
                      Aucun produit relié — les ventes ne déduisent pas ce stock.
                    </p>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  <button
                    onClick={() => {
                      setDetailItemId((id) => (id === item.id ? null : item.id));
                      setError(null);
                    }}
                    className="text-xs font-medium"
                    style={{ color: palette.muted }}
                  >
                    {detailItemId === item.id ? "Masquer" : "Détails"}
                  </button>
                  {canEdit && (
                    <>
                      <button
                        onClick={() => { setMoveItemId(item.id); setError(null); }}
                        className="text-xs font-medium"
                        style={{ color: "#7C5CFF" }}
                      >
                        Mouvement
                      </button>
                      <button
                        onClick={() => deleteItem(item.id).catch((e) => setError(e.message))}
                        className="text-xs text-rose-500"
                      >
                        Supprimer
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Formulaire de mouvement */}
              {moveItemId === item.id && (
                <form onSubmit={submitMove} className="mt-3 pt-3 space-y-2" style={{ borderTop: `1px solid ${palette.line}` }}>
                  <select
                    value={move.kind}
                    onChange={(e) => setMove((m) => ({ ...m, kind: e.target.value }))}
                    className="w-full rounded-lg border px-2.5 py-2 text-sm"
                    style={input}
                  >
                    {MOVEMENT_KINDS.map((k) => (<option key={k.id} value={k.id}>{k.label}</option>))}
                  </select>

                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={move.quantity}
                      onChange={(e) => setMove((m) => ({ ...m, quantity: e.target.value }))}
                      type="text"
                      inputMode="decimal"
                      placeholder="Quantité"
                      className="w-full rounded-lg border px-2.5 py-2 text-sm"
                      style={input}
                    />
                    <select
                      value={move.inPurchaseUnit ? "purchase" : "base"}
                      onChange={(e) => setMove((m) => ({ ...m, inPurchaseUnit: e.target.value === "purchase" }))}
                      className="w-full rounded-lg border px-2.5 py-2 text-sm"
                      style={input}
                    >
                      <option value="base">en {item.base_unit}</option>
                      {inPurchase && <option value="purchase">en {item.purchase_unit}</option>}
                    </select>
                  </div>

                  {move.kind === "ajustement" && (
                    <p className="text-[11px]" style={{ color: palette.muted }}>
                      Saisissez une quantité négative pour corriger le stock à la baisse.
                    </p>
                  )}

                  {/* Quantités partielles pour les ingrédients */}
                  {item.kind === "ingredient" && move.kind !== "achat" && (
                    <div className="flex gap-1.5 flex-wrap">
                      {PARTIAL_FRACTIONS.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() =>
                            setMove((m) => ({
                              ...m,
                              inPurchaseUnit: false,
                              quantity: String(Number(item.quantity) * f),
                            }))
                          }
                          className="text-[11px] rounded-full px-2.5 py-1"
                          style={{ backgroundColor: palette.elevated, color: palette.muted }}
                        >
                          {f * 100} % du stock
                        </button>
                      ))}
                    </div>
                  )}

                  <div>
                    <label className="text-[11px]" style={{ color: palette.muted }}>
                      {move.kind === "achat" ? "Date d'achat" : "Date du mouvement"}
                    </label>
                    <input
                      value={move.date}
                      onChange={(e) => setMove((m) => ({ ...m, date: e.target.value }))}
                      type="date"
                      className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm"
                      style={input}
                    />
                  </div>

                  {move.kind === "achat" && (
                    <>
                      <input
                        value={move.totalCost}
                        onChange={(e) => setMove((m) => ({ ...m, totalCost: e.target.value }))}
                        type="text"
                        inputMode="decimal"
                        placeholder="Montant total payé"
                        className="w-full rounded-lg border px-2.5 py-2 text-sm"
                        style={input}
                      />
                      <input
                        value={move.supplier}
                        onChange={(e) => setMove((m) => ({ ...m, supplier: e.target.value }))}
                        placeholder="Fournisseur (facultatif)"
                        className="w-full rounded-lg border px-2.5 py-2 text-sm"
                        style={input}
                      />
                      <p className="text-[11px]" style={{ color: palette.muted }}>
                        L'achat crée automatiquement la dépense correspondante — ne la saisissez pas une seconde fois.
                      </p>
                    </>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="submit"
                      disabled={saving}
                      className="flex-1 rounded-lg text-white text-xs font-semibold py-2 disabled:opacity-50"
                      style={{ backgroundColor: "#7C5CFF" }}
                    >
                      {saving ? "Enregistrement..." : "Valider"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMoveItemId(null)}
                      className="flex-1 rounded-lg border text-xs font-medium py-2"
                      style={{ borderColor: palette.line, color: palette.ink }}
                    >
                      Annuler
                    </button>
                  </div>
                </form>
              )}

              {detailItemId === item.id && (
                <StockItemDetail
                  item={item}
                  stock={stock}
                  products={products}
                  canEdit={canEdit}
                />
              )}
            </div>
          );
        })}

        {visible.length === 0 && (
          <p className="text-sm text-center py-8" style={{ color: palette.muted }}>
            Aucun article dans cette catégorie.
          </p>
        )}
      </div>

      {/* Derniers mouvements */}
      {movements.length > 0 && (
        <div className="rounded-2xl p-4" style={card}>
          <p className="text-sm font-semibold mb-2" style={{ color: palette.ink }}>
            Derniers mouvements
          </p>
          <div className="space-y-1.5">
            {movements.slice(0, 8).map((m) => {
              const item = items.find((i) => i.id === m.stock_item_id);
              const positive = Number(m.quantity) > 0;
              return (
                <div key={m.id} className="flex items-center justify-between text-xs">
                  <span style={{ color: palette.muted }}>
                    {m.movement_date} · {item?.name ?? "Article supprimé"} · {m.kind}
                  </span>
                  <span
                    className="font-semibold"
                    style={{ color: positive ? "#10B981" : "#F43F5E" }}
                  >
                    {positive ? "+" : ""}
                    {Number(m.quantity).toLocaleString("fr-FR")}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
