import React from "react";
import { useAuth } from "../contexts/AuthContext";
import { usePreferences } from "../contexts/PreferencesContext";

const fcfa = (n) => `${Math.round(n || 0).toLocaleString("fr-FR")} FCFA`;

const CHARIOW_SUBSCRIBE_URL = "https://nqgqbdif.mychariow.shop/prd_8w82y1xr/checkout";

export function SubscriptionScreen({ subscription, plans, loading, isActive, isExpired }) {
  const { role, profile, signOut } = useAuth();
  const { palette } = usePreferences();
  const plan = plans[0];

  if (loading) return <p className="text-sm" style={{ color: palette.muted }}>Chargement de votre abonnement...</p>;

  return (
    <div className="flex flex-col gap-5 max-w-2xl">
      <div className="rounded-3xl p-5" style={{ backgroundColor: isActive ? "rgba(16,185,129,0.14)" : palette.card, border: `1px solid ${palette.line}` }}>
        <p className="text-xs font-bold uppercase tracking-wide" style={{ color: palette.muted }}>Statut de l'abonnement</p>
        <p className="font-semibold mt-1" style={{ color: isActive ? "#10B981" : palette.ink }}>
          {isActive ? (subscription?.status === "trial" ? "Essai gratuit actif" : "Actif") : isExpired ? "Essai gratuit terminé" : subscription ? "Inactif" : "Aucun abonnement"}
        </p>
        {isActive && subscription?.current_period_end && (
          <p className="text-sm mt-1" style={{ color: palette.muted }}>Valable jusqu'au {new Date(subscription.current_period_end).toLocaleDateString("fr-FR")}</p>
        )}
      </div>

      {role !== "proprietaire" ? (
        <p className="text-sm" style={{ color: palette.muted }}>Demandez au propriétaire de souscrire à Margitrack Pro pour continuer à utiliser l'application.</p>
      ) : (
        <div className="flex flex-col gap-3">
          <p className="font-semibold" style={{ color: palette.ink }}>Passer à Pro</p>

          {plan && (
            <div className="rounded-2xl p-4 flex flex-col gap-3" style={{ border: `1px solid ${palette.line}` }}>
              <div>
                <p className="font-semibold" style={{ color: palette.ink }}>{plan.name}</p>
                <p className="text-sm" style={{ color: palette.muted }}>{fcfa(plan.price_fcfa)} / mois</p>
              </div>
              <a
                href={CHARIOW_SUBSCRIBE_URL}
                className="rounded-full py-2.5 text-sm font-semibold text-white text-center"
                style={{ backgroundColor: "#7C5CFF" }}
              >
                Prendre l'abonnement Pro
              </a>
              <p className="text-xs" style={{ color: palette.muted }}>
                Important : payez avec <strong>{profile?.full_name ? "le même email que votre compte Margitrack" : "l'email de votre compte Margitrack"}</strong> — c'est ce qui permet d'activer automatiquement votre abonnement après paiement.
              </p>
            </div>
          )}
        </div>
      )}

      <button onClick={signOut} className="text-sm font-medium text-center py-2" style={{ color: palette.muted }}>
        Se déconnecter
      </button>
    </div>
  );
}
