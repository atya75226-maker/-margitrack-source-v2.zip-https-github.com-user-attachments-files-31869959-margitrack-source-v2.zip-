// Résumé de la veille, présenté au restaurateur à sa première ouverture de
// l'application chaque jour : chiffre d'affaires, dépenses, bénéfice, valeur
// du stock, puis quelques conseils concrets.
//
// Les CHIFFRES sont calculés ici, jamais demandés au modèle : une IA qui
// additionne des ventes se trompe, et un résumé faux est pire que pas de
// résumé. Le modèle ne rédige que les conseils, à partir de chiffres déjà
// établis.
//
// SÉCURITÉ : comme ai-ask, le restaurant vient du jeton d'authentification et
// jamais du corps de la requête, car les lectures se font avec la clé de
// service qui contourne les règles RLS.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const isDate = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const dayBefore = (d: string, n = 1) => {
  const date = new Date(`${d}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - n);
  return date.toISOString().slice(0, 10);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Non authentifié" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const asCaller = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userErr } = await asCaller.auth.getUser();
    if (userErr || !user) return json({ error: "Session invalide" }, 401);

    const { data: profile, error: profErr } = await asCaller
      .from("profiles")
      .select("restaurant_id, full_name")
      .eq("id", user.id)
      .single();
    if (profErr || !profile?.restaurant_id) return json({ error: "Profil introuvable" }, 403);
    const restaurant_id = profile.restaurant_id;

    // Le jour resume est fourni par le client, qui seul connait le fuseau du
    // restaurateur : « hier » a Lome n'est pas « hier » en UTC passe minuit.
    const payload = await req.json().catch(() => ({}));
    const today = isDate(payload?.today) ? payload.today : new Date().toISOString().slice(0, 10);
    const day = dayBefore(today);
    const prevDay = dayBefore(day);
    const weekStart = dayBefore(day, 7);

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Un resume deja produit pour ce jour est resservi tel quel : le
    // regenerer a chaque ouverture couterait un appel au modele et pourrait
    // renvoyer un texte different pour des chiffres identiques.
    const cacheKey = `brief:${day}`;
    // On prend la ligne la plus recente plutot que d'exiger l'unicite : deux
    // appareils ouvrant l'application en meme temps peuvent produire deux
    // lignes, ce qui ferait echouer une lecture stricte.
    const { data: cachedRows } = await admin
      .from("ai_reports")
      .select("content")
      .eq("restaurant_id", restaurant_id)
      .eq("period", cacheKey)
      .order("generated_at", { ascending: false })
      .limit(1);
    const cached = cachedRows?.[0];
    if (cached?.content) {
      try {
        return json({ ...JSON.parse(cached.content), cached: true });
      } catch {
        // Contenu illisible : on le regenere plutot que d'echouer.
      }
    }

    const [
      { data: restaurant },
      { data: products },
      { data: daySales },
      { data: weekSales },
      { data: dayExpenses },
      { data: weekExpenses },
      { data: stockItems },
      { data: dayMovements },
    ] = await Promise.all([
      admin.from("restaurants").select("name, currency").eq("id", restaurant_id).single(),
      admin.from("products").select("id, name, price").eq("restaurant_id", restaurant_id),
      admin.from("sales").select("product_id, quantity, sale_date").eq("restaurant_id", restaurant_id).in("sale_date", [day, prevDay]),
      admin.from("sales").select("product_id, quantity, sale_date").eq("restaurant_id", restaurant_id).gte("sale_date", weekStart).lte("sale_date", day),
      admin.from("expenses").select("category, amount, expense_date").eq("restaurant_id", restaurant_id).in("expense_date", [day, prevDay]),
      admin.from("expenses").select("amount, expense_date").eq("restaurant_id", restaurant_id).gte("expense_date", weekStart).lte("expense_date", day),
      admin.from("stock_items").select("id, name, kind, base_unit, purchase_unit, units_per_purchase, quantity, unit_cost, low_stock_threshold").eq("restaurant_id", restaurant_id),
      admin.from("stock_movements").select("stock_item_id, kind, quantity, unit_cost, movement_date").eq("restaurant_id", restaurant_id).eq("movement_date", day),
    ]);

    const currency = restaurant?.currency ?? "FCFA";
    const priceById: Record<string, number> = {};
    const nameById: Record<string, string> = {};
    for (const p of products ?? []) {
      priceById[p.id] = Number(p.price) || 0;
      nameById[p.id] = p.name;
    }

    const revenueOf = (rows: any[]) => rows.reduce((s, r) => s + (priceById[r.product_id] ?? 0) * r.quantity, 0);
    const on = (rows: any[], field: string, d: string) => rows.filter((r) => r[field] === d);

    const revenue = revenueOf(on(daySales ?? [], "sale_date", day));
    const revenuePrev = revenueOf(on(daySales ?? [], "sale_date", prevDay));
    const expenses = on(dayExpenses ?? [], "expense_date", day).reduce((s, r) => s + Number(r.amount), 0);
    const expensesPrev = on(dayExpenses ?? [], "expense_date", prevDay).reduce((s, r) => s + Number(r.amount), 0);

    // Moyenne sur les 7 jours ecoules : une journee isolee ne dit rien sans
    // point de comparaison, et la veille seule peut etre atypique.
    const weekRevenue = revenueOf(weekSales ?? []);
    const weekExpenseTotal = (weekExpenses ?? []).reduce((s, r) => s + Number(r.amount), 0);
    const avgRevenue = weekRevenue / 7;
    const avgExpenses = weekExpenseTotal / 7;

    const qtyByProduct: Record<string, number> = {};
    for (const s of on(daySales ?? [], "sale_date", day)) {
      qtyByProduct[s.product_id] = (qtyByProduct[s.product_id] ?? 0) + s.quantity;
    }
    const topProducts = Object.entries(qtyByProduct)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .slice(0, 3)
      .map(([id, qty]) => ({ name: nameById[id] ?? "Produit supprimé", qty, revenue: (priceById[id] ?? 0) * (qty as number) }));

    const byCategory: Record<string, number> = {};
    for (const e of on(dayExpenses ?? [], "expense_date", day)) {
      byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount);
    }

    const items = stockItems ?? [];
    const costOf: Record<string, number> = {};
    for (const i of items) costOf[i.id] = Number(i.unit_cost) || 0;
    const valueOf = (i: any) => Math.max(Number(i.quantity) || 0, 0) * (Number(i.unit_cost) || 0);
    const stockValue = items.reduce((s, i) => s + valueOf(i), 0);

    const inPurchaseUnit = (i: any) => {
      const qty = Number(i.quantity) || 0;
      const per = Number(i.units_per_purchase) || 1;
      return per > 1 && i.purchase_unit
        ? `${(qty / per).toFixed(1)} ${i.purchase_unit}`
        : `${qty} ${i.base_unit}`;
    };
    const outOfStock = items.filter((i) => Number(i.quantity) <= 0).map((i) => i.name);
    const lowStock = items
      .filter((i) => Number(i.quantity) > 0 && Number(i.low_stock_threshold) > 0 && Number(i.quantity) <= Number(i.low_stock_threshold))
      .map((i) => `${i.name} (${inPurchaseUnit(i)})`);

    // Cout des marchandises reellement sorties du stock la veille : c'est lui
    // qui donne la marge brute, bien plus juste que « recettes moins
    // depenses » quand la marchandise a ete achetee un autre jour.
    const cogs = (dayMovements ?? [])
      .filter((m) => ["vente", "consommation"].includes(m.kind))
      .reduce((s, m) => s + Math.abs(Number(m.quantity)) * (costOf[m.stock_item_id] ?? 0), 0);

    // Un achat de stock n'est pas une perte : c'est de l'argent transforme en
    // marchandise. Il ne pese sur le benefice qu'au fur et a mesure qu'il se
    // vend, sinon le jour de l'achat paraitrait catastrophique et les
    // suivants trop beaux. Meme regle que le tableau de bord.
    const stockPurchases = (dayMovements ?? [])
      .filter((m) => m.kind === "achat")
      .reduce((s, m) => s + Number(m.quantity) * (Number(m.unit_cost) || 0), 0);
    const usesStock = items.length > 0;
    const otherExpenses = Math.max(expenses - stockPurchases, 0);
    const profit = usesStock ? revenue - cogs - otherExpenses : revenue - expenses;

    const stats = {
      date: day,
      currency,
      revenue,
      revenuePrev,
      expenses,
      expensesPrev,
      usesStock,
      stockPurchases,
      otherExpenses,
      profit,
      grossMargin: cogs > 0 ? revenue - cogs : null,
      cogs,
      avgRevenue,
      avgExpenses,
      stockValue,
      outOfStock,
      lowStock,
      topProducts,
      byCategory,
      hasActivity: revenue > 0 || expenses > 0,
    };

    // ---- Conseils rediges par le modele ---------------------------------
    const apiKey = Deno.env.get("Gemini API Key");
    let advice: string[] = [];

    if (apiKey) {
      const fmt = (n: number) => `${Math.round(n)} ${currency}`;
      const prompt = `Tu es l'assistant de gestion de "${restaurant?.name ?? "ce restaurant"}" sur Margitrack, une application pour restaurateurs africains.

Chiffres réels de la journée du ${day} (déjà calculés, ne les recalcule pas) :
- Chiffre d'affaires : ${fmt(revenue)} (veille : ${fmt(revenuePrev)}, moyenne des 7 derniers jours : ${fmt(avgRevenue)})
- Dépenses : ${fmt(expenses)} (veille : ${fmt(expensesPrev)}, moyenne 7 jours : ${fmt(avgExpenses)})${usesStock ? `, dont ${fmt(stockPurchases)} d'achats de stock` : ""}
- Coût des marchandises vendues : ${fmt(cogs)}
- Bénéfice : ${fmt(profit)}${usesStock ? " (ventes moins marchandises vendues moins dépenses hors stock : un achat de stock ne compte qu'au moment où il se vend)" : ""}
- Dépenses par catégorie : ${JSON.stringify(byCategory)}
- Produits les plus vendus : ${topProducts.map((p) => `${p.name} (${p.qty})`).join(", ") || "aucune vente"}
- Valeur du stock : ${fmt(stockValue)}
- Articles en rupture : ${outOfStock.join(", ") || "aucun"}
- Articles bientôt épuisés : ${lowStock.join(" ; ") || "aucun"}

Donne 2 à 3 conseils courts, concrets et actionnables pour aujourd'hui, en français simple, tutoiement exclu (vouvoiement). Chaque conseil sur une ligne, sans puce ni numéro, 20 mots maximum chacun. Appuie-toi sur les écarts réels : une dépense anormalement haute par rapport à la moyenne, un produit qui se vend bien et mérite d'être mis en avant, un réapprovisionnement urgent. N'invente aucun chiffre absent de la liste. Si la journée est sans activité, dis-le en un conseil unique et invite à enregistrer les ventes.`;

      try {
        const aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent", {
          method: "POST",
          headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
        });
        if (aiRes.ok) {
          const aiData = await aiRes.json();
          const text = (aiData?.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("\n");
          advice = text
            .split("\n")
            .map((l: string) => l.replace(/^\s*[-•*\d.)]+\s*/, "").trim())
            .filter(Boolean)
            .slice(0, 3);
        }
      } catch {
        // Le resume garde toute sa valeur sans les conseils : on ne fait pas
        // echouer la reponse pour autant.
      }
    }

    const result = { stats, advice };

    await admin.from("ai_reports").insert({
      restaurant_id,
      period: cacheKey,
      content: JSON.stringify(result),
    });

    return json({ ...result, cached: false });
  } catch (err) {
    return json({ error: `Exception : ${String(err)}` }, 500);
  }
});
