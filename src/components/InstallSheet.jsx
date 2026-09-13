import React, { useState } from "react";
import { COLOR } from "../lib/theme";
import { useInstallPrompt } from "../lib/pwa";

/**
 * Écran d'installation, ouvert quand le visiteur clique sur « Commencer
 * gratuitement ».
 *
 * L'installation ne peut pas reposer sur la seule proposition du navigateur :
 * Chrome ne l'émet plus une fois l'application installée sur l'appareil, ni
 * pendant plusieurs semaines après un refus. Un seul refus, ou une première
 * installation par quelqu'un d'autre sur le même téléphone, suffisait à
 * rendre l'installation introuvable pour tous les suivants.
 *
 * Trois issues sont donc toujours ouvertes : le bouton natif quand il existe,
 * la marche à suivre manuelle sinon, et la croix pour continuer sans
 * installer — personne ne doit se retrouver bloqué ici.
 */
export function InstallSheet({ onClose, onContinue }) {
  const { canInstall, installed, promptInstall, platform, manualSteps } = useInstallPrompt();
  const [showSteps, setShowSteps] = useState(false);
  const [done, setDone] = useState(false);

  const install = async () => {
    const accepted = await promptInstall();
    if (accepted) setDone(true);
    // Un refus laisse l'écran ouvert : la marche à suivre manuelle reste
    // accessible, et le visiteur peut toujours continuer sans installer.
    else setShowSteps(true);
  };

  const card = {
    backgroundColor: "#111827",
    border: `1px solid ${COLOR.line}`,
  };

  return (
    <div
      className="fixed inset-0 z-40 flex items-end sm:items-center sm:justify-center bg-black/60 overflow-y-auto"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Installer Margitrack"
    >
      <div
        className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-3xl p-6 relative my-auto"
        style={card}
        onClick={(e) => e.stopPropagation()}
      >
        {/* La croix, à l'extrémité : on doit toujours pouvoir passer outre. */}
        <button
          onClick={onClose}
          aria-label="Fermer"
          className="absolute top-3 right-3 w-9 h-9 rounded-full flex items-center justify-center text-xl leading-none"
          style={{ color: COLOR.muted, backgroundColor: COLOR.elevated }}
        >
          ×
        </button>

        <img src="/logo.svg" alt="" className="w-14 h-14 rounded-2xl mb-4" />

        {done || installed ? (
          <>
            <p className="text-lg font-semibold font-display" style={{ color: COLOR.ink }}>
              {done ? "Margitrack est installé" : "Margitrack est déjà installé"}
            </p>
            <p className="text-sm mt-2" style={{ color: COLOR.muted }}>
              {done
                ? "Retrouvez l'icône sur votre écran d'accueil. Vous pouvez créer votre compte dès maintenant."
                : "L'application est déjà présente sur cet appareil : ouvrez-la depuis votre écran d'accueil. Vous pouvez aussi continuer ici et vous connecter avec votre compte."}
            </p>
          </>
        ) : (
          <>
            <p className="text-lg font-semibold font-display" style={{ color: COLOR.ink }}>
              Installez Margitrack
            </p>
            <p className="text-sm mt-2" style={{ color: COLOR.muted }}>
              Gérez votre restaurant depuis votre écran d'accueil, comme une
              vraie application.
            </p>

            <ul className="mt-4 space-y-2 text-sm" style={{ color: COLOR.ink }}>
              {[
                "Une icône sur l'écran d'accueil, ouverture en un geste",
                "Plein écran, sans barre de navigateur",
                "S'ouvre même sans connexion",
              ].map((benefit) => (
                <li key={benefit} className="flex items-start gap-2.5">
                  <span
                    className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: COLOR.violet }}
                  />
                  <span>{benefit}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="mt-6 space-y-2">
          {!done && !installed && canInstall && (
            <button
              onClick={install}
              className="w-full rounded-full py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: COLOR.violet }}
            >
              Installer l'application
            </button>
          )}

          {!done && !installed && !canInstall && !showSteps && (
            <button
              onClick={() => setShowSteps(true)}
              className="w-full rounded-full py-3 text-sm font-semibold text-white"
              style={{ backgroundColor: COLOR.violet }}
            >
              Comment installer sur {platform.label}
            </button>
          )}

          {showSteps && !done && !installed && (
            <div
              className="rounded-2xl p-4 text-sm"
              style={{ backgroundColor: COLOR.elevated, color: COLOR.ink }}
            >
              <p className="font-medium mb-2">Sur {platform.label} :</p>
              <ol className="space-y-1.5 list-decimal list-inside" style={{ color: COLOR.muted }}>
                {manualSteps.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          <button
            onClick={onContinue}
            className="w-full rounded-full py-3 text-sm font-semibold border"
            style={{ borderColor: COLOR.line, color: COLOR.ink }}
          >
            {done || installed ? "Créer mon compte" : "Continuer sans installer"}
          </button>
        </div>

        {!done && !installed && !showSteps && canInstall && (
          <button
            onClick={() => setShowSteps(true)}
            className="w-full mt-3 text-xs"
            style={{ color: COLOR.muted }}
          >
            L'installation ne se lance pas ? Voir la méthode manuelle
          </button>
        )}
      </div>
    </div>
  );
}
