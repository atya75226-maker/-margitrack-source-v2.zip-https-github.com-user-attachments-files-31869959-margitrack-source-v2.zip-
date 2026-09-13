// Assistant conversationnel : le propriétaire (ou un membre de son équipe)
// pose une question libre et reçoit une réponse basée sur les VRAIES
// données des 30 derniers jours du restaurant.
//
// SÉCURITÉ : le restaurant est résolu uniquement depuis le jeton
// d'authentification du client, jamais depuis une valeur qu'il fournit.
// Cette fonction interroge la base avec la clé de service, qui contourne les
// règles RLS : accepter un restaurant_id envoyé par le client laisserait
// n'importe quel utilisateur authentifié lire les données d'un autre
// restaurant.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non authentifié" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const asCaller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await asCaller.auth.getUser();
    if (userErr || !user) return json({ error: "Session invalide" }, 401);

    const { data: callerProfile, error: profErr } = await asCaller
      .from("profiles")
      .select("restaurant_id")
      .eq("id", user.id)
      .single();
    if (profErr || !callerProfile?.restaurant_id) return json({ error: "Profil introuvable" }, 403);

    const restaurant_id = callerProfile.restaurant_id;

    const { question } = await req.json();
    if (!question || typeof question !== "string" || !question.trim()) {
      return json({ error: "question requise" }, 400);
    }

    const apiKey = Deno.env.get("Gemini API Key");
    if (!apiKey) {
      const presentKeys = Object.keys(Deno.env.toObject()).sort().join(", ");
      return json({ error: `Clé Gemini introuvable sous ce nom. Variables actuellement visibles par la fonction : [${presentKeys}]` }, 500);
    }

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const since30 = new Date();
    since30.setDate(since30.getDate() - 30);
    const since30Str = since30.toISOString().slice(0, 10);
    const since60 = new Date();
    since60.setDate(since60.getDate() - 60);
    const since60Str = since60.toISOString().slice(0, 10);

    const [
      { data: sales },
      { data: expenses },
      { data: products },
      { data: prevRevenueRows },
      { data: prevExpenseRows },
      { data: restaurant },
      { data: stockItems },
      { data: movements },
    ] = await Promise.all([
      admin.from("sales").select("product_id, quantity, sale_date").eq("restaurant_id", restaurant_id).gte("sale_date", since30Str),
      admin.from("expenses").select("category, amount, expense_date").eq("restaurant_id", restaurant_id).gte("expense_date", since30Str),
      admin.from("products").select("id, name, price").eq("restaurant_id", restaurant_id),
      admin.from("v_daily_revenue").select("*").eq("restaurant_id", restaurant_id).gte("date", since60Str).lt("date", since30Str),
      admin.from("v_daily_expenses").select("*").eq("restaurant_id", restaurant_id).gte("date", since60Str).lt("date", since30Str),
      admin.from("restaurants").select("name, currency").eq("id", restaurant_id).single(),
      // Le stock manquait : l'assistant repondait qu'il n'y avait pas acces,
      // alors meme que les articles etaient enregistres dans l'application.
      admin.from("stock_items").select("name, kind, base_unit, purchase_unit, units_per_purchase, quantity, unit_cost, low_stock_threshold").eq("restaurant_id", restaurant_id),
      admin.from("stock_movements").select("stock_item_id, kind, quantity, unit_cost, movement_date").eq("restaurant_id", restaurant_id).gte("movement_date", since30Str),
    ]);

    const currency = restaurant?.currency ?? "FCFA";
    const priceById = Object.fromEntries((products ?? []).map((p: any) => [p.id, p.price]));
    const nameById = Object.fromEntries((products ?? []).map((p: any) => [p.id, p.name]));
    const totalRevenue = (sales ?? []).reduce((s: number, r: any) => s + (priceById[r.product_id] ?? 0) * r.quantity, 0);
    const totalExpenses = (expenses ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0);
    const prevRevenue = (prevRevenueRows ?? []).reduce((s: number, r: any) => s + Number(r.revenue), 0);
    const prevExpenses = (prevExpenseRows ?? []).reduce((s: number, r: any) => s + Number(r.total), 0);

    const pctChange = (current: number, previous: number) => {
      if (previous <= 0) return current > 0 ? "nouveau" : "0%";
      const pct = ((current - previous) / previous) * 100;
      return `${pct >= 0 ? "+" : ""}${pct.toFixed(0)}%`;
    };

    const qtyByProduct: Record<string, number> = {};
    for (const s of sales ?? []) qtyByProduct[s.product_id] = (qtyByProduct[s.product_id] ?? 0) + s.quantity;
    const topProducts = Object.entries(qtyByProduct)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 5)
      .map(([id, qty]) => `${nameById[id] ?? "Produit"} (${qty} vendus)`);

    const byCategory: Record<string, number> = {};
    for (const e of expenses ?? []) byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount);

    // ---- Stock -----------------------------------------------------------
    const items = stockItems ?? [];
    const valueOf = (i: any) => Math.max(Number(i.quantity) || 0, 0) * (Number(i.unit_cost) || 0);
    const stockValue = items.reduce((s: number, i: any) => s + valueOf(i), 0);
    const drinksValue = items.filter((i: any) => i.kind === "boisson").reduce((s: number, i: any) => s + valueOf(i), 0);
    const ingredientsValue = items.filter((i: any) => i.kind === "ingredient").reduce((s: number, i: any) => s + valueOf(i), 0);

    // Les quantites sont stockees dans l'unite la plus fine : on les reexprime
    // aussi en unite d'achat (casier, sac), qui est celle dont parle le
    // restaurateur.
    const describe = (i: any) => {
      const qty = Number(i.quantity) || 0;
      const per = Number(i.units_per_purchase) || 1;
      const base = `${qty} ${i.base_unit}`;
      return per > 1 && i.purchase_unit
        ? `${i.name} : ${base} (${(qty / per).toFixed(1)} ${i.purchase_unit})`
        : `${i.name} : ${base}`;
    };

    const outOfStock = items.filter((i: any) => Number(i.quantity) <= 0).map((i: any) => i.name);
    const lowStock = items
      .filter((i: any) => Number(i.quantity) > 0 && Number(i.low_stock_threshold) > 0 && Number(i.quantity) <= Number(i.low_stock_threshold))
      .map(describe);

    const purchases30 = (movements ?? [])
      .filter((m: any) => m.kind === "achat")
      .reduce((s: number, m: any) => s + Number(m.quantity) * (Number(m.unit_cost) || 0), 0);

    const stockLines = items.length
      ? items.map(describe).join(" ; ")
      : "aucun article de stock enregistre";

    const prompt = `Tu es l'assistant IA de gestion de "${restaurant?.name ?? "ce restaurant"}" sur Margitrack, une app pour restaurateurs africains. Le nom de l'application est Margitrack : ne l'appelle jamais autrement.

Données réelles des 30 derniers jours :
- Chiffre d'affaires : ${totalRevenue} ${currency} (évolution vs 30 jours précédents : ${pctChange(totalRevenue, prevRevenue)})
- Dépenses : ${totalExpenses} ${currency} (évolution : ${pctChange(totalExpenses, prevExpenses)})
- Bénéfice : ${totalRevenue - totalExpenses} ${currency} (évolution : ${pctChange(totalRevenue - totalExpenses, prevRevenue - prevExpenses)})
- Dépenses par catégorie : ${JSON.stringify(byCategory)}
- Produits les plus vendus : ${topProducts.join(", ") || "aucune vente"}

État du stock (valeurs actuelles, tu Y AS ACCÈS, ne dis jamais le contraire) :
- Valeur totale du stock : ${Math.round(stockValue)} ${currency}
- Dont boissons : ${Math.round(drinksValue)} ${currency} — dont ingrédients : ${Math.round(ingredientsValue)} ${currency}
- Détail des articles : ${stockLines}
- Articles en rupture : ${outOfStock.join(", ") || "aucun"}
- Articles bientôt épuisés : ${lowStock.join(" ; ") || "aucun"}
- Achats de stock sur 30 jours : ${Math.round(purchases30)} ${currency}

Question du propriétaire : "${question.trim()}"

Réponds en français, de façon courte, concrète et chaleureuse, en te basant STRICTEMENT sur les vraies données ci-dessus. Utilise des pourcentages d'évolution précis quand c'est pertinent. Si une donnée vaut zéro ou est absente, dis-le simplement ("vous n'avez pas encore enregistré de ventes") au lieu de prétendre ne pas y avoir accès. Pas de long pavé de texte, 3-4 phrases maximum sauf si des conseils en liste sont demandés.`;

    const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent", {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
    });

    if (!aiRes.ok) {
      const detail = await aiRes.text();
      return json({ error: `Erreur API Gemini (${aiRes.status}) : ${detail}` }, 502);
    }

    const aiData = await aiRes.json();
    const answer = (aiData?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("\n").trim();

    if (!answer) {
      return json({ error: `Réponse Gemini inattendue (vide) : ${JSON.stringify(aiData)}` }, 502);
    }

    return json({ answer });
  } catch (err) {
    return json({ error: `Exception : ${String(err)}` }, 500);
  }
});
