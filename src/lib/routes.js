import { useEffect, useState } from "react";

/**
 * Séparation entre le site vitrine et l'application.
 *
 *   "/"                 site public : présentation de Margitrack
 *   "/app"              connexion
 *   "/app/inscription"  création de compte
 *   "/app/…"            application, une fois connecté
 *
 * Tout ce qui appartient à l'application vit sous "/app", et rien d'autre.
 * C'est ce préfixe qui sert de `scope` au manifeste : une application
 * installée ne peut donc pas afficher la page d'accueil marketing.
 *
 * Un routeur complet n'est pas nécessaire ici : l'application n'a que deux
 * frontières, le reste de la navigation se fait par onglets à l'intérieur
 * d'un même écran.
 */
export const APP_PATH = "/app";
export const SIGNUP_PATH = "/app/inscription";

export function currentPath() {
  const path = window.location.pathname.replace(/\/+$/, "");
  return path === "" ? "/" : path;
}

export function isAppRoute(path = currentPath()) {
  return path === APP_PATH || path.startsWith(`${APP_PATH}/`);
}

/** L'application tourne-t-elle dans sa propre fenêtre, hors navigateur ? */
export function isStandalone() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    window.matchMedia?.("(display-mode: fullscreen)").matches ||
    // Safari iOS n'implémente pas display-mode.
    window.navigator.standalone === true
  );
}

export function navigate(to, { replace = false } = {}) {
  if (currentPath() === to) return;
  window.history[replace ? "replaceState" : "pushState"]({}, "", to);
  // pushState ne déclenche pas popstate : on prévient l'application nous-mêmes.
  window.dispatchEvent(new Event("margitrack:navigate"));
}

export function useRoute() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const sync = () => setPath(currentPath());
    window.addEventListener("popstate", sync);
    window.addEventListener("margitrack:navigate", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("margitrack:navigate", sync);
    };
  }, []);

  return path;
}
