import React from "react";

export function TrialBanner({ isTrial, isExpired, daysRemaining, onUpgrade }) {
  if (isExpired) {
    return (
      <div className="bg-rose-500/10 border-b border-rose-500/20 px-4 py-2.5 flex items-center justify-between gap-3">
        <p className="text-xs text-rose-400">Votre essai gratuit est terminé. Choisissez Margitrack Pro pour continuer à utiliser toutes les fonctionnalités.</p>
        <button onClick={onUpgrade} className="shrink-0 rounded-full bg-rose-600 text-white text-xs font-semibold px-3 py-1.5">Choisir mon abonnement</button>
      </div>
    );
  }
  if (!isTrial || daysRemaining === null) return null;
  const urgent = daysRemaining <= 2;
  // Avec un essai d'un mois, annoncer « se termine bientôt » dès le premier
  // jour serait faux et finirait par ne plus être lu. L'alerte n'apparaît que
  // dans la dernière semaine.
  const message =
    daysRemaining <= 0
      ? "Votre essai gratuit se termine aujourd'hui."
      : daysRemaining === 1
        ? "Il vous reste 1 jour d'essai gratuit."
        : daysRemaining <= 7
          ? `${daysRemaining} jours restants — votre essai gratuit se termine bientôt.`
          : `Il vous reste ${daysRemaining} jours d'essai gratuit.`;
  return (
    <div className={`px-4 py-2 flex items-center justify-between gap-3 border-b ${urgent ? "bg-amber-500/10 border-amber-500/20" : "bg-[#7C5CFF]/10 border-[#7C5CFF]/20"}`}>
      <p className={`text-xs ${urgent ? "text-amber-400" : "text-[#A78BFA]"}`}>{message}</p>
      {urgent && (<button onClick={onUpgrade} className="shrink-0 rounded-full bg-[#7C5CFF] text-white text-xs font-semibold px-3 py-1.5">Passer à Pro</button>)}
    </div>
  );
}
