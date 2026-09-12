import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";

// Unités proposées. base_unit = l'unité la plus fine que l'on compte.
// purchase_unit = ce que l'on achète (1 casier = 12 bouteilles, etc.).
export const BASE_UNITS = [
  "bouteille", "pièce", "kg", "g", "litre", "cl", "sachet", "portion",
];
export const PURCHASE_UNITS = [
  "casier", "carton", "douzaine", "sac", "bidon", "pack", "unité",
];

export const MOVEMENT_KINDS = [
  { id: "achat", label: "Achat (entrée)", sign: 1 },
  { id: "consommation", label: "Consommation (sortie)", sign: -1 },
  { id: "perte", label: "Perte / casse (sortie)", sign: -1 },
  { id: "ajustement", label: "Ajustement d'inventaire", sign: 1 },
];

// Fractions courantes pour une consommation partielle d'ingrédient.
export const PARTIAL_FRACTIONS = [1, 0.75, 0.5, 0.25];

export function useStock(restaurantId) {
  const [items, setItems] = useState([]);
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setItems([]);
      setMovements([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const [{ data: itemRows, error: itemErr }, { data: moveRows }] = await Promise.all([
      supabase.from("stock_items").select("*").eq("restaurant_id", restaurantId).order("name"),
      supabase
        .from("stock_movements")
        .select("*")
        .eq("restaurant_id", restaurantId)
        .gte("movement_date", since.toISOString().slice(0, 10))
        .order("movement_date", { ascending: false }),
    ]);

    if (itemErr) setError(itemErr.message);
    else setError(null);
    setItems(itemRows ?? []);
    setMovements(moveRows ?? []);
    setLoading(false);
  }, [restaurantId]);

  useEffect(() => {
    load();
  }, [load]);

  // Synchronisation temps réel : le stock change dès qu'une vente est saisie
  // par un autre membre de l'équipe.
  useEffect(() => {
    if (!restaurantId) return;
    const channel = supabase
      .channel(`stock-${restaurantId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock_items", filter: `restaurant_id=eq.${restaurantId}` },
        () => load()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "stock_movements", filter: `restaurant_id=eq.${restaurantId}` },
        () => load()
      )
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [restaurantId, load]);

  const addItem = useCallback(
    async (payload) => {
      const { error: err } = await supabase.from("stock_items").insert({
        restaurant_id: restaurantId,
        name: payload.name,
        kind: payload.kind,
        base_unit: payload.baseUnit,
        purchase_unit: payload.purchaseUnit || null,
        units_per_purchase: Number(payload.unitsPerPurchase) || 1,
        unit_cost: Number(payload.unitCost) || 0,
        unit_price: payload.unitPrice === "" || payload.unitPrice == null ? null : Number(payload.unitPrice),
        low_stock_threshold: Number(payload.lowStockThreshold) || 0,
        supplier: payload.supplier || null,
      });
      if (err) throw new Error(err.message);
      await load();
    },
    [restaurantId, load]
  );

  const updateItem = useCallback(
    async (id, patch) => {
      const { error: err } = await supabase.from("stock_items").update(patch).eq("id", id);
      if (err) throw new Error(err.message);
      await load();
    },
    [load]
  );

  const deleteItem = useCallback(
    async (id) => {
      const { error: err } = await supabase.from("stock_items").delete().eq("id", id);
      if (err) throw new Error(err.message);
      await load();
    },
    [load]
  );

  // Enregistre un mouvement. Les quantités sont saisies dans l'unité choisie
  // puis converties en unité de base avant écriture.
  const addMovement = useCallback(
    async ({ itemId, kind, quantity, inPurchaseUnit, totalCost, note, expenseId, date }) => {
      const item = items.find((i) => i.id === itemId);
      if (!item) throw new Error("Article de stock introuvable.");

      const factor = inPurchaseUnit ? Number(item.units_per_purchase) || 1 : 1;
      const qtyBase = Number(quantity) * factor;
      if (!qtyBase || qtyBase <= 0) throw new Error("Quantité invalide.");

      const sign = MOVEMENT_KINDS.find((k) => k.id === kind)?.sign ?? 1;
      const signedQty = kind === "ajustement" ? Number(quantity) * factor : sign * qtyBase;

      // Le coût total saisi est réparti sur la quantité en unité de base,
      // ce qui alimente la moyenne pondérée calculée côté base.
      const unitCost =
        totalCost === "" || totalCost == null ? null : Number(totalCost) / qtyBase;

      const { error: err } = await supabase.from("stock_movements").insert({
        restaurant_id: restaurantId,
        stock_item_id: itemId,
        kind,
        quantity: signedQty,
        unit_cost: unitCost,
        expense_id: expenseId ?? null,
        note: note || null,
        movement_date: date || new Date().toISOString().slice(0, 10),
      });
      if (err) throw new Error(err.message);
      await load();
    },
    [restaurantId, items, load]
  );

  // Achat = un mouvement d'entrée + UNE dépense, liés entre eux.
  // La dépense reste la seule écriture monétaire : pas de double comptage.
  const recordPurchase = useCallback(
    async ({ itemId, quantity, inPurchaseUnit, totalCost, supplier, date, category }) => {
      const amount = Number(totalCost);
      if (!amount || amount <= 0) throw new Error("Montant d'achat invalide.");
      const item = items.find((i) => i.id === itemId);
      if (!item) throw new Error("Article de stock introuvable.");

      const movementDate = date || new Date().toISOString().slice(0, 10);

      const { data: expense, error: expErr } = await supabase
        .from("expenses")
        .insert({
          restaurant_id: restaurantId,
          category: category || "Achat de marchandises",
          amount,
          expense_date: movementDate,
          description: `Achat stock — ${item.name}${supplier ? ` (${supplier})` : ""}`,
        })
        .select()
        .single();
      if (expErr) throw new Error(expErr.message);

      try {
        await addMovement({
          itemId,
          kind: "achat",
          quantity,
          inPurchaseUnit,
          totalCost: amount,
          expenseId: expense.id,
          date: movementDate,
          note: supplier ? `Fournisseur : ${supplier}` : null,
        });
      } catch (err) {
        // Si le mouvement échoue, on retire la dépense pour ne pas
        // laisser une écriture monétaire orpheline.
        await supabase.from("expenses").delete().eq("id", expense.id);
        throw err;
      }
    },
    [restaurantId, items, addMovement]
  );

  const stats = useMemo(() => {
    const value = (i) => Math.max(Number(i.quantity) || 0, 0) * (Number(i.unit_cost) || 0);
    const drinks = items.filter((i) => i.kind === "boisson");
    const ingredients = items.filter((i) => i.kind === "ingredient");

    const isOut = (i) => Number(i.quantity) <= 0;
    const isLow = (i) =>
      Number(i.quantity) > 0 &&
      Number(i.low_stock_threshold) > 0 &&
      Number(i.quantity) <= Number(i.low_stock_threshold);

    const monthPrefix = new Date().toISOString().slice(0, 7);
    const purchasesThisMonth = movements
      .filter((m) => m.kind === "achat" && String(m.movement_date).startsWith(monthPrefix))
      .reduce((s, m) => s + Number(m.quantity) * (Number(m.unit_cost) || 0), 0);

    const consumedThisMonth = movements
      .filter(
        (m) =>
          ["vente", "consommation", "perte"].includes(m.kind) &&
          String(m.movement_date).startsWith(monthPrefix)
      )
      .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0);

    return {
      totalValue: items.reduce((s, i) => s + value(i), 0),
      drinksValue: drinks.reduce((s, i) => s + value(i), 0),
      ingredientsValue: ingredients.reduce((s, i) => s + value(i), 0),
      drinksCount: drinks.length,
      ingredientsCount: ingredients.length,
      itemCount: items.length,
      outOfStock: items.filter(isOut),
      lowStock: items.filter(isLow),
      purchasesThisMonth,
      consumedThisMonth,
      // Part des articles dont le niveau est encore sain.
      healthyRatio:
        items.length === 0
          ? null
          : items.filter((i) => !isOut(i) && !isLow(i)).length / items.length,
    };
  }, [items, movements]);

  // Coût des marchandises vendues sur une période, pour la marge réelle.
  const cogsSince = useCallback(
    (fromDate) => {
      const byItem = Object.fromEntries(items.map((i) => [i.id, Number(i.unit_cost) || 0]));
      return movements
        .filter(
          (m) =>
            ["vente", "consommation"].includes(m.kind) && String(m.movement_date) >= fromDate
        )
        .reduce((s, m) => s + Math.abs(Number(m.quantity)) * (byItem[m.stock_item_id] ?? 0), 0);
    },
    [items, movements]
  );

  return {
    items,
    movements,
    loading,
    error,
    stats,
    cogsSince,
    reload: load,
    addItem,
    updateItem,
    deleteItem,
    addMovement,
    recordPurchase,
  };
}
