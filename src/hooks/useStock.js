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
  // Liens produit vendu -> article de stock. C'est eux qui permettent au
  // declencheur consume_stock_on_sale de deduire le stock a chaque vente.
  const [links, setLinks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!restaurantId) {
      setItems([]);
      setMovements([]);
      setLinks([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const [{ data: itemRows, error: itemErr }, { data: moveRows }, { data: linkRows }] =
      await Promise.all([
        supabase.from("stock_items").select("*").eq("restaurant_id", restaurantId).order("name"),
        supabase
          .from("stock_movements")
          .select("*")
          .eq("restaurant_id", restaurantId)
          .gte("movement_date", since.toISOString().slice(0, 10))
          .order("movement_date", { ascending: false }),
        supabase.from("product_stock_links").select("*").eq("restaurant_id", restaurantId),
      ]);

    if (itemErr) setError(itemErr.message);
    else setError(null);
    setItems(itemRows ?? []);
    setMovements(moveRows ?? []);
    setLinks(linkRows ?? []);
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
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_stock_links", filter: `restaurant_id=eq.${restaurantId}` },
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
      const raw = Number(quantity) * factor;
      // Un ajustement d'inventaire peut corriger à la baisse : il accepte donc
      // une quantité négative, contrairement aux autres mouvements dont le
      // sens est déjà porté par le type.
      const isAdjustment = kind === "ajustement";
      if (!Number.isFinite(raw) || raw === 0 || (!isAdjustment && raw < 0)) {
        throw new Error("Quantité invalide.");
      }

      const sign = MOVEMENT_KINDS.find((k) => k.id === kind)?.sign ?? 1;
      const qtyBase = Math.abs(raw);
      const signedQty = isAdjustment ? raw : sign * qtyBase;

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

      // Le dernier fournisseur connu est conservé sur l'article, pour que la
      // fiche reste à jour sans ressaisie.
      if (supplier && supplier !== item.supplier) {
        await supabase.from("stock_items").update({ supplier }).eq("id", itemId);
        await load();
      }
    },
    [restaurantId, items, addMovement, load]
  );

  // Annule un mouvement saisi par erreur. Le stock est recredite et le cout
  // moyen recalcule par la base. Un achat porte sa depense : on la retire
  // aussi, sinon il resterait une sortie d'argent sans contrepartie.
  const deleteMovement = useCallback(
    async (id) => {
      const movement = movements.find((m) => m.id === id);
      if (!movement) throw new Error("Mouvement introuvable.");
      if (movement.sale_id) {
        throw new Error(
          "Ce mouvement provient d'une vente. Supprimez la vente dans l'onglet Ventes : le stock sera recredite automatiquement."
        );
      }

      const { error: err } = await supabase.from("stock_movements").delete().eq("id", id);
      if (err) throw new Error(err.message);

      // La suppression de la depense peut etre refusee par RLS : un
      // responsable de stock n'a pas le droit "expenses". Postgres renvoie
      // alors zero ligne supprimee, sans erreur. On le detecte pour ne pas
      // laisser croire que tout a ete annule.
      let orphanExpense = false;
      if (movement.expense_id) {
        const { data, error: expErr } = await supabase
          .from("expenses")
          .delete()
          .eq("id", movement.expense_id)
          .select("id");
        if (expErr) throw new Error(expErr.message);
        orphanExpense = !data || data.length === 0;
      }

      await load();

      if (orphanExpense) {
        throw new Error(
          "Le mouvement de stock a bien ete annule, mais la depense liee n'a pas pu etre supprimee : votre compte n'a pas acces aux depenses. Demandez au proprietaire de la retirer dans l'onglet Depenses."
        );
      }
    },
    [movements, load]
  );

  // Relie un produit du menu a un article de stock. quantityPerSale est
  // exprime en unite de base : vendre 1 "Coca 33cl" sort 1 bouteille,
  // vendre 1 "Casier Coca" en sort 12.
  const addLink = useCallback(
    async ({ productId, stockItemId, quantityPerSale }) => {
      const qty = Number(quantityPerSale);
      if (!qty || qty <= 0) throw new Error("Quantite deduite invalide.");
      const { error: err } = await supabase.from("product_stock_links").insert({
        restaurant_id: restaurantId,
        product_id: productId,
        stock_item_id: stockItemId,
        quantity_per_sale: qty,
      });
      if (err) {
        throw new Error(
          err.code === "23505"
            ? "Ce produit est deja relie a cet article de stock."
            : err.message
        );
      }
      await load();
    },
    [restaurantId, load]
  );

  const removeLink = useCallback(
    async (id) => {
      const { error: err } = await supabase.from("product_stock_links").delete().eq("id", id);
      if (err) throw new Error(err.message);
      await load();
    },
    [load]
  );

  // Historique complet d'un article, du plus recent au plus ancien.
  const movementsFor = useCallback(
    (itemId) => movements.filter((m) => m.stock_item_id === itemId),
    [movements]
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

    // Ventilation par nature, pour distinguer sur le tableau de bord les
    // achats de boissons des achats d'ingredients et des autres depenses.
    const kindOf = Object.fromEntries(items.map((i) => [i.id, i.kind]));
    const costOf = Object.fromEntries(items.map((i) => [i.id, Number(i.unit_cost) || 0]));
    const thisMonth = (m) => String(m.movement_date).startsWith(monthPrefix);

    const purchaseValue = (kind) =>
      movements
        .filter((m) => m.kind === "achat" && thisMonth(m) && kindOf[m.stock_item_id] === kind)
        .reduce((s, m) => s + Number(m.quantity) * (Number(m.unit_cost) || 0), 0);

    // Quantite de boissons reellement sortie par des ventes, en unite de base.
    const drinksSoldThisMonth = movements
      .filter((m) => m.kind === "vente" && thisMonth(m) && kindOf[m.stock_item_id] === "boisson")
      .reduce((s, m) => s + Math.abs(Number(m.quantity)), 0);

    // Valeur des ingredients consommes : les quantites (kg, litres...) ne
    // s'additionnent pas entre elles, seule leur valeur est comparable.
    const ingredientsConsumedValue = movements
      .filter(
        (m) =>
          ["consommation", "vente", "perte"].includes(m.kind) &&
          thisMonth(m) &&
          kindOf[m.stock_item_id] === "ingredient"
      )
      .reduce((s, m) => s + Math.abs(Number(m.quantity)) * (costOf[m.stock_item_id] ?? 0), 0);

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
      purchasesDrinksThisMonth: purchaseValue("boisson"),
      purchasesIngredientsThisMonth: purchaseValue("ingredient"),
      drinksSoldThisMonth,
      ingredientsConsumedValue,
      consumedThisMonth,
      // Part des articles dont le niveau est encore sain.
      healthyRatio:
        items.length === 0
          ? null
          : items.filter((i) => !isOut(i) && !isLow(i)).length / items.length,
    };
  }, [items, movements]);

  // Achats de stock sur une période, ventilés boissons / ingrédients.
  // On se cale sur la même période que le tableau de bord pour que la part
  // « autres dépenses » se déduise sans double comptage.
  const purchaseBreakdownSince = useCallback(
    (fromDate) => {
      const kindOf = Object.fromEntries(items.map((i) => [i.id, i.kind]));
      const totals = { boisson: 0, ingredient: 0 };
      for (const m of movements) {
        if (m.kind !== "achat" || String(m.movement_date) < fromDate) continue;
        const kind = kindOf[m.stock_item_id];
        if (!kind) continue;
        totals[kind] += Number(m.quantity) * (Number(m.unit_cost) || 0);
      }
      return { drinks: totals.boisson, ingredients: totals.ingredient };
    },
    [items, movements]
  );

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
    links,
    loading,
    error,
    stats,
    cogsSince,
    purchaseBreakdownSince,
    movementsFor,
    reload: load,
    addItem,
    updateItem,
    deleteItem,
    addMovement,
    deleteMovement,
    recordPurchase,
    addLink,
    removeLink,
  };
}
