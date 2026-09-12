import React, { useMemo, useState } from "react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { usePreferences } from "../contexts/PreferencesContext";
import { CircularGauge } from "./ui/CircularGauge";

const WEEKDAY = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];
const VIOLET = "#7C5CFF";
const GREEN = "#10B981";
const RED = "#F43F5E";
const AMBER = "#F59E08";

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}
function daysAgoStr(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

// Variation en % entre deux périodes. Renvoie null quand la période
// précédente est vide : on n'invente pas de pourcentage.
function delta(current, previous) {
  if (!previous || previous <= 0) return null;
  return ((current - previous) / previous) * 100;
}

function DeltaBadge({ value, invert = false }) {
  const { palette } = usePreferences();
  if (value === null) {
    return <span className="text-[11px]" style={{ color: palette.muted }}>—</span>;
  }
  const good = invert ? value <= 0 : value >= 0;
  return (
    <span
      className="text-[11px] font-semibold rounded-full px-1.5 py-0.5"
      style={{ color: good ? GREEN : RED, backgroundColor: `${good ? GREEN : RED}1F` }}
    >
      {value >= 0 ? "+" : ""}
      {value.toFixed(0)} %
    </span>
  );
}

const PERIODS = [
  { id: "day", label: "Jour", days: 1 },
  { id: "week", label: "Semaine", days: 7 },
  { id: "month", label: "Mois", days: 30 },
];

export function Dashboard({ products, sales, expenses, stock }) {
  const { palette, formatMoney, isLight, t } = usePreferences();
  const [periodId, setPeriodId] = useState("day");
  const period = PERIODS.find((p) => p.id === periodId);

  const card = { backgroundColor: palette.card, border: `1px solid ${palette.line}` };
  const shortNum = (n) => (Math.abs(n) >= 1000 ? `${Math.round(n / 1000)}k` : String(Math.round(n)));

  const stats = useMemo(() => {
    const priceById = Object.fromEntries(products.map((p) => [p.id, Number(p.price) || 0]));
    const nameById = Object.fromEntries(products.map((p) => [p.id, p.name]));

    const from = daysAgoStr(period.days - 1);
    const prevFrom = daysAgoStr(period.days * 2 - 1);
    const prevTo = daysAgoStr(period.days);

    const inRange = (d, a, b) => d >= a && (b ? d <= b : true);

    const revenueOf = (list) =>
      list.reduce((s, x) => s + (priceById[x.product_id] ?? 0) * x.quantity, 0);
    const amountOf = (list) => list.reduce((s, x) => s + Number(x.amount), 0);

    const curSales = sales.filter((s) => inRange(s.sale_date, from));
    const prevSales = sales.filter((s) => inRange(s.sale_date, prevFrom, prevTo));
    const curExp = expenses.filter((e) => inRange(e.expense_date, from));
    const prevExp = expenses.filter((e) => inRange(e.expense_date, prevFrom, prevTo));

    const revenue = revenueOf(curSales);
    const prevRevenue = revenueOf(prevSales);
    const expenseTotal = amountOf(curExp);
    const prevExpenseTotal = amountOf(prevExp);

    // Marge réelle si le stock est renseigné : CA − coût des marchandises
    // réellement sorties du stock. Sinon on retombe sur CA − dépenses.
    const cogs = stock?.cogsSince ? stock.cogsSince(from) : 0;

    // Ventilation des dépenses : achats de stock réellement enregistrés sur
    // la période, le reste étant les autres dépenses (salaires, loyer...).
    const purchases = stock?.purchaseBreakdownSince
      ? stock.purchaseBreakdownSince(from)
      : { drinks: 0, ingredients: 0 };
    const hasCogs = cogs > 0;
    const grossMargin = hasCogs ? revenue - cogs : null;
    const marginRatio = hasCogs && revenue > 0 ? grossMargin / revenue : null;

    const profit = revenue - expenseTotal;
    const prevProfit = prevRevenue - prevExpenseTotal;

    // Série journalière sur la période affichée (min. 7 points pour la courbe)
    const pointCount = Math.max(period.days, 7);
    const series = [];
    for (let i = pointCount - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const dayRevenue = revenueOf(sales.filter((s) => s.sale_date === key));
      const dayExpense = amountOf(expenses.filter((e) => e.expense_date === key));
      series.push({
        date: key,
        label: pointCount > 10 ? key.slice(8) : WEEKDAY[d.getDay()],
        revenue: dayRevenue,
        expenses: dayExpense,
        profit: dayRevenue - dayExpense,
      });
    }

    const byCategory = {};
    for (const e of curExp) byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount);
    const topCategories = Object.entries(byCategory)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 5);

    const qtyByProduct = {};
    for (const s of curSales) qtyByProduct[s.product_id] = (qtyByProduct[s.product_id] ?? 0) + s.quantity;
    const topProducts = Object.entries(qtyByProduct)
      .map(([id, qty]) => ({ name: nameById[id] ?? "Produit supprimé", qty }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    // Part des dépenses dans le chiffre d'affaires — uniquement calculable
    // lorsqu'il y a du chiffre d'affaires sur la période.
    const expenseRatio = revenue > 0 ? Math.min(expenseTotal / revenue, 1) : null;

    return {
      revenue, prevRevenue, expenseTotal, prevExpenseTotal, profit, prevProfit,
      cogs, hasCogs, grossMargin, marginRatio, expenseRatio,
      purchasesDrinks: purchases.drinks,
      purchasesIngredients: purchases.ingredients,
      otherExpenses: Math.max(expenseTotal - purchases.drinks - purchases.ingredients, 0),
      itemsSold: curSales.reduce((n, s) => n + s.quantity, 0),
      series, topCategories, topProducts,
      hasAnyData: sales.length > 0 || expenses.length > 0,
    };
  }, [products, sales, expenses, stock, period]);

  const stockStats = stock?.stats;

  const tooltipStyle = {
    backgroundColor: isLight ? "#FFFFFF" : "#1B1F2E",
    border: `1px solid ${palette.line}`,
    borderRadius: 10,
    color: palette.ink,
    fontSize: 12,
  };

  const kpis = [
    { label: "Chiffre d'affaires", value: formatMoney(stats.revenue), d: delta(stats.revenue, stats.prevRevenue), accent: VIOLET },
    { label: "Dépenses", value: formatMoney(stats.expenseTotal), d: delta(stats.expenseTotal, stats.prevExpenseTotal), accent: RED, invert: true },
    { label: "Bénéfice", value: formatMoney(stats.profit), d: delta(stats.profit, stats.prevProfit), accent: stats.profit >= 0 ? GREEN : RED },
    { label: "Articles vendus", value: stats.itemsSold, d: null, accent: AMBER },
  ];

  return (
    <div className="space-y-5">
      {/* Sélecteur de période */}
      <div className="flex gap-1.5 p-1 rounded-full" style={{ backgroundColor: palette.elevated }}>
        {PERIODS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPeriodId(p.id)}
            className="flex-1 rounded-full text-xs font-semibold py-2 transition"
            style={
              periodId === p.id
                ? { backgroundColor: VIOLET, color: "#FFFFFF" }
                : { color: palette.muted }
            }
          >
            {p.label}
          </button>
        ))}
      </div>

      {/* KPI principaux */}
      <div className="grid grid-cols-2 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className="rounded-2xl p-4" style={card}>
            <div className="h-1 w-8 rounded-full mb-3" style={{ backgroundColor: k.accent }} />
            <p className="text-[11px]" style={{ color: palette.muted }}>{k.label}</p>
            <p className="text-xl font-bold font-display mt-0.5 leading-tight" style={{ color: palette.ink }}>
              {k.value}
            </p>
            <div className="mt-1.5">
              <DeltaBadge value={k.d} invert={k.invert} />
            </div>
          </div>
        ))}
      </div>

      {/* Marge réelle : seulement si le stock alimente un coût de revient */}
      {stats.hasCogs && (
        <div className="rounded-2xl p-4" style={card}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[11px]" style={{ color: palette.muted }}>Marge brute (stock déduit)</p>
              <p className="text-xl font-bold font-display mt-0.5" style={{ color: palette.ink }}>
                {formatMoney(stats.grossMargin)}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: palette.muted }}>
                Coût des marchandises vendues : {formatMoney(stats.cogs)}
              </p>
            </div>
            <CircularGauge
              value={stats.marginRatio}
              label="Taux de marge"
              color={GREEN}
              size={80}
            />
          </div>
        </div>
      )}

      {/* Jauges */}
      <div className="rounded-2xl p-4" style={card}>
        <p className="text-sm font-semibold mb-4" style={{ color: palette.ink }}>Indicateurs</p>
        <div className="grid grid-cols-3 gap-2">
          <CircularGauge
            value={stockStats?.healthyRatio ?? null}
            label="Stock sain"
            caption={
              stockStats && stockStats.itemCount > 0
                ? `${stockStats.itemCount - stockStats.outOfStock.length - stockStats.lowStock.length}/${stockStats.itemCount} articles`
                : "Aucun article"
            }
            color={GREEN}
            size={84}
          />
          <CircularGauge
            value={stats.expenseRatio}
            label="Dépenses / CA"
            caption={stats.revenue > 0 ? "Part du CA consommée" : "Pas de vente"}
            color={AMBER}
            size={84}
          />
          <CircularGauge
            value={stats.marginRatio}
            label="Marge"
            caption={stats.hasCogs ? "Sur le CA" : "Stock non renseigné"}
            color={VIOLET}
            size={84}
          />
        </div>
      </div>

      {/* Évolution CA / dépenses */}
      <div className="rounded-2xl p-4" style={card}>
        <p className="text-sm font-semibold mb-3" style={{ color: palette.ink }}>
          Évolution — chiffre d'affaires et dépenses
        </p>
        {stats.hasAnyData ? (
          <div style={{ width: "100%", height: 180 }}>
            <ResponsiveContainer>
              <AreaChart data={stats.series} margin={{ top: 5, right: 5, left: -22, bottom: 0 }}>
                <defs>
                  <linearGradient id="gradCA" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={VIOLET} stopOpacity={0.45} />
                    <stop offset="100%" stopColor={VIOLET} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradDep" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={RED} stopOpacity={0.3} />
                    <stop offset="100%" stopColor={RED} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={palette.line} vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: palette.muted }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 10, fill: palette.muted }} axisLine={false} tickLine={false} tickFormatter={shortNum} />
                <Tooltip
                  formatter={(v) => formatMoney(v)}
                  labelFormatter={(l) => `Journée : ${l}`}
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: palette.muted }}
                />
                <Area type="monotone" dataKey="revenue" name="Chiffre d'affaires" stroke={VIOLET} strokeWidth={2} fill="url(#gradCA)" />
                <Area type="monotone" dataKey="expenses" name="Dépenses" stroke={RED} strokeWidth={2} fill="url(#gradDep)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="text-sm py-6 text-center" style={{ color: palette.muted }}>{t("no_data_yet")}</p>
        )}
      </div>

      {/* Stock */}
      {stockStats && stockStats.itemCount > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-2xl p-4" style={card}>
              <p className="text-[11px]" style={{ color: palette.muted }}>🥤 Boissons</p>
              <p className="text-lg font-bold font-display mt-0.5" style={{ color: palette.ink }}>
                {formatMoney(stockStats.drinksValue)}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: palette.muted }}>
                {stockStats.drinksCount} article(s)
              </p>
              <p className="text-[11px]" style={{ color: palette.muted }}>
                {stockStats.drinksSoldThisMonth.toLocaleString("fr-FR")} vendue(s) ce mois
              </p>
            </div>
            <div className="rounded-2xl p-4" style={card}>
              <p className="text-[11px]" style={{ color: palette.muted }}>🥘 Ingrédients</p>
              <p className="text-lg font-bold font-display mt-0.5" style={{ color: palette.ink }}>
                {formatMoney(stockStats.ingredientsValue)}
              </p>
              <p className="text-[11px] mt-0.5" style={{ color: palette.muted }}>
                {stockStats.ingredientsCount} article(s)
              </p>
              <p className="text-[11px]" style={{ color: palette.muted }}>
                {formatMoney(stockStats.ingredientsConsumedValue)} consommé(s) ce mois
              </p>
            </div>
          </div>

          <div className="rounded-2xl p-4" style={card}>
            <div className="flex justify-between text-sm py-1">
              <span style={{ color: palette.muted }}>Valeur totale du stock</span>
              <span className="font-bold font-display" style={{ color: palette.ink }}>
                {formatMoney(stockStats.totalValue)}
              </span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span style={{ color: palette.muted }}>Achats de stock ce mois</span>
              <span className="font-semibold" style={{ color: palette.ink }}>
                {formatMoney(stockStats.purchasesThisMonth)}
              </span>
            </div>
          </div>

          {/* Répartition des dépenses de la période : les achats de stock sont
              déjà comptés dans le total, ils en sont ici isolés. */}
          <div className="rounded-2xl p-4" style={card}>
            <p className="text-sm font-semibold mb-1" style={{ color: palette.ink }}>
              💰 Répartition des dépenses
            </p>
            <div className="flex justify-between text-sm py-1">
              <span style={{ color: palette.muted }}>Achats d'ingrédients</span>
              <span className="font-semibold" style={{ color: palette.ink }}>
                {formatMoney(stats.purchasesIngredients)}
              </span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span style={{ color: palette.muted }}>Achats de boissons</span>
              <span className="font-semibold" style={{ color: palette.ink }}>
                {formatMoney(stats.purchasesDrinks)}
              </span>
            </div>
            <div className="flex justify-between text-sm py-1">
              <span style={{ color: palette.muted }}>Autres dépenses</span>
              <span className="font-semibold" style={{ color: palette.ink }}>
                {formatMoney(stats.otherExpenses)}
              </span>
            </div>
            <div
              className="flex justify-between text-sm pt-2 mt-1"
              style={{ borderTop: `1px solid ${palette.line}` }}
            >
              <span style={{ color: palette.muted }}>Total dépenses</span>
              <span className="font-bold font-display" style={{ color: palette.ink }}>
                {formatMoney(stats.expenseTotal)}
              </span>
            </div>
          </div>

          {(stockStats.outOfStock.length > 0 || stockStats.lowStock.length > 0) && (
            <div
              className="rounded-2xl p-4 space-y-1.5"
              style={{ backgroundColor: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.3)" }}
            >
              <p className="text-sm font-semibold" style={{ color: RED }}>⚠️ Alertes stock</p>
              {stockStats.outOfStock.slice(0, 5).map((i) => (
                <div key={i.id} className="flex justify-between text-xs">
                  <span style={{ color: palette.ink }}>{i.name}</span>
                  <span style={{ color: RED }}>en rupture</span>
                </div>
              ))}
              {stockStats.lowStock.slice(0, 5).map((i) => (
                <div key={i.id} className="flex justify-between text-xs">
                  <span style={{ color: palette.ink }}>{i.name}</span>
                  <span style={{ color: AMBER }}>
                    {Number(i.quantity)} {i.base_unit}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Répartition des dépenses */}
      {stats.topCategories.length > 0 && (
        <div className="rounded-2xl p-4" style={card}>
          <p className="text-sm font-semibold mb-3" style={{ color: palette.ink }}>
            Principales dépenses
          </p>
          <div style={{ width: "100%", height: 24 * stats.topCategories.length + 30 }}>
            <ResponsiveContainer>
              <BarChart data={stats.topCategories} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={110}
                  tick={{ fontSize: 11, fill: palette.muted }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip formatter={(v) => formatMoney(v)} contentStyle={tooltipStyle} cursor={{ fill: "transparent" }} />
                <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={14}>
                  {stats.topCategories.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? RED : `${RED}${i === 1 ? "CC" : i === 2 ? "99" : "66"}`} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Meilleures ventes */}
      <div className="rounded-2xl p-4" style={card}>
        <p className="text-sm font-semibold mb-3" style={{ color: palette.ink }}>
          Produits les plus vendus
        </p>
        {stats.topProducts.length > 0 ? (
          <div className="space-y-2">
            {stats.topProducts.map((p, i) => (
              <div key={p.name + i} className="flex items-center justify-between text-sm">
                <span style={{ color: palette.muted }}>{i + 1}. {p.name}</span>
                <span className="font-semibold" style={{ color: palette.ink }}>
                  {p.qty} vendu{p.qty > 1 ? "s" : ""}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-center py-4" style={{ color: palette.muted }}>{t("no_sales_yet")}</p>
        )}
      </div>

      {products.length === 0 && (
        <div
          className="rounded-2xl p-4 text-sm"
          style={{ backgroundColor: "rgba(124,92,255,0.15)", color: VIOLET }}
        >
          {t("add_products_first")}
        </div>
      )}
    </div>
  );
}
