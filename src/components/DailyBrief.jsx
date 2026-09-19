import React, { useCallback, useEffect, useState } from "react";
import { supabase, callEdgeFunction } from "../lib/supabaseClient";
import { usePreferences } from "../contexts/PreferencesContext";

/**
 * Résumé de la veille, affiché à la première ouverture de l'application
 * chaque jour : ce qui a été vendu, dépensé, gagné, ce qu'il reste en stock,
 * puis quelques conseils.
 *
 * Les chiffres viennent de la fonction ai-daily-brief, qui les calcule à
 * partir de la base ; le modèle ne rédige que les conseils. Un résumé dont
 * les montants seraient inventés serait pire qu'aucun résumé.
 */

const seenKey = (restaurantId) => `margitrack:brief-seen:${restaurantId ?? "anon"}`;

/** Date du jour telle que la vit l'utilisateur, pas en UTC. */
function localToday() {
  const d = new Date();
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

function Line({ label, value, tone, palette }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="text-xs" style={{ color: palette.muted }}>{label}</span>
      <span className="text-sm font-semibold" style={{ color: tone ?? palette.ink }}>{value}</span>
    </div>
  );
}

export function DailyBrief({ restaurantId }) {
  const { palette, formatMoney } = usePreferences();
  const today = localToday();

  const [state, setState] = useState("idle"); // idle | loading | ready | hidden
  const [data, setData] = useState(null);

  useEffect(() => {
    if (!restaurantId) return undefined;

    // Déjà lu aujourd'hui : on ne réaffiche pas, l'écran d'accueil doit
    // rester celui de l'activité du jour.
    let alreadySeen = null;
    try {
      alreadySeen = window.localStorage.getItem(seenKey(restaurantId));
    } catch {
      // Navigation privée ou stockage refusé : le résumé réapparaîtra, ce
      // qui est préférable à une erreur.
    }
    if (alreadySeen === today) {
      setState("hidden");
      return undefined;
    }

    let cancelled = false;
    setState("loading");

    (async () => {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        const body = await callEdgeFunction("ai-daily-brief", { token, body: { today } });
        if (cancelled) return;
        setData(body);
        setState("ready");
      } catch {
        // Un résumé indisponible ne doit pas encombrer l'écran d'accueil
        // avec un message d'erreur : on s'efface.
        if (!cancelled) setState("hidden");
      }
    })();

    return () => { cancelled = true; };
  }, [restaurantId, today]);

  const dismiss = useCallback(() => {
    try {
      window.localStorage.setItem(seenKey(restaurantId), today);
    } catch {
      // Sans stockage, le résumé se réaffichera à la prochaine ouverture.
    }
    setState("hidden");
  }, [restaurantId, today]);

  if (state === "hidden" || state === "idle") return null;

  const card = {
    backgroundColor: palette.card,
    border: `1px solid ${palette.line}`,
  };

  if (state === "loading") {
    return (
      <div className="rounded-2xl p-4 mb-3" style={card}>
        <p className="text-xs" style={{ color: palette.muted }}>
          Préparation de votre résumé d'hier…
        </p>
      </div>
    );
  }

  const s = data?.stats;
  if (!s) return null;

  const advice = Array.isArray(data.advice) ? data.advice : [];
  const dayLabel = new Date(`${s.date}T12:00:00`).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  // L'écart avec la moyenne de la semaine dit bien plus qu'un montant seul :
  // 40 000 de recette n'a pas le même sens selon les habitudes du restaurant.
  const delta = (value, reference) => {
    if (!reference || reference <= 0) return null;
    const pct = Math.round(((value - reference) / reference) * 100);
    if (Math.abs(pct) < 5) return null;
    return pct;
  };
  const revenueDelta = delta(s.revenue, s.avgRevenue);
  const expenseDelta = delta(s.expenses, s.avgExpenses);

  return (
    <div className="rounded-2xl p-4 mb-3 space-y-3" style={card}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold font-display" style={{ color: palette.ink }}>
            Votre journée d'hier
          </p>
          <p className="text-[11px] capitalize" style={{ color: palette.muted }}>{dayLabel}</p>
        </div>
        <button
          onClick={dismiss}
          className="text-xs shrink-0 px-2 py-1 rounded-lg"
          style={{ color: palette.muted }}
          aria-label="Masquer le résumé"
        >
          Masquer
        </button>
      </div>

      {!s.hasActivity ? (
        <p className="text-sm" style={{ color: palette.muted }}>
          Aucune vente ni dépense enregistrée hier. Saisissez vos ventes du jour
          pour que ce résumé devienne utile.
        </p>
      ) : (
        <div>
          <Line
            label="Chiffre d'affaires"
            value={
              <>
                {formatMoney(s.revenue)}
                {revenueDelta !== null && (
                  <span
                    className="ml-1.5 text-[11px] font-medium"
                    style={{ color: revenueDelta >= 0 ? "#10B981" : "#F43F5E" }}
                  >
                    {revenueDelta >= 0 ? "+" : ""}{revenueDelta}% / moyenne
                  </span>
                )}
              </>
            }
            palette={palette}
          />
          {s.usesStock && (
            <Line
              label="Marchandises vendues"
              value={formatMoney(s.cogs ?? 0)}
              palette={palette}
            />
          )}
          <Line
            label={s.usesStock ? "Autres dépenses" : "Dépenses"}
            value={
              <>
                {formatMoney(s.usesStock ? s.otherExpenses ?? 0 : s.expenses)}
                {/* La moyenne porte sur la dépense totale : la comparer à la
                    seule dépense hors stock induirait en erreur. */}
                {!s.usesStock && expenseDelta !== null && (
                  <span
                    className="ml-1.5 text-[11px] font-medium"
                    style={{ color: expenseDelta > 0 ? "#F43F5E" : "#10B981" }}
                  >
                    {expenseDelta >= 0 ? "+" : ""}{expenseDelta}% / moyenne
                  </span>
                )}
              </>
            }
            palette={palette}
          />
          <Line
            label="Bénéfice"
            value={formatMoney(s.profit)}
            tone={s.profit >= 0 ? "#10B981" : "#F43F5E"}
            palette={palette}
          />
          {s.grossMargin !== null && (
            <Line
              label="Marge brute (stock déduit)"
              value={formatMoney(s.grossMargin)}
              palette={palette}
            />
          )}
          <Line label="Valeur du stock" value={formatMoney(s.stockValue)} palette={palette} />
        </div>
      )}

      {s.topProducts?.length > 0 && (
        <div className="pt-2" style={{ borderTop: `1px solid ${palette.line}` }}>
          <p className="text-[11px] mb-1" style={{ color: palette.muted }}>Les plus vendus hier</p>
          {s.topProducts.map((p) => (
            <div key={p.name} className="flex justify-between text-xs py-0.5">
              <span style={{ color: palette.ink }}>{p.name}</span>
              <span style={{ color: palette.muted }}>
                {p.qty} · {formatMoney(p.revenue)}
              </span>
            </div>
          ))}
        </div>
      )}

      {(s.outOfStock?.length > 0 || s.lowStock?.length > 0) && (
        <div
          className="rounded-xl p-3 text-xs space-y-0.5"
          style={{ backgroundColor: "rgba(244,63,94,0.10)", border: "1px solid rgba(244,63,94,0.3)" }}
        >
          {s.outOfStock?.length > 0 && (
            <p style={{ color: palette.ink }}>
              <strong style={{ color: "#F43F5E" }}>En rupture :</strong> {s.outOfStock.join(", ")}
            </p>
          )}
          {s.lowStock?.length > 0 && (
            <p style={{ color: palette.ink }}>
              <strong style={{ color: "#F59E08" }}>Bientôt épuisé :</strong> {s.lowStock.join(" · ")}
            </p>
          )}
        </div>
      )}

      {advice.length > 0 && (
        <div className="pt-2 space-y-1.5" style={{ borderTop: `1px solid ${palette.line}` }}>
          <p className="text-[11px]" style={{ color: palette.muted }}>Conseils de l'assistant</p>
          {advice.map((line, i) => (
            <p key={i} className="text-xs leading-relaxed" style={{ color: palette.ink }}>
              • {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
