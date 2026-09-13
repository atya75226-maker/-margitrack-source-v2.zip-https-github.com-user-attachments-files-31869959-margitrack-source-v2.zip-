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

/**
 * Expose la proposition d'installation du navigateur.
 *
 * `beforeinstallprompt` n'existe que sur les navigateurs Chromium. Sur iOS,
 * l'installation passe obligatoirement par « Partager → Sur l'écran d'accueil »,
 * d'où `iosHint` : sans cette indication, un utilisateur iPhone ne verrait
 * aucun moyen d'installer l'application.
 */
export function useInstallPrompt() {
  const [deferred, setDeferred] = useState(null);
  const [installed, setInstalled] = useState(isStandalone);

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

  const isIos =
    typeof navigator !== "undefined" &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !/crios|fxios/i.test(navigator.userAgent);

  return {
    canInstall: Boolean(deferred) && !installed,
    installed,
    promptInstall,
    iosHint: isIos && !installed,
  };
}
