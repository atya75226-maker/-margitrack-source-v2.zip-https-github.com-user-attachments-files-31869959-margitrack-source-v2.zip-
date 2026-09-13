import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePreferences } from "../contexts/PreferencesContext";
import { BASE_UNITS, PURCHASE_UNITS } from "../hooks/useStock";

const MOVEMENT_LABELS = {
  achat: "Achat",
  vente: "Vente",
  consommation: "Consommation",
  perte: "Perte",
  ajustement: "Ajustement",
};

const PAGE_SIZE = 20;

/**
 * Panneau de détail d'un article de stock : produits reliés, historique
 * paginé, inventaire et fiche modifiable.
 *
 * Le bloc « produits reliés » est la pièce qui rend la déduction automatique
 * possible : sans lien product_stock_links, le déclencheur Supabase
 * consume_stock_on_sale n'a rien à décrémenter lors d'une vente.
 */
export function StockItemDetail({ item, stock, products, canEdit }) {
  const { palette, formatMoney } = usePreferences();
  const { links, addLink, removeLink, updateItem, deleteMovement, setStockLevel, fetchMovementPage } =
    stock;

  const [section, setSection] = useState("liens");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const [linkForm, setLinkForm] = useState({ productId: "", quantityPerSale: "1" });
  // Annuler un mouvement supprime aussi la dépense d'un achat : on demande
  // une confirmation en deux temps plutôt qu'un clic isolé.
  const [confirmId, setConfirmId] = useState(null);

  const inPurchaseAvailable = Number(item.units_per_purchase) > 1 && Boolean(item.purchase_unit);
  const [count, setCount] = useState({
    quantity: "",
    inPurchaseUnit: inPurchaseAvailable,
    unitCost: "",
  });

  const [edit, setEdit] = useState({
    base_unit: item.base_unit,
    purchase_unit: item.purchase_unit ?? "",
    units_per_purchase: String(item.units_per_purchase ?? 1),
    unit_price: item.unit_price == null ? "" : String(item.unit_price),
    low_stock_threshold: String(item.low_stock_threshold ?? 0),
    supplier: item.supplier ?? "",
  });

  const input = { backgroundColor: palette.elevated, borderColor: palette.line, color: palette.ink };

  const itemLinks = useMemo(
    () => links.filter((l) => l.stock_item_id === item.id),
    [links, item.id]
  );

  // Un produit déjà relié à cet article ne doit pas être proposé deux fois :
  // la base refuse le doublon (contrainte unique produit + article).
  const available = useMemo(
    () => products.filter((p) => !itemLinks.some((l) => l.product_id === p.id)),
    [products, itemLinks]
  );

  // ---- Historique paginé -------------------------------------------------
  // Chargé à la demande, page par page, plutôt que depuis la fenêtre de
  // 90 jours gardée en mémoire pour les écrans de synthèse : l'historique
  // complet d'un article reste consultable, même ancien.
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyDone, setHistoryDone] = useState(false);
  const [historyKey, setHistoryKey] = useState(0);

  useEffect(() => {
    if (section !== "historique") return undefined;
    let cancelled = false;
    setHistoryLoading(true);
    fetchMovementPage(item.id, { limit: PAGE_SIZE })
      .then((rows) => {
        if (cancelled) return;
        setHistory(rows);
        setHistoryDone(rows.length < PAGE_SIZE);
      })
      .catch((err) => { if (!cancelled) setError(err.message); })
      .finally(() => { if (!cancelled) setHistoryLoading(false); });
    return () => { cancelled = true; };
  }, [section, item.id, fetchMovementPage, historyKey]);

  const loadMore = useCallback(async () => {
    const last = history[history.length - 1];
    setHistoryLoading(true);
    try {
      const rows = await fetchMovementPage(item.id, {
        limit: PAGE_SIZE,
        beforeSeq: last?.seq ?? null,
      });
      setHistory((current) => [...current, ...rows]);
      setHistoryDone(rows.length < PAGE_SIZE);
    } catch (err) {
      setError(err.message);
    } finally {
      setHistoryLoading(false);
    }
  }, [fetchMovementPage, history, item.id]);

  // ---- Actions -----------------------------------------------------------
  const submitLink = async (e) => {
    e.preventDefault();
    setError(null);
    if (!linkForm.productId) {
      setError("Choisissez le produit vendu.");
      return;
    }
    setBusy(true);
    try {
      await addLink({
        productId: linkForm.productId,
        stockItemId: item.id,
        quantityPerSale: linkForm.quantityPerSale,
      });
      setLinkForm({ productId: "", quantityPerSale: "1" });
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitCount = async (e) => {
    e.preventDefault();
    setError(null);
    if (count.quantity === "") {
      setError("Indiquez la quantité comptée.");
      return;
    }
    setBusy(true);
    try {
      await setStockLevel({
        item,
        quantity: count.quantity,
        inPurchaseUnit: count.inPurchaseUnit,
        unitCost: count.unitCost,
      });
      setCount({ quantity: "", inPurchaseUnit: inPurchaseAvailable, unitCost: "" });
      setHistoryKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const submitEdit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await updateItem(item.id, {
        base_unit: edit.base_unit,
        purchase_unit: edit.purchase_unit || null,
        units_per_purchase: Number(edit.units_per_purchase) || 1,
        unit_price: edit.unit_price === "" ? null : Number(edit.unit_price),
        low_stock_threshold: Number(edit.low_stock_threshold) || 0,
        supplier: edit.supplier || null,
      });
      setSection("liens");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const cancelMovement = async (id) => {
    setError(null);
    try {
      await deleteMovement(id);
      setHistoryKey((k) => k + 1);
    } catch (err) {
      // deleteMovement signale aussi le cas « mouvement annulé mais dépense
      // conservée » : on rafraîchit dans tous les cas.
      setError(err.message);
      setHistoryKey((k) => k + 1);
    } finally {
      setConfirmId(null);
    }
  };

  const tabs = [
    { id: "liens", label: `Ventes liées (${itemLinks.length})` },
    { id: "historique", label: "Historique" },
    ...(canEdit ? [{ id: "inventaire", label: "Inventaire" }] : []),
    ...(canEdit ? [{ id: "fiche", label: "Modifier" }] : []),
  ];

  // Aperçu de l'écart, pour que l'utilisateur voie ce qui sera enregistré.
  const countPreview = useMemo(() => {
    if (count.quantity === "") return null;
    const factor = count.inPurchaseUnit ? Number(item.units_per_purchase) || 1 : 1;
    const target = Number(count.quantity) * factor;
    if (!Number.isFinite(target) || target < 0) return null;
    return { target, delta: target - (Number(item.quantity) || 0) };
  }, [count, item.quantity, item.units_per_purchase]);

  return (
    <div className="mt-3 pt-3 space-y-3" style={{ borderTop: `1px solid ${palette.line}` }}>
      <div className="flex gap-1.5 flex-wrap">
        {tabs.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => { setSection(s.id); setError(null); }}
            className="text-[11px] rounded-full px-2.5 py-1 border"
            style={
              section === s.id
                ? { backgroundColor: "#7C5CFF", color: "#FFFFFF", borderColor: "#7C5CFF" }
                : { backgroundColor: palette.elevated, color: palette.muted, borderColor: palette.line }
            }
          >
            {s.label}
          </button>
        ))}
      </div>

      {error && <p className="text-xs text-rose-500">{error}</p>}

      {section === "liens" && (
        <div className="space-y-2">
          <p className="text-[11px]" style={{ color: palette.muted }}>
            Reliez ce stock aux produits de votre menu : chaque vente déduira
            automatiquement la quantité indiquée.
          </p>

          {itemLinks.map((l) => {
            const product = products.find((p) => p.id === l.product_id);
            return (
              <div
                key={l.id}
                className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2"
                style={{ backgroundColor: palette.elevated }}
              >
                <span className="text-xs min-w-0 truncate" style={{ color: palette.ink }}>
                  {product?.name ?? "Produit supprimé"}
                  <span style={{ color: palette.muted }}>
                    {" "}— {Number(l.quantity_per_sale).toLocaleString("fr-FR")} {item.base_unit} / vente
                  </span>
                </span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => removeLink(l.id).catch((err) => setError(err.message))}
                    className="text-[11px] text-rose-500 shrink-0"
                  >
                    Retirer
                  </button>
                )}
              </div>
            );
          })}

          {itemLinks.length === 0 && (
            <p className="text-xs" style={{ color: palette.muted }}>
              Aucun produit relié — les ventes ne diminuent pas encore ce stock.
            </p>
          )}

          {canEdit && available.length > 0 && (
            <form onSubmit={submitLink} className="space-y-2">
              <select
                value={linkForm.productId}
                onChange={(e) => setLinkForm((f) => ({ ...f, productId: e.target.value }))}
                className="w-full rounded-lg border px-2.5 py-2 text-sm"
                style={input}
              >
                <option value="">Produit vendu…</option>
                {available.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <input
                  value={linkForm.quantityPerSale}
                  onChange={(e) => setLinkForm((f) => ({ ...f, quantityPerSale: e.target.value }))}
                  type="text"
                  inputMode="decimal"
                  placeholder={`${item.base_unit} déduit(s) par vente`}
                  className="flex-1 rounded-lg border px-2.5 py-2 text-sm"
                  style={input}
                />
                <button
                  type="submit"
                  disabled={busy}
                  className="rounded-lg text-white text-xs font-semibold px-4 disabled:opacity-50"
                  style={{ backgroundColor: "#7C5CFF" }}
                >
                  Relier
                </button>
              </div>
              {inPurchaseAvailable && (
                <p className="text-[11px]" style={{ color: palette.muted }}>
                  Rappel : 1 {item.purchase_unit} = {Number(item.units_per_purchase)}{" "}
                  {item.base_unit}. Pour un produit vendu au {item.purchase_unit}, saisissez{" "}
                  {Number(item.units_per_purchase)}.
                </p>
              )}
            </form>
          )}
        </div>
      )}

      {section === "historique" && (
        <div className="space-y-1.5">
          {history.map((m) => {
            const positive = Number(m.quantity) > 0;
            const fromSale = Boolean(m.sale_id);
            return (
              <div key={m.id} className="flex items-start justify-between gap-2 text-xs">
                <span className="min-w-0" style={{ color: palette.muted }}>
                  {m.movement_date} · {MOVEMENT_LABELS[m.kind] ?? m.kind}
                  {m.note ? <span className="block truncate">{m.note}</span> : null}
                  {canEdit && !fromSale && (
                    confirmId === m.id ? (
                      <span className="block mt-0.5">
                        <button
                          type="button"
                          onClick={() => cancelMovement(m.id)}
                          className="text-rose-500 font-semibold"
                        >
                          Confirmer l'annulation
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="ml-3"
                          style={{ color: palette.muted }}
                        >
                          Non
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => { setConfirmId(m.id); setError(null); }}
                        className="block mt-0.5"
                        style={{ color: palette.muted, textDecoration: "underline" }}
                      >
                        {m.kind === "achat" ? "Annuler cet achat et sa dépense" : "Annuler ce mouvement"}
                      </button>
                    )
                  )}
                </span>
                <span className="shrink-0 text-right">
                  <span className="font-semibold" style={{ color: positive ? "#10B981" : "#F43F5E" }}>
                    {positive ? "+" : ""}
                    {Number(m.quantity).toLocaleString("fr-FR")} {item.base_unit}
                  </span>
                  {m.unit_cost != null && (
                    <span className="block" style={{ color: palette.muted }}>
                      {formatMoney(Math.abs(Number(m.quantity)) * Number(m.unit_cost))}
                    </span>
                  )}
                  {fromSale && (
                    <span className="block" style={{ color: palette.muted }}>
                      issu d'une vente
                    </span>
                  )}
                </span>
              </div>
            );
          })}

          {history.length === 0 && !historyLoading && (
            <p className="text-xs" style={{ color: palette.muted }}>
              Aucun mouvement enregistré sur cet article.
            </p>
          )}

          {historyLoading && (
            <p className="text-xs" style={{ color: palette.muted }}>Chargement…</p>
          )}

          {!historyDone && !historyLoading && history.length > 0 && (
            <button
              type="button"
              onClick={loadMore}
              className="w-full rounded-lg border text-xs font-medium py-2 mt-1"
              style={{ borderColor: palette.line, color: palette.ink }}
            >
              Charger les mouvements plus anciens
            </button>
          )}

          {historyDone && history.length >= PAGE_SIZE && (
            <p className="text-[11px] text-center pt-1" style={{ color: palette.muted }}>
              Début de l'historique.
            </p>
          )}
        </div>
      )}

      {section === "inventaire" && canEdit && (
        <form onSubmit={submitCount} className="space-y-2">
          <p className="text-[11px]" style={{ color: palette.muted }}>
            Comptez ce que vous avez réellement en réserve. L'écart avec le stock
            enregistré sera corrigé. Aucune dépense n'est créée : cette
            marchandise a déjà été payée.
          </p>

          <div className="flex gap-2">
            <input
              value={count.quantity}
              onChange={(e) => setCount((c) => ({ ...c, quantity: e.target.value }))}
              type="text"
              inputMode="decimal"
              placeholder="J'ai actuellement…"
              className="flex-1 rounded-lg border px-2.5 py-2 text-sm"
              style={input}
            />
            <select
              value={count.inPurchaseUnit ? "purchase" : "base"}
              onChange={(e) => setCount((c) => ({ ...c, inPurchaseUnit: e.target.value === "purchase" }))}
              className="rounded-lg border px-2.5 py-2 text-sm"
              style={input}
            >
              <option value="base">{item.base_unit}</option>
              {inPurchaseAvailable && <option value="purchase">{item.purchase_unit}</option>}
            </select>
          </div>

          <input
            value={count.unitCost}
            onChange={(e) => setCount((c) => ({ ...c, unitCost: e.target.value }))}
            type="text"
            inputMode="decimal"
            placeholder={`Coût d'achat par ${count.inPurchaseUnit ? item.purchase_unit : item.base_unit} (facultatif)`}
            className="w-full rounded-lg border px-2.5 py-2 text-sm"
            style={input}
          />

          {countPreview && (
            <p className="text-[11px]" style={{ color: palette.muted }}>
              Stock enregistré : {Number(item.quantity).toLocaleString("fr-FR")} {item.base_unit} →{" "}
              {countPreview.target.toLocaleString("fr-FR")} {item.base_unit} (
              <span style={{ color: countPreview.delta >= 0 ? "#10B981" : "#F43F5E" }}>
                {countPreview.delta >= 0 ? "+" : ""}
                {countPreview.delta.toLocaleString("fr-FR")}
              </span>
              )
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg text-white text-xs font-semibold py-2 disabled:opacity-50"
            style={{ backgroundColor: "#7C5CFF" }}
          >
            {busy ? "Enregistrement..." : "Enregistrer l'inventaire"}
          </button>
        </form>
      )}

      {section === "fiche" && canEdit && (
        <form onSubmit={submitEdit} className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px]" style={{ color: palette.muted }}>Unité de comptage</label>
              <select
                value={edit.base_unit}
                onChange={(e) => setEdit((f) => ({ ...f, base_unit: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm"
                style={input}
              >
                {BASE_UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
              </select>
            </div>
            <div>
              <label className="text-[11px]" style={{ color: palette.muted }}>Unité d'achat</label>
              <select
                value={edit.purchase_unit}
                onChange={(e) => setEdit((f) => ({ ...f, purchase_unit: e.target.value }))}
                className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm"
                style={input}
              >
                <option value="">—</option>
                {PURCHASE_UNITS.map((u) => (<option key={u} value={u}>{u}</option>))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-[11px]" style={{ color: palette.muted }}>
              1 {edit.purchase_unit || "unité d'achat"} = ? {edit.base_unit}
            </label>
            <input
              value={edit.units_per_purchase}
              onChange={(e) => setEdit((f) => ({ ...f, units_per_purchase: e.target.value }))}
              type="text"
              inputMode="decimal"
              className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm"
              style={input}
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px]" style={{ color: palette.muted }}>
                Prix de vente / {edit.base_unit}
              </label>
              <input
                value={edit.unit_price}
                onChange={(e) => setEdit((f) => ({ ...f, unit_price: e.target.value }))}
                type="text"
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm"
                style={input}
              />
            </div>
            <div>
              <label className="text-[11px]" style={{ color: palette.muted }}>Seuil d'alerte</label>
              <input
                value={edit.low_stock_threshold}
                onChange={(e) => setEdit((f) => ({ ...f, low_stock_threshold: e.target.value }))}
                type="text"
                inputMode="decimal"
                className="mt-1 w-full rounded-lg border px-2.5 py-2 text-sm"
                style={input}
              />
            </div>
          </div>

          <input
            value={edit.supplier}
            onChange={(e) => setEdit((f) => ({ ...f, supplier: e.target.value }))}
            placeholder="Fournisseur"
            className="w-full rounded-lg border px-2.5 py-2 text-sm"
            style={input}
          />

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-lg text-white text-xs font-semibold py-2 disabled:opacity-50"
            style={{ backgroundColor: "#7C5CFF" }}
          >
            {busy ? "Enregistrement..." : "Enregistrer la fiche"}
          </button>
        </form>
      )}
    </div>
  );
}
