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

  // Une application installée continue de servir sa version en cache tant
  // qu'un nouveau service worker n'a pas pris la main. Sans ce suivi, la
  // seule façon de voir une mise à jour était de fermer complètement
  // l'application — ce qu'aucun utilisateur ne devine.
  const watchForUpdate = (registration) => {
    if (registration.waiting) {
      waitingWorker = registration.waiting;
      notify();
    }
    registration.addEventListener("updatefound", () => {
      const incoming = registration.installing;
      if (!incoming) return;
      incoming.addEventListener("statechange", () => {
        // Un service worker « installed » alors qu'un autre contrôle déjà la
        // page est une mise à jour en attente. Sans contrôleur, c'est la
        // toute première installation : rien à signaler.
        if (incoming.state === "installed" && navigator.serviceWorker.controller) {
          waitingWorker = incoming;
          notify();
        }
      });
    });
  };

  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    // Déclenché uniquement après que l'utilisateur a accepté la mise à jour :
    // le service worker n'active plus de lui-même.
    if (reloading) return;
    reloading = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/sw.js")
      .then(watchForUpdate)
      .catch(() => {
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

function forget(key) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Sans stockage, il n'y avait rien à oublier.
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
 * Une fois installée, Chrome cesse d'émettre `beforeinstallprompt` sur cet
 * appareil. Sans mémoire de notre côté, impossible de distinguer
 * « installation indisponible » de « déjà installée », et la personne
 * suivante verrait un bouton mort.
 */
export function wasInstalledHere() {
  return recall(INSTALLED_KEY) === "1";
}

// ---------------------------------------------------------------------------
// Capture de la proposition d'installation, au niveau du module.
//
// `beforeinstallprompt` n'est émis QU'UNE FOIS par chargement de page, et tôt
// — souvent avant qu'un composant ne soit monté. Un écouteur posé dans un
// composant le manque donc, et deux composants qui écoutent chacun de leur
// côté ne peuvent pas tous les deux le recevoir : le premier monté le capte,
// les autres n'ont jamais rien.
//
// L'événement est donc capté ici, dès l'import du module, et partagé. Tout
// composant peut alors le rejouer, quel que soit le moment où il apparaît.
// ---------------------------------------------------------------------------
let deferredPrompt = null;
let installedNow = false;
let waitingWorker = null;
const listeners = new Set();

const notify = () => listeners.forEach((listener) => listener());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Sans preventDefault, Chrome affiche sa propre bannière et l'événement
    // ne peut plus être rejoué au moment choisi.
    event.preventDefault();
    deferredPrompt = event;
    // Le navigateur ne propose l'installation que si l'application n'est pas
    // installée : une mémoire contraire est périmée (application désinstallée).
    installedNow = false;
    forget(INSTALLED_KEY);
    notify();
  });

  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installedNow = true;
    remember(INSTALLED_KEY, "1");
    notify();
  });

  // Le navigateur sait si l'application est installee sur l'appareil, meme
  // lorsqu'elle l'a ete par quelqu'un d'autre, dans une autre session, ou
  // avant que nous ne tenions cette memoire. Sans cette interrogation, la
  // personne suivante voyait une marche a suivre inutile pour installer
  // quelque chose qui etait deja la.
  if (typeof navigator !== "undefined" && navigator.getInstalledRelatedApps) {
    navigator
      .getInstalledRelatedApps()
      .then((apps) => {
        if (apps && apps.length > 0) {
          installedNow = true;
          remember(INSTALLED_KEY, "1");
          notify();
        }
      })
      .catch(() => {
        // Navigateur sans cette capacite : on s'en tient aux autres indices.
      });
  }
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
 * Signale qu'une nouvelle version est prête et permet de l'appliquer.
 *
 * L'application ne se recharge jamais d'elle-même : cela ferait disparaître
 * une saisie en cours. C'est l'utilisateur qui décide du moment.
 */
export function useAppUpdate() {
  const [, bump] = useState(0);

  useEffect(() => {
    const listener = () => bump((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const applyUpdate = useCallback(() => {
    if (!waitingWorker) return;
    // Le service worker prend alors la main, ce qui déclenche
    // controllerchange, et la page se recharge sur la nouvelle version.
    waitingWorker.postMessage("SKIP_WAITING");
  }, []);

  return { updateReady: Boolean(waitingWorker), applyUpdate };
}

/**
 * Expose la proposition d'installation partagée.
 *
 * Plusieurs composants peuvent l'utiliser simultanément : ils lisent tous le
 * même événement capté au niveau du module, et sont prévenus dès qu'il
 * arrive — y compris s'ils sont montés après lui.
 */
export function useInstallPrompt() {
  const [, bump] = useState(0);

  useEffect(() => {
    const listener = () => bump((n) => n + 1);
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  }, []);

  const promptInstall = useCallback(async () => {
    const event = deferredPrompt;
    if (!event) return false;
    // L'événement n'est utilisable qu'une fois : on le retire avant de
    // l'ouvrir, pour qu'un double appui ne le rejoue pas.
    deferredPrompt = null;
    notify();

    event.prompt();
    const { outcome } = await event.userChoice;
    return outcome === "accepted";
  }, []);

  const installed = installedNow || isStandalone() || wasInstalledHere();
  const platform = detectPlatform();

  return {
    // Proposition native disponible : un seul geste suffit.
    canInstall: Boolean(deferredPrompt) && !installed,
    installed,
    promptInstall,
    platform,
    manualSteps: MANUAL_STEPS[platform.id] ?? MANUAL_STEPS.other,
    iosHint: platform.id === "ios" && !installed,
  };
}
