import React, { useCallback, useState } from "react";
import { usePreferences } from "../contexts/PreferencesContext";
import { useAppUpdate, useInstallPrompt } from "../lib/pwa";

/**
 * Deux points d'entrée vers l'installation, à l'intérieur de l'application.
 *
 * L'installation passe par la proposition du navigateur lui-même : un appui,
 * et l'icône est sur l'écran d'accueil. Aucun écran intermédiaire.
 *
 * Quand le navigateur n'émet pas cette proposition — application déjà
 * installée sur l'appareil, ou navigateur qui ne la prend pas en charge, tel
 * Safari sur iPhone — ces composants s'effacent : un bouton qui n'installe
 * rien, ou une marche à suivre à lire, vaut moins que rien du tout.
 */

const DISMISS_KEY = "margitrack:install-banner-dismissed";

// Une notification renvoyée à chaque ouverture serait harcelante, oubliée
// pour toujours elle serait inutile : elle est masquée pour la session en
// cours, et revient à la prochaine ouverture de l'application.
function dismissedThisSession() {
  try {
    return window.sessionStorage.getItem(DISMISS_KEY) === "1";
  } catch {
    return false;
  }
}

function rememberDismissal() {
  try {
    window.sessionStorage.setItem(DISMISS_KEY, "1");
  } catch {
    // Sans stockage de session, la notification réapparaîtra : acceptable.
  }
}

/**
 * Notification d'installation, affichée en haut de l'application. Se referme
 * comme n'importe quelle notification, et revient à la prochaine ouverture.
 */
export function InstallBanner() {
  const { palette } = usePreferences();
  const { canInstall, promptInstall } = useInstallPrompt();
  const [hidden, setHidden] = useState(dismissedThisSession);

  const dismiss = useCallback(() => {
    rememberDismissal();
    setHidden(true);
  }, []);

  if (!canInstall || hidden) return null;

  return (
    <div
      className="rounded-2xl p-3 mb-3 flex items-center gap-3"
      style={{
        backgroundColor: "rgba(124,92,255,0.12)",
        border: "1px solid rgba(124,92,255,0.35)",
      }}
    >
      <img src="/logo.svg" alt="" className="w-9 h-9 rounded-xl shrink-0" />

      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: palette.ink }}>
          Installer Margitrack
        </p>
        <p className="text-xs" style={{ color: palette.muted }}>
          Un geste depuis l'écran d'accueil.
        </p>
      </div>

      <button
        onClick={promptInstall}
        className="shrink-0 rounded-full text-xs font-semibold text-white px-3.5 py-2"
        style={{ backgroundColor: "#7C5CFF" }}
      >
        Installer
      </button>

      <button
        onClick={dismiss}
        aria-label="Masquer cette notification"
        className="shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-lg leading-none"
        style={{ color: palette.muted }}
      >
        ×
      </button>
    </div>
  );
}

/**
 * Accès permanent à l'installation depuis l'accueil : contrairement à la
 * notification, il ne se masque jamais tant que le navigateur propose
 * l'installation. Chaque compte y a donc toujours accès.
 */
export function InstallCard() {
  const { palette } = usePreferences();
  const { canInstall, installed, promptInstall, platform } = useInstallPrompt();

  if (installed) {
    return (
      <div
        className="rounded-2xl p-4 mb-3"
        style={{ backgroundColor: palette.card, border: `1px solid ${palette.line}` }}
      >
        <p className="text-sm font-semibold" style={{ color: palette.ink }}>
          Application installée
        </p>
        <p className="text-xs mt-1" style={{ color: palette.muted }}>
          Margitrack est présent sur cet appareil : ouvrez-le depuis votre écran
          d'accueil. L'installation vaut pour le téléphone, elle n'est pas à
          refaire pour chaque compte.
        </p>
      </div>
    );
  }

  // Ni installable ni installée : le navigateur ne sait pas le faire (iPhone,
  // par exemple). Rien à afficher — l'ajout se fait alors par son menu.
  if (!canInstall) return null;

  return (
    <button
      onClick={promptInstall}
      className="w-full rounded-2xl p-4 mb-3 flex items-center gap-3 text-left"
      style={{ backgroundColor: palette.card, border: `1px solid ${palette.line}` }}
    >
      <img src="/logo.svg" alt="" className="w-10 h-10 rounded-xl shrink-0" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: palette.ink }}>
          Installer l'application
        </p>
        <p className="text-xs" style={{ color: palette.muted }}>
          Sur {platform.label} — icône sur l'écran d'accueil, plein écran, hors connexion
        </p>
      </div>
      <span className="text-lg shrink-0" style={{ color: "#7C5CFF" }}>→</span>
    </button>
  );
}

/**
 * Nouvelle version disponible.
 *
 * Une application installée sert sa version en cache jusqu'à ce qu'un
 * nouveau service worker prenne la main. Sans cette invite, la seule façon
 * de voir une correction était de fermer complètement l'application, ce que
 * personne ne devine.
 */
export function UpdateBanner() {
  const { palette } = usePreferences();
  const { updateReady, applyUpdate } = useAppUpdate();
  const [applying, setApplying] = useState(false);

  if (!updateReady) return null;

  return (
    <div
      className="rounded-2xl p-3 mb-3 flex items-center gap-3"
      style={{
        backgroundColor: "rgba(16,185,129,0.12)",
        border: "1px solid rgba(16,185,129,0.35)",
      }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold" style={{ color: palette.ink }}>
          Nouvelle version disponible
        </p>
        <p className="text-xs" style={{ color: palette.muted }}>
          Vos données en cours sont conservées.
        </p>
      </div>
      <button
        onClick={() => { setApplying(true); applyUpdate(); }}
        disabled={applying}
        className="shrink-0 rounded-full text-xs font-semibold text-white px-3.5 py-2 disabled:opacity-60"
        style={{ backgroundColor: "#10B981" }}
      >
        {applying ? "Mise à jour…" : "Mettre à jour"}
      </button>
    </div>
  );
}
