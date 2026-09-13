import { useCallback, useEffect, useState } from "react";
import { isStandalone } from "./routes";

/**
 * Enregistre le service worker, sans lequel le navigateur ne propose jamais
 * l'installation. En développement il resterait en mémoire entre deux
 * rechargements et servirait un vieux cache : on ne l'active qu'en production.
 */
export function registerServiceWorker() {
  if (typeof window === "undefined") return;
  if (!("serviceWorker" in navigator)) return;
  if (!import.meta.env.PROD) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Un échec d'enregistrement ne doit pas empêcher l'application de
      // fonctionner : elle marche simplement sans mode hors ligne.
    });
  });
}

const INSTALLED_KEY = "margitrack:installed";

function remember(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Navigation privée ou stockage refusé : sans mémoire, on proposera
    // simplement l'installation à nouveau.
  }
}

function recall(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

/**
 * L'application a-t-elle déjà été installée depuis ce navigateur ?
 *
 * Une fois installée, Chrome cesse définitivement d'émettre
 * `beforeinstallprompt` sur cet appareil. Sans mémoire de notre côté, on ne
 * pourrait pas distinguer « impossible à installer » de « déjà installée »,
 * et on afficherait un bouton mort à la personne suivante qui ouvre le site
 * sur ce téléphone.
 */
export function wasInstalledHere() {
  return recall(INSTALLED_KEY) === "1";
}

/**
 * Plateforme, pour donner la marche à suivre exacte quand le navigateur ne
 * propose pas l'installation lui-même.
 */
export function detectPlatform() {
  if (typeof navigator === "undefined") return { id: "other", label: "votre navigateur" };
  const ua = navigator.userAgent;
  const isIos = /iphone|ipad|ipod/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);

  if (isIos) return { id: "ios", label: "Safari sur iPhone" };
  if (/SamsungBrowser/i.test(ua)) return { id: "samsung", label: "Samsung Internet" };
  if (/FxiOS|Firefox/i.test(ua)) return { id: "firefox", label: "Firefox" };
  if (/Android/i.test(ua)) return { id: "android", label: "Chrome sur Android" };
  return { id: "desktop", label: "votre navigateur" };
}

/** Marche à suivre manuelle, quand le navigateur ne propose rien. */
export const MANUAL_STEPS = {
  ios: [
    "Appuyez sur le bouton Partager, en bas de Safari",
    "Faites défiler et choisissez « Sur l'écran d'accueil »",
    "Appuyez sur « Ajouter »",
  ],
  android: [
    "Appuyez sur le menu ⋮ en haut à droite",
    "Choisissez « Installer l'application » ou « Ajouter à l'écran d'accueil »",
    "Confirmez avec « Installer »",
  ],
  samsung: [
    "Appuyez sur le menu ☰ en bas à droite",
    "Choisissez « Ajouter la page à », puis « Écran d'accueil »",
    "Confirmez avec « Ajouter »",
  ],
  firefox: [
    "Appuyez sur le menu ⋮",
    "Choisissez « Installer » ou « Ajouter à l'écran d'accueil »",
    "Confirmez",
  ],
  desktop: [
    "Cliquez sur l'icône d'installation à droite de la barre d'adresse",
    "Ou ouvrez le menu ⋮ puis « Installer Margitrack »",
    "Confirmez avec « Installer »",
  ],
  other: [
    "Ouvrez le menu de votre navigateur",
    "Cherchez « Installer l'application » ou « Ajouter à l'écran d'accueil »",
    "Confirmez",
  ],
};

/**
 * Expose la proposition d'installation du navigateur.
 *
 * `beforeinstallprompt` n'existe que sur les navigateurs Chromium, et même
 * là il est capricieux : il ne se déclenche plus une fois l'application
 * installée, ni pendant plusieurs semaines après un refus. On ne peut donc
 * pas faire dépendre de lui la seule voie d'installation — d'où la marche à
 * suivre manuelle, toujours disponible.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(() => isStandalone() || wasInstalledHere());

  useEffect(() => {
    const onPrompt = (event) => {
      // Sans preventDefault, Chrome affiche sa propre bannière et l'événement
      // ne peut plus être rejoué au moment choisi.
      event.preventDefault();
      setDeferred(event);
    };
    const onInstalled = () => {
      setDeferred(null);
      setInstalled(true);
      remember(INSTALLED_KEY, "1");
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferred) return false;
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    // L'événement n'est utilisable qu'une fois.
    setDeferred(null);
    return outcome === "accepted";
  }, [deferred]);

  const platform = detectPlatform();

  return {
    // Proposition native disponible : un seul geste suffit.
    canInstall: Boolean(deferred) && !installed,
    // Déjà installée sur cet appareil, ou installée par quelqu'un d'autre
    // depuis ce même navigateur.
    installed,
    promptInstall,
    platform,
    manualSteps: MANUAL_STEPS[platform.id] ?? MANUAL_STEPS.other,
    iosHint: platform.id === "ios" && !installed,
  };
}
